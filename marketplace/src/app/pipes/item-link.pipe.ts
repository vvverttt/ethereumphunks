import { Pipe, PipeTransform } from '@angular/core';

import { itemRouterLink } from '@/constants/erc721c';

/**
 * Resolves the correct /details routerLink for an item:
 * tokenId-based for ERC-721C collections, hashId-based otherwise.
 * Usage:  [routerLink]="phunk | itemLink"
 */
@Pipe({ name: 'itemLink', standalone: true })
export class ItemLinkPipe implements PipeTransform {
  transform(item: { slug?: string | null; hashId?: string | null; tokenId?: number | null } | null | undefined): any[] {
    return itemRouterLink(item || undefined);
  }
}
