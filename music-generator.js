// music-generator.js
// Generates a "score" object (for playback) and can render it to MusicXML.
// Tabs used for indentation.

// NOTE: This file expects `SCALE_PATTERNS`, `CHORD_PROGRESSIONS` to exist
// (from your scales.js). If you prefer, those can be imported/duplicated here.


function generatePracticeScore(title = "Practice", options) {
	console.log("Generating practice score:", title, options);
	// defaults
	options = options || {};
	const key = options.key || "C";
	const scale = options.scale || "major";
	const bars = options.bars || 8;
	const layers = Number.isInteger(options.layers) ? options.layers : 1;
	//const title = options.title || "Practice Piece";
	const mode = options.mode || "layered";
	const seed = options.seed || null;

	// configuration for voice ranges and divisions (these names match helpers' expectations)
	const cfg = Object.assign({
		bars: bars,
		trebleLow: 60,    // Middle C (C4) and above for treble by default
		trebleHigh: 84,   // C6
		bassLow: 36,      // C2
		bassHigh: 60,     // C4 (middle C)
		divisions: 480    // default MusicXML divisions per quarter
	}, options.cfg || {});

	// progression: prefer explicit option, otherwise a default I-IV-V-I style progression repeated
	let progression = options.progression && options.progression.length ? options.progression.slice(0, bars) : null;
	if (!progression) {
		// default sequence repeated to reach bars
		const defaultProg = ['I','IV','V','I'];
		progression = [];
		for (let i = 0; i < bars; i++) progression.push(defaultProg[i % defaultProg.length]);
	}

	// retrieve scale information (expects helper: getScaleInfo(key, scale) -> { fullScale, pattern, tonic })
	// If you have a different method, adapt this call.
	let scaleInfo = null;
	if (typeof getScaleInfo === "function") {
		scaleInfo = getScaleInfo(key, scale);
	} else {
		// fallback: attempt to compute a simple C-major style mapping (very small fallback)
		const tonicMidi = 60; // middle C as fallback tonic
		scaleInfo = {
			fullScale: [48,50,52,53,55,57,59,60,62,64,65,67,69,71,72], // two-octave-ish chromatic-ish fallback
			pattern: "major",
			tonic: tonicMidi
		};
	}

	// Build base score (whole-note chord per bar)
	const baseScore = buildBaseScoreFromProgression(progression, cfg, {
		fullScale: scaleInfo.fullScale,
		pattern: scaleInfo.pattern,
		tonic: scaleInfo.tonic
	});

	// Make sure parts exist
	let treble = baseScore.parts && baseScore.parts[0] ? baseScore.parts[0] : { id: "treble", clef: "G", measures: [] };
	let bass = baseScore.parts && baseScore.parts[1] ? baseScore.parts[1] : { id: "bass", clef: "F", measures: [] };

	// Ensure both parts have measures length equal to cfg.bars
	treble.measures = treble.measures || [];
	bass.measures = bass.measures || [];
	for (let i = 0; i < cfg.bars; i++) {
		if (!treble.measures[i]) treble.measures[i] = [ makeRest("1n") ];
		if (!bass.measures[i]) bass.measures[i] = [ makeRest("1n") ];
	}

	// Apply complexity layers deterministically
	// Each call transforms the current durations into the next level of rhythmic/harmonic complexity
	for (let L = 1; L <= layers; L++) {
		applyComplexityLayer({ parts: [treble, bass] }, L, cfg, {
			fullScale: scaleInfo.fullScale,
			pattern: scaleInfo.pattern,
			tonic: scaleInfo.tonic
		}, progression);
	}

	// Final normalization pass:
	//	- ensure no measure exceeds total duration per bar (1 whole = "1n")
	//	- if a measure is shorter than a bar, pad with rests (deterministic)
	//	- convert events to the renderer's expected event shape if necessary
	const durationToBeat = (dur) => {
		// simple mapping to quarter-note beats for internal checks
		const map = { "1n": 4, "2n": 2, "4n": 1, "8n": 0.5, "16n": 0.25, "4n.": 1.5, "2n.": 3 };
		return map[dur] || 0;
	};
	const beatsPerBar = 4;

	function normalizePart(part) {
		for (let m = 0; m < part.measures.length; m++) {
			const measure = part.measures[m];
			let sum = 0;
			for (let e = 0; e < measure.length; e++) {
				const ev = measure[e];
				if (!ev || !ev.duration) continue;
				sum += durationToBeat(ev.duration);
			}
			// If too long, truncate deterministically from end (keep earliest material)
			if (sum > beatsPerBar + 0.0001) {
				let remain = beatsPerBar;
				const kept = [];
				for (let e = 0; e < measure.length; e++) {
					const ev = measure[e];
					const d = durationToBeat(ev.duration) || 0;
					if (d <= remain + 0.0001) {
						kept.push(ev);
						remain -= d;
					} else {
						// cannot fit this event, skip it
						break;
					}
				}
				part.measures[m] = kept.length ? kept : [ makeRest("4n") ];
			} else if (sum < beatsPerBar - 0.0001) {
				// pad deterministically with one rest of the remaining duration (approximate using largest fitting duration)
				let remainingBeats = beatsPerBar - sum;
				const pad = [];
				while (remainingBeats > 0.0001) {
					if (remainingBeats >= 2) { pad.push(makeRest("2n")); remainingBeats -= 2; continue; }
					if (remainingBeats >= 1) { pad.push(makeRest("4n")); remainingBeats -= 1; continue; }
					if (remainingBeats >= 0.5) { pad.push(makeRest("8n")); remainingBeats -= 0.5; continue; }
					// tiny remainder -> 16th
					pad.push(makeRest("16n")); remainingBeats -= 0.25;
				}
				part.measures[m] = (part.measures[m] || []).concat(pad);
			}
		}
	}

	normalizePart(treble);
	normalizePart(bass);

	// Build final score object in shape expected by your renderer
	const score = {
		title: title,
		meta: {
			key: key,
			scale: scale,
			bars: cfg.bars,
			progression: progression.slice(0, cfg.bars),
			layers: layers
		},
		parts: [treble, bass],
		cfg: cfg
	};

	// Render to MusicXML using your existing renderer (expects: renderScoreToMusicXML(score, cfg) -> xml)
	let musicXml = "";
	if (typeof renderScoreToMusicXML === "function") {
		musicXml = renderScoreToMusicXML(score);
	} else {
		// fallback: if no renderer available, produce a JSON string as placeholder
		musicXml = "<!-- MusicXML renderer not found. Score object below as JSON -->\n" + JSON.stringify(score, null, 2);
	}

	return { score: score, musicXml: musicXml };
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
function generatePracticeScoreOld(title = "Practice", options = {}) {
	console.log("Generating practice score:", title, options);
	// ---------------------------------------
	// 1. Apply defaults + difficulty presets
	// ---------------------------------------
	const cfg = applyConfigDefaults(options);


	// ---------------------------------------
	// 2. Build scale, ranges, global data
	// ---------------------------------------
	const scaleInfo = getScaleMidiNotes(cfg.key, cfg.scale);
	const pattern = SCALE_PATTERNS[cfg.scale];
	const fullScale = [...new Set([...scaleInfo.bass, ...scaleInfo.treble])].sort((a, b) => a - b);

	const trebleRange = scaleInfo.treble.length ? scaleInfo.treble : fullScale.filter(n => n >= 60 && n <= 84);
	const bassRange = scaleInfo.bass.length ? scaleInfo.bass : fullScale.filter(n => n >= 36 && n <= 59);

	const phraseBars = cfg.phraseLength || 4;
	const numPhrases = Math.ceil(cfg.bars / phraseBars);

	// Select a chord progression for the entire piece
	const progressionOptions = CHORD_PROGRESSIONS[cfg.bars] || CHORD_PROGRESSIONS[8] || CHORD_PROGRESSIONS[4];
	const progression = progressionOptions[Math.floor(Math.random() * progressionOptions.length)];
	
	console.log("Chord progression (roman):", progression);
	console.log("numPhrases:", numPhrases);

	const treblePhrases = [];
	const bassPhrases = [];


	// ---------------------------------------
	// 3. Generate all phrases for both voices
	// ---------------------------------------
	for (let i = 0; i < numPhrases; i++) {
		const phraseChords = progression.slice(i * phraseBars, (i + 1) * phraseBars);
		const scaleCtx = { fullScale, pattern };
		scaleCtx.tonic = scaleInfo.tonic;
		treblePhrases.push(
			makeChordAwarePhrase(
				trebleRange,
				phraseChords,
				phraseBars,
				cfg.beatsPerBar, 	// beatsPerBar
				false,					// isBass
				cfg,
				scaleCtx
			)
		);

		bassPhrases.push(
			makeChordAwarePhrase(
				bassRange,
				phraseChords,
				phraseBars,
				cfg.beatsPerBar,
				true,
				cfg,
				scaleCtx
			)
		);
	}


	// ---------------------------------------
	// 4. Apply call/response shaping
	// ---------------------------------------
	// if (cfg.callResponseEnabled) {
	// 	applyCallResponse(treblePhrases, bassPhrases, fullScale, pattern, cfg, phraseBars);
	// }


	// ---------------------------------------
	// 5. Convert all phrases → measures
	// ---------------------------------------
	const treble = { id: "treble", clef: "G", measures: [], events: [] };
	const bass = { id: "bass", clef: "F", measures: [], events: [] };

	for (let p = 0; p < numPhrases; p++) {
		const tMeasures = phraseToMeasures(treblePhrases[p], phraseBars, cfg.beatsPerBar, cfg.divisionsPerQuarter);
		const bMeasures = phraseToMeasures(bassPhrases[p], phraseBars, cfg.beatsPerBar, cfg.divisionsPerQuarter);

		// applyBassPatterns(bMeasures, fullScale, pattern, cfg, p * phraseBars);
		// applyTrebleChordPlacement(tMeasures, fullScale, pattern, cfg, p * phraseBars);

		for (let m of tMeasures) pushMeasure(treble, m);
		for (let m of bMeasures) pushMeasure(bass, m);
	}


	// ---------------------------------------
	// 6. Apply cadence 
	// ---------------------------------------
	const scalePattern = SCALE_PATTERNS[cfg.scale];
	const finalRomanChord = progression.slice(-1)[0];
	const cadenceStyle = determineCadenceStyle(finalRomanChord, cfg);
	applyFinalCadence(treble, bass, cadenceStyle, scaleInfo, fullScale, scalePattern);


	// ---------------------------------------
	// 7. Return final score object
	// ---------------------------------------
	return {
		meta: {
			title,
			bpm: cfg.bpm,
			key: cfg.key,
			scale: cfg.scale,
			timeSig: cfg.timeSig,
			bars: cfg.bars,
			divisionsPerQuarter: cfg.divisionsPerQuarter
		},
		parts: [treble, bass]
	};
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
			// Precompute beam roles for this measure (simple grouping of consecutive 8th/16th notes)
			const beamableBases = {"8n":true, "16n":true};
			const beamRoles = new Array(measureEvents.length);
			for (let i = 0; i < measureEvents.length; i++) {
				const ev = measureEvents[i];
				if (!ev) { beamRoles[i] = null; continue; }
				const base = (ev.duration || "4n").replace(/\.+/g, "");
				const isBeamable = !!beamableBases[base] && ev.type !== "rest";
				const prev = i > 0 && measureEvents[i-1] && !!beamableBases[((measureEvents[i-1].duration||"").replace(/\.+/g, ""))] && measureEvents[i-1].type !== "rest";
				const next = i < measureEvents.length - 1 && measureEvents[i+1] && !!beamableBases[((measureEvents[i+1].duration||"").replace(/\.+/g, ""))] && measureEvents[i+1].type !== "rest";
				if (!isBeamable) beamRoles[i] = null;
				else if (!prev && !next) beamRoles[i] = "none";
				else if (!prev && next) beamRoles[i] = "begin";
				else if (prev && next) beamRoles[i] = "continue";
				else if (prev && !next) beamRoles[i] = "end";
			}

			for (let i = 0; i < measureEvents.length; i++) {
				const ev = measureEvents[i];
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
					continue;
				}

				// helper to append type/dot/beam for a given event index
				function appendTypeDotBeam(eventIndex) {
					xml += `\t\t\t\t<type>${musicxmlTypeForDuration(ev.duration)}</type>\n`;
					if ((ev.duration || "").indexOf('.') >= 0) {
						xml += `\t\t\t\t<dot/>\n`;
					}
					const role = beamRoles[eventIndex];
					if (role) {
						xml += `\t\t\t\t<beam number="1">${role}</beam>\n`;
					}
				}

				// handle single note
				if (ev.type === "note") {
					xml += `\t\t\t<note>\n`;
					xml += `\t\t\t\t<pitch>${midiToPitch(ev.midi)}</pitch>\n`;
					xml += `\t\t\t\t<duration>${durVal}</duration>\n`;
					appendTypeDotBeam(i);
					xml += `\t\t\t</note>\n`;
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
						appendTypeDotBeam(i);
						xml += `\t\t\t</note>\n`;
					}
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
	console.log("Generated MusicXML:", xml);
	return xml;
}

// helper to choose a MusicXML <type> string from our duration tokens
function musicxmlTypeForDuration(dur) {
	// Normalize: strip dots (we handle dots separately via <dot/>)
	const base = (dur || "").replace(/\.+/g, "");
	switch (base) {
		case "1n":	return "whole";
		case "2n":	return "half";
		case "4n":	return "quarter";
		case "8n":	return "eighth";
		case "16n":	return "16th";
		default: return "quarter";
	}
}

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
