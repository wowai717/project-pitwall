import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Driver } from './driver.entity';
import { Constructor } from './constructor.entity';
import { Race } from './race.entity';

@Entity('results')
export class Result {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  position: number; // 순위 (1, 2, 3...)

  @Column()
  points: number; // 획득 포인트 (25, 18...)

  @Column()
  grid: number; // 출발 순서

  @Column()
  laps: number; // 완주 랩 수

  @Column()
  status: string; // 상태 ('Finished', 'Collision' 등)

  // 관계 설정 (Foreign Keys)

  @ManyToOne(() => Race, (race) => race.results)
  @JoinColumn({ name: 'raceId' })
  race: Race;

  @ManyToOne(() => Driver, (driver) => driver.results)
  @JoinColumn({ name: 'driverId' })
  driver: Driver;

  @ManyToOne(() => Constructor, (constructor) => constructor.results)
  @JoinColumn({ name: 'constructorId' })
  f1constructor: Constructor;
}