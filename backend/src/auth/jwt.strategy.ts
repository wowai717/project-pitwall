import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // 헤더에서 토큰 추출
      ignoreExpiration: false, // 만료된 토큰은 거절
      secretOrKey: 'F1_PITWALL_SUPER_SECRET_KEY_2025', // 아까 설정한 비밀키와 동일해야 함
    });
  }

  async validate(payload: any) {
    // 토큰이 유효하면 이 리턴값이 Request 객체의 user 필드에 들어갑니다.
    return { userId: payload.sub, username: payload.username };
  }
}