LeviMap Extractor — Android-first PWA prototype

HOW TO USE
1. Host this folder on an HTTPS static host (GitHub Pages works).
2. Open the hosted URL in Chrome on Android.
3. Use Chrome menu > Add to Home screen / Install app.
4. Open the app and select a .zip or .levipack archive.

CURRENT CAPABILITIES
- Reads ordinary ZIP archives locally in the browser.
- Detects .mmr files and groups them by dimension/profile/surface.
- Shows region filenames and sizes.
- Finds and previews PNG files already included in an archive.
- Can save a PNG found in an archive.
- Service worker caches the app shell for offline reopening after first successful visit.

IMPORTANT LIMITATION
This build does NOT yet decode raw MMR1 regions into new PNG images. The MMR1 decoder
must be ported from LeviMap's ARM64 native library into browser-compatible code.
The UI deliberately does not claim that raw MMR conversion works yet.

PRIVACY
Archive contents are processed locally in the browser; this app contains no upload code.
