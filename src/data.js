// Device presets.
//
// `vw`/`vh` are the device's REAL CSS-pixel viewport — the iframe is rendered
// at exactly these dimensions so the previewed site sees the same viewport
// width (and therefore hits the same media queries) as the real hardware.
// `radius`, `bezel` and `chin` are likewise in real device px, so the whole
// mockup can be uniformly scaled down to fit the canvas without distortion.
export const DEVICES = [
  // ---------------- iPhone ----------------
  { id: 'iphone-17-pro-max', name: 'iPhone 17 Pro Max', category: 'iPhone', vw: 440, vh: 956, radius: 62, bezel: 13, cutout: 'island', edge: 'flat' },
  { id: 'iphone-17-pro', name: 'iPhone 17 Pro', category: 'iPhone', vw: 402, vh: 874, radius: 58, bezel: 13, cutout: 'island', edge: 'flat' },
  { id: 'iphone-17', name: 'iPhone 17', category: 'iPhone', vw: 393, vh: 852, radius: 55, bezel: 12, cutout: 'island', edge: 'flat' },
  { id: 'iphone-se', name: 'iPhone SE', category: 'iPhone', vw: 375, vh: 667, radius: 42, bezel: 16, chin: 78, cutout: 'home', edge: 'flat' },

  // ---------------- Samsung ----------------
  { id: 'galaxy-s26-ultra', name: 'Galaxy S26 Ultra', category: 'Samsung', vw: 480, vh: 1040, radius: 46, bezel: 9, cutout: 'punch-center', edge: 'curved' },
  { id: 'galaxy-s26-plus', name: 'Galaxy S26+', category: 'Samsung', vw: 440, vh: 956, radius: 44, bezel: 9, cutout: 'punch-center', edge: 'curved' },
  { id: 'galaxy-s26', name: 'Galaxy S26', category: 'Samsung', vw: 402, vh: 874, radius: 40, bezel: 10, cutout: 'punch-center', edge: 'flat' },
  { id: 'galaxy-z-fold-7', name: 'Galaxy Z Fold 7', category: 'Samsung', vw: 374, vh: 840, radius: 34, bezel: 10, cutout: 'punch-corner', edge: 'flat' },

  // ---------------- Pixel ----------------
  { id: 'pixel-10-pro-xl', name: 'Pixel 10 Pro XL', category: 'Pixel', vw: 430, vh: 962, radius: 56, bezel: 11, cutout: 'punch-center', edge: 'flat' },
  { id: 'pixel-10-pro', name: 'Pixel 10 Pro', category: 'Pixel', vw: 412, vh: 892, radius: 52, bezel: 11, cutout: 'punch-center', edge: 'flat' },
  { id: 'pixel-10', name: 'Pixel 10', category: 'Pixel', vw: 393, vh: 852, radius: 48, bezel: 12, cutout: 'punch-center', edge: 'flat' },

  // ---------------- iPad (landscape) ----------------
  { id: 'ipad-pro-13', name: 'iPad Pro 13"', category: 'iPad', vw: 1366, vh: 1024, radius: 34, bezel: 26, cutout: 'none', edge: 'flat', orientation: 'landscape', cameraInBezel: true },
  { id: 'ipad-air-11', name: 'iPad Air 11"', category: 'iPad', vw: 1180, vh: 820, radius: 30, bezel: 28, cutout: 'none', edge: 'flat', orientation: 'landscape', cameraInBezel: true },
]

export const CATEGORIES = ['All', 'iPhone', 'Samsung', 'Pixel', 'iPad']

// Frame finishes ("skins"). `category` scopes a finish to the brand it
// realistically ships on; 'All' finishes are available everywhere.
export const SKINS = [
  { id: 'space-black', name: 'Space Black', color: '#1c1c1e', category: 'iPhone' },
  { id: 'natural-titanium', name: 'Natural Titanium', color: '#8a8578', category: 'iPhone' },
  { id: 'desert-titanium', name: 'Desert Titanium', color: '#cfc0a6', category: 'iPhone' },
  { id: 'deep-blue', name: 'Deep Blue', color: '#33415c', category: 'iPhone' },

  { id: 'titanium-gray', name: 'Titanium Gray', color: '#54595e', category: 'Samsung' },
  { id: 'titanium-black', name: 'Titanium Black', color: '#1b1b1d', category: 'Samsung' },
  { id: 'titanium-whitesilver', name: 'Titanium Whitesilver', color: '#e8e6e1', category: 'Samsung' },
  { id: 'titanium-yellow', name: 'Titanium Yellow', color: '#cbb26a', category: 'Samsung' },

  { id: 'obsidian', name: 'Obsidian', color: '#1b1b1d', category: 'Pixel' },
  { id: 'porcelain', name: 'Porcelain', color: '#e9e6df', category: 'Pixel' },
  { id: 'hazel', name: 'Hazel', color: '#8d8577', category: 'Pixel' },
  { id: 'rose-quartz', name: 'Rose Quartz', color: '#e3c2bd', category: 'Pixel' },

  { id: 'space-gray', name: 'Space Gray', color: '#55555a', category: 'iPad' },
  { id: 'ipad-silver', name: 'Silver', color: '#e3e4e6', category: 'iPad' },

  { id: 'silver', name: 'Silver', color: '#dcdde0', category: 'All' },
  { id: 'midnight', name: 'Midnight', color: '#12141c', category: 'All' },
]

// Demo browser chrome styles shown inside the device screen.
export const BROWSERS = [
  { id: 'chrome', name: 'Chrome', bar: 'rounded-full' },
  { id: 'safari', name: 'Safari', bar: 'rounded-full' },
  { id: 'firefox', name: 'Firefox', bar: 'rounded-md' },
  { id: 'brave', name: 'Brave', bar: 'rounded-md', dark: true },
  { id: 'edge', name: 'Edge', bar: 'rounded-full' },
]

// Generic https padlock shown inside every address bar, same as real browsers.
export const LOCK_ICON_PATH =
  '<path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />'

// Brand-styled logo marks (simplified, but colored/shaped to read as the
// real browser at a glance). `uid` namespaces gradient ids so multiple
// instances of the same logo can render on screen at once.
const BRAND_LOGOS = {
  chrome: (uid) => `
    <svg viewBox="0 0 24 24" class="h-full w-full">
      <circle cx="12" cy="12" r="12" fill="#fff" />
      <path d="M12 12 L21.5 12 A9.5 9.5 0 0 1 7.25 20.23 Z" fill="#34A853" />
      <path d="M12 12 L7.25 20.23 A9.5 9.5 0 0 1 7.25 3.77 Z" fill="#EA4335" />
      <path d="M12 12 L7.25 3.77 A9.5 9.5 0 0 1 21.5 12 Z" fill="#FBBC05" />
      <circle cx="12" cy="12" r="4.3" fill="#4285F4" stroke="#fff" stroke-width="1.1" />
    </svg>
  `,
  safari: (uid) => `
    <svg viewBox="0 0 24 24" class="h-full w-full">
      <defs>
        <radialGradient id="safari-bg-${uid}" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stop-color="#7DD3FC" />
          <stop offset="55%" stop-color="#0EA5E9" />
          <stop offset="100%" stop-color="#075985" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="12" fill="url(#safari-bg-${uid})" />
      <g stroke="#ffffffb0" stroke-width="0.6">
        <line x1="12" y1="1.6" x2="12" y2="3.4" />
        <line x1="12" y1="20.6" x2="12" y2="22.4" />
        <line x1="1.6" y1="12" x2="3.4" y2="12" />
        <line x1="20.6" y1="12" x2="22.4" y2="12" />
      </g>
      <g transform="rotate(45 12 12)">
        <polygon points="12,5 14,12 12,12" fill="#fff" />
        <polygon points="12,19 10,12 12,12" fill="#ef4444" />
      </g>
    </svg>
  `,
  firefox: (uid) => `
    <svg viewBox="0 0 24 24" class="h-full w-full">
      <defs>
        <radialGradient id="ff-bg-${uid}" cx="32%" cy="28%" r="85%">
          <stop offset="0%" stop-color="#FFDE55" />
          <stop offset="45%" stop-color="#FF9500" />
          <stop offset="100%" stop-color="#E2003C" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="12" fill="url(#ff-bg-${uid})" />
      <path d="M7.5 8c2-3.4 7.2-3 8.3 1 1 3.6-1.2 6.6-4.6 7.4-4 .9-7-2.4-6-5.6.6-1.8 1.6-2.4 2.3-2.8Z" fill="#ffffff2e" />
    </svg>
  `,
  brave: (uid) => `
    <svg viewBox="0 0 24 24" class="h-full w-full">
      <path d="M12 1.4 19.2 4v7.1c0 6-3.3 9.4-7.2 11.5C8.1 20.5 4.8 17.1 4.8 11.1V4Z" fill="#FB542B" />
      <path d="M12 1.4 19.2 4v7.1c0 6-3.3 9.4-7.2 11.5Z" fill="#FF8B4D" opacity="0.55" />
      <path d="M8.3 9.6 12 8l3.7 1.6-1 5.1L12 16.6l-2.7-1.9Z" fill="#fff" opacity="0.95" />
    </svg>
  `,
  edge: (uid) => `
    <svg viewBox="0 0 24 24" class="h-full w-full">
      <defs>
        <linearGradient id="edge-bg-${uid}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#00B4E6" />
          <stop offset="50%" stop-color="#0067C0" />
          <stop offset="100%" stop-color="#0D3D8A" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="12" fill="url(#edge-bg-${uid})" />
      <path d="M4 13.2c1.8 5 8 6.8 12 3.7-4 1-8-1-9-5-.9-3 1.1-6 4-6 2 0 3 1.1 3 3 0 1-.6 2-1.6 2 1.6 1 3.6 0 3.6-2.1 0-4-3.6-6.6-7.7-5C4.6 5.4 2 9 4 13.2Z" fill="#ffffffe6" />
    </svg>
  `,
}

let logoUidCounter = 0
export function browserLogoHTML(browserId, context = 'x') {
  const build = BRAND_LOGOS[browserId]
  if (!build) return ''
  return build(`${context}-${logoUidCounter++}`)
}
