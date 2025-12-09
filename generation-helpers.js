// -----------------------------
// Options and configuration
// -----------------------------

function applyConfigDefaults(options) {
	// --- Base defaults ---
	const defaults = {
		difficulty: "hard", // No longer used, generating complex by default

		// music structure
		bars: 8,
		beatsPerBar: 4,
		trebleEnabled: true,
		bassEnabled: true,
		divisionsPerQuarter: 16, // For precise duration calculations
        phraseLength: 4, // not quite sure how it impacts the play


		// ranges
		trebleLow: 60,   // Middle C
		trebleHigh: 84,  // C6
		bassLow: 36,     // C2
		bassHigh: 60,    // Middle C

		// leaps and motion
		maxLeapTreble: 4,
		maxLeapBass: 5,
		melodicDirectionBias: 0,   // -1 = descending tendency, +1 = ascending
		chordalEmphasis: 0.8,      // Probability of emphasizing chord tones
		motifRepetition: 0.35,

		// rhythm
		rhythmComplexity: "complex",
		longNoteFrequency: 0.15,

		// harmony
		cadence: "authentic",  // authentic, plagal, deceptive, none

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
			maxLeapTreble: 4,
			maxLeapBass: 5,
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
	complex: ["4n", "8n", "8n", "4n.", "4n", "8n"] // Removed "16n" as fastest
};

function pickDuration(cfg, preferLong = false) {
	const pool = durationsByComplexity[cfg.rhythmComplexity] || durationsByComplexity.medium;
	if (preferLong && weightedPick(cfg.longNoteFrequency)) {
		const longCandidates = pool.filter(d => d === "1n" || d === "2n" || d === "4n.");
		if (longCandidates.length) return chooseRandom(longCandidates);
	} 
	// Ensure we don't pick 16th notes if they were accidentally left in the pool
	const filteredPool = pool.filter(d => d !== "16n");
	return chooseRandom(filteredPool.length > 0 ? filteredPool : ["4n"]); // Fallback to quarter if filtered pool is empty
}

// -----------------------------
// Phrase building
// -----------------------------

/**
 * Generates a musically coherent phrase that follows a chord progression.
 *
 * @param {number[]} rangeNotes - The available MIDI notes for the part (e.g., treble or bass range).
 * @param {string[]} phraseChords - An array of Roman numeral chord names for this phrase (e.g., ['I', 'V', 'vi', 'IV']).
 * @param {number} phraseBars - The number of bars in this phrase.
 * @param {number} beatsPerBar - The number of beats per bar.
 * @param {boolean} isBass - True if generating for the bass part.
 * @param {object} cfg - The configuration object.
 * @param {object} scaleInfo - Contains full scale, scale pattern, etc.
 * @returns {object[]} An array of note events { midi, duration }.
 */

function getChordNotes(fullScale, scalePattern, degree, tonicMidi) {
    const chordTones = new Set();
    const rootIndexInPattern = degree - 1; // 0-indexed position in scalePattern

    // Get the intervals of the root, third, and fifth relative to the scale's tonic
    // These are the *absolute* intervals from the tonic of the scale.
    const rootIntervalFromTonic = scalePattern[rootIndexInPattern];
    const thirdIntervalFromTonic = scalePattern[(rootIndexInPattern + 2) % scalePattern.length];
    const fifthIntervalFromTonic = scalePattern[(rootIndexInPattern + 4) % scalePattern.length];

    // Iterate through the fullScale to find all notes that match these intervals
    for (const midiNote of fullScale) {
        const intervalFromTonic = (midiNote - tonicMidi) % 12; // Interval relative to the tonic in the current octave

        // Adjust for negative results of modulo
        const normalizedIntervalFromTonic = (intervalFromTonic + 12) % 12;

        if (normalizedIntervalFromTonic === rootIntervalFromTonic ||
            normalizedIntervalFromTonic === thirdIntervalFromTonic ||
            normalizedIntervalFromTonic === fifthIntervalFromTonic) {
            chordTones.add(midiNote);
        }
    }
    return Array.from(chordTones).sort((a, b) => a - b);
}

// Helper to find a good next note considering maxLeap and bias
const findNextNote = (targetNotes, lastNoteMidi, maxLeap, melodicDirectionBias, availableScaleNotes) => {
    if (!targetNotes || targetNotes.length === 0) {
        // Fallback to any available scale note if no specific target notes
        if (availableScaleNotes && availableScaleNotes.length > 0) {
            targetNotes = availableScaleNotes;
        } else {
            return lastNoteMidi; // Cannot find a note
        }
    }

    if (!lastNoteMidi) return chooseRandom(targetNotes);

    let candidates = targetNotes.filter(n => Math.abs(n - lastNoteMidi) <= maxLeap);

    if (candidates.length === 0) {
        // If no candidates within maxLeap, try to find the closest one regardless of leap
        let closest = targetNotes[0];
        let minDistance = Math.abs(closest - lastNoteMidi);
        for (let i = 1; i < targetNotes.length; i++) {
            const distance = Math.abs(targetNotes[i] - lastNoteMidi);
            if (distance < minDistance) {
                minDistance = distance;
                closest = targetNotes[i];
            }
        }
        return closest; // Return the closest note, even if it's a large leap
    }

    // From remaining candidates, pick the one closest to lastNoteMidi, applying bias
    return chooseRandom(candidates); // Simplified for now, can add more sophisticated bias here
};



function makeChordAwarePhrase(rangeNotes, phraseChords, phraseBars, beatsPerBar, isBass, cfg, scaleInfo) {
    const phrase = [];
    let lastMidi = null;
    const maxLeap = isBass ? cfg.maxLeapBass : cfg.maxLeapTreble;
    const availableScaleNotesInRange = scaleInfo.fullScale.filter(n => rangeNotes.includes(n));

	for (let barIndex = 0; barIndex < phraseBars; barIndex++) {
		const romanChord = phraseChords[barIndex] || 'I'; // Default to 'I' if progression is short
		const degree = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii'].indexOf(romanChord) + 1;
		
		// Get the chord notes for the current bar
		let currentChordTones = getChordNotes(scaleInfo.fullScale, scaleInfo.pattern, degree, scaleInfo.tonic)
                                .filter(n => rangeNotes.includes(n));
        if (currentChordTones.length === 0) {
            // Fallback: if no chord tones in range, use any scale note in range
            currentChordTones = availableScaleNotesInRange;
        }
        if (currentChordTones.length === 0) { // Still empty? Use a default note
            currentChordTones = [rangeNotes[0] || 60];
        }

		// Determine the "home" note for this bar
		let homeNote;
		if (isBass) homeNote = currentChordTones[0]; // Bass plays root
		else homeNote = chooseRandom(currentChordTones); // Treble picks a chord tone

		let beatsInBar = 0;
		while (beatsInBar < beatsPerBar) {
			const remainingBeats = beatsPerBar - beatsInBar;
			let duration = pickDuration(cfg);
			let durBeats = durationToDivisions(duration, cfg.divisionsPerQuarter) / cfg.divisionsPerQuarter;

			// Ensure the chosen duration fits within the remaining beats
			if (durBeats > remainingBeats + 0.0001) { // Add tolerance for float comparison
				// Try to find a shorter duration that fits exactly or is the largest that fits
				if (remainingBeats >= 2) duration = "2n";
				else if (remainingBeats >= 1.5) duration = "4n.";
				else if (remainingBeats >= 1) duration = "4n";
				else if (remainingBeats >= 0.75) duration = "8n.";
				else if (remainingBeats >= 0.5) duration = "8n";
				else { // If less than 0.5 beats, force it to 8n (shortest allowed) and it will be split by phraseToMeasures
                    duration = "8n";
                }
				durBeats = durationToDivisions(duration, cfg.divisionsPerQuarter) / cfg.divisionsPerQuarter;
			}

			let nextMidi;
			// On the first beat of the bar, strongly prefer a chord tone.
			if (beatsInBar === 0) {
				if (isBass) {
					// --- BASS PART: Play a chord for the whole bar ---
					// Use the first 3 available chord tones in the bass range.
					const chordNotes = getChordNotes(scaleInfo.fullScale, scaleInfo.pattern, degree, scaleInfo.tonic)
						.filter(n => n >= cfg.bassLow && n <= cfg.bassHigh)
						.slice(0, 3);
					const barDuration = beatsPerBar === 4 ? "1n" : "2n"; // Basic assumption
					phrase.push(makeChord(chordNotes, barDuration));
					beatsInBar = beatsPerBar; // Mark bar as full
					continue; // Skip to the next bar
				}
				// --- TREBLE PART (or bass fallback if isBass is false) ---
				nextMidi = findNextNote(currentChordTones, lastMidi, maxLeap, cfg.melodicDirectionBias, availableScaleNotesInRange);
			} else {
				// For other beats, we can use passing tones (any scale note)
				// but still guide it towards the next chord.
				const nextBarChord = phraseChords[barIndex + 1] || romanChord;
				const nextDegree = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii'].indexOf(nextBarChord) + 1;
				const nextBarChordTones = getChordNotes(scaleInfo.fullScale, scaleInfo.pattern, nextDegree, scaleInfo.tonic)
                                            .filter(n => rangeNotes.includes(n));

                // Combine current chord tones and next bar's chord tones as primary targets
                let primaryTargets = [...new Set([...currentChordTones, ...nextBarChordTones])];
                if (primaryTargets.length === 0) primaryTargets = availableScaleNotesInRange;

				// Try to move towards a primary target, using available scale notes as passing tones
				nextMidi = findNextNote(primaryTargets, lastMidi, maxLeap, cfg.melodicDirectionBias, availableScaleNotesInRange);

				// Add a small chance to leap to a chord tone for interest
				if (Math.random() < 0.2 && currentChordTones.length > 0) {
					nextMidi = chooseRandom(currentChordTones);
				}
			}
			
			if (nextMidi === -1 || nextMidi === undefined) {
				// Failsafe: if all else fails, pick something random
				if (rangeNotes.length > 0) {
					nextMidi = lastMidi || chooseRandom(rangeNotes);
				} else {
					// If rangeNotes is empty, we must pick a default valid MIDI note
					nextMidi = lastMidi || 60; // Default to Middle C
				}
			}

			phrase.push(makeNote(nextMidi, duration));
			lastMidi = nextMidi;
			beatsInBar += durBeats;
		}
	}

	console.log(`Generated phrase for chords [${phraseChords.join(', ')}]:`, phrase.map(n => n.midi));
	return phrase;
}


function determineCadenceStyle(finalRomanChord, cfg) {
    return cfg.cadence || "none";
}

function applyFinalCadence(treble, bass, cadenceStyle, scaleInfo, fullScale, scalePattern) {
	if (!cadenceStyle || cadenceStyle === "none") return;

	const lastTrebleIdx = treble.measures.length - 1;
	const lastBassIdx = bass.measures.length - 1;

	function setFinalChordTonic() {
		const chordI = getChordNotes(fullScale, scalePattern, 1, scaleInfo.tonic);	// I chord
		const trebleNotes = chordI.filter(n => n >= 60 && n <= 84).slice(0, 3);
		const bassNotes = chordI.filter(n => n >= 36 && n < 60).slice(0, 3);

		// If notes are found, create a chord. Otherwise, create a whole rest.
		const trebleEvent = trebleNotes.length ? makeChord(trebleNotes, "1n") : makeRest("1n");
		const bassEvent = bassNotes.length ? makeChord(bassNotes, "1n") : makeRest("1n");

		treble.measures[lastTrebleIdx] = [trebleEvent];
		bass.measures[lastBassIdx] = [bassEvent];
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
		// Replace final bar with vi chord, not I, using the correct getChordNotes
		const chordVI = getChordNotes(fullScale, scalePattern, 6, scaleInfo.tonic);
		const trebleNotes = chordVI.filter(n => n >= 60 && n <= 84).slice(0, 3);
		const bassNotes = chordVI.filter(n => n >= 36 && n < 60).slice(0, 3);

		const trebleEvent = trebleNotes.length ? makeChord(trebleNotes, "1n") : makeRest("1n");
		const bassEvent = bassNotes.length ? makeChord(bassNotes, "1n") : makeRest("1n");

		treble.measures[lastTrebleIdx] = [trebleEvent];
		bass.measures[lastBassIdx] = [bassEvent];
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
	if (!step) {return null}; 
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
		"C":  { fifths: 0,  tonic: 60 }, // C4
		"G":  { fifths: 1,  tonic: 67 }, // G4
		"D":  { fifths: 2,  tonic: 62 }, // D4
		"A":  { fifths: 3,  tonic: 69 }, // A4
		"E":  { fifths: 4,  tonic: 64 }, // E4
		"B":  { fifths: 5,  tonic: 71 }, // B4
		"F":  { fifths: -1, tonic: 65 }, // F4
		"Bb": { fifths: -2, tonic: 70 }, // Bb4
		"Eb": { fifths: -3, tonic: 63 }, // Eb4
		"Ab": { fifths: -4, tonic: 68 }, // Ab4
		"Db": { fifths: -5, tonic: 61 }, // Db4
		"Gb": { fifths: -6, tonic: 66 }, // Gb4
	};
	const scalePattern = SCALE_PATTERNS[scaleType] || SCALE_PATTERNS['major'];
	const info = keyMap[key] || keyMap["C"];
	let scale = [];
	scalePattern.forEach(interval => {
		scale.push(info.tonic - 12 + interval);
		scale.push(info.tonic - interval);
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

// function getChordNotes(scaleMidi, scalePattern, degree) {
// 	// degree: 1..n (roman numeral). scaleMidi is an ordered array of pitch classes across octaves.
// 	const rootNote = scaleMidi[degree - 1];
// 	if (rootNote === undefined) return [];

// 	const rootOffset = scalePattern[degree - 1];
// 	const thirdInterval = scalePattern[(degree - 1 + 2) % scalePattern.length] - rootOffset;
// 	const fifthInterval = scalePattern[(degree - 1 + 4) % scalePattern.length] - rootOffset;

// 	const third = rootNote + (thirdInterval < 0 ? thirdInterval + 12 : thirdInterval);
// 	const fifth = rootNote + (fifthInterval < 0 ? fifthInterval + 12 : fifthInterval);
// 	const chord = [rootNote, third, fifth];

// 	const bassChordNotes = [];
// 	for (let note of chord) {
// 		bassChordNotes.push(note - 24, note - 12, note, note + 12);
// 	}

// 	return [...new Set(bassChordNotes)].filter(n => n >= 36 && n <= 59).sort((a, b) => a - b);
// }

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
        curMeasure.push(p); // Push the whole event (could be note or chord)
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
