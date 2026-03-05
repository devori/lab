# Devori Lab Monorepo

Devori Lab의 제품 실험/구현/배포를 위한 **npm workspaces** 기반 모노레포입니다.

## Repository Layout

```txt
lab/
├─ apps/                  # Deployable product apps
│  └─ lab-web/            # Next.js app (가계부 MVP)
├─ packages/              # Shared code/tooling (when needed)
├─ package.json           # Root workspace scripts + workspaces
└─ package-lock.json      # Lockfile
```

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
- [x] 루트 기준 `lint/typecheck/build` 검증
