/**
 * Room controller - Main entry point for room functionality
 */
// Import references will be handled globally

class RoomController {
    constructor(roomId, userId, roomSlug, username, isOwner) {
        this.roomId = roomId;
        this.userId = userId;
        this.roomSlug = roomSlug;
        this.username = username;
        this.isOwner = isOwner;
        this.videoChat = null;
    }

    /**
     * Initialize the room
     */
    async init() {
        // Create VideoChat instance
        this.videoChat = new window.VideoChat(this.roomId, this.userId, this.username);
        
        // Store a reference to the instance for global access
        // This allows page lifecycle handlers to access and clean up resources
        window.videoRoomInstance = this.videoChat;
        
        // Initialize UI
        this._initUI();
        
        // Initialize video chat
        this._initVideoChat();
        
        // Set up event listeners
        this._setupEventListeners();
        
        // Set up beforeunload handler
        window.videoRoomUI.setupBeforeUnload(this.videoChat);
    }

    /**
     * Initialize UI
     */
    _initUI() {
        // Initialize dropdowns when document is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', window.videoRoomUI.initializeDropdowns);
        } else {
            window.videoRoomUI.initializeDropdowns();
        }
        
        // Add room slug to the video chat container for reference
        const videoChatRoom = document.getElementById('video-chat-room');
        if (videoChatRoom) {
            videoChatRoom.dataset.roomSlug = this.roomSlug;
        }
        
        // Expose UI functions to window object for inline event handlers
        window.showRoomOptions = window.videoRoomUI.showRoomOptions;
        window.copyRoomLink = window.videoRoomUI.copyRoomLink;
        window.toggleCamera = this.toggleCamera.bind(this);
        window.toggleMicrophone = this.toggleMicrophone.bind(this);
        window.shareScreen = this.shareScreen.bind(this);
        window.leaveRoom = this.leaveRoom.bind(this);
        window.initializeCamera = this.initializeCamera.bind(this);
    }

    /**
     * Initialize video chat
     */
    _initVideoChat() {
        // Initialize camera when page loads
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', this.initializeCamera.bind(this));
        } else {
            // Wait a short amount of time to ensure browser is ready for camera access
            setTimeout(() => {
                this.initializeCamera();
                
                // Try initializing again if the first attempt fails
                setTimeout(() => {
                    if (!this.videoChat.localStream || this.videoChat.localStream.getVideoTracks().length === 0) {
                        console.log('First camera initialization failed, trying again...');
                        this.initializeCamera();
                    }
                }, 500); // Try again after 500ms if initial attempt fails
            }, 100);
        }
        
        // Also reinitialize on page visibility change (for when coming back to the tab)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                if (!this.videoChat.localStream) {
                    console.log('Page became visible and no localStream exists, initializing camera');
                    this.initializeCamera();
                } else {
                    // Check if camera is active - if not, show restart button and try to reinitialize
                    const videoTracks = this.videoChat.localStream.getVideoTracks();
                    if (videoTracks.length === 0 || !videoTracks[0].enabled) {
                        const retryButton = document.getElementById('camera-retry');
                        if (retryButton) {
                            retryButton.style.display = 'block';
                        }
                        // Auto-retry camera initialization
                        setTimeout(() => this.initializeCamera(), 500);
                    }
                }
            }
        });
        
        // Check camera status every 5 seconds and auto-retry if needed
        setInterval(() => {
            if (!this.videoChat.localStream || (this.videoChat.localStream.getVideoTracks().length === 0)) {
                const retryButton = document.getElementById('camera-retry');
                if (retryButton) {
                    retryButton.style.display = 'block';
                }
                // Try to automatically reinitialize camera without requiring F5
                this.initializeCamera();
            }
        }, 5000);
    }

    /**
     * Set up event listeners
     */
    _setupEventListeners() {
        // Get UI elements
        const micToggle = document.getElementById('mic-toggle');
        const cameraToggle = document.getElementById('camera-toggle');
        const screenShare = document.getElementById('screen-share');
        const leaveRoomBtn = document.getElementById('leave-room');
        const toggleAudioBtn = document.getElementById('toggle-audio-menu');
        const toggleVideoBtn = document.getElementById('toggle-video-menu');
        const shareScreenBtn = document.getElementById('share-screen-menu');
        const copyLinkBtn = document.getElementById('copy-link');
        
        // Add event listeners with null checks
        if (micToggle) {
            micToggle.addEventListener('click', this.toggleMicrophone.bind(this));
        }
        
        if (cameraToggle) {
            cameraToggle.addEventListener('click', this.toggleCamera.bind(this));
        }
        
        if (screenShare) {
            screenShare.addEventListener('click', this.shareScreen.bind(this));
        }
        
        if (leaveRoomBtn) {
            leaveRoomBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.leaveRoom();
            });
        }
        
        if (toggleAudioBtn) {
            toggleAudioBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleMicrophone();
            });
        }
        
        if (toggleVideoBtn) {
            toggleVideoBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleCamera();
            });
        }
        
        if (shareScreenBtn) {
            shareScreenBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.shareScreen();
            });
        }
        
        if (copyLinkBtn) {
            copyLinkBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const roomUrl = window.location.origin + '/room/' + this.roomSlug;
                navigator.clipboard.writeText(roomUrl).then(() => {
                    alert('Room link copied to clipboard!');
                });
            });
        }
    }

    /**
     * Initialize camera
     */
    async initializeCamera() {
        console.log('Initializing camera');
        await this.videoChat.init();
    }

    /**
     * Toggle microphone
     */
    toggleMicrophone(event) {
        if (event) event.preventDefault();
        this.videoChat.toggleMicrophone();
    }

    /**
     * Toggle camera
     */
    toggleCamera(event) {
        if (event) event.preventDefault();
        this.videoChat.toggleCamera();
    }

    /**
     * Share screen
     */
    shareScreen(event) {
        if (event) event.preventDefault();
        this.videoChat.shareScreen();
    }

    /**
     * Leave room
     */
    leaveRoom(event) {
        if (event) event.preventDefault();
        this.videoChat.leaveRoom();
    }
}

// Export RoomController
window.RoomController = RoomController;