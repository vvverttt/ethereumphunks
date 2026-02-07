import { Pipe, PipeTransform } from '@angular/core';

import { DataService } from '@/services/data.service';
import { rarityData } from '@/constants/collections';

@Pipe({
  standalone: true,
  name: 'traitCount'
})

export class TraitCountPipe implements PipeTransform {

  constructor(private dataSvc: DataService) {}

  transform(value: string, slug: string): string {
    // Try dynamic cache first (works for all collections), fall back to hardcoded data
    const dynamicCount = this.dataSvc.rarityCache.get(slug)?.[value];
    if (dynamicCount !== undefined) return String(dynamicCount);
    return rarityData[slug]?.[value] ?? '';
  }
}
