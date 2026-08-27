'use client'

import type { SectionAnalysis } from '@/lib/mrx/sectionPage'

type Props = {
  analysis: SectionAnalysis | string | null
  analysing: boolean
  error: string | null
  onRegenerate: () => void
  subtitle?: string
  loadingMessage?: string
}

export default function SectionAiPanel({
  analysis,
  analysing,
  error,
  onRegenerate,
  subtitle = 'Auto-generated · Powered by report data',
  loadingMessage = 'Analysing scores…',
}: Props) {
  const structured = analysis && typeof analysis === 'object' ? analysis : null
  const textSummary = typeof analysis === 'string' ? analysis : null

  return (
    <div className="bg-white border border-[#E2F3D0] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E2F3D0] flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">AI Clinical Analysis</p>
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        </div>
        {analysis && !analysing && (
          <button
            onClick={onRegenerate}
            className="text-xs px-4 py-2 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-300 transition font-medium"
          >
            Regenerate
          </button>
        )}
      </div>

      {analysing && (
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-4 h-4 border-2 border-[#538A22] border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <p className="text-xs text-gray-400">{loadingMessage}</p>
          </div>
          {[80, 60, 90, 50].map((w, i) => (
            <div key={i} className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: `${w}%` }} />
          ))}
        </div>
      )}

      {error && !analysing && (
        <div className="px-5 py-4 flex items-center justify-between gap-4">
          <p className="text-sm text-red-500">{error}</p>
          <button
            onClick={onRegenerate}
            className="text-xs px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 rounded-lg hover:bg-red-100 transition shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {!analysing && !error && structured && (
        <div className="p-5 space-y-4">
          {structured.interpretation && (
            <div className="bg-[#F2F9EC] border border-[#E2F3D0] rounded-xl p-4">
              <p className="text-xs font-medium text-[#538A22] uppercase tracking-wide mb-2">Clinical Summary</p>
              <p className="text-sm text-gray-700 leading-relaxed">{structured.interpretation}</p>
            </div>
          )}

          {structured.what_it_means && (
            <div className="border border-[#E2F3D0] rounded-xl p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">What This Means</p>
              <p className="text-sm text-gray-600 leading-relaxed">{structured.what_it_means}</p>
            </div>
          )}

          {structured.clinical_significance && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-2">Clinical Significance</p>
              <p className="text-sm text-blue-900 leading-relaxed">{structured.clinical_significance}</p>
            </div>
          )}

          {(structured.contributing_factors ?? []).length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Contributing Factors</p>
              <div className="space-y-2">
                {structured.contributing_factors!.map((f, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${
                      f.impact === 'positive'
                        ? 'bg-[#F2F9EC] border-[#E2F3D0]'
                        : f.impact === 'negative'
                          ? 'bg-red-50 border-red-100'
                          : 'bg-gray-50 border-[#E2F3D0]'
                    }`}
                  >
                    <span className="flex-shrink-0 mt-0.5">
                      {f.impact === 'positive' ? '↑' : f.impact === 'negative' ? '↓' : '→'}
                    </span>
                    <div>
                      <span
                        className={`text-xs font-medium ${
                          f.impact === 'positive'
                            ? 'text-green-700'
                            : f.impact === 'negative'
                              ? 'text-red-700'
                              : 'text-gray-600'
                        }`}
                      >
                        {f.factor}
                      </span>
                      <p className="text-xs text-gray-500 mt-0.5">{f.explanation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {structured.what_drives_it && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <p className="text-xs font-medium text-amber-600 uppercase tracking-wide mb-2">What Drives It</p>
              <p className="text-sm text-amber-900 leading-relaxed">{structured.what_drives_it}</p>
            </div>
          )}

          {(structured.considerations ?? []).length > 0 && (
            <div className="space-y-2">
              {structured.considerations!.map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-[#538A22] flex-shrink-0 mt-0.5">→</span>
                  {c}
                </div>
              ))}
            </div>
          )}

          {structured.knowledge_insight && (
            <div className="border border-blue-100 bg-blue-50 rounded-xl p-4">
              <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1">
                Knowledge Base Insight
                {structured.knowledge_source && (
                  <span className="ml-2 font-mono normal-case text-blue-400">· {structured.knowledge_source}</span>
                )}
              </p>
              <p className="text-sm text-blue-800 leading-relaxed">{structured.knowledge_insight}</p>
            </div>
          )}
        </div>
      )}

      {!analysing && !error && textSummary && (
        <div className="p-5">
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{textSummary}</p>
        </div>
      )}

      {!analysing && !error && !analysis && (
        <div className="p-8 text-center">
          <p className="text-sm text-gray-400">Analysis will load automatically when data is available.</p>
        </div>
      )}
    </div>
  )
}
