// src/store/presenceStore.js
import { create } from 'zustand'
import { presenceAPI } from '@/api'

export const usePresenceStore = create((set, get) => ({
  counselors: [],
  isLoading: false,

  fetchPresence: async () => {
    set({ isLoading: true })
    try {
      const { data } = await presenceAPI.getAll()
      set({ counselors: data, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  updateMyStatus: async (status, note = '') => {
    const { data } = await presenceAPI.updateMyStatus({ status, note })
    set((state) => ({
      counselors: state.counselors.map((c) =>
        c._id === data._id ? data : c
      ),
    }))
    return data
  },

  // Called from socket event "counselor:presenceUpdated"
  handlePresenceUpdate: (update) => {
    set((state) => ({
      counselors: state.counselors.map((c) =>
        c._id === update.counselorId || c._id === update.counselorId?._id
          ? {
              ...c,
              presenceStatus:    update.presenceStatus,
              // Preserve an existing note when an automatic update omits it.
              presenceNote:      update.presenceNote !== undefined ? update.presenceNote : c.presenceNote,
              presenceUpdatedAt: update.presenceUpdatedAt,
            }
          : c
      ),
    }))
  },

  getCounselorStatus: (counselorId) => {
    const c = get().counselors.find(
      (c) => c._id === counselorId || c._id === counselorId?.toString()
    )
    return c?.presenceStatus ?? 'offline'
  },
}))