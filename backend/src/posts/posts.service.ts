import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from '../entities/post.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post) private postRepository: Repository<Post>,
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {}

  async create(title: string, content: string, userId: string) {
    const author = await this.userRepository.findOneBy({ id: userId });
    
    // 🛡️ [추가된 방어막] 유저가 null일 경우 에러를 던져서 TypeORM을 안심시킵니다.
    if (!author) {
      throw new NotFoundException('존재하지 않는 유저입니다.');
    }

    const post = this.postRepository.create({ title, content, author });
    return this.postRepository.save(post);
  }

  async findAll() {
    return this.postRepository.find({
      relations: ['author'], // 작성자 정보 포함
      order: { createdAt: 'DESC' }, // 최신글 우선
    });
  }

  async findOne(id: string) {
    const post = await this.postRepository.findOne({
      where: { id },
      relations: ['author', 'comments', 'comments.author'], // 댓글과 댓글 작성자까지 싹 가져옴
    });
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다.');
    return post;
  }
}