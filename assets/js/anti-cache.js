/**
 * Anti-cache utility to prevent browser caching of assets
 */

// Add version parameter to all script and stylesheet links
document.addEventListener('DOMContentLoaded', function() {
    const version = new Date().getTime();
    const assets = document.querySelectorAll('script[src], link[rel="stylesheet"][href]');
    
    assets.forEach(asset => {
        if (asset.src) {
            // Don't add version to CDN resources
            if (!asset.src.includes('cdn.jsdelivr.net') && !asset.src.includes('cdnjs.cloudflare.com') && !asset.src.includes('unpkg.com')) {
                asset.src = asset.src + (asset.src.includes('?') ? '&' : '?') + 'v=' + version;
            }
        } else if (asset.href) {
            // Don't add version to CDN resources
            if (!asset.href.includes('cdn.jsdelivr.net') && !asset.href.includes('cdnjs.cloudflare.com')) {
                asset.href = asset.href + (asset.href.includes('?') ? '&' : '?') + 'v=' + version;
            }
        }
    });
});