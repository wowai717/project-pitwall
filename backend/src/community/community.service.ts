import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from '../entities/post.entity';
import { Comment } from '../entities/comment.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class CommunityService {
  constructor(
    @InjectRepository(Post) private postRepository: Repository<Post>,
    @InjectRepository(Comment) private commentRepository: Repository<Comment>,
  ) {}

  // 📝 게시글 작성
  async createPost(title: string, content: string, userId: string) {
    const post = this.postRepository.create({ title, content, author: { id: userId } });
    return this.postRepository.save(post);
  }

  // 📜 전체 게시글 목록 조회
  async findAllPosts() {
    return this.postRepository.find({
      relations: ['author', 'comments'], // 작성자와 댓글 개수 포함
      order: { createdAt: 'DESC' },
    });
  }

  // 💬 댓글 작성
  async createComment(content: string, postId: string, userId: string) {
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다.');

    const comment = this.commentRepository.create({
      content,
      post,
      author: { id: userId },
    });
    return this.commentRepository.save(comment);
  }
}