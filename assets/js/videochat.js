/**
 * VideoChat WebRTC functionality
 */

// PeerJS configuration
const peerConfig = {
    debug: 2,
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.google.com:19302' }
        ]
    }
};

class VideoChat {
    constructor(roomId, userId, username) {
        this.roomId = roomId;
        this.userId = userId || 'guest';  // Ensure userId is never null
        this.username = username || 'Guest';
        this.peerId = `${this.userId}_${Date.now()}`;
        this.localStream = null;
        this.peers = {};
        this.peer = null;
        this.videoEnabled = true;
        this.audioEnabled = true;
        this.ws = null;
        this.connectionState = 'disconnected';  // Track WebSocket connection state
    }

    /**
     * Initialize WebRTC connection
     */
    async init() {
        console.log('VideoChat initialization started');
        try {
            // Check WebRTC support
            if (!this._checkWebRTCSupport()) {
                console.error('WebRTC not supported by this browser');
                return false;
            }

            // Get local media stream
            console.log('Setting up media devices...');
            this.localStream = await this._setupMediaDevices();
            if (!this.localStream) {
                console.error('Failed to get local media stream');
                return false;
            }
            console.log('Successfully got local media stream', this.localStream);

            // Display local video
            const localVideo = document.getElementById('local-video');
            if (localVideo) {
                localVideo.srcObject = this.localStream;
                
                // Wait a short time before playing to avoid AbortError
                setTimeout(() => {
                    localVideo.play()
                        .catch(e => {
                            console.error("Error playing local video:", e);
                            // Try again after a longer delay if it fails
                            setTimeout(() => {
                                if (localVideo.paused) {
                                    localVideo.play()
                                        .catch(e2 => console.error("Second attempt to play video failed:", e2));
                                }
                            }, 500);
                        });
                }, 100);
            }

            // Initialize PeerJS
            this.peer = new Peer(this.peerId, peerConfig);

            // Set up PeerJS event handlers
            this._setupPeerEvents();

            // Set up WebSocket for signaling
            this._connectToSignalingServer();

            // Hide retry button if visible
            const retryButton = document.getElementById('camera-retry');
            if (retryButton) {
                retryButton.style.display = 'none';
            }

            return true;
        } catch (error) {
            console.error('Error initializing WebRTC:', error);
            return false;
        }
    }

    /**
     * Check if browser supports WebRTC
     */
    _checkWebRTCSupport() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('Your browser does not support WebRTC. Please use a modern browser like Chrome, Firefox, Safari, or Edge.');
            return false;
        }
        return true;
    }

    /**
     * Set up media devices with proper error handling
     */
    async _setupMediaDevices() {
        const constraints = {
            audio: true,
            video: true
        };
        
        try {
            // First check if we have permission to access devices
            const devices = await navigator.mediaDevices.enumerateDevices();
            const hasCamera = devices.some(device => device.kind === 'videoinput');
            const hasMicrophone = devices.some(device => device.kind === 'audioinput');
            
            if (!hasCamera || !hasMicrophone) {
                console.warn('Camera or microphone not detected:', { hasCamera, hasMicrophone });
            }
            
            // Try to get existing stream first if it exists
            if (this.localStream) {
                console.log('Reusing existing stream');
                return this.localStream;
            }
            
            // Now request the stream with specified constraints
            console.log('Requesting media stream with constraints:', constraints);
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('Media stream obtained successfully');
            
            // Ensure stream has active tracks
            const videoTracks = stream.getVideoTracks();
            const audioTracks = stream.getAudioTracks();
            
            console.log(`Got ${videoTracks.length} video tracks and ${audioTracks.length} audio tracks`);
            
            // Check if tracks are enabled
            if (videoTracks.length > 0) {
                videoTracks[0].enabled = true;
            }
            if (audioTracks.length > 0) {
                audioTracks[0].enabled = true;
            }
            
            return stream;
            
        } catch (err) {
            console.error('Error accessing media devices:', err);
            
            // Handle error with a toast notification instead of an alert
            const errorMessage = document.createElement('div');
            errorMessage.className = 'alert alert-danger alert-dismissible fade show position-fixed bottom-0 start-50 translate-middle-x mb-4';
            errorMessage.setAttribute('role', 'alert');
            
            // Provide more helpful error messages based on the error type
            let message = '';
            if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                message = 'No camera or microphone found. Please connect a device and try again.';
            } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                message = 'Permission to access camera and microphone was denied. Please allow access in your browser settings and reload the page.';
            } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                message = 'Your camera or microphone is already in use by another application. Please close other video applications and reload the page.';
            } else if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
                message = 'Your camera does not meet the required constraints. Please try with a different camera.';
            } else {
                message = `Error accessing your camera or microphone: ${err.message}. Please check your device settings and reload the page.`;
            }
            
            errorMessage.innerHTML = `
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            `;
            
            document.body.appendChild(errorMessage);
            
            // Auto-remove the alert after 5 seconds
            setTimeout(() => {
                errorMessage.classList.remove('show');
                setTimeout(() => errorMessage.remove(), 300);
            }, 5000);
            
            // Try video-only as a fallback
            try {
                console.log('Trying fallback: video-only stream');
                const videoOnlyStream = await navigator.mediaDevices.getUserMedia({ video: true });
                console.log('Got video-only stream as fallback');
                return videoOnlyStream;
            } catch (fallbackErr) {
                console.error('Fallback also failed:', fallbackErr);
                return null;
            }
        }
    }

    /**
     * Set up PeerJS event handlers
     */
    _setupPeerEvents() {
        // On PeerJS connection open
        this.peer.on('open', (id) => {
            console.log('My peer ID is:', id);
            this.announcePresence();
        });

        // Handle incoming calls
        this.peer.on('call', (call) => {
            // Answer the call with our stream
            call.answer(this.localStream);

            // Handle stream from the remote peer
            call.on('stream', (remoteStream) => {
                if (!this.peers[call.peer]) {
                    this.addVideoStream(call.peer, remoteStream);
                    this.peers[call.peer] = call;
                }
            });

            // Handle call close
            call.on('close', () => {
                this.removeVideoStream(call.peer);
                delete this.peers[call.peer];
            });

            // Handle call errors
            call.on('error', (err) => {
                console.error('Call error with peer:', call.peer, err);
                this.removeVideoStream(call.peer);
                delete this.peers[call.peer];
            });
        });

        // Handle connection errors
        this.peer.on('error', (err) => {
            console.error('PeerJS error:', err);
            
            if (err.type === 'network' || err.type === 'server-error') {
                alert('Network error: Cannot connect to the signaling server. Check your internet connection and try again.');
            } else if (err.type === 'peer-unavailable') {
                console.log('Peer is unavailable, they may have left the room');
            } else {
                alert('Connection error: ' + err);
            }
        });

        // Handle disconnection
        this.peer.on('disconnected', () => {
            console.log('Disconnected from signaling server, attempting to reconnect...');
            this.peer.reconnect();
        });
    }

    /**
     * Connect to WebSocket signaling server
     */
    _connectToSignalingServer() {
        try {
            // Get the WebSocket URL from a meta tag or use a dynamic approach
            let wsUrl = document.querySelector('meta[name="signaling-server-url"]')?.content;
            
            // Fallback logic for development environments
            if (!wsUrl) {
                // For localhost, always use plain ws:// protocol
                if (window.location.hostname === 'localhost') {
                    wsUrl = `ws://localhost:3000`;
                } else {
                    // For production, determine protocol based on current page
                    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                    wsUrl = `${wsProtocol}//${window.location.hostname}/ws`;
                }
            }
            
            console.log(`Connecting to signaling server at: ${wsUrl}`);
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('Connected to signaling server');
                this.connectionState = 'connected';
                
                // Add a short delay to ensure the connection is fully established
                setTimeout(() => {
                    // Join the room
                    try {
                        this.ws.send(JSON.stringify({
                            type: 'join',
                            userId: this.userId,
                            roomId: this.roomId
                        }));
                        
                        // Announce presence to everyone
                        this.announcePresence();
                    } catch (e) {
                        console.error('Error sending message to WebSocket server:', e);
                    }
                }, 200);
            };
            
            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                console.log('Received message:', data);
                
                switch(data.type) {
                    case 'user_joined':
                        console.log(`User ${data.userId} joined the room`);
                        // Call the new user
                        if (this.peer && this.localStream) {
                            this.callParticipant(data.userId);
                        }
                        break;
                        
                    case 'user_left':
                        console.log(`User ${data.userId} left the room`);
                        // Close any connections to this user
                        Object.entries(this.peers).forEach(([peerId, call]) => {
                            if (peerId.startsWith(data.userId + '_')) {
                                call.close();
                                delete this.peers[peerId];
                                this.removeVideoStream(peerId);
                            }
                        });
                        break;
                        
                    case 'signal':
                        // Handle incoming signal for WebRTC
                        if (data.signal && data.from && this.peer) {
                            // We handle this via PeerJS
                            console.log('Received signal from', data.from);
                        }
                        break;
                        
                    case 'room_users':
                        // Call all existing users in the room
                        if (data.users && data.users.length > 0) {
                            console.log('Existing users in room:', data.users);
                            data.users.forEach(userId => {
                                if (this.peer && this.localStream) {
                                    this.callParticipant(userId);
                                }
                            });
                        }
                        break;
                }
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                
                // Show error message
                const remoteVideos = document.getElementById('remote-videos');
                if (remoteVideos) {
                    remoteVideos.innerHTML = `
                        <div class="alert alert-danger my-3 p-3 text-center">
                            <h4 class="alert-heading"><i class="fas fa-exclamation-triangle"></i> Connection Error</h4>
                            <p>Could not connect to the signaling server. Video chat will not work.</p>
                            <hr>
                            <p class="mb-0">Please make sure the signaling server is running:</p>
                            <pre class="text-start bg-dark text-light p-2 mt-2">bin/run-signaling.sh</pre>
                            <button class="btn btn-primary mt-3" onclick="window.location.reload()">Reload Page</button>
                        </div>
                    `;
                }
            };
            
            this.ws.onclose = () => {
                console.log('Disconnected from signaling server');
                
                // Show warning if closed unexpectedly
                if (this.peers && Object.keys(this.peers).length > 0) {
                    alert('Connection to signaling server lost. Reloading page...');
                    window.location.reload();
                }
            };
        } catch(e) {
            console.error('Error connecting to signaling server:', e);
            
            // Show error message
            const remoteVideos = document.getElementById('remote-videos');
            if (remoteVideos) {
                remoteVideos.innerHTML = `
                    <div class="alert alert-danger my-3 p-3 text-center">
                        <h4 class="alert-heading"><i class="fas fa-exclamation-triangle"></i> Connection Error</h4>
                        <p>Could not connect to the signaling server. Video chat will not work.</p>
                        <hr>
                        <p class="mb-0">Please make sure the signaling server is running:</p>
                        <pre class="text-start bg-dark text-light p-2 mt-2">bin/run-signaling.sh</pre>
                        <button class="btn btn-primary mt-3" onclick="window.location.reload()">Reload Page</button>
                    </div>
                `;
            }
        }
    }

    /**
     * Announce presence to other participants
     */
    announcePresence() {
        try {
            // If WebSocket is connected, we don't need to use the API
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                console.log('Announcing presence via WebSocket');
                
                // Send a presence announcement via WebSocket
                try {
                    this.ws.send(JSON.stringify({
                        type: 'announce',
                        userId: this.userId,
                        roomId: this.roomId,
                        username: this.username
                    }));
                } catch (e) {
                    console.error('Error sending presence announcement:', e);
                }
                
                return;
            }
            
            // Wait a moment if we're still connecting
            if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
                console.log('WebSocket still connecting, will try again in 500ms');
                setTimeout(() => this.announcePresence(), 500);
                return;
            }
            
            // Fallback to REST API
            fetch('/api/rooms/' + this.roomId + '/announce', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin'  // Send cookies for authentication
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}`);
                }
                return response.json();
            })
            .then(data => console.log('Announced presence via API:', data))
            .catch(error => console.error('Error announcing presence:', error));
        } catch (error) {
            console.error('Error in announcePresence:', error);
        }
    }

    /**
     * Call a new participant
     */
    callParticipant(userId) {
        // Generate a unique peer ID for the participant
        const peerId = userId + '_' + Date.now();
        
        // Make the call
        const call = this.peer.call(peerId, this.localStream);
        
        // Set up event handlers
        call.on('stream', (remoteStream) => {
            if (!this.peers[call.peer]) {
                this.addVideoStream(call.peer, remoteStream);
                this.peers[call.peer] = call;
            }
        });
        
        call.on('close', () => {
            this.removeVideoStream(call.peer);
            delete this.peers[call.peer];
        });
        
        return call;
    }

    /**
     * Add a video stream to the UI
     */
    addVideoStream(peerId, stream) {
        const remoteVideos = document.getElementById('remote-videos');
        if (!remoteVideos) return;

        // Create video container
        const videoContainer = document.createElement('div');
        videoContainer.className = 'remote-video-wrapper p-2';
        videoContainer.id = 'container-' + peerId;
        
        // Create video element
        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        video.playsInline = true;
        video.className = 'w-100 h-100 rounded bg-dark';
        video.id = 'video-' + peerId;
        
        // Create username label
        const usernameLabel = document.createElement('div');
        usernameLabel.className = 'position-absolute bottom-0 start-0 p-2 text-light bg-dark bg-opacity-50 rounded';
        usernameLabel.textContent = 'Participant';
        
        // Add elements to container
        videoContainer.appendChild(video);
        videoContainer.appendChild(usernameLabel);
        remoteVideos.appendChild(videoContainer);
        
        // Update participant count
        this.updateParticipantCount();
    }

    /**
     * Remove a video stream from the UI
     */
    removeVideoStream(peerId) {
        const videoContainer = document.getElementById('container-' + peerId);
        if (videoContainer) {
            videoContainer.remove();
        }
        
        // Update participant count
        this.updateParticipantCount();
    }

    /**
     * Update the participant count display
     */
    updateParticipantCount() {
        const count = Object.keys(this.peers).length + 1; // +1 for local user
        const participantCount = document.getElementById('participant-count');
        if (participantCount) {
            participantCount.textContent = count;
        }
    }

    /**
     * Toggle microphone
     */
    toggleMicrophone() {
        this.audioEnabled = !this.audioEnabled;
        this.localStream.getAudioTracks().forEach(track => {
            track.enabled = this.audioEnabled;
        });
        
        // Update UI
        const micToggle = document.getElementById('mic-toggle');
        if (micToggle) {
            micToggle.innerHTML = this.audioEnabled ? 
                '<i class="fa fa-microphone"></i>' : 
                '<i class="fa fa-microphone-slash"></i>';
            micToggle.classList.toggle('btn-danger', !this.audioEnabled);
            micToggle.classList.toggle('btn-outline-light', this.audioEnabled);
        }
        
        // Update dropdown menu text
        const audioMenuItem = document.getElementById('toggle-audio-menu');
        if (audioMenuItem) {
            audioMenuItem.textContent = this.audioEnabled ? 'Mute Audio' : 'Unmute Audio';
        }
        
        return this.audioEnabled;
    }

    /**
     * Toggle camera
     */
    toggleCamera() {
        this.videoEnabled = !this.videoEnabled;
        this.localStream.getVideoTracks().forEach(track => {
            track.enabled = this.videoEnabled;
        });
        
        // Update UI
        const cameraToggle = document.getElementById('camera-toggle');
        if (cameraToggle) {
            cameraToggle.innerHTML = this.videoEnabled ? 
                '<i class="fa fa-video"></i>' : 
                '<i class="fa fa-video-slash"></i>';
            cameraToggle.classList.toggle('btn-danger', !this.videoEnabled);
            cameraToggle.classList.toggle('btn-outline-light', this.videoEnabled);
        }
        
        // Update dropdown menu text
        const videoMenuItem = document.getElementById('toggle-video-menu');
        if (videoMenuItem) {
            videoMenuItem.textContent = this.videoEnabled ? 'Disable Video' : 'Enable Video';
        }
        
        return this.videoEnabled;
    }

    /**
     * Share screen
     */
    async shareScreen() {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true
            });
            
            // Replace video track with screen track
            const videoTrack = screenStream.getVideoTracks()[0];
            
            // Get all senders from peer connections and replace the track
            Object.values(this.peers).forEach(call => {
                const sender = call.peerConnection.getSenders().find(s => 
                    s.track && s.track.kind === 'video'
                );
                if (sender) {
                    sender.replaceTrack(videoTrack);
                }
            });
            
            // Replace local video display
            const oldStream = document.getElementById('local-video').srcObject;
            const oldAudioTrack = oldStream.getAudioTracks()[0];
            if (oldAudioTrack) {
                screenStream.addTrack(oldAudioTrack);
            }
            document.getElementById('local-video').srcObject = screenStream;
            
            // Update UI
            const screenShare = document.getElementById('screen-share');
            if (screenShare) {
                screenShare.classList.remove('btn-outline-light');
                screenShare.classList.add('btn-success');
                screenShare.innerHTML = '<i class="fa fa-desktop"></i> <span class="badge bg-light text-dark">Sharing</span>';
            }
            
            // Update menu
            const screenMenuItem = document.getElementById('share-screen-menu');
            if (screenMenuItem) {
                screenMenuItem.textContent = 'Stop Screen Sharing';
            }
            
            // Handle when user stops sharing screen
            videoTrack.onended = () => {
                // Restore camera as video source
                this.localStream.getVideoTracks().forEach(track => {
                    Object.values(this.peers).forEach(call => {
                        const sender = call.peerConnection.getSenders().find(s => 
                            s.track && s.track.kind === 'video'
                        );
                        if (sender) {
                            sender.replaceTrack(track);
                        }
                    });
                });
                
                // Restore local video display
                document.getElementById('local-video').srcObject = this.localStream;
                
                // Reset UI
                if (screenShare) {
                    screenShare.classList.remove('btn-success');
                    screenShare.classList.add('btn-outline-light');
                    screenShare.innerHTML = '<i class="fa fa-desktop"></i>';
                }
                
                // Reset menu
                if (screenMenuItem) {
                    screenMenuItem.textContent = 'Share Screen';
                }
            };
            
            return true;
        } catch (error) {
            console.error('Error sharing screen:', error);
            alert('Could not share screen: ' + error.message);
            return false;
        }
    }

    /**
     * Leave the room
     */
    leaveRoom() {
        // No confirmation dialog - just leave directly
        console.log('Leaving room and cleaning up resources...');
        
        this._cleanupResources();
        
        // Set a flag to prevent the beforeunload handler from showing a confirmation dialog
        window.isLeavingRoomIntentionally = true;
        
        // Notify server that we're leaving
        return fetch('/api/rooms/' + this.roomId + '/leave', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(() => {
            console.log('Successfully left the room');
            // Navigate back to home page
            window.location.href = '/';
        })
        .catch(error => {
            console.error('Error leaving room:', error);
            // Navigate back to home page anyway
            window.location.href = '/';
        });
    }
    
    /**
     * Cleanup all resources (media, connections, etc)
     * This is called when leaving the room or when the page is unloaded
     */
    _cleanupResources() {
        console.log('Cleaning up video resources...');
        
        // Stop any ongoing screen sharing
        const localVideo = document.getElementById('local-video');
        if (localVideo && localVideo.srcObject && localVideo.srcObject !== this.localStream) {
            localVideo.srcObject.getTracks().forEach(track => {
                track.stop();
                console.log('Stopped shared screen track');
            });
        }
        
        // Close all peer connections
        Object.values(this.peers).forEach(call => {
            try {
                call.close();
            } catch (e) {
                console.error('Error closing peer connection:', e);
            }
        });
        
        // Close WebSocket connection
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify({
                    type: 'leave',
                    userId: this.userId,
                    roomId: this.roomId
                }));
                this.ws.close();
            } catch (e) {
                console.error('Error closing WebSocket:', e);
            }
        }
        
        // Stop all tracks in local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                try {
                    track.stop();
                    console.log(`Stopped ${track.kind} track`);
                } catch (e) {
                    console.error(`Error stopping ${track.kind} track:`, e);
                }
            });
            this.localStream = null;
        }
        
        // Close PeerJS connection
        if (this.peer) {
            try {
                this.peer.destroy();
            } catch (e) {
                console.error('Error destroying peer:', e);
            }
            this.peer = null;
        }
        
        // Clear reference to all peer connections
        this.peers = {};
    }
}

// Export the VideoChat class
window.VideoChat = VideoChat;