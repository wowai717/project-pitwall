import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { F1Service } from './f1.service';

@Controller('f1')
export class F1Controller {
  constructor(private readonly f1Service: F1Service) {}

  private year(value = '2023') {
    if (!/^202[0-5]$/.test(value)) {
      throw new BadRequestException('지원 시즌은 2020~2025년입니다.');
    }
    return Number(value);
  }

  @Get('standings')
  async getStandings(@Query('year') year?: string) {
    const targetYear = this.year(year);
    return this.f1Service.getDriverStandings(targetYear);
  }

  @Get('constructors')
  async getConstructors(@Query('year') year?: string) {
    const targetYear = this.year(year);
    return this.f1Service.getConstructorStandings(targetYear);
  }

  @Get('drivers/:driverId/results')
  async getDriverResults(
    @Param('driverId') driverId: string,
    @Query('year') year?: string,
  ) {
    return this.getResults(year, driverId);
  }

  @Get('results')
  async getResults(
    @Query('year') year?: string,
    @Query('driverId') driverId?: string,
  ) {
    if (!driverId || !/^[a-z0-9_-]{1,64}$/.test(driverId)) {
      throw new BadRequestException('올바른 선수 ID가 필요합니다.');
    }
    return this.f1Service.getDriverResults(this.year(year), driverId);
  }
}
