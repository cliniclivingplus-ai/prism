'use client'

import { useEffect, useRef, useState } from 'react'
import { CANVAS_WIDTH } from './BlockRenderer'

// Scales a fixed-width canvas as a single unit to fit whatever viewport it's
// shown in — the same trick Canva itself uses for shared designs, rather
// than reflowing individual blocks per breakpoint. Never scales UP past the
// canvas's own design size on wide screens, only down on narrower ones.
// Real DOM elements underneath (e.g. checklist checkboxes) stay genuinely
// interactive under the CSS transform.
export function ScaledCanvasView({ children, canvasHeight }: { children: React.ReactNode; canvasHeight: number }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setScale(Math.min(1, el.clientWidth / CANVAS_WIDTH))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} style={{ width: '100%', height: canvasHeight * scale }}>
      <div style={{ width: CANVAS_WIDTH, height: canvasHeight, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        {children}
      </div>
    </div>
  )
}
