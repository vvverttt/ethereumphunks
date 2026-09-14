import { Component, ElementRef, OnDestroy, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SpriteService } from '@/services/sprite.service';

import { environment } from 'src/environments/environment';

/**
 * Caps how many tiles may fetch their own file at once.
 *
 * Sheet-backed art needs no gate — one request paints 512 tiles. But the ~133 images
 * too large or too animated to pack still load individually, and a page of them
 * (ethsrocks is 106 at roughly 60 KB each) fires the lot in one burst. The .eth.limo
 * gateway answers a burst with HTTP 429, which broke images and, when it caught a JS
 * chunk or the stylesheet, took the whole page down with "page isn't working".
 *
 * Six matches what a browser would allow over HTTP/1.1 to one host, and is low enough
 * that the gateway does not start shedding.
 */
const ImageGate = (() => {
  const MAX = 6;
  let active = 0;
  const waiting: (() => void)[] = [];
  return {
    acquire(): Promise<void> {
      if (active < MAX) { active++; return Promise.resolve(); }
      return new Promise<void>((resolve) => waiting.push(resolve));
    },
    release(): void {
      const next = waiting.shift();
      if (next) next();          // hand the slot straight over
      else active = Math.max(0, active - 1);
    },
  };
})();

/**
 * Draws one phunk by sha, from a sprite sheet where possible and from its own file
 * otherwise.
 *
 * Every view used to render `<img [src]="staticUrl + '/static/images/' + sha">`. That
 * cost one request per tile, which Supabase answered with HTTP 429 for roughly half a
 * 250-tile grid page, and it forced the IPFS bundle to carry 9,497 separate files.
 * Sheets fix both: a page now pulls one ~270 KB image instead of 250 small ones.
 *
 * Two deliberate details:
 *
 * - The sprite is on a child element, not on `.image-wrapper`. That wrapper already
 *   uses its own background for the loading placeholder and for the listing/bid/escrow
 *   status colours, so painting the art there would fight with them.
 * - `img-loaded` is applied to the PARENT on settle, which is the contract the existing
 *   stylesheets already expect. Keeping it means none of the per-view SCSS changes.
 */
@Component({
  selector: 'app-phunk-image',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (tile(); as t) {
      <div
        class="sprite-tile"
        [style.background-image]="'url(' + spriteSvc.sheetUrl(t.sheet) + ')'"
        [style.background-size]="backgroundSize()"
        [style.background-position]="backgroundPosition(t)"></div>
    } @else {
      <img
        [src]="src()"
        [alt]="alt()"
        loading="lazy"
        decoding="async"
        (load)="settle()"
        (error)="retry($event)" />
    }
  `,
  styles: [`
    /* Square by aspect-ratio, not height 100%.
     *
     * The markup this replaced was an img with width and height attributes, inside a
     * wrapper that set width 100% and left height to the image. A host of height 100%
     * resolves against that auto height and collapses to zero, which blanked the
     * activity rows entirely. Deriving height from width reproduces what the img did
     * and works whether or not the parent has a definite height. */
    :host {
      display: block;
      width: 100%;
      aspect-ratio: 1 / 1;
    }

    .sprite-tile {
      width: 100%;
      height: 100%;
      background-repeat: no-repeat;
      image-rendering: pixelated;
    }

    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
      image-rendering: pixelated;
    }
  `],
})
export class PhunkImageComponent implements OnDestroy {

  readonly sha = input<string | null | undefined>(null);
  readonly alt = input<string>('');

  readonly spriteSvc = inject(SpriteService);
  private readonly el = inject(ElementRef<HTMLElement>);

  /** Bumped by the retry ladder so `src` recomputes with a fresh cache-busting query. */
  private readonly attempt = signal(0);

  readonly tile = computed(() => {
    // Touch `ready` so the first render after the index arrives swaps to sprites.
    this.spriteSvc.ready();
    return this.spriteSvc.tile(this.sha());
  });

  readonly src = computed(() => {
    const sha = this.sha();
    if (!sha) return 'assets/loadingphunk.png';
    // Hold until a slot is free, so a page of unpacked art cannot flood the gateway.
    if (!this.slot()) return 'assets/loadingphunk.png';
    const cdn = (environment as any).imageCdnUrl || environment.staticUrl;
    const n = this.attempt();
    return `${cdn}/static/images/${sha}` + (n ? `?r=${n}` : '');
  });

  /** Granted once this tile is allowed to start its own request. */
  private readonly slot = signal(false);

  constructor() {
    // Wait for the index before deciding. Until it lands `tile()` is null for every
    // sha, so deciding early made all 250 tiles on a page queue for one of six gate
    // slots; the sheet-backed ones then switched to sprites and never released, and
    // the handful that genuinely needed a slot waited forever on the placeholder.
    void (async () => {
      await this.spriteSvc.whenLoaded();
      if (this.destroyed) return;

      const t = this.tile();
      if (t) {
        // Sheet-backed: one request serves 512 tiles, so no gate is needed. Drop the
        // placeholder once the sheet has actually decoded.
        void this.spriteSvc.loadSheet(t.sheet).then(() => this.settle());
        return;
      }
      // Its own file. Queue for a slot rather than starting immediately.
      await ImageGate.acquire();
      if (this.destroyed) { ImageGate.release(); return; }
      this.slot.set(true);
    })();
  }

  private destroyed = false;

  /** A scrolled-away tile must hand its slot back, or the queue drains to a halt. */
  ngOnDestroy(): void {
    this.destroyed = true;
    this.release();
  }

  /** Frees this tile's slot for the next queued one, at most once. */
  private release(): void {
    if (!this.slot() || this.released) return;
    this.released = true;
    ImageGate.release();
  }

  private released = false;

  /** Marks the tile painted so the wrapper's placeholder background is dropped. */
  settle(): void {
    this.release();
    this.el.nativeElement.parentElement?.classList.add('img-loaded');
  }

  /**
   * A blank tile on the file path is always a transient fetch failure (single-host
   * connection cap, CDN throttle), never a missing image, so retry with backoff
   * before giving up. Only reachable for shas outside the sheets.
   */
  retry(e: Event): void {
    const n = this.attempt();
    if (n >= 4) {
      (e.target as HTMLImageElement).src = 'assets/loadingphunk.png';
      this.settle();
      return;
    }
    // Exponential, not linear. The gateway answers a burst with HTTP 429, and a
    // linear retry re-floods it while it is still shedding load.
    const wait = 600 * Math.pow(2, n) + Math.floor(Math.random() * 400);
    setTimeout(() => this.attempt.set(n + 1), wait);
  }

  backgroundSize(): string {
    return `${this.spriteSvc.cols * 100}% ${this.spriteSvc.rows * 100}%`;
  }

  /**
   * Percentage positioning rather than pixels, so one sheet serves every display size
   * the app uses (50px grid cells, large item art) with no per-call-site maths.
   */
  backgroundPosition(t: { col: number; row: number }): string {
    const x = this.spriteSvc.cols > 1 ? (t.col / (this.spriteSvc.cols - 1)) * 100 : 0;
    const y = this.spriteSvc.rows > 1 ? (t.row / (this.spriteSvc.rows - 1)) * 100 : 0;
    return `${x}% ${y}%`;
  }
}
