'use client'
import React from 'react'
import { parseRecipeStructuredLines } from '@/lib/recipeText'

export type RecipeRenderColors = {
  accent: string
  text?: string
  accentSoft?: string
  bulletColor?: string
  stepBadgeBg?: string
  stepBadgeColor?: string
}

export function RecipeIngredientsRenderer({
  rawText,
  colors,
  style,
}: {
  rawText: string
  colors: RecipeRenderColors
  style?: { fontSize?: string | number; lineHeight?: number | string; opacity?: number }
}) {
  const items = parseRecipeStructuredLines(rawText)
  const textColor = colors.text ?? 'currentColor'
  const bulletColor = colors.bulletColor ?? colors.accent
  const headerBg = colors.accentSoft || `${colors.accent}1F`

  return (
    <ul style={{ listStyle: 'none', margin: '8px 0 14px', padding: 0, display: 'grid', gap: 7 }}>
      {items.map((item, i) => {
        if (item.type === 'header') {
          return (
            <li key={i} style={{ listStyle: 'none', marginTop: i === 0 ? 4 : 16, marginBottom: 4 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 11px',
                  borderRadius: 6,
                  background: headerBg,
                  color: colors.accent,
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  borderLeft: `3px solid ${colors.accent}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                {item.text}
              </div>
            </li>
          )
        }
        return (
          <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: style?.fontSize ?? 12.5, color: textColor, opacity: style?.opacity ?? 1, lineHeight: style?.lineHeight ?? 1.45 }}>
            <span style={{ flexShrink: 0, width: 4, height: 4, borderRadius: '50%', background: bulletColor, marginTop: 7 }} />
            <span>{item.text}</span>
          </li>
        )
      })}
    </ul>
  )
}

export function RecipeDirectionsRenderer({
  rawText,
  colors,
  style,
}: {
  rawText: string
  colors: RecipeRenderColors
  style?: { fontSize?: string | number; lineHeight?: number | string; opacity?: number }
}) {
  const items = parseRecipeStructuredLines(rawText)
  const textColor = colors.text ?? 'currentColor'
  const badgeBg = colors.stepBadgeBg || colors.accentSoft || `${colors.accent}1F`
  const badgeColor = colors.stepBadgeColor || colors.accent
  const headerBg = colors.accentSoft || `${colors.accent}1F`
  let stepNum = 0

  return (
    <ol style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'grid', gap: 10 }}>
      {items.map((item, i) => {
        if (item.type === 'header') {
          stepNum = 0
          return (
            <li key={i} style={{ listStyle: 'none', marginTop: i === 0 ? 4 : 18, marginBottom: 4 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 11px',
                  borderRadius: 6,
                  background: headerBg,
                  color: colors.accent,
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  borderLeft: `3px solid ${colors.accent}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                {item.text}
              </div>
            </li>
          )
        }
        stepNum++
        return (
          <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: '50%', background: badgeBg, color: badgeColor, fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {stepNum}
            </span>
            <span style={{ fontSize: style?.fontSize ?? 12.5, color: textColor, opacity: style?.opacity ?? 1, lineHeight: style?.lineHeight ?? 1.5, paddingTop: 1 }}>{item.text}</span>
          </li>
        )
      })}
    </ol>
  )
}
