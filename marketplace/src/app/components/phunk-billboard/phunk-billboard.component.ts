import { Component, effect, input, signal, untracked, inject, ChangeDetectionStrategy } from '@angular/core';

import { RouterModule } from '@angular/router';

import { LazyLoadImageModule } from 'ng-lazyload-image';

import { Phunk } from '@/models/db';
import { DecodedData } from '@/models/ethscriptions';

import { EthscriptionService } from '@/services/ethscription.service';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';
import { animationFor } from '@/utils/phunk-animation';

@Component({
  selector: 'app-phunk-billboard',
  standalone: true,
  imports: [
    LazyLoadImageModule,
    RouterModule
],
  templateUrl: './phunk-billboard.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./phunk-billboard.component.scss']
})
export class PhunkBillboardComponent {
  private readonly prefs = inject(PhunkPreferencesService);

  /** Interface strings in the current language (see i18n/ui.en.ts). */
  t(key: string, params?: Record<string, string | number>): string {
    return this.prefs.t(key, params);
  }


  phunk = input.required<Phunk | null>();
  contentData = signal<DecodedData | null>(null);

  /** Phunkmas creation animation (bundled GIF), or null for pieces without one. */
  anim = signal<string | null>(null);
  /** 0 still, 1 creation animation, 2 mirror */
  view = signal<0 | 1 | 2>(0);
  flipped = signal(false);
  /** bumps each time the animation is picked, so it restarts from the first frame */
  playKey = signal(0);

  pick(v: 0 | 1 | 2) {
    this.view.set(v);
    this.flipped.set(v === 2);
    if (v === 1) this.playKey.update((k) => k + 1);
  }

  constructor(
    private ethscriptionSvc: EthscriptionService
  ) {
    effect(() => {
      const phunk = this.phunk();
      if (!phunk) return;

      untracked(async () => {
        this.anim.set(null); this.view.set(0); this.flipped.set(false);
        const data = await this.ethscriptionSvc.processImage(phunk);
        this.contentData.set(data);
        this.anim.set(await animationFor(phunk));
      });
    });
  }
}
