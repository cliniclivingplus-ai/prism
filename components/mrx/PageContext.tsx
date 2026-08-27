'use client'
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
export type PageContextData = { section: string; label: string; data: Record<string, unknown>; reportId?: string; patientName?: string }
type State = { pageCtx: PageContextData | null; setPageCtx: (ctx: PageContextData | null) => void }
export const PageCtx = createContext<State>({ pageCtx: null, setPageCtx: () => {} })
export function PageContextProvider({ children }: { children: ReactNode }) {
  const [pageCtx, setPageCtx] = useState<PageContextData | null>(null)
  const set = useCallback((ctx: PageContextData | null) => setPageCtx(ctx), [])
  return <PageCtx.Provider value={{ pageCtx, setPageCtx: set }}>{children}</PageCtx.Provider>
}
export function usePageContext() { return useContext(PageCtx).pageCtx }
