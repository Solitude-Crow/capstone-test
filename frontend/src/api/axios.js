// src/api/axios.js
import axios from 'axios'
import toast from 'react-hot-toast'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // send httpOnly JWT cookie automatically
  timeout: 15000,
})

// Response interceptor — handle auth errors globally
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status

    if (status === 401) {
      // Token expired or invalid — redirect to login
      window.location.href = '/login'
    } else if (status === 403) {
      toast.error('Access denied.')
    } else if (status === 429) {
      toast.error('Too many requests. Please slow down.')
    } else if (status >= 500) {
      toast.error('Server error. Please try again later.')
    }

    return Promise.reject(error)
  }
)

export default api