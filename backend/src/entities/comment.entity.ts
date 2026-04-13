import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';
import { Post } from './post.entity';

@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  content: string;

  @CreateDateColumn()
  createdAt: Date;

  // 여러 개의 댓글은 1명의 작성자(User)가 씁니다 (N:1)
  @ManyToOne(() => User, (user) => user.comments)
  author: User;

  // 여러 개의 댓글은 1개의 게시글(Post)에 속합니다 (N:1)
  @ManyToOne(() => Post, (post) => post.comments)
  post: Post;
}