LeviMap Extractor v2 — Android-first MMR1 converter

WHAT'S NEW
- Implements MMR1 region decoding: validates the directory using compressed CRC32,
  inflates Zlib tile payloads, and handles sparse-pixel tile records.
- Stitches 16x16 pixel tiles into 256x256 pixel regions and combines region_x_y files
  into one full-footprint PNG.
- Selects a world, dimension, and profile from the selected LeviMap data folder.
- Supports dim_0 Overworld, dim_-1 Nether, dim_1 The End, and dim_2 Custom dimension.
- Optional waypoint TXT sidecar. If selected, the output is a ZIP containing the PNG
  and a TXT coordinate list. If not selected, it downloads only the PNG.
- Waypoints are not drawn onto the map. Cave layers are ignored; surface maps are used.

ANDROID USE
1. Host this folder on an HTTPS static site (GitHub Pages works).
2. Open it in Chrome on Android and install it from Chrome's menu.
3. Tap Browse folders and select:
   /storage/emulated/0/Android/media/org.levimc.launcher/minecraft/com.mojang.minecraftpe/LeviMap/data
4. Choose the world, dimension, profile, waypoint option, then Export.

FOLDER ACCESS NOTE
Android browsers differ in support for folder selection. The app uses the native
showDirectoryPicker API where available and falls back to the browser's directory
input. If Chrome on your device does not expose that directory, a native APK using
Android's Storage Access Framework will be needed for reliable access. This PWA
does not bypass Android storage permissions.

MMR1 FORMAT IMPLEMENTATION
The decoder is based on the supplied LeviMap world archive. It checks the MMR1
signature, 28-byte records, record payload sizes and CRC32; normal records inflate
to 16*16*7 bytes. Sparse records contain a u16 count followed by count records
of u16 one-based pixel index + seven pixel bytes. RGBA is the first four bytes
of each seven-byte pixel. Each record's first byte identifies its tile position
in a 16x16 tile grid. Region filenames provide the region x/z coordinates.

LIMITS
No artificial 10,000 px cap is imposed. Actual canvas, memory, browser, and device
limits still apply. Very large maps may fail on devices with insufficient RAM.
