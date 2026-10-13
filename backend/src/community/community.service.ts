import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {}

  // 📝 게시글 작성
  async createPost(title: unknown, content: unknown, userId: string) {
    await this.requireUser(userId);
    const post = this.postRepository.create({
      title: this.text(title, 200),
      content: this.text(content, 10000),
      author: { id: userId },
    });
    return this.postRepository.save(post);
  }

  // 📜 전체 게시글 목록 조회
  async findAllPosts(page = 1) {
    const [items, total] = await this.postRepository.findAndCount({
      relations: ['author'],
      order: { createdAt: 'DESC' },
      take: 20,
      skip: (page - 1) * 20,
    });
    return { items, total, page };
  }

  // 💬 댓글 작성
  async createComment(content: unknown, postId: string, userId: string) {
    await this.requireUser(userId);
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다.');

    const comment = this.commentRepository.create({
      content: this.text(content, 2000),
      post,
      author: { id: userId },
    });
    return this.commentRepository.save(comment);
  }

  async findComments(postId: string, page = 1) {
    if (!(await this.postRepository.existsBy({ id: postId })))
      throw new NotFoundException('게시글을 찾을 수 없습니다.');
    const [items, total] = await this.commentRepository.findAndCount({
      where: { post: { id: postId } },
      relations: ['author'],
      order: { createdAt: 'ASC' },
      take: 20,
      skip: (page - 1) * 20,
    });
    return { items, total, page };
  }

  private text(value: unknown, max: number) {
    if (
      typeof value !== 'string' ||
      !value.trim() ||
      value.trim().length > max
    ) {
      throw new BadRequestException(`내용을 1~${max}자로 입력해주세요.`);
    }
    return value.trim();
  }

  private async requireUser(id: string) {
    if (!(await this.userRepository.existsBy({ id })))
      throw new NotFoundException('존재하지 않는 사용자입니다.');
  }
}
