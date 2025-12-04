
function midiToPitch(midi) {
	const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
	const step = notes[midi % 12];
	const octave = Math.floor(midi / 12) - 1;
	let alter = '';
	if (step.includes('#')) {
		alter = '<alter>1</alter>';
	}
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

function generatePractice(title = "Practice", options = {}) {
    const { key = "C Major", maxJump = 12, startTonic = true, bars = 8, scale = 'major' } = options;
    const scaleInfo = getScaleMidiNotes(key, scale);

    const lastTrebleNotes = [];
    const lastBassNotes = [];

    let musicXml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE score-partwise PUBLIC
    "-//Recordare//DTD MusicXML 3.1 Partwise//EN"
    "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
    <work>
        <work-title>${title}</work-title>
    </work>
<part-list>
    <part-group type="start" number="1">
        <group-symbol>brace</group-symbol>
        <group-barline>yes</group-barline>
    </part-group>
    <score-part id="P1">
        <part-name>Piano</part-name>
        <score-instrument id="P1-I1">
            <instrument-name>Piano</instrument-name>
        </score-instrument>
        <midi-instrument id="P1-I1">
            <midi-channel>1</midi-channel>
            <midi-program>1</midi-program>
        </midi-instrument>
    </score-part>
    <score-part id="P2">
        <part-name>Piano</part-name>
        <score-instrument id="P2-I1">
            <instrument-name>Piano</instrument-name>
        </score-instrument>
        <midi-instrument id="P2-I1">
            <midi-channel>2</midi-channel>
            <midi-program>1</midi-program>
        </midi-instrument>
    </score-part>
    <part-group type="stop" number="1"/>
</part-list>
    <part id="P1">
`;

    // Treble staff
    let prevMidi = null;
    for (let i = 1; i <= bars - 1; i++) {
        musicXml += `        <measure number="${i}" width="480">\n`;
        if (i === 1) {
            musicXml += `            <attributes>
                <divisions>1</divisions>
                <key><fifths>${scaleInfo.fifths}</fifths></key>
                <time><beats>4</beats><beat-type>4</beat-type></time>
                <clef><sign>G</sign><line>2</line></clef>
            </attributes>\n`;
        }
        for (let j = 0; j < 4; j++) {
            let randomMidi;
            if (i === 1 && j === 0 && startTonic) {
                randomMidi = scaleInfo.tonic;
            } else if (prevMidi !== null) {
                const candidates = scaleInfo.treble.filter(m => Math.abs(m - prevMidi) <= maxJump);
                randomMidi = candidates.length > 0
                    ? candidates[Math.floor(Math.random() * candidates.length)]
                    : scaleInfo.treble[Math.floor(Math.random() * scaleInfo.treble.length)];
            } else {
                randomMidi = scaleInfo.treble[Math.floor(Math.random() * scaleInfo.treble.length)];
            }
            prevMidi = randomMidi;
            lastTrebleNotes.push({ midi: randomMidi, duration: "4n" });
            musicXml += `            <note>
                <pitch>${midiToPitch(randomMidi)}</pitch>
                <duration>1</duration>
                <type>quarter</type>
            </note>\n`;
        }
        musicXml += `        </measure>\n`;
    }

    musicXml += `        <measure number="${bars + 1}">\n`;
    const c4Distance = Math.abs(scaleInfo.tonic - prevMidi);
    const c5Distance = Math.abs(scaleInfo.tonic + 12 - prevMidi);
    const finalNoteMidi = (c4Distance <= c5Distance) ? scaleInfo.tonic : scaleInfo.tonic + 12;

    musicXml += `
    <note>
        <pitch>${midiToPitch(finalNoteMidi)}</pitch>
        <duration>4</duration>
        <type>whole</type>
    </note>
</measure>
</part>
<part id="P2">
`;
    lastTrebleNotes.push({ midi: finalNoteMidi, duration: "1n" });

    // Bass staff
    prevMidi = null;
    const progression = (CHORD_PROGRESSIONS[bars] && CHORD_PROGRESSIONS[bars][0]) || ['I', 'IV', 'V', 'I'];
    const romanNumerals = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7 };

    for (let i = 1; i <= bars - 1; i++) {
        musicXml += `        <measure number="${i}">\n`;
        if (i === 1) {
            musicXml += `            <attributes>
                <divisions>1</divisions>
                <key><fifths>${scaleInfo.fifths}</fifths></key>
                <time><beats>4</beats><beat-type>4</beat-type></time>
                <clef><sign>F</sign><line>4</line></clef>
            </attributes>\n`;
        }

        const chordSymbol = progression[(i - 1) % progression.length].toLowerCase();
        const chordDegree = romanNumerals[chordSymbol.toUpperCase()];
        const fullScale = [...new Set([...scaleInfo.bass, ...scaleInfo.treble])].sort((a, b) => a - b);
        const scalePattern = SCALE_PATTERNS[scale] || SCALE_PATTERNS['major'];
        const chordNotes = getChordNotes(fullScale, scalePattern, chordDegree);

        for (let j = 0; j < 4; j++) {
            let randomMidi;
            if (i === 1 && j === 0 && startTonic && chordDegree === 1) {
                randomMidi = scaleInfo.tonic - 12;
                if (!chordNotes.includes(randomMidi)) randomMidi = chordNotes[0] || scaleInfo.bass[0];
            } else if (prevMidi !== null) {
                const candidates = chordNotes.filter(m => Math.abs(m - prevMidi) <= maxJump);
                randomMidi = candidates.length > 0
                    ? candidates[Math.floor(Math.random() * candidates.length)]
                    : chordNotes[Math.floor(Math.random() * chordNotes.length)];
            } else {
                randomMidi = chordNotes.length > 0 ? chordNotes[Math.floor(Math.random() * chordNotes.length)] : scaleInfo.bass[Math.floor(Math.random() * scaleInfo.bass.length)];
            }

            prevMidi = randomMidi;
            lastBassNotes.push({ midi: randomMidi, duration: "4n" });
            musicXml += `            <note>
                <pitch>${midiToPitch(randomMidi)}</pitch>
                <duration>1</duration>
                <type>quarter</type>
            </note>\n`;
        }
        musicXml += `        </measure>\n`;
    }
    musicXml += `        <measure number="${bars + 1}">
    <note>
        <pitch>${midiToPitch(scaleInfo.tonic - 12)}</pitch>
        <duration>4</duration>
        <type>whole</type>
    </note>
    <note>
        <chord/>
        <pitch>${midiToPitch(scaleInfo.tonic)}</pitch>
        <duration>4</duration>
        <type>whole</type>
    </note>
</measure>
</part>
</score-partwise>`;
    lastBassNotes.push({ midi: scaleInfo.tonic - 12, duration: "1n" });
    lastBassNotes.push({ midi: scaleInfo.tonic, duration: "1n" });

    return { musicXml, lastTrebleNotes, lastBassNotes };
}