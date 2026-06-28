// src/components/ui/Avatar.jsx
import { getInitials } from '@/lib/utils'

const sizes = { xs: 'w-7 h-7 text-xs', sm: 'w-9 h-9 text-xs', md: 'w-11 h-11 text-sm', lg: 'w-16 h-16 text-lg', xl: 'w-20 h-20 text-2xl' }

export default function Avatar({ name = '', src, size = 'md', className = '' }) {
  const s = sizes[size] || sizes.md
  if (src) return <img src={src} alt={name} className={`${s} rounded-full object-cover ring-2 ring-white ${className}`} />
  return (
    <div className={`${s} rounded-full bg-gradient-to-br from-navy-500 to-jade-500 flex items-center justify-center font-bold text-white ring-2 ring-white flex-shrink-0 ${className}`}>
      {getInitials(name)}
    </div>
  )
}