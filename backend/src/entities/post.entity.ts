import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';
import { Comment } from './comment.entity';

@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text') // 긴 내용을 담기 위해 text 타입 사용
  content: string;

  @CreateDateColumn()
  createdAt: Date;

  // 여러 개의 게시글은 1명의 작성자(User)를 가집니다 (N:1)
  @ManyToOne(() => User, (user) => user.posts)
  author: User;

  // 1개의 게시글 안에는 여러 개의 댓글(Comments)이 달릴 수 있습니다 (1:N)
  @OneToMany(() => Comment, (comment) => comment.post)
  comments: Comment[];
}