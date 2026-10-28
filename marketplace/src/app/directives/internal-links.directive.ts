import { Directive, HostListener } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Routes clicks on plain href="/path" anchors inside translated [innerHTML] copy through the
 * Angular router, so links in the content files behave like routerLink (no full reload).
 * External links and anything opening a new tab are left alone.
 */
@Directive({ selector: '[appInternalLinks]', standalone: true })
export class InternalLinksDirective {
  constructor(private router: Router) {}

  @HostListener('click', ['$event'])
  onClick(ev: MouseEvent) {
    const a = (ev.target as HTMLElement)?.closest?.('a');
    const href = a?.getAttribute('href');
    if (!a || !href || !href.startsWith('/') || a.target === '_blank') return;
    if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    ev.preventDefault();
    this.router.navigateByUrl(href);
  }
}
