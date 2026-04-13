import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn } from 'typeorm';
import { Post } from './post.entity';
import { Comment } from './comment.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') // 고유한 문자열 ID (UUID) 자동 생성
  id: string;

  @Column({ unique: true }) // 닉네임은 중복 금지!
  username: string;

  @Column()
  passwordHash: string; // 나중에 암호화된 비밀번호가 들어갈 자리

  @CreateDateColumn()
  createdAt: Date;

  // 1명의 유저는 여러 개의 글(Posts)과 여러 개의 댓글(Comments)을 쓸 수 있습니다 (1:N)
  @OneToMany(() => Post, (post) => post.author)
  posts: Post[];

  @OneToMany(() => Comment, (comment) => comment.author)
  comments: Comment[];
}