// --- rank helpers ----------------------------------------------------------
const RANK_ORDER = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'] as const
const RANK_VAL: Record<string, number> = Object.fromEntries(RANK_ORDER.map((r, i) => [r, i + 2]))

function cardValueOf(c: any): number {
  // pokersolver Card usually has `.value` 2..14; fallback via rank char if needed
  if (typeof c?.value === 'number') return c.value
  const rankChar = String(c?.toString?.() ?? '').slice(0, 1).toUpperCase()
  return RANK_VAL[rankChar] ?? 0
}

function descendingValues(cards: any[]): number[] {
  return [...cards].map(cardValueOf).sort((a, b) => b - a)
}

function countByRank(cards: any[]): Map<number, number> {
  const m = new Map<number, number>()
  for (const c of cards) {
    const v = cardValueOf(c)
    m.set(v, (m.get(v) ?? 0) + 1)
  }
  return m
}

function firstDiffIndex(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return i
  }
  return -1
}

// Straight top (wheel A-5 -> top = 5)
function straightTopValue(cards: any[]): number {
  const vals = Array.from(new Set(descendingValues(cards))).sort((a, b) => b - a)
  // detect 5,4,3,2,A (treat A as 1)
  const hasA = vals.includes(14)
  const need = [5, 4, 3, 2]
  const hasWheel = need.every(v => vals.includes(v)) && hasA
  if (hasWheel) return 5
  // otherwise the first (largest) in the straight sequence equals the top
  // since pokersolver already selected best 5, the highest is the first
  return Math.max(...vals)
}

// --- category parsing ------------------------------------------------------
function camelizeHandName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join('')
}

function parseBase(key: string): { left: string; right: string } {
  const [l, r] = key.split('Vs')
  return { left: l, right: r[0].toLowerCase() + r.slice(1) }
}

// --- per-category refiners -------------------------------------------------
function refinePairVsPair(hand1: any, hand2: any, isTie: boolean): string {
  if (isTie) return 'pairVsLowerPairChop'

  // find pair rank in each 5-card best hand
  const h1 = countByRank(hand1.cards)
  const h2 = countByRank(hand2.cards)

  const h1Pair = [...h1.entries()].find(([, cnt]) => cnt === 2)?.[0] ?? 0
  const h2Pair = [...h2.entries()].find(([, cnt]) => cnt === 2)?.[0] ?? 0

  if (h1Pair !== h2Pair) {
    // winner has higher pair card
    return 'pairVsLowerPair'
  }

  // same pair rank → kickers decide (compare remaining three cards high→low)
  const h1Kickers = descendingValues(hand1.cards).filter(v => v !== h1Pair)
  const h2Kickers = descendingValues(hand2.cards).filter(v => v !== h2Pair)
  const diffIdx = firstDiffIndex(h1Kickers, h2Kickers)

  if (diffIdx === -1) return 'pairVsLowerPairChop'
  return 'pairVsPairKickerDecides'
}

function refineHighCardVsHighCard(hand1: any, hand2: any, isTie: boolean): string {
  if (isTie) return 'highCardVsCardChop'

  const a = descendingValues(hand1.cards)
  const b = descendingValues(hand2.cards)
  const diffIdx = firstDiffIndex(a, b)

  if (diffIdx === -1) return 'highCardVsCardChop'
  // if the very top card decided, call it LowerCard; else KickerDecides
  return diffIdx === 0 ? 'highCardVsLowerCard' : 'highCardVsHighCardKickerDecides'
}

function refineStraightVsStraight(hand1: any, hand2: any, isTie: boolean): string {
  if (isTie) return 'straightVsStraightChop'
  const t1 = straightTopValue(hand1.cards)
  const t2 = straightTopValue(hand2.cards)
  if (t1 !== t2) return 'straightVsLowerStraight'
  // Equal top card straights in Hold’em should chop; keep a fallback:
  return 'straightVsStraightChop'
}

// Generic fallback for equal-name categories we haven’t specialized yet.
// Tries: flush → compare high cards, full house/fourOAK → compare primary ranks,
// else: compare descending ranks as kickers/primary.
function refineGenericSameCategory(base: string, hand1: any, hand2: any, isTie: boolean): string {
  const name = base // e.g., "flushVsFlush", "fullHouseVsFullHouse"
  if (isTie) return `${name.replace('Vs', 'Vs')}Chop`

  const leftName = parseBase(base).left // e.g., "flush"
  switch (leftName) {
    case 'flush': {
      const a = descendingValues(hand1.cards)
      const b = descendingValues(hand2.cards)
      const d = firstDiffIndex(a, b)
      if (d === -1) return 'flushVsFlushChop'
      return 'flushVsLowerFlush'
    }
    case 'fullHouse': {
      // compare trips rank then pair rank
      const c1 = countByRank(hand1.cards)
      const c2 = countByRank(hand2.cards)
      const h1Trips = [...c1.entries()].find(([, cnt]) => cnt === 3)?.[0] ?? 0
      const h2Trips = [...c2.entries()].find(([, cnt]) => cnt === 3)?.[0] ?? 0
      if (h1Trips !== h2Trips) return 'fullHouseVsLowerFullHouse'
      const h1Pair = [...c1.entries()].find(([, cnt]) => cnt === 2)?.[0] ?? 0
      const h2Pair = [...c2.entries()].find(([, cnt]) => cnt === 2)?.[0] ?? 0
      if (h1Pair !== h2Pair) return 'fullHouseVsLowerFullHouse'
      return 'fullHouseVsFullHouseChop'
    }
    case 'fourOfAKind': {
      const c1 = countByRank(hand1.cards)
      const c2 = countByRank(hand2.cards)
      const h1Quad = [...c1.entries()].find(([, cnt]) => cnt === 4)?.[0] ?? 0
      const h2Quad = [...c2.entries()].find(([, cnt]) => cnt === 4)?.[0] ?? 0
      if (h1Quad !== h2Quad) return 'fourOfAKindVsLowerFourOfAKind'
      // kicker decides among the 5th card
      const a = descendingValues(hand1.cards).filter(v => v !== h1Quad)
      const b = descendingValues(hand2.cards).filter(v => v !== h2Quad)
      const d = firstDiffIndex(a, b)
      if (d === -1) return 'fourOfAKindVsLowerFourOfAKindChop'
      return 'fourOfAKindVsFourOfAKindKickerDecides'
    }
    case 'threeOfAKind': {
      const c1 = countByRank(hand1.cards)
      const c2 = countByRank(hand2.cards)
      const h1Trips = [...c1.entries()].find(([, cnt]) => cnt === 3)?.[0] ?? 0
      const h2Trips = [...c2.entries()].find(([, cnt]) => cnt === 3)?.[0] ?? 0
      if (h1Trips !== h2Trips) return 'threeOfAKindVsLowerThreeOfAKind'
      const a = descendingValues(hand1.cards).filter(v => v !== h1Trips)
      const b = descendingValues(hand2.cards).filter(v => v !== h2Trips)
      const d = firstDiffIndex(a, b)
      if (d === -1) return 'threeOfAKindVsThreeOfAKindChop'
      return 'threeOfAKindVsThreeOfAKindKickerDecides'
    }
    case 'twoPair': {
      // gather pair ranks high→low, then kicker
      const pairsAndRest = (h: any) => {
        const cnt = countByRank(h.cards)
        const pairs = [...cnt.entries()].filter(([, c]) => c === 2).map(([v]) => v).sort((a, b) => b - a)
        const kicker = [...cnt.entries()].filter(([, c]) => c === 1).map(([v]) => v).sort((a, b) => b - a)
        return { pairs, kicker }
      }
      const A = pairsAndRest(hand1)
      const B = pairsAndRest(hand2)
      // compare highest pair, then second pair
      const pDiff = firstDiffIndex(A.pairs, B.pairs)
      if (pDiff !== -1) return 'twoPairVsLowerTwoPair'
      // pairs equal → kicker decides
      const kDiff = firstDiffIndex(A.kicker, B.kicker)
      if (kDiff === -1) return 'twoPairVsTwoPairChop'
      return 'twoPairVsTwoPairKickerDecides'
    }
    default: {
      // generic compare by descending values
      const a = descendingValues(hand1.cards)
      const b = descendingValues(hand2.cards)
      const d = firstDiffIndex(a, b)
      if (d === -1) return `${leftName}Vs${leftName[0].toUpperCase()}${leftName.slice(1)}Chop`
      return `${leftName}Vs${leftName[0].toUpperCase()}${leftName.slice(1)}KickerDecides`
    }
  }
}

// --- main API --------------------------------------------------------------
/**
 * Refine a winner-first category key (e.g., "pairVsPair") into a more specific label:
 * - "...KickerDecides" | "...LowerX" | "...Chop"
 * Only applies when both sides are the same base name; otherwise returns base key.
 */
export function refineSameRankCategory(baseKeyWinnerFirst: string, hand1Winner: any, hand2Loser: any, isTie: boolean): string {
  const { left, right } = parseBase(baseKeyWinnerFirst)
  if (left !== right) return baseKeyWinnerFirst

  switch (left) {
    case 'pair':        return refinePairVsPair(hand1Winner, hand2Loser, isTie)
    case 'highCard':    return refineHighCardVsHighCard(hand1Winner, hand2Loser, isTie)
    case 'straight':    return refineStraightVsStraight(hand1Winner, hand2Loser, isTie)
    default:            return refineGenericSameCategory(baseKeyWinnerFirst, hand1Winner, hand2Loser, isTie)
  }
}