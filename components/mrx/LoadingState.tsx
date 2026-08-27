'use client'

const STEPS = [
  'Analyzing gut microbiome profile',
  'Generating nutrition recommendations',
  'Building daily meal schedule',
  'Generating supplement recommendations',
]

type Props = {
  currentStep: number
}

export default function LoadingState({ currentStep }: Props) {
  return (
    <div className="max-w-lg mx-auto py-24 px-6 text-center">
      <div className="mb-2 text-2xl font-light text-gray-800 italic">
      Preparing personalized recommendations..
      </div>
      <p className="text-sm text-gray-400 font-mono mb-8">
        This may take a few seconds
      </p>

      <div className="w-full bg-gray-100 rounded-full h-1 mb-10 overflow-hidden">
        <div
          className="h-full bg-green-600 rounded-full transition-all duration-700"
          style={{ width: `${Math.min(((currentStep + 1) / STEPS.length) * 100, 95)}%` }}
        />
      </div>

      <div className="flex flex-col gap-2 text-left">
      <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" />

        {STEPS.map((step, i) => {
          const isDone = i < currentStep
          const isActive = i === currentStep
          return (
            <div
              key={step}
              className={`flex items-center gap-3 text-xs font-mono rounded-md px-3 py-2
                border transition-all duration-300
                ${isDone
                  ? 'text-green-700 bg-[#F2F9EC] border-[#C8E9A8]'
                  : isActive
                  ? 'text-gray-800 bg-white border-gray-200'
                  : 'text-gray-400 bg-transparent border-transparent'
                }`}
            >
              <span className={`w-3 h-3 rounded-full flex-shrink-0 border
                ${isDone
                  ? 'bg-[#F2F9EC]0 border-green-500'
                  : isActive
                  ? 'border-gray-400 animate-pulse'
                  : 'border-gray-200'
                }`}
              />
              {step}
            </div>
          )
        })}
      </div>
    </div>
  )
}
