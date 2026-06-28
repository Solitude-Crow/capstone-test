// src/components/ui/Modal.jsx
import { useEffect } from 'react'
import { X } from 'lucide-react'

const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' }

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-modal w-full ${widths[size] || widths.md} animate-slide-up`}
        onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-base-200">
            <h3 className="font-display text-xl text-base-content">{title}</h3>
            <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
              <X size={16} />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}