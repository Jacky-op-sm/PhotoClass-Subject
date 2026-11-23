#!/usr/bin/env python3
"""Validate the edition, editorial coverage and reproducibility of On Being data."""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import random
import re
import subprocess
from pathlib import Path

import pymupdf

from extract_onbeing import CHAPTERS, DIGEST, OUTPUT, ROOT, SOURCE, clean, extract_chapter, raw_line

GUIDE = ROOT / "data/onbeing-guide.json"
SAMPLE_SEED = 20261123


def plain(block):
    return html.unescape(re.sub(r"</?(?:strong|em)>", "", block["html"]))


def compare_key(value):
    return "".join(ch for ch in clean(value).lower() if ch.isalnum())


def sample_pages(chapters):
    picker = random.Random(SAMPLE_SEED)
    samples = {}
    for chapter in chapters:
        start, end = chapter["printedPages"]
        samples[chapter["id"]] = sorted(picker.sample(range(start, end + 1), min(2, end-start+1)))
    return samples


def render_sample(chapters, doc, output_dir):
    if output_dir.resolve().is_relative_to(ROOT.resolve()):
        raise ValueError("Select a temporary review directory outside the repository.")
    output_dir.mkdir(parents=True, exist_ok=True)
    samples = sample_pages(chapters)
    for chapter in chapters:
        for n in samples[chapter["id"]]:
            page = doc[n-1]
            page.get_pixmap(matrix=pymupdf.Matrix(1.6, 1.6)).save(output_dir / f"p{n:02}.png")
            lines = []
            for group in page.get_text("dict")["blocks"]:
                for line in group.get("lines", []):
                    if line["bbox"][1] < 48:
                        continue
                    text = re.sub(r"^(Bill Jay:|David Hurn:)\s*", "", raw_line(line))
                    lines.append((compare_key(text), line["bbox"]))
            for block in chapter["blocks"]:
                if block["page"] != n:
                    continue
                key = compare_key(plain(block))
                # First physical line may end in a broken word. A prefix also
                # matches short headings and dialogue that fits a single line.
                hits = [(min(len(key), len(prefix)), box) for prefix, box in lines if prefix and
                        (key.startswith(prefix[:32]) or prefix.startswith(key))]
                assert hits, f"Missing paragraph start: {block['id']}"
                x, y, *_ = max(hits, key=lambda hit: hit[0])[1]
                label = {"bill": "B", "david": "D", None: "P"}[block["speaker"]] + block["id"][-3:]
                page.insert_text((max(1, x-21), y+6.5), label, fontsize=6.2,
                                 fontname="hebo", color=(.58,.02,.04))
            page.get_pixmap(matrix=pymupdf.Matrix(1.6, 1.6)).save(output_dir / f"marked-{n:02}.png")
    return samples


def validate_chapters(chapters, guide, doc):
    assert len(doc) == 97 and hashlib.sha256(SOURCE.read_bytes()).hexdigest() == DIGEST
    assert len(chapters) == len(CHAPTERS)
    all_text = []
    core_segments = 0
    for i, ((title, start, end), chapter) in enumerate(zip(CHAPTERS, chapters), 1):
        cid = f"ob-{i:02}"
        assert (chapter["id"], chapter["title"], chapter["printedPages"]) == (cid, title, [start, end])
        assert chapter == extract_chapter(doc, i, title, start, end), f"{cid} regeneration mismatch"
        assert chapter["type"] == ("reference" if i == 11 else "core")
        all_text.append(title)
        if 3 <= i <= 10:
            quote = chapter["epigraph"]
            assert quote["lines"] and quote["attribution"]
            all_text.extend(quote["lines"] + [quote["attribution"]])
        else:
            assert chapter["epigraph"] is None
        blocks = chapter["blocks"]
        previous_page = start
        for j, block in enumerate(blocks, 1):
            assert block["id"] == f"{cid}-p{j:03}"
            assert previous_page <= block["page"] <= block.get("endPage", block["page"]) <= end
            previous_page = block["page"]
            if 3 <= i <= 9:
                assert block["kind"] == "turn" and block["speaker"] in {"bill", "david"}
            else:
                assert block["kind"] == "prose" and block["speaker"] is None
            assert set(re.findall(r"<[^>]+>", block["html"])) <= {"<em>", "</em>", "<strong>", "</strong>"}
            text = plain(block)
            assert text and not re.search(r"•\s*\d+|\d+\s*•|ON BEING A PHOTOGRAPHER:", text)
            assert not re.match(r"^(Bill Jay|David Hurn):", text) and not re.search("[ﬀﬁﬂﬃﬄ]", text)
            all_text.append(text)
        segments = guide[cid]["segments"]
        assert 2 <= len(segments) <= 6
        cursor = 0
        ids = [b["id"] for b in blocks]
        for k, segment in enumerate(segments, 1):
            assert segment["id"] == f"{cid}-s{k:02}"
            assert 0 < len(segment["title"].split()) <= 8 and segment["from"] == ids[cursor]
            right = ids.index(segment["to"])
            assert cursor <= right
            assert segment["pages"] == [blocks[cursor]["page"], blocks[right].get("endPage", blocks[right]["page"])]
            cursor = right+1
        assert cursor == len(blocks)
        core_segments += len(segments) if chapter["type"] == "core" else 0
    original = subprocess.check_output(["pdftotext", "-f", "7", "-l", "97", str(SOURCE), "-"], text=True)
    expected, actual = len(original.split()), len(" ".join(all_text).split())
    difference = 100 * (actual / expected - 1)
    assert abs(difference) <= 3, f"Word count differs by {difference:+.2f}%"
    print(f"PASS: {len(chapters)} chapters, {sum(len(c['blocks']) for c in chapters)} blocks, "
          f"{core_segments} core segments; PDF {expected:,} words / output {actual:,} ({difference:+.2f}%).")
    print("PASS: ranges, types and speakers, inline markup, running heads, stable IDs, "
          "segment coverage, titles, epigraphs and deterministic regeneration.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--render-sample", type=Path, metavar="DIRECTORY")
    parser.add_argument("--preview", action="store_true", help="Print the first 15 Selecting a Subject blocks.")
    args = parser.parse_args()
    chapters = json.loads(OUTPUT.read_text())
    guide = json.loads(GUIDE.read_text())
    with pymupdf.open(SOURCE) as doc:
        validate_chapters(chapters, guide, doc)
        if args.preview:
            for block in chapters[3]["blocks"][:15]:
                name = "Bill Jay" if block["speaker"] == "bill" else "David Hurn"
                print(f"\n{block['id']} · PDF {block['page']} · {name}\n{plain(block)}")
        if args.render_sample:
            print(render_sample(chapters, doc, args.render_sample))


if __name__ == "__main__":
    main()
