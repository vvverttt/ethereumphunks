import { Injectable } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { interval } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PwaUpdateService {
  constructor(private swUpdate: SwUpdate) {
    if (swUpdate.isEnabled) {
      // Check immediately on load, then every 5 minutes
      swUpdate.checkForUpdate();
      interval(5 * 60 * 1000).subscribe(() => swUpdate.checkForUpdate());

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
