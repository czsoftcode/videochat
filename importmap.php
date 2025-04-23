<?php

/**
 * Returns the importmap for this application.
 *
 * - "path" is a path inside the asset mapper system. Use the
 *     "debug:asset-map" command to see the full list of paths.
 *
 * - "entrypoint" (JavaScript only) set to true for any module that will
 *     be used as an "entrypoint" (and passed to the importmap() Twig function).
 *
 * The "importmap:require" command can be used to add new entries to this file.
 */
return [
    'app' => [
        'path' => './assets/app.js',
        'entrypoint' => true,
    ],
    '@hotwired/stimulus' => [
        'version' => '3.2.2',
    ],
    '@symfony/stimulus-bundle' => [
        'path' => './vendor/symfony/stimulus-bundle/assets/dist/loader.js',
    ],
    '@hotwired/turbo' => [
        'version' => '7.3.0',
    ],
    'videochat' => [
        'path' => './assets/js/videochat.js',
        'entrypoint' => true, // Označení jako vstupní bod
    ],
    'room-ui' => [
        'path' => './assets/js/room-ui.js',
        'imports' => [
            'videochat' => 'videochat'
        ]
    ],
    'room-controller' => [
        'path' => './assets/js/room-controller.js',
        'imports' => [
            'videochat' => 'videochat',
            'room-ui' => 'room-ui'
        ]
    ],
    'room-init' => [
        'path' => './assets/js/room-init.js',
        'entrypoint' => true,
        'imports' => [
            'videochat' => 'videochat',
            'room-ui' => 'room-ui',
            'room-controller' => 'room-controller'
        ]
    ],
    'theme-switcher' => [
        'path' => './assets/js/theme-switcher.js',
    ],
    'password-manager' => [
        'path' => './assets/js/password-manager.js',
    ],
    'anti-cache' => [
        'path' => './assets/js/anti-cache.js',
        'entrypoint' => true,
    ],
    'page-lifecycle' => [
        'path' => './assets/js/page-lifecycle.js',
    ],
];
