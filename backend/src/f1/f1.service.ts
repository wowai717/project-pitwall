import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver } from '../entities/driver.entity';
import { Constructor } from '../entities/constructor.entity';
import { Race } from '../entities/race.entity';
import { Result } from '../entities/result.entity';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class F1Service {
  private readonly logger = new Logger(F1Service.name);
  private readonly TARGET_YEARS = [2020, 2021, 2022, 2023, 2024, 2025];
  private readonly PAGE_SIZE = 100;

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(Driver) private readonly driverRepository: Repository<Driver>,
    @InjectRepository(Constructor) private readonly constructorRepository: Repository<Constructor>,
    @InjectRepository(Race) private readonly raceRepository: Repository<Race>,
    @InjectRepository(Result) private readonly resultRepository: Repository<Result>,
  ) {}

  async seedAll() {
    try {
      await this.seedDrivers();
      await this.seedConstructors();
      await this.seedRaces();
      await this.seedResults();
      await this.seedSprintResults();
      return { message: '2020-2025 F1 data seeded successfully!' };
    } catch (error) {
      this.logger.error('통합 데이터 수집 중 에러 발생', error);
      throw error;
    }
  }

  async seedDrivers() {
    this.logger.log('드라이버 데이터 수집 중...');
    for (const year of this.TARGET_YEARS) {
      const url = `https://api.jolpi.ca/ergast/f1/${year}/drivers.json?limit=100`;
      const { data } = await firstValueFrom(this.httpService.get(url));
      const drivers = data?.MRData?.DriverTable?.Drivers || [];

      for (const d of drivers) {
        const exists = await this.driverRepository.findOne({ where: { driverId: d.driverId } });
        if (!exists) {
          await this.driverRepository.save({
            driverId: d.driverId,
            code: d.code || (d.givenName.substring(0, 1) + d.familyName.substring(0, 2)).toUpperCase(),
            permanentNumber: d.permanentNumber || '0',
            givenName: d.givenName,
            familyName: d.familyName,
            dateOfBirth: d.dateOfBirth || '1900-01-01',
            nationality: d.nationality || 'Unknown',
          });
        }
      }
    }
  }

  async seedConstructors() {
    this.logger.log('팀 데이터 수집 중...');
    for (const year of this.TARGET_YEARS) {
      const url = `https://api.jolpi.ca/ergast/f1/${year}/constructors.json?limit=100`;
      const { data } = await firstValueFrom(this.httpService.get(url));
      const constructors = data?.MRData?.ConstructorTable?.Constructors || [];

      for (const c of constructors) {
        const exists = await this.constructorRepository.findOne({ where: { constructorId: c.constructorId } });
        if (!exists) {
          await this.constructorRepository.save({
            constructorId: c.constructorId,
            name: c.name,
            nationality: c.nationality || 'Unknown',
            url: c.url,
            color: '#000000',
          });
        }
      }
    }
  }

  async seedRaces() {
    this.logger.log('경기 일정 수집 중...');
    for (const year of this.TARGET_YEARS) {
      const url = `https://api.jolpi.ca/ergast/f1/${year}.json`;
      const { data } = await firstValueFrom(this.httpService.get(url));
      const races = data?.MRData?.RaceTable?.Races || [];

      for (const r of races) {
        const raceId = `${r.season}-${r.round}`;
        const exists = await this.raceRepository.findOne({ where: { raceId } });

        if (!exists) {
          await this.raceRepository.save({
            raceId,
            season: Number(r.season),
            round: Number(r.round),
            raceName: r.raceName,
            date: `${r.date}T${r.time || '00:00:00Z'}`,
            circuitId: r.Circuit.circuitId,
          });
        }
      }
    }
  }

  async seedResults() {
    this.logger.log('레이스 결과 수집 중...');
    await this.seedResultSet('results', 'Results', false);
  }

  async seedSprintResults() {
    this.logger.log('스프린트 결과 수집 중...');
    await this.seedResultSet('sprint', 'SprintResults', true);
  }

  private async seedResultSet(
    endpoint: 'results' | 'sprint',
    resultKey: 'Results' | 'SprintResults',
    isSprint: boolean,
  ) {
    for (const year of this.TARGET_YEARS) {
      let offset = 0;
      let total = 0;

      do {
        const url = `https://api.jolpi.ca/ergast/f1/${year}/${endpoint}.json?limit=${this.PAGE_SIZE}&offset=${offset}`;
        const { data } = await firstValueFrom(this.httpService.get(url));
        const races = data?.MRData?.RaceTable?.Races || [];

        total = Number(data?.MRData?.total ?? 0);
        const pageSize = Number(data?.MRData?.limit ?? this.PAGE_SIZE);

        for (const raceData of races) {
          const race = await this.raceRepository.findOne({
            where: { season: Number(raceData.season), round: Number(raceData.round) },
          });
          if (!race) continue;

          for (const result of raceData[resultKey] || []) {
            const driver = await this.driverRepository.findOne({ where: { driverId: result.Driver.driverId } });
            const constructor = await this.constructorRepository.findOne({ where: { constructorId: result.Constructor.constructorId } });

            if (driver) {
              const exists = await this.resultRepository.findOne({
                where: {
                  race: { raceId: race.raceId },
                  driver: { driverId: driver.driverId },
                  isSprint,
                },
              });

              if (!exists) {
                const resultPayload: Partial<Result> = {
                  race,
                  driver,
                  position: Number(result.position),
                  points: Number(result.points),
                  grid: Number(result.grid),
                  laps: Number(result.laps),
                  status: result.status,
                  isSprint,
                };

                if (constructor) {
                  resultPayload.f1Constructor = constructor;
                }

                await this.resultRepository.save(resultPayload);
              }
            }
          }
        }

        offset += pageSize;
      } while (offset < total);
    }
  }

  async getDriverStandings(year: number = 2023) {
    const standings = await this.resultRepository
      .createQueryBuilder('result')
      .innerJoin('result.race', 'race')
      .innerJoin('result.driver', 'driver')
      .select([
        'driver.givenName AS firstName',
        'driver.familyName AS lastName',
        'driver.code AS code',
        'driver.nationality AS nationality',
      ])
      .addSelect('SUM(result.points)', 'totalPoints')
      .where('race.season = :year', { year })
      .groupBy('driver.driverId, driver.givenName, driver.familyName, driver.code, driver.nationality')
      .orderBy('totalPoints', 'DESC')
      .getRawMany();

    return standings.map((standing) => ({
      ...standing,
      totalPoints: Number(standing.totalPoints),
    }));
  }
}