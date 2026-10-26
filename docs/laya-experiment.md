# Laya 결정 모델 실험

대상은 [NandhaKishorM/laya](https://github.com/NandhaKishorM/laya)입니다. Laya는 고정 선택지를 분류하는 비생성형 결정 모델이며, 윷놀이에 특화된 학습 모델은 아닙니다. 설치만으로 기존 전략 AI보다 강해진다고 가정하지 않습니다.

## 현재 확인한 범위

- Windows의 Python 3.12 환경에서 Laya 0.4.15와 Transformers 5.20.2를 설치하고 실제 가져오기를 확인했습니다. CPU 실행은 PyTorch 2.14.1+cpu와 4개 스레드로, GPU 비교는 PyTorch 2.14.1+cu130과 RTX 4050 Laptop GPU로 확인했습니다.
- 게임의 합법 수 목록을 모델 선택지로 바꾸는 연결, 실제 자식 프로세스 JSONL 통신, 잘못된 응답·프로세스 종료·시간 초과·입력 잘림 시 기존 AI 복귀를 7개 테스트로 확인했습니다. 이 통신 테스트의 모델 응답은 테스트용입니다.
- 리비전 `7b928d828b7b0e022f929d9bd2e44165aa270148`의 842,609,210바이트 `model.safetensors`를 내려받아 실제 로드했습니다. 로컬 SHA-256 `891102d372688fc2a094dac56a384bc537b87c63f21f9f3dac0be2b7cbc8d86c`은 Hugging Face LFS 메타데이터와 일치합니다.
- 별도 시드 25개, 두 맵, 선후공 교대의 100판에서 Laya는 현재 탐색 AI에 21승 79패였습니다. 실제 Laya 선택 1,693회, 강제 수 426회, fallback 0회였고 GPU 평균 추론 시간은 선택당 80.5ms였습니다. 승률 21%의 Wilson 95% 구간은 14.2%~30.0%이며, 50%를 기준으로 한 단측 이항확률은 약 2.17e-9입니다. 현재 후보·상태 표현에서는 Laya가 성능을 개선하지 않으므로 기본 AI로 채택하지 않습니다.
- 2차 실험(`LAYA_INPUT_VERSION=v2`)에서는 전체 하우스 룰과 현재 맵 경로, 각 말의 node/lane·최근 경로, 후보 적용 후 전체 위치·남은 결과·턴, 최단 완주 거리, 상대의 한 번 던지기 도달 확률을 제공했습니다. 새 시드 25개로 치른 100판에서 11승 89패, 실제 선택 1,866회, 강제 수 457회, fallback 0회, GPU 평균 90.8ms였습니다. 승률의 Wilson 95% 구간은 6.3%~18.6%입니다.
- 시드 차이를 통제하기 위해 같은 2차 실험 시드에서 기존 축약 입력(`v1`)도 다시 실행했고 14승 86패였습니다. v1과 v2의 3%p 차이는 이 표본에서 유의한 차이로 볼 수 없습니다(독립 비율 근사 양측 p≈0.52). 규칙·상태 누락만으로 1차 열세를 설명한다는 가설은 지지되지 않았고, 두 입력 모두 기존 탐색 AI보다 크게 약했습니다.
- CPU smoke test에서는 성공한 21회 추론의 평균이 2.44초였고 한 번의 5초 제한 초과 뒤 worker가 종료되어 48회가 fallback됐습니다. 이 4판 결과는 승률 근거에서 제외했습니다.
- 체크포인트가 범위 밖 temperature 값을 포함해 Laya가 0.5로 보정한다는 경고가 있으므로 confidence는 평가에 사용하지 않았습니다.
- 브라우저의 기본 AI는 기존 `chooseAIAction`입니다. 이 변경은 별도 로컬 실험 도구이며, 웹 앱에 Python 서버를 필수로 추가하지 않습니다.

## 설치

Linux x86_64 CPU용으로 검증한 명령입니다. 다른 플랫폼에는 해당 플랫폼의 공식 PyTorch 빌드를 선택해야 합니다.

```bash
bash scripts/setup-laya.sh
export LAYA_PYTHON="$PWD/.venv-laya/bin/python"
npm run test:laya
```

이 클라우드 환경에서는 저장소 밖의 가상환경을 사용합니다.

```bash
LAYA_VENV=/workspace/.venvs/laya UV_CACHE_DIR=/workspace/.uv-cache bash scripts/setup-laya.sh
export LAYA_PYTHON=/workspace/.venvs/laya/bin/python
export HF_HOME=/workspace/.cache/huggingface
```

설치 스크립트는 가중치를 받거나 학습하지 않습니다. CPU PyTorch를 공식 CPU 인덱스에서 먼저 설치하며 나머지는 PyPI에서 설치합니다. 패키지와 TLS 검증을 비활성화하지 않습니다.

## 실제 모델 비교

공개 체크포인트 다운로드에는 `huggingface.co`와 실제 가중치 전송 호스트 접근이 필요합니다. 현재 확인된 `huggingface.co`, `cas-server.xethub.hf.co`, `us.aws.cdn.hf.co` 허용 초안을 환경 설정에 저장했습니다. 이후 다른 전송 목적지에서 추가 차단이 발생하면 실제 목적지를 확인한 뒤 그 도메인만 추가해야 합니다. 토큰이 필요한 것으로 확인된 상태는 아닙니다.

```bash
# 컴파일된 엔진 생성 및 기본 회귀 검사
npm test
# 최초에는 1개 시드 × 두 맵 × 선후공 = 4판으로 모델 실행부터 확인
LAYA_PYTHON=/workspace/.venvs/laya/bin/python \
  HF_HOME=/workspace/.cache/huggingface \
  node scripts/benchmark-laya.cjs 1 200
```

Windows에서 CUDA 빌드가 설치되어 있고 `torch.cuda.is_available()`가 참이면 다음처럼 GPU를 선택할 수 있습니다. 첫 인자는 맵·좌석별 시드 수이므로 아래 명령은 100판입니다.

```powershell
$env:LAYA_PYTHON = (Resolve-Path .\.venv-laya\Scripts\python.exe).Path
$env:LAYA_MODEL_REVISION = "7b928d828b7b0e022f929d9bd2e44165aa270148"
$env:LAYA_DEVICE = "cuda"
$env:LAYA_DECISION_MS = "15000"
node scripts/benchmark-laya.cjs 25 1000
```

`LAYA_DEVICE`는 기본 `cpu`이며 `cpu`, `cuda`, `auto`를 지원합니다. `LAYA_STARTUP_MS`와 `LAYA_DECISION_MS`로 worker 시작 및 개별 판단 제한 시간을 밀리초 단위로 조정할 수 있습니다.

2차 상세 입력은 다음 설정으로 재현합니다. `v1`의 기본 토큰 제한은 각각 512/256입니다.

```powershell
$env:LAYA_INPUT_VERSION = "v2"
$env:LAYA_MAX_LEN = "2048"
$env:LAYA_HEAD_MAX_LEN = "512"
node scripts/benchmark-laya.cjs 25 4000
```

첫 번째 인자는 맵·좌석별 시드 수, 두 번째는 시드 오프셋입니다. 이후 별도 시드로 충분한 대전을 실행해 현재 탐색 AI와 비교해야 합니다. 상대는 예전 무작위 점수 AI가 아니라 현재 `chooseAIAction`입니다. 양쪽의 윷은 같은 확률이며, 시드별 좌석 교대에서 같은 좌석별 난수 스트림을 사용합니다. 낙은 이 비교에서 제외합니다.

`LAYA_MODEL`로 로컬 체크포인트 디렉터리나 공개 모델 ID를 지정할 수 있습니다. 기본은 영어 `convaiinnovations/laya`이며 선택지·상태는 영어로 전달합니다. `LAYA_MODEL_REVISION`을 커밋 SHA로 지정하면 해당 리비전으로 고정합니다. 로딩 성공 응답과 결과 보고서에도 SDK가 식별한 리비전을 기록합니다.

## 선택과 실패 처리

게임 엔진이 합법 수를 계산하며 기존 AI의 추천을 반드시 포함한 최대 4개 후보를 Laya에 전달합니다. 나머지는 즉시 완주·잡기·업기·지름길의 이득으로 추립니다. 따라서 아직 전체 합법 수를 모두 비교하는 모델은 아닙니다. 후보의 첫 위치에 기존 추천이 항상 놓이지 않도록 차례별로 순환시킵니다. 실제 미래의 윷 난수는 모델에 제공하지 않습니다.

`v1` 입력은 공개된 말 위치·보유 결과·후보의 실제 이동 결과입니다. `v2`는 여기에 전체 규칙, 정확한 경로 상태와 후보 이후 결과·위험 정보를 추가합니다. 모델이 게임 상태를 직접 수정하지 않습니다. 선택지에 없는 응답, 추론 오류, 입력 잘림 또는 설정한 판단 제한 초과 시 해당 판단을 기존 AI로 돌리고 `fallback`으로 집계합니다. 하나의 후보만 있으면 모델을 호출하지 않고 `forced`로 집계합니다. 시작할 때 체크포인트를 로드하지 못하면 비교 자체를 실패 처리합니다.

결과에는 모델이 실제 선택한 횟수, 강제 수, 복귀 횟수·이유, 추론 시간과 승패가 구분됩니다. 복귀가 섞인 승률을 순수 Laya의 성능으로 해석하면 안 됩니다. 모델의 일반 confidence는 윷놀이 승률로 보정한 값이 아니므로 강한 수를 보장하는 기준으로 사용하지 않습니다.

이 실험이 승률·지연 시간에서 유용하다고 확인되면 웹 배포용 연결을 별도로 구현할 수 있습니다. 현재 정적 Vite/Vercel 앱에서 Python 프로세스를 직접 실행할 수는 없습니다. 브라우저용 Laya ONNX 런타임은 모델 변환·다운로드 크기·모바일 실행 비용을 따로 검증해야 합니다.
