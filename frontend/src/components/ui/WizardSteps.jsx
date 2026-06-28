// src/components/ui/WizardSteps.jsx
// Step progress indicator for multi-step forms (GAB.AI design system).
//
//   • active   → navy (#1E3A5F) fill, white icon, outer glow ring — highly visible
//   • complete → green check
//   • upcoming → muted slate
//
// Props:
//   steps   – [{ id, label, icon: LucideIcon }]
//   current – 0-based index of the active step
import { Fragment } from 'react'
import { Check } from 'lucide-react'

export default function WizardSteps({ steps, current }) {
  const total = steps.length
  const pct = total > 0 ? ((current + 1) / total) * 100 : 0

  return (
    <div className="mb-6 sm:mb-8">
      {/* ── Mobile: compact counter + progress bar ── */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-primary-600 uppercase tracking-wide">
            Step {current + 1} of {total}
          </span>
          <span className="text-xs font-semibold text-slate-600 truncate ml-3">
            {steps[current]?.label}
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* ── Desktop: full step rail ── */}
      <div className="hidden sm:flex items-start">
        {steps.map((step, i) => {
          const done   = i < current
          const active = i === current
          const Icon   = step.icon
          return (
            <Fragment key={step.id ?? i}>
              {/* Step node + label */}
              <div className="flex flex-col items-center gap-2 shrink-0">
                <div
                  className={`relative w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${
                    done
                      ? 'bg-brand-success border-brand-success text-white'
                      : active
                      ? 'bg-primary-500 border-primary-500 text-white wizard-glow'
                      : 'bg-white border-slate-200 text-slate-400'
                  }`}
                >
                  {done ? <Check size={18} strokeWidth={3} /> : <Icon size={18} />}
                </div>
                <span
                  className={`text-xs text-center leading-tight max-w-[92px] ${
                    active
                      ? 'font-bold text-primary-600'
                      : done
                      ? 'font-semibold text-brand-success'
                      : 'font-medium text-slate-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector */}
              {i < total - 1 && (
                <div className="flex-1 h-0.5 mt-[21px] mx-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      done ? 'bg-brand-success w-full' : 'w-0'
                    }`}
                  />
                </div>
              )}
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
