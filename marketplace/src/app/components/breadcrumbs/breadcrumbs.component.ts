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

  // ── Phunk Box ──────────────────────────────────────────────────────────────
  // Shape, background colour, border and output size. Every one of these is
  // applied in BOTH the preview canvas and the saved file — the two go through
  // different code paths (paintCanvas vs aspectCorrectBlob), so the shared
  // geometry lives in shapePath()/decorate() rather than being written twice.
  shapeControl = new FormControl<'square' | 'round' | 'hex'>('square');
  bgColorControl = new FormControl<string | null>(null);   // null = collection default
  borderCheck = new FormControl(false);
  borderColorControl = new FormControl('#000000');
  sizeControl = new FormControl(480);

  readonly shapes: { value: 'square' | 'round' | 'hex'; label: string }[] = [
    { value: 'square', label: 'Square' },
    { value: 'round', label: 'Round' },
    { value: 'hex', label: 'Hexagon' },
  ];

  readonly sizes = [480, 1200];

  /** Palette offered for the background. `null` is the collection's own colour. */
  readonly bgPalette: (string | null)[] = [
    null,
    '#c3ff00', '#67cdff', '#ffdf00', '#ff00cc', '#9e03ff',
    '#02ff64', '#ff4d4d', '#ffffff', '#000000', '#638596',
  ];

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

    // Phunk Box controls all just repaint. Size also resizes the canvas, which
    // paintCanvas already does from this.width/this.height.
    // Cast to a common type: the controls hold different value types, so the
    // array's union of valueChanges has no single callable signature.
    const repaintOn: FormControl<any>[] = [
      this.shapeControl as FormControl<any>,
      this.bgColorControl as FormControl<any>,
      this.borderCheck as FormControl<any>,
      this.borderColorControl as FormControl<any>,
    ];
    for (const ctrl of repaintOn) {
      ctrl.valueChanges.pipe(
        filter(() => !!this.phunk()),
        tap(() => this.paintCanvas(this.phunk()!)),
      ).subscribe();
    }

    this.sizeControl.valueChanges.pipe(
      filter(() => !!this.phunk()),
      tap((v) => {
        const size = Number(v) || 480;
        this.width = size;
        this.height = size;
        // Keep the on-screen preview a constant ~240px whatever the export size,
        // so picking 1200 doesn't blow the panel open.
        this.scale = size / 240;
      }),
      tap(() => this.paintCanvas(this.phunk()!)),
    ).subscribe();
  }

  /** Background swatch preview colour — null means "the collection's own". */
  swatchColor(c: string | null): string {
    return c ?? this.saveBgColorDefault();
  }

  /** The collection default, ignoring any Phunk Box override. */
  private saveBgColorDefault(): string {
    if (this.phunk()?.slug === 'cryptophunksv67') return '#67cdff';
    const theme = localStorage.getItem('EtherPhunks_theme');
    return theme === 'light' ? '#FFDF00' : '#C3FF00';
  }

  t(key: string): string {
    return this.preferences.t(key);
  }

  /**
   * Solid background used when compositing a saved/preview image. cryptophunksv67 is an
   * ERC-721C shown on the blue #648595 scheme (see ThemeService.collectionOverrides), so its
   * saves sit on that blue instead of the default lime. All other collections are unchanged.
   */
  private saveBgColor(phunk: Phunk | null | undefined): string {
    // An explicit Phunk Box choice wins over the collection default.
    const picked = this.bgColorControl.value;
    if (picked) return picked;
    if (phunk?.slug === 'cryptophunksv67') return '#67cdff';
    const theme = localStorage.getItem('EtherPhunks_theme');
    return theme === 'light' ? '#FFDF00' : '#C3FF00';
  }

  /**
   * Traces the selected shape on a w×h canvas.
   *
   * Used as a clip for the fill and the art, and again as a stroke for the
   * border, so the two can never disagree. Hexagon is pointy-top, inset by half
   * the border width so a stroke isn't clipped in half by the canvas edge.
   */
  private shapePath(ctx: CanvasRenderingContext2D, w: number, h: number, inset = 0): void {
    const shape = this.shapeControl.value ?? 'square';
    const x = inset, y = inset, cw = w - inset * 2, ch = h - inset * 2;

    ctx.beginPath();
    if (shape === 'round') {
      ctx.ellipse(x + cw / 2, y + ch / 2, cw / 2, ch / 2, 0, 0, Math.PI * 2);
    } else if (shape === 'hex') {
      const cx = x + cw / 2, cy = y + ch / 2;
      const rx = cw / 2, ry = ch / 2;
      for (let i = 0; i < 6; i++) {
        // -90° start = flat sides left/right, point top and bottom.
        const a = (Math.PI / 180) * (60 * i - 90);
        const px = cx + rx * Math.cos(a);
        const py = cy + ry * Math.sin(a);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else {
      ctx.rect(x, y, cw, ch);
    }
  }

  /** Stroke the shape outline, if the border option is on. */
  private strokeBorder(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this.borderCheck.value) return;
    // Scales with output size so a 1200px export isn't hairline. The phunk is
    // drawn on top, so the visible band is roughly half this — hence the fairly
    // generous ratio.
    const lw = Math.max(3, Math.round(Math.min(w, h) * 0.0405));
    ctx.save();
    ctx.lineWidth = lw;
    ctx.strokeStyle = this.borderColorControl.value || '#000000';
    ctx.lineJoin = 'round';
    this.shapePath(ctx, w, h, lw / 2);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Shape + border packaged for the animated exporters, which apply it to every
   * frame. Returns undefined when there is nothing to do, so GIF/APNG keep their
   * cheaper opaque-palette path for a plain square export.
   */
  private frameDecoration(): { clip?: (c: CanvasRenderingContext2D, w: number, h: number) => void;
                               border?: (c: CanvasRenderingContext2D, w: number, h: number) => void } | undefined {
    const wantsClip = this.shapeClips;
    const wantsBorder = !!this.borderCheck.value;
    if (!wantsClip && !wantsBorder) return undefined;
    return {
      clip: wantsClip ? (c, w, h) => this.shapePath(c, w, h) : undefined,
      border: wantsBorder ? (c, w, h) => this.strokeBorder(c, w, h) : undefined,
    };
  }

  /** True when the shape crops — used to skip clipping for square exports. */
  private get shapeClips(): boolean {
    return (this.shapeControl.value ?? 'square') !== 'square';
  }

  async paintCanvas(phunk: Phunk): Promise<void> {
    // The canvas only exists while the options panel is open, so this runs with
    // nothing to draw on during the initial load effect. Still resolve the image
    // first — that is what sets downloadEnabled and un-greys the button.
    if (!this.pfp?.nativeElement) {
      await this.drawPhunk(phunk).catch(() => undefined);
      return;
    }

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
    const lw = this.width / this.scale;
    const lh = this.height / this.scale;

    // Draw order is background -> border -> phunk, so the art sits in FRONT of
    // both. A border drawn last would overlap the phunk's outer pixels and clip
    // its silhouette; this way the stroke tucks behind it.
    //
    // Background and art are each clipped to the shape so round/hex corners come
    // out genuinely transparent rather than merely covered. The border is
    // stroked unclipped, or the clip would slice it to half width.

    // 1. Background, inside the shape.
    this.ctx.save();
    if (this.shapeClips) {
      this.shapePath(this.ctx, lw, lh);
      this.ctx.clip();
    }
    if (gba && phunk.isSupported) {
      this.ctx.fillStyle = '#9bbc0f';
      this.ctx.fillRect(0, 0, lw, lh);
    } else if (!transparent && phunk.isSupported) {
      this.ctx.fillStyle = this.saveBgColor(phunk);
      this.ctx.fillRect(0, 0, lw, lh);
    }
    this.ctx.restore();

    // 2. Border, behind the art.
    this.strokeBorder(this.ctx, lw, lh);

    // 3. The phunk, on top of both.
    const image = await this.drawPhunk(phunk);
    if (!image) return;

    this.ctx.save();
    if (this.shapeClips) {
      this.shapePath(this.ctx, lw, lh);
      this.ctx.clip();
    }
    this.ctx.drawImage(image, 0, 0, lw, lh);
    this.ctx.restore();

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

        const bgColor = this.transparentCheck.value ? null : this.saveBgColor(phunk);

        try {
          const { apngToGif } = await import('@/utils/apng');
          blob = await apngToGif(bytes.buffer, this.width, this.height, bgColor, this.frameDecoration());
          ext = 'gif';
        } catch {
          blob = await (await fetch(decodedData)).blob();
          ext = 'png';
        }
      } else if (isGif && decodedData) {
        // GIF: upscale to the same size as a static download so the pixels stay
        // crisp. Shipping the original bytes left animated items at their native
        // 24x24 while every static item downloaded at 480x480 — they looked blurry
        // side by side. Falls back to the untouched bytes if the browser has no
        // ImageDecoder, so it stays animated either way.
        const base64 = decodedData.split(',')[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        const bgColor = this.transparentCheck.value ? null : this.saveBgColor(phunk);

        try {
          const { upscaleGif } = await import('@/utils/gif');
          blob = await upscaleGif(bytes.buffer, this.width, this.height, bgColor, this.frameDecoration());
        } catch {
          blob = await (await fetch(decodedData)).blob();
        }
        ext = 'gif';
      } else if (decodedData) {
        // Any static item (phunk or rock): preserve aspect ratio (no squish or
        // crop) and place it on the C3FF00 background unless "transparent" is on.
        const bg = this.transparentCheck.value ? null : this.saveBgColor(phunk);
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

        // Same shape/border treatment as the preview — this is the path the
        // SAVED file actually takes, so without it the options would preview
        // correctly and then download as a plain square.
        // background -> border -> art, so the phunk sits in front of the border
        // rather than being overlapped by it. Matches paintCanvas exactly.
        cx.save();
        if (this.shapeClips) { this.shapePath(cx, w, h); cx.clip(); }
        if (bgColor) { cx.fillStyle = bgColor; cx.fillRect(0, 0, w, h); }
        cx.restore();

        this.strokeBorder(cx, w, h);

        cx.save();
        if (this.shapeClips) { this.shapePath(cx, w, h); cx.clip(); }
        cx.drawImage(img, 0, 0, w, h);
        cx.restore();

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
    // The canvas lives inside the panel now, so it does not exist until this
    // opens. Paint once Angular has created it.
    if (this.pfpOptionsActive() && this.phunk()) {
      setTimeout(() => this.paintCanvas(this.phunk()!));
    }
  }

  clearCanvas(): void {
    this.ctx?.clearRect(0, 0, this.width, this.height);
  }
}
