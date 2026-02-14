import { Controller, Get, Post } from '@nestjs/common';
import { F1Service } from './f1.service';

@Controller('f1')
export class F1Controller {
  constructor(private readonly f1Service: F1Service) {}

  @Get('seed/drivers')
  async seedDrivers() {
    return await this.f1Service.seedDrivers();
  }

  @Get('drivers')
  async getDrivers() {
    return await this.f1Service.getAllDrivers();
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
  async getStandings() {
    return this.f1Service.getDriverStandings();
  }
}