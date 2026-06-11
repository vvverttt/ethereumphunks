import { CommonModule, Location } from '@angular/common';
import { Component, ElementRef, ViewChild, effect, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { DataService } from '@/services/data.service';

import { Phunk } from '@/models/db';

import { filter, tap } from 'rxjs';
import { EthscriptionService } from '@/services/ethscription.service';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
  ],
  selector: 'app-breadcrumbs',
  templateUrl: './breadcrumbs.component.html',
  styleUrls: ['./breadcrumbs.component.scss']
})
export class BreadcrumbsComponent {

  phunk = input<Phunk | null>();

  @ViewChild('pfp') pfp!: ElementRef;


  ctx!: CanvasRenderingContext2D | null;
  width: number = 480;
  height: number = 480;
  scale: number = 2;
  transparentCheck = new FormControl(false);
  gbaCheck = new FormControl(false);

  pfpOptionsActive = signal(false);
  downloadEnabled = signal(false);
  customizeEnabled = signal(false);

  private readonly gbaPalette = [
    [155, 188, 15],
    [139, 172, 15],
    [48,  98,  48],
    [15,  56,  15],
  ];

  constructor(
    private ethscriptionSvc: EthscriptionService,
    public location: Location,
    public dataSvc: DataService,
    public preferences: PhunkPreferencesService,
  ) {
    effect(() => {
      if (!this.phunk()) return;
      const phunk = this.phunk()!;
      this.paintCanvas(phunk);
    });

    this.transparentCheck.valueChanges.pipe(
      filter(() => !!this.phunk()),
      tap((v) => { if (v) this.gbaCheck.setValue(false, { emitEvent: false }); }),
      tap(() => this.paintCanvas(this.phunk()!))
    ).subscribe();

    this.gbaCheck.valueChanges.pipe(
      filter(() => !!this.phunk()),
      tap((v) => { if (v) this.transparentCheck.setValue(false, { emitEvent: false }); }),
      tap(() => this.paintCanvas(this.phunk()!))
    ).subscribe();
  }

  t(key: string): string {
    return this.preferences.t(key);
  }

  async paintCanvas(phunk: Phunk): Promise<void> {
    const transparent = this.transparentCheck.value;
    const canvas = this.pfp.nativeElement as HTMLCanvasElement;

    // Set physical canvas dimensions
    canvas.width = this.width;
    canvas.height = this.height;

    // Set display dimensions
    canvas.style.width = this.width / this.scale + 'px';
    canvas.style.height = this.height / this.scale + 'px';

    // Get fresh context
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) return;

    // Clear canvas and set rendering options
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.imageSmoothingEnabled = false;

    // Apply scaling
    this.ctx.scale(this.scale, this.scale);

    const gba = this.gbaCheck.value;

    // Fill background
    if (gba && phunk.isSupported) {
      this.ctx.fillStyle = '#9bbc0f';
      this.ctx.fillRect(0, 0, this.width / this.scale, this.height / this.scale);
    } else if (!transparent && phunk.isSupported) {
      const theme = localStorage.getItem('EtherPhunks_theme');
      this.ctx.fillStyle = theme === 'light' ? '#FFDF00' : '#C3FF00';
      this.ctx.fillRect(0, 0, this.width / this.scale, this.height / this.scale);
    }

    // Draw the phunk image
    const image = await this.drawPhunk(phunk);
    if (!image) return;

    this.ctx.drawImage(image, 0, 0, this.width / this.scale, this.height / this.scale);

    // Apply GBA 4-color palette quantization
    if (gba) {
      this.applyGbaPalette(this.ctx, this.width, this.height);
    }
  }

  private applyGbaPalette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const p = gray > 191 ? this.gbaPalette[0]
              : gray > 127 ? this.gbaPalette[1]
              : gray > 63  ? this.gbaPalette[2]
              :               this.gbaPalette[3];
      data[i] = p[0]; data[i + 1] = p[1]; data[i + 2] = p[2];
    }
    ctx.putImageData(imageData, 0, 0);
  }

  async drawPhunk(phunk: Phunk): Promise<HTMLImageElement | undefined> {
    const dataUrl = await this.getPunkImage(phunk);
    if (!dataUrl) return;
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.downloadEnabled.set(true);
        resolve(img);
      };
      img.onerror = err => {
        this.downloadEnabled.set(false);
        reject(err);
      };
      img.src = dataUrl;
    });
  }

  async getPunkImage(phunk: Phunk): Promise<string | undefined> {
    this.customizeEnabled.set(!!(phunk.isSupported && !phunk.collection?.hasBackgrounds));

    const decodedData = await this.ethscriptionSvc.processImage(phunk);
    return decodedData?.data;
  }

  async downloadCanvas(): Promise<void> {
    if (!this.phunk()) return;

    const phunk = this.phunk()!;
    const displayId = phunk.slug === 'ethsrocks' ? '-' + Math.abs(phunk.tokenId) : Math.abs(phunk.tokenId);
    const name = (phunk.collection?.singleName?.replace(/ /g, '-') || 'item') + '#' + displayId;

    // Get the original (decoded) image so we can detect animation / true aspect ratio.
    const decodedData = await this.getPunkImage(phunk);
    const isGif = !!decodedData?.startsWith('data:image/gif');
    const isAnimatedPng = this.isApng(decodedData);

    let blob: Blob | null = null;
    let ext = 'png';

    try {
      if (isAnimatedPng && decodedData) {
        // Animated PNG -> convert to an animated GIF (animates everywhere incl.
        // iOS Photos, unlike APNG), composited onto the C3FF00 background unless
        // "transparent" is on. If conversion fails, fall back to the original
        // animated bytes so it never flattens to a still.
        const base64 = decodedData.split(',')[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        const bgColor = this.transparentCheck.value ? null : '#C3FF00';

        try {
          const { apngToGif } = await import('@/utils/apng');
          blob = await apngToGif(bytes.buffer, this.width, this.height, bgColor);
          ext = 'gif';
        } catch {
          blob = await (await fetch(decodedData)).blob();
          ext = 'png';
        }
      } else if (isGif && decodedData) {
        // GIF: download the original bytes untouched so it stays animated.
        blob = await (await fetch(decodedData)).blob();
        ext = 'gif';
      } else if (decodedData) {
        // Any static item (phunk or rock): preserve aspect ratio (no squish or
        // crop) and place it on the C3FF00 background unless "transparent" is on.
        const bg = this.transparentCheck.value ? null : '#C3FF00';
        blob = await this.aspectCorrectBlob(decodedData, bg);
        ext = 'png';
      }
    } catch {
      blob = null;
    }

    // Animated items must stay animated: if we still have no blob, download the
    // original animated bytes rather than flattening to a still canvas frame.
    if (!blob && (isGif || isAnimatedPng) && decodedData) {
      try {
        blob = await (await fetch(decodedData)).blob();
        ext = isGif ? 'gif' : 'png';
      } catch {}
    }

    // Last resort (static items only): export the current canvas.
    if (!blob) {
      try { blob = await this.canvasToBlob(this.pfp.nativeElement); ext = 'png'; } catch {}
    }
    if (!blob) return;

    const fileName = `${name}.${ext}`;
    const mime = blob.type || (ext === 'gif' ? 'image/gif' : 'image/png');

    // Mobile: prefer the native share sheet (lets iOS/Android Save to Photos/Files,
    // and keeps GIF/APNG animation intact). Desktop downloads directly below.
    const isMobile = window.innerWidth <= 800;
    if (isMobile) {
      try {
        const file = new File([blob], fileName, { type: mime });
        const nav = navigator as any;
        if (nav.canShare && nav.canShare({ files: [file] })) {
          await nav.share({ files: [file], title: name });
          this.pfpOptionsActive.set(false);
          return;
        }
      } catch {
        // user cancelled or share unsupported — fall through to a direct download
      }
    }

    // Direct download — works on desktop and Android. `download` is ALWAYS set now
    // (it was previously gated to wide screens, which broke narrow/mobile saves).
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 10000);

    this.pfpOptionsActive.set(false);
  }

  /** Export a canvas to a PNG blob (promise wrapper around toBlob). */
  private canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
    });
  }

  /**
   * Redraws a data-URL image onto a canvas that matches its native aspect ratio,
   * upscaled so the long edge is `this.width`. Prevents non-square items (EthsRocks)
   * from being squished into the square phunk canvas. Nearest-neighbour (no blur).
   */
  private aspectCorrectBlob(dataUrl: string, bgColor: string | null = null): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        const target = this.width;
        let w = target, h = target;
        if (iw && ih) {
          if (iw >= ih) { w = target; h = Math.round(target * ih / iw); }
          else { h = target; w = Math.round(target * iw / ih); }
        }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const cx = c.getContext('2d');
        if (!cx) { reject(new Error('no 2d context')); return; }
        cx.imageSmoothingEnabled = false;
        if (bgColor) { cx.fillStyle = bgColor; cx.fillRect(0, 0, w, h); }
        cx.drawImage(img, 0, 0, w, h);
        c.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  /** Detect APNG by looking for the acTL chunk in the PNG data */
  private isApng(dataUri: string | null | undefined): boolean {
    if (!dataUri?.startsWith('data:image/png;base64,')) return false;
    const base64 = dataUri.split(',')[1];
    const binary = atob(base64);
    // Search for 'acTL' chunk marker (APNG animation control)
    for (let i = 0; i < binary.length - 4; i++) {
      if (binary[i] === 'a' && binary[i+1] === 'c' && binary[i+2] === 'T' && binary[i+3] === 'L') {
        return true;
      }
    }
    return false;
  }

  togglePfpOptions(): void {
    this.pfpOptionsActive.update(active => !active);
  }

  clearCanvas(): void {
    this.ctx?.clearRect(0, 0, this.width, this.height);
  }
}
