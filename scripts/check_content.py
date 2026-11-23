#!/usr/bin/env python3
"""Run the edition-specific validation for one book from any directory."""
import argparse
from pathlib import Path
import subprocess
import sys

parser = argparse.ArgumentParser()
parser.add_argument("book", choices=("onbeing", "playbook"))
args, extra = parser.parse_known_args()
subprocess.run([sys.executable, str(Path(__file__).with_name(f"check_{args.book}.py")), *extra], check=True)
