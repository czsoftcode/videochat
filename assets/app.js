import './bootstrap.js';
/*
 * Welcome to your app's main JavaScript file!
 *
 * This file will be included onto the page via the importmap() Twig function,
 * which should already be in your base.html.twig.
 */
import './styles/app.css';

// Important: The order matters here, as later scripts depend on earlier ones
import './js/videochat.js';
import './js/room-ui.js';
import './js/room-controller.js';
import './js/room-init.js';
import './js/theme-switcher.js';
import './js/password-manager.js';
import './js/page-lifecycle.js';

console.log('VideoChat application initialized');
