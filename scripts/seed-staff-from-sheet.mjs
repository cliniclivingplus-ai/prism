// One-off script: seeds the 6 real staff members from the coach's sheet
// into public.nutritionists, uploading each person's headshot from
// staff_photos/ (matched by filename) to the coach-photos bucket first.
//
// Requires migration_v43_nutritionists_department.sql to already be
// applied (adds the `department` column this script writes to).
//
// Run once: node scripts/seed-staff-from-sheet.mjs
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const env = fs.readFileSync(path.join(root, '.env.local'), 'utf8')
const get = (k) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim()
const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'))

const PHOTOS_DIR = path.join(root, 'staff_photos')

const STAFF = [
  {
    full_name: 'Clarissa S',
    department: 'Medical',
    designation: 'Clinical Psychologist',
    bio: 'Clinical Psychologist who provides evidence-based therapy in a safe, supportive, and collaborative space. With an interest in neuroscience and the mind-body connection, I take a holistic approach to understanding how the brain, emotions, behaviours, and lifestyle shape psychological wellbeing.',
    email: 'clarissa@cliniclivingplus.com',
    photoFile: 'Clarissa S.jpeg',
  },
  {
    full_name: 'Dr Jithin KS',
    department: 'Front desk',
    designation: 'Patient Experience Associate',
    bio: 'As your first point of contact at Clinic Living Plus, our Patient Experience Associate ensures every client feels heard, cared for, and confident from their very first enquiry. They coordinate consultations, guide you through your care journey, and make sure no question ever goes unanswered.',
    email: 'cliniclivingplus@gmail.com',
    photoFile: null,
  },
  {
    full_name: 'Saksha Shetty',
    department: 'Medical',
    designation: 'Integrative Health Coach',
    bio: 'As an Integrative Health Coach, I help individuals build sustainable nutrition and lifestyle habits that support better health, energy, and overall well being. My approach focuses on personalised guidance, practical changes, and long-term consistency.',
    email: 'saksha.shetty@cliniclivingplus.com',
    photoFile: 'Saksha Shetty .jpg',
  },
  {
    full_name: 'Bhavana P',
    department: 'Medical',
    designation: 'Head of Nutrition',
    bio: "I believe optimal health lies beyond simply treating disease. My approach is to optimise health and well-being through root cause analysis, functional medicine framework & sustainable lifestyle changes. My personal interests lie in gut and women's health.",
    email: 'bhavana@cliniclivingplus.com',
    photoFile: 'Bhavana P.jpg',
  },
  {
    full_name: 'Nithya L G',
    department: 'Medical',
    designation: 'Integrative Health Coach',
    bio: "As an Integrative Health Coach, I assess client's health and lifestyle needs, provide personalized wellness guidance, support sustainable behavior change, and empower individuals to achieve their health and well-being goals through a holistic approach.",
    email: 'nithya@cliniclivingplus.com',
    photoFile: 'Nithya L G .jpg',
  },
  {
    full_name: 'Sarah Rodrigo',
    department: 'Medical',
    designation: 'Integrative Health Coach',
    bio: 'I believe healthy eating should fit into your life, not take it over. As a Integrative Health Coach, I focus on balanced, practical nutrition without restrictive rules or guilt. My approach is about helping clients understand their food choices, build realistic habits, and find a way of eating that supports their health while still being enjoyable and sustainable in everyday life.',
    email: 'sarah@cliniclivingplus.com',
    photoFile: null,
  },
]

async function uploadPhoto(id, filename) {
  const filePath = path.join(PHOTOS_DIR, filename)
  const buffer = fs.readFileSync(filePath)
  const ext = path.extname(filename).slice(1).toLowerCase()
  const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
  const storagePath = `${id}-${Date.now()}.${ext === 'jpeg' ? 'jpg' : ext}`
  const { error } = await sb.storage.from('coach-photos').upload(storagePath, buffer, { contentType, upsert: true })
  if (error) throw new Error(`upload failed for ${filename}: ${error.message}`)
  const { data } = sb.storage.from('coach-photos').getPublicUrl(storagePath)
  return data.publicUrl
}

for (const person of STAFF) {
  const { data: existing } = await sb.from('nutritionists').select('id').eq('full_name', person.full_name).maybeSingle()
  if (existing) {
    console.log(`SKIP (already exists): ${person.full_name}`)
    continue
  }

  const { data: inserted, error: insertError } = await sb.from('nutritionists').insert({
    full_name: person.full_name,
    department: person.department,
    designation: person.designation,
    bio: person.bio,
    email: person.email,
  }).select().single()
  if (insertError) { console.error(`FAILED to insert ${person.full_name}:`, insertError.message); continue }

  if (person.photoFile) {
    try {
      const photoUrl = await uploadPhoto(inserted.id, person.photoFile)
      const { error: updateError } = await sb.from('nutritionists').update({ photo_url: photoUrl }).eq('id', inserted.id)
      if (updateError) console.error(`  photo URL save failed for ${person.full_name}:`, updateError.message)
      else console.log(`OK: ${person.full_name} (with photo)`)
    } catch (e) {
      console.error(`  photo upload failed for ${person.full_name}:`, e.message)
    }
  } else {
    console.log(`OK: ${person.full_name} (no photo yet)`)
  }
}
