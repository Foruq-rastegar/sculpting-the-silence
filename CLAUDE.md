# Sculpting the Silence

An offline, kiosk-style interactive art installation: 5 sequential stages, vanilla HTML/CSS/JS
(no framework, no build step, no CDN dependencies). Must run entirely offline from local files.

## File structure

- `index.html` — all 5 `<section class="stage" id="stage-N">` containers, plus the shared
  `<script>` tags (load order matters: `shared.js` first, then `stage1.js` … `stage4-5.js`).
- `css/global.css` — all styles, one file, organized in commented sections per stage.
- `js/shared.js` — common helpers/components used by every stage: the stage-advance state
  machine (`STS.goToStage`/`registerStageEnter`/`goToNextStage`), cta button click/touch/Enter
  binding, the typewriter effect, the reusable spinner, the "message moment" attempt-ladder
  component, the full-viewport blackout helper, and the stage-3 background audio loop
  controllers. Everything is exposed on `window.STS`. Must load before any `stage-N.js` file.
- `js/stage1.js`, `js/stage2.js`, `js/stage3.js` — one file per stage.
- `js/stage4-5.js` — stages 4 and 5 combined in one file, since they're tightly connected
  (stage 4's last "moment" opens directly into stage 5's continuous 11780-reveal-then-form
  screen, and the collective board follows immediately after that same form's submit).
- `assets/images`, `assets/video`, `assets/audio`, `assets/icons`.

## Asset naming convention

`s{stage}_{type}_{number}_{mediatype}`, lowercase, underscores, two-digit numbers where a type
repeats (e.g. `s3_leak_01_img`, `s3_leak_07_img`, `s4_name_01_snd` … `s4_name_09_snd`). One-off
assets that don't repeat (a single banner image, a single icon) may omit the number. One id
maps to exactly one asset file at a time — swapping a leak's response type (e.g. image → video)
means retiring the old file and adding the new one under the same numbered id, not keeping both.
**All assets currently in the repo are placeholders** until replaced with final content.

## Narrative moment naming (`s{stage}_mom_{NN}`)

Individual beats are informally referred to as `s{stage}_mom_{NN}` in comments, commit messages,
and conversation (e.g. `s1_mom_01`, `s2_mom_03`, `s2_mom_04`, `s3_mom_05`, `s3_mom_10`,
`s3_mom_12`, `s4_mom_14`, `s4_mom_22`, `s5_mom_23`, `s5_mom_24`). Not every moment in the code
carries an explicit `mom_NN` code comment (stage 3's other message moments and stage 4's 9 named
moments don't), but when one is used, treat it as the durable id for that beat.

## Layout — `.frame`

- Fixed design aspect ratio `402 / 874` (iPhone-17-shaped CSS viewport), `width: min(92vw, 402px,
  calc(92dvh * 402 / 874))`, `min-width: 320px`. Defined once in `css/global.css`'s `.frame` rule.
- `.frame` itself has `overflow: visible` — content (e.g. a zoomed leak image) is allowed to spill
  past the card edges; only `html, body { overflow: hidden }` ultimately clips it at the viewport.
- `border-radius: 0` everywhere (`--frame-radius`, `--button-radius`, images, videos, waveform
  bars, form inputs, the export button) **except** the loading spinner, which must stay circular
  (`border-radius: 50%`).

## Typography

- `.frame__body` has `max-width: 35ch` (text boxes elsewhere may use their own, e.g. form inputs
  at `28ch`).
- Typing is char-by-char via the shared `STS.typeText(el, text, charsPerSecond, onComplete)`
  helper (stages 2-3 use 14 chars/sec; stage 4-5 uses its own faster 20 chars/sec).
- **Exceptions that show instantly, with no typing animation:**
  - `s1_mom_01`'s title and body (already static text in `index.html`).
  - Any response text that reads exactly `"No response"` or `"No connection"`.
  - `s5_mom_24`'s thank-you footer text.

## Transitions

All stage/moment changes are **instant** — no fade, no delay — unless explicitly documented as a
deliberate exception in that moment's own code/comments. Known exceptions: the stage-5 form
fields/submit-button sliding in under the kept-on-screen `s4_mom_22` title+subtext (500ms
transform/opacity), and the stage-3 leak zoom/fade treatment (see below), which is itself timed
to a leak's display duration rather than being a hard cut.

## Stage 3 "leak" rule

A message moment's original typed message must be cleared (`clearMessageText()`) the instant a
final "leak" response is about to show — image, video, audio, the final attempt's text, or an
ordered chain of these. A message and a leak are never visible on screen at the same time. Only
a leak's own caption/subtitle may accompany it.

Every stage-3 leak image/video (standalone or within a chain) — **except `s3_leak_08_img`**,
which is rendered by `runNameThemMoment`'s own image+caption layout (`s3_mom_12`), never through
the shared leak renderers — gets a slow zoom that grows to fill and slightly overflow the frame
over its full display duration, fading to black during the final 30% of that same timeline
(`applyLeakZoomAndFade` in `shared.js`; tunable via `LEAK_ZOOM_FILL_SCALE` / `LEAK_FADE_SHARE`).

## Loading spinner

`STS.runSpinner(mountEl, spinCount, onDone)` in `shared.js` rotates the shared circular spinner
for `spinCount` visible rotations (`SPIN_DURATION_MS` = 900ms each) then calls back. `load_anim_1`
… `load_anim_4` are the informal names for the 4/3/2/1-rotation presets respectively — a naming
convenience for picking a rotation count, not a strict per-moment ladder: individual message-
moment attempts (their `loadSpins` field) pick whichever preset fits that attempt's pacing, and
don't always run in descending order across a moment's attempts.

## CTA buttons

Every cta button is wired via `STS.bindTapAndClick(el, handler)` (click, touchend, and Enter-
while-focused) and `STS.presentCtaButton(el)` (focuses it and tracks it as the "active" button).
A single document-level keydown listener in `shared.js` is the fallback: if Enter is pressed and
the tracked active button isn't the one natively focused, it's clicked directly — so Enter works
even when a button appears via auto-advance with no prior user interaction.

## Video/audio playback

Video elements are **not** muted — they autoplay with sound, no controls, and advance on the
native `ended` event. This is safe because stage 1 requires a user click ("Run the Experience")
before any video/audio would need to play, satisfying the browser's autoplay-with-sound policy
for the rest of the session.

## Stage 3 background audio

Two independent looping `<audio>` tracks, both centralized in `shared.js` (`STS.gunshotAudio`,
`STS.underscoreAudio`):
- `s3_gunshot_snd.mp3` — starts at `s3_mom_05` ("Mom?"), loops underneath every moment after it,
  and is stopped right as `s3_mom_10` ("Dad?") begins (i.e. it plays under moments 5 through 9,
  not through moment 10 itself).
- `s3_underscore_loop.mp3` — also starts at `s3_mom_05`, but keeps looping under all of stage 3,
  all of stage 4, and stage 5's merged reveal+form screen, stopping only once that form is
  actually submitted.

## Response type "audio"

Pairs a typed subtitle with an animated waveform indicator (`.waveform-indicator`) that starts
animating the instant `audio.play()` is called and freezes (via a `--playing` class toggle) on
the native `ended` event. Reused as-is for stage 2's gunfire-warning waveform.

## Stage 5 — collective board (`s5_mom_24`)

- Entries persist in `localStorage` (key `sculptingTheSilenceEntries`) as a JSON array of
  `{ name, story }` objects, written by the stage-5 form submit and read back when the board
  renders.
- A manual "Export" button downloads the current entries array as `entries.json` — a backup
  mechanism, not part of the experience itself.
- Each entry gets a stable note (deterministic hash of its index+name, not re-randomized per
  hover) from an A-minor-pentatonic frequency set, synthesized with layered Web Audio oscillators
  (fundamental + two quiet upper partials) approximating a hang-drum/handpan tone, played on
  hover (desktop) or tap (touch).

## Feature flags

Boolean constants near the top of a stage file toggle optional moments on/off without deleting
their code, e.g. `ENABLE_S2_MOM_04` in `stage2.js` (currently `false` — a spinner beat stands in
for the disabled gunfire-warning moment instead).

## Git workflow

One commit per logical change, with a clear descriptive message, so any single change can be
selectively reverted later without unpicking unrelated work.

---
Keep this file updated whenever a new durable convention is established — re-verify claims
against the actual code rather than trusting this file blindly, since it can drift out of date.
