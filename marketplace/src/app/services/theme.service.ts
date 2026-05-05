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
      '--background': '155, 188, 15',       // #9bbc0f — GB lightest green
      '--text-color': '15, 56, 15',          // #0f380f — GB darkest green
      '--dark-text': '15, 56, 15',           // #0f380f
      '--pink': '48, 98, 48',                // #306230
      '--base-color': '139, 172, 15',        // #8bac0f
      '--highlight': '15, 56, 15',           // #0f380f — dark for contrast
      '--button-color': '15, 56, 15',        // #0f380f

      '--header-text': '155, 188, 15',       // #9bbc0f — light on dark header
      '--header-highlight': '139, 172, 15',  // #8bac0f

      '--header-text-active': '155, 188, 15',
      '--header-highlight-active': '139, 172, 15'
    }
  }

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
    const previousTheme = localStorage.getItem('EtherPhunks_theme');
    const themeStyles = this.themeStyles[theme as keyof ThemeStyles];
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
   * Gets the initial theme based on stored preference or system setting
   * @returns Theme to use initially ('dark' or 'light')
   */
  getInitialTheme(): Theme {
    let mode = localStorage.getItem('EtherPhunks_theme') as Theme | undefined;
    if (mode) return mode;

    return 'dark';
  }
}
