import { Pipe, PipeTransform } from '@angular/core';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';

/**
 * A fiat amount in the current language's currency (en USD, es MXN, ja JPY, zh CNY, id IDR),
 * with that currency's symbol and number style. The amount is already in that currency: the
 * store's `usd` is the price of 1 ETH in it (DataService refreshes it on a language switch).
 * Impure so a language switch re-renders it.
 */
@Pipe({ standalone: true, name: 'fiat', pure: false })
export class FiatPipe implements PipeTransform {
  constructor(private prefs: PhunkPreferencesService) {}

  transform(amount: number | null | undefined): string {
    const n = Number(amount) || 0;
    const currency = this.prefs.currency();
    const whole = currency === 'JPY' || currency === 'IDR';
    try {
      return new Intl.NumberFormat(this.prefs.currentLanguage(), {
        style: 'currency',
        currency,
        notation: n >= 10000 ? 'compact' : 'standard',
        maximumFractionDigits: whole ? 0 : 2,
        minimumFractionDigits: 0,
      }).format(n);
    } catch {
      return `${n.toFixed(2)} ${currency}`;
    }
  }
}
