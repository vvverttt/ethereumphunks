import { Pipe, PipeTransform } from '@angular/core';

/**
 * A token's number as the site shows it. EthsRocks are stored 0, -1 … -105 and read as
 * negatives ("-77"), except the first, which is plain "0" rather than "-0". Every other
 * collection shows its id as is.
 */
export function tokenNumber(tokenId: number | null | undefined, slug?: string | null): string {
  const abs = Math.abs(tokenId ?? 0);
  return slug === 'ethsrocks' && abs !== 0 ? '-' + abs : String(abs);
}

@Pipe({
  standalone: true,
  name: 'tokenNumber'
})
export class TokenNumberPipe implements PipeTransform {
  transform(tokenId: number | null | undefined, slug?: string | null): string {
    return tokenNumber(tokenId, slug);
  }
}
