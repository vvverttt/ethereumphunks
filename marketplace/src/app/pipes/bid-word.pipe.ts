import { Pipe, PipeTransform } from '@angular/core';

import { BidEggParts, bidEgg, bidEggParts } from '@/utils/bid-eggs';

/** The word a bid amount spells (BOOBIES for Ξ0.008008135), or '' when it spells nothing. */
@Pipe({
  standalone: true,
  name: 'bidWord'
})
export class BidWordPipe implements PipeTransform {
  transform(amount: bigint | string | null | undefined): string {
    return bidEgg(amount)?.word ?? '';
  }
}

/** The amount split around the digits that spell a word, for showing the word right under them. */
@Pipe({
  standalone: true,
  name: 'bidEggParts'
})
export class BidEggPartsPipe implements PipeTransform {
  transform(amount: bigint | string | null | undefined): BidEggParts | null {
    return bidEggParts(amount);
  }
}
