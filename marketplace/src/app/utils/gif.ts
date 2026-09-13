/**
 * Upscales an animated GIF with nearest-neighbour so pixel art stays crisp.
 *
 * The artwork is 24x24. Static downloads are rendered to 480x480, but GIFs were
 * saved as the original bytes — so an animated item downloaded at native size and
 * looked blurry the moment anything scaled it up, while its static neighbours came
 * out sharp. This re-renders every frame onto a 480x480 canvas with image smoothing
 * off and re-encodes, keeping the animation and the hard pixel edges.
 *
 * Decoding uses WebCodecs `ImageDecoder`, which reads GIF frames natively — no
 * decoder dependency. It isn't available everywhere, so this throws when it's
 * missing and the caller falls back to shipping the original bytes: worst case is
 * today's behaviour, never a broken or de-animated file.
 */
import { GIFEncoder, quantize, applyPalette } from './gifenc.vendor';

/** True when frame-accurate GIF decoding is available in this browser. */
export function canUpscaleGif(): boolean {
  return typeof (globalThis as any).ImageDecoder === 'function';
}

/**
 * Optional Phunk Box decoration applied to every frame.
 *
 * `clip` traces the export shape (round/hexagon) and is applied before the fill
 * and the art, so the corners end up genuinely transparent. `border` strokes the
 * same outline afterwards, outside the clip, or it would come out half-width.
 */
export interface FrameDecoration {
  clip?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  border?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}

export async function upscaleGif(
  buffer: ArrayBuffer,
  targetWidth: number,
  targetHeight: number,
  bgColor: string | null,
  decoration?: FrameDecoration,
): Promise<Blob> {
  const Decoder = (globalThis as any).ImageDecoder;
  if (typeof Decoder !== 'function') throw new Error('ImageDecoder unavailable');

  const decoder = new Decoder({ data: buffer, type: 'image/gif' });
  await decoder.tracks.ready;

  const track = decoder.tracks.selectedTrack;
  const frameCount: number = track?.frameCount ?? 1;
  if (!frameCount) throw new Error('GIF has no frames');

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | null;
  if (!ctx) throw new Error('no 2d context');
  // The whole point: keep the pixels square instead of interpolating them.
  ctx.imageSmoothingEnabled = false;

  const gif = GIFEncoder();
  // A clipped shape leaves transparent corners even when a background colour is
  // set, so the palette has to keep an alpha channel in that case too.
  const needsAlpha = !bgColor || !!decoration?.clip;
  const format = needsAlpha ? 'rgba4444' : 'rgb565';

  for (let i = 0; i < frameCount; i++) {
    const { image } = await decoder.decode({ frameIndex: i });

    // GIF frames from ImageDecoder are already composited against the previous
    // frame, so each one is a complete picture — repaint the full canvas rather
    // than tracking disposal regions the way the APNG path has to.
    // Always start from a clear canvas: with a clipped shape the area outside it
    // must stay transparent even when a background colour is set.
    ctx.clearRect(0, 0, targetWidth, targetHeight);

    // background -> border -> art, so the phunk sits in front of the border.
    ctx.save();
    if (decoration?.clip) {
      decoration.clip(ctx, targetWidth, targetHeight);
      ctx.clip();
    }
    if (bgColor) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    }
    ctx.restore();

    decoration?.border?.(ctx, targetWidth, targetHeight);

    ctx.save();
    if (decoration?.clip) {
      decoration.clip(ctx, targetWidth, targetHeight);
      ctx.clip();
    }
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
    ctx.restore();

    const { data } = ctx.getImageData(0, 0, targetWidth, targetHeight);
    const palette = quantize(data, 256, { format, oneBitAlpha: needsAlpha });
    const index = applyPalette(data, palette, format);

    // ImageDecoder reports duration in microseconds. Browsers clamp very short
    // GIF delays to 100ms, so mirror that floor rather than emitting 0.
    const durationUs: number = image.duration ?? 0;
    const delay = durationUs > 0 ? Math.max(20, Math.round(durationUs / 1000)) : 100;

    const opts: any = { palette, delay };
    if (i === 0) opts.repeat = 0; // loop forever
    if (!bgColor) {
      const ti = (palette as number[][]).findIndex((c) => c.length >= 4 && c[3] === 0);
      if (ti >= 0) { opts.transparent = true; opts.transparentIndex = ti; }
    }
    gif.writeFrame(index, targetWidth, targetHeight, opts);

    image.close?.();
  }

  decoder.close?.();
  gif.finish();
  return new Blob([gif.bytes()], { type: 'image/gif' });
}
