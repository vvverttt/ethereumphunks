import type { MenuLanguage } from '@/services/phunk-preferences.service';
import { CONTENT_EN } from './content.en';
import { CONTENT_ES } from './content.es';
import { CONTENT_JA } from './content.ja';
import { CONTENT_ZH } from './content.zh';
import { CONTENT_ID } from './content.id';

export interface FaqItem { q: string; a: string }

/**
 * The site's long-form copy, one object per language (content.<lang>.ts). Strings may carry
 * HTML (links, emphasis) and {placeholders}; they are rendered with [innerHTML] inside an
 * appInternalLinks container so href="/path" links route in-app.
 */
export interface Content {
  /** Per collection slug: the paragraphs before the type band (lead) and after it (more). */
  intro: Record<string, { lead: string[]; more: string[] }>;
  introCommon: {
    tradeDefault: string;
    /** {name}: collection name */
    etherphunksNote: string;
    /** {base} {listed} {bid} {escrow}: colour swatches */
    legend: string;
    /** {turtles}: the turtles link, {others}: the list of other animals */
    turtles: string;
    /** {list}: the list of types */
    across: string;
  };
  about: { hi: string; paras: string[]; imgAlt: string };
  /** total: {n} = number of collections */
  shell: { title: string; sub: string; intro: string; total: string; imgAlt: string };
  /** `default` plus one list per collection slug */
  faq: Record<string, FaqItem[]>;
}

export const CONTENT: Record<MenuLanguage, Content> = {
  en: CONTENT_EN,
  es: CONTENT_ES,
  ja: CONTENT_JA,
  zh: CONTENT_ZH,
  id: CONTENT_ID,
};
