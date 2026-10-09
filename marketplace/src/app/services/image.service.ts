import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { SpriteService } from './sprite.service';

@Injectable({
  providedIn: 'root'
})
export class ImageService {

  private readonly spriteSvc = inject(SpriteService);

  constructor(private http: HttpClient) {}

  /**
   * Fetches an image by URL and returns it as a Blob
   * @param url URL of the image to fetch
   * @returns Observable resolving to the Blob of the image
   */
  public fetchImageBlob(url: string): Observable<Blob> {
    return this.http.get(url, { responseType: 'blob' });
  }

  /**
   * Fetches an image by URL and returns it as a Base64 string
   * @param url URL of the image to fetch
   * @returns Observable resolving to the Base64 string of the image
   */
  public fetchImageBase64(url: string): Observable<string> {
    return this.http.get(url, { responseType: 'text' });
  }

  /**
   * Fetches an image by SHA and converts it to a blob URL
   * @param sha SHA hash of the image to fetch
   * @returns ArrayBuffer of the image
   */
  public async fetchSupportedImageBySha(sha: string): Promise<ArrayBuffer> {
    // Packed art has no file of its own any more, so resolve through the sprite
    // service: it hands back a data URL for anything in a sheet and the original
    // file URL for everything else (the large rock art, the few GIFs).
    const url = await this.spriteSvc.url(sha);

    // Decode a data URL here rather than handing it to fetch().
    //
    // The bytes are already in the string, so fetching one is pure overhead — but
    // more importantly it THREW. `cache` and `Cache-Control` are HTTP concepts; a
    // request for a `data:` URL carrying a cache mode and custom headers is rejected,
    // and the rejection surfaced far from here: splash.component caught it per image,
    // returned null, and every slot kept `loadingphunk.png`. That is why the splash
    // row sat on placeholder art while the grids — which paint straight from the
    // sheet and never touch this path — rendered correctly.
    if (url.startsWith('data:')) {
      const b64 = url.slice(url.indexOf(',') + 1);
      const bin = atob(b64);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out.buffer;
    }

    const imageResponse = await fetch(url, {
      cache: 'force-cache',
      headers: {
        'Cache-Control': 'max-age=31536000' // 1 year
      }
    });
    const imageBuffer = await imageResponse.arrayBuffer();
    return imageBuffer;
  }
}
