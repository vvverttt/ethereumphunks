import { Injectable, signal } from '@angular/core';

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
  private sheetImages = new Map<number, Promise<HTMLImageElement>>();
  private tileUrls = new Map<string, string>();

  private readonly base = environment.staticUrl;
  private readonly enabled = !!(environment as any).sprites;

  constructor() {
    if (this.enabled) void this.load();
  }

  private async load(): Promise<void> {
    try {
      const res = await fetch(`${this.base}/static/sprite.json`, { cache: 'force-cache' });
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

  sheetUrl(sheet: number): string {
    return `${this.base}/static/sprite-${sheet}.png`;
  }

  /**
   * Resolves once a sheet has decoded, so a tile can drop its placeholder at the
   * right moment rather than flashing empty art. Every tile on a sheet shares one
   * promise, and the browser collapses the requests into a single fetch anyway.
   */
  loadSheet(sheet: number): Promise<void> {
    let p = this.sheetLoads.get(sheet);
    if (!p) {
      p = new Promise<void>((resolve) => {
        const img = new Image();
        // Resolve on error too: a tile revealing a blank cell beats one stuck
        // behind a placeholder forever.
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = this.sheetUrl(sheet);
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
