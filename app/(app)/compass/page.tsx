import { redirect } from 'next/navigation'

// Compass's own home was the patient list. The merged shell's sidebar links
// to /compass, so land there.
export default function CompassIndex() {
  redirect('/compass/patients')
}
