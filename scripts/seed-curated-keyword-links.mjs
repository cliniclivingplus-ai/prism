import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)

// 47 curated items from the provided spreadsheet image (plus clean alias variants)
const CURATED_RESOURCES = [
  { keyword: '15-min Breathwork Practice', url: 'https://www.youtube.com/watch?v=ZYeeijlh8t4' },
  { keyword: '15-min Pranayama Practice', url: 'https://www.youtube.com/watch?v=JoDKbXEUrVQ' },
  { keyword: 'Apple Cider Vinegar (ACV)', url: 'https://www.amazon.in/Bragg-Apple-Cider-Vinegar-Bottle/dp/B000R73XZ0' },
  { keyword: 'Apple Cider Vinegar', url: 'https://www.amazon.in/Bragg-Apple-Cider-Vinegar-Bottle/dp/B000R73XZ0' },
  { keyword: 'ACV', url: 'https://www.amazon.in/Bragg-Apple-Cider-Vinegar-Bottle/dp/B000R73XZ0' },
  { keyword: 'Castor Oil', url: 'https://www.amazon.in/Khadi-Omorose-Cold-Pressed-Castor-Carrier/dp/B06XG93V2V' },
  { keyword: 'Ceylon Cinnamon Powder', url: 'https://www.amazon.in/dp/B00LN8734E' },
  { keyword: 'Ceylon Cinnamon', url: 'https://www.amazon.in/dp/B00LN8734E' },
  { keyword: 'CoQ10 Supplement', url: 'https://unived.com/products/q-veg' },
  { keyword: 'CoQ10', url: 'https://unived.com/products/q-veg' },
  { keyword: 'Diaphragmatic Breathing', url: 'https://www.youtube.com/watch?v=g2wo2Impnfg' },
  { keyword: 'Dijon Mustard', url: 'https://www.amazon.com/Westbrae-Natural-Organic-Beans-Pack/dp/B0141R4C1E' },
  { keyword: 'Dry Brushing', url: 'https://youtu.be/1YnVb9le-r0' },
  { keyword: 'Epsom Salt', url: 'https://www.amazon.in/Organix-Mantra-Muscle-Relief-Relieves/dp/B07C16YV9Z' },
  { keyword: 'Giloy Tea', url: 'https://www.amazon.in/Amrita-Naturals-Natural-Immunity-Booster/dp/B0BE1N8L3N' },
  { keyword: 'Ginger/Turmeric Tea', url: 'https://www.amazon.in/Organic-India-Ginger-Turmeric-Infusion/dp/B01N7O3W3P' },
  { keyword: 'Ginger Turmeric Tea', url: 'https://www.amazon.in/Organic-India-Ginger-Turmeric-Infusion/dp/B01N7O3W3P' },
  { keyword: 'Gluten-Free Roti', url: 'https://www.amazon.in/Jus-Amazin-Multigrain-Certified-Multipurpose/dp/B08X1W9H2P' },
  { keyword: 'Hibiscus Tea', url: 'https://www.amazon.in/Organic-Hibiscus-Tea-Bags-Eco-Friendly/dp/B0B13Q7H8W' },
  { keyword: 'Humming Bee (Bhramari) Breathing', url: 'https://www.youtube.com/watch?v=PcmPJNN0Q1M' },
  { keyword: 'Bhramari Breathing', url: 'https://www.youtube.com/watch?v=PcmPJNN0Q1M' },
  { keyword: 'Humming Bee Breathing', url: 'https://www.youtube.com/watch?v=PcmPJNN0Q1M' },
  { keyword: 'Kalonji Seeds', url: 'https://www.amazon.in/NatureVit-Kalonji-Nigella-Natural-Superfood/dp/B0E8N762X4' },
  { keyword: 'Kalonji', url: 'https://www.amazon.in/NatureVit-Kalonji-Nigella-Natural-Superfood/dp/B0E8N762X4' },
  { keyword: 'L-Glutamine', url: 'https://www.amazon.in/Carbamide-Forte-Glutamine-Supplement-Unflavoured/dp/B08F7J4K6N' },
  { keyword: 'Lentil Pasta', url: 'https://www.amazon.in/Pink-Harvest-Farms-Lentil-Pasta/dp/B09SG7NZPV' },
  { keyword: 'Maca Powder', url: 'https://urbanplatter.com/products/urban-platter-maca-root-powder-150g' },
  { keyword: 'Maca', url: 'https://urbanplatter.com/products/urban-platter-maca-root-powder-150g' },
  { keyword: 'Magnesium Citrate', url: 'https://healthyhey.com/products/healthyhey-nutrition-magnesium-citrate-120-capsules' },
  { keyword: 'Malasana (Garland Pose)', url: 'https://youtu.be/HnM6kfwhzd0' },
  { keyword: 'Malasana', url: 'https://youtu.be/HnM6kfwhzd0' },
  { keyword: 'Garland Pose', url: 'https://youtu.be/HnM6kfwhzd0' },
  { keyword: 'Miso', url: 'https://www.amazon.in/Urban-Platter-Shiro-Miso-Paste/dp/B073JG1VTN' },
  { keyword: 'Shiro Miso', url: 'https://www.amazon.in/Urban-Platter-Shiro-Miso-Paste/dp/B073JG1VTN' },
  { keyword: 'Mouth Taping', url: 'https://www.amazon.in/Snoring-Advanced-Sleeping-Breathing-Reduction/dp/B0B5N8734E' },
  { keyword: 'Nori Sheet', url: 'https://www.amazon.in/Urban-Platter-Sheets-Roasted-Seaweed/dp/B07NS124K8' },
  { keyword: 'Nori Sheets', url: 'https://www.amazon.in/Urban-Platter-Sheets-Roasted-Seaweed/dp/B07NS124K8' },
  { keyword: 'Nutritional Yeast', url: 'https://www.amazon.in/Nutritional-Gluten-Free-Perfectly-Plant-Based-Seasoning/dp/B07D38J3S9' },
  { keyword: 'Okra Water', url: 'https://www.youtube.com/shorts/L1b5hUWdDvY' },
  { keyword: 'Omega-3 Supplement', url: 'https://unived.com/products/ovegha' },
  { keyword: 'Omega-3', url: 'https://unived.com/products/ovegha' },
  { keyword: 'Oregano Flakes', url: 'https://www.amazon.in/Keya-Oregano-Pure-Sprinkler-grams/dp/B00LN8612E' },
  { keyword: 'Pasta (general/other)', url: 'https://www.amazon.in/WickedGud-Fiber-Semolina-Lentils-Healthy/dp/B0E854619B' },
  { keyword: 'WickedGud Fiber Pasta', url: 'https://www.amazon.in/WickedGud-Fiber-Semolina-Lentils-Healthy/dp/B0E854619B' },
  { keyword: 'Peppermint Tea', url: 'https://www.amazon.in/tea-trove-Peppermint-Eco-Friendly-Pouch-Caffeine-Free/dp/B08F591J3M' },
  { keyword: 'Plant-based Buttermilk', url: 'https://nourishyou.in/products/vegan-curd-500gm' },
  { keyword: 'Psyllium Husk', url: 'https://www.amazon.in/Organic-India-Psyllium-whole-100gm/dp/B00JI4W84Y' },
  { keyword: 'Soba Noodles', url: 'https://www.amazon.in/MasterChow-Healthy-Soba-Noodles-600g/dp/B09W2N45S9' },
  { keyword: 'Soy Sauce / Coconut Aminos', url: 'https://www.amazon.in/Platter-Coconut-Seasoning-Soy-Free-Gluten-Free/dp/B07W94129X' },
  { keyword: 'Coconut Aminos', url: 'https://www.amazon.in/Platter-Coconut-Seasoning-Soy-Free-Gluten-Free/dp/B07W94129X' },
  { keyword: 'Spearmint Tea', url: 'https://www.amazon.in/Trove-Organic-Spearmint-Bags-PCOS/dp/B0B4NP872E' },
  { keyword: 'Tofu', url: 'https://healthonplants.com/products/classic-tofu-1' },
  { keyword: 'Tofu Pulao', url: 'https://youtu.be/5k--6jHqAjE' },
  { keyword: 'Ujjayi Pranayama', url: 'https://www.youtube.com/watch?v=9SgZfwrhFRM' },
  { keyword: 'Vagus Nerve Massage', url: 'https://youtu.be/LnV3Q2xlb1U' },
  { keyword: 'Vanilla Extract', url: 'https://www.amazon.in/Sprig-Natural-Bourbon-Vanilla-Extract/dp/B07CWV487Q' },
  { keyword: 'Vegan Curd', url: 'https://nourishyou.in/products/vegan-curd-500gm' },
  { keyword: 'Vegetable Broth', url: 'https://minimalistbaker.com/easy-1-pot-vegetable-broth/' },
  { keyword: 'Vitamin D3', url: 'https://www.amazon.in/dp/B08NWXT39S' },
  { keyword: 'Wheatgrass Juice/Shot', url: 'https://healthybuddha.in/wheatgrass-satva' },
  { keyword: 'Wheatgrass Juice', url: 'https://healthybuddha.in/wheatgrass-satva' },
  { keyword: 'Wheatgrass Shot', url: 'https://healthybuddha.in/wheatgrass-satva' },
  { keyword: 'Wheatgrass', url: 'https://healthybuddha.in/wheatgrass-satva' },
  { keyword: 'Yoga Nidra', url: 'https://www.youtube.com/watch?v=7H0FKZeuVVs' },
  { keyword: 'Yoga for Gut Health', url: 'https://www.youtube.com/watch?v=TePWfbIWpBQ' },
  { keyword: 'Yoga for Hormonal Balance', url: 'https://www.youtube.com/watch?v=5JvbjrLESPs' },
]

async function seed() {
  console.log('Clearing existing keyword links from database...')
  const { error: deleteError } = await supabase
    .from('keyword_links')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (deleteError) {
    console.error('Error deleting old keyword links:', deleteError.message)
    process.exit(1)
  }

  console.log('Inserting curated keyword links...')
  const rows = CURATED_RESOURCES.map((r) => ({
    keyword: r.keyword,
    keyword_norm: r.keyword.toLowerCase().trim(),
    url: r.url,
    source: 'Curated Resource List',
  }))

  const { data, error: insertError } = await supabase
    .from('keyword_links')
    .insert(rows)
    .select()

  if (insertError) {
    console.error('Error inserting keyword links:', insertError.message)
    process.exit(1)
  }

  console.log(`Successfully seeded ${data.length} curated keyword links!`)
}

seed()
