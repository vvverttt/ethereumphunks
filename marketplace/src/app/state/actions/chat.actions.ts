import { ChatState } from '@/models/global-state';
import { createAction, props } from '@ngrx/store';
// conversation objects came from the old XMTP V2 SDK (removed); the chat panel is off
type Conversation = unknown;

export const setChat = createAction(
  '[Chat] Set Chat Active',
  props<{ active: boolean, toAddress?: ChatState['toAddress'] }>()
);

export const setChatConnected = createAction(
  '[Chat] Set Chat Connected',
  props<{ connected: boolean }>()
);

export const setConversations = createAction(
  '[Chat] Set Conversations',
  props<{ conversations: Conversation[] }>()
);

export const setActiveConversation = createAction(
  '[Chat] Set Active Conversation',
  props<{ activeConversation: Conversation }>()
);
