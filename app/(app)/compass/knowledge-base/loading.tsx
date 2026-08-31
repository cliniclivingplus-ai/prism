// Sized to match KnowledgeBaseClient's library view: header + 5 source-type
// stat tiles + a list of document rows, so the initial kb_documents fetch
// doesn't just show a blank page.
export default function KnowledgeBaseLoading() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div className="skeleton mb-2 h-[24px] w-[220px]" />
          <div className="skeleton h-[14px] w-[300px]" />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="skeleton h-[36px] w-[100px] rounded-lg" />
          <div className="skeleton h-[36px] w-[100px] rounded-lg" />
          <div className="skeleton h-[36px] w-[120px] rounded-lg" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 28 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="skeleton h-8 w-8 rounded-lg" />
            <div>
              <div className="skeleton mb-1 h-[18px] w-[24px]" />
              <div className="skeleton h-[11px] w-[40px]" />
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="skeleton h-9 w-9 rounded-lg" />
            <div style={{ flex: 1 }}>
              <div className="skeleton mb-1.5 h-[14px] w-[45%]" />
              <div className="skeleton h-[12px] w-[30%]" />
            </div>
            <div className="skeleton h-[20px] w-[70px] rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
