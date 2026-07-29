import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

interface Swatch {
  hex: string;
  name: string;
  tag?: 'og' | 'current';
}

/**
 * LOCAL-ONLY background preview tool for the cryptophunksv67 "header + grid" scheme.
 *
 * Renders a floating panel only on localhost (never on the deployed site or in the
 * production bundle's output — it self-gates on hostname). Clicking a swatch sets the
 * live `--base-color` (the header/grid background) and picks a readable `--highlight`
 * text color by luminance, so gold backgrounds automatically switch to dark text.
 * The choice persists in localStorage and is re-applied after navigation (ThemeService
 * re-writes --base-color on each collection change, so we re-assert it on NavigationEnd).
 *
 * This is a design aid, not a user feature. To turn a chosen color into the real default,
 * update ThemeService.collectionOverrides['cryptophunksv67'].
 */
@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-bg-color-picker',
  template: `
    @if (enabled) {
      <div class="bgpick" [class.collapsed]="!open()">
        <button type="button" class="bgpick-toggle" (click)="open.set(!open())">
          <span>BG COLOR — header + grid</span>
          <span class="chev">{{ open() ? '−' : '+' }}</span>
        </button>

        @if (open()) {
          <div class="bgpick-body">
            @for (group of groups; track group.label) {
              <div class="bgpick-group-label">{{ group.label }}</div>
              @for (s of group.items; track s.hex) {
                <button
                  type="button"
                  class="bgpick-swatch"
                  [class.active]="active() === s.hex"
                  (click)="apply(s.hex)">
                  <span class="chip" [style.background]="s.hex"></span>
                  <span class="hex">{{ s.hex }}</span>
                  @if (s.tag === 'og') { <span class="tag og">og</span> }
                  @if (s.tag === 'current') { <span class="tag cur">current</span> }
                </button>
              }
            }
            <button type="button" class="bgpick-reset" (click)="reset()">Reset to default</button>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .bgpick {
      position: fixed;
      top: 12px;
      left: 12px;
      z-index: 100000;
      width: 208px;
      font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
      background: #0c0f08;
      border: 1px solid #2c3320;
      border-radius: 10px;
      box-shadow: 0 8px 30px rgba(0,0,0,.55);
      overflow: hidden;
    }
    .bgpick.collapsed { width: auto; }
    .bgpick-toggle {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 8px 10px;
      background: none;
      border: 0;
      cursor: pointer;
      color: #c3ff00;
      font-size: 10px;
      letter-spacing: .06em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .bgpick-toggle .chev { color: #8a9a6a; font-size: 13px; }
    .bgpick-body {
      max-height: 70vh;
      overflow-y: auto;
      padding: 6px 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .bgpick-group-label {
      color: #6f7d55;
      font-size: 8.5px;
      letter-spacing: .18em;
      text-transform: uppercase;
      margin: 8px 2px 2px;
    }
    .bgpick-group-label:first-child { margin-top: 2px; }
    .bgpick-swatch {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 4px 6px;
      background: #12160c;
      border: 1px solid transparent;
      border-radius: 6px;
      cursor: pointer;
      color: #d7e2c4;
      text-align: left;
    }
    .bgpick-swatch:hover { border-color: #3a4429; }
    .bgpick-swatch.active { border-color: #c3ff00; background: #1a2110; }
    .bgpick-swatch .chip {
      width: 26px;
      height: 26px;
      border-radius: 5px;
      flex: none;
      border: 1px solid rgba(255,255,255,.18);
    }
    .bgpick-swatch .hex {
      font-size: 11px;
      letter-spacing: .02em;
      flex: 1;
    }
    .bgpick-swatch .tag {
      font-size: 8px;
      letter-spacing: .08em;
      padding: 2px 5px;
      border-radius: 999px;
      text-transform: uppercase;
    }
    .bgpick-swatch .tag.og { background: rgba(195,255,0,.16); color: #c3ff00; }
    .bgpick-swatch .tag.cur { background: rgba(120,160,175,.22); color: #cfe3ec; }
    .bgpick-reset {
      margin-top: 8px;
      padding: 7px 8px;
      background: none;
      border: 1px solid #2c3320;
      border-radius: 6px;
      color: #8a9a6a;
      font-family: inherit;
      font-size: 10px;
      letter-spacing: .08em;
      text-transform: uppercase;
      cursor: pointer;
    }
    .bgpick-reset:hover { color: #c3ff00; border-color: #3a4429; }
  `],
})
export class BgColorPickerComponent {

  /** Only ever active on localhost — the deployed site never shows this panel.
   *  Guarded for SSR/prerender where `location` is undefined. */
  readonly enabled = typeof location !== 'undefined'
    && ['localhost', '127.0.0.1'].includes(location.hostname);

  private readonly STORE_KEY = 'v67_bg_override';

  open = signal(true);
  active = signal<string>('');

  readonly groups: { label: string; items: Swatch[] }[] = [
    {
      label: 'Current options',
      items: [
        { hex: '#c3ff00', name: 'Lime', tag: 'og' },
        { hex: '#d3bf44', name: 'Muted Gold' },
        { hex: '#b59e5f', name: 'Khaki Gold' },
        { hex: '#cfb53b', name: 'Old Gold' },
        { hex: '#cda434', name: 'Goldenrod' },
        { hex: '#d4af37', name: 'Metallic Gold' },
        { hex: '#fdd017', name: 'Golden Yellow' },
        { hex: '#ffe000', name: 'Bright Yellow' },
        { hex: '#648595', name: 'Blue-Grey', tag: 'current' },
        { hex: '#79fae6', name: 'Aqua' },
        { hex: '#66cdff', name: 'Sky Blue' },
        { hex: '#00abff', name: 'Bright Blue' },
        { hex: '#54c7ff', name: 'Light Blue' },
      ],
    },
    {
      label: 'Added — gold',
      items: [
        { hex: '#f2ce5b', name: 'Radiant Relic' },
        { hex: '#e8c24a', name: 'Sunlit Gold' },
        { hex: '#ebb93a', name: 'Gilded Amber' },
        { hex: '#d6a82f', name: 'Temple Gold' },
        { hex: '#c89a2b', name: 'Aged Coin' },
        { hex: '#b8860b', name: 'Dark Goldenrod' },
        { hex: '#a9791c', name: 'Bronze Relic' },
        { hex: '#8f6b1e', name: 'Deep Ancient' },
      ],
    },
    {
      label: 'Added — blue',
      items: [
        { hex: '#7ba3b5', name: 'Pale Steel' },
        { hex: '#6b93a6', name: 'Steel' },
        { hex: '#5a7f8f', name: 'Slate Teal' },
        { hex: '#4e7383', name: 'Deep Slate' },
        { hex: '#3f6675', name: 'Ocean' },
        { hex: '#34586a', name: 'Midnight Steel' },
      ],
    },
  ];

  constructor(private router: Router) {
    if (!this.enabled) return;

    const saved = localStorage.getItem(this.STORE_KEY);
    if (saved) {
      this.active.set(saved.toLowerCase());
      if (this.onV67()) this.paint(this.active());
    }

    // ThemeService re-writes --base-color on each collection change, so re-assert
    // the preview after navigation settles — but only on cryptophunksv67 pages, so
    // the override doesn't bleed onto other collections.
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
    ).subscribe(() => {
      if (this.active() && this.onV67()) setTimeout(() => this.paint(this.active()), 60);
    });
  }

  /** True when the current route's collection is cryptophunksv67. */
  private onV67(): boolean {
    return this.router.url.split(/[?#]/)[0].split('/').filter(Boolean)[0] === 'cryptophunksv67';
  }

  apply(hex: string): void {
    this.active.set(hex.toLowerCase());
    localStorage.setItem(this.STORE_KEY, hex.toLowerCase());
    this.paint(hex);
  }

  reset(): void {
    localStorage.removeItem(this.STORE_KEY);
    location.reload();
  }

  /** Write --base-color (as an "r, g, b" triplet) and a readable text color to :root. */
  private paint(hex: string): void {
    const root = document.documentElement;
    root.style.setProperty('--base-color', this.toTriplet(hex));
    // Gold/light backgrounds need dark text; dark backgrounds keep white.
    const text = this.luminance(hex) > 0.42 ? '0, 0, 0' : '255, 255, 255';
    root.style.setProperty('--highlight', text);
    root.style.setProperty('--header-highlight', text);
  }

  private toTriplet(hex: string): string {
    const c = hex.replace('#', '');
    return [0, 2, 4].map(i => parseInt(c.substr(i, 2), 16)).join(', ');
  }

  private luminance(hex: string): number {
    const c = hex.replace('#', '');
    const v = [0, 2, 4].map(i => parseInt(c.substr(i, 2), 16) / 255)
      .map(x => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }
}
