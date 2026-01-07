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
    const song_start_bar = chosenSet[12]; // I think test 
    const cleanName = filename.split('/').pop().replace(/\.mxl$/i, '').replace(/_/g, ' ');
    const title = `${cleanName} (Bars ${startBar}-${endBar}) Star bar: ${song_start_bar}`;

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
        
        // Generate score object for playback from OSMD data
        score = convertOSMDToScore(osmd, startBar - 1 + song_start_bar, endBar - 1 + song_start_bar);
        console.log("[Audio] Score generated from OSMD:", score);

        document.title = title;
        osmd.sheet.title.text = title;
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

// Helper to extract playback data from OSMD's internal model
function convertOSMDToScore(osmdInstance, startBar, endBar) {
    const sheet = osmdInstance.sheet;
    const score = {
        meta: { bpm: 100 }, // Default BPM
        parts: []
    };

    // Try to find BPM from the sheet
    if (sheet.MetronomeMark) {
         score.meta.bpm = sheet.MetronomeMark.Tempo;
    } else if (sheet.SourceMeasures.length > 0 && sheet.SourceMeasures[0].TempoInBPM) {
         score.meta.bpm = sheet.SourceMeasures[0].TempoInBPM;
    }

    const voiceMap = new Map(); // voiceId -> { measures: [] }
    const debugData = []; // For logging purposes
    const simpleDebug = []; // Simplified log for user verification

    console.log(`[Audio] Converting OSMD to Score. Target Range: ${startBar} to ${endBar}`);

    // Iterate through all measures in the sheet
    let playbackMeasureIndex = 0;
    for (let i = 0; i < sheet.SourceMeasures.length; i++) {
        const measure = sheet.SourceMeasures[i];
        // Ensure we compare numbers
        const measureNumber = typeof measure.MeasureNumber === 'number' 
            ? measure.MeasureNumber 
            : parseInt(measure.MeasureNumber, 10);
        
        const measureDebug = {
            measureNumber: measureNumber,
            measureIndex: i,
            included: false,
            events: []
        };
        
        // Filter by bar range if provided
        if (startBar !== undefined && endBar !== undefined) {
            if (measureNumber < startBar || measureNumber > endBar) {
                debugData.push(measureDebug); // Log skipped measures to help debugging
                continue;
            }
        }
        measureDebug.included = true;
        const measureIndex = playbackMeasureIndex; 

        // Iterate vertical containers (timestamps within the measure)
        for (const vssec of measure.VerticalSourceStaffEntryContainers) {
            for (const staffEntry of vssec.StaffEntries) {
                if (!staffEntry) continue;

                const voiceEntries = staffEntry.VoiceEntries || staffEntry.voiceEntries || [];

                for (const voiceEntry of voiceEntries) {
                    let voiceId = voiceEntry.VoiceId;
                    if (voiceId === undefined && voiceEntry.ParentVoice) {
                        voiceId = voiceEntry.ParentVoice.VoiceId;
                    }
                    if (voiceId === undefined) voiceId = 0;
                    
                    if (!voiceMap.has(voiceId)) {
                        voiceMap.set(voiceId, { measures: [] });
                    }
                    const part = voiceMap.get(voiceId);
                    
                    // Ensure measure array exists for this index
                    if (!part.measures[measureIndex]) {
                        part.measures[measureIndex] = [];
                    }
                    const measureEvents = part.measures[measureIndex];

                    const notes = voiceEntry.Notes || voiceEntry.notes || [];
                    if (notes.length > 0) {
                        const firstNote = notes[0];
                        // OSMD Length.RealValue is based on Whole Note = 1.0
                        // audio-player.js expects 1.0 = Quarter Note.
                        // So we multiply by 4.
                        const lengthObj = firstNote.Length || firstNote.length;
                        let duration = 0;
                        if (lengthObj) {
                            const realValue = (lengthObj.RealValue !== undefined) ? lengthObj.RealValue : lengthObj.realValue;
                            if (realValue !== undefined) duration = realValue * 4 ;
                        }
                        
                        let event = null;
                        if (firstNote.isRest()) {
                            event = { type: "rest", duration: duration };
                        } else {
                            // Collect MIDI numbers for chord or single note
                            // Pitch.getHalfTone() returns the MIDI note number (e.g. 60 for Middle C)
                            const midis = notes.map(n => n.Pitch ? n.Pitch.getHalfTone() : 0).filter(m => m > 0);
                            
                            if (midis.length === 1) {
                                event = { type: "note", midi: midis[0], duration: duration };
                            } else if (midis.length > 1) {
                                event = { type: "chord", midi: midis, duration: duration };
                            }
                        }

                        if (event) {
                            measureEvents.push(event);
                            
                            // Create readable event for debug
                            const readableEvent = {
                                type: event.type,
                                duration: duration.toFixed(2), // Duration in quarter notes
                                voice: voiceId
                            };
                            
                            if (event.type === 'note') {
                                readableEvent.midi = event.midi;
                                readableEvent.pitch = notes[0].Pitch ? notes[0].Pitch.toString() : 'N/A';
                            } else if (event.type === 'chord') {
                                readableEvent.midis = event.midi;
                                readableEvent.pitches = notes.map(n => n.Pitch ? n.Pitch.toString() : 'N/A');
                            }
                            
                            measureDebug.events.push(readableEvent);
                        }
                    }
                }
            }
        }
        debugData.push(measureDebug);
        
        if (measureDebug.included) {
            simpleDebug.push({
                bar: measureNumber,
                index: i,
                events: measureDebug.events
            });
        }
        
        playbackMeasureIndex++;
    }
    
    console.log("[Audio] Filtered MusicXML Data (Debug):", debugData);
    console.log("[Audio] Playback Notes (Readable):", simpleDebug);
    score.debugData = debugData;
    score.simpleDebug = simpleDebug;
    
    score.parts = Array.from(voiceMap.values());
    return score;
}

function applyOptionsToUI(options) {
    if (options) {
        // document.getElementById('keySelect').value = options.key || 'C';
        // document.getElementById('maxJump').value = options.maxJump || 12;
        // document.getElementById('startTonic').checked = options.startTonic === true;
        const measuresSelect = document.getElementById('measuresSelect');
        if (measuresSelect) {
            measuresSelect.value = options.bars || 8;
        }
        const complexityInput = document.getElementById('Complexity');
        if (complexityInput) {
            complexityInput.value = options.complexity || 'Medium';
        }
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

// Step 0.5 : Add the song start bar column
function addSongStartBarColumn(scoredata) {
    console.log("[addSongStartBarColumn] Adding song start bar column.");
    const songStartBars = new Map(); // filename -> min_bar_no

    // First pass: find the minimum bar_no for each filename
    for (const row of scoredata.rows) {
        const filename = row[0];
        const bar_no = row[1];
        if (!songStartBars.has(filename) || bar_no < songStartBars.get(filename)) {
            songStartBars.set(filename, bar_no);
        }
    }

    // Second pass: add the song_start_bar to each row
    const updatedRows = scoredata.rows.map(row => {
        const filename = row[0];
        const song_start_bar = songStartBars.get(filename);
        return [...row, song_start_bar];
    });

    console.log(`[addSongStartBarColumn] Added song start bar to ${updatedRows.length} rows.`);
    return { ...scoredata, rows: updatedRows };
}

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
    scoredata = addSongStartBarColumn(scoredata);
    let filteredData = filterScoreDataByDifficulty(scoredata, complexity || 'Easy');
    filteredData = addConsecutiveColumn(filteredData, bars);
    filteredData = filterNonConsecutive(filteredData);
    const chosenSet = chooseRandomSet(filteredData);

    console.log('Chosen set of bars:', chosenSet);
    return chosenSet;
}
