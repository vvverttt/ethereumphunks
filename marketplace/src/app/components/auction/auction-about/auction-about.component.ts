import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { PhunkPreferencesService } from '@/services/phunk-preferences.service';

/**
 * The text that used to be the auction pop-up, written into the page under the auction history
 * instead (after the CryptoPhunks auction house this was forked from): the story on the left with
 * a drop cap.
 */
@Component({
  selector: 'app-auction-about',
  standalone: true,
  imports: [],
  templateUrl: './auction-about.component.html',
  styleUrls: ['./auction-about.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuctionAboutComponent {
  private readonly prefs = inject(PhunkPreferencesService);

  /** Which house this sits on. */
  house = input.required<'ethscriptions' | 'erc721'>();
  /** The auction house contract. */
  address = input.required<string>();

  t(key: string, params?: Record<string, string | number>): string {
    return this.prefs.t(key, params);
  }

  /** Story paragraphs; the first one gets the drop cap. */
  paragraphs = computed(() => {
    this.prefs.currentLanguage();
    return this.house() === 'erc721'
      ? [this.t('introPhunkmas'), this.t('a721Rules')]
      : [this.t('introForked'), this.t('introPhunklloween')];
  });
}
