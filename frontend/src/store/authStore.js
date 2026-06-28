// src/store/authStore.js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authAPI } from '@/api'
import { initSocket, disconnectSocket } from '@/lib/socket'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      // Holds the verified Google profile + credential between "Continue with
      // Google" and the Complete Registration step (transient, not persisted).
      pendingGoogle: null,
      // True while the store is rehydrating from localStorage on first load.
      // Guards prevent redirecting to /login during this window.
      isHydrating: true,

      setUser: (user) => set({ user }),

      // After a password change the server issues a fresh JWT (and invalidates
      // all prior tokens). Swap in the new token and reconnect the socket so
      // this device stays authenticated while other devices are logged out.
      refreshToken: (token) => {
        if (!token) return
        set({ token })
        disconnectSocket()
        initSocket(token)
      },

      login: async (credentials) => {
        set({ isLoading: true })
        try {
          const { data } = await authAPI.login(credentials)
          set({ user: data, token: data.token, isLoading: false })
          if (data.token) initSocket(data.token)
          return data
        } catch (err) {
          set({ isLoading: false })
          throw err
        }
      },

      signup: async (userData) => {
        set({ isLoading: true })
        try {
          const { data } = await authAPI.signup(userData)
          set({ user: data, token: data.token, isLoading: false })
          if (data.token) initSocket(data.token)
          return data
        } catch (err) {
          set({ isLoading: false })
          throw err
        }
      },

      // Step 1 of Google auth: verify the credential server-side. Existing user →
      // logged in. New user → stash the credential/profile for Complete Registration.
      googleLogin: async (credential) => {
        set({ isLoading: true })
        try {
          const { data } = await authAPI.googleAuth({ credential })
          if (data.needsRegistration) {
            set({ pendingGoogle: { credential, profile: data.profile }, isLoading: false })
            return { needsRegistration: true }
          }
          set({ user: data, token: data.token, pendingGoogle: null, isLoading: false })
          if (data.token) initSocket(data.token)
          return { needsRegistration: false, user: data }
        } catch (err) {
          set({ isLoading: false })
          throw err
        }
      },

      // Step 2 of Google auth: finalize the account with role + role fields.
      googleRegister: async (form) => {
        set({ isLoading: true })
        try {
          const { credential } = get().pendingGoogle || {}
          const { data } = await authAPI.googleRegister({ credential, ...form })
          set({ user: data, token: data.token, pendingGoogle: null, isLoading: false })
          if (data.token) initSocket(data.token)
          return data
        } catch (err) {
          set({ isLoading: false })
          throw err
        }
      },

      logout: async () => {
        try {
          await authAPI.logout()
        } catch {} // eslint-disable-line no-empty
        disconnectSocket()
        set({ user: null, token: null })
      },

      // Called once on app mount — validates the persisted token with the server
      // and refreshes the full user object. Sets isHydrating: false when done
      // so route guards know it's safe to evaluate auth state.
      fetchMe: async () => {
        try {
          const { data } = await authAPI.getMe()
          set({ user: data, isHydrating: false })
          // Re-establish the socket after a page reload (it otherwise only
          // connects on login) so real-time presence/notifications keep working.
          const t = get().token
          if (t) initSocket(t)
          return data
        } catch {
          // Token was invalid/expired — clear everything
          set({ user: null, token: null, isHydrating: false })
        }
      },

      isAuthenticated: () => !!get().user,
      isStudent:       () => get().user?.role === 'student',
      isCounselor:     () => get().user?.role === 'counselor',
      isFaculty:       () => get().user?.role === 'faculty',
    }),
    {
      name: 'mkd-auth',
      // Persist both token AND user so the app can render immediately on
      // refresh before fetchMe resolves, avoiding a flash-to-login.
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
)