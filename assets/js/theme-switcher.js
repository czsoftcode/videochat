/**
 * Theme switcher functionality
 * Switches between light and dark themes using data-bs-theme attribute
 */

// Initialize theme switcher
document.addEventListener('DOMContentLoaded', () => {
    initThemeSwitcher();
});

// Initialize theme switcher
function initThemeSwitcher() {
    // Set initial theme based on local storage or system preference
    setInitialTheme();

    // Add event listener to the theme toggle button
    const themeToggle = document.getElementById('theme-toggle-btn');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
}

// Set initial theme
function setInitialTheme() {
    // Check if theme is stored in local storage
    const storedTheme = localStorage.getItem('theme');
    
    if (storedTheme) {
        // Use stored theme
        document.documentElement.setAttribute('data-bs-theme', storedTheme);
        updateThemeIcon(storedTheme);
    } else {
        // Use system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const initialTheme = prefersDark ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-bs-theme', initialTheme);
        localStorage.setItem('theme', initialTheme);
        updateThemeIcon(initialTheme);
    }
}

// Toggle theme
function toggleTheme() {
    // Get current theme
    const currentTheme = document.documentElement.getAttribute('data-bs-theme');
    
    // Toggle theme
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    // Update theme
    document.documentElement.setAttribute('data-bs-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update icon
    updateThemeIcon(newTheme);
}

// Update theme icon
function updateThemeIcon(theme) {
    const themeToggle = document.getElementById('theme-toggle-btn');
    if (themeToggle) {
        // Update icon based on theme
        themeToggle.innerHTML = theme === 'dark' 
            ? '<i class="fa fa-sun"></i>' 
            : '<i class="fa fa-moon"></i>';
    }
}

// Export functions
window.themeSwitcher = {
    initThemeSwitcher,
    toggleTheme
};