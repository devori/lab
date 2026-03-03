# Devori Lab Monorepo

Devori Lab의 제품 실험/구현/배포를 위한 **npm workspaces** 기반 모노레포입니다.  
This is an **npm workspaces** monorepo for experimenting, building, and deploying Devori Lab products.

## Repository Layout

```txt
lab/
├─ apps/                  # Deployable product apps
│  └─ lab-web/            # First product: Next.js web app
├─ packages/              # Shared code/tooling (when needed)
├─ package.json           # Root workspace scripts + workspaces
└─ package-lock.json      # Lockfile
```

## Prerequisites

- Node.js 20+
- npm (bundled with Node)

## Quick Start

```bash
npm install
npm run dev
```

- `npm run dev` runs `apps/lab-web`.
- 앱 개별 실행: `npm --workspace lab-web run dev`

## Build / Lint / Typecheck

```bash
npm run build
npm run lint
npm run typecheck
```

모든 명령은 루트에서 실행합니다.  
Run all commands from the repository root.

## Vercel Deployment (apps/lab-web)

권장: Vercel 프로젝트의 **Root Directory**를 `apps/lab-web`로 지정하세요.  
Recommended: set Vercel project **Root Directory** to `apps/lab-web`.

- Framework: Next.js
- Install Command: `npm install`
- Build Command: `npm run build`
