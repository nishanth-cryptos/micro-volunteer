// One SVG icon per skill key in scripts/seed/catalog.json. Used by the
// /onboarding/skills card grid. Icons are simple line + accent illustrations
// — recognisable and consistent, not the bespoke illustrated stickperson
// art from the Figma reference.
//
// Adding a new skill: add a case in skillIconFor() returning a 64x64 SVG.

import type { JSX } from 'react';

interface Props {
  skillKey: string;
  className?: string;
}

export function SkillIcon({ skillKey, className }: Props) {
  const cls = className ?? 'h-12 w-12';
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cls}
      aria-hidden="true"
    >
      {skillIconFor(skillKey)}
    </svg>
  );
}

// Each entry returns the inner contents of a 64x64 SVG. Stroke 2.5,
// rounded line joins, one accent fill per skill family.
function skillIconFor(key: string): JSX.Element {
  switch (key) {
    case 'read-text':
      return (
        <>
          <path
            d="M10 16h18a6 6 0 016 6v28a4 4 0 00-4-4H10V16z"
            stroke="#0f172a"
            strokeWidth={2.5}
            strokeLinejoin="round"
            fill="#dbeafe"
          />
          <path
            d="M54 16H36a6 6 0 00-6 6v28a4 4 0 014-4h20V16z"
            stroke="#0f172a"
            strokeWidth={2.5}
            strokeLinejoin="round"
            fill="#ffffff"
          />
          <path d="M16 26h14M16 32h14M40 26h10M40 32h10" stroke="#2563eb" strokeWidth={2} strokeLinecap="round" />
        </>
      );
    case 'translate-text':
      return (
        <>
          <circle cx={32} cy={32} r={22} stroke="#0f172a" strokeWidth={2.5} fill="#ede9fe" />
          <path d="M10 32h44M32 10c6 6 6 38 0 44M32 10c-6 6-6 38 0 44" stroke="#0f172a" strokeWidth={2} />
          <text x={32} y={40} textAnchor="middle" fontSize={14} fontWeight={700} fill="#7c3aed">A文</text>
        </>
      );
    case 'explain-forms':
      return (
        <>
          <rect x={14} y={10} width={36} height={44} rx={4} stroke="#0f172a" strokeWidth={2.5} fill="#fef9c3" />
          <path d="M22 22h20M22 30h20M22 38h12" stroke="#0f172a" strokeWidth={2} strokeLinecap="round" />
          <circle cx={46} cy={46} r={8} fill="#facc15" stroke="#0f172a" strokeWidth={2} />
          <text x={46} y={50} textAnchor="middle" fontSize={11} fontWeight={700} fill="#0f172a">?</text>
        </>
      );
    case 'fill-forms':
      return (
        <>
          <rect x={10} y={12} width={36} height={40} rx={4} stroke="#0f172a" strokeWidth={2.5} fill="#dcfce7" />
          <path d="M18 22h20M18 30h20M18 38h12" stroke="#0f172a" strokeWidth={2} strokeLinecap="round" />
          <path
            d="M40 44l14-14 4 4-14 14h-4v-4z"
            stroke="#0f172a"
            strokeWidth={2.5}
            strokeLinejoin="round"
            fill="#16a34a"
          />
        </>
      );
    case 'phone-help':
      return (
        <>
          <rect x={20} y={8} width={24} height={48} rx={4} stroke="#0f172a" strokeWidth={2.5} fill="#fee2e2" />
          <circle cx={32} cy={48} r={2} fill="#0f172a" />
          <path d="M26 16h12" stroke="#0f172a" strokeWidth={2} strokeLinecap="round" />
          <text x={32} y={36} textAnchor="middle" fontSize={16} fontWeight={700} fill="#dc2626">?</text>
        </>
      );
    case 'computer-help':
      return (
        <>
          <rect x={8} y={14} width={48} height={30} rx={3} stroke="#0f172a" strokeWidth={2.5} fill="#dbeafe" />
          <rect x={12} y={18} width={40} height={22} fill="#ffffff" />
          <path d="M4 50h56l-4-6H8l-4 6z" stroke="#0f172a" strokeWidth={2.5} fill="#94a3b8" strokeLinejoin="round" />
          <text x={32} y={34} textAnchor="middle" fontSize={14} fontWeight={700} fill="#2563eb">?</text>
        </>
      );
    case 'online-search':
      return (
        <>
          <rect x={6} y={10} width={44} height={32} rx={3} stroke="#0f172a" strokeWidth={2.5} fill="#fef3c7" />
          <rect x={10} y={14} width={36} height={4} rx={2} fill="#fde68a" />
          <circle cx={36} cy={42} r={10} stroke="#0f172a" strokeWidth={2.5} fill="#ffffff" />
          <path d="M44 50l8 8" stroke="#0f172a" strokeWidth={3} strokeLinecap="round" />
        </>
      );
    case 'book-appointment':
      return (
        <>
          <rect x={8} y={12} width={48} height={42} rx={4} stroke="#0f172a" strokeWidth={2.5} fill="#ffe4e6" />
          <path d="M8 22h48" stroke="#0f172a" strokeWidth={2.5} />
          <path d="M18 8v10M46 8v10" stroke="#0f172a" strokeWidth={2.5} strokeLinecap="round" />
          <circle cx={32} cy={38} r={4} fill="#e11d48" />
          <path d="M32 36v6M30 38h4" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" />
        </>
      );
    case 'scan-documents':
      return (
        <>
          <rect x={10} y={10} width={32} height={44} rx={3} stroke="#0f172a" strokeWidth={2.5} fill="#e0e7ff" />
          <path d="M18 20h16M18 28h16M18 36h10" stroke="#0f172a" strokeWidth={2} strokeLinecap="round" />
          <path d="M46 16v32" stroke="#4f46e5" strokeWidth={3} strokeLinecap="round" />
          <path d="M50 16v32" stroke="#4f46e5" strokeWidth={3} strokeLinecap="round" strokeDasharray="3 3" />
        </>
      );
    case 'upload-documents':
      return (
        <>
          <rect x={10} y={14} width={44} height={40} rx={4} stroke="#0f172a" strokeWidth={2.5} fill="#f0fdf4" />
          <path d="M32 12v22" stroke="#16a34a" strokeWidth={3} strokeLinecap="round" />
          <path d="M22 22l10-10 10 10" stroke="#16a34a" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M18 44h28" stroke="#0f172a" strokeWidth={2} strokeLinecap="round" />
        </>
      );
    case 'buy-groceries':
      return (
        <>
          <path
            d="M12 20h40l-4 32a4 4 0 01-4 4H20a4 4 0 01-4-4l-4-32z"
            stroke="#0f172a"
            strokeWidth={2.5}
            fill="#fed7aa"
            strokeLinejoin="round"
          />
          <path d="M22 20v-4a10 10 0 0120 0v4" stroke="#0f172a" strokeWidth={2.5} fill="none" />
          <circle cx={26} cy={36} r={2} fill="#ea580c" />
          <circle cx={38} cy={36} r={2} fill="#ea580c" />
        </>
      );
    case 'fetch-medicine':
      return (
        <>
          <rect x={18} y={8} width={28} height={8} rx={2} stroke="#0f172a" strokeWidth={2.5} fill="#fecaca" />
          <rect x={20} y={16} width={24} height={40} rx={3} stroke="#0f172a" strokeWidth={2.5} fill="#ffffff" />
          <path d="M32 26v18M23 35h18" stroke="#dc2626" strokeWidth={4} strokeLinecap="round" />
        </>
      );
    case 'collect-package':
      return (
        <>
          <path
            d="M10 22l22-12 22 12v22L32 56 10 44V22z"
            stroke="#0f172a"
            strokeWidth={2.5}
            fill="#fde68a"
            strokeLinejoin="round"
          />
          <path d="M10 22l22 12 22-12M32 34v22" stroke="#0f172a" strokeWidth={2.5} />
          <path d="M21 16l22 12" stroke="#0f172a" strokeWidth={2} strokeDasharray="2 3" />
        </>
      );
    case 'drop-items':
      return (
        <>
          <path
            d="M14 26l18-10 18 10v18L32 54 14 44V26z"
            stroke="#0f172a"
            strokeWidth={2.5}
            fill="#bfdbfe"
            strokeLinejoin="round"
          />
          <path d="M32 6v16M26 16l6 6 6-6" stroke="#2563eb" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'pickup-food':
      return (
        <>
          <path
            d="M14 24h36l-4 28a4 4 0 01-4 4H22a4 4 0 01-4-4L14 24z"
            stroke="#0f172a"
            strokeWidth={2.5}
            fill="#fef3c7"
            strokeLinejoin="round"
          />
          <path d="M20 24v-6a6 6 0 0124 0v6" stroke="#0f172a" strokeWidth={2.5} fill="none" />
          <path d="M24 38h16M24 46h12" stroke="#d97706" strokeWidth={2} strokeLinecap="round" />
        </>
      );
    case 'carry-bags':
      return (
        <>
          <circle cx={32} cy={14} r={6} stroke="#0f172a" strokeWidth={2.5} fill="#fce7f3" />
          <path d="M32 20v18M22 28l-6 18M42 28l6 18" stroke="#0f172a" strokeWidth={2.5} strokeLinecap="round" />
          <rect x={10} y={42} width={14} height={14} rx={2} stroke="#0f172a" strokeWidth={2.5} fill="#f9a8d4" />
          <rect x={40} y={42} width={14} height={14} rx={2} stroke="#0f172a" strokeWidth={2.5} fill="#f9a8d4" />
        </>
      );
    case 'local-errand':
      return (
        <>
          <circle cx={32} cy={12} r={6} stroke="#0f172a" strokeWidth={2.5} fill="#bbf7d0" />
          <path
            d="M28 22l-6 18 8 4-4 14M28 22l8 4 6 12 8-4"
            stroke="#0f172a"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      );
    case 'event-setup':
      return (
        <>
          <path d="M8 30h48v6H8z" stroke="#0f172a" strokeWidth={2.5} fill="#fbcfe8" strokeLinejoin="round" />
          <path d="M12 36l4 20M52 36l-4 20M22 36v20M42 36v20" stroke="#0f172a" strokeWidth={2.5} strokeLinecap="round" />
          <path d="M20 30v-6a4 4 0 014-4h16a4 4 0 014 4v6" stroke="#0f172a" strokeWidth={2.5} fill="none" />
        </>
      );
    case 'registration-help':
      return (
        <>
          <rect x={12} y={10} width={32} height={44} rx={3} stroke="#0f172a" strokeWidth={2.5} fill="#dcfce7" />
          <path d="M20 22h16M20 30h16M20 38h10" stroke="#0f172a" strokeWidth={2} strokeLinecap="round" />
          <path d="M40 44l6 6 12-14" stroke="#16a34a" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'guide-visitors':
      return (
        <>
          <path
            d="M32 6c-9 0-16 7-16 16 0 12 16 30 16 30s16-18 16-30c0-9-7-16-16-16z"
            stroke="#0f172a"
            strokeWidth={2.5}
            fill="#fecaca"
            strokeLinejoin="round"
          />
          <circle cx={32} cy={22} r={6} fill="#ffffff" stroke="#0f172a" strokeWidth={2} />
          <path d="M14 58h36" stroke="#0f172a" strokeWidth={2.5} strokeLinecap="round" />
        </>
      );
    case 'queue-support':
      return (
        <>
          <circle cx={14} cy={20} r={5} stroke="#0f172a" strokeWidth={2.5} fill="#c7d2fe" />
          <path d="M14 25v14M9 30h10" stroke="#0f172a" strokeWidth={2.5} strokeLinecap="round" />
          <circle cx={32} cy={20} r={5} stroke="#0f172a" strokeWidth={2.5} fill="#c7d2fe" />
          <path d="M32 25v14M27 30h10" stroke="#0f172a" strokeWidth={2.5} strokeLinecap="round" />
          <circle cx={50} cy={20} r={5} stroke="#0f172a" strokeWidth={2.5} fill="#c7d2fe" />
          <path d="M50 25v14M45 30h10" stroke="#0f172a" strokeWidth={2.5} strokeLinecap="round" />
          <path d="M8 52h48" stroke="#4f46e5" strokeWidth={3} strokeLinecap="round" />
          <path d="M50 48l6 4-6 4" stroke="#4f46e5" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </>
      );
    case 'distribute-materials':
      return (
        <>
          <rect x={20} y={10} width={24} height={18} rx={3} stroke="#0f172a" strokeWidth={2.5} fill="#fed7aa" />
          <path d="M20 18h24" stroke="#0f172a" strokeWidth={2} />
          <path
            d="M14 40c4-4 10-4 14 0l4 4 4-4c4-4 10-4 14 0l4 4-8 12H18l-8-12 4-4z"
            stroke="#0f172a"
            strokeWidth={2.5}
            fill="#fdba74"
            strokeLinejoin="round"
          />
        </>
      );
    case 'donation-sorting':
      return (
        <>
          <rect x={6} y={26} width={22} height={28} rx={2} stroke="#0f172a" strokeWidth={2.5} fill="#bae6fd" />
          <rect x={36} y={26} width={22} height={28} rx={2} stroke="#0f172a" strokeWidth={2.5} fill="#bbf7d0" />
          <path d="M6 32h22M36 32h22" stroke="#0f172a" strokeWidth={2} />
          <path
            d="M32 6v16M26 16l6 6 6-6"
            stroke="#0f172a"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
    case 'food-packing':
      return (
        <>
          <path
            d="M14 18h36v32a4 4 0 01-4 4H18a4 4 0 01-4-4V18z"
            stroke="#0f172a"
            strokeWidth={2.5}
            fill="#fef08a"
            strokeLinejoin="round"
          />
          <path d="M14 18l4-8h28l4 8" stroke="#0f172a" strokeWidth={2.5} fill="#fde047" strokeLinejoin="round" />
          <path d="M26 30h12M22 38h20M26 46h12" stroke="#a16207" strokeWidth={2} strokeLinecap="round" />
        </>
      );
    case 'community-cleanup':
      return (
        <>
          <path
            d="M40 8l8 8-16 16-8-8 16-16z"
            stroke="#0f172a"
            strokeWidth={2.5}
            fill="#86efac"
            strokeLinejoin="round"
          />
          <path
            d="M22 26l-14 14a4 4 0 005.6 5.6L28 32M22 26l16 16"
            stroke="#0f172a"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      );
    default:
      // Fallback for unknown skill keys — generic checklist icon so the
      // page never renders an empty card.
      return (
        <>
          <rect x={14} y={10} width={36} height={44} rx={4} stroke="#0f172a" strokeWidth={2.5} fill="#e5e7eb" />
          <path d="M22 22h20M22 32h20M22 42h12" stroke="#0f172a" strokeWidth={2} strokeLinecap="round" />
        </>
      );
  }
}
