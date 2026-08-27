import {
  Moon, Droplet, Footprints, Brain, Utensils, Smartphone, Sun,
  HeartPulse, Star, Target, Flame, Award, CheckCircle2, CalendarCheck, Pill,
  Scale, Apple, Zap, Clock,
  type LucideIcon,
} from 'lucide-react'
import type { BlockIconKey } from './types'

export const BLOCK_ICON_MAP: Record<BlockIconKey, LucideIcon> = {
  moon: Moon, droplet: Droplet, footprints: Footprints, brain: Brain, utensils: Utensils,
  smartphone: Smartphone, sun: Sun, heart: HeartPulse, star: Star, target: Target,
  flame: Flame, award: Award, checkcircle: CheckCircle2, calendar: CalendarCheck, pill: Pill,
  scale: Scale, apple: Apple, zap: Zap, clock: Clock,
}

export function resolveBlockIcon(key?: BlockIconKey): LucideIcon {
  return (key && BLOCK_ICON_MAP[key]) || HeartPulse
}
