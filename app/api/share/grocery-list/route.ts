import type { NextRequest } from 'next/server'
import { POST as compassGroceryList } from '@/app/api/compass/grocery-list/route'

// Public. The grocery-list tidy-up is a pure transform over candidate item
// names the client already computed — it takes no row id and touches no
// table, so the gated handler's logic is reused rather than forked.
//
// Delegated through a wrapper rather than `export { POST } from ...` because
// Next must statically parse the route segment config in this file.
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  return compassGroceryList(req)
}
