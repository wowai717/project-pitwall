import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';
import type { Request } from 'express';
import { createHash } from 'crypto';

@Injectable()
export class AuthRateLimitGuard implements CanActivate, OnModuleDestroy {
  private readonly store: ReturnType<typeof redisStore>;

  constructor(config: ConfigService) {
    this.store = redisStore({
      socket: {
        host: config.getOrThrow<string>('REDIS_HOST'),
        port: config.getOrThrow<number>('REDIS_PORT'),
      },
    });
  }

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const key = `auth-limit:${createHash('sha256')
      .update(request.ip ?? 'unknown')
      .digest('hex')}`;
    const { client } = await this.store;
    const [count] = await client.multi().incr(key).expire(key, 60, 'NX').exec();
    if (Number(count) > 20) {
      context
        .switchToHttp()
        .getResponse<{ setHeader: (name: string, value: string) => void }>()
        .setHeader('Retry-After', '60');
      throw new HttpException(
        '요청이 너무 많습니다. 1분 후 다시 시도해주세요.',
        429,
      );
    }
    return true;
  }

  async onModuleDestroy() {
    await (await this.store).client.quit();
  }
}
