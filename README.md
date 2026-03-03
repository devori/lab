# Devori Lab Monorepo

Devori Lab의 제품 실험/구현/배포를 위한 pnpm 워크스페이스 모노레포입니다.  
This is a pnpm workspace monorepo for experimenting, building, and deploying Devori Lab products.

## Repository Layout

```txt
lab/
├─ apps/                  # Deployable product apps
│  └─ lab-web/            # First product: Next.js web app
├─ packages/              # Shared code/tooling (when needed)
├─ package.json           # Root workspace scripts
└─ pnpm-workspace.yaml    # Workspace package globs
```

## Prerequisites

- Node.js 20+
- pnpm 10+

## Quick Start

```bash
pnpm install
pnpm dev
```

- `pnpm dev` runs `apps/lab-web`.
- 앱 개별 실행: `pnpm --filter lab-web dev`

## Build / Lint / Typecheck

```bash
pnpm build
pnpm lint
pnpm typecheck
```

모든 명령은 루트에서 실행합니다.  
Run all commands from the repository root.

## Vercel Deployment (apps/lab-web)

- Framework: Next.js
- Root Directory: `apps/lab-web`
- Install Command: `pnpm install`
- Build Command: `pnpm --filter lab-web build`
- Output: Next.js default output

권장: Vercel 프로젝트의 Root Directory를 `apps/lab-web`로 지정하세요.  
Recommended: set Vercel project Root Directory to `apps/lab-web`.
