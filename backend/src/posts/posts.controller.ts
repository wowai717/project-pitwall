import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { PostsService } from './posts.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  findAll() {
    return this.postsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.postsService.findOne(id);
  }

  @UseGuards(AuthGuard('jwt')) // 🔒 로그인한 사람만 글쓰기 가능!
  @Post()
  create(@Body() body: any, @Request() req: any) {
    // req.user는 JwtStrategy의 validate에서 리턴한 데이터입니다.
    return this.postsService.create(body.title, body.content, req.user.userId);
  }
}