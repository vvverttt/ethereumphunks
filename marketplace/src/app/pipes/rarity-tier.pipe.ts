import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ standalone: true, name: 'rarityTier' })
export class RarityTierPipe implements PipeTransform {
  transform(count: number | string, supply: number | undefined): string {
    const c = +count;
    const s = supply || 0;
    if (!c || !s) return '';
    const pct = (c / s) * 100;
    if (c === 1)      return 'one-of-one';
    if (pct <= 0.1)   return 'mythic';
    if (pct <= 0.3)   return 'legendary';
    if (pct <= 0.7)   return 'epic';
    if (pct <= 2)     return 'rare';
    if (pct <= 10)    return 'uncommon';
    return 'common';
  }
}

export function rarityLabel(tier: string): string {
  if (tier === 'one-of-one') return 'One of One';
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}
