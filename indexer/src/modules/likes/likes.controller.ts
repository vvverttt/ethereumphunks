import { Body, Controller, HttpException, HttpStatus, Post } from '@nestjs/common';

import { LikesService } from '@/modules/likes/likes.service';

// Public endpoint (NOT behind the admin key middleware, which only covers
// /admin, /ethscriptions, /notifications). Device-based likes.
@Controller('likes')
export class LikesController {

  constructor(private readonly likes: LikesService) {}

  @Post('toggle')
  async toggle(@Body() body: { hashId?: string; likeId?: string }): Promise<{ liked: boolean; count: number }> {
    const hashId = (body?.hashId || '').toLowerCase();
    const likeId = (body?.likeId || '').trim();

    if (!/^0x[0-9a-f]{64}$/.test(hashId)) {
      throw new HttpException('Invalid hashId', HttpStatus.BAD_REQUEST);
    }
    if (!/^[a-z0-9]{8,64}$/i.test(likeId)) {
      throw new HttpException('Invalid likeId', HttpStatus.BAD_REQUEST);
    }

    return this.likes.toggle(hashId, likeId);
  }
}
