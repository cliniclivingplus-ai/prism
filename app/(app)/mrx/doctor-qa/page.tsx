'use client'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'

export default function DoctorQA() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [sources, setSources] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  async function ask() {
    if (!question.trim()) return
    setLoading(true)
    setAnswer('')
    setSources([])

    const res = await fetch('/api/mrx/rag-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    })

    const data = await res.json()
    setAnswer(data.answer || 'No answer returned.')
    setSources(data.sources || [])
    setLoading(false)
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Clinical Knowledge Assistant</h1>
      <p className="text-gray-500 text-sm mb-6">Ask anything about gut microbiome, species, or supplements</p>

      <div className="flex gap-2 mb-6">
        <input
          className="flex-1 border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g. What does low Faecalibacterium mean for IBS patients?"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ask()}
        />
        <button
          onClick={ask}
          disabled={loading}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition"
        >
          {loading ? 'Thinking...' : 'Ask'}
        </button>
      </div>

      {loading && (
        <div className="text-sm text-gray-400 animate-pulse mb-4">
          Analysing microbiome profile...
Evaluating clinical indicators...
Generating recommendations...
        </div>
      )}

      {answer && (
        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <div className="text-sm text-gray-800 leading-relaxed prose prose-sm max-w-none">
            <ReactMarkdown>{answer}</ReactMarkdown>
          </div>

          {sources.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">
                Sources from knowledge base
              </p>
              <div className="flex flex-wrap gap-2">
                {sources.map(s => (
                  <span
                    key={s}
                    className="text-xs bg-blue-50 text-blue-700 rounded-full px-3 py-1"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
