"""Validate the library and optionally render the reproducible sample outside the repo."""
from __future__ import annotations
import argparse
import json
import random
from pathlib import Path

from extract_playbook import OUTPUT, ROOT, join_rows, read_lines
import pymupdf


def sample(entries):
    return sorted(random.Random(307).sample(entries, 30), key=lambda a: a["seq"])


def render_samples(entries, out):
    out.mkdir(parents=True, exist_ok=True)
    with pymupdf.open(ROOT / "source/photographers-playbook.pdf") as source:
        for offset in range(0, len(entries), 3):
            with pymupdf.open() as sheet:
                crops = []
                for a in entries[offset:offset + 3]:
                    first, last = a["pdfPages"]
                    first_page = source[first-1]
                    last_page = source[last-1]
                    body = join_rows([l for l in read_lines(last_page) if l.y < last_page.rect.height - 62])
                    limits = [(first, 36, 192), (last, max(40, body[-1].bottom-82), body[-1].bottom+5)]
                    for n, top, bottom in limits:
                        page = source[n - 1]
                        crops.append((a["seq"], n, pymupdf.Rect(18, top, page.rect.width-15, bottom)))
                w = max(clip.width for _, _, clip in crops)
                h = sum(clip.height+16 for _, _, clip in crops)
                page = sheet.new_page(width=w+6, height=h)
                y = 0
                for seq, n, clip in crops:
                    page.insert_text((3,y+10),f"#{seq:03}    PDF {n}",fontsize=8)
                    y += 14
                    page.show_pdf_page(pymupdf.Rect(0,y,clip.width,y+clip.height),source,n-1,clip=clip)
                    y += clip.height+2
                page.get_pixmap(matrix=pymupdf.Matrix(1.8,1.8)).save(out / f"sample-{offset//3+1:02}.png")


def check():
    def read(file):
        return json.loads((OUTPUT / (file + ".json")).read_text())
    entries, topics, bios = map(read, ("assignments","topics","bios"))
    page_map, plates = read("page-map"), set(read("plates"))
    assert len(entries) == 307
    assert [a["seq"] for a in entries] == list(range(1, 308))
    ids = {a["id"] for a in entries}
    assert len(ids) == 307 and len(plates) == 26
    assert set(map(int, page_map)) == set(range(1,445))
    covered = set()
    unresolved = []
    total = 0
    for a in entries:
        identifier = a["id"]
        first, last = a["pdfPages"]
        pdf_pages = set(range(first, last+1))
        assert identifier.startswith(f"pb-{a['seq']:03}-") and a["title"] and a["contributor"], identifier
        assert a["printedPages"] == [page_map[str(first)],page_map[str(last)]], identifier
        assert all(page_map[str(n)] is not None for n in pdf_pages)
        assert not (covered & pdf_pages or plates & pdf_pages)
        covered |= pdf_pages
        if a["bioId"] is None:
            assert a["contributor"] in {"Margaret Qiao", "Roby Yeoman", "Steve Young"}, identifier
        else:
            assert a["bioId"] in bios and bios[a["bioId"]]["text"].strip(), identifier
        for t in a["topics"]:
            assert identifier in topics[t]["assignments"], (identifier,t)
        assert a["blocks"] and all(b.get("text","").strip() or b.get("items") for b in a["blocks"]), identifier
        for ref in a["seeAlso"]:
            total += 1
            if ref["id"] is None:
                unresolved.append((identifier,ref["raw"]))
            else:
                assert ref["id"] in ids
        assert a["seeAlso"], identifier
    assert covered | plates == set(range(15,400))
    for topic, values in topics.items():
        assert values["assignments"] and set(values["assignments"]).issubset(ids), topic
        assert all(topic in a["topics"] for a in entries if a["id"] in values["assignments"]), topic
    assert 1 - len(unresolved)/total >= .98
    print(f"{len(entries)} assignments, {len(covered)} text pages, {len(plates)} plates, "
          f"{len(page_map)} page mappings, {len(bios)} bios, {len(topics)} topics; "
          f"{total-len(unresolved)}/{total} references resolved.")
    print("Unresolved references:", unresolved)
    print("Contributors without an index biography:", [a["contributor"] for a in entries if not a["bioId"]])
    print("Entries without a topic:", [a["id"] for a in entries if not a["topics"]])
    return entries


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--samples",type=Path,help="directory outside the project for inspection images")
    args = parser.parse_args()
    entries = check()
    if args.samples: render_samples(sample(entries), args.samples)
