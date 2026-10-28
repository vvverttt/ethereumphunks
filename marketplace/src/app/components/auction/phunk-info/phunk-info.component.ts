import { Component, EventEmitter, Input, OnChanges, Output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DataService } from '@/services/data.service';
import { TraitCountPipe } from '@/pipes/trait-count.pipe';
import { RarityTierPipe } from '@/pipes/rarity-tier.pipe';
import { Attribute } from '@/models/attributes';
import { tokenNumber } from '@/pipes/token-number.pipe';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';

@Component({
  selector: 'app-phunk-info',
  standalone: true,
  imports: [CommonModule, TraitCountPipe, RarityTierPipe],
  templateUrl: './phunk-info.component.html',
  styleUrls: ['./phunk-info.component.scss'],
})
export class PhunkInfoComponent implements OnChanges {
  private readonly prefs = inject(PhunkPreferencesService);

  /** Interface strings in the current language (see i18n/ui.en.ts). */
  t(key: string, params?: Record<string, string | number>): string {
    return this.prefs.t(key, params);
  }


  @Input() collectionName = '';
  @Input() tokenId = 0;
  @Input() slug = '';
  @Input() sha = '';
  @Input() poolSize = 0;
  @Input() canGoPrev = false;
  @Input() canGoNext = false;

  @Output() prevAuction = new EventEmitter<void>();
  @Output() nextAuction = new EventEmitter<void>();

  attributes = signal<Attribute[]>([]);

  /**
   * Big token-id shown next to the collection name. EthsRocks use the "-N"
   * convention (e.g. "0", "-77") to match the auction slider and breadcrumbs;
   * every other collection shows the plain (absolute) id.
   */
  get displayTokenId(): string {
    return tokenNumber(this.tokenId, this.slug);
  }

  constructor(private dataSvc: DataService) {}

  ngOnChanges() {
    if (this.slug && this.sha) {
      this.loadAttributes();
    }
  }

  // Slugs already re-read this visit (see loadAttributes).
  private refreshed = new Set<string>();

  private loadAttributes() {
    const slug = this.slug, sha = this.sha;
    this.dataSvc.getAttributes(slug).subscribe(attrItem => {
      if (attrItem?.[sha]) { this.showAttributes(attrItem[sha]); return; }
      this.attributes.set([]);
      // Not in this device's copy — a file cached before the item was added (a new drop). Read
      // it fresh, once per collection per visit, so the traits still show.
      if (this.refreshed.has(slug)) return;
      this.refreshed.add(slug);
      this.dataSvc.refreshAttributes(slug).subscribe(fresh => {
        if (fresh?.[sha] && this.sha === sha) this.showAttributes(fresh[sha]);
      });
    });
  }

  private showAttributes(attrs: Attribute[]) {
    // Sort: "Sex"/"Type" first
    const sorted = [...attrs].sort((a, b) => {
      if (a.k === 'Sex' || a.k === 'Type') return -1;
      if (b.k === 'Sex' || b.k === 'Type') return 1;
      return 0;
    });
    this.attributes.set(sorted);
  }
}
