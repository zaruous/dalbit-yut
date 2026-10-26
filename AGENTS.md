# Codex guide — 달빛 윷마당

## 우선사항

1. 신규 디자인은 **가을 한옥/노을 배경 + 전통 금장 UI + 바로 아래 윷 던지는 멍석**이다.
2. `src/theme-cinematic.css`가 새 디자인의 주 테마. `src/styles.css`는 공통 인터랙션/레이아웃 기반이므로 유의해서 수정한다.
3. 사람 플레이어는 자동으로 말이 움직이면 안 된다. **윷 결과 선택 → 말 클릭 → 경로 선택 → 금빛 목적지 클릭**으로만 이동한다. AI 플레이어만 자동 조작한다.
4. 게임 규칙과 그래프를 바꾸기 전에 반드시 `npm test`를 수행하고 변경 후 재검증한다.
5. 제외한 확장 교차형(C)을 재도입하지 않는다. A 팔각 순환형, B 이중 링형만 제공한다.
6. 모바일에서 윷판 아래 윷 던지기 영역이 이어지도록 한다.

## 엔진 구조

- `src/mapEngine.js`: 노드/방향/지름길/완주/빽도 이동의 그래프 엔진
- `src/gameEngine.js`: 윷 결과, 2~4인 턴, 말 잡기/업기, AI 액션 선택, 낙 판정
- `src/App.js`: React 16 UMD, `React.createElement`, 플레이어 직접 선택, 보드 SVG, ThrowMat SVG, 효과
- `src/styles.css`: 기본 UI/다양한 조작 애니메이션
- `src/theme-cinematic.css`: 시네마틱 스타일 최종 오버라이드
- `public/hanok-sunset-atmosphere.webp`: 배경 이미지. 게임 UI 요소가 박힌 원본 이미지가 아닌 부드럽게 처리된 분위기 배경

## 규칙 및 테스트

- 도/개/걸/윷/모/빽도. 윷·모 및 상대 잡기 시 추가 던지기.
- 정확히 갈림길에 멈추었을 때만 지름길 진입 가능.
- 낙은 하나 이상의 윷가락이 멍석의 경계 밖으로 **완전히** 나갈 때. 경계에 걸친 경우 유효.
- 1인 모드: 사람 1 + AI 1~3; 로컬 모드: 사람 2~4, 각 4개 말.
- `npm test`는 외부 npm 설치 없이 동작. 정적 파일 `index.html`로 Vercel 배포.
- 브라우저에서 `window.__DALBIT_APP__`와 `window.__DALBIT_INSTANCE__`로 검사 가능.
- `vercel.json`은 정적 배포. 프레임워크 Other, 빌드 명령 없음.

## React + TypeScript migration

Canonical sources are `src-ts/App.tsx`, `src-ts/gameEngine.ts`, and `src-ts/mapEngine.ts`.
Do not edit legacy JavaScript files. Use `npm run typecheck`, `npm test`, and `npm run build`.
Vercel uses `vite build` and outputs `dist/`. Preserve the manual piece selection and destination confirmation behavior.

## Visual QA v1.0 (2026-10-26)

- `src-ts/quality-v1.css` is the last loaded CSS layer; edit this first for presentation changes.
- `public/hanok-autumn-scene.svg` is an **independent scenic background without baked game controls**. Do not reintroduce a background scene containing a faint board or player UI.
- `scripts/build-preview.cjs` generates a standalone HTML from compiled TS; run `npm run build:preview` after canonical TSX/CSS changes.
- Board → directly below throw mat → throw button must fit in 1600x900 and 1366x768 desktop screens, and appear consecutively on mobile.
- Keep player card status/progress, turn highlighting, four Yut stick flight wrappers (outer transform fixes landing; inner `stick-flight` handles tossing animation), numbered path and gold destination, forced nak branch behavior.
- `docs/visual-quality-v1.md` contains numeric quality gates and the honest verification scope. Do not claim visual 85/100 without independent human review; do not claim Vite production build until it actually succeeds.