"""Read the two-column contributor index and Subject Guide in the supplied scan."""
from pathlib import Path
import json
import re
import unicodedata

FIXES = json.loads(Path(__file__).with_name('playbook-index-corrections.json').read_text())

# Some biographies use a fuller name, separate entries, or a different byline order.
BYLINES = {
    'Yannick Bouillis and Colette Olof': ['Yannick Bouillis', 'Colette Olof'],
    'Thobias Fäldt and Klara Källström': ['Klara Källström and Thobias Fäldt'],
    'Alex Webb and Rebecca Norris Webb': ['Alex Webb', 'Rebecca Norris Webb'],
    'Peter Bunnell': ['Peter C. Bunnell'],
    'Jörg Colberg': ['Jörg M. Colberg'],
    'Charles Traub': ['Charles H. Traub'],
    'Sandra Phillips': ['Sandra S. Phillips'],
    'Weegee (Arthur Fellig)': ['Weegee'],
}
EXTRA_BIOS = ['Thomas Barrow', 'Jason Fulford', 'Kelly Sultan']
BIO_FIXES = {
    'Melanie Bonaio': 'Melanie Bonajo', 'Asger Carisen': 'Asger Carlsen',
    'Kota Ezawg isa': 'Kota Ezawa is a', 'Charles Harbuft': 'Charles Harbutt',
    'Mark Kleft': 'Mark Klett', 'Roymond Meeks': 'Raymond Meeks',
    'Mark Meniivar': 'Mark Menjivar', 'Leanne Shapfon': 'Leanne Shapton',
    'Klara Kallstrom and Thobias Fdaldt': 'Klara Källström and Thobias Fäldt',
    'Jorg M. Colberg': 'Jörg M. Colberg',
}


def normalized(text):
    text = unicodedata.normalize('NFKD', text.casefold()).replace('’', "'")
    return re.sub(r'[^a-z0-9]+', ' ', text.encode('ascii', 'ignore').decode()).strip()


def column_rows(page, number):
    words = page.get_text('words')
    body = [w for w in words if 90 < w[1] < 535]
    # Scan margins vary. Search the clear gutter between the two columns.
    middle = min(range(160, 216), key=lambda x: (
        sum(w[0] - 1 <= x <= w[2] + 1 for w in body),
        sum(w[0] - 4 <= x <= w[2] + 4 for w in body), abs(x - 190)))
    top = 73 if number in (401, 435) else 24
    for col in (0, 1):
        plane = [w for w in words if (w[0] > middle) == bool(col) and top < w[1] < 551]
        groups = []
        for w in sorted(plane, key=lambda w: (w[1] + w[3]) / 2):
            y = (w[1] + w[3]) / 2
            if not groups or y - groups[-1][0] > 4:
                groups.append((y, [w]))
            else:
                groups[-1][1].append(w)
        previous = None
        for y, items in groups:
            text = ' '.join(w[4] for w in sorted(items, key=lambda w: w[0]))
            yield previous is None or y - previous >= 10.6, text
            previous = y


def correction(edits, number, before, after):
    edits.append({'id': f'pb-index-pdf-{number}', 'before': before, 'after': after,
                  'reason': f'Checked the index line against the scan on PDF {number}.'})


def guide(pdf, assignments, edits):
    references = {}
    aliases = {}
    topic = None
    for number in range(435, 441):
        for _, raw in column_rows(pdf[number - 1], number):
            line = FIXES.get(raw, raw)
            if ';' in line:
                line = line.replace(';', ',')
            if line != raw:
                correction(edits, number, raw, line)
            if len(line) == 1 and line.isalpha():
                continue
            cross = re.fullmatch(r'(.+) \(see (.+)\)', line)
            if cross:
                aliases[cross[1]] = cross[2]
                continue
            start = re.match(r'^([^\d,]+),\s*', line)
            if start:
                topic = start[1]
                references[topic] = []
                line = line[start.end():]
            if not re.fullmatch(r'[\d, ]+', line):
                raise ValueError(f'Unparsed index reference on PDF {number}: {line!r}')
            references[topic].extend(map(int, re.findall(r'\d+', line)))
    result = {}
    for topic, pages in references.items():
        if pages != sorted(set(pages)):
            raise ValueError(f'Check the numerical sequence for {topic}: {pages}')
        result[topic] = {'printedPages': pages, 'assignments': [
            a['id'] for a in assignments if any(a['printedPages'][0] <= p <= a['printedPages'][1] for p in pages)]}
    # The six printed “see” headings have no references of their own.
    for alias, target in aliases.items():
        result[alias] = {'see': target, 'printedPages': [], 'assignments': result[target]['assignments']}
    for item in assignments:
        item['topics'] = [t for t, record in result.items() if item['id'] in record['assignments']]
    return result


def contributor_bios(pdf, assignments, edits):
    names = {a['contributor'] for a in assignments}
    headings = sorted({b for n in names for b in BYLINES.get(n, [n])} | set(EXTRA_BIOS), key=len, reverse=True)
    entries = {}
    current = None
    for number in range(401, 434):
        for starts, raw in column_rows(pdf[number - 1], number):
            line = raw
            if starts:
                for before, after in BIO_FIXES.items():
                    if line.startswith(before):
                        line = after + line[len(before):]
                        correction(edits, number, raw, line)
                        break
                norm = normalized(line) + ' '
                heading = next((n for n in headings if norm.startswith(normalized(n) + ' ')), None)
                if heading:
                    if heading in entries:
                        raise ValueError(f'Duplicate biography heading on PDF {number}: {heading}')
                    current = heading
                    entries[current] = {'lines': [], 'pdfPages': [number, number]}
            if current is None:
                raise ValueError(f'Unexpected text before first bio: {line}')
            entries[current]['lines'].append(line)
            entries[current]['pdfPages'][1] = number
    bios = {}
    for item in assignments:
        contributor = item['contributor']
        sources = BYLINES.get(contributor, [contributor])
        item['bioId'] = None
        if all(n in entries for n in sources):
            key = normalized(contributor).replace(' ', '-')
            bios[key] = {
                'contributor': contributor,
                'text': '\n\n'.join(' '.join(entries[n]['lines']) for n in sources),
                'sourcePages': [entries[n]['pdfPages'] for n in sources],
            }
            item['bioId'] = key
    for name in EXTRA_BIOS:
        entry = entries[name]
        bios[normalized(name).replace(' ', '-')] = {
            'contributor': name, 'text': ' '.join(entry['lines']), 'sourcePages': [entry['pdfPages']]}
    return bios


def attach_indices(pdf, assignments):
    """Attach the verified page references and biographies; return their public indices."""
    edits = []
    return guide(pdf, assignments, edits), contributor_bios(pdf, assignments, edits), edits
