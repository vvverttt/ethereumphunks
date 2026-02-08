import { Component } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Store } from '@ngrx/store';

import { ChatService } from '@/services/chat.service';

import { GlobalState } from '@/models/global-state';
import { setChat, setChatConnected } from '@/state/actions/chat.actions';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {

  constructor(
    private store: Store<GlobalState>,
    private chatSvc: ChatService
  ) {}

  signing = false;

  async signIn(): Promise<void> {
    if (this.signing) return;
    this.signing = true;

    try {
      const signedIn = await this.chatSvc.signInToXmtp();
      console.log('XMTP signIn result:', signedIn);
      if (signedIn) {
        this.store.dispatch(setChatConnected({ connected: true }));
      }
    } catch (error) {
      console.error('Error signing in to XMTP', error);
    } finally {
      this.signing = false;
    }
  }

  closeChat(): void {
    this.store.dispatch(setChat({ active: false }));
  }
}
