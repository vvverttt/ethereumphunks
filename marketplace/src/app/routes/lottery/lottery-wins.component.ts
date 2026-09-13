import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

import { LazyLoadImageModule } from 'ng-lazyload-image';

import { environment } from 'src/environments/environment';
import { LotteryService } from '@/services/lottery.service';
import { LotteryWin } from '@/models/lottery';
import { PhunkImageComponent } from '@/components/phunk-image/phunk-image.component';

@Component({
  selector: 'app-lottery-wins',
  standalone: true,
  imports: [CommonModule, RouterModule, LazyLoadImageModule, PhunkImageComponent],
  templateUrl: './lottery-wins.component.html',
  styleUrls: ['./lottery-wins.component.scss']
})
export class LotteryWinsComponent implements OnInit, OnDestroy {

  wins = signal<LotteryWin[]>([]);
  loaded = signal(false);
  staticUrl = environment.staticUrl;

  private sub!: Subscription;

  constructor(private lotterySvc: LotteryService) {}

  ngOnInit() {
    this.sub = this.lotterySvc.fetchAllWins().subscribe(wins => {
      this.wins.set(wins);
      this.loaded.set(true);
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  // Tiles render through app-phunk-image, which resolves the sha against the
  // sprite sheets; the template keeps the philip.png fallback for wins with no sha.
}
