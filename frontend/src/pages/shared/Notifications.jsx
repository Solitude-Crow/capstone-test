// src/pages/shared/Notifications.jsx
import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  Trash2,
  CalendarDays,
  RefreshCw,
  X,
  Clock,
  FileText,
  CheckCircle2,
  XCircle,
  Ban,
  BadgeCheck,
  MessageSquare,
  ClipboardList,
  Eye,
} from "lucide-react";
import { useNotificationStore } from "@/store/notificationStore";
import { useAuthStore } from "@/store/authStore";
import { timeAgo, formatTime } from "@/lib/utils";
import PageBanner from "@/components/ui/PageBanner";
import FilterTabs from "@/components/ui/FilterTabs";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";

/* ── Notification type config — Lucide iconography (no emoji) ──── */
const NOTIF_CONFIG = {
  appointment_created:      { Icon: CalendarDays,  label: "Booked",      color: "text-primary-600", bg: "bg-primary-50"  },
  appointment_accepted:     { Icon: CheckCircle2,  label: "Accepted",    color: "text-emerald-600", bg: "bg-emerald-50"  },
  appointment_rejected:     { Icon: XCircle,       label: "Declined",    color: "text-red-600",     bg: "bg-red-50"      },
  appointment_rescheduled:  { Icon: RefreshCw,     label: "Rescheduled", color: "text-blue-600",    bg: "bg-blue-50"     },
  appointment_cancelled:    { Icon: Ban,           label: "Cancelled",   color: "text-red-600",     bg: "bg-red-50"      },
  appointment_completed:    { Icon: BadgeCheck,    label: "Completed",   color: "text-emerald-600", bg: "bg-emerald-50"  },
  appointment_feedback:     { Icon: MessageSquare, label: "Feedback",    color: "text-amber-600",   bg: "bg-amber-50"    },
  appointment_reminder:     { Icon: Clock,         label: "Reminder",    color: "text-amber-600",   bg: "bg-amber-50"    },
  reschedule_accepted:      { Icon: CheckCircle2,  label: "Reschedule",  color: "text-emerald-600", bg: "bg-emerald-50"  },
  reschedule_rejected:      { Icon: XCircle,       label: "Reschedule",  color: "text-red-600",     bg: "bg-red-50"      },
  pre_assessment_submitted: { Icon: ClipboardList, label: "Assessment",  color: "text-primary-600", bg: "bg-primary-50"  },
  pre_assessment_reviewed:  { Icon: Eye,           label: "Reviewed",    color: "text-blue-600",    bg: "bg-blue-50"     },
};
const DEFAULT_NOTIF = { Icon: Bell, label: "Notification", color: "text-primary-600", bg: "bg-primary-50" };

const TAB_VALUES = ["all", "unread", "read"];

/* ── Detail panel ─────────────────────────────────────────────── */
function NotifDetail({ notif, onClose, onDelete, userRole }) {
  const navigate = useNavigate();
  const config = NOTIF_CONFIG[notif.type] ?? DEFAULT_NOTIF;
  const NotifIcon = config.Icon;
  const appt = notif.appointmentId;

  const handleViewAppointment = () => {
    if (!appt?._id) return;
    navigate(userRole === "counselor" ? "/counselor/appointments" : "/student/appointments");
  };

  return (
    <div className="mkd-card flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-base-200 mb-4">
        <h3 className="font-display text-base text-base-content">Notification Details</h3>
        <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
          <X size={15} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-4 overflow-y-auto">
        {/* Icon + type + time */}
        <div className="flex items-start gap-3">
          <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${config.bg}`}>
            <NotifIcon size={20} className={config.color} />
          </div>
          <div>
            <p className={`text-xs font-bold uppercase tracking-widest ${config.color}`}>
              {config.label}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{timeAgo(notif.createdAt)}</p>
            <p className="text-xs text-gray-400">
              {new Date(notif.createdAt).toLocaleString("en-PH", {
                year: "numeric", month: "long", day: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </p>
          </div>
        </div>

        {/* Message */}
        <div className="bg-base-50 border border-primary/20 rounded-xl p-4">
          <p className="text-sm text-base-content leading-relaxed">{notif.message}</p>
        </div>

        {/* Appointment details */}
        {appt && (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Appointment</p>
            <div className="bg-base-50 border border-base-200 rounded-xl p-4 space-y-2.5 text-sm">
              {appt.type && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 flex items-center gap-1.5"><FileText size={12} /> Type</span>
                  <span className="font-medium text-base-content text-right">{appt.type}</span>
                </div>
              )}
              {appt.date && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 flex items-center gap-1.5"><CalendarDays size={12} /> Date</span>
                  <span className="font-medium text-base-content">
                    {new Date(appt.date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
              )}
              {appt.startTime && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 flex items-center gap-1.5"><Clock size={12} /> Time</span>
                  <span className="font-medium text-base-content">
                    {formatTime(appt.startTime)}{appt.endTime ? ` – ${formatTime(appt.endTime)}` : ""}
                  </span>
                </div>
              )}
              {appt.status && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Status</span>
                  <StatusBadge status={appt.status} />
                </div>
              )}
              {appt.studentId?.fullName && userRole === "counselor" && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Student</span>
                  <span className="font-medium text-base-content">{appt.studentId.fullName}</span>
                </div>
              )}
              {appt.counselorId?.fullName && userRole === "student" && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Counselor</span>
                  <span className="font-medium text-base-content">{appt.counselorId.fullName}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t border-base-200 mt-4">
        <button onClick={() => onDelete(notif._id)} className="btn btn-outline btn-error btn-sm gap-1 flex-1">
          <Trash2 size={13} /> Delete
        </button>
        {appt?._id && (
          <button onClick={handleViewAppointment} className="btn btn-primary btn-sm gap-1 flex-1">
            <CalendarDays size={13} /> View Appointment
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Notification row ─────────────────────────────────────────── */
function NotifRow({ notif, isSelected, onClick, onMarkRead, onDelete }) {
  const config = NOTIF_CONFIG[notif.type] ?? DEFAULT_NOTIF;
  const NotifIcon = config.Icon;
  return (
    <div
      onClick={onClick}
      className={`mkd-card !p-4 sm:!p-5 flex items-start gap-3.5 cursor-pointer transition-all duration-150
        ${isSelected ? "ring-2 ring-primary border-primary/30" : ""}
        ${!notif.isRead ? "bg-primary/5 border-primary/20" : "hover:bg-base-50"}
      `}
    >
      {/* Type icon */}
      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${config.bg}`}>
        <NotifIcon size={16} className={config.color} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${!notif.isRead ? "font-semibold text-base-content" : "text-slate-600"}`}>
          {notif.message}
        </p>
        {notif.appointmentId?.date && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-400">
            <CalendarDays size={11} />
            {notif.appointmentId.type} ·{" "}
            {new Date(notif.appointmentId.date).toLocaleDateString("en-PH", {
              month: "short", day: "numeric", year: "numeric",
            })}
          </div>
        )}
        <p className="text-xs text-gray-400 mt-1.5">{timeAgo(notif.createdAt)}</p>
      </div>

      {/* Right side actions */}
      <div className="flex flex-col items-end gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        {!notif.isRead && <span className="w-2 h-2 rounded-full bg-primary block mt-1" />}
        <div className="flex items-center gap-1 mt-auto">
          {!notif.isRead && (
            <button
              onClick={() => onMarkRead(notif._id)}
              className="btn btn-ghost btn-xs gap-1 text-slate-400 hover:text-primary hover:bg-primary/10 px-2"
              title="Mark as read"
            >
              <CheckCheck size={11} />
              <span className="text-[10px] hidden sm:inline">Read</span>
            </button>
          )}
          <button
            onClick={() => onDelete(notif._id)}
            className="btn btn-ghost btn-xs text-slate-400 hover:text-error hover:bg-error/10 p-1.5"
            title="Delete notification"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Empty right-panel placeholder ───────────────────────────── */
function RightPlaceholder({ unreadCount, onMarkAll }) {
  return (
    <div className="mkd-card p-6 flex flex-col items-center justify-center text-center gap-4 min-h-52">
      <div className="w-14 h-14 rounded-full bg-base-100 border border-base-200 flex items-center justify-center">
        <Bell size={24} className="text-slate-300" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-600">Select a notification</p>
        <p className="text-xs text-slate-400 mt-1">Click any item on the left to see its details</p>
      </div>
      {unreadCount > 0 && (
        <button onClick={onMarkAll} className="btn btn-outline btn-sm gap-1.5">
          <CheckCheck size={13} /> Mark all {unreadCount} as read
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export default function Notifications() {
  const { user } = useAuthStore();
  const { notifications, isLoading, fetchNotifications, markRead, markAllRead, deleteNotification } =
    useNotificationStore();

  const [filter, setFilter] = useState("all");
  const [selectedNotif, setSelectedNotif] = useState(null);

  useEffect(() => {
    fetchNotifications({ limit: 50 });
  }, [fetchNotifications]);

  const handleRefresh = useCallback(() => {
    fetchNotifications({ limit: 50 });
  }, [fetchNotifications]);

  const handleClickNotif = useCallback(
    (notif) => {
      if (!notif.isRead) markRead(notif._id);
      setSelectedNotif(notif);
    },
    [markRead],
  );

  const handleMarkRead = useCallback((id) => markRead(id), [markRead]);

  const handleDelete = useCallback(
    async (id) => {
      if (selectedNotif?._id === id) setSelectedNotif(null);
      await deleteNotification(id);
    },
    [selectedNotif, deleteNotification],
  );

  const handleCloseDetail = useCallback(() => setSelectedNotif(null), []);

  /* ── Counts + tabs ── */
  const counts = useMemo(
    () => ({
      all:    notifications.length,
      unread: notifications.filter((n) => !n.isRead).length,
      read:   notifications.filter((n) => n.isRead).length,
    }),
    [notifications],
  );

  const tabs = useMemo(
    () => TAB_VALUES.map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1), count: counts[v] })),
    [counts],
  );

  const filtered = useMemo(() => {
    if (filter === "unread") return notifications.filter((n) => !n.isRead);
    if (filter === "read")   return notifications.filter((n) => n.isRead);
    return notifications;
  }, [notifications, filter]);

  return (
    <>
      <PageBanner
        title="Notifications"
        subtitle={counts.unread > 0 ? `${counts.unread} unread` : "All caught up!"}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={handleRefresh} className="btn btn-white btn-sm gap-1.5 shadow" disabled={isLoading}>
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> Refresh
            </button>
            {counts.unread > 0 && (
              <button onClick={markAllRead} className="btn btn-white btn-sm gap-1.5 shadow">
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>
        }
      />

      <div className="space-y-4">
        <FilterTabs tabs={tabs} active={filter} onChange={setFilter} />

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={filter === "all" ? "No notifications yet" : `No ${filter} notifications`}
            description={
              filter === "all"
                ? "You'll be notified about appointment updates here."
                : `You have no ${filter} notifications right now.`
            }
            action={
              <button onClick={handleRefresh} className="btn btn-outline btn-sm gap-1">
                <RefreshCw size={13} /> Refresh
              </button>
            }
          />
        ) : (
          /* Always 2-column on large screens */
          <div className="grid gap-4 lg:grid-cols-5">
            {/* Notification list */}
            <div className="space-y-3 lg:col-span-3">
              {filtered.map((notif) => (
                <NotifRow
                  key={notif._id}
                  notif={notif}
                  isSelected={selectedNotif?._id === notif._id}
                  onClick={() => handleClickNotif(notif)}
                  onMarkRead={handleMarkRead}
                  onDelete={handleDelete}
                />
              ))}
            </div>

            {/* Right panel: always visible on large screens */}
            <div className={`lg:col-span-2 ${selectedNotif ? "block" : "hidden lg:block"}`}>
              <div className="lg:sticky lg:top-6">
                {selectedNotif ? (
                  <NotifDetail
                    notif={selectedNotif}
                    onClose={handleCloseDetail}
                    onDelete={handleDelete}
                    userRole={user?.role}
                  />
                ) : (
                  <RightPlaceholder unreadCount={counts.unread} onMarkAll={markAllRead} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
