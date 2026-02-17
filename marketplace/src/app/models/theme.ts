export interface ThemeProperties {
  label: string;
  '--background': string;
  '--text-color': string;
  '--dark-text': string;
  '--pink': string;
  '--base-color': string;
  '--highlight': string;
  '--button-color': string;
  '--header-text': string;
  '--header-highlight': string;
  '--header-text-active': string;
  '--header-highlight-active': string;
};

export interface ThemeStyles {
  dark: ThemeProperties;
  light: ThemeProperties;
};

export type Theme = keyof ThemeStyles | 'initial';
