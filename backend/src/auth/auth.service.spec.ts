import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { User } from '../entities/user.entity';

test('registration and login reject passwords beyond the bcrypt byte limit', async () => {
  const service = new AuthService({} as Repository<User>, {} as JwtService);
  for (const password of ['a'.repeat(73), '가'.repeat(25)]) {
    await expect(service.register('testuser', password)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.login('testuser', password)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  }
});
