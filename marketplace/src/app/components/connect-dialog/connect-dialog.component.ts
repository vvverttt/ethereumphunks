import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Web3Service } from '@/services/web3.service';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';

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

  private web3 = inject(Web3Service);
  private preferences = inject(PhunkPreferencesService);

  t(key: string): string {
    return this.preferences.t(key);
  }

  get wallets(): WalletOption[] {
    const opts: WalletOption[] = [];
    const eth = typeof window !== 'undefined' ? (window as any).ethereum : null;
    const phantom = typeof window !== 'undefined' ? (window as any).phantom?.ethereum : null;

    // MetaMask — EIP-6963 first, then legacy flag detection
    const hasMetaMask = this.web3.hasEip6963Provider('io.metamask')
      || (eth?.isMetaMask && !eth?.isPhantom && !eth?.isRainbow)
      || eth?.providers?.some((p: any) => p.isMetaMask && !p.isPhantom && !p.isRainbow);
    opts.push({ id: 'injected-metamask', name: 'MetaMask', detected: !!hasMetaMask });

    // Rainbow
    const hasRainbow = this.web3.hasEip6963Provider('me.rainbow')
      || eth?.isRainbow || eth?.providers?.some((p: any) => p.isRainbow);
    opts.push({ id: 'injected-rainbow', name: 'Rainbow', detected: !!hasRainbow });

    // Phantom
    const hasPhantom = this.web3.hasEip6963Provider('app.phantom')
      || !!phantom || eth?.isPhantom;
    if (hasPhantom) {
      opts.push({ id: 'injected-phantom', name: 'Phantom', detected: true });
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
