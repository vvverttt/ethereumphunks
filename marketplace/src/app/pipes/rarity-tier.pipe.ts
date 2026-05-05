import { Pipe, PipeTransform } from '@angular/core';

const RARITY_NAME_OVERRIDES: Record<string, string> = {
  'one of one':    'epic',
  'character':     'character-trait',
  'zombie':        'elite',
  'cosmic':        'cosmic',
  'mythic':        'mythic',
  'legendary':     'legendary',
  'exotic':        'exotic',
  'ultra':         'ultra',
  'ancient':       'ancient',
  'divine':        'divine',
  'infinity stone':'ancient',
  'alien':         'legendary',
  'cyborg':        'ultra',
  'power ranger':  'power-ranger',
  'xcopy':         'xcopy',
  'phunkism':            'phunkism',
  'alien invasion study':'alien-invasion',
};

@Pipe({ standalone: true, name: 'rarityTier' })
export class RarityTierPipe implements PipeTransform {
  transform(count: number | string, supply: number | undefined, name?: string): string {
    if (name) {
      const override = RARITY_NAME_OVERRIDES[name.toLowerCase().trim()];
      if (override) return override;
    }
    const c = +count;
    if (!c) return '';
    if (c === 1)    return 'one-of-one';
    if (c <= 8)     return 'mythic';
    if (c <= 20)    return 'exotic';
    if (c <= 40)    return 'legendary';
    if (c <= 70)    return 'ultra';
    if (c <= 120)   return 'epic';
    if (c <= 200)   return 'elite';
    if (c <= 350)   return 'rare';
    if (c <= 600)   return 'uncommon';
    return 'common';
  }
}

export function rarityLabel(tier: string): string {
  const labels: Record<string, string> = {
    'one-of-one': 'One of One', 'ancient': 'Ancient', 'mythic': 'Mythic',
    'god': 'God', 'exotic': 'Exotic', 'legendary': 'Legendary',
    'ultra': 'Ultra', 'ultra-rare': 'Ultra Rare', 'epic': 'Epic', 'elite': 'Elite',
    'rare': 'Rare', 'uncommon': 'Uncommon', 'common': 'Common',
  };
  return labels[tier] || tier.charAt(0).toUpperCase() + tier.slice(1);
}
