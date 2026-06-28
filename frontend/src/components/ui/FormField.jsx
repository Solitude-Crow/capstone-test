// src/components/ui/FormField.jsx
// Generic form field wrapper: label, required marker, hint text, error message.
// Props: label, required (bool), hint (string), error (string), className
import { AlertCircle } from 'lucide-react'

export default function FormField({ label, required, hint, error, className = '', children }) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          {label}
          {required && <span className="text-brand-error ml-0.5">*</span>}
          {hint && <span className="font-normal text-slate-400 ml-1.5">({hint})</span>}
        </label>
      )}
      {children}
      {error && (
        <p className="mt-1.5 text-xs font-medium text-brand-error flex items-center gap-1">
          <AlertCircle size={13} className="shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}
