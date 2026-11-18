import { Component, inject, input, effect, model, ChangeDetectionStrategy } from '@angular/core';

import { LazyLoadImageModule } from 'ng-lazyload-image';

import { Web3Service } from '@/services/web3.service';
import { DataService } from '@/services/data.service';
import { SpriteService } from '@/services/sprite.service';

import { environment } from 'src/environments/environment';

@Component({
  standalone: true,
  imports: [
    LazyLoadImageModule
],
  selector: 'app-avatar',
  templateUrl: './avatar.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./avatar.component.scss']
})
export class AvatarComponent {

  private readonly spriteSvc = inject(SpriteService);

  address = input.required<string>();
  src = model<string>('');

  constructor(
    private web3Svc: Web3Service,
    private dataSvc: DataService
  ) {
    effect(async () => {
      let avatar = await this.web3Svc.getEnsAvatar(this.address());
      if (avatar) {
        this.src.set(avatar);
        return;
      }

      avatar = await this.dataSvc.getUserAvatar(this.address());
      if (avatar) {
        this.src.set(await this.spriteSvc.url(avatar));
        return;
      }
    })
  }

}
