import { Component, effect, input, signal, untracked, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { LazyLoadImageModule } from 'ng-lazyload-image';

import { Phunk } from '@/models/db';
import { DecodedData } from '@/models/ethscriptions';

import { EthscriptionService } from '@/services/ethscription.service';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';

@Component({
  selector: 'app-phunk-billboard',
  standalone: true,
  imports: [
    CommonModule,
    LazyLoadImageModule,
    RouterModule
  ],
  templateUrl: './phunk-billboard.component.html',
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

  constructor(
    private ethscriptionSvc: EthscriptionService
  ) {
    effect(() => {
      const phunk = this.phunk();
      if (!phunk) return;

      untracked(async () => {
        const data = await this.ethscriptionSvc.processImage(phunk);
        this.contentData.set(data);
      });
    });
  }
}
