// src/components/ui/Pagination.jsx
// Shared pagination bar: range summary, numbered pages (with ellipsis) and an
// optional items-per-page selector. Works for both client- and server-side
// pagination — the parent owns the state and passes it down.
import { ChevronLeft, ChevronRight } from 'lucide-react'

// Build the visible page list, e.g. [1, '…', 4, 5, 6, '…', 12]
function pageWindow(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const out = [1]
  if (page > 3) out.push('…')
  for (let p = Math.max(2, page - 1); p <= Math.min(pages - 1, page + 1); p++) out.push(p)
  if (page < pages - 2) out.push('…')
  out.push(pages)
  return out
}

export default function Pagination({
  page,
  pages,
  total,
  limit,
  onPageChange,
  onLimitChange,
  limitOptions = [5, 10, 20, 50],
}) {
  if (!total) return null

  const from = (page - 1) * limit + 1
  const to   = Math.min(page * limit, total)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
      <p className="text-xs text-slate-500 order-2 sm:order-1">
        Showing <span className="font-semibold text-slate-700">{from}–{to}</span> of{' '}
        <span className="font-semibold text-slate-700">{total}</span>
      </p>

      <div className="flex items-center gap-1 order-1 sm:order-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="w-8 h-8 rounded-lg flex items-center justify-center border border-surface-200 bg-white text-slate-500 hover:border-primary-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
        </button>

        {pageWindow(page, pages).map((p, i) =>
          p === '…' ? (
            <span key={`e-${i}`} className="w-8 text-center text-xs text-slate-400 select-none">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`min-w-8 h-8 px-1.5 rounded-lg text-xs font-semibold transition-colors ${
                p === page
                  ? 'bg-primary-500 text-white'
                  : 'border border-surface-200 bg-white text-slate-600 hover:border-primary-300'
              }`}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          className="w-8 h-8 rounded-lg flex items-center justify-center border border-surface-200 bg-white text-slate-500 hover:border-primary-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {onLimitChange && (
        <label className="flex items-center gap-1.5 text-xs text-slate-500 order-3">
          Per page
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="px-2 py-1.5 rounded-lg border border-surface-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            {limitOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      )}
    </div>
  )
}
