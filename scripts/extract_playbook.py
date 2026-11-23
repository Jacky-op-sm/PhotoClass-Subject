"""Rebuild the Playbook library from the supplied, scanned edition."""
from __future__ import annotations

import json
import re
import unicodedata
from collections import defaultdict
from dataclasses import dataclass, replace
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "content/playbook"
MANUAL = json.loads(Path(__file__).with_name("playbook-errata.json").read_text())
# Only where the OCR layer lacks a legible numeral. Values were read from scans.
FOOTERS = {15: 1, 20: 6, 29: 15, 95: 81, 323: 309}
# Acronyms and compound names as printed in cross-references.
SURNAMES = {
    43: "Bouillis & Olof", 47: "Broomberg & Chanarin", 91: "de Groot",
    94: "De Middel", 95: "De Rita", 116: "Fäldt & Källström", 207: "La Spina",
    269: "Onorato & Krebs", 340: "Starn", 344: "Stuke & Sieber",
    369: "Van de Roer", 370: "van Manen", 380: "Webb", 382: "Weegee",
}
ALIASES = {116: ["Källström & Fäldt"], 380: ["A. & R. Webb", "A. & R. Webb Webb"]}
# Keep genuine compound hyphens found at line breaks in this edition.
KEEP_HYPHEN = set(MANUAL["hyphenated"])
NUMBER = re.compile(r"^(?:\d{1,2}(?:[–-]\d+)?[.)]|[a-z][.)]|[-–•])\s+")
SEE = re.compile(r"^See als[oe]\.?\s+", re.I)


@dataclass
class Line:
    x: float
    y: float
    right: float
    bottom: float
    text: str
    page: int
    indent: float = 0


def read_lines(page):
    flags = pymupdf.TEXTFLAGS_DICT & ~pymupdf.TEXT_PRESERVE_IMAGES
    lines = []
    for block in page.get_text("dict", flags=flags)["blocks"]:
        for l in block.get("lines", []):
            text = "".join(span["text"] for span in l["spans"]).strip()
            if text:
                lines.append(Line(*l["bbox"], text, page.number + 1))
    return lines


def join_rows(lines):
    """The OCR engine sometimes splits one baseline into multiple fragments."""
    groups = []
    for line in sorted(lines, key=lambda l: l.y):
        if groups and abs(line.y - groups[-1][0].y) < 4.5:
            groups[-1].append(line)
        else:
            groups.append([line])
    rows = []
    for group in groups:
        group.sort(key=lambda l: l.x)
        first = group[0]
        rows.append(replace(first, text=" ".join(l.text for l in group),
                            right=max(l.right for l in group)))
    if rows:
        left = sorted(row.x for row in rows)[len(rows) // 5]
        for row in rows:
            row.indent = row.x - left
    return rows


def slug(text):
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")


def key(text):
    return slug(text).replace("-", "")


def unwrap(lines):
    text = ""
    for line in lines:
        if text.endswith("-") and line[:1].islower():
            previous = re.search(r"([\w-]+)-$", text)
            head = line.split()[0].strip(".,:;?!()’”")
            compound = (previous[1] + "-" + head).lower() if previous else ""
            if compound not in KEEP_HYPHEN:
                text = text[:-1]
            text += line
        else:
            text = f"{text} {line}".strip()
    return text


def paragraphs(lines):
    groups = []
    prev = None
    for row in lines:
        new_page = prev is not None and prev.page != row.page
        # Indented first lines, white space, section headings and list markers.
        new_para = (prev is None or (not new_page and row.y - prev.y > 20)
                    or (row.indent > 11 and (prev is None or prev.indent < 8))
                    or bool(NUMBER.match(row.text)))
        if prev and prev.page == row.page and prev.right < 200 and row.indent < 8:
            new_para = True
        if (new_page and prev and prev.text.endswith((".", "?", "!")) and row.text[0].isupper()
                and not prev.text.startswith("Rule Eight:")):
            new_para = True
        if new_para:
            groups.append([])
        groups[-1].append(row.text)
        prev = row
    blocks = []
    for group in groups:
        text = unwrap(group)
        if NUMBER.match(text) or re.match(r"^(?:Rule [A-Z][a-z]+|Number [0-9]+):", text):
            if blocks and blocks[-1]["kind"] == "list":
                blocks[-1]["items"].append(text)
            else:
                blocks.append({"kind": "list", "items": [text]})
        else:
            blocks.append({"kind": "p", "text": text})
    return blocks


def make_blocks(lines, start, log):
    def para(text): return {"kind": "p", "text": text}
    if start == 20:
        return [para(lines[0].text), {"kind": "list", "items": [l.text for l in lines[1:]]}]
    if start == 257:
        grid = MANUAL["wordSearch"]
        assert len(grid) == 32 and all(len(row) == 25 for row in grid)
        log.append((" ".join(l.text for l in lines), "\n".join(grid),
                    "Word-search grid transcribed row by row from PDF 257."))
        return [dict(kind="list", format="word-search", items=grid)]
    if start == 358:
        cutoff = next(i for i, l in enumerate(lines) if l.text.startswith("Dear ["))
        letter = MANUAL["dearMe"]
        log.append((" ".join(l.text for l in lines[cutoff:]), "\n\n".join(letter),
                    "Transcribed letter and restored printed blanks from PDF 358–359."))
        return paragraphs(lines[:cutoff]) + [para(t) for t in letter]
    if start == 361:
        items = []
        for l in lines:
            if re.match(r"(?:Don[’']t|Do |Never|Don’t)", l.text) or not items:
                items.append(l.text)
            else:
                items[-1] = unwrap([items[-1], l.text])
        return [dict(kind="list", items=items)]
    if start == 261:
        # Verse in the original. Keep line breaks when paragraph text reflows.
        return [dict(kind="p", format="verse", text="\n".join(l.text for l in lines))]
    if start == 59:
        start_index = next(i for i, row in enumerate(lines) if row.text == "A red ball")
        return (paragraphs(lines[:start_index])
                + [dict(kind="list", items=[l.text for l in lines[start_index:start_index+36]])]
                + paragraphs(lines[start_index+36:]))
    if start == 67:
        directions = next(i for i, row in enumerate(lines) if row.text == "Directions")
        ingredients = []
        for row in lines[1:directions]:
            if ingredients and ingredients[-1].endswith("works of"):
                ingredients[-1] += " " + row.text
            else:
                ingredients.append(row.text)
        return [para(lines[0].text), dict(kind="list", items=ingredients)] + paragraphs(lines[directions:])
    if start == 386:
        packing = next(i for i, row in enumerate(lines) if row.text.startswith("Students should bring"))
        end = next(i for i, row in enumerate(lines) if row.text.startswith("For this road trip"))
        return [para(lines[0].text), dict(kind="list", items=[l.text for l in lines[1:packing]]),
                para(lines[packing].text), dict(kind="list", items=[l.text for l in lines[packing+1:end]])] + paragraphs(lines[end:])
    return paragraphs(lines)


def corrected(text, page, log):
    for before, after in MANUAL["pages"].get(str(page), []):
        if before in text:
            log.append((text, text.replace(before, after), f"Verified against scan, PDF {page}."))
            text = text.replace(before, after)
    return text


def assignment(rows, reference, seq, last, page_map, corrections):
    start = rows[0].page
    log = []
    for row in rows:
        row.text = corrected(row.text, row.page, log)
    contributor = rows[0].text
    index = 1
    while index < len(rows) and rows[index].page == start and rows[index].y - rows[index-1].y < 22:
        index += 1
    title = unwrap([l.text for l in rows[1:index]])
    body = rows[index:]
    title_source = "printed"
    if not title:  # Gilden and Sealy have a single sentence and no printed title.
        title = body[0].text
        title_source = "incipit"
    surname = SURNAMES.get(start, contributor.split()[-1])
    entry_id = f"pb-{seq:03}-{slug(surname)}-{slug(title)}"
    blocks = make_blocks(body, start, log)
    refs = corrected(reference, last, log)
    entry = dict(id=entry_id, seq=seq, contributor=contributor, title=title,
                 blocks=blocks, printedPages=[page_map[start], page_map[last]],
                 pdfPages=[start, last], seeAlso=[dict(raw=s.strip(), id=None)
                  for s in SEE.sub("", refs).split(",") if s.strip()], topics=[],
                 bioId=None, needsReview=False)
    if title_source == "incipit":
        entry["titleSource"] = title_source
    for before, after, reason in log:
        corrections.append(dict(id=entry_id, before=before, after=after, reason=reason))
    return entry


def resolve(assignments):
    names = defaultdict(set)
    for a in assignments:
        start, author = a["pdfPages"][0], a["contributor"]
        surname = SURNAMES.get(start, author.split()[-1])
        initials = " ".join(t[0] + "." for t in author.split()[:-1])
        for alias in [surname, author, initials + " " + surname] + ALIASES.get(start, []):
            names[key(alias)].add(a["id"])
    for a in assignments:
        for ref in a["seeAlso"]:
            candidates = names[key(ref["raw"])]
            if len(candidates) == 1:
                ref["id"] = next(iter(candidates))
            else:
                a["needsReview"] = True


def write(name, obj):
    (OUTPUT / (name + ".json")).write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n")


def extract(doc):
    page_map, plates, assignments, corrections = {}, [], [], []
    body = []
    for page in doc:
        n = page.number + 1
        ls = read_lines(page)
        foot = [l for l in ls if l.y > page.rect.height - 62]
        numeric = [int(l.text) for l in foot if re.fullmatch(r"\d{1,3}", l.text)]
        # Front matter includes noisy bleed-through; printed folios start at PDF 15.
        number = numeric[0] if numeric and 15 <= n <= 441 else None
        if n in FOOTERS:
            corrected_number = FOOTERS[n]
            raw_folio = next((l.text for l in foot if re.match(r"^\d", l.text)), "")
            corrections.append(dict(id=f"pdf-{n}", before=raw_folio,
                after=str(corrected_number), reason="Printed folio verified against scan."))
            number = corrected_number
        page_map[n] = number
        if not 15 <= n <= 399:
            continue
        content = [l for l in ls if l not in foot]
        if not content:
            assert not body, f"Unexpected plate within unfinished assignment, PDF {n}"
            plates.append(n)
            continue
        body.extend(join_rows(content))
        see = [l.text for l in foot if SEE.match(l.text)]
        if see:
            assignments.append(assignment(body, see[0], len(assignments)+1, n, page_map, corrections))
            body = []
    assert not body and len(assignments) == 307
    resolve(assignments)
    p7 = join_rows(read_lines(doc[6]))
    intro = dict(title=p7[0].text, blocks=paragraphs(p7[1:]),
                 plateNote=unwrap([l.text for l in read_lines(doc[13])]), pdfPages=[7,14])
    return page_map, plates, assignments, corrections, intro


def main():
    OUTPUT.mkdir(exist_ok=True, parents=True)
    with pymupdf.open(ROOT/"source/photographers-playbook.pdf") as doc:
        page_map, plates, assignments, corrections, intro = extract(doc)
        from playbook_indices import attach_indices
        topics, bios, extra_edits = attach_indices(doc, assignments)
        corrections.extend(extra_edits)
    for filename, data in [("page-map", page_map), ("plates", plates), ("intro", intro),
                           ("assignments", assignments), ("topics", topics), ("bios", bios),
                           ("ocr-corrections", corrections)]:
        write(filename, data)
    print(f"{len(assignments)} assignments, {len(plates)} plates, {len(corrections)} OCR edits.")


if __name__ == "__main__":
    main()
