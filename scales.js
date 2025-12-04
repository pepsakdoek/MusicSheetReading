const SCALE_PATTERNS = {
    // value: [intervals]
    'major-pentatonic': [0, 2, 4, 7, 9],
    'minor-pentatonic': [0, 3, 5, 7, 10],
    'blues-minor': [0, 3, 5, 6, 7, 10],
    'blues-major': [0, 2, 3, 4, 7, 9],
    'dorian': [0, 2, 3, 5, 7, 9, 10],
    'mixolydian': [0, 2, 4, 5, 7, 9, 10],
    'major': [0, 2, 4, 5, 7, 9, 11], // Natural Major (Ionian)
    'minor': [0, 2, 3, 5, 7, 8, 10], // Natural Minor (Aeolian)
    'harmonic-minor': [0, 2, 3, 5, 7, 8, 11],
    'melodic-minor': [0, 2, 3, 5, 7, 9, 11], // Ascending
};

// For display in the dropdown
const SCALE_NAMES = {
    'major-pentatonic': 'Major Pentatonic',
    'minor-pentatonic': 'Minor Pentatonic',
    'blues-minor': 'Blues Scale (Minor)',
    'blues-major': 'Major Blues Scale',
    'dorian': 'Dorian Mode',
    'mixolydian': 'Mixolydian Mode',
    'major': 'Natural Major (Ionian)',
    'minor': 'Natural Minor (Aeolian)',
    'harmonic-minor': 'Harmonic Minor',
    'melodic-minor': 'Melodic Minor (Ascending)',
};

// Chord progressions per number of bars
const CHORD_PROGRESSIONS = {
    2: [['I', 'V']],
    4: [['I', 'IV', 'V', 'I']],
    8: [['I', 'IV', 'V', 'I', 'vi', 'IV', 'V', 'I']],
};