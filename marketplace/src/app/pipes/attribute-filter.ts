import { Pipe, PipeTransform } from '@angular/core';
import { Phunk } from '@/models/db';
import { TraitFilter } from '@/models/global-state';

/**
 * Pipe that filters an array of Phunks based on their attributes
 *
 * Takes an array of Phunks and active trait filters and returns a filtered array
 * containing only Phunks that match all the specified trait criteria.
 *
 * @example
 * // Input phunks: Array of Phunk objects
 * // Input filters: { "Type": "Alien", "trait-count": "7" }
 * // Usage in template: *ngFor="let phunk of phunks | attributeFilter:activeFilters"
 */
@Pipe({
  standalone: true,
  name: 'attributeFilter'
})
export class AttributeFilterPipe implements PipeTransform {

  /**
   * Filters an array of Phunks based on trait filters
   * @param value - Array of Phunks to filter
   * @param activeTraitFilters - Object containing active trait filters
   * @returns Filtered array of Phunks that match all trait criteria
   */
  transform(value: Phunk[], activeTraitFilters: TraitFilter | null): Phunk[] {
    if (!value) return [];
    if (!activeTraitFilters) return value;

    // Create copy of filters and remove address field since it's handled separately
    const traitFilters: TraitFilter = { ...activeTraitFilters };
    delete traitFilters['address'];

    let filtered = value;
    const filtersLength = Object.keys(traitFilters).length;
    const traitCountFilter = traitFilters['trait-count'];

    // Handle trait count filter if present
    if (traitCountFilter !== undefined) {
      const traitCount = Number(Array.isArray(traitCountFilter) ? traitCountFilter[0] : traitCountFilter);
      filtered = filtered.filter((res) => {
        // Add 2 to account for Name and Description attributes
        return res.attributes && (res.attributes.length === traitCount + 2);
      });
    }

    // Handle other trait filters
    if (filtersLength > 1 || (filtersLength === 1 && traitCountFilter === undefined)) {
      filtered = filtered.filter((res: Phunk) => {
        if (!res.attributes) return false;

        // Check each filter. AND across trait keys, OR within a key when several
        // values are selected (the multi-select checkbox case).
        return Object.entries(traitFilters).every(([key, value]) => {
          // Skip trait-count as it's handled separately
          if (key === 'trait-count') return true;

          const wanted = (Array.isArray(value) ? value : [value]).filter(v => v != null) as string[];
          if (!wanted.length) return true;

          // Find ALL attributes with matching key (a phunk can have multiple attrs with same key)
          const matchingAttrs = res.attributes?.filter(attr => attr?.k === key);

          return wanted.some((want) => {
            // Handle "none" case
            if (want === 'none') return !matchingAttrs || matchingAttrs.length === 0;

            // Check if any matching attribute has the target value
            return matchingAttrs?.some(attr => {
              if (Array.isArray(attr?.v)) return attr.v.includes(want);
              return attr?.v === want;
            }) ?? false;
          });
        });
      });
    }

    return filtered;
  }
}
