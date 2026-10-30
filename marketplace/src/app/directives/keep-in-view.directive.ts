import { Directive, ElementRef, HostListener, OnDestroy, inject } from '@angular/core';

/**
 * Keeps a field in sight while a phone keyboard is open.
 *
 * When a bid field is tapped, the keyboard opens and the browser scrolls the field into view on
 * its own. On this site's pages (fixed billboard, fixed header) that can leave the field behind
 * the header or under the keyboard. This lets the browser finish first: it waits until the
 * keyboard has stopped resizing the visible area, then, only if the field is still hidden, moves
 * the page once, instantly, and stops listening. Animating, or correcting again on later
 * resizes, fought the browser's own scroll (each move collapses or restores the toolbars, which
 * resizes the view, which triggered another move) and kept the page bouncing up and down.
 * Desktop is left alone.
 */
@Directive({
  standalone: true,
  selector: '[appKeepInView]',
})
export class KeepInViewDirective implements OnDestroy {
  private el = inject(ElementRef<HTMLElement>);
  private timer: ReturnType<typeof setTimeout> | null = null;
  // while the keyboard is still opening, every resize pushes the one check back
  private onResize = () => this.schedule(280);

  @HostListener('focus')
  onFocus() {
    if (!window.matchMedia?.('(pointer: coarse)').matches) return;
    window.visualViewport?.addEventListener('resize', this.onResize);
    // if the keyboard was already up (moving between fields) no resize comes; check anyway
    this.schedule(650);
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
    this.timer = setTimeout(() => this.place(), ms);
  }

  private place() {
    this.timer = null;
    const el = this.el.nativeElement as HTMLElement;
    if (document.activeElement !== el) return;
    const vv = window.visualViewport;
    const viewTop = vv ? vv.offsetTop : 0;
    const viewHeight = vv ? vv.height : window.innerHeight;
    // one look only: from here on the browser keeps the field in view on its own
    window.visualViewport?.removeEventListener('resize', this.onResize);
    // the fixed header covers the top of the page
    const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) * 10 || 80;
    const rect = el.getBoundingClientRect();
    const top = rect.top - viewTop;
    if (top >= header + 8 && rect.bottom - viewTop <= viewHeight - 12) return;   // already visible: leave it
    // put the field a third of the way down the space between the header and the keyboard
    const target = header + (viewHeight - header) / 3 - rect.height / 2;
    window.scrollBy({ top: top - target, behavior: 'instant' as ScrollBehavior });
  }

  private stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    window.visualViewport?.removeEventListener('resize', this.onResize);
  }
}
