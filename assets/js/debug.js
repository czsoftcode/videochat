/**
 * Debug helper pro zjištění, proč js nefunguje
 */

console.log('Debug.js byl načten a spuštěn');

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded byl zavolán v debug.js');

    // Vypsat všechny načtené JavaScriptové soubory
    const scripts = document.querySelectorAll('script[src]');
    console.log('Načtené skripty:', scripts.length);
    scripts.forEach(script => {
        console.log('- Skript:', script.src);
    });

    // Ověřit, zda existují očekávané objekty
    console.log('VideoChat existuje:', typeof window.VideoChat === 'function');
    console.log('RoomController existuje:', typeof window.RoomController === 'function');
    console.log('videoRoomUI existuje:', typeof window.videoRoomUI === 'object');

    // Zkontrolovat, zda jsou data room dostupná
    console.log('videoChatApp:', window.videoChatApp);

    // Přidat tlačítko pro ladění přímo na stránku
    const debugButton = document.createElement('button');
    debugButton.className = 'btn btn-warning position-fixed top-0 start-0 m-3';
    debugButton.innerHTML = 'Debug Info';
    debugButton.style.zIndex = 9999;
    debugButton.onclick = function() {
        alert('Debug Info:\n' +
            '- VideoChat exists: ' + (typeof window.VideoChat === 'function') + '\n' +
            '- RoomController exists: ' + (typeof window.RoomController === 'function') + '\n' +
            '- videoRoomUI exists: ' + (typeof window.videoRoomUI === 'object') + '\n' +
            '- videoChatApp: ' + JSON.stringify(window.videoChatApp, null, 2));
    };
    document.body.appendChild(debugButton);
});

// Zkusit inicializovat RoomController ručně, pokud je k dispozici
setTimeout(function() {
    if (typeof window.RoomController === 'function' && window.videoChatApp) {
        console.log('Pokus o ruční inicializaci RoomController');
        try {
            const controller = new window.RoomController(
                window.videoChatApp.roomId,
                window.videoChatApp.currentUserId,
                window.videoChatApp.roomSlug,
                window.videoChatApp.currentUsername,
                window.videoChatApp.isOwner
            );
            controller.init().then(() => {
                console.log('RoomController úspěšně inicializován ručně');
            });
        } catch (e) {
            console.error('Ruční inicializace RoomController selhala:', e);
        }
    } else {
        console.warn('RoomController nebo videoChatApp nejsou k dispozici pro ruční inicializaci');
    }
}, 2000);