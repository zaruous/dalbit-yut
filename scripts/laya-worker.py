"""Local JSONL decision worker. Model startup must succeed before benchmarking."""
import argparse
import contextlib
import importlib.metadata
import json
import os
import sys
import time


def emit(value):
    print(json.dumps(value), flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check-install", action="store_true")
    args = parser.parse_args()
    # Keep all library output away from the stdout JSONL protocol.
    with contextlib.redirect_stdout(sys.stderr):
        import laya
        import torch
        torch.set_num_threads(4)
        torch.set_num_interop_threads(1)
    requested_device = os.environ.get("LAYA_DEVICE", "cpu").lower()
    if requested_device == "auto":
        device = "cuda" if torch.cuda.is_available() else "cpu"
    elif requested_device in ("cpu", "cuda"):
        device = requested_device
    else:
        emit({"error": "invalid_device", "device": requested_device})
        return 1
    if device == "cuda" and not torch.cuda.is_available():
        emit({"error": "cuda_unavailable", "device": device})
        return 1
    versions = {name: importlib.metadata.version(name) for name in ("laya", "torch", "transformers")}
    max_len = int(os.environ.get("LAYA_MAX_LEN", "512"))
    head_max_len = int(os.environ.get("LAYA_HEAD_MAX_LEN", "256"))
    if max_len < 128 or head_max_len < 64 or head_max_len > max_len:
        emit({"error": "invalid_token_limits"})
        return 1
    if args.check_install:
        emit({"installed": versions, "device": device, "model_loaded": False})
        return 0
    try:
        with contextlib.redirect_stdout(sys.stderr):
            agent = laya.load(
                os.environ.get("LAYA_MODEL", "convaiinnovations/laya"),
                revision=os.environ.get("LAYA_MODEL_REVISION") or None,
                device=device,
            )
    except Exception as exc:
        # Do not print proxy credentials, HTTP headers or signed download URLs.
        emit({"error": "model_load_failed", "exception": type(exc).__name__})
        return 1
    emit({"ready": True, "versions": versions, "revision": agent.revision, "device": device,
          "max_len": max_len, "head_max_len": head_max_len})
    for line in sys.stdin:
        request_id = None
        try:
            request = json.loads(line)
            request_id = request["id"]
            criteria = request["criteria"]
            state = request["state"]
            if not isinstance(state, str) or len(state) > 16384:
                raise ValueError("invalid state")
            if not isinstance(criteria, dict) or not 2 <= len(criteria) <= 4:
                raise ValueError("expected two to four legal candidates")
            if any(not isinstance(k, str) or not isinstance(v, str) or len(v) > 2000 for k, v in criteria.items()):
                raise ValueError("invalid criteria")
            started = time.perf_counter()
            with contextlib.redirect_stdout(sys.stderr), torch.inference_mode():
                result = agent.predict(state, {"move": {
                    "type": "choice",
                    "instructions": "Choose the Yutnori move most likely to win: finish all four pieces, capture enemies for extra throws, use shortcuts and avoid losing valuable stacks.",
                    "criteria": criteria,
                }}, max_len=max_len, head_max_len=head_max_len)
            usage = result.get("usage", {})
            if usage.get("truncated") or usage.get("options"):
                emit({"id": request_id, "error": "truncated_model_input"})
                continue
            answer = result["answers"]["move"]
            choice = answer.get("choice")
            if choice not in criteria:
                raise ValueError("illegal model choice")
            emit({"id": request_id, "choice": choice,
                  "confidence": answer.get("answer_confidence"),
                  "elapsedMs": (time.perf_counter() - started) * 1000})
        except Exception as exc:
            emit({"id": request_id, "error": "decision_failed", "exception": type(exc).__name__})
    return 0


if __name__ == "__main__":
    sys.exit(main())
