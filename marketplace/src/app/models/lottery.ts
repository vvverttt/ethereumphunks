export interface LotteryGridItem {
  index: number;
  hashId: string;
  sha: string;
  imageUrl: string;
  flipping: boolean;
  revealed: boolean;
  rightFacing: boolean;
}

export interface LotteryWin {
  id: number;
  play_id: number;
  winner: string;
  hash_id: string;
  sha: string;
  token_id: number;
  collection_slug: string;
  transfer_status: string;
  tx_hash: string;
  created_at: string;
}

export type SpinPhase = 'idle' | 'loading' | 'spinning' | 'decelerating' | 'won';
