import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('does not expose database seed routes', () =>
    request(app.getHttpServer()).get('/f1/seed/all').expect(404));
  it('rejects unsupported seasons', () =>
    request(app.getHttpServer())
      .get('/f1/standings?year=2023oops')
      .expect(400));
  it('serves the community list', () =>
    request(app.getHttpServer()).get('/community/posts').expect(200));
  it('requires authentication to write posts', () =>
    request(app.getHttpServer())
      .post('/community/posts')
      .send({ title: 'test', content: 'test' })
      .expect(401));

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});
