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
    versions = {name: importlib.metadata.version(name) for name in ("laya", "torch", "transformers")}
    if args.check_install:
        emit({"installed": versions, "device": "cpu", "model_loaded": False})
        return 0
    try:
        with contextlib.redirect_stdout(sys.stderr):
            agent = laya.load(
                os.environ.get("LAYA_MODEL", "convaiinnovations/laya"),
                revision=os.environ.get("LAYA_MODEL_REVISION") or None,
                device="cpu",
            )
    except Exception as exc:
        # Do not print proxy credentials, HTTP headers or signed download URLs.
        emit({"error": "model_load_failed", "exception": type(exc).__name__})
        return 1
    emit({"ready": True, "versions": versions, "revision": agent.revision, "device": "cpu"})
    for line in sys.stdin:
        request_id = None
        try:
            request = json.loads(line)
            request_id = request["id"]
            criteria = request["criteria"]
            state = request["state"]
            if not isinstance(state, str) or len(state) > 8192:
                raise ValueError("invalid state")
            if not isinstance(criteria, dict) or not 2 <= len(criteria) <= 4:
                raise ValueError("expected two to four legal candidates")
            if any(not isinstance(k, str) or not isinstance(v, str) or len(v) > 500 for k, v in criteria.items()):
                raise ValueError("invalid criteria")
            started = time.perf_counter()
            with contextlib.redirect_stdout(sys.stderr), torch.inference_mode():
                result = agent.predict(state, {"move": {
                    "type": "choice",
                    "instructions": "Choose the Yutnori move most likely to win: finish all four pieces, capture enemies for extra throws, use shortcuts and avoid losing valuable stacks.",
                    "criteria": criteria,
                }}, max_len=512, head_max_len=256)
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
