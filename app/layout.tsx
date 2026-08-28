import type { Metadata } from 'next'
import { Inter, Fraunces, JetBrains_Mono } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

// The three faces the mockups load from Google Fonts: Fraunces for display
// headings, Inter for UI text, JetBrains Mono for figures and metadata.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-fraunces',
  display: 'swap',
})
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'LP Workspace',
  description: 'Living Plus — clinician workspace',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <body>
        {children}
        {/* Global scripts for the Google Drive transcript-import feature
            (components/ImportFromDrive.tsx) — Picker needs gapi, and the
            OAuth token popup needs Google Identity Services. Both must be
            on window before that component's ready-poll can succeed. */}
        <Script src="https://apis.google.com/js/api.js" strategy="afterInteractive" />
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      </body>
    </html>
  )
}
