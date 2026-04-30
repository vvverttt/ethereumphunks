import { Routes } from '@angular/router';

import { InitialCollectionGuard } from '@/guards/initial-collection.guard';

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
    loadComponent: () => import('@/routes/lottery/lottery.component').then(mod => mod.LotteryComponent)
  },
  {
    path: 'lottery-pro',
    loadComponent: () => import('@/routes/lottery/lottery.component').then(mod => mod.LotteryComponent),
    data: { lotteryAddress: '0x298771ECc338DE242ADa11e49E2B8224c33bf620'.toLowerCase() },
    runGuardsAndResolvers: 'always',
  },
  {
    path: 'lottery/wins',
    loadComponent: () => import('@/routes/lottery/lottery-wins.component').then(mod => mod.LotteryWinsComponent)
  },
  {
    path: 'lottery/pool',
    loadComponent: () => import('@/routes/lottery/lottery-pool.component').then(mod => mod.LotteryPoolComponent)
  },
  {
    path: 'auction',
    loadComponent: () => import('@/routes/auction/auction-page.component').then(mod => mod.AuctionPageComponent)
  },
  {
    path: 'auction2',
    loadComponent: () => import('@/routes/auction/auction-page.component').then(mod => mod.AuctionPageComponent),
    data: { auctionAddress: '0x2132622FF3178EF2574aF25D8EFdf94D6b7cc630'.toLowerCase() }
  },
  {
    path: 'owners',
    loadComponent: () => import('@/routes/owners/owners-page.component').then(mod => mod.OwnersPageComponent)
  },
  {
    path: 'phunkquidity',
    loadComponent: () => import('@/routes/phunkquidity/phunkquidity-page.component').then(mod => mod.PhunkquidityPageComponent)
  },
  {
    path: 'vault',
    loadComponent: () => import('@/routes/vault/vault-page.component').then(mod => mod.VaultPageComponent)
  },
  {
    path: 'vault/all',
    loadComponent: () => import('@/routes/vault/vault-all.component').then(mod => mod.VaultAllComponent)
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
    path: ':slug/owners',
    loadComponent: () => import('@/routes/collection-owners/collection-owners.component').then(mod => mod.CollectionOwnersComponent)
  },
  {
    path: ':slug/attributes',
    loadComponent: () => import('@/routes/collection-attributes/collection-attributes.component').then(mod => mod.CollectionAttributesComponent)
  },
  {
    path: ':slug',
    loadComponent: () => import('@/routes/index/index.component').then(mod => mod.IndexComponent)
  },
  {
    path: ':slug/market/:marketType',
    loadComponent: () => import('@/routes/market/market.component').then(mod => mod.MarketComponent)
  },
  {
    path: '**',
    redirectTo: '/',
  }
];
