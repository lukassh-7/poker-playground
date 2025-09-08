// poker-demo.ts (ESM)
import { Hand } from 'pokersolver';
import { pathToFileURL } from 'url';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { generateHandCategoryTypeWithCounts } from './generate-hand-categories';
import { refineSameRankCategory } from './refine-categories';

const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const suits = ['h', 's', 'd', 'c'];

// ---- helpers --------------------------------------------------------------
const createDeck = () => ranks.flatMap((r) => suits.map((s) => r + s));

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// "Four of a Kind" -> "fourOfAKind", "High Card" -> "highCard"
function camelizeHandName(name: string, keepFirstCapital: boolean = false): string {
  const parts = name
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, '')
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return '';

  const first = keepFirstCapital ? parts[0][0].toUpperCase() + parts[0].slice(1) : parts[0];

  return (
    first +
    parts
      .slice(1)
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join('')
  );
}

function categoryKey(hand1Name: string, hand2Name: string): string {
  return `${camelizeHandName(hand1Name)}Vs${camelizeHandName(hand2Name, true)}`;
}

/**
 * Ensures category key is WinnerVsLoser and swaps p1/p2 so p1 is the winner's hole cards.
 * If it's a tie, keeps original order.
 */
function normalizeWinnerFirst(
  hand1: any,
  hand2: any,
  player1: string[],
  player2: string[],
): { key: string; p1: string[]; p2: string[]; isTie: boolean } {
  const winners = Hand.winners([hand1, hand2])

  // tie → keep original order and key
  if (winners.length !== 1) {
    return {
      key: `${camelizeHandName(hand1.name)}Vs${camelizeHandName(hand2.name, true)}`,
      p1: player1,
      p2: player2,
      isTie: true,
    }
  }

  const winner = winners[0]
  const winnerIsP1 = winner === hand1

  const leftName = winnerIsP1 ? hand1.name : hand2.name
  const rightName = winnerIsP1 ? hand2.name : hand1.name

  const key = `${camelizeHandName(leftName)}Vs${camelizeHandName(rightName, true)}`
  const p1 = winnerIsP1 ? player1 : player2
  const p2 = winnerIsP1 ? player2 : player1

  return { key, p1, p2, isTie: false }
}

type Deal = { board: string[]; p1: string[]; p2: string[] };
type MatchupStore = Record<string, Deal[]>;

const OUTPUT_PATH = resolve(process.cwd(), 'output/matchups.json');
const MAX_PER_CATEGORY = 100;

// ---- core -----------------------------------------------------------------
function generateRandomHands() {
  const deck = shuffle(createDeck());
  const board = deck.splice(0, 5);
  const player1 = deck.splice(0, 2);
  const player2 = deck.splice(0, 2);

  const hand1 = Hand.solve([...board, ...player1]);
  const hand2 = Hand.solve([...board, ...player2]);

  return { board, player1, player2, hand1, hand2 };
}

async function loadStore(): Promise<MatchupStore> {
  if (!existsSync(OUTPUT_PATH)) return {};
  try {
    const raw = await readFile(OUTPUT_PATH, 'utf8');
    const json = JSON.parse(raw);
    if (json && typeof json === 'object' && !Array.isArray(json)) return json as MatchupStore;
    return {};
  } catch {
    return {};
  }
}

async function saveStore(store: MatchupStore): Promise<void> {
  await writeFile(OUTPUT_PATH, JSON.stringify(store, null, 2), 'utf8');
  await generateHandCategoryTypeWithCounts(store, resolve(process.cwd(), 'output/hand-categories.ts'));
}

export async function demonstrateSolver(runs = 1): Promise<void> {
  const start = Date.now() // ⬅️ start timer

  const store = await loadStore()

  for (let i = 0; i < runs; i++) {
    const { board, player1, player2, hand1, hand2 } = generateRandomHands()

    // winner-first normalization (as you already have)
    const norm = normalizeWinnerFirst(hand1, hand2, player1, player2)

    // refine when both sides are same category (pair vs pair, etc.)
    const detailedKey = refineSameRankCategory(norm.key, norm.isTie ? hand1 : (norm.p1 === player1 ? hand1 : hand2), norm.isTie ? hand2 : (norm.p1 === player1 ? hand2 : hand1), norm.isTie)

    if (!store[detailedKey]) store[detailedKey] = []

    if (store[detailedKey].length < MAX_PER_CATEGORY) {
      store[detailedKey].push({ board, p1: norm.p1, p2: norm.p2 })
    }
  }

  await saveStore(store)
  await generateHandCategoryTypeWithCounts(store, resolve(process.cwd(), 'hand-categories.ts'))
  
  const end = Date.now() // ⬅️ end timer
  const ms = end - start

  console.log(
    `Saved matchups and updated hand-categories.ts (execution time: ${ms} ms)`
  )
}

// ---- CLI entry ------------------------------------------------------------
let isDirectRun = false;
try {
  // ESM-safe check
  const thisUrl: string = import.meta.url;
  isDirectRun =
    typeof process !== 'undefined' &&
    Array.isArray(process.argv) &&
    process.argv.length > 1 &&
    pathToFileURL(process.argv[1]).href === thisUrl;
} catch {
  // CJS fallback
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const req = typeof require !== 'undefined' ? require : null;
  isDirectRun = !!(req && req.main === module);
}

if (isDirectRun) {
  void (async () => {
    // pass an optional runs count: `node poker-demo.js 1000`
    const runs = Number(process.argv[2] ?? '1');
    await demonstrateSolver(Number.isFinite(runs) && runs > 0 ? runs : 1);
  })();
}
