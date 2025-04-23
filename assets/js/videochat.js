/**
 * VideoChat WebRTC functionality
 */

// Získání TURN serverů pro ICE konfiguraci
// V assets/js/videochat.js
async function getTurnServers() {
    try {
        console.log('Získávám TURN credentials...');

        // Jednoduché volání bez složitých parametrů
        const timestamp = Date.now();
        const response = await fetch(`/api/turn-credentials?t=${timestamp}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }

        const iceServers = await response.json();
        console.log('TURN servery získány:', iceServers);
        return iceServers;
    } catch (error) {
        console.error('Chyba při získávání TURN serverů:', error);

        // Vrátíme alespoň STUN servery jako fallback
        console.warn('Používám záložní STUN servery');
        return [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun.relay.metered.ca:80' }
        ];
    }
}

// PeerJS configuration
const peerConfig = {
    debug: 2,
    config: {
        iceServers: await getTurnServers(), // Tato funkce nám vrátí potřebné servery
        iceTransportPolicy: 'all' // Změníme z 'relay' na 'all' pro lepší výkon
    }
};

class VideoChat {
    constructor(roomId, userId, username) {
        this.roomId = roomId;
        this.userId = userId || 'guest';  // Ensure userId is never null
        this.username = username || 'Host';
        this.peerId = `room_${this.roomId}_user_${userId}`;
        this.localStream = null;
        this.peers = {};
        this.peer = null;
        this.videoEnabled = true;
        this.audioEnabled = true;
        this.ws = null;
        this.connectionState = 'disconnected';  // Track WebSocket connection state
        this.participants = {};  // New object to store participant data
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

            // Initialize PeerJS with fallbacks
            try {
                console.log('Initializing PeerJS with config:', peerConfig);
                
                // Dynamicky určíme port na základě protokolu
                const peerOpts = {...peerConfig};
                if (window.location.protocol === 'https:') {
                    peerOpts.secure = true;
                    peerOpts.port = 443;  // Standardní port pro HTTPS
                } else {
                    peerOpts.secure = false;
                    peerOpts.port = 80;   // Standardní port pro HTTP
                }
                
                // Zvýšené timeouty pro lepší spolehlivost
                peerOpts.pingInterval = 5000;  // 5 sekund mezi ping
                
                console.log('Final PeerJS config:', peerOpts);
                this.peer = new Peer(this.peerId, peerOpts);
            } catch (err) {
                // Fallback na defaultní PeerJS server
                console.error('Error initializing PeerJS with custom config:', err);
                console.log('Trying fallback to default PeerJS server');
                this.peer = new Peer(this.peerId, {
                    debug: 2,
                    config: {
                        iceServers: peerConfig.config.iceServers
                    }
                });
            }

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
        // Základní nastavení s audio a video
        let constraints = {
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
            
            // Upravme constraints podle toho, co je dostupné
            if (!hasCamera && !hasMicrophone) {
                this._showToast('No devices', 'No camera or microphone detected. You will be in view-only mode.', 'warning');
                return null;
            } else if (!hasCamera) {
                constraints.video = false;
                this._showToast('No camera', 'No camera detected. Continuing with audio only.', 'info');
            } else if (!hasMicrophone) {
                constraints.audio = false;
                this._showToast('No microphone', 'No microphone detected. Continuing with video only.', 'info');
            }
            
            // Now request the stream with specified constraints
            console.log('Requesting media stream with constraints:', constraints);
            try {
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                console.log('Media stream obtained successfully');
                
                // Ensure stream has active tracks
                const videoTracks = stream.getVideoTracks();
                const audioTracks = stream.getAudioTracks();
                
                console.log(`Got ${videoTracks.length} video tracks and ${audioTracks.length} audio tracks`);
                
                // Check if tracks are enabled
                if (videoTracks.length > 0) {
                    videoTracks[0].enabled = true;
                    this.videoEnabled = true;
                } else {
                    this.videoEnabled = false;
                }
                
                if (audioTracks.length > 0) {
                    audioTracks[0].enabled = true;
                    this.audioEnabled = true;
                } else {
                    this.audioEnabled = false;
                }
                
                // Aktualizujte UI podle dostupných zařízení
                this._updateUIBasedOnDevices();
                
                return stream;
            } catch (innerError) {
                // Pokud selhalo získání streamu s původními constraints, zkusme video-only nebo audio-only
                console.error('Error accessing media with initial constraints:', innerError);
                
                if (constraints.audio && constraints.video) {
                    // Zkusme jen video
                    if (hasCamera) {
                        console.log('Trying video-only...');
                        try {
                            const videoOnlyStream = await navigator.mediaDevices.getUserMedia({ video: true });
                            console.log('Got video-only stream');
                            this.videoEnabled = true;
                            this.audioEnabled = false;
                            // Aktualizujte UI
                            this._updateUIBasedOnDevices();
                            return videoOnlyStream;
                        } catch (videoError) {
                            console.error('Video-only also failed:', videoError);
                        }
                    }
                    
                    // Zkusme jen audio
                    if (hasMicrophone) {
                        console.log('Trying audio-only...');
                        try {
                            const audioOnlyStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                            console.log('Got audio-only stream');
                            this.videoEnabled = false;
                            this.audioEnabled = true;
                            // Aktualizujte UI
                            this._updateUIBasedOnDevices();
                            return audioOnlyStream;
                        } catch (audioError) {
                            console.error('Audio-only also failed:', audioError);
                        }
                    }
                }
                
                // Pokud vše selže, vrátíme null
                this._showToast('Device access failed', 'Could not access camera or microphone. You will be in view-only mode.', 'warning');
                return null;
            }
            
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
                console.error('Network error: Cannot connect to the signaling server', err);
                // Použijeme toast místo alert pro lepší UX
                this._showToast('Network error', 'Cannot connect to the signaling server. Check your internet connection.', 'danger');
            } else if (err.type === 'peer-unavailable') {
                console.log('Peer is unavailable, they may have left the room');
                // Tuto chybu nebudeme zobrazovat uživateli, je běžná když někdo opustí místnost
            } else if (err.type === 'webrtc') {
                console.error('WebRTC connection error:', err);
                this._showToast('Connection error', 'WebRTC connection failed. This may be due to firewall restrictions.', 'warning');
            } else {
                console.error('PeerJS error:', err);
                // Použijeme toast místo alert pro lepší UX
                this._showToast('Connection error', err.message || 'Unknown connection error', 'warning');
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
            
            // Make sure the URL is using the correct hostname
            if (wsUrl && wsUrl.includes('softcode.cz/ws') && !wsUrl.includes('videochat.softcode.cz')) {
                wsUrl = wsUrl.replace('softcode.cz', 'videochat.softcode.cz');
                console.log('Corrected WebSocket URL:', wsUrl);
            }
            
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
            
            // Force use of the current domain for WebSocket URL
            const currentHostname = window.location.hostname;
            if (wsUrl && !wsUrl.includes(currentHostname) && currentHostname !== 'localhost') {
                // Replace the hostname part of URL but keep the protocol and path
                const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsPath = wsUrl.split('/').slice(3).join('/'); // Get path after hostname
                wsUrl = `${wsProtocol}//${currentHostname}/${wsPath}`;
                console.log('Using current hostname for WebSocket:', wsUrl);
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
                            roomId: this.roomId,
                            username: this.username // Přidáváme jméno uživatele
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

                        // Uložíme údaje o uživateli do lokální struktury
                        if (!this.participants) this.participants = {};
                        this.participants[data.userId] = {
                            username: data.username || `Účastník ${data.userId}`
                        };

                        // Aktualizujeme seznam účastníků v UI, pokud existuje
                        this._updateParticipantsList();

                        // Volat uživatele pouze pokud má můj userId vyšší hodnotu (zabránit duplicitním voláním)
                        if (parseInt(this.userId) > parseInt(data.userId)) {
                            setTimeout(() => {
                                console.log(`Delayed call to user ${data.userId}`);
                                this.callParticipant(data.userId);
                            }, 1000);
                        } else {
                            console.log(`Waiting for user ${data.userId} to call me (my ID ${this.userId} is lower)`);
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

                            // Uložení informací o uživatelích
                            data.users.forEach(userId => {
                                if (userId !== this.userId && !this.participants[userId]) {
                                    // Pokud existuje usernames object v datech, použijeme ho
                                    const username = data.usernames && data.usernames[userId]
                                        ? data.usernames[userId]
                                        : `Účastník ${userId}`;

                                    this.participants[userId] = { username };
                                }
                            });

                            // Aktualizace seznamu účastníků v UI
                            this._updateParticipantsList();

                            // Přidejte zpoždění před voláním, aby se peer stihly inicializovat
                            setTimeout(() => {
                                data.users.forEach(userId => {
                                    if (userId !== this.userId) {
                                        // Použijte konzistentní formát ID
                                        const targetPeerId = `room_${this.roomId}_user_${userId}`;
                                        console.log('Calling existing user:', userId, 'with peerId:', targetPeerId);

                                        // Pokud nemáte ještě spojení s tímto peer
                                        if (!Object.keys(this.peers).some(id => id === targetPeerId)) {
                                            if (this.peer && this.localStream) {
                                                const call = this.peer.call(targetPeerId, this.localStream);

                                                if (call) {
                                                    // Nastavte handlery pro call...
                                                    console.log('Call initiated to', targetPeerId);

                                                    call.on('stream', (remoteStream) => {
                                                        console.log('Received stream from call to', targetPeerId);
                                                        this.addVideoStream(targetPeerId, remoteStream);
                                                        this.peers[targetPeerId] = call;
                                                    });

                                                    // Další handlery...
                                                } else {
                                                    console.error('Failed to initiate call to', targetPeerId);
                                                }
                                            }
                                        } else {
                                            console.log('Already connected to', targetPeerId);
                                        }
                                    }
                                });
                            }, 2000); // Delší zpoždění pro jistotu
                        }
                        break;
                }
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                
                // Show error message with debugging info
                const remoteVideos = document.getElementById('remote-videos');
                if (remoteVideos) {
                    // Try to get detailed error info
                    let wsInfo = '';
                    try {
                        wsInfo = `
                            <p class="mt-2 text-start">Debug Info:</p>
                            <ul class="text-start">
                                <li>URL: <code>${this.ws.url}</code></li>
                                <li>ReadyState: <code>${this.ws.readyState}</code> (0=connecting, 1=open, 2=closing, 3=closed)</li>
                                <li>Protocol: <code>${window.location.protocol}</code></li>
                                <li>Browser: <code>${navigator.userAgent}</code></li>
                            </ul>
                        `;
                    } catch (e) {
                        wsInfo = '<p>Error getting WebSocket debug info</p>';
                    }
                    
                    remoteVideos.innerHTML = `
                        <div class="alert alert-danger my-3 p-3 text-center">
                            <h4 class="alert-heading"><i class="fas fa-exclamation-triangle"></i> Connection Error</h4>
                            <p>Could not connect to the signaling server. Video chat will not work.</p>
                            <hr>
                            <p class="mb-0">Please make sure the signaling server is running:</p>
                            <pre class="text-start bg-dark text-light p-2 mt-2">bin/run-signaling.sh</pre>
                            <div class="text-start bg-dark text-light p-2 mt-3 small">
                                ${wsInfo}
                            </div>
                            <div class="mt-3">
                                <h5>Try Alternative Connections:</h5>
                                <button class="btn btn-sm btn-outline-info" onclick="testWS('wss://videochat.softcode.cz/ws')">Test /ws</button>
                                <button class="btn btn-sm btn-outline-info" onclick="testWS('wss://videochat.softcode.cz/ws/')">Test /ws/</button>
                                <button class="btn btn-sm btn-outline-info" onclick="testWS('ws://videochat.softcode.cz:3000')">Test port 3000</button>
                            </div>
                            <div class="mt-3">
                                <button class="btn btn-primary" onclick="window.location.reload()">Reload Page</button>
                                <button class="btn btn-outline-secondary ms-2" onclick="window.location.href='/room/${videoChatApp.roomSlug}?direct=true'">Try Direct Connection</button>
                            </div>
                            
                            <script>
                                function testWS(url) {
                                    try {
                                        const testOutput = document.createElement('div');
                                        testOutput.className = 'alert alert-info mt-2';
                                        testOutput.textContent = 'Testing connection to ' + url + '...';
                                        document.querySelector('.alert-danger').appendChild(testOutput);
                                        
                                        const ws = new WebSocket(url);
                                        
                                        ws.onopen = () => {
                                            testOutput.className = 'alert alert-success mt-2';
                                            testOutput.textContent = 'Successfully connected to ' + url;
                                            console.log('Test connection successful:', url);
                                            
                                            // Show retry with this URL
                                            const retryButton = document.createElement('button');
                                            retryButton.className = 'btn btn-success btn-sm ms-2';
                                            retryButton.textContent = 'Use This URL';
                                            retryButton.onclick = () => {
                                                // Update meta tag
                                                document.querySelector('meta[name="signaling-server-url"]').content = url;
                                                // Reload page
                                                window.location.reload();
                                            };
                                            testOutput.appendChild(retryButton);
                                        };
                                        
                                        ws.onerror = () => {
                                            testOutput.className = 'alert alert-danger mt-2';
                                            testOutput.textContent = 'Failed to connect to ' + url;
                                            console.log('Test connection failed:', url);
                                        };
                                        
                                    } catch (e) {
                                        console.error('Error testing WebSocket:', e);
                                    }
                                }
                            </script>
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
     * Update the participants list in UI
     */
    _updateParticipantsList() {
        const participantsList = document.getElementById('participants-list');
        if (!participantsList || !this.participants) return;

        // Clear the list while preserving the owner/host
        const hostElement = participantsList.querySelector('li:first-child');
        if (hostElement) {
            participantsList.innerHTML = '';
            participantsList.appendChild(hostElement);
        } else {
            participantsList.innerHTML = '';
        }

        // Add all participants except the current user
        for (const userId in this.participants) {
            if (userId === this.userId) continue;

            const participant = this.participants[userId];
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item';
            listItem.dataset.userId = userId;
            listItem.textContent = participant.username || `Účastník ${userId}`;
            participantsList.appendChild(listItem);
        }
    }

    /**
     * Announce presence to other participants
     */
    announcePresence() {
        try {
            // If WebSocket is connected, we don't need to use the API
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                console.log('Announcing presence via WebSocket with my peerId:', this.peerId);

                try {
                    this.ws.send(JSON.stringify({
                        type: 'announce',
                        userId: this.userId,
                        roomId: this.roomId,
                        username: this.username,
                        peerId: this.peerId  // Přidejte skutečné ID
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
            
            // Fallback to REST API - but only if we need to
            // Skip API fallback as it's not critical and usually fails with auth errors
            console.log('WebSocket unavailable, skipping presence announcement (not critical)');
            
            // If you need to enable API fallback, uncomment this block:
            /*
            fetch('/api/rooms/' + this.roomId + '/announce', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Get CSRF token from meta tag if available
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || ''
                },
                credentials: 'same-origin'  // Send cookies for authentication
            })
            .then(response => {
                if (!response.ok) {
                    if (response.status === 401) {
                        console.log('API authentication required, skipping presence announcement (not critical)');
                        return { status: 'auth_required' };
                    }
                    throw new Error(`HTTP error ${response.status}`);
                }
                return response.json();
            })
            .then(data => console.log('Announced presence via API:', data))
            .catch(error => console.error('Error announcing presence:', error));
            */
        } catch (error) {
            console.error('Error in announcePresence:', error);
        }
    }

    /**
     * Call a new participant
     */
    callParticipant(userId) {
        const targetPeerId = `room_${this.roomId}_user_${userId}`;
        console.log(`Attempting to call user ${userId} with peerId: ${targetPeerId}`);

        if (Object.keys(this.peers).some(id => id === targetPeerId)) {
            console.log(`Already connected to ${targetPeerId}`);
            return;
        }

        if (!this.peer || !this.localStream) {
            console.error('PeerJS or localStream not initialized');
            return;
        }

        try {
            console.log(`Initiating call to ${targetPeerId}`);
            const call = this.peer.call(targetPeerId, this.localStream);

            if (!call) {
                console.error(`Failed to create call to ${targetPeerId}`);
                return;
            }

            call.on('stream', (remoteStream) => {
                console.log(`Received stream from ${targetPeerId}`);
                this.addVideoStream(targetPeerId, remoteStream);
                this.peers[targetPeerId] = call;
            });

            call.on('close', () => {
                console.log(`Call with ${targetPeerId} closed`);
                this.removeVideoStream(targetPeerId);
                delete this.peers[targetPeerId];
            });

            call.on('error', (err) => {
                console.error(`Call error with ${targetPeerId}:`, err);
                this.removeVideoStream(targetPeerId);
                delete this.peers[targetPeerId];
            });

        } catch (err) {
            console.error(`Error calling peer ${targetPeerId}:`, err);
        }
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

        // Extract user ID from peerId (format: room_X_user_Y)
        const userIdMatch = peerId.match(/room_\d+_user_(\d+)/);
        const userId = userIdMatch ? userIdMatch[1] : 'unknown';

        // Create username label
        const usernameLabel = document.createElement('div');
        usernameLabel.className = 'position-absolute bottom-0 start-0 p-2 text-light bg-dark bg-opacity-50 rounded';
        usernameLabel.id = 'label-' + peerId;

        // Set username from our participants object if available
        if (this.participants && this.participants[userId]) {
            usernameLabel.textContent = this.participants[userId].username;
        } else {
            usernameLabel.textContent = `Účastník ${userId}`;
        }

        // Add elements to container
        videoContainer.appendChild(video);
        videoContainer.appendChild(usernameLabel);
        remoteVideos.appendChild(videoContainer);

        // Update participant count
        this.updateParticipantCount();
    }

    /**
     * Fetch a username by user ID
     * First tries to get it from DOM, then from memory, then from server
     */
    _fetchUsernameById(userId) {
        return new Promise((resolve) => {
            // Try to find username in participant list in the DOM
            const participantsList = document.getElementById('participants-list');
            if (participantsList) {
                const items = participantsList.querySelectorAll('li');
                for (const item of items) {
                    if (item.dataset.userId === userId) {
                        return resolve(item.textContent.trim().split('(')[0].trim());
                    }
                }
            }

            // Use a timeout to prevent blocking UI
            setTimeout(() => {
                // Default fallback
                resolve('Účastník ' + userId);
            }, 50);
        });
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
     * Update UI elements based on available devices
     */
    _updateUIBasedOnDevices() {
        // Aktualizace UI podle dostupných zařízení
        const cameraToggle = document.getElementById('camera-toggle');
        const micToggle = document.getElementById('mic-toggle');
        const videoMenuItem = document.getElementById('toggle-video-menu');
        const audioMenuItem = document.getElementById('toggle-audio-menu');
        
        // Kamera
        if (cameraToggle) {
            if (!this.videoEnabled) {
                cameraToggle.classList.add('disabled');
                cameraToggle.title = 'Camera not available';
                cameraToggle.innerHTML = '<i class="fa fa-video-slash"></i>';
                cameraToggle.classList.add('btn-danger');
                cameraToggle.classList.remove('btn-outline-light');
            }
        }
        
        // Mikrofon
        if (micToggle) {
            if (!this.audioEnabled) {
                micToggle.classList.add('disabled');
                micToggle.title = 'Microphone not available';
                micToggle.innerHTML = '<i class="fa fa-microphone-slash"></i>';
                micToggle.classList.add('btn-danger');
                micToggle.classList.remove('btn-outline-light');
            }
        }
        
        // Menu položky
        if (videoMenuItem && !this.videoEnabled) {
            videoMenuItem.textContent = 'Camera not available';
            videoMenuItem.classList.add('disabled');
        }
        
        if (audioMenuItem && !this.audioEnabled) {
            audioMenuItem.textContent = 'Microphone not available';
            audioMenuItem.classList.add('disabled');
        }
    }
    
    /**
     * Show toast notification instead of alert
     * @param {string} title - Toast title
     * @param {string} message - Toast message
     * @param {string} type - Bootstrap color type (success, danger, warning, info)
     */
    _showToast(title, message, type = 'info') {
        try {
            // Create toast element
            const toast = document.createElement('div');
            toast.className = `toast position-fixed bottom-0 end-0 m-3 bg-${type} text-white`;
            toast.setAttribute('role', 'alert');
            toast.setAttribute('aria-live', 'assertive');
            toast.setAttribute('aria-atomic', 'true');
            
            toast.innerHTML = `
                <div class="toast-header bg-${type} text-white">
                    <strong class="me-auto">${title}</strong>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            `;
            
            document.body.appendChild(toast);
            
            // Initialize and show using Bootstrap
            if (window.bootstrap && window.bootstrap.Toast) {
                const bsToast = new bootstrap.Toast(toast, {
                    autohide: true,
                    delay: 5000
                });
                bsToast.show();
            } else {
                // Fallback if Bootstrap not available
                toast.style.display = 'block';
                setTimeout(() => {
                    toast.remove();
                }, 5000);
            }
            
            // Remove from DOM after hiding
            toast.addEventListener('hidden.bs.toast', () => {
                toast.remove();
            });
            
        } catch (e) {
            console.error('Error showing toast:', e);
            // Fallback to console if toast fails
            console.log(`${title}: ${message}`);
        }
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
                // Ukončete všechny spojení
                Object.values(this.peers).forEach(call => {
                    try {
                        call.close();
                    } catch (e) {
                        console.error('Error closing call:', e);
                    }
                });

                // Zničte Peer objekt
                this.peer.destroy();
                this.peer = null;
            } catch (e) {
                console.error('Error destroying peer:', e);
            }
        }
        
        // Clear reference to all peer connections
        this.peers = {};
    }
}

// Export the VideoChat class
window.VideoChat = VideoChat;