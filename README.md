# project-pitwall

F1 Racing Data Analytics Platform

## Local development

The frontend expects the backend API at `http://localhost:4000`, and the backend needs MySQL and Redis before it can boot.

Run the whole local stack from the repository root:

```bash
npm run dev
```

That command will:

- start `mysql` and `redis` with Docker Compose
- start the Nest backend on `http://localhost:4000`
- start the Next frontend on `http://localhost:3000`

Useful helper commands:

```bash
npm run dev:infra
npm run dev:backend
npm run dev:frontend
npm run dev:down
```
