// src/hooks/useSocket.js
import { useEffect } from 'react'
import { getSocket } from '@/lib/socket'
import { useNotificationStore } from '@/store/notificationStore'
import toast from 'react-hot-toast'

export const useSocket = () => {
  const { addNotification, fetchUnreadCount } = useNotificationStore()

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handleNewNotification = (data) => {
      // Normalize the socket payload into a well-formed notification so the list
      // renders correctly (server emits notificationId, not _id). The populated
      // version replaces this optimistic item on the next fetch.
      addNotification({
        _id: data.notificationId || data._id || `tmp-${Date.now()}`,
        type: data.type,
        message: data.message,
        appointmentId: data.appointmentId,
        isRead: false,
        createdAt: new Date().toISOString(),
      })
      toast(data.message || 'New notification', {
        duration: 4000,
      })
    }

    const handleAppointmentUpdate = (data) => {
      toast.success(data.message || 'Appointment updated')
      fetchUnreadCount()
    }

    socket.on('notification:new', handleNewNotification)
    socket.on('appointment:statusUpdated', handleAppointmentUpdate)
    socket.on('appointment:rescheduled', handleAppointmentUpdate)
    socket.on('appointment:cancelled', handleAppointmentUpdate)

    return () => {
      socket.off('notification:new', handleNewNotification)
      socket.off('appointment:statusUpdated', handleAppointmentUpdate)
      socket.off('appointment:rescheduled', handleAppointmentUpdate)
      socket.off('appointment:cancelled', handleAppointmentUpdate)
    }
  }, [addNotification, fetchUnreadCount])
}