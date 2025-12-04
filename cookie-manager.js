function saveOptionsToCookie(options) {
    try {
        // Use localStorage instead of cookies
        localStorage.setItem('practiceOptions', JSON.stringify(options));
    } catch (e) {
        console.error("Error saving options to localStorage:", e);
    }
}

function loadOptionsFromCookie() {
    // The function name is kept for now to avoid breaking script.js,
    // but it now loads from localStorage.
    const savedOptions = localStorage.getItem('practiceOptions');
    if (savedOptions) {
        try {
            return JSON.parse(savedOptions);
        } catch (e) {
            console.error("Error parsing saved options from localStorage:", e);
        }
    }
    return null;
}