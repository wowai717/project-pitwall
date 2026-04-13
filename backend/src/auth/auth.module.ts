import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { User } from '../entities/user.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]), // User DB 사용 권한 부여
    JwtModule.register({
      global: true,
      secret: 'F1_PITWALL_SUPER_SECRET_KEY_2025', // 🚨 실무에서는 꼭 .env에 숨겨야 합니다!
      signOptions: { expiresIn: '1d' }, // 토큰 유효기간: 하루(1 day)
    }),
  ],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}