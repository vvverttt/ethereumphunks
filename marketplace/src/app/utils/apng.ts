/**
 * Minimal APNG parser + encoder for upscaling animated PNGs.
 * Parses frames from an APNG, lets you redraw each on a larger canvas,
 * then re-encodes everything back into a valid APNG.
 */

interface ApngFrame {
  width: number;
  height: number;
  xOffset: number;
  yOffset: number;
  delayNum: number;
  delayDen: number;
  disposeOp: number;
  blendOp: number;
  imageData: Uint8Array; // raw PNG IDAT payload (deflated)
}

interface ParsedApng {
  width: number;
  height: number;
  frames: ApngFrame[];
  numPlays: number;
}

// ── helpers ──────────────────────────────────────────────────

function readUint32(data: Uint8Array, offset: number): number {
  return (data[offset] << 24 | data[offset + 1] << 16 | data[offset + 2] << 8 | data[offset + 3]) >>> 0;
}

function writeUint32(data: Uint8Array, offset: number, value: number) {
  data[offset] = (value >>> 24) & 0xff;
  data[offset + 1] = (value >>> 16) & 0xff;
  data[offset + 2] = (value >>> 8) & 0xff;
  data[offset + 3] = value & 0xff;
}

function writeUint16(data: Uint8Array, offset: number, value: number) {
  data[offset] = (value >>> 8) & 0xff;
  data[offset + 1] = value & 0xff;
}

function crc32(data: Uint8Array): number {
  let crc = -1;
  for (let i = 0; i < data.length; i++) {
    crc = crc ^ data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ -1) >>> 0;
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  writeUint32(chunk, 0, data.length);
  chunk[4] = type.charCodeAt(0);
  chunk[5] = type.charCodeAt(1);
  chunk[6] = type.charCodeAt(2);
  chunk[7] = type.charCodeAt(3);
  chunk.set(data, 8);
  const crcData = chunk.slice(4, 8 + data.length);
  writeUint32(chunk, 8 + data.length, crc32(crcData));
  return chunk;
}

function chunkType(data: Uint8Array, offset: number): string {
  return String.fromCharCode(data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]);
}

// ── parse ────────────────────────────────────────────────────

export function parseApng(buffer: ArrayBuffer): ParsedApng | null {
  const data = new Uint8Array(buffer);

  // Verify PNG signature
  if (data[0] !== 0x89 || data[1] !== 0x50) return null;

  let width = 0, height = 0;
  let numFrames = 0, numPlays = 0;
  const frames: ApngFrame[] = [];
  let currentFrame: Partial<ApngFrame> | null = null;
  let ihdrData: Uint8Array | null = null;
  let headerChunks: Uint8Array[] = []; // chunks between IHDR and first IDAT (e.g. PLTE, tRNS)
  let seenIDAT = false;

  let offset = 8; // skip signature
  while (offset < data.length) {
    const length = readUint32(data, offset);
    const type = chunkType(data, offset);
    const chunkData = data.slice(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = readUint32(chunkData, 0);
      height = readUint32(chunkData, 4);
      ihdrData = chunkData;
    } else if (type === 'acTL') {
      numFrames = readUint32(chunkData, 0);
      numPlays = readUint32(chunkData, 4);
    } else if (type === 'fcTL') {
      if (currentFrame?.imageData) {
        frames.push(currentFrame as ApngFrame);
      }
      currentFrame = {
        width: readUint32(chunkData, 4),
        height: readUint32(chunkData, 8),
        xOffset: readUint32(chunkData, 12),
        yOffset: readUint32(chunkData, 16),
        delayNum: (chunkData[20] << 8) | chunkData[21],
        delayDen: (chunkData[22] << 8) | chunkData[23],
        disposeOp: chunkData[24],
        blendOp: chunkData[25],
        imageData: new Uint8Array(0),
      };
    } else if (type === 'IDAT') {
      if (!seenIDAT && !currentFrame) {
        // Not an APNG or default image before acTL — collect as header
      }
      seenIDAT = true;
      if (currentFrame) {
        const merged = new Uint8Array(currentFrame.imageData!.length + chunkData.length);
        merged.set(currentFrame.imageData!);
        merged.set(chunkData, currentFrame.imageData!.length);
        currentFrame.imageData = merged;
      }
    } else if (type === 'fdAT') {
      // fdAT = sequence_number (4 bytes) + frame data
      const frameData = chunkData.slice(4);
      if (currentFrame) {
        const merged = new Uint8Array(currentFrame.imageData!.length + frameData.length);
        merged.set(currentFrame.imageData!);
        merged.set(frameData, currentFrame.imageData!.length);
        currentFrame.imageData = merged;
      }
    } else if (type === 'IEND') {
      if (currentFrame?.imageData) {
        frames.push(currentFrame as ApngFrame);
      }
      break;
    } else if (!seenIDAT && type !== 'acTL' && type !== 'fcTL') {
      // Collect ancillary chunks before IDAT (PLTE, tRNS, etc.)
      headerChunks.push(data.slice(offset, offset + 12 + length));
    }

    offset += 12 + length;
  }

  if (!frames.length || !ihdrData) return null;

  // Store ihdrData and headerChunks on each frame so we can reconstruct individual PNGs
  (frames as any).__ihdr = ihdrData;
  (frames as any).__headerChunks = headerChunks;

  return { width, height, frames, numPlays };
}

/**
 * Renders a single APNG frame as a standalone PNG blob URL.
 * Constructs a valid PNG from the frame's IDAT data + parent IHDR.
 */
export function frameToPngBlob(parsed: ParsedApng, frameIndex: number): Promise<Blob> {
  const frame = parsed.frames[frameIndex];
  const ihdr = (parsed.frames as any).__ihdr as Uint8Array;
  const headerChunks = (parsed.frames as any).__headerChunks as Uint8Array[];

  // Build a standalone PNG for this frame
  // Modify IHDR to use frame dimensions
  const newIhdr = new Uint8Array(ihdr);
  writeUint32(newIhdr, 0, frame.width);
  writeUint32(newIhdr, 4, frame.height);

  const signature = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdrChunk = makeChunk('IHDR', newIhdr);
  const idatChunk = makeChunk('IDAT', frame.imageData);
  const iendChunk = makeChunk('IEND', new Uint8Array(0));

  let totalLen = signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
  for (const c of headerChunks) totalLen += c.length;

  const png = new Uint8Array(totalLen);
  let pos = 0;
  png.set(signature, pos); pos += signature.length;
  png.set(ihdrChunk, pos); pos += ihdrChunk.length;
  for (const c of headerChunks) { png.set(c, pos); pos += c.length; }
  png.set(idatChunk, pos); pos += idatChunk.length;
  png.set(iendChunk, pos);

  return Promise.resolve(new Blob([png], { type: 'image/png' }));
}

/**
 * Upscales an APNG: renders each frame on a canvas with optional background,
 * then re-encodes as a new APNG at the target size.
 */
export async function upscaleApng(
  buffer: ArrayBuffer,
  targetWidth: number,
  targetHeight: number,
  bgColor: string | null
): Promise<string> {
  const parsed = parseApng(buffer);
  if (!parsed || parsed.frames.length === 0) {
    throw new Error('Not a valid APNG');
  }

  // Render each frame to a canvas and capture as PNG
  const framePngs: { blob: Blob; delayNum: number; delayDen: number }[] = [];

  for (let i = 0; i < parsed.frames.length; i++) {
    const frame = parsed.frames[i];
    const frameBlob = await frameToPngBlob(parsed, i);
    const frameBitmap = await createImageBitmap(frameBlob);

    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d')!;
    (ctx as any).imageSmoothingEnabled = false;

    // Draw background
    if (bgColor) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    }

    // Calculate scale to fill target
    const scaleX = targetWidth / parsed.width;
    const scaleY = targetHeight / parsed.height;

    // Draw frame at correct position and scale
    ctx.drawImage(
      frameBitmap,
      frame.xOffset * scaleX,
      frame.yOffset * scaleY,
      frame.width * scaleX,
      frame.height * scaleY
    );

    const blob = await canvas.convertToBlob({ type: 'image/png' });
    framePngs.push({
      blob,
      delayNum: frame.delayNum,
      delayDen: frame.delayDen,
    });
  }

  // Now build a new APNG from the upscaled frame PNGs
  return await encodeApng(framePngs, targetWidth, targetHeight, parsed.numPlays);
}

/**
 * Encodes multiple PNG blobs into a single APNG.
 */
async function encodeApng(
  frames: { blob: Blob; delayNum: number; delayDen: number }[],
  width: number,
  height: number,
  numPlays: number
): Promise<string> {
  // Parse each frame PNG to extract IHDR and IDAT data
  const frameDatas: { ihdr: Uint8Array; idat: Uint8Array; headerChunks: Uint8Array[] }[] = [];

  for (const frame of frames) {
    const buf = await frame.blob.arrayBuffer();
    const data = new Uint8Array(buf);
    let ihdr: Uint8Array | null = null;
    let idat = new Uint8Array(0);
    const hdrChunks: Uint8Array[] = [];
    let seenIdat = false;

    let off = 8;
    while (off < data.length) {
      const len = readUint32(data, off);
      const type = chunkType(data, off);
      const chunkData = data.slice(off + 8, off + 8 + len);

      if (type === 'IHDR') ihdr = chunkData;
      else if (type === 'IDAT') {
        seenIdat = true;
        const merged = new Uint8Array(idat.length + chunkData.length);
        merged.set(idat);
        merged.set(chunkData, idat.length);
        idat = merged;
      } else if (type === 'IEND') break;
      else if (!seenIdat) hdrChunks.push(data.slice(off, off + 12 + len));

      off += 12 + len;
    }

    frameDatas.push({ ihdr: ihdr!, idat, headerChunks: hdrChunks });
  }

  // Build APNG
  const parts: Uint8Array[] = [];
  const signature = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  parts.push(signature);

  // IHDR from first frame
  parts.push(makeChunk('IHDR', frameDatas[0].ihdr));

  // Header chunks from first frame (PLTE, tRNS, etc.)
  for (const c of frameDatas[0].headerChunks) parts.push(c);

  // acTL
  const actlData = new Uint8Array(8);
  writeUint32(actlData, 0, frames.length);
  writeUint32(actlData, 4, numPlays);
  parts.push(makeChunk('acTL', actlData));

  let seqNum = 0;

  for (let i = 0; i < frames.length; i++) {
    // fcTL
    const fctlData = new Uint8Array(26);
    writeUint32(fctlData, 0, seqNum++);
    writeUint32(fctlData, 4, width);
    writeUint32(fctlData, 8, height);
    writeUint32(fctlData, 12, 0); // x_offset
    writeUint32(fctlData, 16, 0); // y_offset
    writeUint16(fctlData, 20, frames[i].delayNum);
    writeUint16(fctlData, 22, frames[i].delayDen || 100);
    fctlData[24] = 0; // dispose: none
    fctlData[25] = 0; // blend: source
    parts.push(makeChunk('fcTL', fctlData));

    if (i === 0) {
      // First frame uses IDAT
      parts.push(makeChunk('IDAT', frameDatas[i].idat));
    } else {
      // Subsequent frames use fdAT
      const fdatPayload = new Uint8Array(4 + frameDatas[i].idat.length);
      writeUint32(fdatPayload, 0, seqNum++);
      fdatPayload.set(frameDatas[i].idat, 4);
      parts.push(makeChunk('fdAT', fdatPayload));
    }
  }

  // IEND
  parts.push(makeChunk('IEND', new Uint8Array(0)));

  // Combine
  let totalLen = 0;
  for (const p of parts) totalLen += p.length;
  const result = new Uint8Array(totalLen);
  let pos = 0;
  for (const p of parts) { result.set(p, pos); pos += p.length; }

  const blob = new Blob([result], { type: 'image/png' });
  return URL.createObjectURL(blob);
}
