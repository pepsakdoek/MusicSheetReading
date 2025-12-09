// music-generator.js
// Generates a "score" object (for playback) and can render it to MusicXML.
// Tabs used for indentation.

// NOTE: This file expects `SCALE_PATTERNS`, `CHORD_PROGRESSIONS` to exist
// (from your scales.js). If you prefer, those can be imported/duplicated here.


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

	console.log("Treble range:", trebleRange);
	console.log("Bass range:", bassRange);
	console.log("Full scale:", fullScale);

	const phraseBars = cfg.phraseLength || 4;
	const numPhrases = Math.ceil(cfg.bars / phraseBars);

	// Select a chord progression for the entire piece
	const progressionOptions = CHORD_PROGRESSIONS[cfg.bars] || CHORD_PROGRESSIONS[8] || CHORD_PROGRESSIONS[4];
	const progression = progressionOptions[Math.floor(Math.random() * progressionOptions.length)];


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
