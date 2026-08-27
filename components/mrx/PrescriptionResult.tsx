'use client'

import { RxData, AddFood, SpeciesFoodMap, ScheduleSlot,
  Supplement, AvoidFood } from '@/lib/mrx/types'

type Props = {
  rxData: RxData
  patientName: string
  speciesCount: number
  onReset: () => void
}

const CAT_STYLES: Record<string, string> = {
  prebiotic:           'bg-[#F2F9EC] text-[#1A3207] border-[#C8E9A8]',
  probiotic:           'bg-teal-50 text-teal-800 border-teal-200',
  fermented:           'bg-purple-50 text-purple-800 border-purple-200',
  fibre:               'bg-[#F2F9EC] text-[#1A3207] border-[#C8E9A8]',
  'anti-inflammatory': 'bg-amber-50 text-amber-800 border-amber-200',
  spice:               'bg-amber-50 text-amber-800 border-amber-200',
  protein:             'bg-orange-50 text-orange-800 border-orange-200',
  fat:                 'bg-slate-50 text-slate-700 border-slate-200',
}

const STATUS_DOT: Record<string, string> = {
  depleted:  'bg-red-400',
  overgrown: 'bg-amber-400',
  balanced:  'bg-green-400',
  keystone:  'bg-teal-400',
}

export default function PrescriptionResult({
  rxData, patientName, speciesCount, onReset,
}: Props) {
  return (
    <div className="max-w-4xl mx-auto py-10 px-6 pb-24">

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-light text-gray-900">{patientName}</h2>
          <p className="text-xs font-mono text-gray-400 mt-1">
            {speciesCount} species analysed
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onReset}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm
              text-gray-500 hover:border-green-400 hover:text-[#538A22] transition"
          >
            ← New prescription
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm
              hover:bg-green-800 transition"
          >
            Print Rx
          </button>
        </div>
      </div>

      {/* Hero banner */}
      <div className="bg-green-700 rounded-xl p-6 mb-6 text-white">
        <h3 className="text-xl font-light italic mb-2">{rxData.rx_title}</h3>
        <p className="text-sm text-green-100 leading-relaxed max-w-2xl">
          {rxData.rx_summary}
        </p>
        <div className="flex gap-3 mt-4 flex-wrap">
          {rxData.stats.map((s, i) => (
            <div key={i} className="bg-green-800 rounded-lg px-4 py-3 text-center
              min-w-[80px]">
              <div className="text-2xl font-light text-green-200">{s.num}</div>
              <div className="text-xs text-green-400 mt-0.5 leading-tight">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Strategy pillars */}
      {rxData.strategy_pillars?.length > 0 && (
        <>
          <SectionHeader title="Dietary strategy" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {rxData.strategy_pillars.map((p, i) => (
              <div key={i} className="bg-white border border-[#E2F3D0] rounded-xl
                p-4 flex gap-3 items-start">
                <span className="text-xl flex-shrink-0">{p.icon}</span>
                <div>
                  <div className="text-sm font-medium text-gray-800">{p.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5 leading-snug">
                    {p.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add foods */}
      <SectionHeader
        title="Add to diet"
        badge={`${rxData.add_foods?.length || 0} foods`}
        badgeColor="green"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {rxData.add_foods?.map((food, i) => (
          <FoodCard key={i} food={food} />
        ))}
      </div>

      {/* Species food map */}
      <SectionHeader title="Species ↔ food mapping" />
      <div className="bg-white border border-[#E2F3D0] rounded-xl overflow-hidden mb-6">
        <div className="bg-background px-4 py-2.5 border-b border-[#E2F3D0]">
          <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">
            Depleted and key species with their dietary targets
          </span>
        </div>
        {rxData.species_food_map?.map((s, i) => (
          <SpeciesRow key={i} item={s} />
        ))}
      </div>

      {/* Daily schedule */}
      <SectionHeader title="Daily meal schedule" />
      <div className="bg-white border border-[#E2F3D0] rounded-xl overflow-hidden mb-6">
        <div className="bg-background px-4 py-2.5 border-b border-[#E2F3D0]">
          <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">
            Meal timing · microbiome-targeted foods
          </span>
        </div>
        {rxData.daily_schedule?.map((slot, i) => (
          <ScheduleRow key={i} slot={slot} />
        ))}
      </div>

      {/* Supplements */}
      <SectionHeader title="Supplements & prebiotics" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {rxData.supplements?.map((s, i) => (
          <SupplementCard key={i} supplement={s} />
        ))}
      </div>

      {/* Avoid foods */}
      <SectionHeader
        title="Reduce / avoid"
        badge={`${rxData.avoid_foods?.length || 0} foods`}
        badgeColor="red"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {rxData.avoid_foods?.map((a, i) => (
          <AvoidCard key={i} item={a} />
        ))}
      </div>
    </div>
  )
}

function SectionHeader({
  title,
  badge,
  badgeColor = 'gray',
}: {
  title: string
  badge?: string
  badgeColor?: 'green' | 'red' | 'gray'
}) {
  const badgeStyles = {
    green: 'bg-[#F2F9EC] text-green-700 border-[#C8E9A8]',
    red:   'bg-red-50 text-red-700 border-red-200',
    gray:  'bg-background text-gray-500 border-gray-200',
  }
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-xs font-mono text-gray-400 uppercase tracking-widest
        whitespace-nowrap">
        {title}
      </span>
      <div className="flex-1 h-px bg-gray-100" />
      {badge && (
        <span className={`text-xs font-mono px-2 py-0.5 rounded border
          ${badgeStyles[badgeColor]}`}>
          {badge}
        </span>
      )}
    </div>
  )
}

function FoodCard({ food }: { food: AddFood }) {
  const catStyle = CAT_STYLES[food.category] || 'bg-background text-gray-700 border-gray-200'
  return (
    <div className={`bg-white border rounded-xl overflow-hidden
      hover:-translate-y-0.5 transition-transform duration-200
      ${food.priority === 'high' ? 'border-green-300' : 'border-[#E2F3D0]'}`}>
      <div className="p-4">
        <div className="flex gap-3 items-start mb-3">
          <span className="text-2xl flex-shrink-0">{food.emoji}</span>
          <div>
            <div className="text-sm font-medium text-gray-900 leading-snug">
              {food.name}
              {food.indian_context && (
                <span className="ml-1.5 text-xs text-amber-600 font-mono">
                  ({food.indian_context})
                </span>
              )}
            </div>
            <span className={`inline-block text-xs px-2 py-0.5 rounded border
              mt-1 ${catStyle}`}>
              {food.category}
            </span>
            <div className="text-xs text-gray-400 font-mono mt-1">
              {food.frequency}
              {food.amount ? ` · ${food.amount}` : ''}
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed mb-3">{food.why}</p>
        {food.target_species && (
          <div className="bg-background rounded-lg p-2.5 border border-[#E2F3D0]">
            <div className="text-xs font-mono text-gray-400 uppercase
              tracking-wide mb-1">
              Targets species
            </div>
            <div className="text-xs font-mono text-green-700 italic leading-snug">
              {food.target_species}
            </div>
          </div>
        )}
        {food.how_to_use && (
          <p className="text-xs font-mono text-amber-700 mt-2 leading-snug
            border-l-2 border-amber-200 pl-2">
            {food.how_to_use}
          </p>
        )}
      </div>
    </div>
  )
}

function SpeciesRow({ item }: { item: SpeciesFoodMap }) {
  return (
    <div className="grid grid-cols-[200px_1fr] border-b border-gray-50
      last:border-0 text-sm">
      <div className="px-4 py-3 border-r border-gray-50 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full flex-shrink-0
          ${STATUS_DOT[item.status] || 'bg-gray-300'}`} />
        <span className="text-xs font-mono italic text-gray-600 leading-snug">
          {item.species}
        </span>
      </div>
      <div className="px-4 py-3">
        <div className="text-xs font-mono text-gray-400 mb-2 uppercase tracking-wide">
          {item.intervention} · {item.status}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {item.foods?.map((f, i) => (
            <span key={i} className="text-xs px-2 py-0.5 bg-background text-gray-600
              border border-[#E2F3D0] rounded font-mono">
              + {f}
            </span>
          ))}
          {item.avoid?.map((f, i) => (
            <span key={i} className="text-xs px-2 py-0.5 bg-red-50 text-red-600
              border border-red-100 rounded font-mono">
              ↓ {f}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function ScheduleRow({ slot }: { slot: ScheduleSlot }) {
  return (
    <div className="grid grid-cols-[130px_1fr] border-b border-gray-50 last:border-0">
      <div className="px-4 py-3.5 border-r border-gray-50 bg-background">
        <div className="text-xs font-mono text-green-700 font-medium">
          {slot.time}
        </div>
        <div className="text-xs font-mono text-gray-400 mt-0.5">
          {slot.time_sub}
        </div>
      </div>
      <div className="px-4 py-3.5">
        <div className="text-sm font-medium text-gray-800 mb-1">
          {slot.main_foods}
        </div>
        <div className="text-xs text-gray-500 leading-relaxed">
          {slot.microbiome_reason}
          {slot.target_species_tag && (
            <span className="ml-2 text-xs font-mono text-green-700 bg-[#F2F9EC]
              px-1.5 py-0.5 rounded border border-[#E2F3D0]">
              {slot.target_species_tag}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function SupplementCard({ supplement }: { supplement: Supplement }) {
  return (
    <div className="bg-white border border-[#E2F3D0] rounded-xl p-4">
      <div className="text-sm font-medium text-teal-700 mb-1">
        {supplement.name}
      </div>
      <div className="text-xs font-mono text-gray-400 mb-2">
        {supplement.dose}
      </div>
      <p className="text-xs text-gray-600 leading-relaxed">{supplement.why}</p>
    </div>
  )
}

function AvoidCard({ item }: { item: AvoidFood }) {
  return (
    <div className="bg-red-50 border border-red-100 rounded-xl p-4">
      <div className="text-sm font-medium text-red-700 mb-2 flex items-center gap-2">
        <span>↓</span> {item.name}
      </div>
      <p className="text-xs text-gray-600 leading-relaxed mb-2">{item.reason}</p>
      {item.pathobiont && (
        <div className="text-xs font-mono text-gray-400">
          feeds: {item.pathobiont}
        </div>
      )}
    </div>
  )
}
