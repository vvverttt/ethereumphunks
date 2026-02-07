import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

interface WalletOption {
  id: string;
  name: string;
  icon: string;
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

  get installedWallets(): WalletOption[] {
    const opts: WalletOption[] = [];
    const eth = typeof window !== 'undefined' ? (window as any).ethereum : null;
    const phantom = typeof window !== 'undefined' ? (window as any).phantom?.ethereum : null;

    if (eth?.isMetaMask) {
      opts.push({ id: 'injected-metamask', name: 'MetaMask', icon: 'metamask', detected: true });
    }
    if (phantom || eth?.isPhantom) {
      opts.push({ id: 'injected-phantom', name: 'Phantom', icon: 'phantom', detected: true });
    }
    if (eth?.isCoinbaseWallet) {
      opts.push({ id: 'coinbaseWallet', name: 'Coinbase Wallet', icon: 'coinbase', detected: true });
    }
    return opts;
  }

  get popularWallets(): WalletOption[] {
    const opts: WalletOption[] = [];
    const eth = typeof window !== 'undefined' ? (window as any).ethereum : null;

    if (!eth?.isCoinbaseWallet) {
      opts.push({ id: 'coinbaseWallet', name: 'Coinbase Wallet', icon: 'coinbase', detected: false });
    }
    opts.push({ id: 'walletConnect', name: 'WalletConnect', icon: 'walletconnect', detected: false });
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
