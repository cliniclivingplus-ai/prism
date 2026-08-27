export type PatientInput = {
    name: string
    age_sex: string
    complaint: string
    diet_type: string
    medical_history: string
    allergies: string
  }
  
  export type RxStat = {
    num: string
    label: string
  }
  
  export type StrategyPillar = {
    icon: string
    title: string
    detail: string
  }
  
  export type AddFood = {
    name: string
    emoji: string
    category: string
    frequency: string
    amount: string
    why: string
    target_species: string
    how_to_use: string
    indian_context: string | null
    priority: 'high' | 'medium' | 'low'
  }
  
  export type SpeciesFoodMap = {
    species: string
    status: 'depleted' | 'overgrown' | 'balanced' | 'keystone'
    intervention: 'feed' | 'suppress' | 'maintain'
    foods: string[]
    avoid: string[]
  }
  
  export type ScheduleSlot = {
    time: string
    time_sub: string
    main_foods: string
    microbiome_reason: string
    target_species_tag: string
  }
  
  export type Supplement = {
    name: string
    dose: string
    why: string
  }
  
  export type AvoidFood = {
    name: string
    reason: string
    pathobiont: string
  }
  
  export type RxData = {
    rx_title: string
    rx_summary: string
    stats: RxStat[]
    strategy_pillars: StrategyPillar[]
    add_foods: AddFood[]
    species_food_map: SpeciesFoodMap[]
    daily_schedule: ScheduleSlot[]
    supplements: Supplement[]
    avoid_foods: AvoidFood[]
  }
  
  export type Patient = {
    id: string
    doctor_id: string
    name: string
    age_sex: string
    complaint: string
    diet_type: string
    medical_history: string
    allergies: string
    created_at: string
  }
  
  export type Prescription = {
    id: string
    patient_id: string
    doctor_id: string
    species_list: string[]
    species_count: number
    rx_data: RxData
    created_at: string
    patients?: {
      name: string
      age_sex: string
      complaint: string
    }
  }
