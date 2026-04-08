import { Module } from '@nestjs/common';
import { F1Service } from './f1.service';
import { F1Controller } from './f1.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Driver } from '../entities/driver.entity';
import { HttpModule } from '@nestjs/axios';
import { Constructor } from '../entities/constructor.entity';
import { Race } from '../entities/race.entity';
import { Result } from '../entities/result.entity';


@Module({
  imports: [
    TypeOrmModule.forFeature([Driver, Constructor, Race, Result]),
    HttpModule,
  ],
  providers: [F1Service],
  controllers: [F1Controller]
})
export class F1Module {}
