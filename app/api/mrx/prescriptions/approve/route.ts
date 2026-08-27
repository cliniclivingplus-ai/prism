import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Approve / un-approve a MicrobiomeRx prescription.
 *
 * The review page used to do this straight from the browser:
 *
 *     const { error } = await supabase.from('prescriptions')
 *       .update({ approved_at: now }).eq('id', currentId)
 *     if (!error) setIsApproved(true)
 *
 * Three things wrong with that, all of which made approval look like it
 * worked while nothing was saved:
 *
 *   1. PostgREST returns NO error when an UPDATE matches zero rows. Any stale
 *      id — or an RLS policy filtering the row out — produced `error === null`
 *      and an optimistic "✓ Approved" that vanished on reload.
 *   2. The write sat inside a setTimeout(…, 300) that closed over
 *      `prescriptionId` from an earlier render, so a row saveDraft() had just
 *      created was invisible to it.
 *   3. mrx.prescriptions.doctor_id is not consistently an auth user id (some
 *      rows carry an mrx.doctors id instead), so a doctor-scoped RLS policy
 *      cannot reliably match the signed-in user.
 *
 * Doing it here fixes all three: one round trip, service-role so the row is
 * actually reachable, and the updated row is returned so "changed nothing"
 * is reported as a failure instead of being swallowed.
 */

type Body = {
  reportId?: string | null
  prescriptionId?: string | null
  approved: boolean
  /** Sent when no prescription row exists yet, so one can be created. */
  rxData?: unknown
  patientId?: string | null
}

export async function POST(req: NextRequest) {
  const user = await requireUser()

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (typeof body.approved !== 'boolean') {
    return NextResponse.json({ error: '`approved` must be a boolean.' }, { status: 400 })
  }
  if (!body.prescriptionId && !body.reportId) {
    return NextResponse.json(
      { error: 'Either prescriptionId or reportId is required.' },
      { status: 400 }
    )
  }

  const mrx = createAdminClient('mrx')
  const now = new Date().toISOString()

  const approvalFields = body.approved
    ? { approved_at: now, approved_by: user.id }
    : { approved_at: null, approved_by: null }

  // Resolve the row by prescription id, else by the report it belongs to.
  // Resolving server-side sidesteps the stale-closure problem entirely.
  let targetId = body.prescriptionId ?? null
  if (!targetId && body.reportId) {
    const { data: existing } = await mrx
      .from('prescriptions')
      .select('id')
      .eq('report_id', body.reportId)
      .maybeSingle()
    targetId = (existing?.id as string | undefined) ?? null
  }

  if (targetId) {
    const { data, error } = await mrx
      .from('prescriptions')
      .update(approvalFields)
      .eq('id', targetId)
      .select('id, approved_at')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // The whole point: zero rows changed is a failure, not a success.
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'That prescription no longer exists — nothing was changed.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ id: data[0].id, approved_at: data[0].approved_at })
  }

  // No row yet. Only meaningful when approving.
  if (!body.approved) {
    return NextResponse.json(
      { error: 'There is no saved prescription to un-approve.' },
      { status: 404 }
    )
  }

  const { data, error } = await mrx
    .from('prescriptions')
    .upsert(
      {
        report_id: body.reportId,
        patient_id: body.patientId ?? null,
        doctor_id: user.id,
        rx_data: body.rxData ?? null,
        ...approvalFields,
      },
      { onConflict: 'report_id' }
    )
    .select('id, approved_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id, approved_at: data.approved_at })
}
