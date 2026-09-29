# DIA-198 real-device pass — slider and toggle (manual)

DIA-194's review ran Chromium only, plus Playwright's WebKit build as an iOS Safari
proxy (`webkit-iphone` project). Neither substitutes for a real device with a real
screen reader. This script is the QA follow-up named in DIA-194 section 4: no
automated harness here can drive VoiceOver or TalkBack, so this is written for a
person with a physical iPhone (Safari + VoiceOver) and a physical Android phone
(Chrome + TalkBack) to run and fill in.

Scope, matching DIA-198's brief: the slider and the toggle only. Not the panel, not
the checklist, not room/close-up navigation.

Run this once against `develop` HEAD before recording a verdict, and once more after
DIA-195 (the Web P1 fixes for U-01/U-02/U-03) lands, since several of these steps are
expected to change behaviour.

## Setup

1. Open the staging URL (or a local `vite preview` reachable from the device) on the
   real device, at its native size — do not force a viewport.
2. iOS: enable VoiceOver (Settings → Accessibility → VoiceOver, or the triple-click
   side button shortcut). Android: enable TalkBack (Settings → Accessibility →
   TalkBack).

## Slider

For each device/AT pair, record pass/fail and a one-line note:

| # | Step | Expected | iOS Safari + VoiceOver | Android Chrome + TalkBack |
|---|------|----------|---|---|
| 1 | Swipe to the slider (VoiceOver) / explore-by-touch to the slider (TalkBack) | Announces a slider/adjustable control, its label, and the current readout (not the raw number) | | |
| 2 | Swipe up/down (VoiceOver's adjustable-value gesture) or use the increment/decrement actions (TalkBack) once | Value moves to the next band; the announcement changes to that band's readout | | |
| 3 | Repeat step 2 six more times (7 total) | Every band is reached in order, then the 1,000+ stop; each is announced once | | |
| 4 | Drag the slider's native thumb with a finger | The value tracks the finger continuously; the picture updates without lag or content jumping under the finger | | |
| 5 | Tap the track (not the thumb) at a point a little off the thumb's exact vertical centre | The value moves to that point, the same as tapping when perfectly centred | | |
| 6 | With VoiceOver/TalkBack navigation, move focus away from the slider mid-drag (swipe to the next item) then back | Focus returns to the slider showing the value from step 4/5, not a stale one | | |

## Toggle

| # | Step | Expected | iOS Safari + VoiceOver | Android Chrome + TalkBack |
|---|------|----------|---|---|
| 1 | Swipe/explore to the toggle button | Announces a button, named for the action it performs (e.g. "Show what it was without") | | |
| 2 | Activate it (VoiceOver double-tap / TalkBack double-tap) | The scene flips to the without state; a single announcement names the new state (not "pressed"/"not pressed" alongside a label that already describes the action — DIA-194 U-10) | | |
| 3 | Activate it again | Flips back to built; announced once, matching step 2's pattern | | |
| 4 | With the toggle in the without state, swipe to the subtitle/tagline line under it | Either reads real text or is skipped entirely — never announces an empty line | | |

## Filing results

- If every row passes on both devices: comment on DIA-198 with the device models, OS
  versions, and browser versions used, and mark this file's checklist complete.
- If anything fails: file it as a new defect against DIA-198's own findings ledger,
  same format as DIA-194's table (id, evidence, lens, spec/AC violated, proposed fix),
  and route it the same way DIA-194 section 4 does — `src/` defects to the Web
  Engineer, copy issues to Product & Content.
- Either way, note which commit (`develop@<sha>`) was tested — before or after DIA-195.

## Why this file, not an automated test

Playwright cannot drive VoiceOver or TalkBack — there is no CDP/WebDriver hook into a
real screen reader's speech output, only the accessibility tree Chromium/WebKit expose
to it (which the automated specs in `tests/*.spec.ts` already assert against). Closing
this gap for good would mean a device-cloud connection (e.g. BrowserStack App
Automate/Accessibility Testing) wired into CI; none is connected to this project today
(checked via Paperclip's connection catalog on 2026-09-29 — only GitHub is
authorized). Until one is, this manual script is the only way to observe actual
screen-reader speech on real hardware.
