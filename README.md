[English Version](README.en.md) | **한국어**

# 달빛 윷마당 (Dalbit Yut) — React + TypeScript & Hugging Face ZeroGPU AI

한옥 노을을 배경으로 즐기는 **1인 AI 대전 / 2~4인 로컬 대전 / AI 자동 대전 관전 윷놀이**.  
브라우저에서 직접 조작하는 전통의 손맛과 최신 Hugging Face ZeroGPU 기반 딥러닝 결정 모델의 전략적 수 싸움을 함께 경험할 수 있습니다.

---

## 🎮 온라인 바로 플레이 (Live Demo)

- 🌐 **웹 게임 플레이 (GitHub Pages)**: [https://zaruous.github.io/dalbit-yut/](https://zaruous.github.io/dalbit-yut/)
- 🤗 **Hugging Face Space (ZeroGPU Inference)**: [callakrsos/dalbit-yut](https://huggingface.co/spaces/callakrsos/dalbit-yut)
- 📦 **Hugging Face Model Hub**: [callakrsos/dalbit-yut-laya-1500](https://huggingface.co/callakrsos/dalbit-yut-laya-1500)
- 📄 **독립 실행형 HTML 미리보기**: [preview.html](./preview.html)

---

## 🔥 Hugging Face ZeroGPU AI 대전 & 토큰 설정 가이드

달빛 윷마당은 **Hugging Face Space(A10G ZeroGPU)**와 실시간 연동되어 1,500건의 기보로 파인튜닝된 딥러닝 신경망 AI가 다음 수를 판단합니다.

> [!IMPORTANT]
> **ZeroGPU 쿼터 정책 안내**:  
> Hugging Face의 ZeroGPU 인프라는 로그인하지 않은 익명 IP에 대해 극도로 제한된 무료 쿼터(~1회)만 제공합니다. 따라서 토큰 없이 연속으로 플레이할 경우 `"ZeroGPU runs limit exceeded"` 알림과 함께 내장 탐색 AI로 자동 전환될 수 있습니다.  
> **무료 Hugging Face 계정에서 발급받은 본인의 Read(읽기 전용) 토큰**을 등록하시면 매일 넉넉하게 주어지는 일일 무료 GPU 쿼터로 제한 없이 쾌적하게 딥러닝 AI 대전을 즐기실 수 있습니다!

### 1. 무료 Hugging Face Read 토큰 발급 (약 10초 소요)
1. [Hugging Face 계정 토큰 설정 페이지](https://huggingface.co/settings/tokens)에 접속하여 로그인합니다. (계정이 없다면 무료 가입)
2. **`Create new token`** 버튼을 누릅니다.
3. Token type에서 **`Read`** (읽기 전용)를 선택합니다. (*Write 권한은 필요하지 않습니다.*)
4. 토큰 이름(예: `dalbit-yut`)을 입력하고 **`Create token`**을 클릭한 뒤, 생성된 토큰 문자열(`hf_...`)을 복사합니다.

### 2. 게임에 토큰 등록하기 (아래 두 가지 중 편한 방법 선택)

- **방법 A — URL 파라미터로 즉시 접속 (가장 간편)**  
  브라우저 주소창에 토큰을 파라미터로 붙여 접속하면 브라우저의 `localStorage`에 자동 저장됩니다.
  ```text
  https://zaruous.github.io/dalbit-yut/?hf_token=hf_your_read_token_here
  ```

- **방법 B — 게임 내 설정 메뉴(⚙️)에서 입력**  
  1. 게임 화면 우측 상단의 **⚙️ (설정)** 아이콘을 클릭합니다.
  2. 하단의 **`음악 · 규칙 · 토큰`** 접힘 메뉴를 클릭하여 엽니다.
  3. **Hugging Face 토큰** 입력란에 복사한 토큰(`hf_...`)을 붙여넣습니다.  
     *(입력 즉시 브라우저 로컬 저장소에 안전하게 보관되며, 서버로 유출되지 않고 오직 ZeroGPU 추론 헤더로만 전달됩니다.)*

> [!TIP]
> 토큰을 입력하지 않거나 네트워크 오류/쿼터 소진이 발생해도, 브라우저 내장 정밀 탐색 AI(`chooseAIAction`)가 즉시 게임을 이어받아 끊김 없이 계속 플레이할 수 있습니다.

---

## 🌟 주요 특징 및 최신 개선 사항

### 1. 1,500건 심화 Rollout 파인튜닝 신경망 AI
- **모델 허브**: [`callakrsos/dalbit-yut-laya-1500`](https://huggingface.co/callakrsos/dalbit-yut-laya-1500)
- 8스레드 병렬 Rollout 시뮬레이션을 통해 수집된 1,500건의 고품질 기보와 옵션 셔플 데이터 증강 기법을 적용했습니다.
- 표준 사각(S) 보드 기준 **승률 70.0% (14승 6패)** 및 다중 클래스 Brier 점수 **0.0583**을 기록하여 정밀한 국면 판단력을 갖추었습니다.
- 자세한 실험 및 검증 수치는 [Laya 결정 모델 실험 보고서](./docs/laya-experiment.md)를 참고하세요.

### 2. 모바일 퀵 컨트롤 독 (`mobile-action-dock`)
- 모바일(390×844 등) 환경에서 윷판 바로 아래에 **윷 결과 칩**, **출발 대기 말 칩**, **이동 확정 버튼**이 즉각 노출됩니다.
- 복잡한 스크롤 없이도 한 손으로 윷을 던지고, 말을 선택하고, 착수를 확정할 수 있습니다.

### 3. 전통 한옥 노을 분위기 & 금장 시네마틱 테마
- 벡터 레이어로 섬세하게 구현된 툇마루, 가을 단풍, 은은한 등불 배경.
- 윷판 **바로 아래** 멍석에서 네 가락의 윷이 포물선을 그리며 회전하고 바운드되는 착지 애니메이션.
- 수동 조작 원칙 보존: 사용자가 **윷 결과 선택 → 말 클릭 → 경로 선택 → 금빛 목적지 클릭**으로 직접 손맛을 느끼며 말을 움직입니다.

### 4. 전략 패물 아이템전 모드
- 일반 전통전 외에도, 판 위의 복주머니 칸에 멈추면 전략 패물을 획득할 수 있습니다.
- **금줄**: 낙(멍석 이탈)을 1회 방어.
- **협문 열쇠**: 갈림길을 정차하지 않고 지나치면서도 지름길로 꺾을 수 있는 특수 열쇠.
- **방패**: 상대 말의 잡기로부터 내 말을 1회 완벽 보호.

### 5. 오리지널 국악풍 배경음악
- [**「달빛 노을 머문 툇마루」 듣기 (MP3, 80초)**](https://zaruous.github.io/dalbit-yut/audio/moonlit-porch.mp3)
- 가야금, 전통 타악기(장구, 북), 피아노, 스트링, 대금이 어우러진 서정적인 연주곡. [악기 소스 및 크레딧](public/audio/CREDITS.md)

---

## 📸 실제 브라우저 화면

| 직접 플레이 (1600×900) | 윷 던지기 4단계 연출 |
|:---:|:---:|
| ![직접 플레이 화면](./docs/images/play-desktop.webp) | ![윷 던지기 연출](./docs/images/throw-sequence.webp) |
| 윷 결과 `걸` ➔ 말 선택 ➔ 지름길 선택 ➔ 금빛 목적지 클릭 | 200ms 발사 ➔ 420ms 공중 회전 ➔ 700ms 하강 ➔ 1360ms 착지 |

| AI 4인 자동 관전 모드 | 모바일 퀵 컨트롤 독 (390×844) |
|:---:|:---:|
| ![AI 관전 화면](./docs/images/ai-spectate.webp) | <img src="./docs/images/play-mobile.webp" alt="모바일 화면" width="280"> |
| `?watch=1&players=4` 실시간 AI 대전 관전 | 윷판 바로 아래 퀵 컨트롤 독으로 쾌적한 모바일 플레이 |

- [시각화 품질 기준 및 검증 보고서](./docs/visual-quality-v1.md)
- [윷 던지기 연출 검증](./docs/throw-animation-validation.md)
- [탐색 AI 전략 알고리즘](./docs/ai-strategy.md)
- [새 맵 지형 제안 5종 갤러리](https://zaruous.github.io/dalbit-yut/map-concepts/)

---

## 📜 게임 규칙 및 조작법

1. **윷 던지기 & 결과**:
   - 도(1칸), 개(2칸), 걸(3칸), 윷(4칸 + 보너스 던지기), 모(5칸 + 보너스 던지기), 빽도(1칸 뒤로).
   - 상대의 말을 잡으면 추가로 윷을 한 번 더 던집니다.
2. **낙(멍석 밖 이탈)**:
   - 네 가락 중 하나라도 멍석 밖으로 **완전히** 나가면 해당 던지기는 무효(낙) 처리됩니다. (경계선에 걸친 가락은 유효)
   - 이전에 모아둔 윷·모 결과가 있다면 유지되며, 남은 결과로 이동할 수 있습니다.
3. **지름길 규칙**:
   - 모서리 분기점 및 중앙 칸에 **정확히 멈추었을 때만** 지름길 경로를 선택할 수 있습니다.
4. **4가지 윷판 지원**:
   - **기본 사각형판 (S, 기본값)**: 전통 29개 자리 (외곽 20 + 중앙 X자 9). [상세 분석](./docs/standard-board.md)
   - **팔각 순환형 (A)**: 외곽 순환과 내곽 십자 교차.
   - **이중 링형 (B)**: 내·외곽의 동심원 구조.
   - **나선정원형 (G)**: 4개의 협문과 복주머니가 배치된 확장형 정원 맵.

---

## 💻 로컬 개발 및 실행

**요구 사양**: Node.js 20.19+ 또는 22.12+

```bash
# 1. 저장소 클론 및 패키지 설치
git clone https://github.com/zaruous/dalbit-yut.git
cd dalbit-yut
npm install

# 2. 로컬 개발 서버 시작 (Vite)
npm run dev
```

브라우저에서 `http://localhost:5173`으로 접속합니다.

### 정적 검증 및 빌드

```bash
# TypeScript 정적 타입 검사
npm run typecheck

# 게임 엔진 단위 및 시뮬레이션 테스트 (225판 자동 검증)
npm test

# 독립 실행형 HTML 미리보기 번들 생성
npm run build:preview

# 프로덕션 배포 빌드 (dist/ 생성)
npm run build
```

---

## 🚀 배포 가이드

### Vercel 배포
이 저장소를 Vercel 프로젝트로 Import합니다.

| 설정 항목 | 설정값 |
|---|---|
| **Framework Preset** | Vite |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

### GitHub Pages 배포
`dist/` 빌드 아티팩트를 기반으로 GitHub Actions를 통해 `gh-pages` 브랜치에 자동 배포됩니다.

---

## 📂 프로젝트 구조

```text
dalbit-yut/
├── src-ts/                    # 정본 TypeScript 소스
│   ├── App.tsx                # 메인 UI, SVG 보드, 조작 인터랙션, HF Space 통신
│   ├── gameEngine.ts          # 게임 규칙, 상태 머신, 낙/잡기/업기 판정
│   ├── aiEngine.ts            # 내장 탐색 AI 알고리즘
│   ├── mapEngine.ts           # 4종 윷판 그래프 및 지름길 라우팅
│   ├── layaCandidates.ts      # 신경망 모델용 상태 벡터 변환기
│   ├── styles.css             # 기본 스타일
│   ├── theme-cinematic.css    # 시네마틱 테마 오버라이드
│   └── quality-v1.css         # 최상위 비주얼 품질 레이어 (모바일 독 등)
├── public/                    # 정적 에셋 (한옥 SVG 배경, BGM, 효과음)
├── docs/                      # 개발, 벤치마크, 시각 품질 검증 문서
├── scripts/                   # 빌드, 테스트, 데이터 수집, 벤치마크 도구
└── preview.html               # 빌드된 독립 단일 HTML
```

---

## 📄 라이선스 & 크레딧

- 코드 및 디자인: [MIT License](./LICENSE)
- 서드파티 고지 및 음원 크레딧: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) · [CREDITS.md](public/audio/CREDITS.md)
- 개발 에이전트 지침: [AGENTS.md](./AGENTS.md)
