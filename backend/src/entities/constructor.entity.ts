import { Entity, Column, PrimaryColumn, OneToMany } from 'typeorm';
import { Result } from './result.entity';

@Entity('constructors')
export class Constructor {
  @PrimaryColumn()
  constructorId: string; // 예: 'red_bull'

  @Column()
  name: string; // 예: 'Red Bull Racing'

  @Column()
  nationality: string; // 예: 'Austrian'

  @Column()
  url: string;

  @Column({ nullable: true })
  color: string;

  // 관계 설정: 한 팀은 여러 경기 결과를 가짐
  @OneToMany(() => Result, (result) => result.constructor)
  results: Result[];
}