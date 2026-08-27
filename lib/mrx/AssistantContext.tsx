'use client'
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
type AssistantCtx = { isOpen: boolean; toggle: () => void; open: () => void; close: () => void }
const Ctx = createContext<AssistantCtx>({ isOpen: false, toggle: () => {}, open: () => {}, close: () => {} })
export function AssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const toggle = useCallback(() => setIsOpen(v => !v), [])
  const open   = useCallback(() => setIsOpen(true), [])
  const close  = useCallback(() => setIsOpen(false), [])
  return <Ctx.Provider value={{ isOpen, toggle, open, close }}>{children}</Ctx.Provider>
}
export function useAssistant() { return useContext(Ctx) }
