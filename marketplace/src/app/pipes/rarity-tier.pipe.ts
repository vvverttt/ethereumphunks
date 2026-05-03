import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ standalone: true, name: 'rarityTier' })
export class RarityTierPipe implements PipeTransform {
  transform(count: number | string, supply: number | undefined): string {
    const c = +count;
    const s = supply || 0;
    if (!c || !s) return '';
    const pct = (c / s) * 100;
    if (pct <= 0.15)  return 'ancient';
    if (pct <= 0.28)  return 'god';
    if (pct <= 0.32)  return 'mythic';
    if (pct <= 0.35)  return 'exotic';
    if (pct <= 0.38)  return 'legendary';
    if (pct <= 0.60)  return 'ultra';
    if (pct <= 0.80)  return 'epic';
    if (pct <= 1.3)   return 'very-rare';
    if (pct <= 2.0)   return 'rare';
    if (pct <= 2.5)   return 'uncommon';
    return 'common';
  }
}

export function rarityLabel(tier: string): string {
  const labels: Record<string, string> = {
    'god-tier': 'God Tier', 'divine': 'Divine', 'ancient': 'Ancient',
    'mythic': 'Mythic', 'god': 'God', 'exotic': 'Exotic',
    'legendary': 'Legendary', 'ultra': 'Ultra', 'epic': 'Epic',
    'very-rare': 'Very Rare', 'rare': 'Rare', 'uncommon': 'Uncommon', 'common': 'Common',
  };
  return labels[tier] || tier.charAt(0).toUpperCase() + tier.slice(1);
}
