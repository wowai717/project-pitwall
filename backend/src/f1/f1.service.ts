import {
  Injectable,
  Logger,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver } from '../entities/driver.entity';
import { Constructor } from '../entities/constructor.entity';
import { Race } from '../entities/race.entity';
import { Result } from '../entities/result.entity';
import { firstValueFrom } from 'rxjs';
import { join } from 'path';
import { readFileSync } from 'fs';

const f1dbFallback = JSON.parse(
  readFileSync(join(__dirname, 'data/f1db-2020-2025.json'), 'utf8'),
) as F1DbFallback;

interface ApiDriver {
  driverId: string;
  givenName: string;
  familyName: string;
  code?: string;
  permanentNumber?: string;
  dateOfBirth?: string;
  nationality: string;
}
interface ApiConstructor {
  constructorId: string;
  name: string;
  nationality: string;
  url: string;
}
interface ApiResult {
  Driver: ApiDriver;
  Constructor: ApiConstructor;
  number: string;
  position: string;
  points: string;
  grid: string;
  laps: string;
  status: string;
}
interface ApiRace {
  season: string;
  round: string;
  raceName: string;
  date: string;
  time?: string;
  Circuit: { circuitId: string };
  Results?: ApiResult[];
  SprintResults?: ApiResult[];
}
interface ApiResponse {
  MRData?: {
    total?: string;
    limit?: string;
    DriverTable?: { Drivers?: ApiDriver[] };
    ConstructorTable?: { Constructors?: ApiConstructor[] };
    RaceTable?: { Races?: ApiRace[] };
    StandingsTable?: {
      StandingsLists?: Array<{
        DriverStandings?: Array<{
          Driver: ApiDriver;
          points: string;
          wins: string;
        }>;
        ConstructorStandings?: Array<{
          Constructor: ApiConstructor;
          position: string;
          points: string;
          wins: string;
        }>;
      }>;
    };
  };
}

function apiDriverId(id: string): string {
  const exceptions: Record<string, string> = {
    'max-verstappen': 'max_verstappen',
    'mick-schumacher': 'mick_schumacher',
    'pietro-fittipaldi': 'pietro_fittipaldi',
    'nyck-de-vries': 'de_vries',
    'guanyu-zhou': 'zhou',
    'carlos-sainz-jr': 'sainz',
  };
  return exceptions[id] ?? id.split('-').at(-1)!;
}

interface F1DbDriver {
  id: string;
  firstName: string;
  lastName: string;
  code: string;
  permanentNumber: string;
  nationality: string;
}

interface F1DbConstructor {
  id: string;
  name: string;
  nationality: string;
}

interface F1DbRaceResult {
  driverId: string;
  constructorId: string;
  driverNumber: string;
  position: number | null;
  positionText: string | null;
  points: number | null;
  grid: number | null;
  laps: number | null;
  status: string | null;
}

interface F1DbSeason {
  drivers: F1DbDriver[];
  constructors: F1DbConstructor[];
  driverStandings: Array<{
    driverId: string;
    position: number;
    points: number;
    wins: number;
  }>;
  constructorStandings: Array<{
    constructorId: string;
    position: number;
    points: number;
    wins: number;
  }>;
  races: Array<{
    round: number;
    raceName: string;
    date: string;
    results: F1DbRaceResult[];
  }>;
}

interface F1DbFallback {
  seasons: Record<string, F1DbSeason>;
}

@Injectable()
export class F1Service {
  private readonly logger = new Logger(F1Service.name);
  private readonly TARGET_YEARS = [2020, 2021, 2022, 2023, 2024, 2025];
  private readonly PAGE_SIZE = 100;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly httpService: HttpService,
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    @InjectRepository(Constructor)
    private readonly constructorRepository: Repository<Constructor>,
    @InjectRepository(Race) private readonly raceRepository: Repository<Race>,
    @InjectRepository(Result)
    private readonly resultRepository: Repository<Result>,
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
      const { data } = await firstValueFrom(
        this.httpService.get<ApiResponse>(url),
      );
      const drivers = data?.MRData?.DriverTable?.Drivers || [];

      for (const d of drivers) {
        const exists = await this.driverRepository.findOne({
          where: { driverId: d.driverId },
        });
        if (!exists) {
          await this.driverRepository.save({
            driverId: d.driverId,
            code:
              d.code ||
              (
                d.givenName.substring(0, 1) + d.familyName.substring(0, 2)
              ).toUpperCase(),
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
      const { data } = await firstValueFrom(
        this.httpService.get<ApiResponse>(url),
      );
      const constructors = data?.MRData?.ConstructorTable?.Constructors || [];

      for (const c of constructors) {
        const exists = await this.constructorRepository.findOne({
          where: { constructorId: c.constructorId },
        });
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
      const { data } = await firstValueFrom(
        this.httpService.get<ApiResponse>(url),
      );
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
        const { data } = await firstValueFrom(
          this.httpService.get<ApiResponse>(url),
        );
        const races = data?.MRData?.RaceTable?.Races || [];

        total = Number(data?.MRData?.total ?? 0);
        const pageSize = Number(data?.MRData?.limit ?? this.PAGE_SIZE);

        for (const raceData of races) {
          const race = await this.raceRepository.findOne({
            where: {
              season: Number(raceData.season),
              round: Number(raceData.round),
            },
          });
          if (!race) continue;

          for (const result of raceData[resultKey] || []) {
            const driver = await this.driverRepository.findOne({
              where: { driverId: result.Driver.driverId },
            });
            const constructor = await this.constructorRepository.findOne({
              where: { constructorId: result.Constructor.constructorId },
            });

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
    const cacheKey = `v2_driver_standings_${year}`;
    const cachedData = await this.cacheManager.get<unknown[]>(cacheKey);
    if (cachedData) {
      this.logger.log(`⚡ [REDIS CACHE HIT] ${year}년도 드라이버 랭킹`);
      return cachedData;
    }

    this.logger.log(`🏎️ [API FETCH] ${year}년도 드라이버 랭킹 조회 중...`);
    const url = `https://api.jolpi.ca/ergast/f1/${year}/driverstandings.json`;

    try {
      const { data } = await firstValueFrom(
        this.httpService.get<ApiResponse>(url),
      );
      const standingsList =
        data?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ||
        [];

      if (!standingsList.length) throw new Error('Empty standings response');
      const result = standingsList.map((standing) => ({
        id: standing.Driver.driverId,
        firstName: standing.Driver.givenName,
        lastName: standing.Driver.familyName,
        code:
          standing.Driver.code ||
          standing.Driver.familyName.substring(0, 3).toUpperCase(),
        nationality: standing.Driver.nationality,
        totalPoints: Number(standing.points),
        wins: Number(standing.wins),
      }));

      await this.cacheManager.set(cacheKey, result);
      return result;
    } catch (error) {
      this.logger.error(`${year}년 드라이버 랭킹 조회 실패`, error);
      const fallback = this.getFallbackDriverStandings(year);
      if (fallback.length > 0) {
        this.logger.warn(
          `Jolpica 장애로 ${year}년 드라이버 랭킹에 F1DB 로컬 스냅샷을 사용합니다.`,
        );
        await this.cacheManager.set(cacheKey, fallback, 60_000);
        return fallback;
      }
      throw new ServiceUnavailableException(
        '순위 데이터를 불러오지 못했습니다.',
      );
    }
  }

  async getDriverResults(year: number, driverId: string) {
    const season = this.getFallbackSeason(year);
    const driver = season && this.findFallbackDriver(season, driverId);
    if (driver) driverId = apiDriverId(driver.id);
    const cacheKey = `v2_driver_results_${year}_${driverId}`;
    const cachedData = await this.cacheManager.get<unknown[]>(cacheKey);
    if (cachedData) {
      this.logger.log(`⚡ [REDIS CACHE HIT] ${year}년도 ${driverId} 상세 성적`);
      return cachedData;
    }

    this.logger.log(
      `📊 [API FETCH] ${year}년도 ${driverId} 상세 성적 조회 중...`,
    );

    try {
      const url = `https://api.jolpi.ca/ergast/f1/${year}/drivers/${encodeURIComponent(driverId)}/results.json?limit=100`;
      const { data } = await firstValueFrom(
        this.httpService.get<ApiResponse>(url),
      );
      const races = data?.MRData?.RaceTable?.Races || [];

      if (!races.length && driver) throw new Error('Empty results response');
      const result = races.flatMap((race) =>
        (race.Results || []).map((result) => ({
          race: {
            round: Number(race.round),
            raceName: race.raceName,
            date: race.date,
          },
          driver: {
            ...result.Driver,
            permanentNumber: result.number, // 실제 레이스 달린 차량 번호 우선 적용
          },
          constructor: result.Constructor,
          position: Number(result.position),
          points: Number(result.points),
          grid: Number(result.grid),
          laps: Number(result.laps),
          status: result.status,
        })),
      );

      await this.cacheManager.set(cacheKey, result);
      return result;
    } catch (error) {
      this.logger.error(`${year}년 ${driverId} 상세 성적 조회 실패`, error);
      const fallback = this.getFallbackDriverResults(year, driverId);
      if (fallback.length > 0) {
        this.logger.warn(
          `Jolpica 장애로 ${year}년 ${driverId} 기록에 F1DB 로컬 스냅샷을 사용합니다.`,
        );
        await this.cacheManager.set(cacheKey, fallback, 60_000);
        return fallback;
      }
      throw new ServiceUnavailableException('경기 기록을 불러오지 못했습니다.');
    }
  }

  async getConstructorStandings(year: number = 2023) {
    const cacheKey = `v2_constructor_standings_${year}`;
    const cachedData = await this.cacheManager.get<unknown[]>(cacheKey);
    if (cachedData) {
      this.logger.log(`⚡ [REDIS CACHE HIT] ${year}년도 공식 팀 랭킹`);
      return cachedData;
    }

    this.logger.log(`🛠️ [API FETCH] ${year}년도 공식 팀 랭킹 조회 중...`);
    const url = `https://api.jolpi.ca/ergast/f1/${year}/constructorStandings.json`;

    try {
      const { data } = await firstValueFrom(
        this.httpService.get<ApiResponse>(url),
      );
      const standingsList =
        data?.MRData?.StandingsTable?.StandingsLists?.[0]
          ?.ConstructorStandings || [];

      if (!standingsList.length)
        throw new Error('Empty constructor standings response');
      const result = standingsList.map((standing) => ({
        name: standing.Constructor.name,
        nationality: standing.Constructor.nationality,
        position: standing.position,
        totalPoints: standing.points,
        wins: standing.wins,
      }));

      await this.cacheManager.set(cacheKey, result);
      return result;
    } catch (error) {
      this.logger.error(`${year}년 팀 랭킹 조회 실패`, error);
      const fallback = this.getFallbackConstructorStandings(year);
      if (fallback.length > 0) {
        this.logger.warn(
          `Jolpica 장애로 ${year}년 팀 랭킹에 F1DB 로컬 스냅샷을 사용합니다.`,
        );
        await this.cacheManager.set(cacheKey, fallback, 60_000);
        return fallback;
      }
      throw new ServiceUnavailableException('팀 순위를 불러오지 못했습니다.');
    }
  }

  private getFallbackSeason(year: number): F1DbSeason | undefined {
    return f1dbFallback.seasons[String(year)];
  }

  private getFallbackDriverStandings(year: number) {
    const season = this.getFallbackSeason(year);
    if (!season) return [];

    return season.driverStandings
      .map((standing) => {
        const driver = season.drivers.find(
          (item) => item.id === standing.driverId,
        );
        if (!driver) return null;

        return {
          id: apiDriverId(driver.id),
          firstName: driver.firstName,
          lastName: driver.lastName,
          code: driver.code,
          nationality: driver.nationality,
          totalPoints: standing.points,
          wins: standing.wins,
        };
      })
      .filter(
        (standing): standing is NonNullable<typeof standing> =>
          standing !== null,
      );
  }

  private getFallbackConstructorStandings(year: number) {
    const season = this.getFallbackSeason(year);
    if (!season) return [];

    const winsByConstructor = new Map<string, number>();
    for (const race of season.races) {
      const winner = race.results.find((result) => result.position === 1);
      if (winner) {
        winsByConstructor.set(
          winner.constructorId,
          (winsByConstructor.get(winner.constructorId) || 0) + 1,
        );
      }
    }

    return season.constructorStandings
      .map((standing) => {
        const constructor = season.constructors.find(
          (item) => item.id === standing.constructorId,
        );
        if (!constructor) return null;

        return {
          name: constructor.name,
          nationality: constructor.nationality,
          position: standing.position,
          totalPoints: standing.points,
          wins: winsByConstructor.get(constructor.id) || 0,
        };
      })
      .filter(
        (standing): standing is NonNullable<typeof standing> =>
          standing !== null,
      );
  }

  private getFallbackDriverResults(year: number, requestedDriverId: string) {
    const season = this.getFallbackSeason(year);
    if (!season) return [];

    const driver = this.findFallbackDriver(season, requestedDriverId);
    if (!driver) return [];

    return season.races.flatMap((race) =>
      race.results
        .filter((result) => result.driverId === driver.id)
        .map((result) => {
          const constructor = season.constructors.find(
            (item) => item.id === result.constructorId,
          );
          const finished =
            result.positionText !== null && /^\d+$/.test(result.positionText);

          return {
            race: {
              round: race.round,
              raceName: race.raceName,
              date: race.date,
            },
            driver: {
              givenName: driver.firstName,
              familyName: driver.lastName,
              permanentNumber: result.driverNumber || driver.permanentNumber,
            },
            constructor: constructor
              ? {
                  constructorId: constructor.id,
                  name: constructor.name,
                  nationality: constructor.nationality,
                }
              : undefined,
            position: result.position || 0,
            points: result.points ?? 0,
            grid: result.grid || 0,
            laps: result.laps || 0,
            status: finished
              ? 'Finished'
              : result.status || result.positionText || 'Unknown',
          };
        }),
    );
  }

  private findFallbackDriver(season: F1DbSeason, requestedDriverId: string) {
    const normalized = requestedDriverId
      .trim()
      .toLowerCase()
      .replaceAll('_', '-');
    const exact = season.drivers.find(
      (driver) =>
        driver.id === normalized ||
        apiDriverId(driver.id) === requestedDriverId,
    );
    if (exact) return exact;

    const matches = season.drivers.filter(
      (driver) =>
        driver.id.endsWith(`-${normalized}`) ||
        driver.lastName.toLowerCase() === normalized,
    );
    return matches.length === 1 ? matches[0] : undefined;
  }
}
