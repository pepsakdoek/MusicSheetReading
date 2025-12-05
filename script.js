console.log("Script.js loading...");

const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay("osmd-container");

let lastTrebleNotes = [];
let lastBassNotes = [];
let practicecount = 1;
let score = null;

function getPracticeOptions() {
    // Read options from the UI
    const key = document.getElementById('keySelect').value;
    const maxJump = parseInt(document.getElementById('maxJump').value, 10) || 12;
    const startTonic = document.getElementById('startTonic').checked;
    const bars = parseInt(document.getElementById('measuresSelect').value, 10) || 8;
    const scale = document.getElementById('scaleSelect').value;
    return { key, maxJump, startTonic, bars, scale };
}

function loadAndRenderGeneratedMusic() {
    const options = getPracticeOptions();
    const scaleName = SCALE_NAMES[options.scale] || 'Major';
    const title = `Practice ${practicecount++} (${options.key}, ${scaleName})`;
    // generatePractice returns { score, musicXml }. We need to assign the returned score
    // to the global `score` variable so playMusic() can access it.
    const result = generatePractice(title, options);
    console.log(result.score);
    score = result.score; // Assign to the global score variable

    osmd.load(result.musicXml).then(() => {
        osmd.EngravingRules.VoiceSpacingMultiplierVexflow = 2;
        osmd.EngravingRules.VoiceSpacingAddendVexflow = 3;
        osmd.render();
        document.title = title;
        console.log("MusicXML successfully loaded and rendered.");
    }).catch((error) => {
        console.error("Error loading or rendering MusicXML:", error);
    });
}

function applyOptionsToUI(options) {
    if (options) {
        document.getElementById('keySelect').value = options.key || 'C Major';
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

    document.getElementById('playSoundfontBtn').addEventListener('click', () => playMusic(score));
});
