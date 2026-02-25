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

    // MetaMask: isMetaMask but NOT Phantom/Rainbow (which also set isMetaMask)
    const hasMetaMask = (eth?.isMetaMask && !eth?.isPhantom && !eth?.isRainbow)
      || eth?.providers?.some((p: any) => p.isMetaMask && !p.isPhantom && !p.isRainbow);
    opts.push({ id: 'injected-metamask', name: 'MetaMask', detected: !!hasMetaMask });

    // Rainbow
    const hasRainbow = eth?.isRainbow || eth?.providers?.some((p: any) => p.isRainbow);
    opts.push({ id: 'injected-rainbow', name: 'Rainbow', detected: !!hasRainbow });

    // Phantom
    if (phantom || eth?.isPhantom) {
      opts.push({ id: 'injected-phantom', name: 'Phantom', detected: true });
    }

    // Magic Eden
    const magicEden = typeof window !== 'undefined' ? (window as any).magicEden?.ethereum : null;
    const hasMagicEden = !!magicEden || eth?.isMagicEden
      || eth?.providers?.some((p: any) => p.isMagicEden);
    opts.push({ id: 'injected-magiceden', name: 'Magic Eden', detected: !!hasMagicEden });

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
