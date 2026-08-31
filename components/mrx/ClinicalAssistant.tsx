'use client'
// components/ClinicalAssistant.tsx

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { usePageContext }  from '@/components/mrx/PageContext'
import { useAssistant }    from '@/lib/mrx/AssistantContext'
import { usePdfPanel, PDF_PANEL_W, ASSISTANT_W } from '@/lib/mrx/PdfPanelContext'
import { FileText } from 'lucide-react'

// ─── Markdown renderer ────────────────────────────────────────────────────────

function MessageContent({ content }: { content: string }) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g)
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Message = { role: 'user' | 'assistant'; content: string }

// ─── Suggestions ─────────────────────────────────────────────────────────────

const SECTION_SUGGESTIONS: Record<string, string[]> = {
  'rych-index':        ['What does this Rych Index score mean?', 'Is this score concerning?', 'What improves Rych Index?'],
  'health-indicators': ['Which health indicator needs most attention?', 'What do these scores mean together?'],
  'disease-risk':      ['Which disease risk is most urgent?', 'What reduces IBD risk?', 'Is the constipation risk actionable?'],
  'diversity':         ['Is this diversity score low?', 'What increases microbial diversity?', 'What does Shannon index mean?'],
  'foundation':        ['What does the foundation score indicate?', 'How can the patient improve foundation bacteria?'],
  'probiotics':        ['Which probiotics are missing?', 'What does absent Lactobacillus mean?', 'Which probiotic should I prioritise?'],
  'pathogens':         ['Is this pathogen level dangerous?', 'What does elevated Fusobacterium mean?', 'How urgent is this pathogen finding?'],
  'scfa':              ['What does low butyrate mean clinically?', 'How can SCFA production be improved?'],
  'gut-function':      ['What does motility score mean?', 'Is mineral bioavailability a concern?', 'How do motility and absorption relate?'],
  'vitamins':          ['Which vitamin deficiency is most impactful?', 'Can gut bacteria explain this vitamin gap?'],
  'neurotransmitters': ['How does gut serotonin affect mood?', 'What does low GABA production mean?'],
  'nutrition':         ['What diet changes are most urgent?', 'Is this patient a candidate for elimination diet?'],
  'dietary-rx':        ['Summarise the dietary prescription', 'What is the rationale for this diet plan?'],
  'packages':          ['Which LP package suits this patient?'],
  'dashboard':         ['Show me an overview of this patient', 'What are the most urgent findings?'],
  'default':           ['Explain this section', 'What should I focus on first?', 'Are there any red flags?'],
}

function getSuggestions(section?: string) {
  if (!section) return SECTION_SUGGESTIONS.default
  return SECTION_SUGGESTIONS[section] ?? SECTION_SUGGESTIONS.default
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ClinicalAssistant() {
  const pathname = usePathname()
  const pageCtx  = usePageContext()
  const { isOpen, toggle, close }                         = useAssistant()
  const { isPdfOpen, pendingSelection, setPendingSelection } = usePdfPanel()

  // ── All state hooks first ─────────────────────────────────────────────
  const [input,    setInput]    = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading,  setLoading]  = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  // ── Derived values (no hooks, safe to compute anywhere) ──────────────
  const reportIdMatch = pathname.match(/\/report\/([^/]+)/)
  const reportId      = pageCtx?.reportId ?? reportIdMatch?.[1] ?? null

  // ── sendMessage (defined before useEffect that calls it) ─────────────
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || loading) return
    setInput('')

    const userMsg: Message = { role: 'user', content }
    const next = [...messages, userMsg]
    setMessages(next)
    setLoading(true)

    try {
      const res = await fetch('/api/mrx/rag-query', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages:       next,
          report_id:      reportId,
          active_section: pageCtx?.section ?? pathname.split('/').pop() ?? '',
          page_context:   pageCtx
            ? { section: pageCtx.section, label: pageCtx.label, data: pageCtx.data, patientName: pageCtx.patientName }
            : null,
        }),
      })
      const json = await res.json()
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: json.reply ?? json.error ?? 'No response' },
      ])
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Connection error. Please try again.' },
      ])
    } finally {
      setLoading(false)
    }
  }, [messages, loading, reportId, pageCtx, pathname])

  const send = useCallback(() => sendMessage(input), [input, sendMessage])

  // ── All useEffects (must be unconditional, before any return) ─────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 200)
  }, [isOpen])

  useEffect(() => {
    setMessages([])
  }, [pageCtx?.section])

  useEffect(() => {
    if (!pendingSelection) return
    const question = `From the PDF report: "${pendingSelection}"\n\nWhat does this mean clinically?`
    setPendingSelection(null)
    sendMessage(question)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSelection])

  // ── Conditional return AFTER all hooks ────────────────────────────────
  if (pathname === '/login') return null

  const suggestions = getSuggestions(pageCtx?.section)

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Pull tab ──────────────────────────────────────────────────── */}
      <button
        onClick={toggle}
        aria-label="Toggle Clinical Assistant"
        style={
          isPdfOpen && !isOpen
            ? { left: PDF_PANEL_W, right: 'auto' }
            : { right: isOpen ? ASSISTANT_W : 0, left: 'auto' }
        }
        className="fixed top-1/2 -translate-y-1/2 z-50 transition-[left,right] duration-[250ms] ease-in-out"
      >
        <div className={`bg-[#538A22] hover:bg-[#3D6B16] text-white px-1.5 py-6 shadow-lg flex flex-col items-center gap-2 transition-colors ${
          isPdfOpen && !isOpen ? 'rounded-r-xl' : 'rounded-l-xl'
        }`}>
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              !isOpen && !isPdfOpen ? 'rotate-180' : 'rotate-0'
            }`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span
            className="text-[10px] font-mono font-semibold tracking-widest uppercase"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: '0.15em' }}
          >
            Assistant
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
        </div>
      </button>

      {/* ── Sidebar panel ─────────────────────────────────────────────── */}
      <div
        style={{ width: ASSISTANT_W }}
        className={`fixed top-0 right-0 h-screen z-40 bg-white border-l border-[#E2F3D0] shadow-2xl flex flex-col transition-transform duration-[250ms] ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E2F3D0] bg-[#F2F9EC] flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-[#538A22] font-semibold uppercase tracking-widest">
                  Clinical Assistant
                </span>
                <span className="text-xs font-mono bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">
                  Doctor only
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                {pageCtx ? (
                  <>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                    <span className="text-xs text-gray-500 font-mono">
                      Reading: <span className="text-[#538A22] font-medium">{pageCtx.label}</span>
                    </span>
                    {pageCtx.patientName && (
                      <span className="text-xs text-gray-400 font-mono truncate">· {pageCtx.patientName}</span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                    <span className="text-xs text-gray-400 font-mono">No page data loaded</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  className="text-xs font-mono text-gray-400 hover:text-red-500 transition"
                >
                  Clear
                </button>
              )}
              <button
                onClick={close}
                className="text-gray-400 hover:text-gray-700 transition"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {messages.length === 0 && (
            <div className="space-y-3 pt-2">
              <p className="text-xs text-gray-400 font-mono text-center">
                {pageCtx
                  ? `Ask anything about the ${pageCtx.label} section`
                  : 'Ask any clinical question'}
              </p>
              <div className="space-y-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s)}
                    className="w-full text-left text-xs text-[#1A3207] bg-[#F2F9EC] border border-[#C8E9A8] rounded-lg px-3 py-2.5 hover:bg-[#E2F3D0] transition font-mono leading-relaxed"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                m.role === 'user'
                  ? 'bg-[#538A22] text-white rounded-br-sm'
                  : 'bg-[#F2F9EC] text-gray-800 border border-[#E2F3D0] rounded-bl-sm'
              }`}>
                {m.role === 'user' && m.content.startsWith('From the PDF report:') && (
                  <div className="text-[10px] font-mono bg-white/20 rounded px-1.5 py-0.5 mb-1.5 inline-flex items-center gap-1">
                    <FileText size={10} /> From PDF
                  </div>
                )}
                <MessageContent content={m.content} />
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#F2F9EC] border border-[#E2F3D0] rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1 items-center h-4">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 bg-[#538A22] rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-[#E2F3D0] bg-white flex-shrink-0">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Ask about this page or select text from the PDF…"
              className="flex-1 text-xs border border-[#E2F3D0] rounded-xl px-3.5 py-2.5 outline-none focus:border-[#538A22] bg-[#F2F9EC] placeholder-gray-400 font-mono"
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="px-4 py-2.5 bg-[#538A22] hover:bg-[#3D6B16] disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl text-sm font-medium transition-colors"
            >
              →
            </button>
          </div>
          <p className="text-[10px] text-gray-400 font-mono text-center mt-2">
            For physician use only · Not a prescription
          </p>
        </div>
      </div>
    </>
  )
}
