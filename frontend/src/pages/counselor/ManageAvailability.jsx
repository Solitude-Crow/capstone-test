// src/pages/counselor/ManageAvailability.jsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  addDays, startOfWeek, format, isBefore, isToday,
  isSaturday, isSunday, addWeeks, subWeeks,
} from 'date-fns'
import {
  ChevronLeft, ChevronRight, Plus, Trash2, Save,
  AlertCircle, CheckCircle2, Loader2, CalendarDays, Zap, Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { availabilityAPI } from '@/api'
import { useAuthStore } from '@/store/authStore'
import { formatTime } from '@/lib/utils'
import { getHolidayName } from '@/lib/phHolidays'
import PageBanner     from '@/components/ui/PageBanner'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

/* ── Helpers ──────────────────────────────────────────────────── */
function getWeekDays(weekStart) {
  return Array.from({ length: 5 }, (_, i) => addDays(weekStart, i))
}

const EMPTY_SLOT = { startTime: '08:00', endTime: '09:00' }

/* 30-min intervals 06:00–20:00 */
const TIME_OPTIONS = Array.from({ length: 29 }, (_, i) => {
  const totalMinutes = 6 * 60 + i * 30
  const h = String(Math.floor(totalMinutes / 60)).padStart(2, '0')
  const m = String(totalMinutes % 60).padStart(2, '0')
  return `${h}:${m}`
})

/* Common slot presets */
const SLOT_PRESETS = [
  { label: 'Morning (8 AM – 12 PM)',   slots: ['08:00','09:00','09:00','10:00','10:00','11:00','11:00','12:00'] },
  { label: 'Afternoon (1 PM – 5 PM)',  slots: ['13:00','14:00','14:00','15:00','15:00','16:00','16:00','17:00'] },
  { label: 'Full Day (8 AM – 5 PM)',   slots: ['08:00','09:00','09:00','10:00','10:00','11:00','11:00','12:00','13:00','14:00','14:00','15:00','15:00','16:00','16:00','17:00'] },
]

function buildPresetSlots(slots) {
  const result = []
  for (let i = 0; i < slots.length; i += 2) {
    result.push({ startTime: slots[i], endTime: slots[i + 1] })
  }
  return result
}

/* Session-length options for the bulk generator (1–3 hour sessions) */
const DURATION_OPTIONS = [
  { label: '1 hr',   minutes: 60  },
  { label: '1.5 hr', minutes: 90  },
  { label: '2 hr',   minutes: 120 },
  { label: '2.5 hr', minutes: 150 },
  { label: '3 hr',   minutes: 180 },
]

const toMinutes = (t) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
const toHHMM = (mins) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`

/* Split a [start,end] window into back-to-back sessions of `duration` minutes */
function buildSessionSlots(start, end, duration) {
  const startM = toMinutes(start)
  const endM   = toMinutes(end)
  const out = []
  for (let s = startM; s + duration <= endM; s += duration) {
    out.push({ startTime: toHHMM(s), endTime: toHHMM(s + duration) })
  }
  return out
}

/* A day is editable only if it's not past, not a weekend, and not a PH holiday */
function isEditableDay(date) {
  if (isSaturday(date) || isSunday(date)) return false
  if (isBefore(date, new Date()) && !isToday(date)) return false
  if (getHolidayName(date)) return false
  return true
}

/* Compare two slot arrays ignoring order */
function slotsEqual(a = [], b = []) {
  if (a.length !== b.length) return false
  const norm = (arr) => arr.map((s) => `${s.startTime}-${s.endTime}`).sort().join(',')
  return norm(a) === norm(b)
}

/* ══════════════════════════════════════════════════════════════
   SlotRow
   ══════════════════════════════════════════════════════════════ */
function SlotRow({ slot, index, onUpdate, onRemove, isBooked }) {
  return (
    <div className="flex items-center gap-2 w-full">
      <select
        value={slot.startTime}
        onChange={(e) => onUpdate(index, 'startTime', e.target.value)}
        disabled={isBooked}
        className="select select-bordered flex-1 min-w-[110px] bg-white font-medium text-sm"
      >
        {TIME_OPTIONS.map((t) => (
          <option key={t} value={t}>{formatTime(t)}</option>
        ))}
      </select>

      <span className="text-slate-400 font-semibold shrink-0 select-none px-0.5">–</span>

      <select
        value={slot.endTime}
        onChange={(e) => onUpdate(index, 'endTime', e.target.value)}
        disabled={isBooked}
        className="select select-bordered flex-1 min-w-[110px] bg-white font-medium text-sm"
      >
        {TIME_OPTIONS.map((t) => (
          <option key={t} value={t}>{formatTime(t)}</option>
        ))}
      </select>

      {!isBooked && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="btn btn-ghost btn-sm text-error hover:bg-error/10 px-2 shrink-0"
          title="Remove slot"
        >
          <Trash2 size={15} />
        </button>
      )}

      {isBooked && (
        <span className="badge badge-soft badge-info shrink-0 whitespace-nowrap">Booked</span>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   SlotEditor
   ══════════════════════════════════════════════════════════════ */
function SlotEditor({ date, slots, bookedSlots, onChange, onSave, saving }) {
  const isPast    = isBefore(date, new Date()) && !isToday(date)
  const isWeekend = isSaturday(date) || isSunday(date)
  const holiday   = getHolidayName(date)

  const addSlot    = () => onChange([...slots, { ...EMPTY_SLOT }])
  const removeSlot = (i) => onChange(slots.filter((_, idx) => idx !== i))
  const updateSlot = (i, field, val) =>
    onChange(slots.map((s, idx) => (idx === i ? { ...s, [field]: val } : s)))

  const handleSave = () => {
    for (const s of slots) {
      if (s.startTime >= s.endTime) {
        toast.error('End time must be after start time for all slots.')
        return
      }
    }
    onSave(date, slots)
  }

  if (isPast || isWeekend || holiday) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center gap-3 py-12 text-center ${holiday ? 'text-red-400' : 'text-slate-300'}`}>
        <CalendarDays size={36} strokeWidth={1} />
        <span className="text-sm font-medium px-3">
          {holiday ? holiday : isWeekend ? 'Weekend — no slots' : 'Past date'}
        </span>
        {holiday && (
          <span className="text-xs text-red-400/80 px-4">Philippine holiday — office closed</span>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 gap-4">
      {slots.length === 0 && bookedSlots.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-base-300 py-10 text-slate-300">
          <CalendarDays size={28} strokeWidth={1} />
          <span className="text-xs font-medium text-center px-4">
            No slots yet. Click <strong>+ Add Slot</strong> to begin.
          </span>
        </div>
      )}

      {slots.length > 0 && (
        <div className="space-y-3">
          {slots.map((slot, i) => (
            <SlotRow
              key={i}
              slot={slot}
              index={i}
              onUpdate={updateSlot}
              onRemove={removeSlot}
              isBooked={false}
            />
          ))}
        </div>
      )}

      {bookedSlots.length > 0 && (
        <div className="space-y-3 pt-3 border-t border-base-200">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Booked</p>
          {bookedSlots.map((s, i) => (
            <SlotRow
              key={`booked-${i}`}
              slot={s}
              index={i}
              onUpdate={() => {}}
              onRemove={() => {}}
              isBooked
            />
          ))}
        </div>
      )}

      <div className="flex-1" />

      <div className="flex flex-col gap-3 pt-2">
        <button
          type="button"
          onClick={addSlot}
          className="btn btn-outline btn-primary w-full gap-2"
        >
          <Plus size={16} /> Add Slot
        </button>
        {slots.length > 0 && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary w-full gap-2"
          >
            {saving
              ? <Loader2 size={15} className="animate-spin shrink-0" />
              : <Save size={15} className="shrink-0" />}
            Save Changes
          </button>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   BulkSlotAdder — replaces the date picker card
   ══════════════════════════════════════════════════════════════ */
function BulkSlotAdder({ weekDays, editSlots, availMap, onApply }) {
  const [selectedDays, setSelectedDays] = useState([])
  const [bulkSlots, setBulkSlots]       = useState([{ startTime: '08:00', endTime: '09:00' }])
  const [activePreset, setActivePreset] = useState(null)

  // Session generator (1–3 hour sessions)
  const [genDuration, setGenDuration] = useState(60)
  const [genStart, setGenStart]       = useState('08:00')
  const [genEnd, setGenEnd]           = useState('17:00')

  const availableDays = weekDays.filter(isEditableDay)

  const toggleDay = (key) =>
    setSelectedDays((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )

  const selectAll = () => setSelectedDays(availableDays.map((d) => format(d, 'yyyy-MM-dd')))
  const clearAll  = () => setSelectedDays([])

  const applyPreset = (preset, idx) => {
    setActivePreset(idx)
    setBulkSlots(buildPresetSlots(preset.slots))
  }

  const generateSessions = () => {
    if (genStart >= genEnd) return toast.error('End time must be after start time.')
    const generated = buildSessionSlots(genStart, genEnd, genDuration)
    if (generated.length === 0)
      return toast.error('That time range is too short for the selected session length.')
    setBulkSlots(generated)
    setActivePreset(null)
  }

  const addBulkSlot    = () => setBulkSlots((p) => [...p, { ...EMPTY_SLOT }])
  const removeBulkSlot = (i) => setBulkSlots((p) => p.filter((_, idx) => idx !== i))
  const updateBulkSlot = (i, field, val) =>
    setBulkSlots((p) => p.map((s, idx) => (idx === i ? { ...s, [field]: val } : s)))

  const handleApply = () => {
    if (selectedDays.length === 0) return toast.error('Select at least one day.')
    for (const s of bulkSlots) {
      if (s.startTime >= s.endTime) {
        toast.error('End time must be after start time.')
        return
      }
    }
    onApply(selectedDays, bulkSlots)
    setSelectedDays([])
    setActivePreset(null)
  }

  return (
    <div className="mkd-card space-y-5">
      <h2 className="font-display text-base text-base-content flex items-center gap-2">
        <Zap size={16} className="text-primary" /> Quick Fill
      </h2>

      {/* Preset buttons */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Presets</p>
        <div className="flex flex-wrap gap-2">
          {SLOT_PRESETS.map((preset, i) => (
            <button
              key={i}
              type="button"
              onClick={() => applyPreset(preset, i)}
              className={`btn btn-sm ${activePreset === i ? 'btn-primary' : 'btn-outline'}`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Session generator — build 1–3 hour sessions across a time range */}
      <div className="rounded-xl border border-base-200 bg-base-50 p-3 space-y-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
          <Clock size={12} className="text-primary" /> Session Generator
        </p>

        <div>
          <p className="text-[11px] font-medium text-slate-500 mb-1.5">Session length</p>
          <div className="flex flex-wrap gap-2">
            {DURATION_OPTIONS.map((d) => (
              <button
                key={d.minutes}
                type="button"
                onClick={() => setGenDuration(d.minutes)}
                className={`btn btn-xs ${genDuration === d.minutes ? 'btn-primary' : 'btn-outline'}`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0">
            <label className="text-[11px] font-medium text-slate-500 block mb-1">From</label>
            <select
              value={genStart}
              onChange={(e) => setGenStart(e.target.value)}
              className="select select-bordered select-sm w-full bg-white text-sm"
            >
              {TIME_OPTIONS.map((t) => <option key={t} value={t}>{formatTime(t)}</option>)}
            </select>
          </div>
          <span className="text-slate-400 font-semibold pb-2 shrink-0">–</span>
          <div className="flex-1 min-w-0">
            <label className="text-[11px] font-medium text-slate-500 block mb-1">To</label>
            <select
              value={genEnd}
              onChange={(e) => setGenEnd(e.target.value)}
              className="select select-bordered select-sm w-full bg-white text-sm"
            >
              {TIME_OPTIONS.map((t) => <option key={t} value={t}>{formatTime(t)}</option>)}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={generateSessions}
          className="btn btn-outline btn-primary btn-sm w-full gap-1.5"
        >
          <Zap size={13} /> Generate {DURATION_OPTIONS.find((d) => d.minutes === genDuration)?.label} sessions
        </button>
        <p className="text-[11px] text-slate-400">
          Fills the slots below with back-to-back sessions. Tweak or remove any before applying.
        </p>
      </div>

      {/* Custom slots */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Slots to Add</p>
        <div className="space-y-2">
          {bulkSlots.map((slot, i) => (
            <SlotRow
              key={i}
              slot={slot}
              index={i}
              onUpdate={updateBulkSlot}
              onRemove={removeBulkSlot}
              isBooked={false}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={addBulkSlot}
          className="btn btn-ghost btn-xs gap-1 text-primary mt-2"
        >
          <Plus size={12} /> Add another slot
        </button>
      </div>

      {/* Day selector */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Apply to Days</p>
          <div className="flex gap-2">
            <button type="button" onClick={selectAll} className="btn btn-ghost btn-xs text-primary">All</button>
            <button type="button" onClick={clearAll}  className="btn btn-ghost btn-xs text-slate-400">None</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableDays.map((day) => {
            const key      = format(day, 'yyyy-MM-dd')
            const isActive = selectedDays.includes(key)
            const hasSlots = (editSlots[key]?.length ?? 0) + (availMap[key]?.availableSlots?.filter((s) => s.isBooked).length ?? 0) > 0
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleDay(key)}
                className={`btn btn-sm gap-1.5 ${isActive ? 'btn-primary' : 'btn-outline'}`}
              >
                {format(day, 'EEE d')}
                {hasSlots && (
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white/70' : 'bg-success'}`} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={handleApply}
        disabled={selectedDays.length === 0 || bulkSlots.length === 0}
        className="btn btn-primary w-full gap-2"
      >
        <Zap size={15} /> Apply to {selectedDays.length > 0 ? `${selectedDays.length} day${selectedDays.length > 1 ? 's' : ''}` : 'Selected Days'}
      </button>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Main page
   ══════════════════════════════════════════════════════════════ */
export default function ManageAvailability() {
  const { user } = useAuthStore()

  const [weekStart, setWeekStart]       = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [availMap, setAvailMap]         = useState({})
  const [editSlots, setEditSlots]       = useState({})
  const [saving, setSaving]             = useState({})
  const [savingAll, setSavingAll]       = useState(false)
  const [loading, setLoading]           = useState(false)

  const weekDays = getWeekDays(weekStart)

  /* ── Fetch week ── */
  const fetchWeek = useCallback(async () => {
    if (!user?._id) return
    setLoading(true)
    try {
      const { data } = await availabilityAPI.get({
        counselorId: user._id,
        startDate:   format(weekDays[0], 'yyyy-MM-dd'),
        endDate:     format(weekDays[4], 'yyyy-MM-dd'),
      })
      const map  = {}
      const edit = {}
      data.forEach((avail) => {
        const key = format(new Date(avail.date), 'yyyy-MM-dd')
        map[key]  = avail
        edit[key] = avail.availableSlots
          .filter((s) => !s.isBooked)
          .map((s) => ({ startTime: s.startTime, endTime: s.endTime }))
      })
      setAvailMap(map)
      setEditSlots(edit)
    } catch {
      toast.error('Failed to load availability')
    } finally {
      setLoading(false)
    }
  }, [user?._id, weekStart]) // eslint-disable-line

  useEffect(() => { fetchWeek() }, [fetchWeek])

  const prevWeek = () => setWeekStart((w) => subWeeks(w, 1))
  const nextWeek = () => setWeekStart((w) => addWeeks(w, 1))
  const goToday  = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))

  const handleSlotsChange = (date, slots) => {
    const key = format(date, 'yyyy-MM-dd')
    setEditSlots((prev) => ({ ...prev, [key]: slots }))
  }

  /* Persist ONE day, then update only THAT day's local state from the server
     response. Previously handleSave called fetchWeek(), which rebuilt the whole
     week's editSlots from the DB and wiped unsaved edits on every other card —
     that's why only a single card seemed to save. */
  const persistDay = async (key, slots) => {
    const bookedSlots = availMap[key]?.availableSlots?.filter((s) => s.isBooked) ?? []
    const cleaned     = slots.map((s) => ({ startTime: s.startTime, endTime: s.endTime }))
    const allSlots    = [...cleaned, ...bookedSlots]

    if (allSlots.length === 0) {
      if (availMap[key]?._id) await availabilityAPI.delete(availMap[key]._id)
      setAvailMap((p)   => { const n = { ...p }; delete n[key]; return n })
      setEditSlots((p)  => { const n = { ...p }; delete n[key]; return n })
      return 'removed'
    }

    const { data: saved } = await availabilityAPI.set({ date: key, availableSlots: allSlots })
    setAvailMap((p) => ({ ...p, [key]: saved }))
    setEditSlots((p) => ({
      ...p,
      [key]: saved.availableSlots
        .filter((s) => !s.isBooked)
        .map((s) => ({ startTime: s.startTime, endTime: s.endTime })),
    }))
    return 'saved'
  }

  const handleSave = async (date, slots) => {
    const key = format(date, 'yyyy-MM-dd')
    setSaving((p) => ({ ...p, [key]: true }))
    try {
      const result = await persistDay(key, slots)
      toast.success(
        result === 'removed'
          ? 'Availability removed for ' + format(date, 'MMM d')
          : 'Schedule saved for ' + format(date, 'MMM d'),
      )
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed')
    } finally {
      setSaving((p) => { const n = { ...p }; delete n[key]; return n })
    }
  }

  /* Editable days whose slots differ from what's saved on the server */
  const dirtyKeys = useMemo(() =>
    weekDays
      .filter(isEditableDay)
      .map((d) => format(d, 'yyyy-MM-dd'))
      .filter((key) => {
        const edited = editSlots[key] ?? []
        const savedUnbooked = (availMap[key]?.availableSlots ?? [])
          .filter((s) => !s.isBooked)
          .map((s) => ({ startTime: s.startTime, endTime: s.endTime }))
        return !slotsEqual(edited, savedUnbooked)
      }),
    [weekDays, editSlots, availMap],
  )

  const handleSaveAll = async () => {
    if (dirtyKeys.length === 0) { toast('No changes to save.'); return }
    setSavingAll(true)
    setSaving((p) => { const n = { ...p }; dirtyKeys.forEach((k) => { n[k] = true }); return n })
    let ok = 0, fail = 0
    for (const key of dirtyKeys) {
      try { await persistDay(key, editSlots[key] ?? []); ok++ }
      catch { fail++ }
    }
    setSaving((p) => { const n = { ...p }; dirtyKeys.forEach((k) => delete n[k]); return n })
    setSavingAll(false)
    if (fail === 0) toast.success(`Saved ${ok} day${ok !== 1 ? 's' : ''}`)
    else toast.error(`Saved ${ok}, ${fail} failed — please retry.`)
  }

  const handleDeleteDay = async (date) => {
    const key   = format(date, 'yyyy-MM-dd')
    const avail = availMap[key]
    if (!avail?._id) {
      setEditSlots((p) => { const n = { ...p }; delete n[key]; return n })
      return
    }
    try {
      await availabilityAPI.delete(avail._id)
      setAvailMap((p) => { const n = { ...p }; delete n[key]; return n })
      setEditSlots((p) => { const n = { ...p }; delete n[key]; return n })
      toast.success('Day cleared')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed')
    }
  }

  /* Bulk apply: merge new slots into editSlots for each selected day */
  const handleBulkApply = (dayKeys, slots) => {
    setEditSlots((prev) => {
      const next = { ...prev }
      dayKeys.forEach((key) => {
        // Append to existing editable slots, avoiding exact duplicates
        const existing = prev[key] ?? []
        const merged   = [...existing]
        slots.forEach((s) => {
          const isDupe = merged.some((e) => e.startTime === s.startTime && e.endTime === s.endTime)
          if (!isDupe) merged.push({ ...s })
        })
        next[key] = merged
      })
      return next
    })
    toast.success(`Slots added to ${dayKeys.length} day${dayKeys.length > 1 ? 's' : ''} — click "Save All" to save them.`)
  }

  const weekLabel = `${format(weekDays[0], 'MMM d')} – ${format(weekDays[4], 'MMM d, yyyy')}`

  return (
    <>
      <PageBanner
        title="Manage Availability"
        subtitle="Set your open time slots for student appointments"
      />

      <div className="space-y-6">

        {/* ══ Week nav ══ */}
        <div className="flex items-center gap-3">
          <button onClick={prevWeek} className="btn btn-outline btn-square shrink-0">
            <ChevronLeft size={18} />
          </button>
          <p className="flex-1 text-center font-display text-lg text-base-content">
            {weekLabel}
          </p>
          <button onClick={goToday} className="btn btn-outline hidden sm:flex shrink-0">
            Today
          </button>
          <button onClick={nextWeek} className="btn btn-outline btn-square shrink-0">
            <ChevronRight size={18} />
          </button>
        </div>

        {/* ══ Unsaved-changes bar ══ */}
        {dirtyKeys.length > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
            <p className="text-sm text-base-content">
              <span className="font-semibold">{dirtyKeys.length}</span> day{dirtyKeys.length > 1 ? 's' : ''} with unsaved changes
            </p>
            <button onClick={handleSaveAll} disabled={savingAll} className="btn btn-primary btn-sm gap-2">
              {savingAll ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Save All
            </button>
          </div>
        )}

        {/* ══ Day cards ══ */}
        {loading ? (
          <div className="flex justify-center py-24">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {weekDays.map((day) => {
              const key       = format(day, 'yyyy-MM-dd')
              const avail     = availMap[key]
              const isDay     = isToday(day)
              const isPast    = isBefore(day, new Date()) && !isDay
              const isWeekend = isSaturday(day) || isSunday(day)
              const holiday   = getHolidayName(day)

              const editableSlots = editSlots[key] ?? []
              const bookedSlots   = avail?.availableSlots?.filter((s) => s.isBooked) ?? []

              return (
                <div
                  key={key}
                  className={[
                    'week-day-cell flex flex-col min-h-[500px] min-w-0 overflow-hidden',
                    isDay                              ? 'today'             : '',
                    holiday                            ? 'week-day-holiday'  : '',
                    (isPast || isWeekend) && !holiday  ? 'opacity-50'        : '',
                  ].filter(Boolean).join(' ')}
                >
                  {/* Day header */}
                  <div className="flex items-start justify-between mb-5 pb-4 border-b border-base-200">
                    <div>
                      <p className={`text-xs font-black uppercase tracking-widest mb-1 ${isDay ? 'text-primary' : 'text-slate-400'}`}>
                        {format(day, 'EEEE')}
                      </p>
                      <p className={`text-4xl font-display leading-none ${isDay ? 'text-primary' : 'text-slate-800'}`}>
                        {format(day, 'd')}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">{format(day, 'MMM yyyy')}</p>
                      {holiday && (
                        <p className="text-[11px] font-semibold text-red-500 mt-1.5 leading-tight">{holiday}</p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {holiday && (
                        <span className="badge badge-soft badge-error gap-1 whitespace-nowrap">
                          <AlertCircle size={11} /> Holiday
                        </span>
                      )}
                      {bookedSlots.length > 0 && (
                        <span className="badge badge-soft badge-success gap-1 whitespace-nowrap">
                          <CheckCircle2 size={11} />
                          {bookedSlots.length} booked
                        </span>
                      )}
                      {(editableSlots.length > 0 || bookedSlots.length > 0) && !isPast && !isWeekend && !holiday && (
                        <button
                          onClick={() => handleDeleteDay(day)}
                          className="btn btn-ghost btn-xs text-error hover:bg-error/10 gap-1"
                        >
                          <Trash2 size={12} /> Clear
                        </button>
                      )}
                    </div>
                  </div>

                  <SlotEditor
                    date={day}
                    slots={editableSlots}
                    bookedSlots={bookedSlots}
                    onChange={(s) => handleSlotsChange(day, s)}
                    onSave={handleSave}
                    saving={saving[key] || false}
                  />
                </div>
              )
            })}
          </div>
        )}

        {/* ══ Bottom row: Quick Fill + This Week summary ══ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          <BulkSlotAdder
            weekDays={weekDays}
            editSlots={editSlots}
            availMap={availMap}
            onApply={handleBulkApply}
          />

          <div className="mkd-card">
            <h2 className="font-display text-base text-base-content mb-4">This Week</h2>
            <div className="space-y-4">
              {weekDays.map((day) => {
                const key    = format(day, 'yyyy-MM-dd')
                const avail  = availMap[key]
                const total  = avail?.availableSlots?.length ?? 0
                const booked = avail?.availableSlots?.filter((s) => s.isBooked).length ?? 0
                const open   = total - booked
                return (
                  <div key={key} className="flex items-center gap-4 text-sm">
                    <span className="font-bold text-slate-600 w-10 shrink-0">{format(day, 'EEE')}</span>
                    <span className={`w-16 shrink-0 font-medium ${total > 0 ? 'text-success' : 'text-slate-300'}`}>
                      {format(day, 'MMM d')}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-base-200 overflow-hidden">
                      {total > 0 && (
                        <div
                          className="h-full rounded-full bg-primary/50 transition-all duration-500"
                          style={{ width: `${Math.min((open / 8) * 100, 100)}%` }}
                        />
                      )}
                    </div>
                    {total > 0 ? (
                      <span className="badge badge-soft badge-success shrink-0">
                        {open} open / {total}
                      </span>
                    ) : (
                      <span className="text-slate-300 shrink-0">—</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

        </div>

        {/* Info alert */}
        <div className="alert alert-info">
          <AlertCircle size={16} />
          <span>Use <strong>Save All</strong> to save every changed day at once, or save each card individually. Weekends and Philippine holidays are closed (shown in red). Booked slots cannot be deleted — cancel the appointment first.</span>
        </div>

      </div>
    </>
  )
}