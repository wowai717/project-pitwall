import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // 헤더에서 토큰 추출
      ignoreExpiration: false, // 만료된 토큰은 거절
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: number; username: string }) {
    // 토큰이 유효하면 이 리턴값이 Request 객체의 user 필드에 들어갑니다.
    return { userId: payload.sub, username: payload.username };
  }
}
