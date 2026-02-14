import { Entity, Column, PrimaryColumn, OneToMany } from 'typeorm';
import { Result } from './result.entity';

@Entity('drivers')
export class Driver {
  @PrimaryColumn()
  driverId: string; // 예: 'max_verstappen' (외부 API ID 그대로 사용)

  @Column({ unique: true })
  code: string; // 예: 'VER'

  @Column()
  permanentNumber: string; // 예: '33'

  @Column()
  givenName: string; // 예: 'Max'

  @Column()
  familyName: string; // 예: 'Verstappen'

  @Column()
  dateOfBirth: string; // 예: '1997-09-30'

  @Column()
  nationality: string; // 예: 'Dutch'

  // 관계 설정: 한 명의 드라이버는 여러 경기 결과를 가짐
  @OneToMany(() => Result, (result) => result.driver)
  results: Result[];
}