console.log("Script.js loading...");

const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay("osmd-container");

let lastTrebleNotes = [];
let lastBassNotes = [];
let practicecount = 1;
let score = null;
let audioControl = null; // To hold the audio player instance

// Removed old options handling and added new options retrieval logic
function getPracticeOptions() {
    const bars = parseInt(document.getElementById('measuresSelect').value, 10) || 4;
    const complexity = document.getElementById('Complexity').value || 'Medium';
    return { bars, complexity };
}

function loadAndRenderGeneratedMusic() {
    const options = getPracticeOptions();

    const chosenSet = processScoreData(scoredata, options.bars);

    console.log('Final chosen set of bars for practice:', chosenSet);

    const title = `Practice Set (${chosenSet[0][0]}, Bars ${chosenSet[0][1]}-${chosenSet[0][1] + options.bars - 1})`;
    document.title = title;
    
    // const scaleName = SCALE_NAMES[options.scale] || 'Major';
    // const title = `Practice ${practicecount++} (${options.key}, ${scaleName})`;
    // // generatePractice returns { score, musicXml }. We need to assign the returned score
    // // to the global `score` variable so playMusic() can access it.
    // const result = generatePractice(title, options);
    // console.log(result.score);
    // score = result.score; // Assign to the global score variable

    // osmd.load(result.musicXml).then(() => {
    //     osmd.EngravingRules.VoiceSpacingMultiplierVexflow = 2;
    //     osmd.EngravingRules.VoiceSpacingAddendVexflow = 3;
    //     osmd.render();
    //     document.title = title;
    //     console.log("MusicXML successfully loaded and rendered.");
    // }).catch((error) => {
    //     console.error("Error loading or rendering MusicXML:", error);
    // });
}

function applyOptionsToUI(options) {
    if (options) {
        document.getElementById('keySelect').value = options.key || 'C';
        document.getElementById('maxJump').value = options.maxJump || 12;
        document.getElementById('startTonic').checked = options.startTonic === true;
        document.getElementById('measuresSelect').value = options.bars || 8;
        document.getElementById('scaleSelect').value = options.scale || 'major';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const savedOptions = loadOptionsFromCookie();
    if (savedOptions) {
        applyOptionsToUI(savedOptions);
    }
    loadAndRenderGeneratedMusic();

    document.getElementById('generateMusicBtn').addEventListener('click', () => {
        saveOptionsToCookie(getPracticeOptions());
        loadAndRenderGeneratedMusic();
    });

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

    const playBtn = document.getElementById('playSoundfontBtn');
    playBtn.addEventListener('click', async () => {
        if (audioControl && audioControl.isPlaying) {
            // If music is playing, stop it.
            audioControl.stop();
            audioControl = null;
            playBtn.textContent = 'Play';
        } else {
            // If music is not playing, start it.
            playBtn.textContent = 'Stop';
            audioControl = await playMusic(score);
            if (!audioControl) {
                // If playMusic failed, reset button
                playBtn.textContent = 'Play';
                return;
            }

            // When playback naturally finishes (or stop() is called), reset UI
            const ctrl = audioControl;
            if (ctrl.finished && typeof ctrl.finished.then === 'function') {
                ctrl.finished.then(() => {
                    // Only reset if this is still the active control
                    if (audioControl === ctrl) {
                        playBtn.textContent = 'Play';
                        audioControl = null;
                    }
                }).catch(() => {
                    // ignore
                });
            }
        }
    });
});

// Step 1: Filter out rows based on the provided difficulty
function filterScoreDataByDifficulty(scoredata, difficulty) {
    return scoredata.rows.filter(row => {
        if (difficulty === 'Easy') {
            return row[11] === 'Easy';
        } else if (difficulty === 'Medium') {
            return row[11] === 'Easy' || row[11] === 'Medium';
        } else {
            return true; // No filtering for 'Hard'
        }
    });
}

// Step 2: Add a 'consecutive' column based on bar_no sequence
function addConsecutiveColumn(scoredata, bars) {
    const updatedRows = [];
    let currentFile = null;
    let consecutiveCount = 0;

    for (const row of scoredata.rows) {
        const [filename, bar_no] = row;

        if (filename !== currentFile) {
            currentFile = filename;
            consecutiveCount = 1;
        } else if (bar_no === consecutiveCount + 1) {
            consecutiveCount++;
        } else {
            consecutiveCount = 1;
        }

        row.push(consecutiveCount >= bars ? 'yes' : 'no');
        updatedRows.push(row);
    }

    return { ...scoredata, rows: updatedRows };
}

// Step 3: Filter out non-consecutive parts of the dataset
function filterNonConsecutive(scoredata) {
    return scoredata.rows.filter(row => row[row.length - 1] === 'yes');
}

// Step 4: Randomly choose a qualifying set of bars
function chooseRandomSet(scoredata) {
    const randomIndex = Math.floor(Math.random() * scoredata.rows.length);
    return scoredata.rows[randomIndex];
}

// Main function to process scoredata
function processScoreData(scoredata, bars) {
    let filteredData = filterScoreDataByDifficulty(scoredata, 'Easy');
    filteredData = addConsecutiveColumn(filteredData, bars);
    filteredData = filterNonConsecutive(filteredData);
    const chosenSet = chooseRandomSet(filteredData);

    console.log('Chosen set of bars:', chosenSet);
    return chosenSet;
}
