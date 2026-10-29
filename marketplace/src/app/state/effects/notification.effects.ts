import { Injectable } from '@angular/core';

import { Store } from '@ngrx/store';

import { Actions, createEffect, ofType } from '@ngrx/effects';

import { Web3Service } from '@/services/web3.service';

import { GlobalState, Notification } from '@/models/global-state';
import { Event } from '@/models/db';

import { EMPTY, catchError, delay, map, of, switchMap, tap, withLatestFrom } from 'rxjs';

import { environment } from 'src/environments/environment';
import { DataService } from '@/services/data.service';

import { selectNotifHoverState, selectNotifications } from '../selectors/notification.selectors';
import { selectWalletAddress } from '../selectors/app-state.selectors';

import { setCurrentBlock, setWalletAddress } from '../actions/app-state.actions';
import { removeNotification, setNotifications, upsertNotification } from '../actions/notification.actions';
import { UtilService } from '@/services/util.service';

/** ~15 minutes of blocks between "your item sold" checks (see onBlockNumber$). */
const MISSED_EVENTS_EVERY_BLOCKS = 75;


@Injectable()
export class NotificationEffects {

  addressChanged$ = createEffect(() => this.actions$.pipe(
    ofType(setWalletAddress),
    map((action) => {
      const address = action.walletAddress?.toLowerCase();
      const stored = localStorage.getItem(`EtherPhunks_notifs__${environment.chainId}__${address}`);
      const notifications = JSON.parse(stored || '[]')
      return setNotifications({ notifications });
    })
  ));

  onRemoveNotification$ = createEffect(() => this.actions$.pipe(
    ofType(removeNotification),
    withLatestFrom(
      this.store.select(selectNotifications),
      this.store.select(selectWalletAddress),
    ),
    tap(([_, notifications, address]) => {
      localStorage.setItem(
        `EtherPhunks_notifs__${environment.chainId}__${address}`,
        JSON.stringify(notifications.filter((txn: Notification) => txn.type === 'complete' || txn.type === 'event'))
      );
    }),
  ), { dispatch: false });

  onNotificationEvent$ = createEffect(() => this.actions$.pipe(
    ofType(upsertNotification),
    withLatestFrom(
      this.store.select(selectNotifications),
      this.store.select(selectWalletAddress),
    ),
    tap(([_, notifications, address]) => {
      localStorage.setItem(
        `EtherPhunks_notifs__${environment.chainId}__${address}`,
        JSON.stringify(notifications.filter((txn: Notification) => txn.type === 'complete' || txn.type === 'event'))
      );
    }),
    // holdings may have changed: the next menu open / page view refetches them
    tap(([action, _, address]) => {
      if (action.notification.type === 'complete' || action.notification.type === 'event') this.dataSvc.invalidateOwned(address);
    }),
    switchMap(([action]) => {
      // If the notification is a complete or error, remove it after 5 seconds
      if (action.notification.type === 'complete' || action.notification.type === 'error') {
        return of(action).pipe(
          delay(5000),
          withLatestFrom(this.store.select(selectNotifHoverState)),
          tap(([action, notifHoverState]) => {
            if (!notifHoverState[action.notification.id]) {
              this.store.dispatch(removeNotification({ txId: action.notification.id }));
            }
          })
        );
      }
      return EMPTY;
    })
  ), { dispatch: false });

  // "Your item sold" alerts only need to arrive eventually, so the events query runs at most once
  // every MISSED_EVENTS_EVERY_BLOCKS (~15 min) rather than on every block tick. The stored mark only
  // advances when the query has run, so the next one covers everything since — nothing is missed.
  onBlockNumber$ = createEffect(() => this.actions$.pipe(
    ofType(setCurrentBlock),
    withLatestFrom(this.store.select(selectWalletAddress)),
    switchMap(([action, address]) => {
      const key = `EtherPhunks_currentBlock_${environment.chainId}`;
      const currentBlock = action.currentBlock;
      const storedBlock = Number(localStorage.getItem(key)) || 0;
      const markChecked = () => localStorage.setItem(key, JSON.stringify(currentBlock));

      if (!address || !storedBlock) { markChecked(); return of([]); }
      if (currentBlock - storedBlock < MISSED_EVENTS_EVERY_BLOCKS) return of([]);

      return this.dataSvc.fetchMissedEvents(address, storedBlock).pipe(
        tap((events) => {
          for (const event of events) this.checkEventForPurchaseFromUser(event, address);
          markChecked();
        }),
        catchError(() => of([])),
      );
    }),
  ), { dispatch: false });

  constructor(
    private store: Store<GlobalState>,
    private actions$: Actions,
    private dataSvc: DataService,
    private web3Svc: Web3Service,
    private utilSvc: UtilService
  ) {}

  checkEventForPurchaseFromUser(event: Event, userAddress: string) {
    if (!userAddress) return;
    if (event.type === 'PhunkBought' && event.from.toLowerCase() === userAddress?.toLowerCase()) {
      // This phunk was bought FROM the active user.
      // We can notify them of this purchase
      this.store.dispatch(upsertNotification({
        notification: {
          id: this.utilSvc.createIdFromString('purchased' + event.hashId + event.txHash),
          timestamp: Date.now(),
          type: 'event',
          function: 'purchased',
          hashId: event.hashId!,
          tokenId: event.tokenId,
          hash: event.txHash,
          isNotification: true,
          detail: event,
          value: Number(this.web3Svc.weiToEth(event.value)),
        }
      }));
    }
  }
}
