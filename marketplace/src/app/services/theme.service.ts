import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';

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
  };
  private activeSlug = '';
  private currentTheme: Theme = 'dark';

  /**
   * Initializes theme service and sets up system theme change listener
   * @param document Injected Document object for DOM manipulation
   */
  constructor(
    @Inject(DOCUMENT) private document: Document
  ) {
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
    const themeStyles = {
      ...this.themeStyles[theme as keyof ThemeStyles],
      ...(this.collectionOverrides[this.activeSlug] || {}),
    } as ThemeProperties;
    Object.keys(themeStyles).map((property: string) => {
      this.document.documentElement.style.setProperty(
        property as string,
        themeStyles[property as keyof ThemeProperties]
      );
    });
    this.document.body.dataset['theme'] = theme;
    localStorage.setItem('EtherPhunks_theme', theme);

    // Update iOS Safari status bar color to match --base-color
    const baseColor = themeStyles['--base-color' as keyof ThemeProperties];
    if (baseColor) {
      const hex = '#' + baseColor.split(',').map(c => (+c.trim()).toString(16).padStart(2, '0')).join('');
      this.document.querySelector('meta[name="theme-color"]')?.setAttribute('content', hex);
    }

    // On mobile, reload only when user actually switches theme (not on initial load)
    if (previousTheme && previousTheme !== theme && window.innerWidth <= 800) {
      window.location.reload();
    }
  }

  /**
   * Sets the active collection slug and re-applies the theme so per-collection overrides
   * (e.g. cryptophunksv67 -> #648595) take effect. No-op cost when the slug has no override.
   */
  setActiveCollection(slug: string) {
    if (slug === this.activeSlug) return;
    this.activeSlug = slug || '';
    // data-collection lets scoped global CSS (event colors, logo filter, non-variable spots) target
    // a specific collection without touching the others.
    if (this.activeSlug) this.document.documentElement.dataset['collection'] = this.activeSlug;
    else delete this.document.documentElement.dataset['collection'];
    this.setThemeStyles(this.currentTheme);
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
