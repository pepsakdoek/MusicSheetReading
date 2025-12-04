// music-generator.js
// Generates a "score" object (for playback) and can render it to MusicXML.
// Tabs used for indentation.

// NOTE: This file expects `SCALE_PATTERNS`, `CHORD_PROGRESSIONS` to exist
// (from your scales.js). If you prefer, those can be imported/duplicated here.

/* ----------------------------------------
   Utilities (existing logic, lightly adapted)
   ---------------------------------------- */

function midiToPitch(midi) {
	const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
	const step = notes[midi % 12];
	const octave = Math.floor(midi / 12) - 1;
	let alter = '';
	if (step.includes('#')) {
		alter = '<alter>1</alter>';
	}
	// returns inner XML for <pitch>
	return `<step>${step.charAt(0)}</step>${alter}<octave>${octave}</octave>`;
}

function getScaleMidiNotes(key, scaleType = 'major') {
	const keyMap = {
		"C Major":  { fifths: 0,  tonic: 60 }, // C4
		"G Major":  { fifths: 1,  tonic: 67 }, // G4
		"D Major":  { fifths: 2,  tonic: 62 }, // D4
		"A Major":  { fifths: 3,  tonic: 69 }, // A4
		"E Major":  { fifths: 4,  tonic: 64 }, // E4
		"B Major":  { fifths: 5,  tonic: 71 }, // B4
		"F Major":  { fifths: -1, tonic: 65 }, // F4
		"Bb Major": { fifths: -2, tonic: 70 }, // Bb4
		"Eb Major": { fifths: -3, tonic: 63 }, // Eb4
		"Ab Major": { fifths: -4, tonic: 68 }, // Ab4
		"Db Major": { fifths: -5, tonic: 61 }, // Db4
		"Gb Major": { fifths: -6, tonic: 66 }, // Gb4
	};
	const scalePattern = SCALE_PATTERNS[scaleType] || SCALE_PATTERNS['major'];
	const info = keyMap[key] || keyMap["C Major"];
	let scale = [];
	scalePattern.forEach(interval => {
		scale.push(info.tonic - 24 + interval);
		scale.push(info.tonic - 12 + interval);
		scale.push(info.tonic + interval);
		scale.push(info.tonic + 12 + interval);
	});
	scale = [...new Set(scale)].sort((a, b) => a - b);
	return {
		treble: scale.filter(m => m >= 60 && m <= 84),
		bass: scale.filter(m => m >= 36 && m <= 59),
		fifths: info.fifths,
		tonic: info.tonic
	};
}

function getChordNotes(scaleMidi, scalePattern, degree) {
	// degree: 1..n (roman numeral). scaleMidi is an ordered array of pitch classes across octaves.
	const rootNote = scaleMidi[degree - 1];
	if (rootNote === undefined) return [];

	const rootOffset = scalePattern[degree - 1];
	const thirdInterval = scalePattern[(degree - 1 + 2) % scalePattern.length] - rootOffset;
	const fifthInterval = scalePattern[(degree - 1 + 4) % scalePattern.length] - rootOffset;

	const third = rootNote + (thirdInterval < 0 ? thirdInterval + 12 : thirdInterval);
	const fifth = rootNote + (fifthInterval < 0 ? fifthInterval + 12 : fifthInterval);
	const chord = [rootNote, third, fifth];

	const bassChordNotes = [];
	for (let note of chord) {
		bassChordNotes.push(note - 24, note - 12, note, note + 12);
	}

	return [...new Set(bassChordNotes)].filter(n => n >= 36 && n <= 59).sort((a, b) => a - b);
}

/* ----------------------------------------
   Duration helpers (for playback and MusicXML)
   ---------------------------------------- */

// seconds per duration used by audio player
function durationToSeconds(durationStr, bpm) {
	const quarter = 60 / bpm;
	switch (durationStr) {
		case "1n":	return quarter * 4;
		case "2n":	return quarter * 2;
		case "4n":	return quarter;
		case "8n":	return quarter / 2;
		case "16n":	return quarter / 4;
		case "4n.":	return quarter * 1.5;
		case "8n.":	return (quarter / 2) * 1.5;
		default:
			console.warn("Unknown duration for seconds:", durationStr, "defaulting to quarter");
			return quarter;
	}
}

// MusicXML duration values: we'll use divisions=16 per quarter to allow 16th notes
function durationToDivisions(durationStr, divisionsPerQuarter) {
	switch (durationStr) {
		case "1n":	return divisionsPerQuarter * 4;
		case "2n":	return divisionsPerQuarter * 2;
		case "4n":	return divisionsPerQuarter;
		case "8n":	return Math.floor(divisionsPerQuarter / 2);
		case "16n":	return Math.floor(divisionsPerQuarter / 4);
		case "4n.":	return Math.floor(divisionsPerQuarter * 1.5);
		case "8n.":	return Math.floor((divisionsPerQuarter / 2) * 1.5);
		default:
			console.warn("Unknown duration for divisions:", durationStr, "defaulting to quarter");
			return divisionsPerQuarter;
	}
}

/* ----------------------------------------
   Event model / helper constructors
   ---------------------------------------- */

function makeNote(midi, duration = "4n", velocity = 90) {
	return { type: "note", midi, duration, velocity };
}

function makeChord(midiArray, duration = "4n", velocity = 90) {
	return { type: "chord", midi: midiArray.slice(), duration, velocity };
}

function makeRest(duration = "4n") {
	return { type: "rest", duration };
}

/* ----------------------------------------
   Generator: produce score object
   ---------------------------------------- */

/*
	Returns:
	{
		meta: { title, bpm, key, timeSig, bars, divisionsPerQuarter },
		parts: [
			{ id: "treble", clef: "G", measures: [ [event,...], [event,...] ], events: [flat list] },
			{ id: "bass",   clef: "F", measures: [...], events: [...] }
		]
	}
*/
function generatePracticeScore(title = "Practice", options = {}) {
	const defaults = {
		key: "C Major",
		scale: "major",
		bpm: 90,
		bars: 8,
		startTonic: true,
		maxJump: 12,            // max melodic jump in semitones
		timeSig: { beats: 4, beatType: 4 },
		divisionsPerQuarter: 16 // MusicXML divisions used later
	};
	const cfg = Object.assign({}, defaults, options);

	const scaleInfo = getScaleMidiNotes(cfg.key, cfg.scale);
	const scalePattern = SCALE_PATTERNS[cfg.scale] || SCALE_PATTERNS['major'];

	// parts and accumulation
	const treble = { id: "treble", clef: "G", measures: [], events: [] };
	const bass = { id: "bass", clef: "F", measures: [], events: [] };

	// Helper to push measure events and flatten them
	function pushMeasure(part, measureEvents) {
		part.measures.push(measureEvents);
		for (const e of measureEvents) part.events.push(e);
	}

	// --- Treble generation ---
	let prevTreble = null;
	for (let bar = 1; bar <= cfg.bars; bar++) {
		// final bar will be a single whole (1n) note to close
		if (bar === cfg.bars) {
			// pick final note near tonic in either octave
			const candidates = [scaleInfo.tonic, scaleInfo.tonic + 12];
			const finalMidi = candidates.reduce((a, b) => (Math.abs(a - (prevTreble || a)) < Math.abs(b - (prevTreble || b)) ? a : b));
			const ev = makeNote(finalMidi, "1n");
			pushMeasure(treble, [ev]);
			prevTreble = finalMidi;
			continue;
		}

		// for simplicity preserve original behaviour: 4 quarter notes per measure
		const measure = [];
		for (let beat = 0; beat < cfg.timeSig.beats; beat++) {
			let chosen;
			if (bar === 1 && beat === 0 && cfg.startTonic) {
				chosen = scaleInfo.tonic;
			} else if (prevTreble !== null) {
				const candidates = scaleInfo.treble.filter(m => Math.abs(m - prevTreble) <= cfg.maxJump);
				chosen = candidates.length > 0
					? candidates[Math.floor(Math.random() * candidates.length)]
					: scaleInfo.treble[Math.floor(Math.random() * scaleInfo.treble.length)];
			} else {
				chosen = scaleInfo.treble[Math.floor(Math.random() * scaleInfo.treble.length)];
			}
			prevTreble = chosen;
			measure.push(makeNote(chosen, "4n"));
		}
		pushMeasure(treble, measure);
	}

	// --- Bass generation (chord-based) ---
	// Choose progression by bar count, fallback to common progression
	const progression = (CHORD_PROGRESSIONS[cfg.bars] && CHORD_PROGRESSIONS[cfg.bars][0]) || ['I', 'IV', 'V', 'I'];
	const romanNumerals = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7 };

	let prevBass = null;
	for (let bar = 1; bar <= cfg.bars; bar++) {
        // If no chord notes, fallback to a scale bass note
		const measure = [];
		if (bar === cfg.bars) {
			// final bar: tonic in octave below + tonic on top as chord
            const low = scaleInfo.tonic - 12;
            const measure = [ makeNote(low, "1n") ];
            pushMeasure(bass, measure);
			continue;
		}

		const chordSymbol = progression[(bar - 1) % progression.length].toLowerCase();
		const chordDegree = romanNumerals[chordSymbol.toUpperCase()] || 1;
		const fullScale = [...new Set([...scaleInfo.bass, ...scaleInfo.treble])].sort((a, b) => a - b);
		const chordCandidates = getChordNotes(fullScale, scalePattern, chordDegree);


		for (let beat = 0; beat < cfg.timeSig.beats; beat++) {
			let chosen;
			if (bar === 1 && beat === 0 && cfg.startTonic && chordDegree === 1) {
				chosen = scaleInfo.tonic - 12;
				if (!chordCandidates.includes(chosen)) chosen = chordCandidates[0] || scaleInfo.bass[0];
			} else if (prevBass !== null) {
				const candidates = chordCandidates.filter(m => Math.abs(m - prevBass) <= cfg.maxJump);
				chosen = candidates.length > 0
					? candidates[Math.floor(Math.random() * candidates.length)]
					: chordCandidates[Math.floor(Math.random() * chordCandidates.length)];
			} else {
				chosen = chordCandidates.length > 0 ? chordCandidates[Math.floor(Math.random() * chordCandidates.length)] : scaleInfo.bass[Math.floor(Math.random() * scaleInfo.bass.length)];
			}
			prevBass = chosen;
			// For a slightly richer bass feel, make the bass a note on beat 1 and optional octave on other beats:
			// if (beat === 0) {
			// 	// Use a chord-y event: root + octave above (optional)
			// 	const chordRoot = chosen;
			// 	const chordVoicing = [chordRoot, chordRoot + 12]; // simple two-note bass sonority
			// 	measure.push(makeChord(chordVoicing, "4n"));
			// } else {
				measure.push(makeNote(chosen, "4n"));
			// }
		}
		pushMeasure(bass, measure);
	}

	const score = {
		meta: {
			title,
			bpm: cfg.bpm,
			key: cfg.key,
			scale: cfg.scale,
			timeSig: cfg.timeSig,
			bars: cfg.bars,
			divisionsPerQuarter: cfg.divisionsPerQuarter
		},
		parts: [ treble, bass ]
	};

	return score;
}

/* ----------------------------------------
   MusicXML renderer (converts the generated score -> MusicXML)
   ---------------------------------------- */

function renderScoreToMusicXML(score) {
	if (!score || !score.parts || score.parts.length === 0) return "";

	const meta = score.meta || {};
	const divisions = meta.divisionsPerQuarter || 16;
	const timeBeats = (meta.timeSig && meta.timeSig.beats) || 4;
	const beatType = (meta.timeSig && meta.timeSig.beatType) || 4;

	// header
	let xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n`;
	xml += `<!DOCTYPE score-partwise PUBLIC\n\t"-//Recordare//DTD MusicXML 3.1 Partwise//EN"\n\t"http://www.musicxml.org/dtds/partwise.dtd">\n`;
	xml += `<score-partwise version="3.1">\n`;
	xml += `\t<work>\n\t\t<work-title>${meta.title || "Practice"}</work-title>\n\t</work>\n`;
	xml += `\t<part-list>\n`;
    xml += `<part-group type="start" number="1"><group-symbol>brace</group-symbol><group-barline>yes</group-barline></part-group>\n`;

	// create part-list entries
    
	for (let i = 0; i < score.parts.length; i++) {
		const pid = `P${i+1}`;
		xml += `\t\t<score-part id="${pid}">\n`;
		xml += `\t\t\t<part-name>${score.parts[i].id}</part-name>\n`;
		xml += `\t\t</score-part>\n`;
	}
	xml += `\t</part-list>\n`;

	// each part -> measures
	for (let p = 0; p < score.parts.length; p++) {
		const part = score.parts[p];
		const pid = `P${p+1}`;
		xml += `\t<part id="${pid}">\n`;

		for (let m = 0; m < part.measures.length; m++) {
			const measureEvents = part.measures[m];
			const measureNumber = m + 1;
			xml += `\t\t<measure number="${measureNumber}">\n`;

			// attributes on first measure
			if (measureNumber === 1) {
				xml += `\t\t\t<attributes>\n`;
				xml += `\t\t\t\t<divisions>${divisions}</divisions>\n`;
				// key signature: try to extract fifths if possible (we didn't store it in meta but we can try)
				let fifths = 0;
				try {
					const s = getScaleMidiNotes(meta.key, meta.scale);
					fifths = s.fifths || 0;
				} catch (e) {
					fifths = 0;
				}
				xml += `\t\t\t\t<key><fifths>${fifths}</fifths></key>\n`;
				xml += `\t\t\t\t<time><beats>${timeBeats}</beats><beat-type>${beatType}</beat-type></time>\n`;
				xml += `\t\t\t\t<clef><sign>${part.clef || 'G'}</sign><line>${part.clef === 'F' ? 4 : 2}</line></clef>\n`;
				xml += `\t\t\t</attributes>\n`;
			}

			// emit each event as MusicXML notes/rests
			let firstOfChordFlag = false;
			for (let ev of measureEvents) {
				if (!ev) continue;

				// Compute duration in MusicXML divisions
				const durVal = durationToDivisions(ev.duration || "4n", divisions);

				// handle rests
				if (ev.type === "rest") {
					xml += `\t\t\t<note>\n`;
					xml += `\t\t\t\t<rest/>\n`;
					xml += `\t\t\t\t<duration>${durVal}</duration>\n`;
					xml += `\t\t\t\t<type>${musicxmlTypeForDuration(ev.duration)}</type>\n`;
					xml += `\t\t\t</note>\n`;
					firstOfChordFlag = false;
					continue;
				}

				// handle single note
				if (ev.type === "note") {
					xml += `\t\t\t<note>\n`;
					xml += `\t\t\t\t<pitch>${midiToPitch(ev.midi)}</pitch>\n`;
					xml += `\t\t\t\t<duration>${durVal}</duration>\n`;
					xml += `\t\t\t\t<type>${musicxmlTypeForDuration(ev.duration)}</type>\n`;
					xml += `\t\t\t</note>\n`;
					firstOfChordFlag = false;
					continue;
				}

				// handle chord: first pitch without <chord/>, subsequent pitches with <chord/>
				if (ev.type === "chord") {
					const notes = ev.midi;
					if (!Array.isArray(notes) || notes.length === 0) continue;
					for (let ni = 0; ni < notes.length; ni++) {
						xml += `\t\t\t<note>\n`;
						if (ni > 0) xml += `\t\t\t\t<chord/>\n`;
						xml += `\t\t\t\t<pitch>${midiToPitch(notes[ni])}</pitch>\n`;
						xml += `\t\t\t\t<duration>${durVal}</duration>\n`;
						xml += `\t\t\t\t<type>${musicxmlTypeForDuration(ev.duration)}</type>\n`;
						xml += `\t\t\t</note>\n`;
					}
					firstOfChordFlag = false;
					continue;
				}
			}

			// Add a final barline to the last measure
			if (measureNumber === part.measures.length) {
				xml += `\t\t\t<barline location="right">\n`;
				xml += `\t\t\t\t<bar-style>light-heavy</bar-style>\n`;
				xml += `\t\t\t</barline>\n`;
			}

			xml += `\t\t</measure>\n`;
		}

		xml += `\t</part>\n`;
	}

	xml += `</score-partwise>`;
	return xml;
}

// helper to choose a MusicXML <type> string from our duration tokens
function musicxmlTypeForDuration(dur) {
	switch (dur) {
		case "1n":	return "whole";
		case "2n":	return "half";
		case "4n":	return "quarter";
		case "8n":	return "eighth";
		case "16n":	return "16th";
		case "4n.":	return "quarter"; // type remains quarter but duration will be longer (dotted)
		case "8n.":	return "eighth";
		default:	return "quarter";
	}
}

/* ----------------------------------------
   Utilities exported / convenient wrappers
   ---------------------------------------- */

function generatePractice(title = "Practice", options = {}) {
	// returns { score, musicXml } for backward compatibility with existing code
	const score = generatePracticeScore(title, options);
	const musicXml = renderScoreToMusicXML(score);
	return { score, musicXml };
}

// Exported API (attach to window for simple use; adapt to your module system if needed)
if (typeof window !== "undefined") {
	window.MusicGenerator = {
		generatePracticeScore, // returns score object for playback
		renderScoreToMusicXML, // convert a score to MusicXML
		generatePracticeScoreAndXml: generatePractice // returns { score, musicXml }
	};
}
