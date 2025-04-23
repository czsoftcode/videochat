/**
 * Password Manager functionalities
 * Handles password visibility, generation and management
 */

// Password toggle functionality
function initPasswordToggles() {
    document.addEventListener('DOMContentLoaded', () => {
        // For room invite page
        const passwordToggleBtn = document.getElementById('password-toggle-btn');
        const roomPassword = document.getElementById('room-password');
        const copyPasswordBtn = document.getElementById('copy-password-btn');
        const passwordDisplay = document.getElementById('password-display');

        // Password toggle button on invite page
        if (passwordToggleBtn && roomPassword) {
            passwordToggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Get the computed style
                const computedStyle = window.getComputedStyle(roomPassword);
                console.log('Current password display style:', computedStyle.display);
                
                if (computedStyle.display === 'none') {
                    roomPassword.style.display = 'block';
                    passwordToggleBtn.innerHTML = '<i class="fa fa-eye-slash"></i> Hide Room Password';
                } else {
                    roomPassword.style.display = 'none';
                    passwordToggleBtn.innerHTML = '<i class="fa fa-eye"></i> Show Room Password';
                }
            });
        }

        // Copy password button
        if (copyPasswordBtn && passwordDisplay) {
            copyPasswordBtn.addEventListener('click', () => {
                copyToClipboard(passwordDisplay, copyPasswordBtn);
            });
        }
        
        // For edit password page
        const currentPasswordInput = document.getElementById('current_password');
        const newPasswordInput = document.getElementById('new_password');
        const toggleCurrentPasswordBtn = document.getElementById('toggle-current-password');
        const toggleNewPasswordBtn = document.getElementById('toggle-new-password');
        const generatePasswordBtn = document.getElementById('generate-password');
        
        // Toggle current password visibility
        if (toggleCurrentPasswordBtn && currentPasswordInput) {
            toggleCurrentPasswordBtn.addEventListener('click', () => {
                togglePasswordVisibility(currentPasswordInput, toggleCurrentPasswordBtn);
            });
        }
        
        // Toggle new password visibility
        if (toggleNewPasswordBtn && newPasswordInput) {
            toggleNewPasswordBtn.addEventListener('click', () => {
                togglePasswordVisibility(newPasswordInput, toggleNewPasswordBtn);
            });
        }
        
        // Generate password
        if (generatePasswordBtn && newPasswordInput) {
            generatePasswordBtn.addEventListener('click', () => {
                const password = generateSecurePassword();
                newPasswordInput.value = password;
                
                // If toggle button exists, also update its icon
                if (toggleNewPasswordBtn) {
                    newPasswordInput.type = 'text';
                    toggleNewPasswordBtn.innerHTML = '<i class="fa fa-eye-slash"></i>';
                    
                    // Change back to password type after a brief moment
                    setTimeout(() => {
                        newPasswordInput.type = 'password';
                        toggleNewPasswordBtn.innerHTML = '<i class="fa fa-eye"></i>';
                    }, 3000);
                }
            });
        }
        
        // For room creation page
        const isPrivateCheckbox = document.getElementById('is_private');
        const passwordGroup = document.getElementById('password-group');
        const passwordGenerator = document.getElementById('password-generator');
        const passwordInput = document.getElementById('password');
        const showPasswordBtn = document.getElementById('show-password');
        const generateRoomPasswordBtn = document.getElementById('generate-password');
        
        // Show/hide password fields based on checkbox for room creation
        if (isPrivateCheckbox && passwordGroup) {
            function updatePasswordFields() {
                if (isPrivateCheckbox.checked) {
                    passwordGroup.style.display = 'block';
                    if (passwordGenerator) passwordGenerator.style.display = 'block';
                } else {
                    passwordGroup.style.display = 'none';
                    if (passwordGenerator) passwordGenerator.style.display = 'none';
                    if (passwordInput) passwordInput.value = '';
                }
            }
            
            // Initialize fields based on checkbox state (for when form reloads with errors)
            updatePasswordFields();
            
            // Update on change
            isPrivateCheckbox.addEventListener('change', updatePasswordFields);
        }
        
        // Toggle password visibility
        if (showPasswordBtn && passwordInput) {
            showPasswordBtn.addEventListener('click', () => {
                togglePasswordVisibility(passwordInput, showPasswordBtn);
            });
        }
        
        // Generate password for room creation
        if (generateRoomPasswordBtn && passwordInput) {
            generateRoomPasswordBtn.addEventListener('click', () => {
                const password = generateSecurePassword();
                passwordInput.value = password;
                
                // If show button exists, also update its icon
                if (showPasswordBtn) {
                    passwordInput.type = 'text';
                    showPasswordBtn.innerHTML = '<i class="fa fa-eye-slash"></i>';
                    
                    // Change back to password type after a brief moment
                    setTimeout(() => {
                        passwordInput.type = 'password';
                        showPasswordBtn.innerHTML = '<i class="fa fa-eye"></i>';
                    }, 3000);
                }
            });
        }
    });
}

// Toggle password visibility
function togglePasswordVisibility(passwordInput, toggleBtn) {
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleBtn.innerHTML = '<i class="fa fa-eye-slash"></i>';
    } else {
        passwordInput.type = 'password';
        toggleBtn.innerHTML = '<i class="fa fa-eye"></i>';
    }
}

// Generate a secure password
function generateSecurePassword(length = 10) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
}

// Copy text to clipboard with visual feedback
function copyToClipboard(input, button) {
    input.select();
    document.execCommand('copy');
    
    // Change button text temporarily
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    button.classList.add('btn-success');
    button.classList.remove('btn-outline-secondary');
    
    setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove('btn-success');
        button.classList.add('btn-outline-secondary');
    }, 2000);
}

// Initialize the module
initPasswordToggles();

// Export for possible external use
window.passwordManager = {
    togglePasswordVisibility,
    generateSecurePassword,
    copyToClipboard
};