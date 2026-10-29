import { Directive, ElementRef, HostListener, OnDestroy, inject } from '@angular/core';

/**
 * Keeps a field in sight while a phone keyboard is open.
 *
 * When a bid field is tapped, the keyboard opens and the browser scrolls on its own, and on
 * this site's pages (fixed billboard, fixed header) it often leaves the field under the
 * keyboard or behind the header, so the bidder can't see what they type. On touch screens
 * this waits for the keyboard to settle, then centres the field in the space that's left
 * (the visual viewport), and does it again if that space changes while the field is focused.
 * Desktop is left alone.
 */
@Directive({
  standalone: true,
  selector: '[appKeepInView]',
})
export class KeepInViewDirective implements OnDestroy {
  private el = inject(ElementRef<HTMLElement>);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onResize = () => this.schedule(120);

  @HostListener('focus')
  onFocus() {
    if (!window.matchMedia?.('(pointer: coarse)').matches) return;
    window.visualViewport?.addEventListener('resize', this.onResize);
    // the keyboard animation takes ~250–350 ms; check once it's up
    this.schedule(350);
  }

  @HostListener('blur')
  onBlur() {
    this.stop();
  }

  ngOnDestroy() {
    this.stop();
  }

  private schedule(ms: number) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.centre(), ms);
  }

  private centre() {
    const el = this.el.nativeElement as HTMLElement;
    if (document.activeElement !== el) return;
    const vv = window.visualViewport;
    const viewTop = vv ? vv.offsetTop : 0;
    const viewHeight = vv ? vv.height : window.innerHeight;
    // the fixed header covers the top of the page
    const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) * 10 || 80;
    const rect = el.getBoundingClientRect();
    const top = rect.top - viewTop;
    if (top >= header && rect.bottom - viewTop <= viewHeight - 12) return;   // already visible
    const target = header + (viewHeight - header) / 2 - rect.height / 2;
    window.scrollBy({ top: top - target, behavior: 'smooth' });
  }

  private stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    window.visualViewport?.removeEventListener('resize', this.onResize);
  }
}
