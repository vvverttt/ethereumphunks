import { Pipe, PipeTransform } from '@angular/core';

import { DataService } from '@/services/data.service';
import { rarityData } from '@/constants/collections';

@Pipe({
  standalone: true,
  name: 'traitCount'
})

export class TraitCountPipe implements PipeTransform {

  constructor(private dataSvc: DataService) {}

  transform(value: string | { k: string, v: string }, slug: string): string {
    if (typeof value === 'object') {
      const key = `${value.k}:${value.v}`;
      const dynamicCount = this.dataSvc.rarityCache.get(slug)?.[key];
      if (dynamicCount !== undefined) return String(dynamicCount);
      return rarityData[slug]?.[key] ?? '';
    }
    // Legacy string fallback
    const dynamicCount = this.dataSvc.rarityCache.get(slug)?.[value];
    if (dynamicCount !== undefined) return String(dynamicCount);
    return rarityData[slug]?.[value] ?? '';
  }
}
