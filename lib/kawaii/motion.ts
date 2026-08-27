// Shared Kawaii Wellness motion keyframes — injected once via a <style>
// tag (same pattern DashboardClient.tsx already uses for its own
// @keyframes spin block). Respects prefers-reduced-motion by disabling
// every looping animation, keeping only quick mount-in transitions.
export const KAWAII_MOTION_CSS = `
@keyframes kawaiiWiggle { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(4deg); } }
@keyframes kawaiiFloat { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-10px) rotate(-2deg); } }
@keyframes kawaiiPop { 0% { transform: scale(0) rotate(-8deg); } 65% { transform: scale(1.15) rotate(4deg); } 100% { transform: scale(1) rotate(0deg); } }
@media (prefers-reduced-motion: reduce) {
  [data-kawaii-mascot], [data-kawaii-wiggle], [data-kawaii-pop] { animation: none !important; }
}
`
