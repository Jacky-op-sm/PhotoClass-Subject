# On Being extraction review

PDF page numbers and printed page numbers agree in this edition. The reader includes pp. 7–97.

| Measure | Result |
|---|---:|
| Chapters | 10 core + 1 reference |
| Paragraph blocks | 633 |
| Chapter epigraphs | 8 |
| Reading segments | 46 core + 3 reference |
| Words (reader / independent Poppler text) | 42,888 / 43,681 |
| Difference (tolerance ±3%) | −1.82% |
| Sampled pages checked visually | 21 |

The word count uses whitespace-delimited tokens and includes titles, epigraphs and body blocks. Poppler’s default output for pages 7–97 includes running heads, printed speaker labels and words broken across lines. The reader excludes running heads and joins the words. Regenerating the data produces identical IDs and content.

## Page review

With random seed 20261123, two distinct pages were drawn from each chapter. The Introduction occupies a single page. The review compares each visible paragraph start and typeface with its exported block. Seven chapters use dialogue. In chapter 10 the authors explicitly identify their text as jointly written.

| Chapter | PDF pages | Block starts on sampled pages | Findings |
|---|---|---:|---|
| ob-01 | 7 | 8 | Both columns read in order. The lecture anecdote continues into the right column. The signatures form the final block. |
| ob-02 | 10, 22 | 10 | The new subheading on p. 10 starts a separate block. On p. 22 the final left-column paragraph continues at the top of the right column. |
| ob-03 | 23, 27 | 15 | The opening speaker labels and epigraph match p. 23. Repeated David paragraphs on p. 27 retain separate boundaries. |
| ob-04 | 34, 36 | 12 | The first words of p. 34 continue a David paragraph on p. 33. Page 36 ends with a short exchange after four David paragraphs. |
| ob-05 | 39, 43 | 16 | The beach example continues with David across a page. The paragraph already in progress at the top of p. 43 starts on p. 42. |
| ob-06 | 47, 52 | 16 | The epigraph and two printed opening names are distinct. Page 52 begins with the continuation of a Bill paragraph. |
| ob-07 | 55, 61 | 6 | The opening epigraph sits above the first turn. All of p. 61 continues the final Bill paragraph from p. 60. |
| ob-08 | 66, 68 | 17 | Paragraph positions match the font changes. The indented quotation on p. 68 belongs to David’s turn. |
| ob-09 | 73, 83 | 8 | The opening of p. 73 continues David’s statement. The three closing paragraphs on p. 83 have David, Bill, David attribution. |
| ob-10 | 84, 94 | 14 | The preface describes joint authorship. Myth headings are distinct from body paragraphs. On p. 94 the numbered principle is italic. |
| ob-11 | 96, 97 | 17 | Both biography headings and all eight biography paragraphs match the two columns. Page 97 is a publisher notice. The hidden text-layer fragment “Cli” does not appear on the rendered page and was omitted. |

To reproduce the sample from the repository root, activate the extraction environment and run the following command. Each marked image shows the speaker or prose initial and the three-digit block number. The adjacent unmarked PNG preserves the original page.

```sh
PYTHONDONTWRITEBYTECODE=1 python scripts/check_onbeing.py --render-sample "$(mktemp -d)"
```

## Selecting a Subject preview

Use the following command for the full plain-text preview of blocks 001–015, including speaker names and PDF pages. Short opening cues appear below.

```sh
PYTHONDONTWRITEBYTECODE=1 python scripts/check_onbeing.py --preview
```

| Block | PDF page | Speaker | Opening words |
|---|---:|---|---|
| ob-04-p001 | 28 | Bill Jay | When we were discussing some definitions … |
| ob-04-p002 | 28 | David Hurn | That’s true. The fundamental issue is … |
| ob-04-p003 | 28 | Bill Jay | Explain what you mean. |
| ob-04-p004 | 28 | David Hurn | Many people are interested in photography … |
| ob-04-p005 | 29 | Bill Jay | The destination of photography is to … |
| ob-04-p006 | 29 | David Hurn | Right. However, a word of caution … |
| ob-04-p007 | 29 | Bill Jay | How would you answer? |
| ob-04-p008 | 29 | David Hurn | It comes down to the choice … |
| ob-04-p009 | 29 | Bill Jay | I’m intrigued by this idea: it … |
| ob-04-p010 | 29 | David Hurn | I’m pleased that you raised the … |
| ob-04-p011 | 29 | Bill Jay | Let us make the point clear: … |
| ob-04-p012 | 29 | David Hurn | The reason for a young photographer’s … |
| ob-04-p013 | 30 | David Hurn | So a photographer’s first decision is … |
| ob-04-p014 | 30 | Bill Jay | This reminds me … Ralph Steiner, … |
| ob-04-p015 | 30 | David Hurn | Garden gnomes! |

## Reading segments

The reference chapter is excluded from overall progress. Each row covers a contiguous range of paragraphs.

| Segment | Topic | Pages | First–last block |
|---|---|---|---|
| ob-01-s01 | What photographers can learn together | 7 | 001–003 |
| ob-01-s02 | How two voices became a book | 7 | 004–008 |
| ob-02-s01 | Meeting Hurn and his standards | 8–9 | 001–010 |
| ob-02-s02 | Childhood and first photographs | 9–11 | 011–026 |
| ob-02-s03 | Hungary, Russia and editorial work | 11–15 | 027–050 |
| ob-02-s04 | Subcultures, Magnum and friendships | 15–17 | 051–065 |
| ob-02-s05 | Building a school in Wales | 18–20 | 066–085 |
| ob-02-s06 | The person behind the camera | 20–22 | 086–100 |
| ob-03-s01 | The limits of professional labels | 23–25 | 001–014 |
| ob-03-s02 | Documentary evidence and personal honesty | 25–26 | 015–029 |
| ob-03-s03 | What a sequence can convey | 26–27 | 030–039 |
| ob-04-s01 | Choosing what enters the frame | 28–30 | 001–016 |
| ob-04-s02 | Testing a list of interests | 30–32 | 017–030 |
| ob-04-s03 | Personal expression and the subject | 32–33 | 031–042 |
| ob-04-s04 | Knowledge through sustained attention | 33–35 | 043–050 |
| ob-04-s05 | Feeling for the subject | 35–36 | 051–062 |
| ob-05-s01 | Where to stand and when to shoot | 37–39 | 001–017 |
| ob-05-s02 | Anticipating a gesture | 39–41 | 018–035 |
| ob-05-s03 | Putting several elements together | 41–43 | 036–047 |
| ob-05-s04 | Learning design from earlier pictures | 43–44 | 048–057 |
| ob-05-s05 | Beauty, chance and experience | 44–46 | 058–068 |
| ob-06-s01 | Making a readable contact sheet | 47–48 | 001–007 |
| ob-06-s02 | Reading, filing and marking frames | 48–50 | 008–027 |
| ob-06-s03 | Learning by comparing exposures | 50–52 | 028–040 |
| ob-06-s04 | Proof prints and consistent processing | 52–54 | 041–061 |
| ob-07-s01 | Planning pictures for a purpose | 55–56 | 001–013 |
| ob-07-s02 | Variety and the final sequence | 56–58 | 014–028 |
| ob-07-s03 | Working often and approaching strangers | 58–59 | 029–038 |
| ob-07-s04 | How the camera grants access | 59–61 | 039–047 |
| ob-08-s01 | Matching tools to a project | 62–64 | 001–011 |
| ob-08-s02 | Choosing formats for Wales | 64–65 | 012–024 |
| ob-08-s03 | Handling the camera fluently | 65–67 | 025–038 |
| ob-08-s04 | Commitment and physical preparation | 68–69 | 039–049 |
| ob-08-s05 | Clothing, contacts and carrying equipment | 69–71 | 050–065 |
| ob-09-s01 | Responsibility to the subject | 72–74 | 001–010 |
| ob-09-s02 | Truth and the working life | 74–75 | 011–020 |
| ob-09-s03 | Showing photographs on the web | 75–77 | 021–040 |
| ob-09-s04 | What constraints make possible | 77–79 | 041–050 |
| ob-09-s05 | Digital capture and discarded frames | 79–80 | 051–065 |
| ob-09-s06 | Manipulation, trust and original prints | 80–83 | 066–085 |
| ob-10-s01 | Editing with another pair of eyes | 84–85 | 001–009 |
| ob-10-s02 | Writing, design and printing | 85–87 | 010–020 |
| ob-10-s03 | Earning a living from photographs | 87–88 | 021–031 |
| ob-10-s04 | Practice, talent and familiar subjects | 88–90 | 032–047 |
| ob-10-s05 | Critics and crossing cultural boundaries | 91–93 | 048–064 |
| ob-10-s06 | Documentary work and artistic recognition | 93–95 | 065–081 |
| ob-11-s01 | David Hurn | 96 | 001–005 |
| ob-11-s02 | Bill Jay | 96 | 006–010 |
| ob-11-s03 | Publisher and copyright information | 97 | 011–017 |
