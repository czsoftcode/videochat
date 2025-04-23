/**
 * Page lifecycle handling
 * Handles page unload and navigation events to properly cleanup resources
 */

// Register event handlers when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initPageLifecycleHandlers();
});

// Initialize page lifecycle handlers
function initPageLifecycleHandlers() {
    console.log('Initializing page lifecycle handlers');
    
    // Add event listener for beforeunload to properly clean up resources
    window.addEventListener('beforeunload', handlePageUnload);
    
    // Add event listener for visibilitychange to handle tab switching
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Handle Turbo navigation events if Turbo is enabled
    if (window.Turbo) {
        document.addEventListener('turbo:before-visit', handleTurboBeforeVisit);
    }
}

// Handle page unload
function handlePageUnload(e) {
    console.log('Page unload event triggered');
    
    // Don't show confirmation if we're leaving intentionally
    if (window.isLeavingRoomIntentionally) return;
    
    // Check if we're in a video chat room
    const inVideoRoom = document.querySelector('meta[name="in-video-room"]');
    if (!inVideoRoom) return;
    
    // If we have an active VideoChat instance, clean up resources
    if (window.videoRoomInstance) {
        console.log('Cleaning up video resources before page unload');
        window.videoRoomInstance._cleanupResources();
    } else if (window.localStream) {
        // Legacy support - stop tracks directly if instance not available
        console.log('No videoRoomInstance found, stopping tracks directly');
        window.localStream.getTracks().forEach(track => track.stop());
    }
    
    // Only show confirmation dialog for accidental page refresh/close
    // Not when navigating using UI buttons
    e.preventDefault();
    e.returnValue = 'Your changes may not be saved. Are you sure you want to leave?';
    return 'Your changes may not be saved. Are you sure you want to leave?';
}

// Handle visibility change (tab switching)
function handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
        console.log('Page visibility changed to hidden');
        // We don't need to stop video here, just note that we're in background
    } else if (document.visibilityState === 'visible') {
        console.log('Page visibility changed to visible');
        // If we're coming back to the tab and in a video room, check if camera is working
        const inVideoRoom = document.querySelector('meta[name="in-video-room"]');
        if (!inVideoRoom) return;
        
        // Check if camera needs to be reinitialized
        if (window.videoRoomInstance && window.videoRoomInstance.localStream) {
            const videoTracks = window.videoRoomInstance.localStream.getVideoTracks();
            if (videoTracks.length === 0 || !videoTracks[0].enabled) {
                console.log('Camera track missing or disabled, showing retry button');
                const retryButton = document.getElementById('camera-retry');
                if (retryButton) {
                    retryButton.style.display = 'block';
                }
            }
        }
    }
}

// Handle Turbo navigation
function handleTurboBeforeVisit(event) {
    console.log('Turbo navigation detected');
    
    // Check if we're in a video chat room
    const inVideoRoom = document.querySelector('meta[name="in-video-room"]');
    if (!inVideoRoom) return;
    
    // If we have an active VideoChat instance, clean up resources
    if (window.videoRoomInstance) {
        console.log('Cleaning up video resources before Turbo navigation');
        window.videoRoomInstance._cleanupResources();
    } else if (window.localStream) {
        // Legacy support - stop tracks directly if instance not available
        console.log('No videoRoomInstance found, stopping tracks directly');
        window.localStream.getTracks().forEach(track => track.stop());
    }
    
    // Skip confirmation if user is intentionally leaving
    if (window.isLeavingRoomIntentionally) {
        return; // Let navigation proceed
    }
    
    // Only confirm when using browser navigation or closing tab,
    // not when using UI buttons that already set isLeavingRoomIntentionally
    window.isLeavingRoomIntentionally = true;
}

// Export functions for possible external use
window.pageLifecycle = {
    initPageLifecycleHandlers,
    handlePageUnload,
    handleVisibilityChange,
    handleTurboBeforeVisit
};