// ================================
// Base-score builder + complexity layers
// ================================

// Build a strict base score: each bar has a whole-note chord in bass (root) and
// a whole-note chord-tone in treble. The final bar is set to tonic root/chord.
function buildBaseScoreFromProgression(progression, cfg, scaleInfo) {
	// Create empty parts
	const treble = { id: "treble", clef: "G", measures: [], events: [] };
	const bass = { id: "bass", clef: "F", measures: [], events: [] };

	const fullScale = scaleInfo.fullScale;
	const pattern = scaleInfo.pattern;
	const tonic = scaleInfo.tonic;

	// ensure progression length matches cfg.bars
	let bars = cfg.bars || progression.length;
	for (let b = 0; b < bars; b++) {
		const roman = progression[b] || progression[progression.length - 1];
		const degree = ['I','ii','iii','IV','V','vi','vii'].indexOf(roman) + 1 || 1;
		// Bass: root (lowest available root in bass range)
		let bassChordNotes = getChordNotes(fullScale, pattern, degree, tonic)
			.filter(n => n >= cfg.bassLow && n <= cfg.bassHigh)
			.sort((a,b) => a-b);
		// Ensure a root is present: choose the lowest chord tone in bass range
		if (bassChordNotes.length === 0) {
			// fallback: pick nearest scale note to bassLow
			const candidates = fullScale.filter(n => n >= cfg.bassLow && n <= cfg.bassHigh);
			bassChordNotes = candidates.length ? [candidates[0]] : [cfg.bassLow || 36];
		}
		// For bass we want a single-note root (but as a chord-of-1 to reuse the chord event)
		const bassRoot = [bassChordNotes[0]];

		// Treble: choose a stable chord-tone (prefer root, then 3rd, then 5th) within treble range
		let trebleChordNotes = getChordNotes(fullScale, pattern, degree, tonic)
			.filter(n => n >= cfg.trebleLow && n <= cfg.trebleHigh)
			.sort((a,b) => a-b);
		if (trebleChordNotes.length === 0) {
			const candidates = fullScale.filter(n => n >= cfg.trebleLow && n <= cfg.trebleHigh);
			trebleChordNotes = candidates.length ? [candidates[Math.floor(candidates.length/2)]] : [60];
		}
		// Choose single treble pitch for the whole note — prefer a chord-tone closest to middle C range
		const trebleNote = [trebleChordNotes.length ? trebleChordNotes[Math.floor(trebleChordNotes.length/2)] : trebleChordNotes[0]];

		// If final bar, force tonic/root
		if (b === bars - 1) {
			const tonicChord = getChordNotes(fullScale, pattern, 1, tonic);
			const tonicBass = tonicChord.filter(n => n >= cfg.bassLow && n <= cfg.bassHigh);
			if (tonicBass.length) bassRoot[0] = tonicBass[0];
			const tonicTreble = tonicChord.filter(n => n >= cfg.trebleLow && n <= cfg.trebleHigh);
			if (tonicTreble.length) trebleNote[0] = tonicTreble[Math.floor(tonicTreble.length/2)];
		}

		// Push whole-note events
		pushMeasure(bass, [ makeNote(bassRoot[0], "1n") ]);
		pushMeasure(treble, [ makeNote(trebleNote[0], "1n") ]);
	}

	return { parts: [treble, bass], meta: { bars: bars } };
}


// Choose a deterministic "next" chord-tone using simple voice-leading:
// - preserve common tones if possible
// - otherwise choose the chord tone closest to lastNote
function chooseVoiceLeadingNoteForChord(chordTones, lastNote) {
	if (!Array.isArray(chordTones) || chordTones.length === 0) return lastNote || chordTones[0] || 60;
	if (!lastNote) return chordTones[Math.floor(chordTones.length/2)];
	// preserve exact common tone if exists
	if (chordTones.includes(lastNote)) return lastNote;
	// otherwise choose the chord tone with minimal absolute distance
	let best = chordTones[0];
	let bestDist = Math.abs(best - lastNote);
	for (let i = 1; i < chordTones.length; i++) {
		const d = Math.abs(chordTones[i] - lastNote);
		if (d < bestDist) { best = chordTones[i]; bestDist = d; }
	}
	return best;
}


// Split an event into two events of half-duration (whole -> two halves, half -> two quarters, quarter -> two eighths)
// The notes chosen are chord-aware and do NOT use pure randomness.
function splitEventIntoHalves(ev, cfg, fullScale, pattern, targetDegree, isBass, lastNote) {
	// durations mapping
	const map = { "1n": "2n", "2n": "4n", "4n": "8n", "4n.": "8n", "8n": "16n" };
	const newDur = map[ev.duration] || "4n";

	// if it's a rest, return two rests
	if (ev.type === "rest") return [ makeRest(newDur), makeRest(newDur) ];

	// chord tones for this measure's chord
	const chordTones = getChordNotes(fullScale, pattern, targetDegree, cfg.tonic)
		.filter(n => isBass ? (n >= cfg.bassLow && n <= cfg.bassHigh) : (n >= cfg.trebleLow && n <= cfg.trebleHigh))
		.sort((a,b)=>a-b);

	let firstNote, secondNote;

	// If it's a chord (stack), choose split chord tones that keep close spacing
	if (ev.type === "chord") {
		// keep same chord as first half, then move to a chord tone or a passing tone
		firstNote = ev.midi[0] || ev.midi[Math.floor(ev.midi.length/2)];
		// second half: pick a chord tone close to firstNote using voice leading
		secondNote = chooseVoiceLeadingNoteForChord(chordTones, firstNote) || firstNote;
		// return as single-note events (sight-reading practice prefers single lines for halves)
		return [ makeNote(firstNote, newDur), makeNote(secondNote, newDur) ];
	}

	// If it's a single note: first half keep chord-tone, second half move to 3rd or passing tone if available
	const degree = targetDegree || 1;
	const chord = chordTones.length ? chordTones : fullScale.filter(n => !isBass ? (n>=cfg.trebleLow && n<=cfg.trebleHigh) : (n>=cfg.bassLow && n<=cfg.bassHigh));
	firstNote = chooseVoiceLeadingNoteForChord(chord, lastNote) || (ev.midi || ev.midi[0]) || 60;

	// For second half, prefer a neighboring chord tone: 3rd, then 5th, else nearest scale tone
	let secondChoices = chord.slice();
	// If multiple chord tones, try to bias second to a different chord tone to create movement
	if (secondChoices.length > 1) {
		// prefer a different pitch
		for (let i = 0; i < secondChoices.length; i++) {
			if (Math.abs(secondChoices[i] - firstNote) > 0) {
				secondNote = secondChoices[i];
				break;
			}
		}
	}
	if (!secondNote) {
		// fallback: nearest scale tone not equal to firstNote
		const candidates = fullScale.filter(n => n !== firstNote && (isBass ? (n>=cfg.bassLow && n<=cfg.bassHigh) : (n>=cfg.trebleLow && n<=cfg.trebleHigh)));
		secondNote = candidates.length ? candidates.reduce((a,b)=>Math.abs(a-firstNote)<Math.abs(b-firstNote)?a:b) : firstNote;
	}

	return [ makeNote(firstNote, newDur), makeNote(secondNote, newDur) ];
}


// Apply one complexity layer to the score object.
// layer 1: whole -> halves (introduce 3rds in treble), keep bass root per bar
// layer 2: halves -> quarters (introduce 3rds and 5ths), allow limited passing tones
// layer >=3: further subdivide and introduce suspensions (2nds/4ths that resolve)
// This function is deterministic: it preserves common tones and moves by nearest chord tones.
function applyComplexityLayer(score, layer, cfg, scaleInfo, progression) {
	const fullScale = scaleInfo.fullScale;
	const pattern = scaleInfo.pattern;
	const tonic = scaleInfo.tonic;

	// iterate parts
	for (let p = 0; p < score.parts.length; p++) {
		const part = score.parts[p];
		const isBass = part.id === "bass";

		// For strict bass adherence: if bass, for any split always choose chord root / chord tones in the bass range
		let lastNote = null;

		for (let mIdx = 0; mIdx < part.measures.length; mIdx++) {
			// target chord degree for this bar (use progression length if shorter)
			const roman = progression[mIdx] || progression[progression.length - 1];
			const degree = ['I','ii','iii','IV','V','vi','vii'].indexOf(roman) + 1 || 1;

			const measure = part.measures[mIdx];
			const newMeasure = [];

			for (let evIdx = 0; evIdx < measure.length; evIdx++) {
				const ev = measure[evIdx];

				// Determine action by layer and event duration
				if (layer === 1) {
					// split whole notes into halves
					if (ev.duration === "1n") {
						// Bass: ensure root held or split into two root notes
						if (isBass) {
							const chord = getChordNotes(fullScale, pattern, degree, tonic)
								.filter(n => n >= cfg.bassLow && n <= cfg.bassHigh)
								.sort((a,b)=>a-b);
							const root = chord.length ? chord[0] : (ev.midi || [ev.midi])[0] || cfg.bassLow;
							newMeasure.push(makeNote(root, "2n"));
							newMeasure.push(makeNote(root, "2n"));
							lastNote = root;
						} else {
							// treble: split whole into two halves using chord tones + voice-leading
							const halves = splitEventIntoHalves(ev, cfg, fullScale, pattern, degree, false, lastNote);
							newMeasure.push(...halves);
							lastNote = halves[halves.length-1].midi;
						}
						continue;
					}
				}

				if (layer === 2) {
					// if halves exist, split them into quarters; if still whole, split into halves
					if (ev.duration === "2n") {
						// split into two quarters deterministically
						const mapQuarter = { "2n": "4n" };
						// re-use splitEventIntoHalves which will return two new notes
						const quarters = splitEventIntoHalves(ev, cfg, fullScale, pattern, degree, isBass, lastNote);
						newMeasure.push(...quarters);
						lastNote = quarters[quarters.length-1].midi;
						continue;
					}
					if (ev.duration === "1n") {
						// ensure previous layer applied: split whole into halves
						if (isBass) {
							const chord = getChordNotes(fullScale, pattern, degree, tonic)
								.filter(n => n >= cfg.bassLow && n <= cfg.bassHigh)
								.sort((a,b)=>a-b);
							const root = chord.length ? chord[0] : cfg.bassLow;
							newMeasure.push(makeNote(root, "2n"));
							newMeasure.push(makeNote(root, "2n"));
							lastNote = root;
						} else {
							const halves = splitEventIntoHalves(ev, cfg, fullScale, pattern, degree, false, lastNote);
							// then split those halves into quarters (call split again)
							for (let h of halves) {
								const qs = splitEventIntoHalves(h, cfg, fullScale, pattern, degree, false, lastNote);
								newMeasure.push(...qs);
								lastNote = qs[qs.length-1].midi;
							}
						}
						continue;
					}
				}

				if (layer >= 3) {
					// further subdivision for smaller durations, and inject simple suspensions:
					// - if we encounter a pair like [X, Y], we may replace the first of the pair with a suspended 2nd/4th resolving to Y
					// We'll be conservative: only transform quarter -> two eighths or dotted variants
					if (ev.duration === "4n") {
						// split quarter -> two eighths
						const halves = splitEventIntoHalves(ev, cfg, fullScale, pattern, degree, isBass, lastNote); // returns two 8n if it was 4n
						// small deterministic suspension: if second note exists and interval > 1, set first to a scale tone a step away
						if (halves.length === 2 && halves[1].midi && halves[0].midi) {
							const second = halves[1].midi;
							// compute a neighboring scale degree (step) above or below deterministically
							const stepCandidates = fullScale.filter(n => Math.abs(n - second) <= 2 && n !== second &&
								(isBass ? (n>=cfg.bassLow && n<=cfg.bassHigh) : (n>=cfg.trebleLow && n<=cfg.trebleHigh)));
							if (stepCandidates.length) {
								halves[0].midi = stepCandidates[0]; // deterministic pick
							}
						}
						newMeasure.push(...halves);
						lastNote = halves[halves.length-1].midi;
						continue;
					}
				}

				// default: keep the event (but normalize durations that are not part of subdivision map)
				newMeasure.push(ev);
				if (ev.type === "note" || ev.type === "chord") {
					lastNote = (ev.type === "note") ? ev.midi : (Array.isArray(ev.midi) ? ev.midi[0] : ev.midi);
				}
			} // measure events

			// if newMeasure empty (shouldn't happen), fallback to previous measure content or a rest
			if (!newMeasure.length) newMeasure.push(makeRest("4n"));
			// assign the new measure
			part.measures[mIdx] = newMeasure;
		} // measures
	} // parts
}
