import { Injectable } from '@angular/core';
import { createInstance } from 'localforage';

import { environment } from '@/../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class StorageService {

  /**
   * A browser cache only: losing it costs one refetch, so it must never block or break a page.
   *
   * The database used to be versioned by the app version (`ethereum-phunks`, version 6832…).
   * Every release then asked IndexedDB for an upgrade, and on phones where another tab or the
   * service worker still held the old version open, the upgrade blocked and every read hung
   * forever: the collection page never got its traits (no band, no counts, "0 of the 67") and
   * the grid below never rendered. Keys already carry the app version, so the database itself
   * stays at one fixed version under a new name, and every call is bounded by a timeout.
   */
  private storage: LocalForage = createInstance({ name: 'qp-cache', version: 1 });

  constructor() {
    // drop the old per-release database; best effort, nothing waits on it
    try { globalThis.indexedDB?.deleteDatabase('ethereum-phunks'); } catch {}
  }

  private bounded<T>(work: Promise<T>, fallback: T, ms = 2000): Promise<T> {
    return Promise.race([
      work.catch(() => fallback),
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
    ]);
  }

  async getItem<T>(key: string): Promise<T | null> {
    return this.bounded(this.storage.getItem<T>(`${key}:${environment.version}`), null);
  }

  async setItem<T>(key: string, value: T): Promise<T> {
    // a full or blocked store must not lose the data we already have in hand
    return this.bounded(this.storage.setItem(`${key}:${environment.version}`, value), value);
  }

  async removeItem(key: string): Promise<void> {
    return await this.storage.removeItem(`${key}:${environment.version}`);
  }

  async clear(): Promise<void> {
    return await this.storage.clear();
  }
}
