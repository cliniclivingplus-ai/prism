// Old PDF imports sometimes decoded list bullets as U+FFFD. Only remove
// unambiguous markers: a known symbol-font bullet, an ingredient marker
// before an explicit quantity, or a direction marker before an action.
// Never strip unknown glyphs inside quantities/words (e.g. "� cup", "2�3").
export function cleanRecipeBankDisplayText(text: string, kind: 'ingredients' | 'steps'): string {
  return text.split('\n').map((line) => {
    const withoutBullet = line.replace(/^(\s*)[\uF0B7\uF0A7]\s*/, '$1')
    if (kind === 'ingredients') return withoutBullet.replace(/^(\s*)\uFFFD\s+(?=\d)/, '$1')
    return withoutBullet.replace(/^(\s*)\uFFFD\s+(?=(?:Soak|Using|Use|Peel|Chop|Mix|Spread|Once|Add|Heat|Cook|Stir|Blend|Grind|Wash|Rinse|Drain|Place|Pour|Bring|Boil|Steam|Bake|Roast|Remove|Allow|Let|Serve|Combine|Transfer|Preheat|Prepare|Cut|Take|Put|Keep|Sprinkle|Garnish|Cover|Simmer|Fold|Whisk|Beat|Roll|Knead|Squeeze|Set|Turn|Repeat)\b)/i, '$1')
  }).join('\n')
}
