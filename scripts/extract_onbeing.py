#!/usr/bin/env python3
"""Reconstruct the two-column essays and single-column dialogue from the third edition."""
from __future__ import annotations

import hashlib
import html
import json
import re
import unicodedata
from collections import Counter
from itertools import groupby
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "source/on-being-a-photographer.pdf"
OUTPUT = ROOT / "content/onbeing/chapters.json"
DIGEST = "8ad990a20c3c3d4a8db7b66b19ff17a824a85644a47951b998d87935f93b8298"
CHAPTERS = [
    ("Introduction", 7, 7),
    ("About the Photographer: David Hurn", 8, 22),
    ("Some Definitions", 23, 27),
    ("Selecting a Subject", 28, 36),
    ("Shooting the Single Picture", 37, 46),
    ("Creating Contacts", 47, 54),
    ("The Picture Essay", 55, 61),
    ("Cameras, Shoes and Other Essentials", 62, 71),
    ("The Future of Photography", 72, 83),
    ("Some Photographic Myths", 84, 95),
    ("About the Authors", 96, 97),
]
# Verified continuations at column/page breaks of this edition. Capitalized
# names and quoted sentences make punctuation-only inference unreliable.
JOIN_COLUMNS = {7, 8, 9, 12, 13, 14, 16, 17, 19, 20, 21, 22}
JOIN_START_PAGES = {9, 10, 14, 15, 16, 19, 20, 24, 33, 34, 35, 40, 41,
                    42, 43, 44, 52, 54, 58, 59, 60, 61, 63, 64, 67, 70, 71,
                    73, 81, 82, 92, 93}
# Hard hyphens that coincide with a line ending. Remaining line-end hyphens
# split ordinary words (e.g. "photog-" / "rapher").
HARD_PREFIXES = {"cartier", "bum", "camera-in", "color", "cross", "four", "image",
                 "medium", "multi", "old", "ready", "single", "step-by", "stripped"}


def clean(text):
    text = re.sub(r"([ﬀﬁﬂﬃﬄ]) (?=[a-z])", r"\1", text)
    return re.sub(r"[ﬀﬁﬂﬃﬄ]", lambda m: unicodedata.normalize("NFKC", m[0]), text)


def raw_line(line):
    return "".join(span["text"] for span in line["spans"]).strip()


def line_style(line):
    spans = line["spans"]
    if all("Titling" in s["font"] for s in spans):
        return "subheading"
    if all("BoldItalic" in s["font"] and s["size"] >= 11.9 for s in spans):
        return "myth"
    return "body"


def speaker_for(lines):
    weight = Counter()
    for line in lines:
        for span in line["spans"]:
            family = "bill" if "Futura" in span["font"] else "david"
            weight[family] += len(span["text"].strip())
    return weight.most_common(1)[0][0]


def fragment(line, style, speaker):
    result = []
    for span in line["spans"]:
        text = clean(span["text"])
        if speaker and span["size"] >= 11.9:
            prefix = re.match(r"\s*(Bill Jay|David Hurn)\s*:\s*", text)
            if prefix:
                expected = "bill" if prefix[1] == "Bill Jay" else "david"
                assert speaker == expected
                text = text[prefix.end():]
        font = span["font"]
        if style in {"subheading", "myth"} or "Bold" in font or font.endswith("-Md"):
            tag = "strong"
        elif ("Italic" in font and "Futura" not in font) or font.endswith("-It"):
            tag = "em"
        elif speaker == "bill" and font.endswith("Light"):
            tag = "em"
        else:
            tag = None
        result.extend((c, tag) for c in text)
    while result and result[-1][0].isspace():
        result.pop()
    while result and result[0][0].isspace():
        result.pop(0)
    return result


def append_line(chars, new_chars):
    if not new_chars:
        return
    if chars:
        last_word = "".join(c for c, _ in chars).rsplit(None, 1)[-1]
        if last_word.endswith("-"):
            if last_word[:-1].strip("“‘(").lower() not in HARD_PREFIXES:
                chars.pop()
        else:
            chars.append((" ", chars[-1][1] if chars[-1][1] == new_chars[0][1] else None))
    chars.extend(new_chars)


def encode(chars):
    runs = []
    for tag, grouped in groupby(chars, key=lambda pair: pair[1]):
        text = html.escape("".join(c for c, _ in grouped), quote=False)
        runs.append(f"<{tag}>{text}</{tag}>" if tag else text)
    return re.sub(r"\s+", " ", "".join(runs)).strip()


def page_parts(page, number, opener):
    blocks = []
    for block in page.get_text("dict", flags=pymupdf.TEXTFLAGS_DICT & ~pymupdf.TEXT_PRESERVE_IMAGES)["blocks"]:
        lines = []
        for line in block["lines"]:
            if line["bbox"][1] < 48:  # running heads
                continue
            if opener and line_style(line) == "subheading" and max(s["size"] for s in line["spans"]) > 17:
                continue
            if number == 97 and raw_line(line) == "Cli":  # invisible fragment on the copyright leaf
                continue
            lines.append(line)
        if lines:
            blocks.append(lines)
    two_columns = number <= 22 or number == 96
    def position(lines):
        left, top, *_ = lines[0]["bbox"]
        return (int(two_columns and left >= 234), top)
    return sorted(blocks, key=position)


def extract_chapter(doc, index, title, start, end):
    cid = f"ob-{index:02}"
    dialogue = 3 <= index <= 9
    paragraphs = []
    epigraph = None
    for number in range(start, end + 1):
        parts = page_parts(doc[number - 1], number, number == start)
        if number == start and 3 <= index <= 10:
            verse, credit = parts[:2]
            epigraph = {"lines": [clean(raw_line(l)) for l in verse],
                        "attribution": " ".join(clean(raw_line(l)) for l in credit)}
            parts = parts[2:]
            if dialogue:
                assert raw_line(parts[0][0]).startswith("Bill Jay:")
        prev_column = None
        for lines in parts:
            column = int((number <= 22 or number == 96) and lines[0]["bbox"][0] >= 234)
            merge = ((prev_column is None and number in JOIN_START_PAGES) or
                     (prev_column == 0 and column == 1 and number in JOIN_COLUMNS))
            prev_column = column
            for style, line_group in groupby(lines, key=line_style):
                group = list(line_group)
                speaker = speaker_for(group) if dialogue else None
                if merge:
                    para = paragraphs[-1]
                    assert para["speaker"] == speaker
                    para["endPage"] = number
                else:
                    para = {"id": f"{cid}-p{len(paragraphs)+1:03}",
                            "kind": "turn" if dialogue else "prose", "speaker": speaker,
                            "page": number, "endPage": number, "_chars": []}
                    paragraphs.append(para)
                for line in group:
                    append_line(para["_chars"], fragment(line, style, speaker))
                merge = False
    for para in paragraphs:
        para["html"] = encode(para.pop("_chars"))
        if para["endPage"] == para["page"]:
            del para["endPage"]
    return {"id": cid, "title": title, "type": "reference" if index == 11 else "core",
            "printedPages": [start, end], "epigraph": epigraph, "blocks": paragraphs}


def main():
    if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != DIGEST:
        raise SystemExit("Source edition changed. Recheck page and column continuations before extraction.")
    with pymupdf.open(SOURCE) as doc:
        chapters = [extract_chapter(doc, i, *chapter) for i, chapter in enumerate(CHAPTERS, 1)]
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(chapters, ensure_ascii=False, indent=2) + "\n")
    print(f"{len(chapters)} chapters / {sum(len(c['blocks']) for c in chapters)} blocks")


if __name__ == "__main__":
    main()
