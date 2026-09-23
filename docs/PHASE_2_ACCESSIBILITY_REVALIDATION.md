# Phase 2 accessibility revalidation

**Date:** 24 September 2026  
**Branch:** `phase1-dependable-beta`  
**Scope:** browser keyboard behavior, browser accessibility tree, WCAG 2 A/AA Axe rules and color contrast. Conversion engines and output behavior were not changed.

## Result

The no-cost automated and browser accessibility work is complete for the current public routes. The full accessibility release gate remains open because automated tools and the browser accessibility tree do not replace a real NVDA, JAWS, Narrator or VoiceOver session.

Phase 2 therefore remains at **82%** and the accessibility workstream remains **12/20** until a real screen-reader review is completed and any findings are fixed.

## Issues found and resolved

1. **Add Watermark controls had visible labels without programmatic associations.** Watermark text, opacity, font size and rotation now have stable IDs, names and bound labels. The programmatically opened color picker is removed from the Tab order while its labelled trigger remains keyboard accessible.
2. **PDF Scanner selected mode did not meet contrast requirements.** White 12 px text on teal-600 measured 3.66:1. Text buttons now use teal-700 with a teal-800 hover state and pass the 4.5:1 WCAG AA threshold.
3. **PDF Scanner did not announce the active Camera/Upload mode.** The two controls are now a labelled group with an `aria-pressed` state that updates through keyboard activation.
4. **One combined local run exhausted the Chromium renderer heap.** The first 37 checks passed, then the Split PDF contrast scan hit `V8 JavaScript OOM`; later failures were connection-refused cascades after localhost stopped. Split PDF and every affected route passed when rerun in fresh memory-safe batches. This was test infrastructure pressure, not a product contrast failure.

## Verification evidence

| Gate | Result | Evidence |
|---|---:|---|
| Keyboard interactions | Pass | 9/9 Playwright checks, including Watermark labels/tab order and Scanner pressed-state changes |
| Serious/critical Axe findings | Pass | 0 across 40 English/Hindi public pages, including all 28 PDF tool routes |
| Color contrast | Pass | 0 moderate-or-higher violations across 37 marketing/tool checks, including all 28 PDF tool routes |
| Browser accessibility tree | Pass | Skip link focuses `#main-content`; Watermark fields expose Text field/Slider/Stepper names; hidden color input is skipped; Scanner controls expose distinct accessible names |
| Add Watermark targeted retest | Pass | Serious/critical Axe check and keyboard semantic checks pass |
| PDF Scanner targeted retest | Pass | Serious/critical Axe, color contrast and keyboard pressed-state checks pass |

The expanded automated suite now contains **86 checks**: 40 Axe structure/name checks, 37 contrast checks and 9 keyboard behavior checks. On a memory-constrained Windows development server, run the Axe groups in smaller batches. A combined run still needs a runner with enough memory to keep Chromium and the Next.js server alive together.

## Real screen-reader release checklist

Run this checklist with Windows Narrator or NVDA on localhost before closing the remaining accessibility gate:

1. Open `/`, use heading and landmark navigation, and confirm one clear level-one heading and a usable main landmark.
2. Tab from page start, activate **Skip to main content**, and confirm focus moves to the main content.
3. Open and close **All Tools** and the mobile menu; confirm their names, expanded state, focus order and Escape behavior are announced.
4. On `/merge-pdf`, `/pdf-to-word`, `/add-watermark` and `/pdf-scanner`, confirm every upload action and option has a useful name and instructions are read in a sensible order.
5. On `/add-watermark`, confirm Watermark text, Opacity, Font size and Rotation names and values are announced; confirm the hidden color input never becomes a Tab stop.
6. On `/pdf-scanner`, confirm Camera or Upload is announced as pressed and that the state changes after keyboard activation.
7. On `/login` and `/signup`, submit invalid values and confirm the error is announced and focus moves to the field needing correction.
8. Trigger one safe local conversion error and one success state; confirm both status changes are announced without moving focus unexpectedly.
9. Repeat the primary flow at 200% browser zoom and with Windows High Contrast mode if available.

Record the screen reader name/version, browser/version, route, steps, spoken result and pass/fail. A real user or tester must hear the announcements; screenshots and DOM inspection alone are insufficient evidence.
