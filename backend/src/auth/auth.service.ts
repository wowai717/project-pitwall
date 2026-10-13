import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  // 📝 1. 회원가입 로직
  async register(username: unknown, password: unknown) {
    const normalizedUsername = this.validateRegistration(username, password);
    const existingUser = await this.userRepository.findOne({
      where: { username: normalizedUsername },
    });
    if (existingUser) {
      throw new ConflictException('이미 존재하는 닉네임입니다.');
    }

    const hashedPassword = await bcrypt.hash(password as string, 12);

    const user = this.userRepository.create({
      username: normalizedUsername,
      passwordHash: hashedPassword,
    });

    try {
      await this.userRepository.save(user);
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ER_DUP_ENTRY'
      ) {
        throw new ConflictException('이미 존재하는 닉네임입니다.');
      }
      throw error;
    }
    return { message: '회원가입이 완료되었습니다.' };
  }

  // 🔑 2. 로그인 로직
  async login(username: unknown, password: unknown) {
    if (
      typeof username !== 'string' ||
      typeof password !== 'string' ||
      Buffer.byteLength(password, 'utf8') > 72
    ) {
      throw new UnauthorizedException(
        '아이디 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.username = :username', { username: username.trim() })
      .getOne();

    if (!user) {
      throw new UnauthorizedException(
        '아이디 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException(
        '아이디 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    // JWT 토큰 생성 (페이로드에 유저 ID와 닉네임 담기)
    const payload = { sub: user.id, username: user.username };
    return {
      accessToken: this.jwtService.sign(payload),
      username: user.username,
    };
  }

  private validateRegistration(username: unknown, password: unknown): string {
    if (
      typeof username !== 'string' ||
      !/^[a-zA-Z0-9_]{3,32}$/.test(username.trim())
    ) {
      throw new BadRequestException(
        '아이디는 영문, 숫자, 밑줄만 사용해 3~32자로 입력해주세요.',
      );
    }

    if (
      typeof password !== 'string' ||
      password.length < 12 ||
      Buffer.byteLength(password, 'utf8') > 72
    ) {
      throw new BadRequestException(
        '비밀번호는 12자 이상, UTF-8 기준 72바이트 이하로 입력해주세요.',
      );
    }

    return username.trim();
  }
}
