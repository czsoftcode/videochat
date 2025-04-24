/**
 * Zjednodušená a opravená inicializace VideoChat
 */

// Globální proměnné
window.videoRoomInstance = null;

// Základní UI funkce pro práci s místností
window.videoRoomUI = {
    initializeDropdowns: function() {
        console.log('Inicializuji dropdowny');
        const dropdownButtons = document.querySelectorAll('.dropdown-toggle');

        if (typeof bootstrap !== 'undefined') {
            dropdownButtons.forEach(button => {
                try {
                    new bootstrap.Dropdown(button);
                } catch (e) {
                    console.error('Chyba inicializace dropdownu:', e);
                }
            });
        } else {
            console.warn('Bootstrap není načten, dropdowny nebudou fungovat');
        }
    },

    showRoomOptions: function(event) {
        if (event) event.preventDefault();
        console.log('showRoomOptions volán');
        const menu = document.getElementById('roomOptionsMenu');
        if (menu) {
            menu.classList.toggle('show');
            menu.style.display = menu.classList.contains('show') ? 'block' : 'none';
        }
    },

    copyRoomLink: function(event) {
        if (event) event.preventDefault();
        console.log('copyRoomLink volán');

        const roomSlug = document.getElementById('video-chat-room').dataset.roomSlug;
        const roomUrl = window.location.origin + '/room/' + roomSlug;

        navigator.clipboard.writeText(roomUrl)
            .then(() => {
                alert('Odkaz na místnost byl zkopírován do schránky!');
            })
            .catch(err => {
                console.error('Chyba při kopírování:', err);
                // Alternativní metoda pro starší prohlížeče
                const tempInput = document.createElement('input');
                tempInput.value = roomUrl;
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand('copy');
                document.body.removeChild(tempInput);
                alert('Odkaz na místnost byl zkopírován do schránky!');
            });
    }
};

// Zjednodušená třída pro videohovor
class SimpleVideoChat {
    constructor(roomId, userId, username) {
        this.roomId = roomId;
        this.userId = userId || 'guest';
        this.username = username || 'Host';
        this.localStream = null;
        this.videoEnabled = true;
        this.audioEnabled = true;

        console.log('SimpleVideoChat vytvořen pro místnost', roomId, 'a uživatele', userId);
    }

    async init() {
        console.log('SimpleVideoChat.init() zavolán');

        try {
            // Získání přístupu ke kameře a mikrofonu
            console.log('Získávám přístup ke kameře a mikrofonu...');
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });

            // Zobrazení lokálního videa
            console.log('Zobrazuji lokální video');
            const localVideo = document.getElementById('local-video');
            if (localVideo) {
                localVideo.srcObject = this.localStream;

                // Přehráváme video s malým zpožděním pro předejití AbortError
                setTimeout(() => {
                    localVideo.play().catch(e => {
                        console.error('Chyba při přehrávání lokálního videa:', e);
                    });
                }, 100);
            }

            // Skrytí tlačítka pro opětovné povolení kamery
            const retryButton = document.getElementById('camera-retry');
            if (retryButton) {
                retryButton.style.display = 'none';
            }

            // Odstranění načítací zprávy a zobrazení upozornění o připravené místnosti
            const remoteVideos = document.getElementById('remote-videos');
            if (remoteVideos) {
                remoteVideos.innerHTML = `
                    <div class="alert alert-success my-3 p-3 text-center">
                        <h4 class="alert-heading"><i class="fas fa-check-circle"></i> Připraven</h4>
                        <p>Vaše kamera a mikrofon jsou aktivní. Čeká se na další účastníky...</p>
                    </div>
                `;
            }

            return true;
        } catch (e) {
            console.error('Chyba při inicializaci SimpleVideoChat:', e);

            // Zobrazení chybové zprávy
            const remoteVideos = document.getElementById('remote-videos');
            if (remoteVideos) {
                remoteVideos.innerHTML = `
                    <div class="alert alert-danger my-3 p-3 text-center">
                        <h4 class="alert-heading"><i class="fas fa-exclamation-triangle"></i> Chyba</h4>
                        <p>Nepodařilo se získat přístup ke kameře nebo mikrofonu.</p>
                        <p>Chybová zpráva: ${e.message}</p>
                        <button class="btn btn-primary mt-3" onclick="window.initializeCamera()">Zkusit znovu</button>
                    </div>
                `;
            }

            // Zobrazení tlačítka pro opětovné povolení kamery
            const retryButton = document.getElementById('camera-retry');
            if (retryButton) {
                retryButton.style.display = 'block';
            }

            return false;
        }
    }

    toggleMicrophone() {
        if (!this.localStream) return false;

        const audioTracks = this.localStream.getAudioTracks();
        if (audioTracks.length === 0) return false;

        this.audioEnabled = !this.audioEnabled;
        audioTracks.forEach(track => {
            track.enabled = this.audioEnabled;
        });

        // Aktualizace UI
        const micToggle = document.getElementById('mic-toggle');
        if (micToggle) {
            micToggle.innerHTML = this.audioEnabled ?
                '<i class="fa fa-microphone"></i>' :
                '<i class="fa fa-microphone-slash"></i>';
            micToggle.classList.toggle('btn-danger', !this.audioEnabled);
            micToggle.classList.toggle('btn-outline-light', this.audioEnabled);
        }

        return this.audioEnabled;
    }

    toggleCamera() {
        if (!this.localStream) return false;

        const videoTracks = this.localStream.getVideoTracks();
        if (videoTracks.length === 0) return false;

        this.videoEnabled = !this.videoEnabled;
        videoTracks.forEach(track => {
            track.enabled = this.videoEnabled;
        });

        // Aktualizace UI
        const cameraToggle = document.getElementById('camera-toggle');
        if (cameraToggle) {
            cameraToggle.innerHTML = this.videoEnabled ?
                '<i class="fa fa-video"></i>' :
                '<i class="fa fa-video-slash"></i>';
            cameraToggle.classList.toggle('btn-danger', !this.videoEnabled);
            cameraToggle.classList.toggle('btn-outline-light', this.videoEnabled);
        }

        return this.videoEnabled;
    }

    async shareScreen() {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true
            });

            const videoTrack = screenStream.getVideoTracks()[0];

            // Zastavení původního video tracku
            this.localStream.getVideoTracks().forEach(track => track.stop());

            // Vytvoření nového streamu s video ze sdílení obrazovky a audio z původního streamu
            const newStream = new MediaStream();
            newStream.addTrack(videoTrack);

            // Přidat audio track, pokud existuje
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                newStream.addTrack(audioTrack);
            }

            // Aktualizace lokálního streamu
            this.localStream = newStream;

            // Aktualizace video elementu
            const localVideo = document.getElementById('local-video');
            if (localVideo) {
                localVideo.srcObject = newStream;
            }

            // Aktualizace UI
            const screenShare = document.getElementById('screen-share');
            if (screenShare) {
                screenShare.classList.remove('btn-outline-light');
                screenShare.classList.add('btn-success');
                screenShare.innerHTML = '<i class="fa fa-desktop"></i> <span class="badge bg-light text-dark">Sdílení</span>';
            }

            // Handler pro ukončení sdílení obrazovky
            videoTrack.onended = () => {
                // Resetování streamu - znovu získáme kameru
                this.init();

                // Resetování UI
                if (screenShare) {
                    screenShare.classList.remove('btn-success');
                    screenShare.classList.add('btn-outline-light');
                    screenShare.innerHTML = '<i class="fa fa-desktop"></i>';
                }
            };

            return true;
        } catch (e) {
            console.error('Chyba při sdílení obrazovky:', e);
            alert('Nepodařilo se sdílet obrazovku: ' + e.message);
            return false;
        }
    }

    leaveRoom() {
        // Ukončení streamu
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }

        // Přesměrování na homepage
        window.location.href = '/';
    }
}

// Inicializace při načtení DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM načten - inicializuji videochat-init.js');

    // Inicializace UI komponent
    window.videoRoomUI.initializeDropdowns();

    // Inicializace videohovoru, pokud máme potřebná data
    if (window.videoChatApp && window.videoChatApp.roomId) {
        console.log('Inicializuji SimpleVideoChat pro místnost', window.videoChatApp.roomId);

        // Vytvoření instance SimpleVideoChat
        window.videoRoomInstance = new SimpleVideoChat(
            window.videoChatApp.roomId,
            window.videoChatApp.currentUserId,
            window.videoChatApp.currentUsername
        );

        // Inicializace kamery a mikrofonu
        window.videoRoomInstance.init()
            .then(success => {
                console.log('SimpleVideoChat inicializován:', success);
            })
            .catch(err => {
                console.error('Chyba při inicializaci SimpleVideoChat:', err);
            });

        // Nastavení globálních funkcí pro ovládání
        window.toggleMicrophone = function(event) {
            if (event) event.preventDefault();
            if (window.videoRoomInstance) {
                window.videoRoomInstance.toggleMicrophone();
            }
        };

        window.toggleCamera = function(event) {
            if (event) event.preventDefault();
            if (window.videoRoomInstance) {
                window.videoRoomInstance.toggleCamera();
            }
        };

        window.shareScreen = function(event) {
            if (event) event.preventDefault();
            if (window.videoRoomInstance) {
                window.videoRoomInstance.shareScreen();
            }
        };

        window.leaveRoom = function(event) {
            if (event) event.preventDefault();
            if (window.videoRoomInstance) {
                if (confirm('Opravdu chcete opustit tuto místnost?')) {
                    window.videoRoomInstance.leaveRoom();
                }
            } else {
                if (confirm('Opravdu chcete opustit tuto místnost?')) {
                    window.location.href = '/';
                }
            }
        };

        window.initializeCamera = function() {
            if (window.videoRoomInstance) {
                window.videoRoomInstance.init();
            } else {
                window.videoRoomInstance = new SimpleVideoChat(
                    window.videoChatApp.roomId,
                    window.videoChatApp.currentUserId,
                    window.videoChatApp.currentUsername
                );
                window.videoRoomInstance.init();
            }
        };
    }
});