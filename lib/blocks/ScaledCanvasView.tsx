'use client'

import { useEffect, useRef, useState } from 'react'
import { CANVAS_WIDTH } from './BlockRenderer'

// Scales a fixed-width canvas as a single unit to fit whatever viewport it's
// shown in — the same trick Canva itself uses for shared designs, rather
// than reflowing individual blocks per breakpoint. Real DOM elements
// underneath (e.g. checklist checkboxes) stay genuinely interactive under
// the CSS transform.
//
// Always scales to fill its container's actual width, up or down — every
// template's own content column is wider than CANVAS_WIDTH (720px design
// width vs. 920-1180px depending on the template), and the earlier
// "never scale up" cap left custom blocks visibly narrower than every
// native section around them (e.g. the FAQ card spanning the full column
// while a custom block stopped hundreds of pixels short of its right
// edge) — reported live on a real Onyx roadmap. Scaling up here is safe:
// unlike a raster image, every block is real vector/text content, so it
// stays crisp at any scale, just matching the surrounding column width
// instead of standing out as a fixed, undersized island.
export function ScaledCanvasView({ children, canvasHeight }: { children: React.ReactNode; canvasHeight: number }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setScale(el.clientWidth / CANVAS_WIDTH)
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
