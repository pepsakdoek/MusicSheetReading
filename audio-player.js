let soundfontPlayer = null;
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

async function loadSoundfont() {
    if (soundfontPlayer) return soundfontPlayer;
    try {
        console.log("Loading soundfont instrument...");
        soundfontPlayer = await window.Soundfont.instrument(audioContext, 'acoustic_grand_piano');
        console.log("Soundfont instrument loaded.");
        return soundfontPlayer;
    } catch (e) {
        console.error("Error loading soundfont:", e);
        alert("Failed to load soundfont. Check console for details.");
        return null;
    }
}

async function playMusic(lastTrebleNotes, lastBassNotes) {
    if (!lastTrebleNotes.length || !lastBassNotes.length) return;

    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }

    const player = await loadSoundfont();
    if (!player) return;

    player.stop();

    const now = audioContext.currentTime;
    let time = 0;
    const len = lastTrebleNotes.length;
    
    const BPM = 90; // Beats per minute

    // Calculate durations based on BPM
    const quarterNoteDuration = 60 / BPM;
    const wholeNoteDuration = quarterNoteDuration * 4;

    for (let i = 0; i < len; i++) {
        const treble = lastTrebleNotes[i];
        const bass1 = lastBassNotes[i];
        const isLastTrebleNote = (i === len - 1);
        // Note: If lastBassNotes has the same length as lastTrebleNotes,
        // lastBassNotes[i + 1] will be undefined for the last iteration.
        // Ensure lastBassNotes is long enough or handle this case explicitly
        // if an additional bass note is truly intended for the last beat.
        const bass2 = (isLastTrebleNote && (i + 1) < lastBassNotes.length) ? lastBassNotes[i + 1] : null;

        const duration = (treble && treble.duration === "1n") ? wholeNoteDuration : quarterNoteDuration;

        if (isLastTrebleNote) {
            if (treble) player.play(treble.midi, now + time, { duration: duration });
            if (bass1) player.play(bass1.midi, now + time, { duration: duration });
            if (bass2) player.play(bass2.midi, now + time, { duration: duration });
        } else {
            if (treble) player.play(treble.midi, now + time, { duration: duration });
            if (bass1) player.play(bass1.midi, now + time, { duration: duration });
        }

        time += duration;
    }
}