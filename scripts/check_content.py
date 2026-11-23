#!/usr/bin/env python3
"""Validate one source edition and its editorial cross-references."""
import argparse
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def check_recommendations():
    assignments = json.loads((ROOT / "content/playbook/assignments.json").read_text())
    chapters = json.loads((ROOT / "content/onbeing/chapters.json").read_text())
    guide = json.loads((ROOT / "data/onbeing-guide.json").read_text())
    assignment_ids = {entry["id"] for entry in assignments}
    assert set(guide) == {chapter["id"] for chapter in chapters}
    count = 0
    for chapter, entry in guide.items():
        recommendations = entry["tryNext"]
        ids = {item["assignment"] for item in recommendations}
        assert 2 <= len(recommendations) <= 4, chapter
        assert len(ids) == len(recommendations) and ids <= assignment_ids, chapter
        assert all(1 <= len(item["why"].split()) <= 20 for item in recommendations), chapter
        count += len(recommendations)
    print(f"PASS: {count} recommendations across {len(guide)} chapters.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("book", choices=("onbeing", "playbook"))
    args, extra = parser.parse_known_args()
    checker = Path(__file__).with_name(f"check_{args.book}.py")
    subprocess.run([sys.executable, "-B", str(checker), *extra], check=True)
    if args.book == "playbook":
        check_recommendations()


if __name__ == "__main__":
    main()
