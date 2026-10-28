import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';

/**
 * Terms, License, Privacy and The Shell Archive (our credits), linked from the footer like
 * cryptopunks.app's. Plain-language
 * drafts written for the project, not legal advice. Everything (art, names, the site's code and
 * design) is CC0, with a non-binding
 * creator's note: CC0 cannot carry conditions, so the "make it better, not slop" ethos is a
 * request to builders rather than a term.
 */
@Component({
  standalone: true,
  imports: [CommonModule, RouterModule],
  selector: 'app-legal',
  templateUrl: './legal.component.html',
  styleUrls: ['./legal.component.scss'],
})
export class LegalComponent {
  readonly page: 'terms' | 'license' | 'privacy' | 'shell-archive' | 'about' = inject(ActivatedRoute).snapshot.data['page'];

  /** The Shell Archive: the sources that shaped QuantumPhunks (our credits), with the links
   *  from the original archive at dystolabz.com/blog/2026-1-4-1/new-blog.html. */
  readonly sources: { name: string; url?: string }[] = [
    { name: 'GamePunks', url: 'https://opensea.io/collection/gamepunks' },
    { name: 'Ninja Turtle Punks', url: 'https://opensea.io/collection/ninjaturtlepunks' },
    { name: 'V1 Phunks', url: 'https://opensea.io/collection/official-v1-phunks' },
    { name: 'CryptoPhunks V2', url: 'https://opensea.io/collection/cryptopunks' },
    { name: 'CryptoPunks V1', url: 'https://v1cryptopunks.com/' },
    { name: 'CryptoPunks V2', url: 'https://cryptopunks.eth.limo/' },
    { name: 'Missing Phunks', url: 'https://dystolabz.com/project/missing-phunks.html' },
    { name: 'DystoPhunkz', url: 'https://dystolabz.com/DystoPhunkz.html' },
    { name: 'Missing Punks', url: 'https://opensea.io/collection/missingpunks' },
    { name: 'DystoPunks', url: 'https://opensea.io/collection/dystopunks' },
    { name: 'WTF Punks', url: 'https://opensea.io/collection/wtfpunks' },
    { name: 'Fast Food Punks', url: 'https://opensea.io/collection/fastfoodpunks' },
    { name: 'Fast Food Punks (ERC1155 FFP)', url: 'https://opensea.io/collection/erc1155ffp' },
    { name: 'Fast Food Punks 2', url: 'https://opensea.io/collection/fastfoodpunks2' },
    { name: 'PixelPunks Celebrities', url: 'https://opensea.io/collection/pixelpunks-celebrities' },
    { name: 'Legend Punks', url: 'https://opensea.io/collection/legend-punks-collection' },
    { name: 'CinePunk Film Club', url: 'https://opensea.io/collection/cinepunkfilmclub' },
    { name: 'PPPhunks', url: 'https://foundation.app/collection/ppphunks' },
    { name: 'Punkism', url: 'https://punkism.art/?filter=random' },
    { name: 'BespokedPunks', url: 'https://opensea.io/collection/bespokedpunks' },
    { name: 'CollabPunks', url: 'https://opensea.io/collection/collabpunks' },
    { name: 'Kevin Punks', url: 'https://opensea.io/collection/kevinpunks' },
    { name: 'ScifiPunks', url: 'https://opensea.io/collection/scifipunks' },
    { name: 'MetaVerse Punks', url: 'https://x.com/MetaversePunks_' },
    { name: '0xPunks', url: 'https://opensea.io/collection/0xpunks-official' },
    { name: 'Alotta Punk', url: 'https://opensea.io/item/ethereum/0x5457ef2d4e248d62b7194f57901361024af9a3f0/131' },
    { name: 'Unofficial Punks', url: 'https://opensea.io/collection/unofficialpunks' },
    { name: 'PhilipInternProject', url: 'https://opensea.io/collection/philipinternproject' },
    { name: 'Bastard Gan Punks V2', url: 'https://opensea.io/collection/bastard-gan-punks-v2' },
    { name: 'Genius Punks', url: 'https://opensea.io/collection/genius-punks' },
    { name: 'PunksHalloween', url: 'https://opensea.io/collection/punkshalloween' },
    { name: 'MemePunks', url: 'https://opensea.io/collection/memepunks' },
    { name: 'MorePunks', url: 'https://opensea.io/collection/morepunks' },
    { name: 'Cyber Ordinals', url: 'https://magiceden.us/ordinals/marketplace/cyber-ordinals' },
    { name: 'Bitmap Punks', url: 'https://bitmappunks.com/gallery' },
    { name: 'NodeMonkes', url: 'https://magiceden.us/ordinals/marketplace/nodemonkes' },
    { name: 'Flamingo Party', url: 'https://magiceden.us/marketplace/flamingo_party' },
    { name: 'Frunks', url: 'https://opensea.io/collection/frunks' },
    { name: "Punk's Not Dead Github", url: 'https://github.com/cryptopunksnotdead' },
    { name: 'Mfpurrs', url: 'https://mfpurrs.com/' },
    { name: 'Call Data Comrades', url: 'https://www.nomorelabs.xyz/cdc.html' },
    { name: '1337', url: 'https://linktr.ee/1337skulls' },
    { name: 'PIV', url: 'https://x.com/piv_piv' },
    { name: 'Wisst Bescheid', url: 'https://punkism.art/artist/wisst-bescheid' },
    { name: 'Ian by Design', url: 'https://punkism.art/artist/ian-by-design' },
    { name: 'UnPunks', url: 'https://x.com/etherphunks/status/2015484865689575686?s=20' },
    { name: 'XCopy', url: 'https://xcopy.art/' },
    { name: 'PepePhunks', url: 'https://opensea.io/collection/pepephunks' },
    { name: 'Nakamigos', url: 'https://opensea.io/collection/nakamigos' },
  ];
  readonly updated = 'October 27, 2026';
}
