import { Component, ElementRef, EventEmitter, Input, Output, ViewChild, signal, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TimeAgoPipe } from '@/pipes/time-ago.pipe';
import { SettledAuction } from '@/services/auction.service';

@Component({
  selector: 'app-auction-slider',
  standalone: true,
  imports: [CommonModule, TimeAgoPipe],
  templateUrl: './auction-slider.component.html',
  styleUrls: ['./auction-slider.component.scss'],
})
export class AuctionSliderComponent implements OnChanges {

  @Input() settledAuctions: SettledAuction[] = [];
  private hasScrolledOnce = false;

  @Output() selectAuction = new EventEmitter<number>();

  @ViewChild('sliderTrack') sliderTrack!: ElementRef<HTMLDivElement>;

  canScrollLeft = signal(false);
  canScrollRight = signal(false);

  ngOnChanges(changes: SimpleChanges) {
    if (changes['settledAuctions'] && this.settledAuctions.length > 0 && !this.hasScrolledOnce) {
      this.hasScrolledOnce = true;
      // Scroll to rightmost (newest) after DOM renders
      setTimeout(() => {
        const el = this.sliderTrack?.nativeElement;
        if (el) {
          el.scrollLeft = el.scrollWidth;
          this.onScroll();
        }
      });
    }
  }

  scrollLeft() {
    this.sliderTrack?.nativeElement.scrollBy({ left: -300, behavior: 'smooth' });
  }

  scrollRight() {
    this.sliderTrack?.nativeElement.scrollBy({ left: 300, behavior: 'smooth' });
  }

  onScroll() {
    const el = this.sliderTrack?.nativeElement;
    if (!el) return;
    this.canScrollLeft.set(el.scrollLeft > 0);
    this.canScrollRight.set(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }

  bgColors = signal<Record<number, string>>({});
  accentColors = signal<Record<number, string>>({});

  // Dark base matching the hero section
  private readonly BASE_R = 17;
  private readonly BASE_G = 26;
  private readonly BASE_B = 0;

  onImageLoad(event: Event, auctionId: number) {
    const img = event.target as HTMLImageElement;
    try {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const bg = ctx.getImageData(0, 0, 1, 1).data;
      const data = ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight).data;
      const accent = this.findAccent(data, bg[0], bg[1], bg[2]);

      if (accent) {
        this.accentColors.update(prev => ({ ...prev, [auctionId]: `rgb(${accent.r}, ${accent.g}, ${accent.b})` }));
        // Blend accent at 15% over dark base — same as hero section
        const br = Math.round(this.BASE_R + (accent.r - this.BASE_R) * 0.15);
        const bg2 = Math.round(this.BASE_G + (accent.g - this.BASE_G) * 0.15);
        const bb = Math.round(this.BASE_B + (accent.b - this.BASE_B) * 0.15);
        this.bgColors.update(prev => ({ ...prev, [auctionId]: `rgb(${br}, ${bg2}, ${bb})` }));
      } else {
        this.bgColors.update(prev => ({ ...prev, [auctionId]: `rgb(${this.BASE_R}, ${this.BASE_G}, ${this.BASE_B})` }));
      }
    } catch {}
  }

  private findAccent(pixels: Uint8ClampedArray, bgR: number, bgG: number, bgB: number): { r: number; g: number; b: number } | null {
    const map = new Map<string, { r: number; g: number; b: number; count: number; sat: number }>();
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
      if (a < 128) continue;
      if (Math.abs(r - bgR) < 15 && Math.abs(g - bgG) < 15 && Math.abs(b - bgB) < 15) continue;
      if (r < 30 && g < 30 && b < 30) continue;
      if (r > 230 && g > 230 && b > 230) continue;
      const key = `${r},${g},${b}`;
      const ex = map.get(key);
      if (ex) { ex.count++; } else {
        const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255;
        const l = (mx + mn) / 2;
        const sat = mx === mn ? 0 : (l <= 0.5 ? (mx - mn) / (mx + mn) : (mx - mn) / (2 - mx - mn));
        map.set(key, { r, g, b, count: 1, sat });
      }
    }
    let bestR = 0, bestG = 0, bestB = 0, bestScore = -1;
    for (const [, c] of map) {
      if (c.count < 3) continue;
      const score = c.sat * Math.log(c.count + 1);
      if (score > bestScore) { bestR = c.r; bestG = c.g; bestB = c.b; bestScore = score; }
    }
    return bestScore > 0 ? { r: bestR, g: bestG, b: bestB } : null;
  }

}
