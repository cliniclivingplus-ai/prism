// Matches the session detail page's real shape: back link, title + date,
// optional "Generate Dashboard" button, notes card, then the case workspace.
export default function SessionDetailLoading() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="skeleton mb-5 h-[13px] w-[120px]" />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div className="skeleton mb-2 h-[20px] w-[90px]" />
          <div className="skeleton h-[13px] w-[220px]" />
        </div>
        <div className="skeleton h-[38px] w-[170px] rounded-lg" />
      </div>

      <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid #e5e7eb', marginBottom: 16 }}>
        <div className="skeleton mb-2 h-[11px] w-[130px]" />
        <div className="skeleton mb-1.5 h-[13px] w-[95%]" />
        <div className="skeleton h-[13px] w-[80%]" />
      </div>

      <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid #e5e7eb' }}>
        <div className="skeleton mb-3 h-[16px] w-[140px]" />
        <div className="skeleton mb-1.5 h-[13px] w-full" />
        <div className="skeleton mb-1.5 h-[13px] w-full" />
        <div className="skeleton h-[13px] w-[60%]" />
      </div>
    </div>
  )
}
