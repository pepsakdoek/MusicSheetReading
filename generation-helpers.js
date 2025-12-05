// -----------------------------
// Options and configuration
// -----------------------------

function applyConfigDefaults(options) {
	// --- Base defaults ---
	const defaults = {
		difficulty: "medium",

		// music structure
		bars: 8,
		beatsPerBar: 4,
		trebleEnabled: true,
		bassEnabled: true,
        phraseLength: 4, // not quite sure how it impacts the play


		// ranges
		trebleLow: 60,   // Middle C
		trebleHigh: 84,  // C6
		bassLow: 36,     // C2
		bassHigh: 60,    // Middle C

		// leaps and motion
		maxLeapTreble: 5,
		maxLeapBass: 7,
		melodicDirectionBias: 0,   // -1 = descending tendency, +1 = ascending
		motifRepetition: 0.45,

		// rhythm
		rhythmComplexity: "medium",
		longNoteFrequency: 0.25,

		// harmony
		cadence: "none",  // authentic, plagal, deceptive, none

		// generation patterns
		treblePattern: "melodic",
		bassPattern: "melodic",
	};

	// --- Difficulty presets ---
	const presets = {
		easy: {
			rhythmComplexity: "simple",
			longNoteFrequency: 0.4,
			maxLeapTreble: 4,
			maxLeapBass: 5,
			motifRepetition: 0.5
		},
		medium: {
			rhythmComplexity: "medium",
			longNoteFrequency: 0.25,
			maxLeapTreble: 5,
			maxLeapBass: 7,
			motifRepetition: 0.45
		},
		hard: {
			rhythmComplexity: "complex",
			longNoteFrequency: 0.15,
			maxLeapTreble: 7,
			maxLeapBass: 9,
			motifRepetition: 0.35
		}
	};

	const cfg = {};

	// --- Step 1: copy defaults ---
	for (let k in defaults) cfg[k] = defaults[k];

	// --- Step 2: apply provided options ---
	if (options) {
		for (let k in options) cfg[k] = options[k];
	}

	// --- Step 3: apply difficulty preset if valid ---
	if (cfg.difficulty && presets[cfg.difficulty]) {
		const preset = presets[cfg.difficulty];
		for (let k in preset) cfg[k] = preset[k];
	}

	// --- Step 4: safety normalisation (important for generator stability) ---

	// Ranges valid?
	cfg.trebleLow = Math.min(cfg.trebleLow, cfg.trebleHigh);
	cfg.bassLow = Math.min(cfg.bassLow, cfg.bassHigh);

	// Probability clamping
	cfg.longNoteFrequency = Math.max(0, Math.min(1, cfg.longNoteFrequency));
	cfg.motifRepetition = Math.max(0, Math.min(1, cfg.motifRepetition));

	// Bias clamping
	cfg.melodicDirectionBias = Math.max(-1, Math.min(1, cfg.melodicDirectionBias));

	// Bars minimum
	cfg.bars = Math.max(1, cfg.bars);

	// Time signature
	cfg.beatsPerBar = Math.max(1, cfg.beatsPerBar);

	return cfg;
}



// -----------------------------
// Random helpers
// -----------------------------
function chooseRandom(arr) {
	return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick(prob) {
	return Math.random() < prob;
}

function biasStep(prev, bias) {
	const dir = (Math.random() - 0.5) + bias * 0.75;
	return dir > 0 ? 1 : -1;
}

function nearestIndexIn(arr, val) {
	let best = 0;
	for (let i = 1; i < arr.length; i++) {
		if (Math.abs(arr[i] - val) < Math.abs(arr[best] - val)) best = i;
	}
	return best;
}

// -----------------------------
// Duration selection
// -----------------------------
const durationsByComplexity = {
	simple: ["4n", "4n", "4n", "2n"],
	medium: ["4n", "4n", "8n", "4n.", "2n"],
	compex: ["4n", "8n", "8n", "16n", "4n.", "4n", "8n", "16n"]
};

function pickDuration(cfg, preferLong = false) {
	const pool = durationsByComplexity[cfg.rhythmComplexity] || durationsByComplexity.medium;
	if (preferLong && weightedPick(cfg.longNoteFrequency)) {
		const longCandidates = pool.filter(d => d === "1n" || d === "2n" || d === "4n.");
		if (longCandidates.length) return chooseRandom(longCandidates);
	}
	return chooseRandom(pool);
}

// -----------------------------
// Motifs
// -----------------------------
function makeMotif(rangeNotes, lengthNotes, startNear, maxLeap, cfg, pickDuration) {
	const motif = [];
	let prev = startNear ?? chooseRandom(rangeNotes);

	for (let i = 0; i < lengthNotes; i++) {
		let candidates = rangeNotes.filter(n =>
			Math.abs(n - prev) <= (i === 0 ? maxLeap : Math.max(5, Math.round(maxLeap / 2)))
		);
		if (candidates.length === 0) candidates = rangeNotes;

		let pick = chooseRandom(candidates);

		// melodic bias
		if (Math.abs(cfg.melodicDirectionBias) > 0.2 && Math.random() < 0.5) {
			const step = biasStep(prev, cfg.melodicDirectionBias);
			const byStep = rangeNotes.filter(n => Math.abs(n - (prev + step)) <= 2);
			if (byStep.length) pick = chooseRandom(byStep);
		}

		prev = pick;
		motif.push({ midi: prev, duration: pickDuration(cfg) });
	}
    console.log("Generated motif:", motif.map(n => n.midi));
	return motif;
}

// -----------------------------
// Phrase building
// -----------------------------
function makePhrase(rangeNotes, phraseBars, beatsPerBar, isBass, cfg, makeMotif, pickDuration) {
	const phrase = [];
	const motifLen = Math.max(2, Math.min(5, Math.round(3 + Math.random() * 2)));
	const motif = makeMotif(rangeNotes, motifLen, null,
		isBass ? cfg.maxLeapBass : cfg.maxLeapTreble, cfg, pickDuration
	);

	for (let b = 0; b < phraseBars; b++) {
		for (let i = 0; i < motif.length; i++) {
			let item = { ...motif[i] };

			// small variation
			if (Math.random() < 0.15) {
				const pool = rangeNotes.filter(n => Math.abs(n - item.midi) <= (isBass ? 7 : 5));
				if (pool.length) item.midi = chooseRandom(pool);
			}

			if (Math.random() < 0.2) {
				item.duration = pickDuration(cfg, Math.random() < cfg.longNoteFrequency);
			}
			phrase.push(item);
		}

		if (Math.random() < cfg.motifRepetition) {
			const extra = makeMotif(
				rangeNotes,
				Math.max(1, Math.floor(motifLen / 2)),
				null,
				isBass ? cfg.maxLeapBass : cfg.maxLeapTreble,
				cfg,
				pickDuration
			);
			phrase.push(...extra);
		}
	}

    console.log("Generated phrase:", phrase.map(n => n.midi));
	return phrase;
}

function determineCadenceStyle(cfg) {
    return cfg.cadence || "none";
}

function applyFinalCadence(treble, bass, cadenceStyle, scaleInfo, fullScale, scalePattern) {
	if (!cadenceStyle || cadenceStyle === "none") return;

	const lastTrebleIdx = treble.measures.length - 1;
	const lastBassIdx = bass.measures.length - 1;

	function setFinalChordTonic() {
		const chordI = getChordNotes(fullScale, scalePattern, 1);	// I chord
		treble.measures[lastTrebleIdx] = [
			makeChord(chordI.slice(0, 3), "1n")
		];
		bass.measures[lastBassIdx] = [
			makeNote((chordI[0] || scaleInfo.tonic - 12), "1n")
		];
	}

	// -------------------------
	// AUTHENTIC CADENCE (V → I)
	// -------------------------
	if (cadenceStyle === "authentic") {
		// Only modify the final bar
		setFinalChordTonic();
		return;
	}

	// -------------------------
	// PLAGAL CADENCE (IV → I)
	// -------------------------
	if (cadenceStyle === "plagal") {
		// Only modify the final bar
		setFinalChordTonic();
		return;
	}

	// ---------------------------------------
	// DECEPTIVE CADENCE (V → vi)
	// ---------------------------------------
	if (cadenceStyle === "deceptive") {
		// Replace final bar with vi chord, not I
		const chordVI = getChordNotes(fullScale, scalePattern, 6);

		treble.measures[lastTrebleIdx] = [
			makeChord(chordVI.slice(0, 3), "1n")
		];

		bass.measures[lastBassIdx] = [
			makeNote((chordVI[0] || scaleInfo.tonic - 12), "1n")
		];

		return;
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

// convert to measures (improved slightly to keep first-beat focus)
function phraseToMeasures(phrase, bars, beatsPerBar) {
    const measures = [];
    let curMeasure = [];
    let curBeatCount = 0;
    for (let p of phrase) {
        let durBeats = 1;
        switch (p.duration) {
            case "1n": durBeats = 4; break;
            case "2n": durBeats = 2; break;
            case "4n": durBeats = 1; break;
            case "8n": durBeats = 0.5; break;
            case "16n": durBeats = 0.25; break;
            case "4n.": durBeats = 1.5; break;
            case "8n.": durBeats = 0.75; break;
            default: durBeats = 1;
        }
        // if exceeds measure, close measure first and put note at start of next
        if (curBeatCount + durBeats > beatsPerBar + 0.0001) {
            measures.push(curMeasure);
            curMeasure = [];
            curBeatCount = 0;
        }
        curMeasure.push(makeNote(p.midi, p.duration));
        curBeatCount += durBeats;
        // if measure exactly full, push it
        if (Math.abs(curBeatCount - beatsPerBar) < 0.0001) {
            measures.push(curMeasure);
            curMeasure = [];
            curBeatCount = 0;
        }
    }
    // push any remaining
    if (curMeasure.length) measures.push(curMeasure);
    // ensure exact bars
    while (measures.length < bars) measures.push([]);
    if (measures.length > bars) measures.length = bars;
    for (let i = 0; i < measures.length; i++) {
        if (!measures[i] || measures[i].length === 0) measures[i] = [ makeRest("4n") ];
    }
    return measures;
}

function pushMeasure(part, measureEvents) {
    part.measures.push(measureEvents);
    for (const e of measureEvents) part.events.push(e);
}


