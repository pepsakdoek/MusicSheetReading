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
 * Returns a controller object with `stop()`, `isPlaying`, and a `finished` Promise
 */
async function playMusic(score) {
	console.log(score);
	if (!score || !score.parts || score.parts.length === 0) return null;

	if (audioContext.state === 'suspended') {
		await audioContext.resume();
	}

	const player = await loadSoundfont();
	if (!player) return null;

	// Stop any currently scheduled notes on the player
	player.stop();

	const BPM = score.meta?.bpm || 90;
	const quarterNoteDuration = 60 / BPM;

	// Determine total number of measures
	const totalBars = score.parts[0]?.measures?.length || 0;

	// Calculate total duration in seconds so we can detect natural end
	let totalDuration = 0;
	for (let bar = 0; bar < totalBars; bar++) {
		let maxBarDuration = 0;

		for (const part of score.parts) {
			const measureEvents = part.measures[bar] || [];
			let time = 0;

			for (const ev of measureEvents) {
				const seconds = durationToSeconds(ev.duration || "4n", quarterNoteDuration);
				time += seconds;
			}

			if (time > maxBarDuration) maxBarDuration = time;
		}

		totalDuration += maxBarDuration;
	}

	// Schedule playback
	let currentTime = 0;
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

		currentTime += maxBarDuration;
	}

	// Create a promise that resolves when playback finishes (naturally or by stop)
	let resolveFinished;
	const finished = new Promise((resolve) => { resolveFinished = resolve; });

	let isPlaying = true;
	// Safety timer to detect natural end of scheduled playback
	const endTimer = setTimeout(() => {
		if (isPlaying) {
			isPlaying = false;
			resolveFinished();
		}
	}, Math.max(0, totalDuration * 1000) + 50);

	return {
		get isPlaying() { return isPlaying; },
		stop: function() {
			if (!isPlaying) return;
			isPlaying = false;
			clearTimeout(endTimer);
			try { player.stop(); } catch (e) { /* ignore */ }
			resolveFinished();
		},
		finished
	};
}
