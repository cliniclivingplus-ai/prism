'use client'
import { BLOCK_BG_SWATCHES, type BlockLayout } from '@/lib/blocks/types'

const C = { line: '#ECEBE3', accent: '#2563EB' }

// A small fixed palette only — never an arbitrary color value — matching
// this feature's "structured fields only" trust model.
export function ColorSwatchPicker({ value, onChange }: { value?: BlockLayout['bg']; onChange: (bg: BlockLayout['bg'] | undefined) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <button type="button" onClick={() => onChange(undefined)} title="Default"
        style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${!value ? C.accent : C.line}`, background: '#fff', backgroundImage: 'linear-gradient(45deg, #ddd 25%, transparent 25%), linear-gradient(-45deg, #ddd 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ddd 75%), linear-gradient(-45deg, transparent 75%, #ddd 75%)', backgroundSize: '8px 8px', backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0', cursor: 'pointer' }} />
      {BLOCK_BG_SWATCHES.map((swatch) => (
        <button key={swatch} type="button" onClick={() => onChange(swatch)} title={swatch}
          style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${value === swatch ? C.accent : C.line}`, background: swatch, cursor: 'pointer' }} />
      ))}
    </div>
  )
}
