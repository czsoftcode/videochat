/**
 * Room UI functionality
 */

// Initialize dropdown menu
function initializeDropdowns() {
    console.log('Initializing dropdowns');
    
    try {
        // Make sure Bootstrap is available
        if (typeof bootstrap === 'undefined') {
            console.error('Bootstrap is not defined. Make sure Bootstrap JS is properly loaded.');
            return;
        }
        
        // Initialize using vanilla JS first for reliability
        const dropdownButtons = document.querySelectorAll('.dropdown-toggle');
        console.log('Found dropdown buttons:', dropdownButtons.length);
        
        dropdownButtons.forEach(button => {
            try {
                new bootstrap.Dropdown(button);
                console.log('Initialized dropdown on:', button.id || 'unnamed button');
            } catch (e) {
                console.error('Error initializing dropdown:', e);
            }
        });
        
        // Add direct click handler to the main dropdown button
        const mainDropdownButton = document.getElementById('dropdownMenuButton');
        if (mainDropdownButton) {
            console.log('Adding click handler to main dropdown button');
            mainDropdownButton.addEventListener('click', function(e) {
                console.log('Main dropdown button clicked (vanilla JS)');
                e.stopPropagation();
                try {
                    const dropdown = bootstrap.Dropdown.getInstance(this);
                    if (dropdown) {
                        dropdown.toggle();
                    } else {
                        new bootstrap.Dropdown(this).toggle();
                    }
                } catch (err) {
                    console.error('Error handling dropdown click:', err);
                }
            });
        } else {
            console.warn('Main dropdown button not found');
        }
        
        // Trying jQuery as a fallback
        if (window.$ && typeof $.fn.dropdown === 'function') {
            console.log('Using jQuery dropdown initialization as backup');
            $('.dropdown-toggle').dropdown();
            
            $('#dropdownMenuButton').on('click', function() {
                console.log('Dropdown button clicked (jQuery)');
            });
        }
    } catch (err) {
        console.error('Error during dropdown initialization:', err);
    }
}

// Show room options menu
function showRoomOptions(event) {
    event.preventDefault();
    const menu = document.getElementById('roomOptionsMenu');
    menu.classList.toggle('show');
    menu.style.display = menu.classList.contains('show') ? 'block' : 'none';
    
    // Position the menu relative to the button
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    menu.style.top = rect.bottom + 'px';
    menu.style.left = (rect.left - menu.offsetWidth + rect.width) + 'px';
    
    // Add click outside listener
    document.addEventListener('click', closeMenuOnClickOutside);
}

// Close menu when clicking outside
function closeMenuOnClickOutside(event) {
    const menu = document.getElementById('roomOptionsMenu');
    const trigger = document.getElementById('roomOptionsTrigger').querySelector('button');
    
    if (!menu.contains(event.target) && event.target !== trigger) {
        menu.classList.remove('show');
        menu.style.display = 'none';
        document.removeEventListener('click', closeMenuOnClickOutside);
    }
}

// Copy room link to clipboard
function copyRoomLink(event) {
    event.preventDefault();
    const roomSlug = document.getElementById('video-chat-room').dataset.roomSlug;
    const roomUrl = window.location.origin + '/room/' + roomSlug;
    
    navigator.clipboard.writeText(roomUrl)
        .then(() => {
            // Use toast notification instead of alert
            const toastElement = document.createElement('div');
            toastElement.className = 'toast position-fixed bottom-0 end-0 m-3';
            toastElement.setAttribute('role', 'alert');
            toastElement.setAttribute('aria-live', 'assertive');
            toastElement.setAttribute('aria-atomic', 'true');
            toastElement.innerHTML = `
                <div class="toast-header">
                    <strong class="me-auto">Notification</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    Room link copied to clipboard!
                </div>
            `;
            document.body.appendChild(toastElement);
            const toast = new bootstrap.Toast(toastElement, { autohide: true, delay: 2000 });
            toast.show();
            
            // Remove toast after it's hidden
            toastElement.addEventListener('hidden.bs.toast', () => {
                toastElement.remove();
            });
        })
        .catch(err => {
            console.error('Could not copy text: ', err);
        });
    
    // Hide dropdown if open
    document.getElementById('roomOptionsMenu').classList.remove('show');
}

// Handle beforeunload event
function setupBeforeUnload(videoChatInstance) {
    window.addEventListener('beforeunload', function(e) {
        // Don't show confirmation if we're leaving intentionally
        if (window.isLeavingRoomIntentionally) return;
        
        // Stop tracks to release camera and microphone
        if (videoChatInstance && videoChatInstance.localStream) {
            videoChatInstance.localStream.getTracks().forEach(track => track.stop());
        }
        
        // Show confirmation dialog only for page refreshes and tab closures
        e.preventDefault();
        e.returnValue = 'Your changes may not be saved. Are you sure you want to leave?';
        return 'Your changes may not be saved. Are you sure you want to leave?';
    });
}

// Export functions to window
window.videoRoomUI = {
    initializeDropdowns,
    showRoomOptions,
    closeMenuOnClickOutside,
    copyRoomLink,
    setupBeforeUnload
};