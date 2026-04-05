import { Component, Input, OnChanges, SimpleChanges, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { environment } from 'src/environments/environment';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(environment.supabaseUrl, environment.supabaseKey);

interface MosaicItem {
  hashId: string;
  sha: string;
  tokenId: number;
  listed: boolean;
}

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule],
  selector: 'app-mosaic',
  template: `
    @if (allItems.length) {
      <div
        class="mosaic-viewport"
        #viewport
        (mousedown)="onDragStart($event)"
        (touchstart)="onTouchStart($event)">
        <div class="mosaic-grid" [style.--cols]="cols">
          @for (item of allItems; track item.hashId) {
            <a
              class="mosaic-item"
              [class.listed]="item.listed"
              [routerLink]="isDragging ? null : ['details', item.hashId]"
              (click)="onItemClick($event)"
              [title]="'#' + item.tokenId">
              <img
                [src]="getImageUrl(item)"
                loading="lazy"
                decoding="async"
                draggable="false"
              />
            </a>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .mosaic-viewport {
      overflow: auto;
      max-height: 500px;
      cursor: grab;
      user-select: none;
      -webkit-overflow-scrolling: touch;

      &:active {
        cursor: grabbing;
      }

      /* Hide scrollbar but keep scrolling */
      scrollbar-width: none;
      &::-webkit-scrollbar { display: none; }
    }

    .mosaic-grid {
      display: grid;
      grid-template-columns: repeat(var(--cols, 50), 1fr);
      gap: 0;
      width: 100%;
    }

    .mosaic-item {
      display: block;
      aspect-ratio: 1;
      overflow: hidden;
      background: #c3ff00;

      &.listed {
        background: #ff04b4;
      }

      img {
        display: block;
        width: 100%;
        height: 100%;
        image-rendering: pixelated;
        pointer-events: none;
      }

      &:hover {
        outline: 2px solid #fff;
        z-index: 1;
        position: relative;
      }
    }
  `]
})
export class MosaicComponent implements OnChanges {
  @Input() slug = '';
  @ViewChild('viewport') viewport!: ElementRef<HTMLDivElement>;

  allItems: MosaicItem[] = [];
  cols = 50;
  isDragging = false;

  private dragStartX = 0;
  private dragStartY = 0;
  private scrollStartX = 0;
  private scrollStartY = 0;
  private hasMoved = false;

  private mouseMoveHandler = (e: MouseEvent) => this.onDragMove(e);
  private mouseUpHandler = () => this.onDragEnd();

  async ngOnChanges(changes: SimpleChanges) {
    if (changes['slug'] && this.slug) {
      await this.loadAll();
    }
  }

  onDragStart(e: MouseEvent) {
    this.isDragging = true;
    this.hasMoved = false;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.scrollStartX = this.viewport.nativeElement.scrollLeft;
    this.scrollStartY = this.viewport.nativeElement.scrollTop;
    document.addEventListener('mousemove', this.mouseMoveHandler);
    document.addEventListener('mouseup', this.mouseUpHandler);
  }

  onDragMove(e: MouseEvent) {
    const dx = e.clientX - this.dragStartX;
    const dy = e.clientY - this.dragStartY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.hasMoved = true;
    this.viewport.nativeElement.scrollLeft = this.scrollStartX - dx;
    this.viewport.nativeElement.scrollTop = this.scrollStartY - dy;
  }

  onDragEnd() {
    document.removeEventListener('mousemove', this.mouseMoveHandler);
    document.removeEventListener('mouseup', this.mouseUpHandler);
    setTimeout(() => this.isDragging = false, 0);
  }

  onTouchStart(e: TouchEvent) {
    // Let native touch scroll handle it
  }

  onItemClick(e: MouseEvent) {
    if (this.hasMoved) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  private async loadAll() {
    const items: any[] = [];
    let offset = 0;
    while (true) {
      const { data } = await supabase
        .from('ethscriptions')
        .select('hashId,sha,tokenId')
        .eq('slug', this.slug)
        .order('tokenId')
        .range(offset, offset + 999);
      if (!data?.length) break;
      items.push(...data);
      if (data.length < 1000) break;
      offset += 1000;
    }

    const { data: listings } = await supabase
      .from('listings')
      .select('hashId')
      .eq('listed', true);
    const listedSet = new Set((listings || []).map((l: any) => l.hashId));

    this.allItems = items.map(item => ({
      ...item,
      listed: listedSet.has(item.hashId),
    }));

    const count = items.length;
    if (count <= 70) this.cols = 10;
    else if (count <= 250) this.cols = 25;
    else this.cols = 50;
  }

  getImageUrl(item: MosaicItem): string {
    return environment.staticUrl + '/static/images/' + item.sha;
  }
}
