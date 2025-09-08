import { writeFile } from 'fs/promises'
import { resolve } from 'path'

export async function generateHandCategoryTypeWithCounts(
  store: Record<string, any[]>, // your matchup store
  outFile: string = resolve(process.cwd(), 'hand-categories.ts'),
): Promise<void> {
  // weakest → strongest
  const order = [
    'highCard',
    'pair',
    'twoPair',
    'threeOfAKind',
    'straight',
    'flush',
    'fullHouse',
    'fourOfAKind',
    'straightFlush',
    'royalFlush',
  ] as const

  const rankIndex: Record<string, number> = Object.fromEntries(order.map((k, i) => [k, i]))
  const toLowerCamel = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s)
  const parseSide = (side: string) => rankIndex[toLowerCamel(side)] ?? Number.POSITIVE_INFINITY
  const keys = Object.keys(store)

  // helper stays simple; assume "Vs" is present here
  const splitVs = (key: string) => {
    const [left, rightRaw] = key.split('Vs')
    // strip common suffixes from the right side for ordering
    const right = rightRaw.replace(/(Chop|KickerDecides|Lower[A-Z][a-zA-Z0-9]*)$/, '')
    return { left, right: toLowerCamel(right) }
  }
  
  const sorted = keys.sort((a, b) => {
    const aHasVs = a.includes('Vs')
    const bHasVs = b.includes('Vs')
  
    // put non-Vs (e.g., onBoard...Chop) at the bottom
    if (aHasVs && !bHasVs) return -1
    if (!aHasVs && bHasVs) return 1
  
    // both non-Vs → just lexicographic (kept at bottom anyway)
    if (!aHasVs && !bHasVs) return a.localeCompare(b)
  
    // both have Vs → rank-based ordering
    const A = splitVs(a)
    const B = splitVs(b)
    const aL = parseSide(A.left)
    const aR = parseSide(A.right)
    const bL = parseSide(B.left)
    const bR = parseSide(B.right)
  
    if (aL !== bL) return aL - bL
    if (aR !== bR) return aR - bR
    return a.localeCompare(b)
  })

  const counts: Record<string, number> = {}
  for (const k of sorted) counts[k] = store[k]?.length ?? 0

  // ⬅️ compute totals
  const totalCategories = Object.keys(store).length
  const totalHands = Object.values(store).reduce(
    (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
    0,
  )

  const fileContents =
    `// AUTO-GENERATED. Do not edit manually.\n` +
    `// Sorted by (left, right) poker strength: weak → strong.\n\n` +
    `export const HAND_CATEGORIES = ${JSON.stringify(sorted, null, 2)} as const;\n` +
    `export type HandCategory = typeof HAND_CATEGORIES[number];\n\n` +
    `export const HAND_CATEGORY_COUNTS: Record<HandCategory, number> = ${JSON.stringify(
      counts,
      null,
      2,
    )};\n\n` +
    `export const TOTAL_CATEGORIES = ${totalCategories};\n` +
    `export const TOTAL_HANDS = ${totalHands};\n`

  await writeFile(outFile, fileContents, 'utf8')
}