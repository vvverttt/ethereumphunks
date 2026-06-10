import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { LikesService, TopLikedItem } from '@/services/likes.service';
import { FormatCashPipe } from '@/pipes/format-cash.pipe';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, FormatCashPipe],
  selector: 'app-most-likes',
  templateUrl: './most-likes.component.html',
  styleUrls: ['./most-likes.component.scss'],
})
export class MostLikesComponent {

  items = signal<TopLikedItem[]>([]);
  loading = signal(true);

  constructor(private likesSvc: LikesService) {
    this.load();
  }

  private async load(): Promise<void> {
    try {
      this.items.set(await this.likesSvc.topLiked(50));
    } catch {
    } finally {
      this.loading.set(false);
    }
  }
}
