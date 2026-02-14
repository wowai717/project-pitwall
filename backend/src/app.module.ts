import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Driver } from './entities/driver.entity';
import { Constructor } from './entities/constructor.entity';
import { Race } from './entities/race.entity';
import { Result } from './entities/result.entity';
import { F1Module } from './f1/f1.module'; 

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [Driver, Constructor, Race, Result],
      synchronize: true,
    }),
    
    F1Module, 
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}