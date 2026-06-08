// Reusable badge that displays points alongside a custom, Indian-themed inline lotus SVG.
// Governs: memory-bank/systemPatterns.md (UI/UX patterns).
// Key responsibilities:
//   - Inline custom SVG design.
//   - Accessible, CSS-only tooltip using Tailwind.
//   - High-contrast, WCAG AA compliant styling.

interface Props {
  points: number;
  className?: string;
  tooltipClassName?: string;
}

export function KarmaBadge({ points, className = '', tooltipClassName = '' }: Props) {
  return (
    <span
      className={`relative group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900 font-semibold text-sm cursor-default select-none ${className}`}
      aria-label={`${points} karma points`}
    >
      {/* Custom stylized inline Lotus SVG */}
      <svg
        className="h-4 w-4 flex-shrink-0 text-amber-600"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Center petal */}
        <path
          d="M12 3C12 3 15 8 12 14C9 8 12 3 12 3Z"
          fill="currentColor"
          fillOpacity="0.25"
        />
        {/* Side petals */}
        <path d="M12 8C14 7 19 8 19 12C19 16 14 18 12 21" />
        <path d="M12 8C10 7 5 8 5 12C5 16 10 18 12 21" />
        <path d="M12 12C15 12 17 13 18 15" />
        <path d="M12 12C9 12 7 13 6 15" />
      </svg>
      <span>{points}</span>

      {/* Accessible tooltip container (shows on hover/focus) */}
      <span
        role="tooltip"
        className={`absolute bottom-full left-1/2 z-50 mb-2 w-max -translate-x-1/2 scale-95 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-normal text-white shadow-lg opacity-0 pointer-events-none transition-all duration-150 ease-out group-hover:opacity-100 group-hover:scale-100 group-focus-visible:opacity-100 group-focus-visible:scale-100 ${tooltipClassName}`}
      >
        {points} karma points
        {/* Tooltip arrow */}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-neutral-900" />
      </span>
    </span>
  );
}
