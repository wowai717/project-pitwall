import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { User } from '../entities/user.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]), // User DB 사용 권한 부여
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  providers: [AuthService, AuthRateLimitGuard],
  controllers: [AuthController],
})
export class AuthModule {}
