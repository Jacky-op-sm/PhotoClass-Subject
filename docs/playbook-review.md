# Playbook source review

The supplied 444-page scan yielded 307 assignments, with contiguous sequence numbers in book order. Every contributor, title or incipit, body, and page range is present. The first assignment begins on PDF 16 and the last ends on PDF 398.

## Page references and plates

The extractor reads each footer independently. The scan supplied five folios where the OCR was absent or partly garbled: PDF 15 → 1, 20 → 6, 29 → 15, 95 → 81 and 323 → 309. Unnumbered leaves have a null mapping. PDF 400 and 434 are unnumbered even though the printed sequence resumes afterward.

The 26 Polaroid plates form an A–Z sequence. The first photograph appears on PDF 15 (printed p. 1), the last on PDF 399 (p. 385). PDF 8 is a blank verso with text showing through the paper. The complete list is in `content/playbook/plates.json`.

## Cross-references

602 of 605 individual references resolve to an assignment (99.50%). All 307 contributions have a printed **See also** line. The scan of PDF 236 (Meeks) confirms the 307th occurrence: the embedded OCR reads “See alse Brouzws, Sultan.” The printed names are Brouws and Sultan.

Three references say only “Brown.” Both Able Brown and Michael Christopher Brown have assignments. These records keep the printed label, an empty destination, and `needsReview: true`. The assignment page offers links to both contributors. Elsewhere the editors use initials to distinguish the two. Neither contributor points back to any of these three entries.

| Seq | Source | PDF |
|---:|---|---:|
| 199 | Onorato and Krebs | 269 |
| 210 | John Pfahl | 281 |
| 252 | Shimabuku | 330 |

Alex Webb and Rebecca Norris Webb share a single assignment. Both the standard joint abbreviation and the duplicate surname actually printed on PDF 370 resolve to that entry. Gilden and Sealy contribute one sentence each without a separate title. Their entries use that sentence as the incipit and declare `titleSource: "incipit"`.

## Subject Guide and contributors

The index supplies 267 topic headings, including six “see” references. All headings map to one or more real assignments. Munari (#187), Starn (#261) and Sudek (#267) have no Subject Guide entry. Of 307 assignments, 304 have contributor biographies. The contributor index omits Margaret Qiao, Roby Yeoman (#306) and Steve Young (#307). Source-only contributor notes for Thomas Barrow, Jason Fulford and Kelly Sultan also appear in the biography index.

## OCR and formatting

`content/playbook/ocr-corrections.json` records 235 reviewed corrections, including index entries and folios. Each record identifies the text substitution with source IDs, both readings and a reason. Whitespace reflow, paragraph reconstruction, soft line-end hyphen removal and grouping of lists are layout operations. The reader preserves Amy Arbus’s item list, David Campany’s 36 instructions, Peggy Nolan’s verse, Erin Jane Nelson’s 32 × 25 letter grid, and the blanks in Hank Willis Thomas’s letter. The source PDF remains available for visual detail.

| PDF | OCR | Scan |
|---:|---|---|
| 17 | Watchin 1g | Watching |
| 31 | Collaboratin ¢ | Collaborating |
| 48 | W: inashield | Windshield |
| 65 | Letter | Leiter |
| 72 | Jorg | Jörg |
| 116 | Faldt / Kallstrom | Fäldt / Källström |
| 123 | Visualizin g | Visualizing |
| 187 | Angela Keily | Angela Kelly |
| 203 | TI; nsecurity | Insecurity |
| 237 | Alphabeto graphy | Alphabetography |

## Visual sample

A fixed random seed (307) selected 30 records without replacement. For each row, the byline, title, opening and closing were checked against the raster scan. Straight and typographic quotation marks compare as equivalent. Pages outside this sample received structural checks, plus targeted visual checks for unreadable OCR, titles, ambiguous references and special layouts. Residual OCR punctuation or transcription errors are possible outside the sample.

Run `python scripts/check_playbook.py --samples /tmp/photoclass-playbook-sample` to produce ten contact sheets from the source PDF.

| Seq | Contributor | PDF | Result |
|---:|---|---:|---|
| 011 | John Baldessari | 28 | Matched. |
| 023 | Melanie Bonajo | 40 | Matched. |
| 033 | Owen Butler | 55 | Removed stray OCR quotation mark before the opening sentence. |
| 051 | Matthew Connors | 75–76 | Checked the section heading and final instruction on the next page. |
| 065 | Lorenzo De Rita | 95–96 | Checked lettered list across the page turn. |
| 082 | Sam Falls | 117 | Matched. |
| 085 | Larry Fink | 121 | Removed stray OCR quotation mark before the opening sentence. |
| 093 | Allen Frame | 130 | Matched. |
| 107 | Gregory Halpern | 149 | Matched. |
| 127 | Jessica Ingram | 172 | Matched. |
| 128 | Natalie Ivis | 173 | Matched. |
| 144 | Chris Killip | 192 | Matched. |
| 152 | Jeffrey Ladd | 203 | Restored the split title from the scan. |
| 153 | Alexis Lambrou | 204 | Restored the apostrophe in the title. |
| 154 | Andrew Lampert | 205 | Matched. |
| 162 | Nathan Lyons | 215–217 | Verified the final exercise on the third page. |
| 173 | Chris McCaw | 231 | Matched opening advice and closing line. |
| 177 | Susan Meiselas | 237 | Restored the spelling of the title. |
| 194 | Peggy Nolan | 261–262 | Preserved verse line breaks across both pages. |
| 199 | Taiyo Onorato and Nico Krebs | 269 | Verified the final numbered range. See ambiguous reference below. |
| 203 | Arthur Ou | 273 | Matched. |
| 219 | Ted Pushinsky | 291 | Matched. |
| 227 | Shelley Rice | 303 | Matched. |
| 229 | Fred Ritchin | 305 | Matched. |
| 247 | Mark Sealy | 325 | Single-sentence contribution; its opening words supply the display title. |
| 261 | Doug and Mike Starn | 340 | Verified the joint byline. |
| 262 | Will Steacy | 341 | Matched. |
| 267 | Josef Sudek | 346 | Verified the entire source credit in the title. |
| 285 | Bertien van Manen | 370 | Checked the last paragraph and sign-off. |
| 299 | Grant Willing | 388 | Matched. |
