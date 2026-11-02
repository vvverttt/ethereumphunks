/** crawlers run the page's script too; reads that only add polish (live updates, ENS names) skip them */
export const IS_BOT = typeof navigator !== 'undefined'
  && (navigator.webdriver || /bot|crawl|spider|slurp|bytespider|headless|lighthouse|preview/i.test(navigator.userAgent));
