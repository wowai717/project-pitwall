import { Controller, Post, Get, Body, UseGuards, Request, Param } from '@nestjs/common';
import { CommunityService } from './community.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Get('posts')
  async getAllPosts() {
    return this.communityService.findAllPosts();
  }

  @UseGuards(JwtAuthGuard) // 🛡️ 로그인한 사람만 글쓰기 가능!
  @Post('posts')
  async createPost(@Body() body: { title: string; content: string }, @Request() req) {
    return this.communityService.createPost(body.title, body.content, req.user.sub);
  }

  @UseGuards(JwtAuthGuard) // 🛡️ 로그인한 사람만 댓글 쓰기 가능!
  @Post('posts/:id/comments')
  async createComment(@Param('id') postId: string, @Body() body: { content: string }, @Request() req) {
    return this.communityService.createComment(body.content, postId, req.user.sub);
  }
}