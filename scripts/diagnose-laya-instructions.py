"""Paired prompt diagnostic on fixed states; accuracy is teacher agreement, not win rate."""
import argparse
import json
import time
from pathlib import Path

import laya
import torch


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--data", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--limit", type=int, default=100)
    args = parser.parse_args()
    if args.limit < 1:
        parser.error("limit must be positive")
    torch.set_num_threads(4)
    agent = laya.load(args.model, device="cuda")
    rows = [json.loads(line) for line in Path(args.data).read_text(encoding="utf-8").splitlines()][:args.limit]
    instructions = {
        "legacy": "Choose the Yutnori move most likely to win: finish all four pieces, capture enemies for extra throws, use shortcuts and avoid losing valuable stacks.",
        "training": "Choose the legal Yutnori move with the highest long-term probability of winning.",
    }
    report = {"model": args.model, "data": args.data, "items": len(rows), "results": {}, "note": "Teacher agreement diagnostic, not an independent win-rate evaluation."}
    predictions = {}
    for name, instruction in instructions.items():
        correct = truncated = 0
        predictions[name] = []
        start = time.perf_counter()
        for row in rows:
            question = dict(row["questions"]["move"], instructions=instruction)
            with torch.inference_mode():
                result = agent.predict(row["state"], {"move": question}, max_len=1024, head_max_len=512)
            usage = result.get("usage", {})
            if usage.get("truncated") or usage.get("options"):
                truncated += 1
                choice = None
            else:
                choice = result["answers"]["move"].get("choice")
            predictions[name].append(choice)
            correct += choice == row["expected"]["move"]
        report["results"][name] = {"correct": correct, "truncated": truncated, "accuracy": correct / len(rows), "seconds": time.perf_counter() - start}
        print(json.dumps({name: report["results"][name]}), flush=True)
    report["changed_choices"] = sum(a != b for a, b in zip(predictions["legacy"], predictions["training"]))
    Path(args.out).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
