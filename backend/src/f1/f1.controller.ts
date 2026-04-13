import { Controller, Get, Param, Query } from '@nestjs/common';
import { F1Service } from './f1.service';

@Controller('f1')
export class F1Controller {
  constructor(private readonly f1Service: F1Service) {}

  @Get('seed/drivers')
  async seedDrivers() {
    return this.f1Service.seedDrivers();
  }

  @Get('seed/constructors')
  async seedConstructors() {
    return await this.f1Service.seedConstructors();
  }

  @Get('seed/races')
  async seedRaces() {
    return this.f1Service.seedRaces();
  }

  @Get('seed/results')
  async seedResults() {
    return this.f1Service.seedResults();
  }

  @Get('standings')
  async getStandings(@Query('year') year?: string) {
    const targetYear = Number(year) || 2023;
    return this.f1Service.getDriverStandings(targetYear);
  }

  @Get('seed/all')
  async seedAll() {
    return this.f1Service.seedAll();
  }

  @Get('constructors')
  async getConstructors(@Query('year') year?: string) {
    const targetYear = year ? parseInt(year, 10) : 2023;
    return this.f1Service.getConstructorStandings(targetYear);
  }

  @Get('drivers/:driverId/results')
  async getDriverResults(@Param('driverId') driverId: string, @Query('year') year?: string) {
    const targetYear = year ? parseInt(year, 10) : 2023;
    return this.f1Service.getDriverResults(targetYear, driverId);
  }

  @Get('results')
  async getResults(@Query('year') year: string, @Query('driverId') driverId: string) {
    return this.f1Service.getDriverResults(parseInt(year, 10), driverId);
  }
}