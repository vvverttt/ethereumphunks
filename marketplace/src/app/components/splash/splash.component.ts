import { Component, effect, ElementRef, input, viewChild } from '@angular/core';
import { AsyncPipe, CommonModule } from '@angular/common';

import { LazyLoadImageModule } from 'ng-lazyload-image';

import { toObservable } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, from, map, Observable, of, startWith, switchMap } from 'rxjs';

import { Collection } from '@/models/data.state';
import { AttributeItem } from '@/models/attributes';

import { DataService } from '@/services/data.service';
import { PixelArtService } from '@/services/pixel-art.service';
import { ImageService } from '@/services/image.service';

import { environment } from 'src/environments/environment';

import { gsap } from 'gsap';
interface Image {
  src: string;
  type: 'loading' | 'mint' | 'gray' | 'photo' | 'gif';
}

@Component({
  selector: 'app-splash',
  standalone: true,
  imports: [
    CommonModule,
    LazyLoadImageModule,
    AsyncPipe
  ],
  templateUrl: './splash.component.html',
  styleUrls: ['./splash.component.scss'],
})
export class SplashComponent {

  imagesWrapper = viewChild<ElementRef>('imagesWrapper');

  Array = Array;

  readonly IMAGE_LIMIT = 9;
  readonly MAX_IMAGE_SIZE = 2000;
  readonly defaultImage = { src: '/assets/loadingphunk.png', type: 'loading' };
  readonly defaultImages: Image[] = Array(this.IMAGE_LIMIT).fill(this.defaultImage);

  collection = input<Collection | null>();
  collection$ = toObservable(this.collection);

  mintImage = input<string | null>();
  mintImage$ = toObservable(this.mintImage);

  images$: Observable<Image[]> = this.collection$.pipe(
    distinctUntilChanged((prev, curr) => prev?.slug === curr?.slug),
    switchMap((collection) => {
      if (!collection) return of(this.defaultImages);
      const previewShas = collection.previews?.map(({ sha }) => sha);

      if (!previewShas?.length) return of(this.defaultImages);

      // For cryptophunksv67, bias toward rarer items
      const needsRarity = collection.slug === 'cryptophunksv67';

      const shas$ = needsRarity
        ? this.dataSvc.getAttributes(collection.slug).pipe(
            map((attributes) => this.pickRareShas(previewShas, attributes)),
          )
        : of(previewShas);

      return shas$.pipe(
        switchMap((shas) => from(this.createImageArray(shas)).pipe(
          switchMap((images) => {
            return this.mintImage$.pipe(
              map((mintImage) => {
                if (!mintImage || !collection.isMinting) return images;
                const newImages: Image[] = [...images];
                const centerIndex = Math.floor(this.IMAGE_LIMIT / 2);
                newImages[centerIndex] = {
                  src: mintImage,
                  type: 'mint'
                };
                return newImages;
              }),
            );
          }),
          startWith(this.defaultImages)
        )),
      );
    }),
  );

  constructor(
    private pixelArtSvc: PixelArtService,
    private imageSvc: ImageService,
    private dataSvc: DataService
  ) {}

  // async formatImages(images: Image[]): Promise<Image[]> {
  //   const centerImageIndex = Math.floor(this.IMAGE_LIMIT / 2);

  //   if (images[centerImageIndex]?.type === 'mint') {
  //     const buffer = await fetch(images[centerImageIndex].src).then((res) => res.arrayBuffer());
  //     const pixelArtImage = await this.pixelArtSvc.processPixelArtImage(buffer);
  //     const svg = this.pixelArtSvc.convertToSvg(pixelArtImage);
  //     const newImage = this.pixelArtSvc.stripColors(svg);
  //     images[centerImageIndex] = {
  //       src: this.pixelArtSvc.convertToBase64(newImage),
  //       type: 'gray'
  //     };
  //   }

  //   return images;
  // }

  async animateMint() {
    const children = this.imagesWrapper()?.nativeElement.children;
    // console.log({children});
    if (!children) return;

    await gsap.to(children, {
      opacity: .1,
      duration: 0.5,
      ease: 'power2.inOut'
    });
  }

  /**
   * Creates an array of processed images from a list of SHA hashes
   *
   * @param shas - Array of SHA hashes identifying the images to fetch and process
   * @returns Promise that resolves when image processing is complete
   */
  async createImageArray(shas: string[]): Promise<Image[]> {
    if (!shas?.length) return [];

    const imageArray = [...this.defaultImages];
    let validImages = 0;
    let currentIndex = 0;

    // Keep processing until we have 9 valid images or run out of SHAs
    while (validImages < this.IMAGE_LIMIT && currentIndex < shas.length) {
      // Process next batch of images in parallel
      const batchSize = Math.min(5, shas.length - currentIndex);
      const batchPromises = shas.slice(currentIndex, currentIndex + batchSize).map(async (sha) => {
        try {
          const image = await this.imageSvc.fetchSupportedImageBySha(sha);

          // Detect GIF by magic bytes (GIF87a / GIF89a)
          const header = new Uint8Array(image.slice(0, 6));
          const isGif = header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46; // "GIF"

          // Detect APNG by looking for acTL chunk
          const bytes = new Uint8Array(image);
          let isApng = false;
          if (header[0] === 0x89 && header[1] === 0x50) { // PNG
            for (let j = 0; j < bytes.length - 4; j++) {
              if (bytes[j] === 0x61 && bytes[j+1] === 0x63 && bytes[j+2] === 0x54 && bytes[j+3] === 0x4C) { // "acTL"
                isApng = true;
                break;
              }
            }
          }

          if (isGif || isApng) {
            // Skip animated — fill with non-animated instead
            return null;
          }

          if (image.byteLength > this.MAX_IMAGE_SIZE) {
            // Non-pixel-art image (e.g. photos/rocks) — use direct URL
            return {
              src: `${environment.staticUrl}/static/images/${sha}`,
              type: 'photo' as const
            };
          }

          const pixels = await this.pixelArtSvc.processPixelArtImage(image);
          const svg = this.pixelArtSvc.convertToSvg(pixels);
          const base64 = this.pixelArtSvc.convertToBase64(svg);

          return {
            src: base64,
            type: 'loading' as const
          };
        } catch (error) {
          console.error(`Error processing image ${sha}:`, error);
          return null;
        }
      });

      const results = await Promise.all(batchPromises);

      // Add valid results to our array
      for (const result of results) {
        if (result && validImages < this.IMAGE_LIMIT) {
          imageArray[validImages] = result;
          validImages++;
        }
      }

      currentIndex += batchSize;
    }

    return imageArray;
  }

  /**
   * Picks SHAs biased toward rarer items for the splash header.
   * Tier 1 (highest): Special trait "One of One" or "Character"
   * Tier 2: Rare Type values (Alien, Cosmic, Ape, Zombie, Robot, Cyborg, Mythic, Guardian)
   * Tier 3: Everything else, scored by overall trait rarity
   * Mostly shows tier 1 & 2, mixed with a couple from tier 3 for variety.
   */
  private pickRareShas(previewShas: string[], attributes: AttributeItem | null): string[] {
    if (!attributes) return previewShas;

    // Rare Type values
    const rareTypes = new Set([
      'Alien', 'Cosmic', 'Ape', 'Zombie', 'Robot', 'Cyborg', 'Mythic', 'Guardian'
    ]);
    // Special trait values
    const specialValues = new Set(['One of One', 'Character']);

    const tier1: string[] = []; // Special: One of One, Character
    const tier2: string[] = []; // Rare Type: Alien, Cosmic, etc.
    const tier3: string[] = []; // Everything else

    for (const [sha, attrs] of Object.entries(attributes)) {
      let isSpecial = false;
      let isRareType = false;

      for (const attr of attrs) {
        if (attr.k === 'Special' && specialValues.has(attr.v)) isSpecial = true;
        if (attr.k === 'Type' && rareTypes.has(attr.v)) isRareType = true;
      }

      if (isSpecial) tier1.push(sha);
      else if (isRareType) tier2.push(sha);
      else tier3.push(sha);
    }

    // Shuffle each tier for variety on each reload
    this.shuffleArray(tier1);
    this.shuffleArray(tier2);
    this.shuffleArray(tier3);

    // Fill 9 slots: ~3 special, ~4 rare type, ~2 common (adjust based on availability)
    const picked: string[] = [];
    const t1Count = Math.min(tier1.length, 3);
    const t2Count = Math.min(tier2.length, this.IMAGE_LIMIT - t1Count - 2);
    const t3Count = this.IMAGE_LIMIT - t1Count - t2Count;

    for (let i = 0; i < t1Count; i++) picked.push(tier1[i]);
    for (let i = 0; i < t2Count; i++) picked.push(tier2[i]);
    for (let i = 0; i < t3Count && i < tier3.length; i++) picked.push(tier3[i]);

    // Overpick to account for animated items that get skipped in splash
    const overPick = this.IMAGE_LIMIT * 4;

    // If we still don't have enough, fill from whatever's left
    const used = new Set(picked);
    for (const pool of [tier1, tier2, tier3]) {
      for (const sha of pool) {
        if (picked.length >= overPick) break;
        if (!used.has(sha)) { picked.push(sha); used.add(sha); }
      }
    }

    // Final shuffle so tiers aren't grouped together
    this.shuffleArray(picked);

    return picked;
  }

  private shuffleArray<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  formatNumber(num: string): string | null {
    if (!num) return null;
    return String(num).padStart(4, '0');
  }

  async handleMintImage(mintImage: string, images: string[]) {
    const imagesWrapper = this.imagesWrapper()?.nativeElement;
    if (!imagesWrapper) return;

    let newImages = [...images];
    const centerImageIndex = Math.floor(this.IMAGE_LIMIT / 2); // 4th image
    const lastImage = newImages[newImages.length - 1];
    newImages.pop();

    newImages = [ lastImage, ...newImages ];
    newImages[centerImageIndex] = mintImage;

    // Process the mint image if it's a blob URL
    if (newImages[centerImageIndex + 1].startsWith('blob:')) {
      const buffer = await fetch(newImages[centerImageIndex + 1]).then((res) => res.arrayBuffer());
      const pixelArtImage = await this.pixelArtSvc.processPixelArtImage(buffer);
      const svg = this.pixelArtSvc.convertToSvg(pixelArtImage);
      const newImage = this.pixelArtSvc.stripColors(svg);
      newImages[centerImageIndex + 1] = this.pixelArtSvc.convertToBase64(newImage);
    }

    return newImages;
  }
}
