# Laya 결정 모델 실험

대상은 [NandhaKishorM/laya](https://github.com/NandhaKishorM/laya)입니다. Laya는 고정 선택지를 분류하는 비생성형 결정 모델이며, 윷놀이에 특화된 학습 모델은 아닙니다. 설치만으로 기존 전략 AI보다 강해진다고 가정하지 않습니다.

## 현재 확인한 범위

- Laya 0.4.15, PyTorch 2.14.1+cpu, Transformers 5.20.2를 Python 3.12 환경에 설치하고 실제 가져오기를 확인했습니다. CPU는 4개 스레드로 제한합니다.
- 게임의 합법 수 목록을 모델 선택지로 바꾸는 연결, 실제 자식 프로세스 JSONL 통신, 잘못된 응답·프로세스 종료·시간 초과·입력 잘림 시 기존 AI 복귀를 7개 테스트로 확인했습니다. 이 통신 테스트의 모델 응답은 테스트용입니다.
- 실제 체크포인트 로딩은 아직 성공하지 못했습니다. 재확인 시 `huggingface.co`는 HTTP 200으로 응답했고 설정·토크나이저 4개 파일은 내려받았습니다. 그러나 리비전 `7b928d828b7b0e022f929d9bd2e44165aa270148`의 842,609,210바이트 `model.safetensors`는 전송되지 않았습니다. SDK의 `cas-server.xethub.hf.co` 요청이 실패했고, 공식 다운로드 URL이 연결되는 `us.aws.cdn.hf.co`는 프록시 CONNECT HTTP 403으로 차단되었습니다. 모델 추론이나 승률 개선은 검증되지 않았습니다.
- 브라우저의 기본 AI는 기존 `chooseAIAction`입니다. 이 변경은 별도 CPU 실험 도구이며, 웹 앱에 Python 서버를 필수로 추가하지 않습니다.

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

첫 번째 인자는 맵·좌석별 시드 수, 두 번째는 시드 오프셋입니다. 이후 별도 시드로 충분한 대전을 실행해 현재 탐색 AI와 비교해야 합니다. 상대는 예전 무작위 점수 AI가 아니라 현재 `chooseAIAction`입니다. 양쪽의 윷은 같은 확률이며, 시드별 좌석 교대에서 같은 좌석별 난수 스트림을 사용합니다. 낙은 이 비교에서 제외합니다.

`LAYA_MODEL`로 로컬 체크포인트 디렉터리나 공개 모델 ID를 지정할 수 있습니다. 기본은 영어 `convaiinnovations/laya`이며 선택지·상태는 영어로 전달합니다. `LAYA_MODEL_REVISION`을 커밋 SHA로 지정하면 해당 리비전으로 고정합니다. 로딩 성공 응답과 결과 보고서에도 SDK가 식별한 리비전을 기록합니다.

## 선택과 실패 처리

게임 엔진이 합법 수를 계산하며 기존 AI의 추천을 반드시 포함한 최대 4개 후보를 Laya에 전달합니다. 나머지는 즉시 완주·잡기·업기·지름길의 이득으로 추립니다. 따라서 아직 전체 합법 수를 모두 비교하는 모델은 아닙니다. 후보의 첫 위치에 기존 추천이 항상 놓이지 않도록 차례별로 순환시킵니다. 실제 미래의 윷 난수는 모델에 제공하지 않습니다.

입력은 공개된 말 위치·보유 결과·후보의 실제 이동 결과입니다. 모델이 게임 상태를 직접 수정하지 않습니다. 선택지에 없는 응답, 추론 오류, 입력 잘림 또는 5초 초과 시 해당 판단을 기존 AI로 돌리고 `fallback`으로 집계합니다. 하나의 후보만 있으면 모델을 호출하지 않고 `forced`로 집계합니다. 시작할 때 체크포인트를 로드하지 못하면 비교 자체를 실패 처리합니다.

결과에는 모델이 실제 선택한 횟수, 강제 수, 복귀 횟수·이유, 추론 시간과 승패가 구분됩니다. 복귀가 섞인 승률을 순수 Laya의 성능으로 해석하면 안 됩니다. 모델의 일반 confidence는 윷놀이 승률로 보정한 값이 아니므로 강한 수를 보장하는 기준으로 사용하지 않습니다.

이 실험이 승률·지연 시간에서 유용하다고 확인되면 웹 배포용 연결을 별도로 구현할 수 있습니다. 현재 정적 Vite/Vercel 앱에서 Python 프로세스를 직접 실행할 수는 없습니다. 브라우저용 Laya ONNX 런타임은 모델 변환·다운로드 크기·모바일 실행 비용을 따로 검증해야 합니다.
