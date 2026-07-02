// src/lib/dynamicFavicon.js
//
// Swaps the favicon to match the OS/browser color scheme:
//   light mode → navy logo   (/gab-logo.svg)
//   dark mode  → white logo  (/gab-logo-white.svg)
// Listens to prefers-color-scheme so the swap happens live, no refresh needed.

const FAVICON_LIGHT = '/gab-logo.svg'       // navy — shown on light UIs
const FAVICON_DARK  = '/gab-logo-white.svg' // white — shown on dark UIs

function applyFavicon(isDark) {
  const link = document.getElementById('app-favicon')
  if (!link) return
  const href = isDark ? FAVICON_DARK : FAVICON_LIGHT
  if (link.getAttribute('href') !== href) link.setAttribute('href', href)
}

export function initDynamicFavicon() {
  if (typeof window.matchMedia !== 'function') return
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  applyFavicon(media.matches)
  // Older Safari only supports addListener
  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', (e) => applyFavicon(e.matches))
  } else if (typeof media.addListener === 'function') {
    media.addListener((e) => applyFavicon(e.matches))
  }
}
