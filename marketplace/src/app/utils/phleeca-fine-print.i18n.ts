import { PHLEECA_FINE_PRINT, PHLEECA_SELL_SHAME } from './phleeca-fine-print';
import { FINE_PRINT_ES, SELL_SHAME_ES } from './phleeca-fine-print.es';
import { FINE_PRINT_JA, SELL_SHAME_JA } from './phleeca-fine-print.ja';
import { FINE_PRINT_ZH, SELL_SHAME_ZH } from './phleeca-fine-print.zh';
import { FINE_PRINT_ID, SELL_SHAME_ID } from './phleeca-fine-print.id';

/**
 * Phleeca Bank's fine print and sell shame in the visitor's language. Each language file keeps the
 * English order and counts, so one shuffled deck (indices) works in every language and a language
 * switch just swaps the words. A language whose list doesn't line up falls back to English.
 */
const FINE: Record<string, string[]> = {
  en: PHLEECA_FINE_PRINT,
  es: FINE_PRINT_ES,
  ja: FINE_PRINT_JA,
  zh: FINE_PRINT_ZH,
  id: FINE_PRINT_ID,
};
const SHAME: Record<string, string[][]> = {
  en: PHLEECA_SELL_SHAME.map(t => t.lines),
  es: SELL_SHAME_ES,
  ja: SELL_SHAME_JA,
  zh: SELL_SHAME_ZH,
  id: SELL_SHAME_ID,
};

export function finePrintLine(lang: string, i: number): string {
  const l = FINE[lang];
  return (l && l.length === PHLEECA_FINE_PRINT.length ? l : FINE['en'])[i] ?? '';
}

export function sellShameLine(lang: string, tier: number, k: number): string {
  const tiers = SHAME[lang];
  const en = SHAME['en'][tier];
  const l = tiers?.[tier]?.length === en.length ? tiers[tier] : en;
  return l[k % l.length];
}
