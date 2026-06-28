// src/hooks/usePresenceSync.js
//
// Mounted once (in AppLayout) for every logged-in user:
//   • subscribes to real-time counselor presence updates;
//   • for counselors, detects 10-minute inactivity and reports idle/active so
//     the server can flip them Away ⇄ Online automatically.
//
// Online/Offline/In Session are driven entirely by the server (socket connect/
// disconnect + appointment sweep); this hook only adds idle detection + the
// live UI subscription.

import { useEffect } from 'react'
import { getSocket } from '@/lib/socket'
import { usePresenceStore } from '@/store/presenceStore'
import { useAuthStore } from '@/store/authStore'

const IDLE_MS = 10 * 60 * 1000 // 10 minutes
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']

export function usePresenceSync() {
  const role = useAuthStore((s) => s.user?.role)
  const fetchPresence = usePresenceStore((s) => s.fetchPresence)
  const handlePresenceUpdate = usePresenceStore((s) => s.handlePresenceUpdate)

  // Live presence updates (all roles).
  useEffect(() => {
    fetchPresence()
    const socket = getSocket()
    if (!socket) return

    const onPresence = (update) => {
      handlePresenceUpdate(update)
      // Keep the current counselor's own badge (sidebar/profile) in sync.
      const me = useAuthStore.getState().user
      if (me && String(update.counselorId) === String(me._id)) {
        useAuthStore.getState().setUser({ ...me, presenceStatus: update.presenceStatus })
      }
    }

    socket.on('counselor:presenceUpdated', onPresence)
    return () => socket.off('counselor:presenceUpdated', onPresence)
  }, [fetchPresence, handlePresenceUpdate])

  // Counselor idle detection → Away after 10 min, Online on resume.
  useEffect(() => {
    if (role !== 'counselor') return
    const socket = getSocket()
    if (!socket) return

    let idle = false
    let timer

    const goIdle = () => {
      idle = true
      socket.emit('presence:idle')
    }
    const onActivity = () => {
      if (idle) {
        idle = false
        socket.emit('presence:active')
      }
      clearTimeout(timer)
      timer = setTimeout(goIdle, IDLE_MS)
    }

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
    onActivity() // start the idle timer

    return () => {
      clearTimeout(timer)
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity))
    }
  }, [role])
}
