# Phase 3.4: PDF Scanner output and limits

**Date:** 7 October 2026

**Status:** Scoped local phase complete. On 7 October 2026 the user confirmed clicking Download PDF and saving the file, closing the last browser gate.

## Result

PDF Scanner now applies the selected filter to the actual downloaded PDF.
Previously the workspace sent `original`, `bw` and `enhanced`, while the API
recognized different values, so the visible preview could suggest a filter
that the export did not apply. A scanner-only adapter maps the three controls
to the existing processing operations. Legacy API values remain accepted.

- Original applies no enhancement and respects phone EXIF orientation.
- Black & White produces a two-tone image using a threshold of 128.
- Enhanced normalizes contrast and sharpens the image. This is not a guarantee
  of improved readability for every source.

Every input is oriented before metadata is stripped. Images are decoded
sequentially, preserving upload order. The shared image-to-PDF renderer and
Word, Excel, PowerPoint and OCR engines are unchanged.

## Limits and interaction

The workspace and API share a maximum of 10 images per PDF on every plan.
The workspace offers static JPG, PNG and WebP images. An oversized selection
batch is rejected as a whole, with an explicit message and no silently dropped
pages. Removing a page restores capacity. The file input resets so the same
files can be retried. Existing per-file size, authentication, origin and usage
guards remain in place.

The API rejects empty uploads, non-file entries, unknown or duplicate filter
values, over-limit batches and unreadable images. It validates the full batch
before processing and returns an error instead of a partial PDF.

Editing is locked during export, and the result reports the submitted page
count. Camera requests and capture encoding are guarded against stale results;
camera streams and object URLs are cleaned up on reset or unmount. Preview and
remove controls are separate buttons. Download uses a persistent result link;
the blob URL is released when the result is cleared or the workspace unmounts.

## English content

The page, tool description and AEO entry consistently disclose the 10-image
cap, approximate preview, filter trade-offs and need to review every downloaded
page. Unsupported edge detection, perspective correction, background cleanup,
speed guarantees and extra Pro image-count claims were removed.

Output is an image-based PDF without OCR: one source image per A4 portrait page,
fitted and centered inside 20-point margins. Users should crop and straighten
their source images before upload. Hindi pages and Hindi-specific translations
were not changed.

## Verification

- 66/66 focused automated tests passed: real Sharp pixel/orientation checks,
  route validation, selection boundaries, existing merge route, upload guards,
  guide and SEO contracts.
- 11/11 actual local HTTP corpus cases passed: five successful conversions
  producing 14 PDF pages, plus six invalid-input rejections.
- Independent Pillow expectations verify Original pixels, thresholded B&W,
  EXIF orientation and all ten mixed-format pages in order. Enhanced increased
  the deliberate low-contrast fixture's P95-P5 gray range from 49 to 201 while
  keeping its gray patches ordered. This measures that fixture only.
- MIME, PDF magic, filename, openability, encryption state, A4 geometry, margins,
  page count, page order and absence of a text layer passed.
- Poppler rendered all 14 output pages. A visual contact-sheet review found
  upright content, readable fixture labels, expected colors/filter appearance,
  preserved framing and no clipping.
- Browser boundary checks covered 11-image rejection, 10-image acceptance,
  remove-and-retry, whole-batch rejection with existing pages, selected filter,
  processing edit lock and the 10-page success state. Desktop 1280 and mobile
  390 pixel checks found no document-level horizontal overflow.
- Focused ESLint passed for all 11 changed TypeScript files. The final webpack
  production build and TypeScript passed, generating 170/170 entries. Existing
  middleware, cache-header and Buffer deprecation notices remain.
- The local preview was restarted after the successful build. The Scanner
  page returned HTTP 200 with the expected title and opened in a fresh browser
  tab. No cloud service was needed for the preview or conversions.

Final verification is recorded in
`quality/phase3-scanner/verification-report.json`. The saved-download gate is
closed by the user's explicit confirmation: "i clicked on download pdf and
saved". This is manual file-save evidence; independent artifact checks remain
the separate HTTP corpus. It is not a new inspection of the user's saved file.

## Issues found during final checks

The first webpack build compiled but failed TypeScript on a redundant camera
stream cleanup after a guard had already established that the stream was null.
That unreachable cleanup was removed. Browser testing also failed to produce
a saved download from the old detached anchor with immediate URL revocation;
the result now uses a stable rendered download link. The in-app browser's
click and documented download API still timed out with that valid link, and
no new file appeared in the normal Downloads folder during automation. The
user then confirmed saving the file manually. Automation download capture
remains unreliable in this environment; the manual file-save gate is closed.

Independent review found that closing the camera or starting export while
`canvas.toBlob` was pending could discard the last requested photo. Pending
capture encoding now blocks those actions until the image is committed.
Clear and unmount still cancel stale work.

A later build ran out of host memory while TypeScript was running alongside
the development server. The project's preview processes were temporarily
stopped to release memory for a separate build retry; unrelated applications
were left running. That retry passed. The temporary shutdown explains the
user's intervening "site can't be reached" report; the preview was restored.

## Reproduction and limits

See `quality/phase3-scanner/README.md` and the retained JSON reports. The corpus
runner rejects non-loopback origins and redirects, uses synthetic English
images, and does not import the app's processing code. Generated sources,
PDFs and renders remain in ignored `tmp/pdfs/phase3-scanner/first/`.

```powershell
python scripts/phase3-scanner-corpus.py --run-label recheck --base-url http://127.0.0.1:3001
npm run build
```

Physical camera permission, actual camera devices, animated images, arbitrary
large-image capacity, real-customer acceptance and deployed infrastructure are
not certified by these checks. The 10-image count does not establish that ten
maximum-size images fit every runtime's memory or request limit. Existing
25 MB Free and 200 MB Pro per-file policy is separate from that capacity gate.

No cloud settings, paid services, public deployment or `.env.local` values were
changed. Phase 2 public HTTPS/load/retention/cost gates remain deferred. The user
approved starting the next task after confirming the saved download.
