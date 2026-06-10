import { Injectable } from '@nestjs/common';

import { StorageService } from '@/modules/storage/storage.service';

/**
 * Likes are off-chain (Supabase). Writes go through here with the indexer's
 * service_role client so the `likes` table stays anon-read-only. Reads (count /
 * leaderboard) are done directly from Supabase by the frontend (anon SELECT).
 */
@Injectable()
export class LikesService {

  constructor(private readonly storage: StorageService) {}

  private get sb() { return this.storage.supabase; }

  /** Toggle a device's like for an item. Returns the new state + total count. */
  async toggle(hashId: string, likeId: string): Promise<{ liked: boolean; count: number }> {
    const existing = await this.sb
      .from('likes')
      .select('id')
      .eq('hashId', hashId)
      .eq('likeId', likeId)
      .maybeSingle();

    let liked: boolean;
    if (existing.data) {
      const { error } = await this.sb.from('likes').delete().eq('id', existing.data.id);
      if (error) throw error;
      liked = false;
    } else {
      const { error } = await this.sb.from('likes').insert({ hashId, likeId });
      // ignore unique-violation races (already liked) — treat as liked
      if (error && error.code !== '23505') throw error;
      liked = true;
    }

    const { count, error: cErr } = await this.sb
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('hashId', hashId);
    if (cErr) throw cErr;

    return { liked, count: count ?? 0 };
  }
}
