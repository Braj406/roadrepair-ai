"""Download the road damage model into ai-service/models/road-damage.pt.

Default: TamAko783/YOLO26s_RDD_Base on Hugging Face, a YOLO26s model trained on RDD2022
with the four classes D00 (longitudinal), D10 (transverse), D20 (alligator), D40 (pothole).
License: AGPL-3.0. Pass --repo and --file to use a different model.

Note: .pt files are Python pickles and can run code when loaded. Only use models you trust.

Usage:
    .venv/bin/python scripts/download_model.py
"""

import argparse
import hashlib
import shutil
from pathlib import Path

from huggingface_hub import hf_hub_download

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--repo", default="TamAko783/YOLO26s_RDD_Base")
    parser.add_argument("--file", default="YOLO26s_RDD_Base.pt")
    args = parser.parse_args()

    MODELS_DIR.mkdir(exist_ok=True)
    cached = hf_hub_download(args.repo, args.file)
    target = MODELS_DIR / "road-damage.pt"
    shutil.copyfile(cached, target)
    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    print(f"Saved {args.repo}/{args.file} -> {target}")
    print(f"SHA-256 {digest}")


if __name__ == "__main__":
    main()
