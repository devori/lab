# Devori Lab Monorepo

Devori Lab의 제품 실험/구현/배포를 위한 **npm workspaces** 기반 모노레포입니다.

## Repository Layout

```txt
lab/
├─ apps/                  # Deployable product apps
│  └─ lab-web/            # Next.js app (Lab 허브 + 제품 페이지)
├─ packages/              # Shared code/tooling (when needed)
├─ package.json           # Root workspace scripts + workspaces
└─ package-lock.json      # Lockfile
```

## App Routes (`apps/lab-web`)

- `/`: Lab 메인 허브 페이지 (제품 카드/링크)
- `/household-ledger`: 가계부 제품 페이지

## Prerequisites

- Node.js 20+
- npm

## Run (from repo root)

```bash
npm install
npm run dev
```

- `npm run dev`는 `apps/lab-web`를 실행합니다.
- 앱 개별 실행: `npm --workspace lab-web run dev`

## Quality Checks (from repo root)

```bash
npm run lint
npm run typecheck
npm run build
```

## Google Sheets Backend (Secure, Server-side)

`apps/lab-web`의 `/household-ledger`는 기본적으로 브라우저 `localStorage`를 사용합니다.  
서버 환경변수가 설정되면 Next.js API Route(`app/api/ledger/*`)를 통해 Google Sheets 원격 저장을 시도하고, 설정 누락 시 자동으로 로컬 모드로 폴백합니다.

### 1) Vercel 무료 티어 기준 준비

1. Google Cloud에서 프로젝트 생성 (기존 프로젝트 사용 가능)
2. Google Sheets API 활성화
3. 서비스 계정 생성 + JSON 키 발급
4. 가계부용 Google Sheet 생성
5. 해당 Sheet를 서비스 계정 이메일(`...@...iam.gserviceaccount.com`)에 편집 권한으로 공유

### 2) Vercel Environment Variables (절대 `NEXT_PUBLIC_` 사용 금지)

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_SHEET_ID`
- `GOOGLE_PROJECT_ID` (optional)

`GOOGLE_PRIVATE_KEY`는 줄바꿈이 포함된 원문 키 또는 `\\n` 이스케이프 키 모두 허용되도록 서버에서 처리합니다.

### 3) Sheet Tab Schema

API가 처음 접근할 때 아래 탭과 헤더를 자동 보정/생성합니다.

- `Transactions`
  - Header: `id, date, type, category, amount, memo, createdAt, updatedAt`
- `Budgets`
  - Header: `monthKey, budget`
- `Categories`
  - Header: `type, name`

### 4) API Routes

- `GET/PUT /api/ledger/transactions`
- `GET/PUT /api/ledger/budgets`
- `GET/PUT /api/ledger/categories`
- `GET /api/ledger/status` (Google Sheets 설정 여부/누락 env 조회)

환경변수가 없으면 API는 `SHEETS_CONFIG_MISSING` 오류를 반환하며, 클라이언트는 로컬 저장 모드로 동작합니다.

### 5) Remote Mode Manual Sync (Iteration 8)

- UI의 "원격 모드 준비 상태" 패널에서 서버 보고 기준 configured 여부를 확인할 수 있습니다.
- 수동 동기화:
  - `원격에서 다시 불러오기`: API 원격 최신 스냅샷으로 현재 화면 상태 갱신
  - `지금 원격에 저장`: 현재 로컬 스냅샷을 API를 통해 원격 저장
- 충돌 정책은 **Last write wins** 입니다. 동시에 서로 다른 클라이언트가 저장하면 마지막 저장본이 원격 기준 데이터가 됩니다.

## 가계부 MVP 체크리스트

- [x] 거래 CRUD: 날짜, 구분(수입/지출), 카테고리, 금액, 메모
- [x] 요약 카드: 이번 달 수입/지출/잔액
- [x] 월별 목록 + 간단 필터(전체/수입/지출)
- [x] 카테고리 프리셋 + 선택 입력
- [x] 브라우저 `localStorage` 로컬 저장
- [x] 데이터 관리: JSON 내보내기/가져오기(병합·교체) + 전체 초기화
- [x] 입력 UX: 금액/날짜/카테고리 인라인 검증 + 액션 상태 토스트
- [x] 월별 카테고리 요약 표(수입/지출 분리, 합계/비율)
- [x] 한국어 우선 UI 카피
- [x] 원격 준비 상태 패널 + 수동 원격 동기화(불러오기/저장)
- [x] 원격 충돌 정책 안내(Last write wins) UI/README 반영
- [x] 루트 기준 `lint/typecheck/build` 검증
