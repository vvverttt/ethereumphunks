import { Routes } from '@angular/router';

import { InitialCollectionGuard } from '@/guards/initial-collection.guard';
import { featureVisibleGuard, hiddenSlugGuard } from '@/guards/visibility.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [InitialCollectionGuard],
    component: InitialCollectionGuard,
    pathMatch: 'full',
  },
  {
    path: 'market/:marketType',
    canActivate: [InitialCollectionGuard],
    component: InitialCollectionGuard,
    pathMatch: 'full',
  },
  {
    path: 'curated/:slug',
    redirectTo: ':slug',
    pathMatch: 'full'
  },
  {
    path: 'curated/:slug/market/:marketType',
    redirectTo: ':slug/market/:marketType',
    pathMatch: 'full'
  },
  {
    path: 'lottery',
    canActivate: [featureVisibleGuard('showLottery')],
    loadComponent: () => import('@/routes/lottery/lottery.component').then(mod => mod.LotteryComponent)
  },
  {
    path: 'lottery/wins',
    canActivate: [featureVisibleGuard('showLottery')],
    loadComponent: () => import('@/routes/lottery/lottery-wins.component').then(mod => mod.LotteryWinsComponent)
  },
  {
    path: 'lottery/pool',
    canActivate: [featureVisibleGuard('showLottery')],
    loadComponent: () => import('@/routes/lottery/lottery-pool.component').then(mod => mod.LotteryPoolComponent)
  },
  {
    path: 'auction',
    canActivate: [featureVisibleGuard('showAuction')],
    loadComponent: () => import('@/routes/auction/auction-page.component').then(mod => mod.AuctionPageComponent)
  },
  {
    path: 'auction2',
    canActivate: [featureVisibleGuard('showAuction')],
    loadComponent: () => import('@/routes/auction/auction-page.component').then(mod => mod.AuctionPageComponent),
    data: { auctionAddress: '0x2132622FF3178EF2574aF25D8EFdf94D6b7cc630'.toLowerCase() }
  },
  {
    path: 'owners',
    loadComponent: () => import('@/routes/owners/owners-page.component').then(mod => mod.OwnersPageComponent)
  },
  {
    path: 'admin',
    loadComponent: () => import('@/routes/admin/admin.component').then(mod => mod.AdminComponent)
  },
  {
    path: 'details/:hashId',
    loadComponent: () => import('@/routes/item-view/item-view.component').then(mod => mod.ItemViewComponent)
  },
  {
    // ERC-721C collections are routed by NFT contract address + tokenId, OpenSea-style (e.g. /details/0x67b850…/587)
    path: 'details/:contract/:tokenId',
    loadComponent: () => import('@/routes/item-view/item-view.component').then(mod => mod.ItemViewComponent)
  },
  {
    path: ':slug/owners',
    canActivate: [hiddenSlugGuard],
    loadComponent: () => import('@/routes/collection-owners/collection-owners.component').then(mod => mod.CollectionOwnersComponent)
  },
  {
    path: ':slug/attributes',
    canActivate: [hiddenSlugGuard],
    loadComponent: () => import('@/routes/collection-attributes/collection-attributes.component').then(mod => mod.CollectionAttributesComponent)
  },
  {
    path: ':slug',
    canActivate: [hiddenSlugGuard],
    loadComponent: () => import('@/routes/index/index.component').then(mod => mod.IndexComponent)
  },
  {
    path: ':slug/market/:marketType',
    canActivate: [hiddenSlugGuard],
    loadComponent: () => import('@/routes/market/market.component').then(mod => mod.MarketComponent)
  },
  {
    path: '**',
    redirectTo: '/',
  }
];
