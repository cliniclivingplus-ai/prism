import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import SessionDetailClient from './SessionDetailClient'

export const revalidate = 0

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const { id, sessionId } = await params

  const [{ data: session }, { data: patient }] = await Promise.all([
    (await createClient()).from('sessions').select('*').eq('id', sessionId).single(),
    (await createClient()).from('patients').select('*').eq('id', id).single(),
  ])

  if (!session || !patient) notFound()

  return <SessionDetailClient session={session} patient={patient} />
}