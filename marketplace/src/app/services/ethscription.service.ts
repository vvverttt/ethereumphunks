import { Injectable } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

import { fromHex } from 'viem';

import { Phunk } from '@/models/db';
import { DecodedData, MIME_TYPE_MAP } from '@/models/ethscriptions';

import { Web3Service } from './web3.service';
import { ImageService } from './image.service';

@Injectable({
  providedIn: 'root'
})
export class EthscriptionService {

  constructor(
    private web3Svc: Web3Service,
    private sanitizer: DomSanitizer,
    private imageSvc: ImageService
  ) {}

  /**
   * Processes a phunk's image data from the blockchain
   * @param phunk The phunk object containing the hash ID
   */
  async processImage(phunk: Phunk | null): Promise<DecodedData | null> {
    if (!phunk) return null;

    let imageData;
    if (phunk?.isSupported) {
      imageData = await this.fetchHostedImage(phunk);
    } else {
      const inscriptionTx = await this.web3Svc.getTransactionL1(phunk?.hashId as string);
      const txData = fromHex(inscriptionTx.input || inscriptionTx.data, 'string');
      imageData = txData.replace(/\x00/g, '').replace(/^0x/, '');
    }

    if (!imageData) return null;
    return this.decodeDataURI(imageData);
  }

  async fetchHostedImage(phunk: Phunk | null): Promise<string | null> {
    const image = await this.imageSvc.fetchSupportedImageBySha(phunk?.sha as string);

    // Convert ArrayBuffer to base64 string
    const uint8Array = new Uint8Array(image);
    const binaryString = uint8Array.reduce((str, byte) => str + String.fromCharCode(byte), '');
    const base64String = btoa(binaryString);

    // Detect MIME type from magic bytes
    const mimeType = this.detectMimeType(uint8Array);
    const dataUri = `data:${mimeType};base64,${base64String}`;

    return dataUri;
  }

  private detectMimeType(bytes: Uint8Array): string {
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png';
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg';
    if (bytes[0] === 0x3C) return 'image/svg+xml';
    return 'image/png';
  }

  /**
   * Decodes a data URI string into content type, mime type and data
   * Handles base64 encoded data and various content types
   * @param dataURI The data URI string to decode
   * @returns DecodedData object containing type, mimeType and processed data
   */
  private decodeDataURI(dataURI: string): DecodedData {
    if (!dataURI) return { type: 'unsupported', mimeType: '', data: 'No Data URI' };
    if (dataURI.startsWith('https://')) return { type: 'url', mimeType: '', data: dataURI };

    const match = dataURI.match(/^data:([^;,]*)(;[^,]*)?,(.*)$/);
    if (!match) return { type: 'unsupported', mimeType: '', data: 'Invalid Data URI' };

    const mimeType = match[1] || '';
    const isBase64 = match[2]?.includes('base64');
    let data = match[3];

    const makeDataURI = (type: string, d: string, base64 = false) =>
      `data:${type}${base64 ? ';base64' : ''},${d}`;

    const mappedType = MIME_TYPE_MAP[mimeType] || 'unsupported';
    switch (mappedType) {
      case 'image':
        return { type: 'image', mimeType, data: makeDataURI(mimeType, data, isBase64) };
      case 'video':
        return { type: 'video', mimeType, data: makeDataURI(mimeType, data, isBase64) };
      case 'html':
        try {
          const decoded = isBase64 ? atob(data) : decodeURIComponent(data);
          // Inject responsive script and centering styles into the HTML
          const injectContent = `
            <style>
              html, body {
                margin: 0;
                padding: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                width: 100%;
                background: none;
              }
              body > * {
                margin: 0 auto;
                max-width: 100%;
              }
            </style>
          `;
          const enhancedHTML = decoded.includes('</head>')
            ? decoded.replace('</head>', `${injectContent}</head>`)
            : `<head>${injectContent}</head>${decoded}`;

          return { type: 'html', mimeType, data: this.sanitizer.bypassSecurityTrustHtml(enhancedHTML) as string };
        } catch (error) {
          console.error('Error processing HTML content:', error);
          return { type: 'unsupported', mimeType, data: 'Error processing HTML content' };
        }
      case 'json':
        try {
          const decoded = isBase64 ? atob(data) : decodeURIComponent(data);
          const json = JSON.parse(decoded);
          return { type: 'json', mimeType, data: JSON.stringify(json, null, 2) };
        } catch {
          return { type: 'unsupported', mimeType, data: 'Error parsing JSON' };
        }
      case 'text':
        try {
          const decoded = isBase64 ? atob(data) : decodeURIComponent(data);
          return { type: 'text', mimeType, data: decoded };
        } catch {
          return { type: 'unsupported', mimeType, data: 'Error decoding text' };
        }
      default:
        return { type: 'unsupported', mimeType, data: `Unsupported MIME type: ${mimeType}` };
    }
  }
}
