import { Injectable } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { visibleInterval } from '@/utils/visible-interval';

@Injectable({
  providedIn: 'root'
})
export class PwaUpdateService {
  constructor(private swUpdate: SwUpdate) {
    if (swUpdate.isEnabled) {
      // Check immediately on load, then every 15 minutes while the tab is visible. A new version
      // reloads the tab (below), so a hidden tab that kept checking reloaded itself in the
      // background on every deploy and re-ran all its startup queries for nobody. A check that
      // came due while hidden now runs the moment the visitor comes back (and every page load
      // checks too).
      swUpdate.checkForUpdate();
      visibleInterval(() => swUpdate.checkForUpdate(), 15 * 60 * 1000);

      // Auto-activate new versions immediately
      swUpdate.versionUpdates.subscribe(event => {
        if (event.type === 'VERSION_READY') {
          window.location.reload();
        }
      });

      // Handle unrecoverable state
      swUpdate.unrecoverable.subscribe(event => {
        alert('An error occurred that we cannot recover from:\n' + event.reason +
              '\n\nPlease reload the page.');
      });
    }
  }

  public async checkForUpdate(): Promise<void> {
    if (!this.swUpdate.isEnabled) {
      return Promise.resolve();
    }
    await this.swUpdate.checkForUpdate();
  }
}
