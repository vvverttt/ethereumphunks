import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { environment } from 'src/environments/environment';
import { LotteryService } from '@/services/lottery.service';
import { LotteryWin } from '@/models/lottery';

@Component({
  selector: 'app-lottery-wins',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './lottery-wins.component.html',
  styleUrls: ['./lottery-wins.component.scss']
})
export class LotteryWinsComponent implements OnInit {

  wins = signal<LotteryWin[]>([]);
  staticUrl = environment.staticUrl;

  constructor(private lotterySvc: LotteryService) {}

  async ngOnInit() {
    this.lotterySvc.fetchRecentWins().subscribe(wins => {
      this.wins.set(wins);
    });
  }

  getWinImageUrl(win: LotteryWin): string {
    if (win.sha) {
      return `${this.staticUrl}/static/images/${win.sha}`;
    }
    return '/assets/images/lottery/philip.png';
  }
}
