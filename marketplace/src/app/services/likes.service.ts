import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from 'src/environments/environment';
import { supabase } from './supabase';

/**
 * Off-chain likes. Identity is a per-device id in localStorage (no wallet).
 * Writes go through the indexer (service_role) so the `likes` table stays
 * anon-read-only; reads (count / leaderboard / "did I like it") are direct
 * Supabase SELECTs (always-on, no indexer cold start).
 */
@Injectable({ providedIn: 'root' })
export class LikesService {

  private readonly idKey = 'dysto_like_id';

  constructor(private http: HttpClient) {}

  /** Stable per-device id; generated once and persisted in localStorage. */
  deviceId(): string {
    let id = '';
    try { id = localStorage.getItem(this.idKey) || ''; } catch {}
    if (!/^[a-z0-9]{8,64}$/i.test(id)) {
      id = (typeof crypto !== 'undefined' && (crypto as any).randomUUID)
        ? (crypto as any).randomUUID().replace(/-/g, '')
        : (Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(0, 32);
      try { localStorage.setItem(this.idKey, id); } catch {}
    }
    return id;
  }

  /** Toggle this device's like for an item; returns new state + total count. */
  async toggle(hashId: string): Promise<{ liked: boolean; count: number }> {
    return await firstValueFrom(
      this.http.post<{ liked: boolean; count: number }>(
        `${environment.relayUrl}/likes/toggle`,
        { hashId, likeId: this.deviceId() },
      ),
    );
  }

  /** Total likes for an item (direct Supabase). */
  async count(hashId: string): Promise<number> {
    const { count } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('hashId', hashId);
    return count ?? 0;
  }

  /** Whether THIS device already liked the item (direct Supabase). */
  async likedByMe(hashId: string): Promise<boolean> {
    const { data } = await supabase
      .from('likes')
      .select('id')
      .eq('hashId', hashId)
      .eq('likeId', this.deviceId())
      .maybeSingle();
    return !!data;
  }

  /** Top-liked hashIds + counts for the Most Likes leaderboard (direct Supabase RPC). */
  async mostLoved(limit = 25): Promise<{ hashId: string; likes: number }[]> {
    const { data } = await supabase.rpc('fetch_most_loved', { p_limit: limit });
    return (data as any[])?.map((r) => ({ hashId: r.hashId, likes: Number(r.likes) })) ?? [];
  }

  /**
   * Top-liked items enriched with image + name, ranked. Joins the likes RPC
   * against the ethscriptions table so the menu button + leaderboard can show
   * the actual phunk/rock image and id.
   */
  async topLiked(limit = 25): Promise<TopLikedItem[]> {
    const ranked = await this.mostLoved(limit);
    if (!ranked.length) return [];
    const hashIds = ranked.map((r) => r.hashId);

    const { data } = await supabase
      .from('ethscriptions')
      .select('hashId,sha,tokenId,slug')
      .in('hashId', hashIds);
    const byHash = new Map((data as any[] ?? []).map((d) => [d.hashId, d]));

    // collection singleName for the display name (e.g. "QuantumPhunk 5984")
    const slugs = [...new Set((data as any[] ?? []).map((d) => d.slug).filter(Boolean))] as string[];
    const nameBySlug = new Map<string, string>();
    if (slugs.length) {
      const { data: cols } = await supabase.from('collections').select('slug,singleName').in('slug', slugs);
      (cols as any[] ?? []).forEach((c) => nameBySlug.set(c.slug, c.singleName));
    }

    return ranked.map((r) => {
      const e = byHash.get(r.hashId);
      const tokenId = e?.tokenId ?? null;
      const slug = e?.slug ?? '';
      const displayId =
        tokenId == null ? '' : slug === 'ethsrocks' ? '-' + Math.abs(tokenId) : String(Math.abs(tokenId));
      const single = nameBySlug.get(slug);
      const name = single ? `${single} ${displayId}`.trim() : displayId ? `#${displayId}` : r.hashId.slice(0, 10);
      return {
        hashId: r.hashId,
        likes: r.likes,
        sha: e?.sha ?? '',
        tokenId,
        slug,
        displayId,
        name,
        image: e?.sha ? `${environment.staticUrl}/static/images/${e.sha}` : '',
      };
    });
  }
}

export interface TopLikedItem {
  hashId: string;
  likes: number;
  sha: string;
  tokenId: number | null;
  slug: string;
  displayId: string;
  name: string;
  image: string;
}
