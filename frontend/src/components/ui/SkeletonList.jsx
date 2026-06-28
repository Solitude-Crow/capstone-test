// src/components/ui/SkeletonList.jsx
// Renders N skeleton rows. height is a Tailwind h-* value string.

export default function SkeletonList({ count = 3, height = 'h-16' }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`skeleton rounded-xl w-full ${height}`} />
      ))}
    </div>
  )
}