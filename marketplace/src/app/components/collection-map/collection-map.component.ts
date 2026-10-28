import { Component, ElementRef, HostListener, Input, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

/**
 * A pan-and-zoom map of a whole collection, like cryptopunks.app's: one pre-built image of every
 * piece in token order (scripts/build-v67-map.py), so it loads a single file and queries nothing.
 * It works like theirs: it opens zoomed in (each piece at its real 24px), never zooms out past
 * the edges, a click zooms in on that spot, a double-click zooms out, click-and-hold drags it,
 * and the buttons zoom, go home and go fullscreen. Once the pieces are big enough to aim at
 * (64px), a click opens the one under it. The
 * wheel is left to the page so scrolling past the map is never trapped.
 */
@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-collection-map',
  template: `
    <div class="map" #map [style.height.px]="boxH()"
      (pointerdown)="down($event)" (pointermove)="move($event)" (pointerup)="up($event)" (pointercancel)="up($event)">
      <!-- Status colours under the (transparent) map, in the site's own system (the same theme
           variables the market grids use): listed and active-bid tiles take --listed-color and
           --bid-color; the rest show the page's tile colour. -->
      <div class="marks"
        [style.width.px]="size * scale()" [style.height.px]="size * rows / cols * scale()"
        [style.transform]="'translate(' + x() + 'px,' + y() + 'px)'">
        @for (m of marks; track m.i) {
          <i [class]="m.kind"
            [style.left.%]="(m.i % cols) * 100 / cols" [style.top.%]="Math.floor(m.i / cols) * 100 / rows"
            [style.width.%]="100 / cols" [style.height.%]="100 / rows"></i>
        }
      </div>
      <img [src]="src" alt="" draggable="false" [class.smooth]="smooth" loading="lazy" decoding="async" (load)="home()"
        [style.width.px]="size * scale()" [style.height.px]="size * rows / cols * scale()"
        [style.transform]="'translate(' + x() + 'px,' + y() + 'px)'" />
      <div class="controls" (pointerdown)="$event.stopPropagation()">
        <!-- Drawn icons, centred on a 16-unit grid (text glyphs sit off-centre in a button). -->
        <button type="button" (click)="zoomBy(2)" aria-label="Zoom in">
          <svg viewBox="0 0 16 16"><path d="M7 3h2v4h4v2H9v4H7V9H3V7h4z"/></svg>
        </button>
        <button type="button" (click)="zoomBy(1 / 2)" aria-label="Zoom out">
          <svg viewBox="0 0 16 16"><path d="M3 7h10v2H3z"/></svg>
        </button>
        <button type="button" (click)="home()" aria-label="Back to the start">
          <svg viewBox="0 0 16 16"><path d="M8 2l6 6h-2v6H9v-4H7v4H4V8H2z"/></svg>
        </button>
        <button type="button" (click)="fullscreen()" aria-label="Fullscreen">
          <svg viewBox="0 0 16 16"><path d="M2 2h5v2H4v3H2zm7 0h5v5h-2V4H9zM2 9h2v3h3v2H2zm10 0h2v5H9v-2h3z"/></svg>
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .map {
      position: relative;
      overflow: hidden;
      cursor: grab;
      touch-action: none;
      user-select: none;
      background: rgba(var(--phunk-bg), 1);
      &:active { cursor: grabbing; }
      &:fullscreen { height: 100vh !important; }
    }
    .marks {
      position: absolute;
      top: 0;
      left: 0;
      transform-origin: 0 0;
      pointer-events: none;
      i { position: absolute; }
      .listed { background: rgba(var(--listed-color), 1); }
      .bid { background: rgba(var(--bid-color), 1); }
    }
    img {
      position: absolute;
      top: 0;
      left: 0;
      max-width: none;
      transform-origin: 0 0;
      image-rendering: pixelated;
      pointer-events: none;
      &.smooth { image-rendering: auto; }
    }
    .controls {
      position: absolute;
      top: 1rem;
      left: 1rem;
      display: flex;
      gap: .4rem;
      button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 3.2rem;
        height: 3.2rem;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: rgba(0, 0, 0, .55);
        cursor: pointer;
        &:hover { background: rgba(0, 0, 0, .8); }
        svg { width: 1.6rem; height: 1.6rem; fill: rgba(var(--white), 1); }
      }
    }
  `],
})
export class CollectionMapComponent {
  @Input({ required: true }) src!: string;
  @Input() cols = 100;
  @Input() rows = 100;
  /** Painted art (EthsRocks): scale smoothly instead of pixel-sharp. */
  @Input() smooth = false;
  /** Source tile size in px for a smooth map; zoom stops there so the art is never upscaled. */
  @Input() tile = 24;
  /** Pieces to colour by status, by position in the map (0-based). */
  @Input() marks: { i: number; kind: 'listed' | 'bid' }[] = [];
  readonly Math = Math;
  /** Route for a clicked piece, from its position in the map (1-based, token order). */
  @Input() link: ((n: number) => any[] | string | null) | null = null;

  @ViewChild('map', { static: true }) mapRef!: ElementRef<HTMLDivElement>;

  /** Image width in px at scale 1 (one map pixel per art pixel: 24px tiles). */
  get size() { return this.cols * 24; }
  /** The box is never taller than the map: a 3-row collection gets a 3-row strip. */
  readonly boxH = signal(460);
  readonly scale = signal(.5);
  readonly x = signal(0);
  readonly y = signal(0);

  private drag: { id: number; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null = null;

  constructor(private router: Router) {}

  private get box() { return this.mapRef.nativeElement.getBoundingClientRect(); }

  /** Smallest zoom at which the image still covers the whole box: no empty edges. */
  private minScale() {
    const b = this.box;
    const bh = document.fullscreenElement ? b.height : this.boxH();
    return Math.max(b.width / this.size, bh / (this.size * this.rows / this.cols));
  }

  private measure() {
    if (document.fullscreenElement) return;
    const max = window.innerWidth <= 800 ? 320 : 460;
    this.boxH.set(Math.round(Math.min(max, this.box.width * this.rows / this.cols)));
  }

  /** The opening view: each piece at least its real 24px, from the top-left like cryptopunks.app. */
  home() {
    this.measure();
    this.scale.set(Math.max(1, this.minScale()));
    this.x.set(0);
    this.y.set(0);
    this.clamp();
  }

  zoomBy(f: number, cx?: number, cy?: number) {
    const b = this.box;
    const px = cx ?? b.width / 2, py = cy ?? b.height / 2;
    const old = this.scale();
    const min = this.minScale();
    // pixel art can zoom past its pixels; a painted map stops at its own resolution
    const max = this.smooth ? Math.max(min, this.tile / 24) : Math.max(4, min * 4);
    const next = Math.min(max, Math.max(min, old * f));
    // keep the point under the cursor in place
    this.x.set(px - (px - this.x()) * next / old);
    this.y.set(py - (py - this.y()) * next / old);
    this.scale.set(next);
    this.clamp();
  }

  private clamp() {
    const b = this.box, w = this.size * this.scale(), h = w * this.rows / this.cols, bh = document.fullscreenElement ? b.height : this.boxH();
    const cx = (lo: number, v: number, hi: number) => Math.min(hi, Math.max(lo, v));
    this.x.set(cx(Math.min(0, b.width - w), this.x(), 0));
    this.y.set(cx(Math.min(0, bh - h), this.y(), 0));
  }

  down(e: PointerEvent) {
    this.mapRef.nativeElement.setPointerCapture(e.pointerId);
    this.drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: this.x(), oy: this.y(), moved: false };
  }

  move(e: PointerEvent) {
    const d = this.drag;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    this.x.set(d.ox + dx);
    this.y.set(d.oy + dy);
    this.clamp();
  }

  private clickTimer: ReturnType<typeof setTimeout> | null = null;

  up(e: PointerEvent) {
    const d = this.drag;
    this.drag = null;
    if (!d || d.moved || e.type === 'pointercancel') return;
    const b = this.box, px = e.clientX - b.left, py = e.clientY - b.top;
    // a second click soon after the first is a double-click: zoom out instead
    if (this.clickTimer) {
      clearTimeout(this.clickTimer);
      this.clickTimer = null;
      this.zoomBy(1 / 2, px, py);
      return;
    }
    this.clickTimer = setTimeout(() => {
      this.clickTimer = null;
      // zoom in until the pieces are big enough to aim at, then a click opens the one under it
      const tile = this.size * this.scale() / this.cols;
      if (tile < 64) { this.zoomBy(2, px, py); return; }
      if (!this.link) return;
      const col = Math.floor((px - this.x()) / tile), row = Math.floor((py - this.y()) / tile);
      if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return;
      const to = this.link(row * this.cols + col + 1);
      if (to) this.router.navigateByUrl(typeof to === 'string' ? to : this.router.createUrlTree(to));
    }, 250);
  }

  fullscreen() {
    const el = this.mapRef.nativeElement;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.();
  }

  @HostListener('document:fullscreenchange')
  onFullscreen() { setTimeout(() => this.zoomBy(1), 50); }

  @HostListener('window:resize')
  onResize() { this.measure(); this.clamp(); }
}
