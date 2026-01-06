console.log("Script.js loading...");

const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay("osmd-container");

let lastTrebleNotes = [];
let lastBassNotes = [];
let practicecount = 1;
let score = null;
let audioControl = null; // To hold the audio player instance

// Removed old options handling and added new options retrieval logic
function getPracticeOptions() {
    const barsInput = document.getElementById('measuresSelect');
    const complexityInput = document.getElementById('Complexity');
    
    const bars = parseInt(barsInput ? barsInput.value : 4, 10) || 4;
    const complexity = complexityInput ? complexityInput.value : 'Medium';
    
    console.log(`[getPracticeOptions] Bars: ${bars}, Complexity: ${complexity}`);
    return { bars, complexity };
}

function loadAndRenderGeneratedMusic() {
    const options = getPracticeOptions();
    console.log("[loadAndRenderGeneratedMusic] Options:", options);

    const chosenSet = processScoreData(scoredata, options.bars, options.complexity);

    if (!chosenSet) {
        console.error("[loadAndRenderGeneratedMusic] No valid practice set found for these options.");
        return;
    }

    console.log('[loadAndRenderGeneratedMusic] Final chosen set of bars for practice:', chosenSet);

    const endBar = chosenSet[1];
    const startBar = endBar - options.bars + 1;
    const filename = chosenSet[0];
    const cleanName = filename.split('/').pop().replace(/\.mxl$/i, '').replace(/_/g, ' ');
    const title = `${cleanName} (Bars ${startBar}-${endBar})`;

    document.title = title;
    console.log(`[loadAndRenderGeneratedMusic] Loading: ${cleanName} (Bars ${startBar}-${endBar})`);
    console.log(`[loadAndRenderGeneratedMusic] Loading: ${filename} (Bars ${startBar}-${endBar})`);
    
    // const scaleName = SCALE_NAMES[options.scale] || 'Major';
    // const title = `Practice ${practicecount++} (${options.key}, ${scaleName})`;
    // // generatePractice returns { score, musicXml }. We need to assign the returned score
    // // to the global `score` variable so playMusic() can access it.
    // const result = generatePractice(title, options);
    // console.log(result.score);
    // score = result.score; // Assign to the global score variable

    osmd.load(filename).then(() => {
        console.log("[OSMD] Score loaded successfully.");
        document.title = title;
        osmd.setOptions({
            drawFromMeasureNumber: startBar,
            drawUpToMeasureNumber: endBar
        });
        osmd.render();
        console.log("[OSMD] Render complete.");
    }).catch((error) => {
        console.error("[OSMD] Error loading or rendering MusicXML:", error);
    });
}

function applyOptionsToUI(options) {
    if (options) {
        // document.getElementById('keySelect').value = options.key || 'C';
        // document.getElementById('maxJump').value = options.maxJump || 12;
        // document.getElementById('startTonic').checked = options.startTonic === true;
        document.getElementById('measuresSelect').value = options.bars || 8;
        // document.getElementById('scaleSelect').value = options.scale || 'major';
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
    console.log(`[filterScoreDataByDifficulty] Filtering ${scoredata.rows.length} rows for difficulty: ${difficulty}`);
    const filteredRows = scoredata.rows.filter(row => {
        if (difficulty === 'Easy') {
            return row[11] === 'Easy';
        } else if (difficulty === 'Medium') {
            return row[11] === 'Easy' || row[11] === 'Medium';
        } else {
            return true; // No filtering for 'Hard'
        }
    });
    console.log(`[filterScoreDataByDifficulty] Rows remaining: ${filteredRows.length}`);
    return { ...scoredata, rows: filteredRows };
}

// Step 2: Add a 'consecutive' column based on bar_no sequence
function addConsecutiveColumn(scoredata, bars) {
    console.log(`[addConsecutiveColumn] Marking consecutive sequences of length ${bars}`);
    const updatedRows = [];
    let currentFile = null;
    let consecutiveCount = 0;
    let lastBarNo = -1;

    for (const row of scoredata.rows) {
        const [filename, bar_no] = row;

        if (filename !== currentFile) {
            currentFile = filename;
            consecutiveCount = 1;
            lastBarNo = bar_no;
        } else if (bar_no === lastBarNo + 1) {
            consecutiveCount++;
            lastBarNo = bar_no;
        } else {
            consecutiveCount = 1;
            lastBarNo = bar_no;
        }

        updatedRows.push([...row, consecutiveCount >= bars ? 'yes' : 'no']);
    }

    const validSequences = updatedRows.filter(r => r[r.length - 1] === 'yes').length;
    console.log(`[addConsecutiveColumn] Found ${validSequences} valid sequences.`);
    return { ...scoredata, rows: updatedRows };
}

// Step 3: Filter out non-consecutive parts of the dataset
function filterNonConsecutive(scoredata) {
    const filteredRows = scoredata.rows.filter(row => row[row.length - 1] === 'yes');
    console.log(`[filterNonConsecutive] Rows remaining after removing non-consecutive: ${filteredRows.length}`);
    return { ...scoredata, rows: filteredRows };
}

// Step 4: Randomly choose a qualifying set of bars
function chooseRandomSet(scoredata) {
    if (scoredata.rows.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * scoredata.rows.length);
    return scoredata.rows[randomIndex];
}

// Main function to process scoredata
function processScoreData(scoredata, bars, complexity) {
    let filteredData = filterScoreDataByDifficulty(scoredata, complexity || 'Easy');
    filteredData = addConsecutiveColumn(filteredData, bars);
    filteredData = filterNonConsecutive(filteredData);
    const chosenSet = chooseRandomSet(filteredData);

    console.log('Chosen set of bars:', chosenSet);
    return chosenSet;
}
