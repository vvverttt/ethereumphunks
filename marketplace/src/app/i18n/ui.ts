import type { MenuLanguage } from '@/services/phunk-preferences.service';
import { UI_EN } from './ui.en';
import { UI_ES } from './ui.es';
import { UI_JA } from './ui.ja';
import { UI_ZH } from './ui.zh';
import { UI_ID } from './ui.id';

/** Site-wide interface strings added after the menu table (footer, intros, pages). */
export const UI: Record<MenuLanguage, Record<string, string>> = {
  en: UI_EN,
  es: UI_ES,
  ja: UI_JA,
  zh: UI_ZH,
  id: UI_ID,
};
