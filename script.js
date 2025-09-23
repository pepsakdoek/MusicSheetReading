const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay("osmd-container");
// Place these at the top, after your imports and before any function definitions:
let lastTrebleNotes = [];
let lastBassNotes = [];

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

function getPracticeOptions() {
    // Read options from the UI
    const key = document.getElementById('keySelect').value;
    const maxJump = parseInt(document.getElementById('maxJump').value, 10) || 12;
    const startTonic = document.getElementById('startTonic').checked;
    const bars = parseInt(document.getElementById('measuresSelect').value, 10) || 8;
    return { key, maxJump, startTonic, bars };
}

// Helper: get scale MIDI notes for a given key
function getScaleMidiNotes(key) {
    // Only major keys for now
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
    const scalePatterns = {
        major: [0, 2, 4, 5, 7, 9, 11, 12]
    };
    const info = keyMap[key] || keyMap["C Major"];
    // Build scale for two octaves (bass and treble)
    let scale = [];
    for (let octave = 3; octave <= 5; octave++) {
        for (let i = 0; i < 7; i++) {
            scale.push(info.tonic - 12 + scalePatterns.major[i] + 12 * (octave - 4));
        }
    }
    // Remove duplicates and sort
    scale = [...new Set(scale)].sort((a, b) => a - b);
    // Treble: midi >= 60, Bass: midi <= 59
    return {
        treble: scale.filter(m => m >= 60 && m <= 84),
        bass: scale.filter(m => m >= 36 && m <= 59),
        fifths: info.fifths,
        tonic: info.tonic
    };
}

function generatepractice(title = "Practice", options = {}) {
    // Get options
    const { key = "C Major", maxJump = 12, startTonic = true, bars = 8 } = options;
    const scaleInfo = getScaleMidiNotes(key);

    lastTrebleNotes = [];
    lastBassNotes = [];

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
    // 1 less bar because we end with a whole note on the tonic
    for (let i = 1; i <= bars-1; i++) { // <--- use bars
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
                // Filter notes within maxJump
                const candidates = scaleInfo.treble.filter(m => Math.abs(m - prevMidi) <= maxJump);
                randomMidi = candidates.length > 0
                    ? candidates[Math.floor(Math.random() * candidates.length)]
                    : scaleInfo.treble[Math.floor(Math.random() * scaleInfo.treble.length)];
            } else {
                randomMidi = scaleInfo.treble[Math.floor(Math.random() * scaleInfo.treble.length)];
            }
            prevMidi = randomMidi;
            // For quarter notes (inside the loop)
            lastTrebleNotes.push({ midi: randomMidi, duration: "4n" });
            musicXml += `            <note>
                <pitch>${midiToPitch(randomMidi)}</pitch>
                <duration>1</duration>
                <type>quarter</type>
            </note>\n`;
        }
        musicXml += `        </measure>\n`;
    }

    musicXml += `        <measure number="${bars+1}">
    <note>
        <pitch>${midiToPitch(scaleInfo.tonic + 12)}</pitch>
        <duration>4</duration>
        <type>whole</type>
    </note>
</measure>
</part>
<part id="P2">
`;
lastTrebleNotes.push({ midi: scaleInfo.tonic + 12, duration: "1n" });

// Bass staff
    prevMidi = null;
    let prevTrebleMidi = null;
    for (let i = 1; i <= bars-1; i++) { // <--- use bars
        musicXml += `        <measure number="${i}">\n`;
        if (i === 1) {
            musicXml += `            <attributes>
                <divisions>1</divisions>
                <key><fifths>${scaleInfo.fifths}</fifths></key>
                <time><beats>4</beats><beat-type>4</beat-type></time>
                <clef><sign>F</sign><line>4</line></clef>
            </attributes>\n`;
        }
        for (let j = 0; j < 4; j++) {
            // Find the corresponding treble note for this beat
            // We'll reconstruct the treble notes for this measure
            let trebleMidi;
            if (i === 1 && j === 0 && startTonic) {
                trebleMidi = scaleInfo.tonic;
            } else {
                // Reconstruct the treble note for this beat
                // Use the same logic as above
                if (i === 1 && j === 0) {
                    trebleMidi = scaleInfo.treble[Math.floor(Math.random() * scaleInfo.treble.length)];
                } else if (prevTrebleMidi !== null) {
                    const candidates = scaleInfo.treble.filter(m => Math.abs(m - prevTrebleMidi) <= maxJump);
                    trebleMidi = candidates.length > 0
                        ? candidates[Math.floor(Math.random() * candidates.length)]
                        : scaleInfo.treble[Math.floor(Math.random() * scaleInfo.treble.length)];
                } else {
                    trebleMidi = scaleInfo.treble[Math.floor(Math.random() * scaleInfo.treble.length)];
                }
            }
            prevTrebleMidi = trebleMidi;

            let randomMidi;
            if (i === 1 && j === 0 && startTonic) {
                randomMidi = scaleInfo.tonic - 12;
                if (!scaleInfo.bass.includes(randomMidi)) {
                    randomMidi = scaleInfo.bass[0];
                }
            } else {
                // Try to find a non-dissonant note within maxJump of previous bass note
                // We'll define "non-dissonant" as: bass note is a chord tone (unison, 3rd, 5th, 6th, octave) below the treble note
                const allowedIntervals = [0, 3, 4, 5, 7, 8, 9, 12]; // unison, minor/major 3rd, 4th, 5th, 6th, octave
                let candidates = [];
                for (let interval = -maxJump; interval <= maxJump; interval++) {
                    let candidate = trebleMidi + interval;
                    if (
                        scaleInfo.bass.includes(candidate) &&
                        allowedIntervals.includes(Math.abs(candidate - trebleMidi))
                    ) {
                        if (prevMidi === null || Math.abs(candidate - prevMidi) <= maxJump) {
                            candidates.push(candidate);
                        }
                    }
                }
                if (candidates.length > 0) {
                    randomMidi = candidates[Math.floor(Math.random() * candidates.length)];
                } else if (prevMidi !== null) {
                    // fallback: just maxJump from previous bass note
                    const fallback = scaleInfo.bass.filter(m => Math.abs(m - prevMidi) <= maxJump);
                    randomMidi = fallback.length > 0
                        ? fallback[Math.floor(Math.random() * fallback.length)]
                        : scaleInfo.bass[Math.floor(Math.random() * scaleInfo.bass.length)];
                } else {
                    randomMidi = scaleInfo.bass[Math.floor(Math.random() * scaleInfo.bass.length)];
                }
            }
            prevMidi = randomMidi;
            // For quarter notes (inside the loop)
            lastBassNotes.push({ midi: randomMidi, duration: "4n" });
            musicXml += `            <note>
                <pitch>${midiToPitch(randomMidi)}</pitch>
                <duration>1</duration>
                <type>quarter</type>
            </note>\n`;
        }
        musicXml += `        </measure>\n`;
    }
    musicXml += `        <measure number="${bars+1}">
    <note>
        <pitch>${midiToPitch(scaleInfo.bass[0])}</pitch>
        <duration>4</duration>
        <type>whole</type>
    </note>
    <note>
        <chord/>
        <pitch>${midiToPitch(scaleInfo.bass[0]+12)}</pitch>
        <duration>4</duration>
        <type>whole</type>
    </note>
</measure>
</part>
</score-partwise>`;
lastBassNotes.push({ midi: scaleInfo.bass[0], duration: "1n" });
lastBassNotes.push({ midi: scaleInfo.bass[0] + 12, duration: "1n" });

    // lastTrebleNotes = [];
    // lastBassNotes = [];

    return musicXml;
}

let practicecount = 1;
function loadAndRenderGeneratedMusic() {
    const title = `Practice ${practicecount++}`;
    const options = getPracticeOptions();
    const generatedMusicXml = generatepractice(title, options);
    osmd.load(generatedMusicXml)
        .then(() => {
            osmd.EngravingRules.VoiceSpacingMultiplierVexflow = 2;
            osmd.EngravingRules.VoiceSpacingAddendVexflow = 3;
            osmd.render();
            document.title = title;
            console.log("MusicXML successfully loaded and rendered.");
        })
        .catch(error => {
            console.error("Error loading or rendering MusicXML:", error);
        });
}

document.addEventListener('DOMContentLoaded', loadAndRenderGeneratedMusic);
document.getElementById('generateMusicBtn').addEventListener('click', loadAndRenderGeneratedMusic);

// Options panel toggle logic
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('optionsBtn');
    const panel = document.getElementById('optionsPanel');
    btn.addEventListener('click', (e) => {
        panel.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
        if (!btn.contains(e.target) && !panel.contains(e.target)) {
            panel.classList.add('hidden');
        }
    });
});

// Helper: Convert MIDI note number to Tone.js note name (e.g., 60 -> "C4")
function midiToNoteName(midi) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const note = notes[midi % 12];
    const octave = Math.floor(midi / 12) - 1;
    return note + octave;
}

// Parse the last generated music and play it using Tone.js
async function playGeneratedMusic() {
    if (!lastTrebleNotes.length || !lastBassNotes.length) return;

    const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" }
    }).toDestination();

    Tone.Transport.stop();
    Tone.Transport.cancel();
    Tone.Transport.position = 0;
    Tone.Transport.bpm.value = 90;

    let time = 0;
    const len = Math.max(lastTrebleNotes.length, lastBassNotes.length);

    for (let i = 0; i < len; i++) {
        const treble = lastTrebleNotes[i];
        const bass1 = lastBassNotes[i];
        const bass2 = (i === lastBassNotes.length - 2) ? lastBassNotes[i + 1] : null;

        // If this is the last measure, play treble and both bass notes as a chord
        if (i === lastTrebleNotes.length - 1 && bass2) {
            Tone.Transport.schedule((t) => {
                synth.triggerAttackRelease([
                    midiToNoteName(treble.midi),
                    midiToNoteName(bass1.midi),
                    midiToNoteName(bass2.midi)
                ], treble.duration, t);
            }, time);
            time += Tone.Time(treble.duration).toSeconds();
            break; // Done
        } else if (treble && bass1) {
            // Normal quarter notes
            Tone.Transport.schedule((t) => {
                synth.triggerAttackRelease(midiToNoteName(treble.midi), treble.duration, t);
                synth.triggerAttackRelease(midiToNoteName(bass1.midi), bass1.duration, t);
            }, time);
            time += Tone.Time(treble.duration).toSeconds();
        }
    }

    // Stop the transport after the last note
    Tone.Transport.scheduleOnce(() => {
        Tone.Transport.stop();
        Tone.Transport.position = 0;
    }, time);

    await Tone.start();
    Tone.Transport.start();
}

// Attach event listener
document.getElementById('playBtn').addEventListener('click', playGeneratedMusic);


