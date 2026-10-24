# 달빛 윷마당 — React + TypeScript (Vite)

한국 전통 윷놀이에서 영감을 받은 1~4인용 웹 게임입니다. **React TSX + TypeScript 게임 엔진**, Vite 정적 빌드로 Vercel에 배포합니다. 기존 시네마틱 한옥·노을 배경과 직접 말 이동 UX를 유지했습니다.

## 게임 미리보기

![한옥 노을 배경](./public/hanok-sunset-atmosphere.webp)

[▶ 직접 플레이하는 단일 HTML 미리보기](./preview.html) · [GitHub 소스 보기](./src-ts/App.tsx)

> 위 HTML 파일은 현재 TypeScript 코드를 컴파일해 하나로 묶은 검토용 파일입니다. GitHub는 HTML을 렌더링하지 않으므로 파일을 내려받아 브라우저에서 여세요.

## 주요 기능

- **1인:** AI 상대 1~3명 / **로컬 대전:** 2~4인 (한 기기에서 턴 교대)
- 한 플레이어당 말 4개, 도·개·걸·윷·모·빽도, 잡기/업기, 보너스 던지기와 완주 판정
- 팔각 순환형(A), 이중 링형(B) 커스텀 윷판
- 사용자가 **윷 결과 선택 → 말 클릭 → 지름길 선택 → 황금색 목적지 클릭**으로 이동 확정. AI만 자동 이동
- 윷판 바로 아래의 멍석, 윷 4개 회전·착지·파티클, 힘 조절, **낙 판정** (윷 하나가 멍석 밖에 완전히 떨어지면 무효)
- 전통 금장 플레이어 카드, 단풍·등불·한옥 배경, PC/모바일 반응형 레이아웃

## 실행 및 테스트

Node.js 20.19+ 또는 22.12+ 사용을 권장합니다.

```bash
npm install
npm run dev
```

개발 서버 주소는 Vite 실행 로그를 확인하세요. 타입 검사와 게임 규칙 테스트:

```bash
npm run typecheck
npm test
npm run build
```

`npm test`는 TypeScript 경로/게임 엔진을 CommonJS로 컴파일한 뒤 2개 맵, 2~4인 총 **150판의 자동 플레이**를 검사합니다. 브라우저 UI도 직접 눌러 확인해 주세요.

## Vercel 배포

GitHub 저장소를 Vercel에 연결한 뒤 다음 설정을 사용합니다.

| 항목 | 값 |
|---|---|
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |

`vercel.json`에 동일 설정이 있습니다. **GitHub 업로드만으로 실제 Vercel URL이 생성되지는 않습니다.** Vercel 프로젝트 연결이 필요합니다.

## 소스 구조

| 경로 | 설명 |
|---|---|
| `src-ts/App.tsx` | React TSX 윷판, 플레이어, 던지기·말 이동 UI |
| `src-ts/gameEngine.ts` | 게임 상태·턴·AI·낙·잡기·업기·승리 규칙 |
| `src-ts/mapEngine.ts` | 팔각형·이중 링형 경로 및 분기 선택 |
| `src-ts/styles.css` | 기본 레이아웃과 반응형 스타일 |
| `src-ts/theme-cinematic.css` | 한옥·노을 디자인, 플레이어 카드, 이펙트 테마 |
| `public/` | 배경/파비콘/로컬 UMD React 번들 |
| `index.html` | Vite 진입점 |
| `preview.html` | TS 컴파일 결과가 포함된 독립 실행 미리보기 |
| `test-engine.cjs` | 회귀 테스트 |
| `AGENTS.md` | Codex 개발 지침 |

현재 UI는 기존 React `createElement`를 TypeScript TSX 컴포넌트 내부에서 사용해 이전 디자인을 유지하는 방식입니다. 다음 개발 시 컴포넌트별 JSX와 최신 React 버전으로 단계적으로 리팩터링할 수 있습니다.

## 규칙 및 라이선스

A/B 맵과 낙 판정은 본 프로젝트의 변형 규칙입니다. 윷가락 이동은 2D 착지 좌표/회전 기반 시뮬레이션이며 물리 엔진을 적용한 실사 재현은 아닙니다. 라이브러리 라이선스는 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)를 참고하세요.
