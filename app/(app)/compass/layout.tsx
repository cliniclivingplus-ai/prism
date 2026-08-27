import Link from 'next/link'

const navLinkStyle = { fontSize: 13.5, fontWeight: 600, color: '#2F5214', textDecoration: 'none', padding: '8px 14px', borderRadius: 8 }

// LP Compass's own sub-navigation — moved out of the global CDB header so
// it only appears once you're actually inside this tool, not on the hub
// or (eventually) any other tool.
export default function CompassLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 24, flexWrap: 'wrap' }}>
        <Link href="/compass/patients" style={navLinkStyle}>Patients</Link>
        <Link href="/compass/coaches" style={navLinkStyle}>Coaches</Link>
        <Link href="/compass/guide-images" style={navLinkStyle}>Picture bank</Link>
        <Link href="/compass/recipe-bank" style={navLinkStyle}>Recipe bank</Link>
      </nav>
      {children}
    </div>
  )
}
