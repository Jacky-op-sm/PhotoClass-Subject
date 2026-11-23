# PhotoClass: Subject

A personal reading and practice site for David Hurn and Bill Jay’s *On Being a Photographer* and Jason Fulford and Gregory Halpern’s *The Photographer’s Playbook*. Read a segment, choose a weekly assignment, keep a list of subjects and return to the original printed page. Handwritten notes stay in Notability.

## Open on your Mac

Double-click **start-macos.command** in Finder. It opens the dashboard in your default browser. Keep its Terminal window open while you study. Press Control-C there to stop the server.

You can also run the following from the project directory.

```sh
python3 "scripts/serve.py" --open
```

The server listens on 127.0.0.1 and normally opens **http://localhost:8000/**. Opening the launcher a second time reuses the running study site. If another service occupies the port, the launcher prints the new address. Browser storage is separate for each origin, so return to the same hostname and port to see the same local progress. Python 3 is the only runtime dependency. Reading, both PDF viewers, the assignment library and subjects work offline once the local server is running. The pinned PDF.js 3.11.174 UMD library and worker are included under `assets/vendor/` with their license.

## Study

- **This Week** shows the current assignment and the next unread core segment. Draw one starts an assignment. Drawing another returns the previous current assignment to the to-do list and retains its photos.
- **On Being** has 46 core segments and three reference segments. Mark segments as read at their ends. Chapter recommendations have links back from the corresponding assignments.
- **Playbook** has 307 assignments. Search by title, author or text. Combine topics, status and photo filters, then draw from the matching to-do assignments. The original-page link shows the physical PDF page number used by Notability.
- **Subjects** accepts 200 characters per entry. Star an interest, mark it as a project candidate, or use Edit to connect it to assignments.
- **Original pages** show the physical PDF number first. The viewer opens at full-page size. Press Enter in the page field to jump, or use the arrow keys to turn a page. Fit width toggles a closer view. A link with `?book=playbook&page=17` uses printed page 17 and looks up its physical page in the book-specific map.

## Progress and photos

Progress is written first to the browser’s localStorage under `photoclass-subject-progress-v1`. Use **Sync settings** in the footer of This Week to export or restore a JSON backup. It includes private photo URLs and metadata. Keep the backup private. Image files stay in Storage.

Firestore progress sync uses the PhotoClass Subject project's default database on the Spark plan. Enter the same private code in **Sync settings** on each browser. Keep the code in your password manager. Photo uploads require a provisioned Storage bucket and its rules. The Storage field is empty while billing is disabled. [Firebase setup](docs/firebase-setup.md)

Sync compares segment marks, assignment states, photos and subjects independently. Deletes retain tombstones for 90 days. The photo picker becomes available after a valid sync connection. Each assignment holds up to 12 photos.

Only JPEG derivatives are uploaded. The 1600 px display copy targets at most 450 KiB and the 480 px thumbnail targets at most 60 KiB. Small files can be considerably lighter. Expect about 0.35–0.5 MB per photo. Six photos for each of 307 assignments gives 1,842 photos, roughly 0.9 GB at the upper estimate. Browser re-encoding removes EXIF, including GPS. Use the date and optional 140-character caption fields to keep the information you want. If your browser cannot decode a HEIC file, export a JPEG from Photos or Lightroom.

## Regenerate the books

The site ships with its generated data. To rebuild from the supplied editions, use Python 3.9 or later and Poppler’s `pdftotext` for the independent word count. Run these commands from this directory. The environment and caches stay outside iCloud Drive.

```sh
python3 -m venv "$HOME/.venvs/photoclass-subject"
source "$HOME/.venvs/photoclass-subject/bin/activate"
python -m pip install -r "scripts/requirements.txt"
export PYTHONDONTWRITEBYTECODE=1
python "scripts/extract_onbeing.py"
python "scripts/extract_playbook.py"
python "scripts/check_content.py" onbeing
python "scripts/check_content.py" playbook
```

The English segment titles, boundaries and recommendations in `data/onbeing-guide.json` are editable. Extraction preserves that file. Reproducible visual samples and the speaker-labelled preview are described in the [content report](docs/content-report.md).

## Vercel reference

For a future deployment, import the private GitHub repository into Vercel, choose **Other**, use the repository root, and leave the build and install commands empty. Include both `source/` and `content/`. The supplied headers set noindex and use a seven-day PDF cache. The largest source PDF is 16.15 MB. Vercel publishes a 100 MB Hobby CLI source-upload limit and 100 GB of monthly Fast Data Transfer. [Upload limits](https://vercel.com/docs/limits#static-file-uploads) · [Hobby allowances](https://vercel.com/docs/plans/hobby)

## Private study copies

The included PDFs, book text and cover images belong to their respective rights holders. Keep these study materials private. A private repository and indexing directives serve different purposes. Anyone with access to an unprotected deployment address can retrieve its files. The supplied editions give the rights notices on *On Being* PDF pp. 4 and 97 and *Playbook* PDF p. 442.
