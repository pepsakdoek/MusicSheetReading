// Requires OSMD from CDN:
// <script src="https://cdn.jsdelivr.net/npm/opensheetmusicdisplay@1.8.4/build/opensheetmusicdisplay.min.js"></script>

// const playBtn = document.getElementById('playSoundfontBtn');
// playBtn.addEventListener('click', async () => { analyzeFolderScores(); });

// (async function() {
// 	const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(
// 		document.getElementById("osmd-container")
// 	);
// 	await osmd.load("https://musetrainer.github.io/library/scores/scores/12_Variations_of_Twinkle_Twinkle_Little_Star.mxl");
// 	osmd.render();
// })();

(async function () {
	const files = [
        "https://musetrainer.github.io/library/scores/12_Variations_of_Twinkle_Twinkle_Little_Star.mxl",
        "https://musetrainer.github.io/library/scores/Arabesque_L._66_No._1_in_E_Major.mxl",
        "https://musetrainer.github.io/library/scores/Ave_Maria_D839_-_Schubert_-_Solo_Piano_Arrg..mxl",
        "https://musetrainer.github.io/library/scores/Bach_Minuet_in_G_Major_BWV_Anh._114.mxl",
        "https://musetrainer.github.io/library/scores/Bach_Toccata_and_Fugue_in_D_Minor_Piano_solo.mxl",
        "https://musetrainer.github.io/library/scores/Beethoven_Symphony_No._5_1st_movement_Piano_solo.mxl",
        "https://musetrainer.github.io/library/scores/Bella_Ciao.mxl",
        "https://musetrainer.github.io/library/scores/Bella_Ciao_-_La_Casa_de_Papel.mxl",
        "https://musetrainer.github.io/library/scores/Canon_in_D.mxl",
        "https://musetrainer.github.io/library/scores/Canon_in_D_3.mxl",
        "https://musetrainer.github.io/library/scores/Canon_in_D_easy.mxl",
        "https://musetrainer.github.io/library/scores/Carol_of_the_Bells.mxl",
        "https://musetrainer.github.io/library/scores/Carol_of_the_Bells_easy_piano.mxl",
        "https://musetrainer.github.io/library/scores/Chopin_-_Ballade_no._1_in_G_minor_Op._23.mxl",
        "https://musetrainer.github.io/library/scores/Chopin_-_Nocturne_Op._9_No._1.mxl",
        "https://musetrainer.github.io/library/scores/Chopin_-_Nocturne_Op_9_No_2_E_Flat_Major.mxl",
        "https://musetrainer.github.io/library/scores/Chopin_-_Spring_Waltz.mxl",
        "https://musetrainer.github.io/library/scores/Clair_de_lune_-_Claude_Debussy.mxl",
        "https://musetrainer.github.io/library/scores/Clair_de_Lune__Debussy.mxl",
        "https://musetrainer.github.io/library/scores/Dance_of_the_sugar_plum_fairy.mxl",
        "https://musetrainer.github.io/library/scores/DANSE_VILLAGEOISE_Beethoven.mxl",
        // "https://musetrainer.github.io/library/scores/Erik_Satie_-_Gymnopedie_No.1.mxl", --- BAD
        "https://musetrainer.github.io/library/scores/Flight_of_the_Bumblebee.mxl",
        "https://musetrainer.github.io/library/scores/Fur_Elise.mxl",
        "https://musetrainer.github.io/library/scores/Fur_Elise_-_Beethoven_-_for_beginner_piano.mxl",
        "https://musetrainer.github.io/library/scores/Fur_Elise_Easy_Piano.mxl",
        "https://musetrainer.github.io/library/scores/Fur_Elise_fingered.mxl",
        "https://musetrainer.github.io/library/scores/Gnossienne_No._1.mxl",
        "https://musetrainer.github.io/library/scores/Greensleeves_for_Piano_easy_and_beautiful.mxl",
        "https://musetrainer.github.io/library/scores/Gymnopdie_No._1__Satie.mxl",
        "https://musetrainer.github.io/library/scores/G_Minor_Bach.mxl",
        "https://musetrainer.github.io/library/scores/G_Minor_Bach_Original.mxl",
        "https://musetrainer.github.io/library/scores/Happy_Birthday_To_You_C_Major.mxl",
        "https://musetrainer.github.io/library/scores/Happy_Birthday_To_You_Piano.mxl",
        "https://musetrainer.github.io/library/scores/Hungarian_Dance_No_5_in_G_Minor.mxl",
        "https://musetrainer.github.io/library/scores/Hungarian_Sonata.mxl",
        "https://musetrainer.github.io/library/scores/J._S._Bach_-_Air_on_the_G_String_Piano_arrangement.mxl",
        "https://musetrainer.github.io/library/scores/Lacrimosa_-_Requiem.mxl",
        "https://musetrainer.github.io/library/scores/La_Campanella_-_Grandes_Etudes_de_Paganini_No._3_-_Franz_Liszt.mxl",
        "https://musetrainer.github.io/library/scores/Liebestraum_No._3_in_A_Major.mxl",
        "https://musetrainer.github.io/library/scores/Maple_Leaf_Rag_Scott_Joplin.mxl",
        "https://musetrainer.github.io/library/scores/Mariage_dAmour.mxl",
        "https://musetrainer.github.io/library/scores/Minuet_in_G_Major_Bach.mxl",
        "https://musetrainer.github.io/library/scores/moonlight_sonata_3rd_movement.mxl",
        "https://musetrainer.github.io/library/scores/Mozart_-_Piano_Sonata_No._16_-_Allegro.mxl",
        "https://musetrainer.github.io/library/scores/Nocturne_in_C_sharp_Minor.mxl",
        "https://musetrainer.github.io/library/scores/Nocturne_in_E-flat_Major_Op._9_No._2_Easy.mxl",
        "https://musetrainer.github.io/library/scores/Nocturne_No._20_in_C_Minor.mxl",
        "https://musetrainer.github.io/library/scores/Ode_to_Joy_Easy_variation.mxl",
        "https://musetrainer.github.io/library/scores/Passacaglia.mxl",
        "https://musetrainer.github.io/library/scores/Passacaglia2.mxl",
        "https://musetrainer.github.io/library/scores/Piano_Sonata_No._11_K._331_3rd_Movement_Rondo_alla_Turca.mxl",
        "https://musetrainer.github.io/library/scores/Prelude_I_in_C_major_BWV_846_-_Well_Tempered_Clavier_First_Book.mxl",
        "https://musetrainer.github.io/library/scores/Prelude_No._2_BWV_847_in_C_Minor.mxl",
        "https://musetrainer.github.io/library/scores/Prlude_No._4_in_E_Minor_Op._28_-_Frdric_Chopin.mxl",
        "https://musetrainer.github.io/library/scores/Prlude_Opus_28_No._4_in_E_Minor__Chopin.mxl",
        "https://musetrainer.github.io/library/scores/Schubert_Serenade_-_Standchen_-_By_Lizst.mxl",
        "https://musetrainer.github.io/library/scores/Sonata_No._16_1st_Movement_K._545.mxl",
        "https://musetrainer.github.io/library/scores/Sonate_No._14_Moonlight_1st_Movement.mxl",
        "https://musetrainer.github.io/library/scores/Sonate_No._14_Moonlight_3rd_Movement.mxl",
        "https://musetrainer.github.io/library/scores/Sonate_No._8_Pathetique_2nd_Movement.mxl",
        "https://musetrainer.github.io/library/scores/Spring_Waltz_Mariage_dAmour_-_Chopin.mxl",
        "https://musetrainer.github.io/library/scores/Swan_Lake.mxl",
        "https://musetrainer.github.io/library/scores/The_Entertainer_-_Scott_Joplin.mxl",
        "https://musetrainer.github.io/library/scores/The_Entertainer_-_Scott_Joplin_-_1902.mxl",
        "https://musetrainer.github.io/library/scores/Waltz_in_A_MinorChopin.mxl",
        "https://musetrainer.github.io/library/scores/Waltz_of_the_Flowers.mxl",
        "https://musetrainer.github.io/library/scores/Waltz_Opus_64_No._2_in_C_Minor.mxl",
        "https://musetrainer.github.io/library/scores/WA_Mozart_Marche_Turque_Turkish_March_fingered.mxl",
	];

	// Output accumulator
	let rows = [];
	rows.push([
		"filename",
		"bar_no",
		"notes",
		"voices",
		"shortest_note_length",
		"longest_note_length",
		"ave_note_length",
		"mode_note_length",
		"median_note_length",
		"max_beat_notes",
		"ave_beat_notes",
		"complexity_group"
	].join(","));

	// OSMD instance (reused)
	const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay("osmd-container");

	// Helper: compute stats
	function computeStats(durations, chordSizes) {
		if (durations.length === 0) {
			return {
				shortest: 0,
				longest: 0,
				average: 0,
				mode: 0,
				median: 0,
				maxChord: 0,
				aveChord: 0
			};
		}

		durations.sort((a, b) => a - b);

		const shortest = durations[0];
		const longest = durations[durations.length - 1];
		const average = durations.reduce((a, b) => a + b, 0) / durations.length;
		const median = durations[Math.floor(durations.length / 2)];

		// mode
		let freq = {};
		let mode = durations[0];
		let maxCount = 1;

		for (let d of durations) {
            freq[d] = (freq[d] || 0) + 1;
            if (freq[d] > maxCount) {
                maxCount = freq[d];
                mode = d;
            }
        }

		const maxChord = chordSizes.length ? Math.max(...chordSizes) : 0;
		const aveChord = chordSizes.length ? chordSizes.reduce((a, b) => a + b, 0) / chordSizes.length : 0;

		return { shortest, longest, average, mode, median, maxChord, aveChord };
	}

	// Simple complexity classifier
	function complexityGroup(stats, noteCount, voiceCount) {
		let score = 0;
		score += noteCount;
		score += voiceCount * 2;
		score += stats.maxChord * 3;
		score += (1 / (stats.shortest || 1)) * 4;
		return score > 40 ? "high" : score > 20 ? "medium" : "low";
	}

	// MAIN LOOP
	for (const file of files) {
		const url = `${file}`;
		// const response = await fetch(url);
		// const buffer = await response.arrayBuffer();
		console.log(`Analyzing ${file}...`);
		// console.log(url);
		// console.log(response);
		// console.log(buffer);

		await osmd.load(file);
		osmd.render(); // populates internal data

		const sheet = osmd.sheet;
		console.log(sheet);
		const measures = sheet.SourceMeasures;

		for (const measure of osmd.sheet.SourceMeasures) {
			let durations = [];
			let chordSizes = [];
			let voicesSet = new Set();

			for (const vCont of measure.VerticalSourceStaffEntryContainers || []) {
				if (!vCont || !vCont.StaffEntries) continue;

				for (const staffEntry of vCont.StaffEntries) {
					if (!staffEntry || !staffEntry.VoiceEntries) continue;

					let notesAtThisBeat = 0;

					for (const voiceEntry of staffEntry.VoiceEntries) {
						if (!voiceEntry || !voiceEntry.Notes) continue;

						voicesSet.add(voiceEntry.VoiceId);

						for (const note of voiceEntry.Notes) {
							if (!note || !note.Length) continue;

							const dur = note.Length.RealValue; // quarter = 1
							durations.push(dur);
							notesAtThisBeat++;
						}
					}

					if (notesAtThisBeat > 0) chordSizes.push(notesAtThisBeat);
				}
			}

			const stats = computeStats(durations, chordSizes);
			const noteCount = durations.length;
			const voiceCount = voicesSet.size;
			const group = complexityGroup(stats, noteCount, voiceCount);

			rows.push([
				file,
				measure.MeasureNumber,
				noteCount,
				voiceCount,
				stats.shortest,
				stats.longest,
				stats.average.toFixed(4),
				stats.mode,
				stats.median,
				stats.maxChord,
				stats.aveChord.toFixed(4),
				group
			].join(","));
		}
	}


	// Write CSV file
	const csvText = rows.join("\n");
	const blob = new Blob([csvText], { type: "text/csv" });
	const saveurl = URL.createObjectURL(blob);

	// Auto-save download
	const a = document.createElement("a");
	a.href = saveurl;
	a.download = "scoredb.csv";
	a.click();

	console.log("Analysis complete → scoredb.csv generated.");
}
)();