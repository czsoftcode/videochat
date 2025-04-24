/**
 * Room initialization script
 * This is the main entry point for room functionality
 */
// Import potřebných modulů
import './videochat.js';
import './room-ui.js';
import './room-controller.js';

// Wait for DOM content to be loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Room initialization starting');
    
    // Get room information from the page
    const roomData = window.videoChatApp || {};
    
    // Check if required data is available
    if (!roomData.roomId) {
        console.error('Room ID not found');
        return;
    }
    
    // Create and initialize room controller
    const controller = new window.RoomController(
        roomData.roomId,
        roomData.currentUserId,
        roomData.roomSlug,
        roomData.currentUsername,
        roomData.isOwner
    );
    
    // Initialize the controller
    controller.init()
        .then(() => {
            console.log('Room controller initialized successfully');
        })
        .catch(error => {
            console.error('Error initializing room controller:', error);
        });
});

// Create global namespace for room information
window.videoChatApp = window.videoChatApp || {};