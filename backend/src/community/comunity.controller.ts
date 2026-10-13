import {
  BadRequestException,
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CommunityService } from './community.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';

@Controller('community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Get('posts')
  async getAllPosts(@Query('page') page?: string) {
    return this.communityService.findAllPosts(this.page(page));
  }

  @UseGuards(JwtAuthGuard) // 🛡️ 로그인한 사람만 글쓰기 가능!
  @Post('posts')
  async createPost(
    @Body() body: { title?: unknown; content?: unknown },
    @Request() req: AuthenticatedRequest,
  ) {
    return this.communityService.createPost(
      body.title,
      body.content,
      req.user.sub,
    );
  }

  @UseGuards(JwtAuthGuard) // 🛡️ 로그인한 사람만 댓글 쓰기 가능!
  @Post('posts/:id/comments')
  async createComment(
    @Param('id', ParseUUIDPipe) postId: string,
    @Body() body: { content?: unknown },
    @Request() req: AuthenticatedRequest,
  ) {
    return this.communityService.createComment(
      body.content,
      postId,
      req.user.sub,
    );
  }

  @Get('posts/:id/comments')
  getComments(
    @Param('id', ParseUUIDPipe) postId: string,
    @Query('page') page?: string,
  ) {
    return this.communityService.findComments(postId, this.page(page));
  }

  private page(value = '1') {
    if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 10000)
      throw new BadRequestException('올바른 페이지 번호가 필요합니다.');
    return Number(value);
  }
}
