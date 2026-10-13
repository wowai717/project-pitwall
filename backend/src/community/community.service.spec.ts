import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CommunityService } from './community.service';
import { User } from '../entities/user.entity';
import { Post } from '../entities/post.entity';
import { Comment } from '../entities/comment.entity';

test('community rejects empty or oversized bodies before saving', async () => {
  const save = jest.fn();
  const service = new CommunityService(
    { create: jest.fn(), save } as unknown as Repository<Post>,
    {} as Repository<Comment>,
    {
      existsBy: jest.fn().mockResolvedValue(true),
    } as unknown as Repository<User>,
  );
  await expect(
    service.createPost(' ', 'content', 'user'),
  ).rejects.toBeInstanceOf(BadRequestException);
  await expect(
    service.createPost('title', 'a'.repeat(10001), 'user'),
  ).rejects.toBeInstanceOf(BadRequestException);
  expect(save).not.toHaveBeenCalled();
});
