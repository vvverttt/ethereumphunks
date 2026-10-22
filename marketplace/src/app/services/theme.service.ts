import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, signal } from '@angular/core';

import { Theme, ThemeProperties, ThemeStyles } from '@/models/theme';

/**
 * Service for managing application themes and styles
 */
@Injectable({
  providedIn: 'root'
})
export class ThemeService {

  /**
   * Theme style configurations for dark and light modes
   * Contains color variables and other theme properties
   */
  themeStyles: ThemeStyles = {
    dark: {
      label: 'Dark',
      '--phunk-bg': '195, 255, 0',
      '--background': '17, 26, 0',
      '--text-color': '255, 255, 255',
      '--dark-text': '255, 255, 255',
      '--pink': '255, 4, 180',
      '--base-color': '195, 255, 0',
      '--highlight': '195, 255, 0',
      '--button-color': '255, 4, 180',

      '--header-text': '255, 4, 180',
      '--header-highlight': '195, 255, 0',

      '--header-text-active': '0, 0, 0',
      '--header-highlight-active': '255, 4, 180'
    },
    light: {
      label: 'Light',
      '--phunk-bg': '195, 255, 0',
      '--background': '255, 4, 180',
      '--text-color': '0, 0, 0',
      '--dark-text': '0, 0, 0',
      '--pink': '255, 4, 180',
      '--base-color': '195, 255, 0',
      '--highlight': '195, 255, 0',
      '--button-color': '0, 0, 0',

      '--header-text': '0, 0, 0',
      '--header-highlight': '255, 4, 180',

      '--header-text-active': '0, 0, 0',
      '--header-highlight-active': '255, 4, 180'
    }
  }

  /**
   * Per-collection CSS-var overrides applied on top of the base (dark/light) theme.
   * Only collections listed here deviate from the default c3ff00 lime — everything else
   * stays exactly as-is. cryptophunksv67 is an ERC-721C (not Ethscriptions) so it gets its
   * own #648595 scheme to signal that difference.
   */
  collectionOverrides: Record<string, Record<string, string>> = {
    cryptophunksv67: {
      '--base-color': '103, 205, 255',      // #67cdff — all v67 chrome (panels, popup, status bar, header) now the bright blue
      '--phunk-bg': '103, 205, 255',        // #67cdff — tile/billboard/splash/top bg so the green turtles pop
      '--highlight': '255, 255, 255',       // white — text/links/labels (readable on both the blue bg and dark bg)
      '--header-highlight': '255, 255, 255',
      '--background': '12, 20, 26',          // #0c141a — dark blue-grey page bg (replaces the green-tinted 17,26,0)
    },
    // Halloween collection: the auction hero's purple as the page bg under the splash.
    // Mirrored in main.scss for first paint — keep the two in step.
    phunklloween: {
      '--background': '69, 0, 176',          // #4500b0 — same purple as the auction hero
      // Every pink accent (header text, Go/Connect buttons, links, item numbers) goes orange.
      '--pink': '255, 140, 26',              // #ff8c1a
      '--button-color': '255, 140, 26',
      '--header-text': '255, 140, 26',
      '--header-text-active': '255, 140, 26',     // menu open: Connect keeps its accent
      '--header-highlight': '0, 0, 0',        // black text on the orange Connect/Go
      '--header-highlight-active': '255, 140, 26',
    },
    // The ethscription collections' own themes, Phunklloween-style: a page colour, and an
    // accent that replaces the pink, in the header too (logo, Connect) with the page colour as
    // its text. Mirrored in main.scss for first paint — keep the two in step.
    'ethsrocks': {
      '--background': '74, 13, 20',          // #4a0d14
      '--pink': '255, 51, 85',                // #ff3355 — every pink accent
      '--button-color': '255, 51, 85',
      '--header-text': '255, 51, 85',
      '--header-text-active': '255, 51, 85',     // menu open: Connect keeps its accent
      '--header-highlight': '74, 13, 20',
      '--header-highlight-active': '255, 51, 85',
    },
    'missing-phunks': {
      '--background': '28, 42, 51',          // #1c2a33
      '--pink': '99, 133, 150',                // #638596 — every pink accent
      '--button-color': '99, 133, 150',
      '--header-text': '99, 133, 150',
      '--header-text-active': '99, 133, 150',     // menu open: Connect keeps its accent
      '--header-highlight': '28, 42, 51',
      '--header-highlight-active': '99, 133, 150',
    },
    'dysto-phunks': {
      '--background': '13, 26, 18',          // #0d1a12
      '--pink': '16, 154, 62',                // #109a3e — every pink accent
      '--button-color': '16, 154, 62',
      '--header-text': '16, 154, 62',
      '--header-text-active': '16, 154, 62',     // menu open: Connect keeps its accent
      '--header-highlight': '13, 26, 18',
      '--header-highlight-active': '16, 154, 62',
    },
    'phikings': {
      '--background': '150, 112, 0',          // #967000
      '--pink': '224, 165, 38',                // #e0a526 — every pink accent
      '--button-color': '224, 165, 38',
      '--header-text': '224, 165, 38',
      '--header-text-active': '224, 165, 38',     // menu open: Connect keeps its accent
      '--header-highlight': '92, 68, 0',
      '--header-highlight-active': '224, 165, 38',
    },
  };
  private activeSlug = '';
  private currentTheme: Theme = 'dark';

  /**
   * The collection whose colours are on screen ('' = the default lime). The header picks its
   * logo from this, not from the store's active collection, so the two can never disagree:
   * pages like /lottery recolour the site without changing the store.
   */
  readonly themeSlug = signal('');

  /**
   * Initializes theme service and sets up system theme change listener
   * @param document Injected Document object for DOM manipulation
   */
  constructor(
    @Inject(DOCUMENT) private document: Document
  ) {
    // Start from whatever the pre-boot script in index.html already painted, so the first
    // setActiveCollection() is never skipped as "no change" while the page shows another
    // collection (e.g. the auction house opening over a remembered QuantumPhunks blue).
    this.activeSlug = this.document.documentElement.dataset['collection'] || '';
    this.themeSlug.set(this.activeSlug);

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      this.setThemeStyles(e.matches ? 'dark' : 'light');
    });
  }

  /**
   * Applies theme styles to the document
   * @param theme Theme to apply ('dark' or 'light')
   */
  setThemeStyles(theme: Theme) {
    this.currentTheme = theme;
    const previousTheme = localStorage.getItem('EtherPhunks_theme');
    const themeStyles = this.getEffectiveStyles(theme);
    Object.keys(themeStyles).map((property: string) => {
      this.document.documentElement.style.setProperty(
        property as string,
        themeStyles[property as keyof ThemeProperties]
      );
    });
    this.document.body.dataset['theme'] = theme;
    localStorage.setItem('EtherPhunks_theme', theme);

    // Update the browser chrome / iOS status bar colour to match --base-color.
    //
    // iOS 26 Safari ignores theme-color and takes the colour from the fixed header's own
    // background instead (see header.component.scss); this still drives Android Chrome and
    // older iOS. The meta element is REPLACED rather than mutated. Safari on iOS reads
    // theme-color when the tag is parsed and frequently ignores a later
    // setAttribute on the same node — which is why switching from QuantumPhunks
    // to Phikings on iPhone/iPad left the top of the screen showing the previous
    // collection's blue. Removing and re-appending makes it re-read.
    const baseColor = themeStyles['--base-color' as keyof ThemeProperties];
    if (baseColor) {
      const hex = '#' + baseColor.split(',').map(c => (+c.trim()).toString(16).padStart(2, '0')).join('');
      // Clear every existing one first: a stale duplicate would win unpredictably.
      this.document.querySelectorAll('meta[name="theme-color"]').forEach((el) => el.remove());
      const meta = this.document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      meta.setAttribute('content', hex);
      this.document.head.appendChild(meta);
    }
    this.refreshBrowserTint();

    // On mobile, reload only when user actually switches theme (not on initial load)
    if (previousTheme && previousTheme !== theme && window.innerWidth <= 800) {
      window.location.reload();
    }
  }

  /**
   * Makes iOS 26 Safari re-read the colour for the top of the screen. It samples the fixed
   * header's background, but only on a page load or when a fixed element is added or removed
   * (WebKit's didAddOrRemoveViewportConstrainedObjects), never because a colour changed, so in
   * this single-page app the top kept the first page's colour. An empty fixed element, added
   * and then removed a couple of frames later, is enough to make it look again.
   */
  private refreshBrowserTint() {
    const body = this.document.body;
    if (!body) return;
    const probe = this.document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;pointer-events:none';
    body.appendChild(probe);
    requestAnimationFrame(() => requestAnimationFrame(() => probe.remove()));
  }

  /**
   * Sets the active collection slug and re-applies the theme so per-collection overrides
   * (e.g. cryptophunksv67 -> #648595) take effect. No-op cost when the slug has no override.
   */
  setActiveCollection(slug: string) {
    if (slug === this.activeSlug) return;
    this.activeSlug = slug || '';
    this.themeSlug.set(this.activeSlug);
    // data-collection lets scoped global CSS (event colors, logo filter, non-variable spots) target
    // a specific collection without touching the others.
    if (this.activeSlug) this.document.documentElement.dataset['collection'] = this.activeSlug;
    else delete this.document.documentElement.dataset['collection'];
    // Remembered so the next page load can paint the right palette before the app knows
    // which collection it is showing — see the restore script in index.html. An item page
    // cannot learn its collection until its data arrives, so without this every reload
    // flashed the default lime first.
    try {
      if (this.activeSlug) localStorage.setItem('EtherPhunks_collection', this.activeSlug);
      else localStorage.removeItem('EtherPhunks_collection');
    } catch { /* private mode — the flash is cosmetic, never break on it */ }
    this.setThemeStyles(this.currentTheme);
  }

  /**
   * The base (dark/light) theme with the active collection's overrides on top. Anything
   * that writes a theme var must read it from here, not from `themeStyles` directly, or
   * it paints the base colour over the collection's (e.g. pink over Phunklloween orange).
   */
  getEffectiveStyles(theme: Theme): ThemeProperties {
    return {
      ...this.themeStyles[theme as keyof ThemeStyles],
      ...(this.collectionOverrides[this.activeSlug] || {}),
    } as ThemeProperties;
  }

  /**
   * Gets the initial theme based on stored preference or system setting
   * @returns Theme to use initially ('dark' or 'light')
   */
  getInitialTheme(): Theme {
    let mode = localStorage.getItem('EtherPhunks_theme') as Theme | undefined;
    if (mode) return mode;

    return 'dark';
  }
}
