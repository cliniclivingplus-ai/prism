import Link from 'next/link'

interface SectionHeaderProps {
  reportId: string
  title: string
}

export function SectionHeader({ reportId, title }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-[#E2F3D0] mb-8">
      <Link
        href={`/mrx/report/${reportId}`}
        className="flex items-center gap-1.5 text-sm text-[#538A22] hover:text-[#457019] transition font-medium"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to report
      </Link>

      <p className="text-xs font-mono uppercase tracking-widest text-gray-400">
        {title}
      </p>

      {/* Spacer to keep title visually centred */}
      <div style={{ width: 100 }} />
    </div>
  )
}
