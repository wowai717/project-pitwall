import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1789600000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Existing development tables are retained; fresh deployments get the same schema.
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS users (
      id varchar(36) PRIMARY KEY, username varchar(255) NOT NULL UNIQUE,
      passwordHash varchar(255) NOT NULL, createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
    ) ENGINE=InnoDB`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS drivers (
      driverId varchar(255) PRIMARY KEY, code varchar(255) NOT NULL UNIQUE,
      permanentNumber varchar(255) NOT NULL, givenName varchar(255) NOT NULL,
      familyName varchar(255) NOT NULL, dateOfBirth varchar(255) NOT NULL DEFAULT '1900-01-01',
      nationality varchar(255) NOT NULL DEFAULT 'Unknown'
    ) ENGINE=InnoDB`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS constructors (
      constructorId varchar(255) PRIMARY KEY, name varchar(255) NOT NULL,
      nationality varchar(255) NOT NULL DEFAULT 'Unknown', url varchar(255) NOT NULL, color varchar(255) NULL
    ) ENGINE=InnoDB`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS races (
      raceId varchar(255) PRIMARY KEY, season int NOT NULL, round int NOT NULL,
      raceName varchar(255) NOT NULL, date varchar(255) NOT NULL, circuitId varchar(255) NOT NULL
    ) ENGINE=InnoDB`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS results (
      id int PRIMARY KEY AUTO_INCREMENT, position int NOT NULL, points decimal(6,2) NOT NULL,
      grid int NOT NULL, laps int NOT NULL, status varchar(255) NOT NULL, isSprint tinyint NOT NULL DEFAULT 0,
      raceId varchar(255) NULL, driverId varchar(255) NULL, constructorId varchar(255) NULL,
      FOREIGN KEY (raceId) REFERENCES races(raceId), FOREIGN KEY (driverId) REFERENCES drivers(driverId),
      FOREIGN KEY (constructorId) REFERENCES constructors(constructorId)
    ) ENGINE=InnoDB`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS posts (
      id varchar(36) PRIMARY KEY, title varchar(255) NOT NULL, content text NOT NULL,
      createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), authorId varchar(36) NULL,
      FOREIGN KEY (authorId) REFERENCES users(id)
    ) ENGINE=InnoDB`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS comments (
      id varchar(36) PRIMARY KEY, content text NOT NULL,
      createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), authorId varchar(36) NULL, postId varchar(36) NULL,
      FOREIGN KEY (authorId) REFERENCES users(id), FOREIGN KEY (postId) REFERENCES posts(id)
    ) ENGINE=InnoDB`);
    await queryRunner.query(
      'ALTER TABLE results MODIFY points decimal(6,2) NOT NULL',
    );
  }

  down(): Promise<void> {
    return Promise.reject(
      new Error(
        'Restore a verified backup instead of dropping existing tables.',
      ),
    );
  }
}
