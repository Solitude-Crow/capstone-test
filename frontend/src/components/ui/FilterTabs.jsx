// src/components/ui/FilterTabs.jsx
export default function FilterTabs({ tabs, active, onChange }) {
  return (
    <div className="filter-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`filter-tab ${active === tab.value ? 'active' : ''}`}
        >
          {tab.label}
          {tab.count != null && tab.count > 0 && (
            <span className={`ml-1.5 badge-count-sm ${active === tab.value ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'}`}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}