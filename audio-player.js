// audio-player.js
// Plays the output of MusicGenerator.generatePracticeScore()
// Tabs used for indentation

let soundfontPlayer = null;
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

/**
 * Load and cache the Soundfont instrument
 */
async function loadSoundfont() {
	if (soundfontPlayer) return soundfontPlayer;

	try {
		console.log("Loading soundfont instrument...");
		soundfontPlayer = await window.Soundfont.instrument(
			audioContext,
			'acoustic_grand_piano'
		);
		console.log("Soundfont instrument loaded.");
		return soundfontPlayer;
	} catch (e) {
		console.error("Error loading soundfont:", e);
		alert("Failed to load soundfont. Check console for details.");
		return null;
	}
}

/**
 * Convert "4n", "8n", "2n", etc. into seconds.
 */
function durationToSeconds(dur, quarterNoteDuration) {
	switch (dur) {
		case "1n":	return quarterNoteDuration * 4;
		case "2n":	return quarterNoteDuration * 2;
		case "4n":	return quarterNoteDuration;
		case "8n":	return quarterNoteDuration / 2;
		case "16n":	return quarterNoteDuration / 4;
		case "4n.":	return quarterNoteDuration * 1.5;
		case "8n.":	return (quarterNoteDuration / 2) * 1.5;
		default:
			console.warn("Unknown duration:", dur, "Defaulting to quarter note.");
			return quarterNoteDuration;
	}
}

/**
 * Play a single event: note, chord, or rest.
 */
function playEvent(event, startTime, seconds, player) {
	if (!event) return;

	switch (event.type) {
		case "rest":
			return;

		case "note":
			player.play(event.midi, startTime, { duration: seconds });
			return;

		case "chord":
			for (const midi of event.midi) {
				player.play(midi, startTime, { duration: seconds });
			}
			return;

		default:
			console.warn("Unknown event type:", event.type);
			return;
	}
}

/**
 * Play an array of events for one part.
 */
function playPart(part, startTime, quarterNoteDuration, player) {
	let time = startTime;

	for (let ev of part.events) {
		const seconds = durationToSeconds(ev.duration || "4n", quarterNoteDuration);
		playEvent(ev, audioContext.currentTime + time, seconds, player);
		time += seconds;
	}

	return time; // total duration of this part
}

/**
 * Play the score output from MusicGenerator
 */
async function playMusic(score) {
    console.log(score);
	if (!score || !score.parts || score.parts.length === 0) return;

	if (audioContext.state === 'suspended') {
		await audioContext.resume();
	}

	const player = await loadSoundfont();
	if (!player) return;

	player.stop();

	const BPM = score.meta?.bpm || 90;
	const quarterNoteDuration = 60 / BPM;

	// Determine total number of measures
	const totalBars = score.parts[0]?.measures?.length || 0;
	let currentTime = 0;

	// Play all parts measure by measure, keeping them bar-aligned
	for (let bar = 0; bar < totalBars; bar++) {
		let maxBarDuration = 0;

		for (const part of score.parts) {
			const measureEvents = part.measures[bar] || [];
			let time = 0;

			for (const ev of measureEvents) {
				const seconds = durationToSeconds(ev.duration || "4n", quarterNoteDuration);
				playEvent(ev, audioContext.currentTime + currentTime + time, seconds, player);
				time += seconds;
			}

			if (time > maxBarDuration) maxBarDuration = time;
		}

		// Advance currentTime by the longest measure among parts
		currentTime += maxBarDuration;
	}
}
