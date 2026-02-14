import { Entity, Column, PrimaryColumn, OneToMany } from 'typeorm';
import { Result } from './result.entity';

@Entity('races')
export class Race {
  @PrimaryColumn()
  raceId: string; // 예: '2023_5' (시즌_라운드 조합 추천)

  @Column()
  season: number; // 2023

  @Column()
  round: number; // 5

  @Column()
  raceName: string; // 'Miami Grand Prix'

  @Column()
  date: string; // '2023-05-07'

  @Column()
  circuitId: string; // 'miami'

  // 관계 설정: 한 경기는 여러 명의 드라이버 결과를 가짐
  @OneToMany(() => Result, (result) => result.race)
  results: Result[];
}