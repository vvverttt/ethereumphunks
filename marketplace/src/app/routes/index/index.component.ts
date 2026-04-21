import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { WaIntersectionObserver } from '@ng-web-apis/intersection-observer';

import { Store } from '@ngrx/store';
import { TimeagoModule } from 'ngx-timeago';
import { LazyLoadImageModule } from 'ng-lazyload-image';

import { PhunkGridComponent } from '@/components/phunk-grid/phunk-grid.component';
import { RecentActivityComponent } from '@/components/recent-activity/recent-activity.component';
import { SplashComponent } from '@/components/splash/splash.component';
import { BrbComponent } from '@/components/brb/brb.component';
import { MintComponent } from '@/components/mint/mint.component';
import { CalcPipe } from '@/pipes/calculate.pipe';
import { MosaicComponent } from '@/components/mosaic/mosaic.component';
import { CollectionStatsComponent } from '@/components/collection-stats/collection-stats.component';

import { DataService } from '@/services/data.service';
import { ThemeService } from '@/services/theme.service';

import { GlobalState } from '@/models/global-state';

import * as dataStateSelectors from '@/state/selectors/data-state.selectors';
import * as appStateSelectors from '@/state/selectors/app-state.selectors';
import * as marketStateSelectors from '@/state/selectors/market-state.selectors';
import { combineLatest, map, tap } from 'rxjs';

// Navigation links between OG and Quantum collections (independent of evolve contract)
const LINKED_SLUG_MAP: Record<string, string> = {
  'og-missing-phunks': 'quantummissingphunksv67',
  'og-dysto-phunks': 'quantumdystophunkzv67',
  'quantummissingphunksv67': 'og-missing-phunks',
  'quantumdystophunkzv67': 'og-dysto-phunks',
};

@Component({
  standalone: true,
  imports: [
    CommonModule,
    TimeagoModule,
    RouterModule,
    LazyLoadImageModule,
    WaIntersectionObserver,

    SplashComponent,
    PhunkGridComponent,
    RecentActivityComponent,
    BrbComponent,
    MintComponent,
    MosaicComponent,
    CollectionStatsComponent,
    CalcPipe,
  ],
  selector: 'app-index',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss']
})

export class IndexComponent {

  walletAddress$ = this.store.select(appStateSelectors.selectWalletAddress);
  connected$ = this.store.select(appStateSelectors.selectConnected);
  activeCollection$ = this.store.select(dataStateSelectors.selectActiveCollection);

  owned$ = this.store.select(marketStateSelectors.selectOwned);
  listings$ = this.store.select(marketStateSelectors.selectListings);
  bids$ = this.store.select(marketStateSelectors.selectBids);
  all$ = this.store.select(marketStateSelectors.selectAll);

  isMobile$ = this.store.select(appStateSelectors.selectIsMobile);
  usd$ = this.store.select(dataStateSelectors.selectUsd);

  config$ = this.store.select(appStateSelectors.selectConfig);

  ogCollection$ = combineLatest([
    this.activeCollection$,
    this.store.select(dataStateSelectors.selectCollections),
  ]).pipe(
    map(([active, collections]) => {
      if (!active || !collections) return null;
      const linkedSlug = LINKED_SLUG_MAP[active.slug];
      if (!linkedSlug) return null;
      return collections.find(c => c.slug === linkedSlug) || null;
    })
  );

  mintImage = signal<string | null>(null);
  openFaq = signal<string | null>(null);

  defaultFaq = [
    { q: 'What are QuantumPhunks?', a: 'QuantumPhunks are a culture-driven extension of the punk format, born from the Phunks ethos of anti-corporate values and decentralized open-source spirit. Created by Vert and Arkan, we begin from original punk combinations translated onto animal-based characters, with new combinations introduced, weaker pairings replaced, and hundreds of one-of-one pieces constructed by hand. Roughly 50 to 67 percent of the work was hand-manipulated through editing CSV trait generation files, adding traits to generation runs, selectively regenerating outputs, and performing manual trait and image edits throughout. Custom scripts and AI-assisted tools supported generation and trait assembly, but authorship remained hands-on at every stage. Every piece is stored fully on-chain as an Ethscription, inscribed directly into the calldata of Ethereum transactions. No IPFS, no Arweave, no external servers. Ethereum acts as the sole source of truth, preserving the data exactly as it was inscribed. The format extends beyond 10,000 through a deliberate numbering system that incorporates Missing Phunks from #10,000 to #10,250, DystoPhunkz from #10,251 onward, and EthsRocks, completing the collection as a structured evolution of the punk format. 1,481 unique trait values across 25 trait types, including 10 Phunk types, 16 variants, 719 total one-of-ones, many hidden details, and hidden one-of-ones. Drawing from decades of punk derivatives, themes, culture, memes, nostalgia, and history, QuantumPhunks are a comprehensive 24x24 study of the punk format, built to move the culture forward while honoring its roots.' },
    { q: 'What\'s the total supply and mechanics?', a: 'QuantumPhunks will have a total supply of 10,386. Turtles launch with a circulating supply of 3,267, alongside QuantumMissingPhunks and QuantumDystoPhunkz, plus a few more small collections. The remaining animals, including the rest of the DystoPhunks lineup, will roll out over time. All new supply added after launch flows through mechanisms so the current floor isn\'t affected: Auction House is modeled after Phunks.Auction with a held supply matching the current CryptoPhunksV2 treasury. Items in Auction House are part of the circulating supply since they can be swapped or bought at auction, but it mimics V2 by holding a 0.267 ETH reserve which will be updated as the floor moves. Auction Pro auctions rares only. Phunk Swap holds a locked reserve of 1,003 mostly female QuantumPhunks that remain swappable 1:1, since females are scarcer and tend to drag the floor down when circulating freely, and we will continue adding to this locked swappable reserve over time. Lottery contracts handle randomized distributions. Entry points are kept well above zero, with multiple mechanics in place to discourage quick flippers.' },
    { q: 'What exactly is going on here?', a: 'This is the home of DystoLabz collections. A marketplace for buying, selling, and exploring QuantumPhunks and related collections. All transactions happen on-chain through smart contracts originally forked from Chopperdad\'s EtherPhunks Market and Phunks Auction House, built upon and evolved by DystoLabz.' },
    { q: 'How do I get one?', a: 'You can buy one from the marketplace listings, win one through the lottery, or through our auction house.' },
    { q: 'Where are the images stored?', a: 'All images are stored fully on-chain as Ethscriptions, encoded directly into the calldata of Ethereum transactions by us. No IPFS, no servers, no external hosting.' },
    { q: 'Where does the market data on this site come from?', a: 'The prices and sales you see on this site are loaded from the marketplace contracts on the Ethereum blockchain.' },
    { q: 'Are they an ERC-721 token?', a: 'No. They are Ethscriptions, not ERC-721 tokens. Ownership is managed on-chain through our smart contracts and Ethereum transfer history.' },
    { q: 'Do you charge any fees for transactions?', a: 'No. There are zero fees and zero royalties on all marketplace transactions.' },
  ];

  collectionFaqs: Record<string, { q: string; a: string }[]> = {
    'og-missing-phunks': [
      { q: 'What are Missing Phunks?', a: '250 unique collectible characters, fully on-chain as Ethscriptions on Ethereum, inscribed directly in transaction calldata with no IPFS or off-chain storage. A handcrafted extension of Missing Phunks, created one by one using the original CryptoPunks trait system, while completing gaps in the OG format. Numbered 10,000–10,250, this collection introduces new Aliens, Ape Zombies, and expanded Male and Female representations, featuring structured rarity, higher trait density, and advanced trait stacking that pushes the punk format forward without breaking canon. This collection is a handcrafted derivative of Missing Phunks, with all 250 characters created manually, not randomly generated. It preserves the original CryptoPunks trait vocabulary and 24x24 visual language, while introducing new characters within existing species categories, including new Aliens, new Ape Zombies, and expanded Male and Female Phunks, intentionally completing gaps left in the original 0–9,999 run. A strict, structured rarity model was maintained throughout the collection. Scarcity is controlled across species, gender, and trait density to remain historically coherent with the punk ecosystem, ensuring rarity remains meaningful rather than inflated. Beyond traditional combinations, the collection introduces advanced trait stacking, allowing multiple traits of the same type to coexist, a mechanic not present in the original CryptoPunks. Examples include stacked hair traits such as Purple Hair combined with a Beanie, and other layered configurations that remain visually native while expanding the combinatorial limits of the OG format. While original CryptoPunks were largely limited to lower trait counts (with 7 traits appearing only rarely), this extension deliberately explores 7, 8, 9, and even 10 trait Phunks, using only OG traits stacked in ways that never previously existed. Numbered 10,000–10,250, the collection includes 0-trait Alien and Ape Zombie, Philip the Intern, PhunkBot V2 (aka FlippinBot), and the Ethereum Phunks PFP with both male and female versions, serving as a disciplined continuation of the punk design space. This is not a reinterpretation of the punk aesthetic, but a completion and extension of it, an ode to Missing Punks, V2 Phunks, and CryptoPhunks, proving the 24x24 format still has room to evolve while honoring its roots.' },
    ],
    'og-dysto-phunks': [
      { q: 'What are DystoPhunks?', a: 'An extension of CryptoPhunks and Missing Phunks, crafted as Ethscription digital artifacts, DystoPhunkz spans CryptoPhunks #10,251–10,319 and is minted and stored fully on-chain using Ethscriptions. These digital artifacts are inscribed directly on the Ethereum blockchain using etherscribe, with no IPFS or off-chain storage. Featured on the EtherPhunks market as its third curated collection, DystoPhunkz is a follow-up project to Missing Phunks and CryptoPhunks, consisting of a total supply of 69 characters numbered 10,251–10,319, introducing new rare traits and drawing inspiration from DystoPunks and Cyber Ordinals by Avocato. DystoPhunkz is based on a neon green theme outline and uses a dark green tone as its base color. The HEX code used for DystoPhunkz is #0d1b01, while OG Phunks use #000000. Since DystoPunks use a blue-toned theme, a green-toned base was used here, with all pure black replaced by this tone. Species color treatments vary across the collection. Aliens use cooler color tones, Apes blend toward dark purple, Zombies feature a fresher green typical of the dysto world, and Robots adopt gray metallic colors with antennas on their heads. The characters include Cyborgs, Robots, Zombies with brain rot, and Human evolution. Cyborgs are characterized by dominant facial line markings with color variations across alien, ape, and human versions and are the rarest type, with only 9 in the collection. Robots feature antennas that light up on their heads, metallic silver skin color, and wire teeth. Zombies include two types, one characterized by brain rot with flies and exposed brain on the left side of the head. Human evolution includes male and female characters marked by neon green facial stripes, representing the main group that first evolved within the dysto world. Traits in DystoPhunkz emphasize a neon green theme with maximum customization. Hair colors include neon green, white, purple, and pink, with updated models from OG Phunks such as Cyberbrain, Pompadour, Pink Rose, and Exotic Black. Eye traits focus on future-themed VR goggles in multiple models, while masks were developed as rare traits designed specifically to match the dystopian atmosphere of the collection. The rarest characters and traits consist of a mix of OG Phunks development and new designs. Notable pieces include Philip from CryptoPhunks V1 evolved into a cyborg and unique in the collection, Police Robots inspired by original bot Phunks with upgraded color suits and neon green VR, Next Gen Phunkbots inspired by Phunkbot with upgraded VR goggles and neck covers, Green Phunks male and female cyber residents inspired by Missing Phunks and the EtherPhunks logo and included among the 9 rare cyborgs, and helmet characters that exist as rare 1/1 items featuring full helmet coverage, VR glasses, and special masks.' },
    ],
    'ethsrocks': [],
  };

  faqItems: { q: string; a: string }[] = this.defaultFaq;

  toggleFaq(q: string) {
    this.openFaq.set(this.openFaq() === q ? null : q);
  }

  constructor(
    private store: Store<GlobalState>,
    public themeSvc: ThemeService,
    public dataSvc: DataService,
    public route: ActivatedRoute
  ) {
    this.activeCollection$.subscribe((collection) => {
      if (!collection) return;
      const customFaq = this.collectionFaqs[collection.slug];
      if (customFaq) {
        // OG collections only show their own custom FAQ
        this.faqItems = customFaq;
      } else {
        this.faqItems = this.defaultFaq;
      }
    });
  }

}
