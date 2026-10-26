# 로컬 Codex CLI 인계 — Windows / 달빛 윷마당

이 파일은 클라우드 대화의 작업 상태를 로컬 CLI에 전달하기 위한 인계 문서입니다. 대화 세션 자체를 `codex resume`으로 가져온 것으로 간주하지 마세요.

## 사용자 목표와 현재 요청

사용자는 달빛 윷마당 게임의 AI를 [NandhaKishorM/laya](https://github.com/NandhaKishorM/laya)로 개선할 수 있는지 시험하고 싶어 합니다. 클라우드의 가중치 CDN 접근 차단 때문에 Windows 데스크톱에서 이 작업을 이어가기로 했습니다. 로컬에서 접속 확인 → 설치 → 실제 가중치 다운로드 → 모델 추론 → 현재 탐색 AI와 비교까지 진행하세요. 설치만으로 성능이 좋아졌다고 말하면 안 됩니다.

## 저장소와 코드 상태

- 저장소: `https://github.com/zaruous/dalbit-yut.git`
- Laya 작업 시작 기준 커밋: `74fb8390fdd5d9986405575d6107ccc4a0defe7b`.
- 이 문서와 Laya 실험 코드를 함께 커밋하므로 GitHub에서 최신 코드를 clone/pull하면 바로 이어갈 수 있습니다. 이전에 받은 인계 ZIP의 `changes.patch`는 위 기준 커밋용입니다. 현재 저장소에 이 문서와 Laya 코드가 이미 있으면 패치를 중복 적용하지 마세요. 클라우드 가상환경·패키지 캐시·모델 캐시는 저장소에 포함하지 않습니다.
- `AGENTS.md`부터 읽으세요. 정식 소스는 `src-ts/`; 기존 `src/` JavaScript를 수정하지 않습니다. 사람 플레이어는 자동 이동하면 안 됩니다.
- 기존 체크아웃을 사용하고 사용자의 별도 요청 없이 Git worktree를 만들지 마세요. 기존 로컬 변경을 덮어쓰지 마세요. 패치가 맞지 않으면 기준 커밋과 차이를 확인하고 해결하며, 임의 reset이나 force push를 하지 마세요.
- 인계 패키지를 받았다는 이유로 원격 푸시가 새로 요청된 것으로 간주하지 마세요.

## 이미 완료한 게임 변경

- XXX 면 개수 0=윷, 1=도(빽도 조건 별도), 2=개, 3=걸, 4=모.
- 갈림길에 정확히 정차한 경우 지름길 기본 선택. 목적지 클릭으로 이동 확정하며 바깥길도 선택 가능.
- 시작 후 도 → 빽도는 `O1 -> O0` 출발·완주 칸으로 이동. 다음 전진 결과로 완주. 추가 빽도는 `O23`, `O22` 방향.
- `src-ts/aiEngine.ts`의 탐색 AI: 완주 거리, 잡기, 업기, 잡힐 위험, 보유 결과 최대 세 번의 이동을 고려.
- 이 탐색 AI는 예전 고정 점수 AI와 별도 시드 400판에서 249승(62.25%). **이 수치는 Laya의 성능이 아닙니다.** 상세는 `docs/ai-strategy.md`.

## Laya 실험 구현

Laya는 문장 생성 LLM이 아니라 고정 후보를 선택하는 비생성형 결정 모델입니다.

- `requirements-laya.txt`: Python 선택 의존성 버전.
- `scripts/setup-laya.sh`: Linux x86_64 CPU용 설치. **Windows에서 검증한 설치 스크립트가 아닙니다.**
- `scripts/laya-worker.py`: 실제 Laya CPU 추론 JSONL worker. `--check-install`은 패키지 import만 확인하며 가중치는 로드하지 않습니다.
- `scripts/laya-client.cjs`: 게임이 만든 최대 4개 합법 후보 중 선택. 기존 AI 추천 포함. 잘못된 응답·잘린 입력·5초 초과 시 기존 AI로 복귀하며 별도 집계.
- `scripts/benchmark-laya.cjs`: Laya 후보 선택과 현재 탐색 AI의 맵 A/B·선후공 교대 대전. 최초 로딩 실패는 실험 실패 처리.
- `test-laya.cjs`: 7개 연결 테스트. 통신/오류 경로의 모델 응답은 테스트용이며 실제 추론 검증이 아닙니다.
- `docs/laya-experiment.md`: 상세와 한계.
- 브라우저 기본 AI는 여전히 탐색 AI입니다. Laya는 아직 웹 앱에 연결하지 않은 선택 실험 도구입니다. 정적 Vercel 앱에서 Python을 직접 실행할 수 없습니다.

## 클라우드에서 확인한 사실

- Python 3.12.14에 Laya 0.4.15, torch 2.14.1+cpu, transformers 5.20.2를 설치하고 import 확인. 가상환경 경로는 `/workspace/.venvs/laya`였으며 Windows에 이 경로를 사용하면 안 됩니다.
- 기본 게임 150판, 새 탐색 AI 2~4인 24판, 연결 테스트 7개, TypeScript 검사와 Vite 빌드 통과.
- `huggingface.co`는 처음 차단되었으나 마지막 확인에서 모델 API HTTP 200, 설정/토크나이저 4개 파일 다운로드 성공.
- 모델: `convaiinnovations/laya`, 고정 리비전 `7b928d828b7b0e022f929d9bd2e44165aa270148`.
- `model.safetensors` 크기 842,609,210바이트. **가중치 다운로드는 실패했습니다. 체크섬 검증·실제 모델 추론·성능 비교는 미완료입니다.**
- SDK는 `cas-server.xethub.hf.co` 요청에서 실패했고, 공식 resolve URL은 `us.aws.cdn.hf.co`로 연결되며 프록시 CONNECT HTTP 403이었습니다.
- 클라우드 설정 초안에는 `huggingface.co`, `cas-server.xethub.hf.co`, `us.aws.cdn.hf.co`를 추가했습니다. 로컬 Windows가 이 클라우드 프록시/설정을 사용한다고 가정하지 마세요.

## Windows에서 이어갈 순서

아래는 PowerShell용 시작 예시이며 Windows에서 실제 실행·검증해야 합니다. 기존 Python/Node/Git 및 GPU 상태를 먼저 확인하고 지원되는 설치를 선택하세요. CPU부터 시작할 수 있습니다. NVIDIA GPU가 필수는 아닙니다.

```powershell
git status --short
node --version
py --list
Get-Command nvidia-smi -ErrorAction SilentlyContinue

# 실제 다운로드 경로 확인: 설정 파일과 가중치 첫 1MB만 확인
curl.exe -L --fail --max-time 30 -o NUL -w "`nHTTP %{http_code}`n" "https://huggingface.co/convaiinnovations/laya/resolve/main/rl_agent_config.json"
curl.exe -L --fail --range 0-1048575 --max-filesize 2097152 --max-time 60 -o NUL -w "`nHTTP %{http_code}, %{size_download} bytes`n" "https://huggingface.co/convaiinnovations/laya/resolve/7b928d828b7b0e022f929d9bd2e44165aa270148/model.safetensors"

# py --list에 3.12가 있는 경우. 없다면 설치된 지원 버전을 확인해 조정.
py -3.12 -m venv .venv-laya
.\.venv-laya\Scripts\python.exe -m pip install --index-url https://download.pytorch.org/whl/cpu "torch==2.14.1+cpu"
.\.venv-laya\Scripts\python.exe -m pip install -r requirements-laya.txt
$env:LAYA_PYTHON = (Resolve-Path .\.venv-laya\Scripts\python.exe).Path
$env:LAYA_MODEL_REVISION = "7b928d828b7b0e022f929d9bd2e44165aa270148"
& $env:LAYA_PYTHON scripts/laya-worker.py --check-install

npm install --package-lock=false
npm run test:laya
npm run build

# 가중치 네트워크 접근이 정상이라면 최초 4판 실험(다운로드와 초기 로딩 포함)
node scripts/benchmark-laya.cjs 1 200
```

TLS·패키지 서명·모델 체크섬 검증을 끄지 마세요. Hugging Face 메타데이터에서 받은 LFS SHA-256과 실제 전체 가중치 파일의 해시를 확인하세요. 네트워크 오류와 인증 오류를 구별하고 공개 모델에 토큰이 필요하다고 가정하지 마세요. 비밀 값을 채팅에 요청하거나 출력하지 마세요.

실제 모델 선택 횟수(`laya`), 강제 수(`forced`), 기존 AI 복귀 횟수(`fallback`), 승률, 지연 시간을 구분해 보고하세요. 모델 로딩 실패나 전부 fallback인 실행을 Laya 성능 검증으로 보고하면 안 됩니다. 최초 4판은 실행 smoke test이며 성능 향상 근거로 충분하지 않습니다. 충분한 별도 시드 비교를 통과하기 전에는 기본 AI 교체나 강화 완료를 주장하지 마세요.

## 로컬 CLI에 줄 요청

> `docs/LOCAL_CLI_HANDOFF.md`와 `AGENTS.md`를 읽고, Windows에서 Laya 가중치 다운로드·실제 추론·현재 AI와의 비교 실험을 이어서 진행해 줘. 모델이 실제로 동작하는지와 승률/응답 속도가 개선되는지 검증하고, 확인된 결과에 따라 다음 구현을 진행해 줘.
