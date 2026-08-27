// The exact inline SVGs used by the mockups, kept in one place so the
// sidebar, tool cards and detail headers all draw the same marks.
type P = { size?: number; className?: string }
const base = (size: number) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none' as const,
})

export const IconGrid = ({ size = 17 }: P) => (
  <svg {...base(size)}>
    <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
    <rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
    <rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
    <rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
  </svg>
)

export const IconPatients = ({ size = 17 }: P) => (
  <svg {...base(size)}>
    <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M3.5 19c.8-3.2 3-4.8 5.5-4.8s4.7 1.6 5.5 4.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <circle cx="17.5" cy="9" r="2.3" stroke="currentColor" strokeWidth="1.6" />
    <path d="M15.8 14.4c1.9-.4 3.6.6 4.4 2.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)

export const IconCompass = ({ size = 17 }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
    <path d="M15 9l-2.2 5.2L9 16l2.2-5.2L15 9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
)

export const IconMrx = ({ size = 17 }: P) => (
  <svg {...base(size)}>
    <path d="M8 3c0 3 8 3 8 6s-8 3-8 6 8 3 8 6M16 3c0 3-8 3-8 6s8 3 8 6-8 3-8 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)

export const IconBlood = ({ size = 17 }: P) => (
  <svg {...base(size)}>
    <path d="M12 3s6 7.2 6 11.5A6 6 0 016 14.5C6 10.2 12 3 12 3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
)

export const IconHome = ({ size = 17 }: P) => (
  <svg {...base(size)}>
    <path d="M4 12L12 4l8 8M6 10v9a1 1 0 001 1h3v-6h4v6h3a1 1 0 001-1v-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const IconSearch = ({ size = 15 }: P) => (
  <svg {...base(size)}>
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
    <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)

export const IconSignOut = ({ size = 15 }: P) => (
  <svg {...base(size)}>
    <path d="M15 17l5-5-5-5M20 12H9M12 3H6a2 2 0 00-2 2v14a2 2 0 002 2h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const IconChevron = ({ size = 15 }: P) => (
  <svg {...base(size)}>
    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const IconPlus = ({ size = 14 }: P) => (
  <svg {...base(size)}>
    <path d="M12 5v14m-7-7h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

export const IconCheck = ({ size = 15 }: P) => (
  <svg {...base(size)}>
    <path d="M4 12l5 5L20 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const IconAlert = ({ size = 15 }: P) => (
  <svg {...base(size)}>
    <path d="M12 9v4m0 3h.01M10.3 3.9L2.6 17a1.8 1.8 0 001.6 2.7h15.6a1.8 1.8 0 001.6-2.7L13.7 3.9a1.8 1.8 0 00-3.4 0z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
)

export const IconCalendar = ({ size = 15 }: P) => (
  <svg {...base(size)}>
    <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M4 9.5h16" stroke="currentColor" strokeWidth="1.7" />
  </svg>
)

export const IconArrowOut = ({ size = 12 }: P) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
    <path d="M2.5 9.5L9.5 2.5M9.5 2.5H4.5M9.5 2.5V7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const IconUpload = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const IconLock = ({ size = 13 }: P) => (
  <svg {...base(size)}>
    <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="1.7" />
  </svg>
)
