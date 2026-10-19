'use client'

import dynamic from 'next/dynamic'
import type { GuideData } from '@/lib/pdf/ClientGuideDocument'

// Keep dynamic imports in a client boundary so only the chosen layout's
// JavaScript is needed. Server-side dynamic imports do not provide this
// client code splitting in the installed Next.js version.
const DashboardClient = dynamic(() => import('./DashboardClient'))
const layouts = {
  week: dynamic(() => import('./WeekTemplate')),
  'week-aurora': dynamic(() => import('./WeekAuroraTemplate')),
  'week-bloom': dynamic(() => import('./WeekBloomTemplate')),
  'week-brutal': dynamic(() => import('./WeekBrutalTemplate')),
  'week-care': dynamic(() => import('./WeekCareTemplate')),
  'week-earth': dynamic(() => import('./WeekEarthTemplate')),
  'week-editorial': dynamic(() => import('./WeekEditorialTemplate')),
  'week-neon': dynamic(() => import('./WeekNeonTemplate')),
  almanac: dynamic(() => import('./AlmanacTemplate')),
  pulse: dynamic(() => import('./PulseTemplate')),
  onyx: dynamic(() => import('./OnyxTemplate')),
  vitals: dynamic(() => import('./VitalsTemplate')),
}

export default function GuideTemplateRenderer(props: {
  data: GuideData
  initialCheckins: { week_number: number; action_index: number | null; checkin_date: string; item_id?: string | null; item_text_snapshot?: string | null }[]
  shareToken?: string
  roadmapId?: string
  patientId?: string
  editable?: boolean
  duration?: number
}) {
  const Template = Object.hasOwn(layouts, props.data.template) ? layouts[props.data.template as keyof typeof layouts] : undefined
  if (Template) return <Template data={props.data} initialCheckins={props.initialCheckins} shareToken={props.shareToken ?? ''} editable={props.editable} roadmapId={props.roadmapId} />
  return <DashboardClient {...props} />
}
