import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver } from '../entities/driver.entity';
import { Constructor } from '../entities/constructor.entity'; 
import { firstValueFrom } from 'rxjs';
import { Race } from '../entities/race.entity';
import { Result } from '../entities/result.entity';

@Injectable()
export class F1Service {
  private readonly logger = new Logger(F1Service.name);

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    @InjectRepository(Constructor) 
    private readonly constructorRepository: Repository<Constructor>,
    @InjectRepository(Race)
    private readonly raceRepository: Repository<Race>,
    @InjectRepository(Result)
    private readonly resultRepository: Repository<Result>,
  ) {}

  // 드라이버 데이터 수집 
  async seedDrivers() {
    this.logger.log('🏎️ 드라이버 데이터 수집 시작...');
    const url = 'https://api.openf1.org/v1/drivers?session_key=9158'; 
    
    try {
      const { data } = await firstValueFrom(this.httpService.get(url));
      
      for (const driverData of data) {
        if (!driverData.driver_number) continue;

        const exists = await this.driverRepository.findOne({ 
          where: { driverId: String(driverData.driver_number) } 
        });

        if (!exists) {
          await this.driverRepository.save({
            driverId: String(driverData.driver_number),
            code: driverData.name_acronym, 
            permanentNumber: String(driverData.driver_number),
            givenName: driverData.first_name, 
            familyName: driverData.last_name, 
            dateOfBirth: '1900-01-01', 
            nationality: driverData.country_code, 
          });
        }
      }
      this.logger.log('✅ 드라이버 데이터 저장 완료!');
      return { message: 'Drivers seeded successfully', count: data.length };
    } catch (error) {
      this.logger.error('데이터 수집 중 에러 발생', error);
      throw error;
    }
  }

  // 팀(Constructor) 데이터 수집
  async seedConstructors() {
    this.logger.log('🛠️ 팀 데이터 수집 시작...');
    
    const url = 'https://api.openf1.org/v1/drivers?session_key=9158';

    try {
      const { data } = await firstValueFrom(this.httpService.get(url));
      
      // 팀 이름 중복 제거를 위한 Map 생성
      const teamMap = new Map<string, any>();

      for (const driver of data) {
        // team_name이 있는 경우만 처리
        if (driver.team_name) {
          // 팀 ID 생성 (예: 'Red Bull Racing' -> 'red_bull_racing')
          const teamId = driver.team_name.toLowerCase().replace(/\s+/g, '_');
          
          if (!teamMap.has(teamId)) {
            teamMap.set(teamId, {
              constructorId: teamId,
              name: driver.team_name,
              nationality: driver.country_code || 'Unknown', // 드라이버 국적을 임시로 사용
              url: '', // API에 URL 정보는 없음
              // team_colour가 있으면 #을 붙여서 저장, 없으면 기본값 검정(#000000)
              color: driver.team_colour ? `#${driver.team_colour}` : '#000000', 
            });
          }
        }
      }

      // DB 저장
      const teams = Array.from(teamMap.values());
      for (const team of teams) {
        const exists = await this.constructorRepository.findOne({
          where: { constructorId: team.constructorId }
        });

        if (!exists) {
          await this.constructorRepository.save(team);
        }
      }

      this.logger.log(`✅ 팀 데이터 저장 완료! (${teams.length}개 팀)`);
      return { message: 'Constructors seeded successfully', count: teams.length };

    } catch (error) {
      this.logger.error('팀 데이터 수집 실패', error);
      throw error;
    }
  }
  async getAllDrivers() { return this.driverRepository.find(); }

  async seedRaces() {
    this.logger.log('📅 2023 시즌 경기 일정 수집 시작...');
    
    // 2023년의 모든 'Race' 세션만 조회
    const url = 'https://api.openf1.org/v1/sessions?year=2023&session_name=Race';

    try {
      const { data } = await firstValueFrom(this.httpService.get(url));
      
      // 날짜순으로 정렬 (개막전 -> 최종전)
      data.sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime());

      let roundCount = 1;

      for (const session of data) {
        const raceId = String(session.session_key); // 예: '9158' (이게 나중에 중요)
        
        const exists = await this.raceRepository.findOne({ where: { raceId } });

        if (!exists) {
          await this.raceRepository.save({
            raceId: raceId,
            season: session.year,
            round: roundCount++, // 1라운드, 2라운드... 순서대로 부여
            raceName: session.meeting_name || session.location || session.country_name || 'Grand Prix',
            date: session.date_start,       // 예: '2023-03-05...'
            circuitId: session.circuit_short_name, // 예: 'Sakhir'
          });
        }
      }

      this.logger.log(`✅ 경기 일정 저장 완료! (총 ${data.length}개 그랑프리)`);
      return { message: 'Races seeded successfully', count: data.length };
    } catch (error) {
      this.logger.error('경기 일정 수집 실패', error);
      throw error;
    }
  }

  async seedResults() {
    this.logger.log('🏆 경기 결과 데이터 수집 시작 (Source: Ergast API)...');
    
    const url = 'http://api.jolpi.ca/ergast/f1/2023/results.json?limit=1000';

    try {
      const response = await firstValueFrom(this.httpService.get(url));
      const data = response.data;

      // 데이터 검증 (Jolpica도 구조는 Ergast와 100% 동일함)
      if (!data || !data.MRData) {
        this.logger.error('❌ API 응답 구조가 이상합니다!');
        return; 
      }

      const races = data.MRData.RaceTable.Races; 

      let totalResults = 0;

      for (const raceData of races) {
        const race = await this.raceRepository.findOne({
          where: { season: Number(raceData.season), round: Number(raceData.round) }
        });

        if (!race) continue;

        for (const resultData of raceData.Results) {
          const driver = await this.driverRepository.findOne({
            where: { driverId: resultData.number } 
          });

          if (driver) {
            const exists = await this.resultRepository.findOne({
              where: { 
                race: { raceId: race.raceId }, 
                driver: { driverId: driver.driverId } 
              }
            });

            if (!exists) {
              await this.resultRepository.save({
                race: race,    
                driver: driver, 
                f1Constructor: null, 
                position: Number(resultData.position),
                points: Number(resultData.points),
                grid: Number(resultData.grid),
                laps: Number(resultData.laps),
                status: resultData.status, 
              });
              totalResults++;
            }
          }
        }
      }

      this.logger.log(`✅ 경기 결과 저장 완료! (총 ${totalResults}개 데이터)`);
      return { message: 'Results seeded successfully', count: totalResults };

    } catch (error) {
      this.logger.error('경기 결과 수집 실패', error);
      throw error;
    }
  }

  async getDriverStandings() {
    return this.resultRepository
      .createQueryBuilder('result')
      .leftJoin('result.driver', 'driver') 
      .select([
        'driver.givenName AS firstName',
        'driver.familyName AS lastName',
        'driver.code AS code',
        'driver.nationality AS nationality',
      ])
      .addSelect('SUM(result.points)', 'totalPoints') 
      .groupBy('driver.driverId') 
      .orderBy('totalPoints', 'DESC') 
      .getRawMany(); 
  }
}