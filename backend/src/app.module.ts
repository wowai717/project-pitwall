import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Driver } from './entities/driver.entity';
import { Constructor } from './entities/constructor.entity';
import { Race } from './entities/race.entity';
import { Result } from './entities/result.entity';
import { F1Module } from './f1/f1.module'; 
import { User } from './entities/user.entity';
import { Post } from './entities/post.entity';
import { Comment } from './entities/comment.entity';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DB_HOST: Joi.string().default('mysql'),
        DB_PORT: Joi.number().default(3306),
        DB_USERNAME: Joi.string().required(),
        DB_PASSWORD: Joi.string().required(),
        DB_NAME: Joi.string().required(),
        REDIS_HOST: Joi.string().default('redis'),
        REDIS_PORT: Joi.number().default(6379),
      }),
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: await redisStore({
          socket: {
            host: process.env.REDIS_HOST || 'redis',
            port: Number(process.env.REDIS_PORT) || 6379,
          },
        }),
        ttl: 60 * 60 * 1000, 
      }),
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'mysql',
      port: Number(process.env.DB_PORT) || 3306,
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || 'root',
      database: process.env.DB_NAME || 'pitstop_db',
      entities: [Driver, Constructor, Race, Result, User, Post, Comment],
      synchronize: true,
    }),
    
    F1Module, 
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}