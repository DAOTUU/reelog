export default function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[]
  value: T
  onChange: (next: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = o === value
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`text-meta rounded-md px-2.5 py-1.5 font-medium transition-colors duration-150 ${
              active ? 'bg-ink text-canvas' : 'bg-surface-2 text-ink-2'
            }`}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}
