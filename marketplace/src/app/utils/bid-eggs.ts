import { formatEther } from 'viem';

/**
 * Bid amounts that spell something. `digits` flip one by one into `word` when they're the
 * same length (calculator words); otherwise the word appears under the digits.
 */
export interface BidEgg {
  key: string;
  digits: string;
  word: string;
  caption: string;
  /** Matched against the bid's significant digits (Ξ0.008008135 -> "8008135"). */
  test: (sig: string) => boolean;
  /** How the egg appears in the written amount, to put the word right under those digits. */
  patterns: string[];
  /** An amount that triggers it, for the ?egg= preview. */
  sample: string;
}

export const BID_EGGS: BidEgg[] = [
  { key: 'boobies', digits: '8008135', word: 'BOOBIES', caption: '8008135 on a calculator.',
    test: (s) => s.includes('8008135') || s.includes('5318008'), patterns: ['8008135', '5318008'], sample: '0.008008135' },
  { key: 'boobs', digits: '80085', word: 'BOOBS', caption: '80085 on a calculator.',
    test: (s) => s.includes('80085') || s.includes('58008'), patterns: ['80085', '58008'], sample: '0.0080085' },
  { key: 'boob', digits: '8008', word: 'BOOB', caption: '8008 on a calculator.',
    test: (s) => s.includes('8008'), patterns: ['8008'], sample: '0.08008' },
  { key: 'boss', digits: '8055', word: 'BOSS', caption: '8055 on a calculator.',
    test: (s) => s.includes('8055'), patterns: ['8055'], sample: '0.08055' },
  { key: 'hell', digits: '7734', word: 'HELL', caption: '7734 upside down.',
    test: (s) => s.includes('7734'), patterns: ['7734'], sample: '0.07734' },
  { key: 'sos', digits: '505', word: 'SOS', caption: '505 on a calculator.',
    test: (s) => s === '505', patterns: ['505'], sample: '0.0505' },
  { key: 'leet', digits: '1337', word: 'LEET', caption: 'Elite bid.',
    test: (s) => s.includes('1337'), patterns: ['1337'], sample: '0.01337' },
  { key: 'sixseven', digits: '67', word: 'SIX SEVEN', caption: '6 7.',
    test: (s) => s === '67', patterns: ['67'], sample: '0.067' },
  { key: 'nice', digits: '69', word: 'NICE', caption: 'The funny number.',
    test: (s) => s === '69', patterns: ['69'], sample: '0.069' },
  { key: 'answer', digits: '42', word: 'THE ANSWER', caption: 'To life, the universe and everything.',
    test: (s) => s === '42', patterns: ['42'], sample: '0.042' },
  { key: 'pi', digits: '3.14159', word: 'π', caption: 'An irrational bid.',
    test: (s) => s.startsWith('314159'), patterns: ['3.14159', '314159'], sample: '0.0314159' },
];

/** The egg a bid amount (wei, or an ETH string like "0.008008135") spells, if any. */
export function bidEgg(amount: bigint | string | null | undefined): BidEgg | null {
  if (amount === null || amount === undefined || amount === '') return null;
  const eth = typeof amount === 'bigint' ? formatEther(amount) : amount;
  const sig = eth.replace('.', '').replace(/^0+/, '').replace(/0+$/, '');
  return sig ? BID_EGGS.find((e) => e.test(sig)) ?? null : null;
}

/** An amount split around the digits that spell its egg: before, the digits, after, the word. */
export interface BidEggParts { before: string; match: string; after: string; word: string; line: string; }

export function bidEggParts(amount: bigint | string | null | undefined): BidEggParts | null {
  const egg = bidEgg(amount);
  if (!egg) return null;
  const eth = typeof amount === 'bigint' ? formatEther(amount) : String(amount);
  for (const pat of egg.patterns) {
    const i = eth.indexOf(pat);
    if (i >= 0) return { before: eth.slice(0, i), match: pat, after: eth.slice(i + pat.length), word: egg.word, line: eggLineFor(eth) };
  }
  return { before: eth, match: '', after: '', word: egg.word, line: eggLineFor(eth) };
}

/** The lines shown with an egg: one at random in the pop-up, one fixed per bid under the amount. */
export const EGG_LINES = [
  'A true calculator warrior.',
  'Fingers of a legend.',
  'The ancient art, performed flawlessly.',
  'Warriors type it on the first try.',
  'History will remember this bid.',
  'Respect. Pure respect.',
  "Bid like nobody's watching.",
  'The council of calculators approves.',
  'Forged in the fires of math class.',
  'A bid for the ages.',
  'Your ancestors are proud.',
  'Legends never die. They bid.',
  'Built different.',
  'The prophecy is fulfilled.',
  'Hall of fame material.',
  'Ten out of ten. No notes.',
  'Main character energy.',
  'Peak craftsmanship.',
  'The keypad bows to you.',
  'Unmatched. Unbothered. Unbeaten.',
];

// Bids that keep a chosen line: the first BOOBIES, on Phunklloween #10400.
const PINNED_LINES: Record<string, string> = {
  '0.008008135': 'The keypad bows to you.',
};

/** The same line every time for the same bid, so the label under it doesn't change on refresh. */
export function eggLineFor(seed: string): string {
  if (PINNED_LINES[seed]) return PINNED_LINES[seed];
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return EGG_LINES[h % EGG_LINES.length];
}
