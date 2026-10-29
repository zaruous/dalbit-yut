#!/usr/bin/env python3
"""
Upload the fine-tuned Dalbit-Yut Laya model to Hugging Face Hub.
Usage:
    .venv-laya\Scripts\python.exe scripts/upload-to-hf.py --repo-id <username>/dalbit-yut-laya-1500
"""

import os
import sys
import argparse
from pathlib import Path
from huggingface_hub import HfApi, create_repo

def main():
    parser = argparse.ArgumentParser(description="Upload Laya model to Hugging Face Hub")
    parser.add_argument("--repo-id", type=str, required=True, help="HF repo id, e.g. 'your-username/dalbit-yut-laya-1500'")
    parser.add_argument("--token", type=str, default=None, help="Hugging Face write token (optional if logged in or HF_TOKEN is set)")
    parser.add_argument("--model-dir", type=str, default="laya-data/checkpoint-rollout-1500", help="Path to model directory")
    parser.add_argument("--private", action="store_true", help="Set repository to private")

    args = parser.parse_args()

    token = args.token or os.environ.get("HF_TOKEN")
    if not token:
        # Prompt user if not provided
        import getpass
        print("Tip: You can get your Hugging Face write token from: https://huggingface.co/settings/tokens")
        token = getpass.getpass("Enter Hugging Face Token: ").strip()

    model_path = Path(args.model_dir).resolve()
    if not model_path.exists():
        print(f"Error: Model path does not exist: {model_path}")
        sys.exit(1)

    print(f"\n[1/3] Checking / Creating Hugging Face repository '{args.repo_id}'...")
    api = HfApi(token=token)
    try:
        repo_url = create_repo(
            repo_id=args.repo_id,
            repo_type="model",
            token=token,
            private=args.private,
            exist_ok=True
        )
        print(f"  Repository ready: {repo_url}")
    except Exception as e:
        print(f"  Error creating repo: {e}")
        sys.exit(1)

    print(f"\n[2/3] Preparing files from: {model_path}")
    print("  Excluding redundant 'checkpoint_latest/**' duplicate weights...")

    print(f"\n[3/3] Uploading to Hugging Face Hub (this may take 1-3 minutes for 842MB)...")
    try:
        api.upload_folder(
            folder_path=str(model_path),
            repo_id=args.repo_id,
            repo_type="model",
            token=token,
            ignore_patterns=["checkpoint_latest/**", "*.tmp", "__pycache__/**"],
            commit_message="Initial release of fine-tuned Yutnori Laya decision model (1500 rollout)"
        )
        print(f"\n Upload completed successfully!")
        print(f" Model Page: https://huggingface.co/{args.repo_id}\n")
    except Exception as e:
        print(f"\n Upload failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
