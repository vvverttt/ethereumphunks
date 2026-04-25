import { Component, effect, input, OnDestroy, signal, untracked } from '@angular/core';
import { AsyncPipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { Subscription } from 'rxjs';

import { Store } from '@ngrx/store';
import { GlobalState } from '@/models/global-state';
import * as appStateSelectors from '@/state/selectors/app-state.selectors';

import { GasService } from '@/services/gas.service';
import { setChat } from '@/state/actions/chat.actions';
import { LogItem, SocketService } from '@/services/socket.service';

import { LoggerComponent } from '@/components/status-bar/logger/logger.component';
import { combineLatest } from 'rxjs';

import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-status-bar',
  standalone: true,
  imports: [
    AsyncPipe,
    DecimalPipe,
    NgTemplateOutlet,

    LoggerComponent
  ],
  templateUrl: './status-bar.component.html',
  styleUrl: './status-bar.component.scss',
})
export class StatusBarComponent implements OnDestroy {

  visible = input.required<boolean>();

  blocks$ = combineLatest([
    this.store.select(appStateSelectors.selectCurrentBlock),
    this.store.select(appStateSelectors.selectIndexerBlock),
  ]);

  logItems = signal<LogItem[]>([]);
  loadingLogs = signal(false);
  loadingCountdown = signal<number | null>(null);
  waitingForLogs = signal(false);

  chain = environment.chainId;

  levels: any = {};

  expanded = signal(false);
  private logsConnected = false;
  private initialLogsSub?: Subscription;
  private liveLogsSub?: Subscription;
  private loadingCountdownTimer: ReturnType<typeof setInterval> | null = null;
  private loadingFallbackTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private store: Store<GlobalState>,
    public gasSvc: GasService,
    private socketSvc: SocketService
  ) {
    effect(() => {
      const visible = this.visible();
      if (!visible && this.expanded()) {
        untracked(() => this.expanded.set(false));
      }
    });

    effect(() => {
      if (this.expanded()) {
        this.connectLogs();
        return;
      }

      this.disconnectLogs();
    });
  }

  getIndexerClass(diff: number, indexerBlock: number): string {
    return '';
  }

  expandCollapse() {
    this.expanded.update(expanded => !expanded);
  }

  openChat() {
    this.store.dispatch(setChat({ active: true }));
  }

  ngOnDestroy(): void {
    this.disconnectLogs();
  }

  private connectLogs(): void {
    if (this.logsConnected) return;

    this.logsConnected = true;
    this.loadingLogs.set(true);
    this.waitingForLogs.set(false);
    this.startLoadingCountdown();

    this.initialLogsSub = this.socketSvc.logs$.subscribe((logs: LogItem[]) => {
      this.logItems.set(logs || []);
      this.finishLoading();
      if (!(logs || []).length) {
        this.waitingForLogs.set(true);
      }
    });

    this.liveLogsSub = this.socketSvc.log$.subscribe((log: LogItem) => {
      this.logItems.update((logs) => [...logs, log]);
      this.finishLoading();
      this.waitingForLogs.set(false);
    });

    this.socketSvc.connectLogs();

    this.loadingFallbackTimer = setTimeout(() => {
      if (!this.loadingLogs()) return;
      this.finishLoading();
      this.waitingForLogs.set(this.logItems().length === 0);
    }, 4000);
  }

  private disconnectLogs(): void {
    this.initialLogsSub?.unsubscribe();
    this.initialLogsSub = undefined;
    this.liveLogsSub?.unsubscribe();
    this.liveLogsSub = undefined;
    this.clearLoadingTimers();
    this.loadingLogs.set(false);
    this.loadingCountdown.set(null);
    this.waitingForLogs.set(false);
    if (!this.logsConnected) return;
    this.socketSvc.disconnectLogs();
    this.logsConnected = false;
  }

  private startLoadingCountdown(): void {
    this.clearLoadingTimers();
    this.loadingCountdown.set(3);
    this.loadingCountdownTimer = setInterval(() => {
      const current = this.loadingCountdown();
      if (current === null) return;
      this.loadingCountdown.set(Math.max(0, current - 1));
    }, 1000);
  }

  private finishLoading(): void {
    this.loadingLogs.set(false);
    this.loadingCountdown.set(null);
    this.clearLoadingTimers();
  }

  private clearLoadingTimers(): void {
    if (this.loadingCountdownTimer) {
      clearInterval(this.loadingCountdownTimer);
      this.loadingCountdownTimer = null;
    }
    if (this.loadingFallbackTimer) {
      clearTimeout(this.loadingFallbackTimer);
      this.loadingFallbackTimer = null;
    }
  }
}
