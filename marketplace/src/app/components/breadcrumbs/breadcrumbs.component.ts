import { CommonModule, Location } from '@angular/common';
import { Component, ElementRef, ViewChild, effect, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { DataService } from '@/services/data.service';

import { Phunk } from '@/models/db';

import { filter, tap } from 'rxjs';
import { EthscriptionService } from '@/services/ethscription.service';

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
    public dataSvc: DataService
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
    const name = phunk.collection?.singleName?.replace(' ', '-') + '#' + displayId;
    const link = document.createElement('a');

    // Check if the original image is animated (GIF or APNG) — canvas loses animation
    const decodedData = await this.getPunkImage(phunk);
    const isGif = decodedData?.startsWith('data:image/gif');
    const isAnimatedPng = this.isApng(decodedData);

    if (isAnimatedPng && decodedData) {
      // Upscale APNG with background to match normal download size
      const { upscaleApng } = await import('@/utils/apng');
      const base64 = decodedData.split(',')[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const transparent = this.transparentCheck.value;
      const gba = this.gbaCheck.value;
      const theme = localStorage.getItem('EtherPhunks_theme');
      const bgColor = gba ? '#9bbc0f' : transparent ? null : (theme === 'light' ? '#FFDF00' : '#C3FF00');

      const blobUrl = await upscaleApng(bytes.buffer, this.width, this.height, bgColor);
      if (window.innerWidth > 800) link.download = name + '.png';
      link.target = '_blank';
      link.href = blobUrl;
    } else if (isGif && decodedData) {
      if (window.innerWidth > 800) link.download = name + '.gif';
      link.target = '_blank';
      link.href = decodedData;
    } else {
      if (window.innerWidth > 800) link.download = name + '.png';
      link.target = '_blank';
      link.href = this.pfp.nativeElement.toDataURL('image/png;base64');
    }

    link.click();
    this.pfpOptionsActive.set(false);
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
