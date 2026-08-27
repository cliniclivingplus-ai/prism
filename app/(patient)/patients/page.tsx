import { redirect } from 'next/navigation'

// The roster lives on /dashboard (as in design-reference/home.html, where the
// dashboard *is* the patient list). /patients exists so the sidebar's
// Patients entry resolves rather than 404ing.
export default function PatientsIndex() {
  redirect('/dashboard')
}
