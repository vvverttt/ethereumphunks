import { Injectable, WritableSignal, signal } from '@angular/core';

import { environment } from 'src/environments/environment';

/** Where a sha sits: which sheet, and its column/row within that sheet. */
export interface SpriteTile {
  sheet: number;
  col: number;
  row: number;
}

interface SpriteIndex {
  tile: number;
  cols: number;
  chunk: number;
  prefix: number;
  count: number;
  /** Fixed-width sha prefixes concatenated; ordinal position is the tile index. */
  shas: string;
}

/**
 * Resolves a sha to a position in a pre-built sprite sheet.
 *
 * The bundled build ships ~9.4k images of 24x24 art. One file each made a grid page
 * cost 250 requests and made the folder impossible to pin on a free tier, so
 * `build-sprite.mjs` packs them into 19 sheets of 512 tiles and an index. Tiles are
 * ordered by collection then token id, so a page of consecutive items usually needs
 * a single sheet.
 *
 * Sprites are an optimisation, never the only source. Where the index is absent (the
 * Cloudflare Pages build, which still points at Supabase) or a sha is not in it (the
 * oversized rock art, a few GIFs), callers fall back to the per-file URL and behave
 * exactly as before.
 */
@Injectable({ providedIn: 'root' })
export class SpriteService {

  /** Flips once the index has loaded, so views can re-render with sprites in place. */
  readonly ready = signal(false);

  private index: SpriteIndex | null = null;
  private lookup = new Map<string, number>();
  private sheetLoads = new Map<number, Promise<void>>();
  private sheetAttempts = new Map<number, WritableSignal<number>>();
  private sheetImages = new Map<number, Promise<HTMLImageElement>>();
  private tileUrls = new Map<string, string>();

  private readonly base = environment.staticUrl;
  private readonly enabled = !!(environment as any).sprites;

  /** Build generation. Bumping the app version retires every cached sheet and index. */
  private readonly gen = environment.version;

  /**
   * Settles when the index has loaded (or failed). Anything resolving a sha to a URL
   * must await this: the per-file images the sheets replaced are deleted from the
   * build, so a lookup that runs before the index arrives falls back to a URL that
   * 404s. That is what stopped the splash art loading — it asks for bytes during
   * startup, well before the index is back.
   */
  private readonly loaded: Promise<void>;

  constructor() {
    this.loaded = this.enabled ? this.load() : Promise.resolve();
  }

  /**
   * Settles when the index is in. Callers must await this before concluding a sha is
   * NOT sheet-backed: until the index lands, `tile()` returns null for everything.
   */
  whenLoaded(): Promise<void> {
    return this.loaded;
  }

  private async load(): Promise<void> {
    try {
      // Versioned, and deliberately NOT force-cache. The index and the sheets are one
      // unit: a cached index read against a newer build's sheets maps every sha to the
      // wrong tile, which shows as art from entirely the wrong collection. Tying both
      // to the app version means a new build can never read the previous generation.
      const res = await fetch(`${this.base}/static/sprite.json?v=${this.gen}`);
      if (!res.ok) return;
      const idx: SpriteIndex = await res.json();
      if (!idx?.shas || !idx.prefix) return;

      // One string of fixed-width prefixes rather than an array: the full 64-char
      // hashes cost 614 KB, this costs 73 KB.
      for (let i = 0; i < idx.count; i++) {
        this.lookup.set(idx.shas.substr(i * idx.prefix, idx.prefix), i);
      }
      this.index = idx;
      this.ready.set(true);
    } catch {
      // Any failure just means every tile keeps using its own file.
    }
  }

  /** The tile for a sha, or null when it should be loaded as its own file. */
  tile(sha: string | null | undefined): SpriteTile | null {
    if (!sha || !this.index) return null;
    const i = this.lookup.get(sha.slice(0, this.index.prefix));
    if (i === undefined) return null;

    const within = i % this.index.chunk;
    return {
      sheet: Math.floor(i / this.index.chunk),
      col: within % this.index.cols,
      row: Math.floor(within / this.index.cols),
    };
  }

  /**
   * A sheet's URL, carrying its retry counter.
   *
   * Reading the counter here is deliberate: it is a signal, so a tile's binding
   * re-evaluates when a retry bumps it and the browser refetches instead of sitting
   * on a cached failure.
   */
  sheetUrl(sheet: number): string {
    const n = this.attemptOf(sheet)();
    return `${this.base}/static/sprite-${sheet}.png?v=${this.gen}` + (n ? `&r=${n}` : '');
  }

  private attemptOf(sheet: number) {
    let s = this.sheetAttempts.get(sheet);
    if (!s) {
      s = signal(0);
      this.sheetAttempts.set(sheet, s);
    }
    return s;
  }

  /**
   * Resolves once a sheet has decoded, so a tile can drop its placeholder at the
   * right moment rather than flashing empty art. Every tile on a sheet shares one
   * promise, and the browser collapses the requests into a single fetch anyway.
   *
   * Retries matter more here than they did per-file. Each sheet holds 512 tiles of
   * consecutive token ids, so one unreachable sheet blanks a whole contiguous range
   * rather than a single tile — and the individual files it replaced are gone, so
   * there is nothing to fall back to. Observed live: an IPFS gateway briefly failed
   * one sheet and ~500 consecutive phunks vanished.
   */
  loadSheet(sheet: number): Promise<void> {
    let p = this.sheetLoads.get(sheet);
    if (!p) {
      p = new Promise<void>((resolve) => {
        const attempt = (n: number) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => {
            if (n >= 4) return resolve(); // give up; the cell stays empty
            setTimeout(() => {
              this.attemptOf(sheet).set(n + 1); // re-renders every tile on this sheet
              attempt(n + 1);
            }, 500 * (n + 1) + Math.floor(Math.random() * 300));
          };
          img.src = this.sheetUrl(sheet);
        };
        attempt(this.attemptOf(sheet)());
      });
      this.sheetLoads.set(sheet, p);
    }
    return p;
  }

  /**
   * A usable image URL for a sha, for the call sites that need a plain string rather
   * than an element: canvas drawing, notification art, anything assigning to `[src]`.
   *
   * When the sha is in a sheet this cuts the tile out once and caches the data URL;
   * otherwise it returns the per-file URL unchanged. One-off images only — the grid
   * uses PhunkImageComponent, which paints straight from the sheet with no per-tile
   * work at all.
   */
  async url(sha: string | null | undefined): Promise<string> {
    if (!sha) return 'assets/loadingphunk.png';

    // Never decide before the index is in — see `loaded`.
    await this.loaded;

    const cached = this.tileUrls.get(sha);
    if (cached) return cached;

    const fileUrl = `${(environment as any).imageCdnUrl || this.base}/static/images/${sha}`;
    const t = this.tile(sha);
    if (!t) return fileUrl;

    try {
      const sheet = await this.sheetImage(t.sheet);
      const size = this.index!.tile;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return fileUrl;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sheet, t.col * size, t.row * size, size, size, 0, 0, size, size);
      const out = canvas.toDataURL('image/png');
      this.tileUrls.set(sha, out);
      return out;
    } catch {
      return fileUrl;
    }
  }

  /** The decoded sheet element, kept so repeated slicing does not re-decode it. */
  private sheetImage(sheet: number): Promise<HTMLImageElement> {
    let p = this.sheetImages.get(sheet);
    if (!p) {
      p = new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`sheet ${sheet} failed to load`));
        img.src = this.sheetUrl(sheet);
      });
      this.sheetImages.set(sheet, p);
    }
    return p;
  }

  /** Columns (and rows) per sheet — the grid is square. */
  get cols(): number {
    return this.index?.cols ?? 1;
  }

  /** Rows per sheet, derived from how many tiles each sheet holds. */
  get rows(): number {
    if (!this.index) return 1;
    return Math.ceil(this.index.chunk / this.index.cols);
  }
}
