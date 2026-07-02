// src/hooks/useSidebarSwipe.js
//
// Mobile-only touch gesture support for the navigation sidebar:
//   • swipe right from the left screen edge → open the sidebar;
//   • swipe left (anywhere) while it's open → close it.
//
// The hamburger button and overlay keep working independently — this hook is
// purely additive. It is deliberately conservative so it never fights normal
// page scrolling:
//   • only active below the `lg` breakpoint (desktop keeps the fixed sidebar);
//   • an "open" swipe must begin within EDGE px of the left edge;
//   • direction is locked in after a small slop, and vertical drags bail out
//     immediately so they scroll the page instead of moving the sidebar;
//   • listeners are passive (never preventDefault) so scroll performance and
//     browser back-swipe behaviour are untouched.

import { useEffect } from 'react'

const DESKTOP_BP = 1024 // matches Tailwind `lg` — sidebar is static above this
const EDGE       = 32   // px from the left edge where an "open" swipe may start
const THRESHOLD  = 60   // px of horizontal travel needed to trigger open/close
const SLOP       = 12   // px before we commit to a horizontal vs. vertical drag

export function useSidebarSwipe({ isOpen, onOpen, onClose }) {
  useEffect(() => {
    if (typeof window === 'undefined' || !('ontouchstart' in window)) return

    let startX = 0
    let startY = 0
    let tracking = false     // are we watching this gesture at all?
    let decided = false      // have we locked the axis yet?
    let horizontal = false   // is this gesture horizontal?

    const onTouchStart = (e) => {
      if (window.innerWidth >= DESKTOP_BP || e.touches.length !== 1) return
      const t = e.touches[0]
      startX = t.clientX
      startY = t.clientY
      decided = false
      horizontal = false
      // Track a close-swipe whenever the drawer is open, or an open-swipe that
      // begins right at the left edge. Everything else is ignored up-front.
      tracking = isOpen || startX <= EDGE
    }

    const onTouchMove = (e) => {
      if (!tracking) return
      const t = e.touches[0]
      const dx = t.clientX - startX
      const dy = t.clientY - startY

      if (!decided) {
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return
        horizontal = Math.abs(dx) > Math.abs(dy)
        decided = true
        if (!horizontal) { tracking = false; return } // vertical → let it scroll
      }

      if (!isOpen && dx > THRESHOLD) {
        onOpen()
        tracking = false
      } else if (isOpen && dx < -THRESHOLD) {
        onClose()
        tracking = false
      }
    }

    const onTouchEnd = () => {
      tracking = false
      decided = false
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    document.addEventListener('touchcancel', onTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [isOpen, onOpen, onClose])
}
