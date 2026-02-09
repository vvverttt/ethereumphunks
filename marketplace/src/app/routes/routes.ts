import { Routes } from '@angular/router';

import { InitialCollectionGuard } from '@/guards/initial-collection.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'cryptophunksv67',
    pathMatch: 'full'
  },
  {
    path: 'market/:marketType',
    redirectTo: 'cryptophunksv67/market/:marketType',
    pathMatch: 'full'
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
    path: 'lottery/wins',
    loadComponent: () => import('@/routes/lottery/lottery-wins.component').then(mod => mod.LotteryWinsComponent)
  },
  {
    path: 'details/:hashId',
    loadComponent: () => import('@/routes/item-view/item-view.component').then(mod => mod.ItemViewComponent)
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
