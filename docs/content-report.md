# Local study site verification

## Source integrity

The two PDFs were moved and renamed. SHA-256 values matched the originals before and after the move.

| Source | Bytes | SHA-256 |
| --- | ---: | --- |
| On Being | 900,313 | `8ad990a20c3c3d4a8db7b66b19ff17a824a85644a47951b998d87935f93b8298` |
| Playbook | 16,148,530 | `03d0b82793209a507e1250cdbce0d87c52b4e05ac1f2e4828da792cec33d8f44` |

## Content

| Check | Result |
| --- | --- |
| On Being | 11 chapters, 633 blocks, 8 epigraphs, 46 core and 3 reference segments |
| Independent word count | 42,888 reader words against 43,681 Poppler words, a difference of −1.82% |
| On Being visual sample | 21 original pages across 11 chapters, including the one-page introduction |
| Playbook | 307 assignments, 267 Subject Guide headings, 26 alphabet plates, 444 physical page mappings |
| See also | 602 of 605 references resolved. Nos. 199, 210 and 252 each say only “Brown” |
| Missing from the source indexes | 3 contributors without a biography and 3 assignments without a subject heading |
| OCR and visual sample | 235 recorded corrections and 30 assignments checked against the scan |

The [On Being audit](onbeing-review.md) includes the page sample table, the first 15 block locators for Selecting a Subject, the command for their plain-text preview and every segment title. The [Playbook audit](playbook-review.md) identifies the review flags, ten representative OCR corrections and all sampled assignments.

## Local acceptance

- Seven pages in Chrome and WebKit at 390, 1280 and 1600 px passed 42 layout checks. All seven worked with external requests blocked, including the original-page viewer.
- Reading a segment updated the chapter list and This Week. Changing the current assignment returned the prior one to To do. Subject edits, stars, project status and assignment links persisted.
- A Subject Guide filter returned the indexed number of assignments. Random selection respected the filter and the to-do state. The empty result disabled Draw one.
- A chapter recommendation opened the intended assignment. Its reverse link and original-page link were present. A See also link opened the indexed contribution. Links from the preface and contributor biography reached their physical PDF pages. The PDF Back control returned to the assignment.
- Progress exported and reimported through the browser produced byte-identical JSON.
- The PDF viewer was checked against both originals, including Playbook printed p. 3 → PDF 17, an unnumbered leaf, the last page, rapid keyboard paging, zoom and a 2× display.
- A suite of 23 checks used the Firebase emulators. Two isolated Chrome profiles verified merge, offline reconnection, rule denials, the six JPEG objects from three inputs, image display across profiles, object deletion and the matching tombstone. The local package ships with empty production Firebase fields.
- In a separate race test, two Chrome profiles started with 11 photos. Both uploaded display and thumbnail JPEGs. A Firestore transaction admitted one pair. The other pair was removed from Storage. The cloud document and both profiles ended at 12 photos. The real assignment page displayed the 480 px thumbnail, opened the 1600 px lightbox and disabled the full picker.
- The original books and generated text are served from this Mac. The launcher binds only to 127.0.0.1. The runtime and test images were kept outside iCloud.

## Chapter recommendations

### Introduction

- [Intentionality](../assignment.html?id=pb-253-shore-intentionality) — Stephen Shore, PDF 331. Compare Shore’s experience as a teacher with the two authors’ reasons for talking about practice.
- [Feedback Loop](../assignment.html?id=pb-088-fitch-feedback-loop) — Steve Fitch, PDF 124. Try Fitch’s cycle of making and looking, then bring one discovery to a conversation with another photographer.

### About the Photographer: David Hurn

- [Giving the Mundane Its Beautiful Due](../assignment.html?id=pb-125-hurn-giving-the-mundane-its-beautiful-due) — David Hurn, PDF 168. Return to Hurn’s own Welsh village project after reading how he came to work close to home.
- [Being There](../assignment.html?id=pb-109-hampton-being-there) — Léonie Hampton, PDF 151. Use access through family or friends to spend time with a subject you can revisit.

### Some Definitions

- [What Cannot Be Seen](../assignment.html?id=pb-010-badger-what-cannot-be-seen) — Gerry Badger, PDF 26. Choose something invisible and decide what evidence a photograph could offer a viewer.
- [The Camera Never Lies](../assignment.html?id=pb-213-pickering-the-camera-never-lies) — Sarah Pickering, PDF 284. Change a caption or crop and examine how the same photograph can support a different reading.

### Selecting a Subject

- [Parameters](../assignment.html?id=pb-004-anderson-parameters) — Christopher Anderson, PDF 19. Draw a boundary around a nearby area and see which subjects keep drawing you back.
- [Limitation, Routine, and Repetition](../assignment.html?id=pb-059-cyr-limitation-routine-and-repetition) — John Cyr, PDF 87. Choose one subject from your list and use a recurring appointment to test your interest.
- [Giving the Mundane Its Beautiful Due](../assignment.html?id=pb-125-hurn-giving-the-mundane-its-beautiful-due) — David Hurn, PDF 168. Study Hurn’s village project before choosing a familiar subject you could photograph for years.

### Shooting the Single Picture

- [Where Do You Stand?](../assignment.html?id=pb-129-jacobson-where-do-you-stand) — Jeff Jacobson, PDF 175. Test Hurn’s questions about position and timing through Jacobson’s exercise.
- [Pictures Within Pictures](../assignment.html?id=pb-276-thall-pictures-within-pictures) — Bob Thall, PDF 357. Move the camera within a layered scene and compare how its edges arrange the elements.

### Creating Contacts

- [Feedback Loop](../assignment.html?id=pb-088-fitch-feedback-loop) — Steve Fitch, PDF 124. Review one shoot to decide what to try during the next one.
- [Insecurity](../assignment.html?id=pb-152-ladd-insecurity) — Jeffrey Ladd, PDF 203. Compare neighboring exposures later and notice what the camera screen encouraged you to dismiss.
- [Taking Stock](../assignment.html?id=pb-047-chiara-taking-stock) — John Chiara, PDF 71. Revisit earlier photographs and identify choices that change when you edit with distance.

### The Picture Essay

- [Tell Me a Story](../assignment.html?id=pb-184-morley-tell-me-a-story) — Alison Morley, PDF 246. Build a five-to-seven-picture story and test whether each image contributes something new.
- [Sequential or Serial](../assignment.html?id=pb-208-patton-sequential-or-serial) — Tom Patton, PDF 279. Change the order of related photographs and see which relationships survive the edit.
- [A Guide to the Neighborhood](../assignment.html?id=pb-066-deveney-a-guide-to-the-neighborhood) — KayLynn Deveney, PDF 97. Invite a resident to guide you through a neighborhood before shaping its story in pictures.

### Cameras, Shoes and Other Essentials

- [The Basics](../assignment.html?id=pb-078-estrin-the-basics) — James Estrin, PDF 112. Rehearse technical choices until you can pay attention to what unfolds in front of the camera.
- [Daily Practice](../assignment.html?id=pb-148-klett-daily-practice) — Mark Klett, PDF 197. Keep a camera within reach and see how that practical decision changes when you photograph.

### The Future of Photography

- [The Camera Never Lies](../assignment.html?id=pb-213-pickering-the-camera-never-lies) — Sarah Pickering, PDF 284. Use framing and captions to test how much trust a single photograph deserves.
- [You’re a Publisher Now](../assignment.html?id=pb-171-mayes-youre-a-publisher-now) — Stephen Mayes, PDF 228. Publish a sequence and examine how direct contact with viewers changes your editorial decisions.
- [The Meta-Photographer](../assignment.html?id=pb-229-ritchin-the-meta-photographer) — Fred Ritchin, PDF 305. Consider what editorial responsibilities arise when you work with photographs already in circulation.

### Some Photographic Myths

- [Sustainability](../assignment.html?id=pb-144-killip-sustainability) — Chris Killip, PDF 192. Compare the cost of living in a place with the time you need to photograph it.
- [Fits and Starts](../assignment.html?id=pb-071-dubois-fits-and-starts) — Doug DuBois, PDF 102. Bring a failed project to critique and identify a decision worth trying again.
- [Advice](../assignment.html?id=pb-258-soren-advice) — Tabitha Soren, PDF 337. Test one piece of professional advice against your own circumstances.

### About the Authors

- [Giving the Mundane Its Beautiful Due](../assignment.html?id=pb-125-hurn-giving-the-mundane-its-beautiful-due) — David Hurn, PDF 168. Read Hurn’s own assignment alongside his biography and identify the project he was still pursuing.
- [Where Do You Stand?](../assignment.html?id=pb-129-jacobson-where-do-you-stand) — Jeff Jacobson, PDF 175. Trace Hurn’s influence on another photographer’s teaching through a practical question about camera position.
