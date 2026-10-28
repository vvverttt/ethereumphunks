import { Injectable } from '@angular/core';
import { TimeagoFormatter } from 'ngx-timeago';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';

/**
 * ngx-timeago's default formatter only speaks English ("3 hours ago"). This one uses the
 * browser's Intl.RelativeTimeFormat in the site's current language, so every `| timeago`
 * follows the language switch.
 */
@Injectable()
export class LangTimeagoFormatter extends TimeagoFormatter {
  constructor(private prefs: PhunkPreferencesService) { super(); }

  format(then: number): string {
    const secs = Math.round((then - Date.now()) / 1000);
    const abs = Math.abs(secs);
    const [value, unit]: [number, Intl.RelativeTimeFormatUnit] =
      abs < 60 ? [secs, 'second'] :
      abs < 3600 ? [Math.round(secs / 60), 'minute'] :
      abs < 86400 ? [Math.round(secs / 3600), 'hour'] :
      abs < 2592000 ? [Math.round(secs / 86400), 'day'] :
      abs < 31536000 ? [Math.round(secs / 2592000), 'month'] :
      [Math.round(secs / 31536000), 'year'];
    try {
      return new Intl.RelativeTimeFormat(this.prefs.currentLanguage(), { numeric: 'auto' }).format(value, unit);
    } catch {
      return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(value, unit);
    }
  }
}
