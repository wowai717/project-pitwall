import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { F1Service } from './f1/f1.service';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    await app.get(F1Service).seedAll();
  } finally {
    await app.close();
  }
}
void seed().catch(() => {
  console.error('Data import failed.');
  process.exitCode = 1;
});
