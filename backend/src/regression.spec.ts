import { BadRequestException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import type { Cache } from 'cache-manager';
import { Repository } from 'typeorm';
import { F1Service } from './f1/f1.service';
import { F1Controller } from './f1/f1.controller';
import { Driver } from './entities/driver.entity';
import { Constructor } from './entities/constructor.entity';
import { Race } from './entities/race.entity';
import { Result } from './entities/result.entity';

const cache = {
  get: jest.fn().mockResolvedValue(undefined),
  set: jest.fn().mockResolvedValue(undefined),
};
const get = jest.fn();
beforeAll(() => {
  Logger.overrideLogger(false);
});
function f1() {
  return new F1Service(
    cache as unknown as Cache,
    { get } as unknown as HttpService,
    {} as Repository<Driver>,
    {} as Repository<Constructor>,
    {} as Repository<Race>,
    {} as Repository<Result>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  get.mockReturnValue(throwError(() => new Error('offline')));
});

test('all fallback standings link to nonempty results using stable API IDs', async () => {
  const service = f1();
  for (const year of [2020, 2021, 2022, 2023, 2024, 2025]) {
    const standings = (await service.getDriverStandings(year)) as Array<{
      id: string;
    }>;
    expect(standings.length).toBeGreaterThan(19);
    for (const driver of standings)
      expect(
        (await service.getDriverResults(year, driver.id)).length,
      ).toBeGreaterThan(0);
  }
});

test('empty upstream responses use snapshots and normalize zero points', async () => {
  get.mockReturnValue(of({ data: { MRData: { RaceTable: { Races: [] } } } }));
  const service = f1();
  const results = (await service.getDriverResults(2023, 'sainz')) as Array<{
    points: number;
  }>;
  expect(results.length).toBeGreaterThan(0);
  expect(results.every((result) => typeof result.points === 'number')).toBe(
    true,
  );
  expect(get).toHaveBeenCalledWith(expect.stringContaining('/drivers/sainz/'));
  await service.getDriverResults(2023, 'lewis_hamilton');
  expect(get).toHaveBeenLastCalledWith(
    expect.stringContaining('/drivers/hamilton/'),
  );
});

test('half points survive the fallback response', async () => {
  const results = (await f1().getDriverResults(
    2021,
    'max_verstappen',
  )) as Array<{ race: { raceName: string }; points: number }>;
  expect(
    results.find((result) => result.race.raceName === 'Belgian Grand Prix')
      ?.points,
  ).toBe(12.5);
});

interface RaceSummary {
  race: { round: number };
  constructor?: { constructorId: string; name: string };
  grid: number | null;
  laps: number | null;
}

test('fallback result summaries retain source team, grid and laps without replacing unknowns with zero', async () => {
  const service = f1();
  const hamilton = (await service.getDriverResults(
    2023,
    'hamilton',
  )) as RaceSummary[];
  expect(hamilton.find((result) => result.race.round === 1)).toMatchObject({
    constructor: { constructorId: 'mercedes', name: 'Mercedes' },
    grid: 7,
    laps: 57,
  });
  const sainz = (await service.getDriverResults(
    2023,
    'sainz',
  )) as RaceSummary[];
  expect(sainz.find((result) => result.race.round === 17)).toMatchObject({
    constructor: { constructorId: 'ferrari', name: 'Ferrari' },
    grid: null,
    laps: null,
  });
});

test('live result summaries keep a recorded zero and leave missing grid and laps unknown', async () => {
  const constructor = {
    constructorId: 'mercedes',
    name: 'Mercedes',
    nationality: 'German',
  };
  const result = {
    Driver: {
      driverId: 'hamilton',
      givenName: 'Lewis',
      familyName: 'Hamilton',
    },
    Constructor: constructor,
    number: '44',
    position: '5',
    points: '10',
    status: 'Finished',
  };
  get.mockReturnValue(
    of({
      data: {
        MRData: {
          RaceTable: {
            Races: [
              {
                round: '1',
                raceName: 'Bahrain Grand Prix',
                date: '2023-03-05',
                Results: [{ ...result, grid: '0', laps: '57' }],
              },
              {
                round: '2',
                raceName: 'Saudi Arabian Grand Prix',
                date: '2023-03-19',
                Results: [result],
              },
            ],
          },
        },
      },
    }),
  );
  const results = (await f1().getDriverResults(
    2023,
    'hamilton',
  )) as RaceSummary[];
  expect(results[0]).toMatchObject({ constructor, grid: 0, laps: 57 });
  expect(results[1]).toMatchObject({ constructor, grid: null, laps: null });
});

test('fallback results retain classified retirement reasons and normalize completed finishes', async () => {
  const service = f1();
  for (const [driverId, status] of [
    ['kvyat', 'Suspension'],
    ['albon', 'Electronics'],
    ['bottas', 'Finished'],
  ]) {
    const results = (await service.getDriverResults(2020, driverId)) as Array<{
      race: { round: number };
      status: string;
    }>;
    expect(results.find((result) => result.race.round === 1)?.status).toBe(
      status,
    );
  }
});

test('unsupported seasons and malformed IDs are rejected before upstream calls', async () => {
  const controller = new F1Controller(f1());
  await expect(controller.getStandings('2023oops')).rejects.toBeInstanceOf(
    BadRequestException,
  );
  await expect(
    controller.getResults('2023', '../drivers'),
  ).rejects.toBeInstanceOf(BadRequestException);
  expect(get).not.toHaveBeenCalled();
});
