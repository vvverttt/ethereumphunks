import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

interface WalletOption {
  id: string;
  name: string;
  detected: boolean;
}

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-connect-dialog',
  templateUrl: './connect-dialog.component.html',
  styleUrls: ['./connect-dialog.component.scss'],
})
export class ConnectDialogComponent {
  @Input() open = false;
  @Output() selected = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();

  get wallets(): WalletOption[] {
    const opts: WalletOption[] = [];
    const eth = typeof window !== 'undefined' ? (window as any).ethereum : null;
    const phantom = typeof window !== 'undefined' ? (window as any).phantom?.ethereum : null;

    // Check for Rainbow specifically — don't use isMetaMask (Phantom sets it too)
    const hasRainbow = eth?.isRainbow || eth?.providers?.some((p: any) => p.isRainbow);
    if (hasRainbow) {
      opts.push({ id: 'injected-rainbow', name: 'Rainbow', detected: true });
    } else {
      opts.push({ id: 'injected-rainbow', name: 'Rainbow', detected: false });
    }
    if (phantom || eth?.isPhantom) {
      opts.push({ id: 'injected-phantom', name: 'Phantom', detected: true });
    }
    if (eth?.isCoinbaseWallet) {
      opts.push({ id: 'coinbaseWallet', name: 'Coinbase Wallet', detected: true });
    } else {
      opts.push({ id: 'coinbaseWallet', name: 'Coinbase Wallet', detected: false });
    }
    opts.push({ id: 'walletConnect', name: 'WalletConnect', detected: false });

    return opts;
  }

  selectWallet(id: string): void {
    this.selected.emit(id);
  }

  onBackdropClick(): void {
    this.closed.emit();
  }

  onDialogClick(event: Event): void {
    event.stopPropagation();
  }
}
