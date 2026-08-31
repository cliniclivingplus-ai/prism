// Sized to match the real dashboard's layout (stat-grid + roster rows)
// rather than a generic centered spinner, so the page doesn't visibly
// jump once real data lands — this route had no loading state at all
// before, so a slow roster query just looked like a frozen page.
export default function DashboardLoading() {
  return (
    <main className="flex-1 px-[30px] pb-[70px] pt-7" style={{ maxWidth: 1240 }}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="skeleton mb-2 h-[27px] w-[220px]" />
          <div className="skeleton h-[15px] w-[280px]" />
        </div>
        <div className="skeleton h-[41px] w-[140px] rounded-[9px]" />
      </div>

      <div className="stat-grid mb-[30px] grid gap-3.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-[14px] px-[18px] py-[17px]"
            style={{ background: 'var(--paper-raised)', border: '1px solid var(--line-soft)' }}
          >
            <div className="flex items-center justify-between">
              <div className="skeleton h-[30px] w-[30px] rounded-lg" />
              <div className="skeleton h-[11px] w-[50px]" />
            </div>
            <div className="skeleton h-[25px] w-[60px]" />
            <div className="skeleton h-[12px] w-[100px]" />
          </div>
        ))}
      </div>

      <div className="mb-3.5 mt-2 flex flex-wrap items-center justify-between gap-2.5">
        <div className="skeleton h-[19px] w-[90px]" />
        <div className="skeleton h-[33px] w-[220px] rounded-[10px]" />
      </div>

      <div
        className="overflow-hidden rounded-[14px]"
        style={{ background: 'var(--paper-raised)', border: '1px solid var(--line-soft)' }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-5 py-3.5"
            style={{ borderBottom: i < 5 ? '1px solid var(--line-soft)' : 'none' }}
          >
            <div className="skeleton h-9 w-9 flex-shrink-0 rounded-full" />
            <div className="flex-1">
              <div className="skeleton mb-1.5 h-[13.5px] w-[45%]" />
              <div className="skeleton h-[11px] w-[25%]" />
            </div>
            <div className="skeleton h-[20px] w-[80px] rounded-full" />
          </div>
        ))}
      </div>
    </main>
  )
}
