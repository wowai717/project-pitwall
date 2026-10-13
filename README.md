# project-pitwall

F1 Racing Data Analytics Platform

## 개발 실행

Node.js 22, Docker Compose가 필요합니다. 저장소 루트 `.env`에는
`FRONTEND_PORT=3000`, `BACKEND_PORT=4000`, `MYSQL_DATABASE`, `MYSQL_ROOT_PASSWORD`,
`MYSQL_DATA_VOLUME`을 설정합니다. 기존 설치는 현재 MySQL 볼륨 이름을 그대로
`MYSQL_DATA_VOLUME`에 지정합니다. 새 설치만 `docker volume create pitwall-mysql-data`로
볼륨을 만들고 그 이름을 지정합니다. 데이터 볼륨은 Compose 종료 후에도 유지됩니다.

`backend/.env`에는 `DB_HOST=mysql`, `DB_PORT=3306`, `DB_USERNAME`, `DB_PASSWORD`,
`DB_NAME`, `REDIS_HOST=redis`, `REDIS_PORT=6379`, `FRONTEND_ORIGIN=http://localhost:3000`,
32자 이상의 무작위 `JWT_SECRET`, `TYPEORM_SYNC=false`를 설정합니다.
DB 이름과 비밀번호는 MySQL 설정과 일치해야 합니다.
`frontend/.env.local`에는 `NEXT_PUBLIC_API_URL=http://localhost:4000`을 설정합니다.
비밀 값과 백업은 Git에 추가하지 않습니다.

```bash
docker compose up -d --build
docker compose exec backend npm run migration:run
```

화면: http://localhost:3000 / API: http://localhost:4000
이후 `npm run dev`로 전체 개발 환경을 실행합니다. `npm run dev:down`은 데이터 볼륨을 삭제하지 않습니다.

## 백업 및 스키마 변경

```bash
bash scripts/backup-db.sh
docker compose exec backend npm run migration:run
```

백업은 `backups/`에 소유자만 읽을 수 있는 SQL 파일로 저장됩니다. 복구는 대상 DB를 확인한 뒤
애플리케이션의 쓰기를 중지하고 실행합니다. 복구는 기존 테이블을 덮어쓸 수 있습니다.

```bash
docker compose stop frontend backend
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -u root "$MYSQL_DATABASE"' < backups/복구할파일.sql
docker compose start backend frontend
```

기존 정수형 점수 컬럼은 마이그레이션에서 소수점 2자리로 확장됩니다. 이미 정수로 저장되어 손실된
소수점은 스키마 변경만으로 복원되지 않습니다. 데이터 수집은 공개 HTTP API가 아닌
개발 환경에서는 `docker compose exec backend npm run seed`로 실행합니다.
운영 이미지는 `docker compose -f docker-compose.yml -f compose.production.yml exec backend npm run seed:prod`를 사용합니다.
두 명령 모두 기존 결과는 건너뛰므로 이미 손실된 소수점을 복구하지 않습니다.

## 운영 이미지

루트 `.env`의 `PUBLIC_API_URL`에 브라우저에서 접근 가능한 API 주소를,
`PUBLIC_FRONTEND_ORIGIN`에 실제 화면 주소를 지정합니다. 예: `https://pitwall.example.com`.
여러 화면 주소를 허용할 때는 쉼표로 구분합니다. 운영 Compose는 이 값을 백엔드의
`FRONTEND_ORIGIN`에 전달합니다. 운영에서는 HTTPS 리버스 프록시를 앞에 둡니다.
Compose 포트는 기본적으로 로컬에만 노출됩니다.

```bash
docker compose -f docker-compose.yml -f compose.production.yml build
docker compose -f docker-compose.yml -f compose.production.yml run --rm backend npm run migration:prod
docker compose -f docker-compose.yml -f compose.production.yml up -d
```

운영 이미지는 개발 서버와 소스 마운트를 사용하지 않습니다. API URL은 프런트 빌드 시 반영됩니다.

## 검증

```bash
docker compose exec backend npm test -- --runInBand
docker compose exec backend npm run test:e2e -- --runInBand
docker compose exec backend npx eslint '{src,apps,libs,test}/**/*.ts'
docker compose exec frontend npm run lint
node scripts/validate-f1-coverage.mjs
```

브라우저 검증은 Playwright 설치 후 `node scripts/check-ui.mjs`로 실행합니다.
별도 경로에 설치한 경우 `PLAYWRIGHT_MODULE`로 패키지 경로를 지정할 수 있습니다.
실행 중인 개발 서버와 Docker가 필요하며, 검증 계정·게시글·댓글은 종료 시 삭제됩니다.
스크린샷은 기본 `/tmp/pitwall-ui`에 저장됩니다.

지원 시즌은 2020~2025년이며, 텔레메트리는 2023년 이후 제공되는 외부 데이터 범위에 따릅니다.
로그인·가입 요청은 접속 IP당 분당 20회로 제한됩니다. 프록시 환경에서 신뢰할 프록시 범위를
설정하지 않으면 프록시 IP를 공유하는 사용자에게 같은 제한이 적용될 수 있습니다.
