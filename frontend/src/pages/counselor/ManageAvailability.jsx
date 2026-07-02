// src/pages/counselor/ManageAvailability.jsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  addDays, startOfWeek, format, isBefore, isToday,
  isSaturday, isSunday, addWeeks, subWeeks,
} from 'date-fns'
import {
  ChevronLeft, ChevronRight, Plus, Trash2, Save,
  AlertCircle, CheckCircle2, Loader2, CalendarDays, Zap, Clock,
  CalendarRange,
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

/* Common slot presets — none of them cross the lunch break */
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

/* Lunch break — generated schedules must never overlap 12:00 PM–1:00 PM */
const LUNCH_START = 12 * 60
const LUNCH_END   = 13 * 60

/* Split a [start,end] window into back-to-back sessions of `duration` minutes,
   automatically skipping any session that would overlap the lunch break. */
function buildSessionSlots(start, end, duration) {
  const startM = toMinutes(start)
  const endM   = toMinutes(end)
  const out = []
  let s = startM
  while (s + duration <= endM) {
    if (s < LUNCH_END && s + duration > LUNCH_START) {
      s = LUNCH_END
      continue
    }
    out.push({ startTime: toHHMM(s), endTime: toHHMM(s + duration) })
    s += duration
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

/* Two [start,end) intervals overlap iff aStart < bEnd && bStart < aEnd */
const slotsOverlap = (a, b) => a.startTime < b.endTime && b.startTime < a.endTime

/* Indexes of slots that overlap any other slot in the list (for row highlighting) */
function overlappingIndexes(slots = []) {
  const idx = new Set()
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      if (slotsOverlap(slots[i], slots[j])) { idx.add(i); idx.add(j) }
    }
  }
  return idx
}

/* First overlapping pair across a combined list (mirrors the backend check) */
function findOverlap(slots = []) {
  const sorted = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime))
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startTime < sorted[i - 1].endTime) return [sorted[i - 1], sorted[i]]
  }
  return null
}

/* ══════════════════════════════════════════════════════════════
   SlotRow — roomy row with an always-visible delete button
   ══════════════════════════════════════════════════════════════ */
function SlotRow({ slot, index, onUpdate, onRemove, isBooked, isInvalid }) {
  return (
    <div
      className={`flex items-center gap-2 w-full rounded-xl border p-2 transition-colors ${
        isInvalid
          ? 'border-error/60 bg-error/5'
          : 'border-base-200 bg-white hover:border-base-300'
      }`}
    >
      <select
        value={slot.startTime}
        onChange={(e) => onUpdate(index, 'startTime', e.target.value)}
        disabled={isBooked}
        className="select select-bordered flex-1 min-w-0 bg-white font-medium text-sm"
        aria-label="Start time"
      >
        {TIME_OPTIONS.map((t) => (
          <option key={t} value={t}>{formatTime(t)}</option>
        ))}
      </select>

      <span className="text-slate-400 font-semibold shrink-0 select-none">–</span>

      <select
        value={slot.endTime}
        onChange={(e) => onUpdate(index, 'endTime', e.target.value)}
        disabled={isBooked}
        className="select select-bordered flex-1 min-w-0 bg-white font-medium text-sm"
        aria-label="End time"
      >
        {TIME_OPTIONS.map((t) => (
          <option key={t} value={t}>{formatTime(t)}</option>
        ))}
      </select>

      {!isBooked ? (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="btn btn-ghost btn-sm btn-square text-error hover:bg-error/10 shrink-0"
          title="Remove slot"
          aria-label="Remove slot"
        >
          <Trash2 size={16} />
        </button>
      ) : (
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

  // Highlight rows that collide with another editable or booked slot
  const invalidIdx = useMemo(
    () => overlappingIndexes([...slots, ...bookedSlots]),
    [slots, bookedSlots],
  )

  const handleSave = () => {
    for (const s of slots) {
      if (s.startTime >= s.endTime) {
        toast.error('End time must be after start time for all slots.')
        return
      }
    }
    const overlap = findOverlap([...slots, ...bookedSlots])
    if (overlap) {
      const [a, b] = overlap
      toast.error(`Slots overlap: ${formatTime(a.startTime)}–${formatTime(a.endTime)} and ${formatTime(b.startTime)}–${formatTime(b.endTime)}`)
      return
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
              isInvalid={invalidIdx.has(i)}
            />
          ))}
        </div>
      )}

      {invalidIdx.size > 0 && (
        <p className="text-xs text-error flex items-center gap-1.5">
          <AlertCircle size={12} className="shrink-0" /> Highlighted slots overlap — adjust them before saving.
        </p>
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
   Quick Fill — generate slots, preview/edit them, then apply to
   this week (staged) or persist across a date range (bulk).
   ══════════════════════════════════════════════════════════════ */
const WEEKDAY_OPTIONS = [
  { dow: 1, label: 'Mon' },
  { dow: 2, label: 'Tue' },
  { dow: 3, label: 'Wed' },
  { dow: 4, label: 'Thu' },
  { dow: 5, label: 'Fri' },
]

const todayKey = () => format(new Date(), 'yyyy-MM-dd')

/* All editable dates in [start, end] that fall on one of the chosen weekdays */
function computeRangeDates(startStr, endStr, dows) {
  if (!startStr || !endStr || startStr > endStr || dows.length === 0) return []
  const out = []
  let d = new Date(`${startStr}T00:00:00`)
  const end = new Date(`${endStr}T00:00:00`)
  let scanned = 0
  while (d <= end && scanned < 92) {
    if (dows.includes(d.getDay()) && isEditableDay(d)) out.push(format(d, 'yyyy-MM-dd'))
    d = addDays(d, 1)
    scanned++
  }
  return out
}

function BulkSlotAdder({ weekDays, editSlots, availMap, onApply, onRangeSave, rangeSaving }) {
  const [selectedDays, setSelectedDays] = useState([])
  const [bulkSlots, setBulkSlots]       = useState([{ startTime: '08:00', endTime: '09:00' }])
  const [activePreset, setActivePreset] = useState(null)

  // Session generator (1–3 hour sessions)
  const [genDuration, setGenDuration] = useState(60)
  const [genStart, setGenStart]       = useState('08:00')
  const [genEnd, setGenEnd]           = useState('17:00')

  // Apply target: 'week' = stage into the visible week, 'range' = bulk persist
  const [applyMode, setApplyMode]   = useState('week')
  const [rangeStart, setRangeStart] = useState(todayKey())
  const [rangeEnd, setRangeEnd]     = useState(format(addDays(new Date(), 13), 'yyyy-MM-dd'))
  const [rangeDows, setRangeDows]   = useState([1, 2, 3, 4, 5])

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
    toast.success(`Generated ${generated.length} session${generated.length > 1 ? 's' : ''} — lunch (12–1 PM) excluded.`)
  }

  const addBulkSlot    = () => setBulkSlots((p) => [...p, { ...EMPTY_SLOT }])
  const removeBulkSlot = (i) => setBulkSlots((p) => p.filter((_, idx) => idx !== i))
  const updateBulkSlot = (i, field, val) =>
    setBulkSlots((p) => p.map((s, idx) => (idx === i ? { ...s, [field]: val } : s)))

  const invalidIdx = useMemo(() => overlappingIndexes(bulkSlots), [bulkSlots])

  const validateSlots = () => {
    if (bulkSlots.length === 0) { toast.error('Add at least one slot.'); return false }
    for (const s of bulkSlots) {
      if (s.startTime >= s.endTime) { toast.error('End time must be after start time.'); return false }
    }
    if (invalidIdx.size > 0) { toast.error('Remove overlapping slots first.'); return false }
    return true
  }

  const handleApplyWeek = () => {
    if (selectedDays.length === 0) return toast.error('Select at least one day.')
    if (!validateSlots()) return
    onApply(selectedDays, bulkSlots)
    setSelectedDays([])
    setActivePreset(null)
  }

  const targetDates = useMemo(
    () => computeRangeDates(rangeStart, rangeEnd, rangeDows),
    [rangeStart, rangeEnd, rangeDows],
  )

  const toggleDow = (dow) =>
    setRangeDows((prev) =>
      prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow].sort()
    )

  const setRangePreset = (days) => {
    setRangeStart(todayKey())
    setRangeEnd(format(addDays(new Date(), days), 'yyyy-MM-dd'))
  }

  const handleRangeSave = () => {
    if (targetDates.length === 0) return toast.error('No matching dates in the selected range.')
    if (!validateSlots()) return
    onRangeSave(targetDates, bulkSlots)
  }

  return (
    <div className="mkd-card space-y-5">
      <h2 className="font-display text-base text-base-content flex items-center gap-2">
        <Zap size={16} className="text-primary" /> Quick Fill
      </h2>

      {/* Presets + Session Generator sit side-by-side on wide screens so the
          full-width Quick Fill card makes use of the horizontal space. */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-5 lg:items-start space-y-5 lg:space-y-0">
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
          Fills the preview below with back-to-back sessions. The 12:00 PM–1:00 PM lunch
          break is always skipped. Tweak or remove any slot before applying.
        </p>
      </div>
      </div>{/* /Presets + Session Generator grid */}

      {/* Slot preview (editable before anything is applied or saved) */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
          Preview — Slots to Add
        </p>
        <div className="space-y-2">
          {bulkSlots.map((slot, i) => (
            <SlotRow
              key={i}
              slot={slot}
              index={i}
              onUpdate={updateBulkSlot}
              onRemove={removeBulkSlot}
              isBooked={false}
              isInvalid={invalidIdx.has(i)}
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

      {/* Apply-target mode */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Apply To</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            onClick={() => setApplyMode('week')}
            className={`btn btn-sm gap-1.5 ${applyMode === 'week' ? 'btn-primary' : 'btn-outline'}`}
          >
            <CalendarDays size={13} /> This Week
          </button>
          <button
            type="button"
            onClick={() => setApplyMode('range')}
            className={`btn btn-sm gap-1.5 ${applyMode === 'range' ? 'btn-primary' : 'btn-outline'}`}
          >
            <CalendarRange size={13} /> Date Range
          </button>
        </div>

        {applyMode === 'week' ? (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-medium text-slate-500">Days in the visible week</p>
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

            <button
              type="button"
              onClick={handleApplyWeek}
              disabled={selectedDays.length === 0 || bulkSlots.length === 0}
              className="btn btn-primary w-full gap-2 mt-3"
            >
              <Zap size={15} /> Add to {selectedDays.length > 0 ? `${selectedDays.length} day${selectedDays.length > 1 ? 's' : ''}` : 'Selected Days'}
            </button>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Slots are staged in the week view first — review them, then click{' '}
              <strong>Save Changes</strong> to persist.
            </p>
          </>
        ) : (
          <div className="space-y-3">
            {/* Range presets */}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setRangePreset(6)}  className="btn btn-xs btn-outline">Entire Week</button>
              <button type="button" onClick={() => setRangePreset(13)} className="btn btn-xs btn-outline">Next 2 Weeks</button>
              <button type="button" onClick={() => setRangePreset(30)} className="btn btn-xs btn-outline">Next Month</button>
            </div>

            {/* Custom range */}
            <div className="flex items-end gap-2">
              <div className="flex-1 min-w-0">
                <label className="text-[11px] font-medium text-slate-500 block mb-1">From</label>
                <input
                  type="date"
                  value={rangeStart}
                  min={todayKey()}
                  onChange={(e) => setRangeStart(e.target.value)}
                  className="input input-bordered input-sm w-full bg-white text-sm"
                />
              </div>
              <span className="text-slate-400 font-semibold pb-2 shrink-0">–</span>
              <div className="flex-1 min-w-0">
                <label className="text-[11px] font-medium text-slate-500 block mb-1">To</label>
                <input
                  type="date"
                  value={rangeEnd}
                  min={rangeStart}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  className="input input-bordered input-sm w-full bg-white text-sm"
                />
              </div>
            </div>

            {/* Weekday pattern — e.g. "Every Monday" = only Mon selected */}
            <div>
              <p className="text-[11px] font-medium text-slate-500 mb-1.5">
                Repeat on <span className="text-slate-400">(e.g. only Mon = every Monday)</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_OPTIONS.map(({ dow, label }) => (
                  <button
                    key={dow}
                    type="button"
                    onClick={() => toggleDow(dow)}
                    className={`btn btn-xs ${rangeDows.includes(dow) ? 'btn-primary' : 'btn-outline'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target-date preview */}
            <div className="rounded-xl border border-base-200 bg-base-50 p-3">
              <p className="text-[11px] font-medium text-slate-500 mb-1.5">
                {targetDates.length === 0
                  ? 'No matching dates (weekends, holidays and past dates are skipped).'
                  : `${targetDates.length} date${targetDates.length > 1 ? 's' : ''} will receive these slots:`}
              </p>
              {targetDates.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {targetDates.slice(0, 12).map((key) => (
                    <span key={key} className="px-2 py-0.5 rounded-full bg-white border border-base-200 text-[11px] font-medium text-slate-600">
                      {format(new Date(`${key}T00:00:00`), 'EEE, MMM d')}
                    </span>
                  ))}
                  {targetDates.length > 12 && (
                    <span className="px-2 py-0.5 rounded-full bg-white border border-base-200 text-[11px] font-medium text-slate-400">
                      +{targetDates.length - 12} more
                    </span>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleRangeSave}
              disabled={targetDates.length === 0 || bulkSlots.length === 0 || rangeSaving}
              className="btn btn-primary w-full gap-2"
            >
              {rangeSaving
                ? <Loader2 size={15} className="animate-spin shrink-0" />
                : <Save size={15} className="shrink-0" />}
              Save Changes to {targetDates.length || ''} Day{targetDates.length !== 1 ? 's' : ''}
            </button>
            <p className="text-[11px] text-slate-400">
              Bulk mode saves directly to your schedule. Existing slots on those dates are
              kept — new slots that would overlap them are skipped automatically.
            </p>
          </div>
        )}
      </div>
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
  const [rangeSaving, setRangeSaving]   = useState(false)
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
     response. The backend keeps booked slots automatically and replaces the
     unbooked set with what we submit — so we submit ONLY the unbooked edits
     (submitting booked copies makes the server see them as overlapping). */
  const persistDay = async (key, slots) => {
    const bookedSlots = availMap[key]?.availableSlots?.filter((s) => s.isBooked) ?? []
    const cleaned     = slots.map((s) => ({ startTime: s.startTime, endTime: s.endTime }))

    if (cleaned.length === 0 && bookedSlots.length === 0) {
      if (availMap[key]?._id) await availabilityAPI.delete(availMap[key]._id)
      setAvailMap((p)   => { const n = { ...p }; delete n[key]; return n })
      setEditSlots((p)  => { const n = { ...p }; delete n[key]; return n })
      return 'removed'
    }

    const { data: saved } = await availabilityAPI.set({ date: key, availableSlots: cleaned })
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
    // Block the batch when any dirty day still has overlapping slots
    for (const key of dirtyKeys) {
      const booked = availMap[key]?.availableSlots?.filter((s) => s.isBooked) ?? []
      const overlap = findOverlap([...(editSlots[key] ?? []), ...booked])
      if (overlap) {
        toast.error(`${format(new Date(`${key}T00:00:00`), 'MMM d')} has overlapping slots — fix them first.`)
        return
      }
    }
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

  /* Quick Fill (This Week): merge new slots into editSlots for each selected day.
     Nothing is persisted until the counselor clicks "Save Changes". */
  const handleBulkApply = (dayKeys, slots) => {
    setEditSlots((prev) => {
      const next = { ...prev }
      dayKeys.forEach((key) => {
        // Append to existing editable slots, skipping duplicates and overlaps
        const booked   = availMap[key]?.availableSlots?.filter((s) => s.isBooked) ?? []
        const existing = prev[key] ?? []
        const merged   = [...existing]
        slots.forEach((s) => {
          const conflicts = [...merged, ...booked].some((e) => slotsOverlap(s, e))
          if (!conflicts) merged.push({ ...s })
        })
        next[key] = merged
      })
      return next
    })
    toast.success(`Slots staged on ${dayKeys.length} day${dayKeys.length > 1 ? 's' : ''} — click "Save Changes" to persist.`)
  }

  /* Quick Fill (Date Range): persist slots across many dates. Existing slots on
     each date are preserved; new slots that overlap anything are skipped. */
  const handleBulkRangeSave = async (dateKeys, slots) => {
    setRangeSaving(true)
    let saved = 0, upToDate = 0, failed = 0
    try {
      const { data: existingList } = await availabilityAPI.get({
        counselorId: user._id,
        startDate:   dateKeys[0],
        endDate:     dateKeys[dateKeys.length - 1],
      })
      const existingMap = {}
      existingList.forEach((av) => {
        existingMap[format(new Date(av.date), 'yyyy-MM-dd')] = av
      })

      for (const key of dateKeys) {
        const existing = existingMap[key]?.availableSlots ?? []
        const existingUnbooked = existing
          .filter((s) => !s.isBooked)
          .map((s) => ({ startTime: s.startTime, endTime: s.endTime }))
        const booked = existing.filter((s) => s.isBooked)

        const merged = [...existingUnbooked]
        slots.forEach((s) => {
          const conflicts = [...merged, ...booked].some((e) => slotsOverlap(s, e))
          if (!conflicts) merged.push({ startTime: s.startTime, endTime: s.endTime })
        })

        if (slotsEqual(merged, existingUnbooked)) { upToDate++; continue }
        try {
          await availabilityAPI.set({ date: key, availableSlots: merged })
          saved++
        } catch {
          failed++
        }
      }
    } catch {
      toast.error('Failed to load existing schedules for the selected range')
      setRangeSaving(false)
      return
    }
    setRangeSaving(false)
    if (failed > 0) {
      toast.error(`Saved ${saved} day${saved !== 1 ? 's' : ''}, ${failed} failed — please retry.`)
    } else {
      toast.success(
        `Saved ${saved} day${saved !== 1 ? 's' : ''}` +
        (upToDate ? ` (${upToDate} already up to date)` : ''),
      )
    }
    fetchWeek()
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
              Save Changes
            </button>
          </div>
        )}

        {/* ══ Day cards — capped at 3 columns until 2xl so slot rows stay roomy ══ */}
        {loading ? (
          <div className="flex justify-center py-24">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-5">
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

        {/* ══ Quick Fill (full width — the "This Week" summary card was removed to
             give the schedule editor and Quick Fill more horizontal room) ══ */}
        <BulkSlotAdder
          weekDays={weekDays}
          editSlots={editSlots}
          availMap={availMap}
          onApply={handleBulkApply}
          onRangeSave={handleBulkRangeSave}
          rangeSaving={rangeSaving}
        />

        {/* Info alert */}
        <div className="alert alert-info">
          <AlertCircle size={16} />
          <span>
            Use <strong>Save Changes</strong> to save every staged day at once, or save each card
            individually. Quick Fill's <strong>Date Range</strong> mode writes directly to your schedule.
            Weekends and Philippine holidays are closed (shown in red). Booked slots cannot be deleted —
            cancel the appointment first.
          </span>
        </div>

      </div>
    </>
  )
}
