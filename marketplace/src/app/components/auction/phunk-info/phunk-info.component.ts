import { Component, EventEmitter, Input, OnChanges, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DataService } from '@/services/data.service';
import { TraitCountPipe } from '@/pipes/trait-count.pipe';
import { Attribute } from '@/models/attributes';

@Component({
  selector: 'app-phunk-info',
  standalone: true,
  imports: [CommonModule, TraitCountPipe],
  templateUrl: './phunk-info.component.html',
  styleUrls: ['./phunk-info.component.scss'],
})
export class PhunkInfoComponent implements OnChanges {

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

  constructor(private dataSvc: DataService) {}

  ngOnChanges() {
    if (this.slug && this.sha) {
      this.loadAttributes();
    }
  }

  private loadAttributes() {
    this.dataSvc.getAttributes(this.slug).subscribe(attrItem => {
      if (attrItem && attrItem[this.sha]) {
        const attrs = attrItem[this.sha];
        // Sort: "Sex"/"Type" first
        const sorted = [...attrs].sort((a, b) => {
          if (a.k === 'Sex' || a.k === 'Type') return -1;
          if (b.k === 'Sex' || b.k === 'Type') return 1;
          return 0;
        });
        this.attributes.set(sorted);
      } else {
        this.attributes.set([]);
      }
    });
  }
}
