// Sized to the patient workspace's overview layout (sidebar + hero header +
// tool grid + activity panel) rather than a generic spinner — this route
// has no loading state today, so a slow loadPatientWorkspace() query just
// looked like a frozen page.
export default function PatientWorkspaceLoading() {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <div
        className="flex w-full flex-shrink-0 flex-col gap-2 px-5 py-6 md:w-[248px]"
        style={{ background: 'var(--paper-raised)', borderRight: '1px solid var(--line-soft)' }}
      >
        <div className="skeleton mb-4 h-9 w-9 rounded-full" />
        <div className="skeleton mb-1 h-[15px] w-[70%]" />
        <div className="skeleton mb-5 h-[11px] w-[40%]" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-9 w-full rounded-[9px]" />
        ))}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-[5] flex h-[58px] flex-shrink-0 items-center justify-between px-7"
          style={{ background: 'var(--paper-raised)', borderBottom: '1px solid var(--line-soft)' }}
        >
          <div className="skeleton h-[13px] w-[220px]" />
          <div className="skeleton h-[12px] w-[90px]" />
        </header>

        <main className="flex-1 px-7 pb-[70px] pt-[26px]" style={{ maxWidth: 1180 }}>
          <div
            className="mb-6 flex flex-wrap justify-between gap-6 rounded-[14px] px-[26px] py-6"
            style={{ background: 'var(--teal-950)' }}
          >
            <div style={{ minWidth: 220 }}>
              <div className="skeleton mb-2.5 h-[18px] w-[130px] rounded-full" style={{ background: 'rgba(255,255,255,.12)' }} />
              <div className="skeleton mb-2 h-[26px] w-[220px]" style={{ background: 'rgba(255,255,255,.14)' }} />
              <div className="skeleton h-[13px] w-[160px]" style={{ background: 'rgba(255,255,255,.1)' }} />
            </div>
            <div className="detail-grid grid gap-x-[34px] gap-y-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ minWidth: 88 }}>
                  <div className="skeleton mb-1.5 h-[10px] w-[60px]" style={{ background: 'rgba(255,255,255,.1)' }} />
                  <div className="skeleton h-[14px] w-[70px]" style={{ background: 'rgba(255,255,255,.16)' }} />
                </div>
              ))}
            </div>
          </div>

          <div className="mb-3.5 mt-[30px] flex items-baseline gap-2.5">
            <div className="skeleton h-[19px] w-[60px]" />
            <div className="h-px flex-1" style={{ background: 'var(--line)' }} />
          </div>

          <div className="tool-grid grid gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col overflow-hidden rounded-[14px]"
                style={{ background: 'var(--paper-raised)', border: '1px solid var(--line-soft)' }}
              >
                <div
                  className="flex items-center justify-between px-[15px] py-3"
                  style={{ background: 'var(--paper)', borderBottom: '1px solid var(--line-soft)' }}
                >
                  <div className="skeleton h-[16px] w-[80px] rounded-[5px]" />
                  <div className="skeleton h-[10px] w-[60px]" />
                </div>
                <div className="flex flex-1 flex-col gap-2.5 p-[15px]">
                  <div className="skeleton h-[15.5px] w-[60%]" />
                  <div className="skeleton h-[11.5px] w-[80%]" />
                  <div className="skeleton h-2 w-full rounded-full" />
                </div>
              </div>
            ))}
          </div>

          <div className="mb-3.5 mt-[30px] flex items-baseline gap-2.5">
            <div className="skeleton h-[19px] w-[130px]" />
            <div className="h-px flex-1" style={{ background: 'var(--line)' }} />
          </div>
          <div
            className="mb-[18px] rounded-[14px] px-6 py-[22px]"
            style={{ background: 'var(--paper-raised)', border: '1px solid var(--line-soft)' }}
          >
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-start gap-2.5 py-2.5" style={{ borderBottom: i < 2 ? '1px solid var(--line-soft)' : 'none' }}>
                <div className="skeleton mt-[5px] h-[7px] w-[7px] flex-shrink-0 rounded-full" />
                <div className="flex-1">
                  <div className="skeleton mb-1.5 h-[12.5px] w-[35%]" />
                  <div className="skeleton h-[11.5px] w-[50%]" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
