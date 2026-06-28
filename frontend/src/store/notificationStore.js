// src/store/notificationStore.js
import { create } from 'zustand'
import { notificationAPI } from '@/api'

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async (params) => {
    set({ isLoading: true })
    try {
      const { data } = await notificationAPI.getAll(params)
      set({ notifications: data.notifications || data, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  fetchUnreadCount: async () => {
    try {
      const { data } = await notificationAPI.getUnreadCount()
      set({ unreadCount: data.count })
    } catch {} // eslint-disable-line no-empty
  },

  markRead: async (id) => {
    try {
      await notificationAPI.markRead(id)
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n._id === id ? { ...n, isRead: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }))
    } catch {} // eslint-disable-line no-empty
  },

  markAllRead: async () => {
    try {
      await notificationAPI.markAllRead()
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount: 0,
      }))
    } catch {} // eslint-disable-line no-empty
  },

  deleteNotification: async (id) => {
    const prev = get().notifications
    set((state) => ({
      notifications: state.notifications.filter((n) => n._id !== id),
    }))
    try {
      await notificationAPI.delete(id)
    } catch {
      set({ notifications: prev }) // rollback
    }
  },

  // Called from socket events
  addNotification: (notif) => {
    set((state) => ({
      notifications: [notif, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }))
  },
}))