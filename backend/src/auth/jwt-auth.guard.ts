import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.split(' ')[1]; // Bearer <token>

    if (!token) throw new UnauthorizedException('로그인이 필요합니다.');

    try {
      const payload = await this.jwtService.verifyAsync(token);
      request.user = payload; // 토큰에 담긴 유저 정보를 요청 객체에 저장
      return true;
    } catch {
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }
  }
}