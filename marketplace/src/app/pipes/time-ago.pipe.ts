import { Pipe, PipeTransform } from '@angular/core';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';

@Pipe({
  standalone: true,
  name: 'timeAgo'
})
export class TimeAgoPipe implements PipeTransform {

  constructor(private preferences: PhunkPreferencesService) {}

  transform(timestamp: number): string {
    if (!timestamp) return '';
    const seconds = Math.floor(Date.now() / 1000 - timestamp);
    if (seconds < 60) return `${seconds}${this.preferences.t('secondsAgo')}`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}${this.preferences.t('minutesAgo')}`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}${this.preferences.t('hoursAgo')}`;
    return `${Math.floor(seconds / 86400)}${this.preferences.t('daysAgo')}`;
  }
}
