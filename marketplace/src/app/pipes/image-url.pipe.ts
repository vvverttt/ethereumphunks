import { Phunk } from '@/models/db';
import { Pipe, PipeTransform } from '@angular/core';

import { environment } from 'src/environments/environment';

@Pipe({
  standalone: true,
  name: 'imageUrlPipe'
})
export class ImageUrlPipe implements PipeTransform {

  transform(phunk: Phunk): string {
    if (!phunk) return '';
    // Prefer the dedicated image CDN (Cloudflare R2/edge) when configured; fall back to staticUrl.
    const cdn = (environment as any).imageCdnUrl || environment.staticUrl;
    return cdn + '/static/images/' + phunk.sha;
  }
}
