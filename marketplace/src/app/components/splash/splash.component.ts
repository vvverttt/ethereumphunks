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

          // Real PNG dimensions: metadata-bloated pixel art (EXIF/XMP) can exceed the
          // byte threshold while still being a small 24x24 image. Only treat it as a
          // "photo" (smooth rendering) if it's NOT small pixel art — otherwise small
          // art that happens to be a heavy file renders blurry.
          let pngWidth = 0;
          if (header[0] === 0x89 && header[1] === 0x50) { // PNG signature
            pngWidth = ((bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]) >>> 0;
          }
          const isSmallPixelArt = pngWidth > 0 && pngWidth <= 64;

          if (!isSmallPixelArt && image.byteLength > this.MAX_IMAGE_SIZE) {
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
   * Picks SHAs for the splash header: one per Animal, rarest first within each.
   *
   * Rarity alone doesn't work here. Turtles are 845 of the 860 "One of One"/"Character"
   * items, so a purely rarity-ranked pick returns an all-turtle strip and none of the
   * other 22 animals ever appear. Rotating over animals first and applying rarity only
   * *within* an animal keeps the rare picks while showing the whole cast.
   */
  private pickRareShas(previewShas: string[], attributes: AttributeItem | null): string[] {
    if (!attributes) return previewShas;

    // Rare Type values
    const rareTypes = new Set([
      'Alien', 'Cosmic', 'Ape', 'Zombie', 'Robot', 'Cyborg', 'Mythic', 'Guardian'
    ]);
    // Special trait values
    const specialValues = new Set(['One of One', 'Character']);

    // animal -> [tier1 (Special), tier2 (rare Type), tier3 (rest)]
    const byAnimal = new Map<string, [string[], string[], string[]]>();

    for (const [sha, attrs] of Object.entries(attributes)) {
      let animal = 'Unknown';
      let isSpecial = false;
      let isRareType = false;

      for (const attr of attrs) {
        if (attr.k === 'Animal') animal = String(attr.v);
        if (attr.k === 'Special' && specialValues.has(attr.v)) isSpecial = true;
        if (attr.k === 'Type' && rareTypes.has(attr.v)) isRareType = true;
      }

      if (!byAnimal.has(animal)) byAnimal.set(animal, [[], [], []]);
      byAnimal.get(animal)![isSpecial ? 0 : isRareType ? 1 : 2].push(sha);
    }

    // Flatten each animal to one rarity-ordered list, shuffled within tier so the
    // same rare items don't recur on every reload.
    const ordered = new Map<string, string[]>();
    for (const [animal, tiers] of byAnimal) {
      for (const tier of tiers) this.shuffleArray(tier);
      ordered.set(animal, [...tiers[0], ...tiers[1], ...tiers[2]]);
    }

    const animals = [...ordered.keys()];
    this.shuffleArray(animals);

    // Overpick to account for animated items that get skipped in splash
    const overPick = this.IMAGE_LIMIT * 2;
    const picked: string[] = [];

    // Turtles keep a fixed share (~2 of every 9 shown) rather than taking a single
    // round-robin slot like the rest — they're the original 4,251 and hold nearly
    // every 1/1, so rotating them out entirely would be as wrong as showing only them.
    const turtlePool = ordered.get('Turtle') ?? [];
    const turtleSlots = Math.min(turtlePool.length, Math.round((overPick * 2) / this.IMAGE_LIMIT));
    for (let i = 0; i < turtleSlots; i++) picked.push(turtlePool[i]);

    // Round-robin the remaining slots: lap 0 takes each animal's rarest, lap 1 its
    // next, and so on. With more animals than slots this fills the rest of the strip
    // with distinct animals.
    const others = animals.filter((animal) => animal !== 'Turtle');
    for (let lap = 0; picked.length < overPick; lap++) {
      let added = 0;
      for (const animal of others) {
        if (picked.length >= overPick) break;
        const pool = ordered.get(animal)!;
        if (lap < pool.length) { picked.push(pool[lap]); added++; }
      }
      if (!added) break;
    }

    // Final shuffle so the strip isn't ordered by animal
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
