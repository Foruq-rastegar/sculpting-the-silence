# Sculpting the Silence

An offline, kiosk-style interactive art installation: 5 sequential stages, vanilla HTML/CSS/JS
(no framework, no build step, no CDN dependencies). Must run entirely offline from local files.

## File structure

- `index.html` — a persistent `<canvas id="field-canvas">` (background point field, see below)
  followed by all 5 `<section class="stage" id="stage-N">` containers, plus the shared
  `<script>` tags (load order matters: `shared.js` first, then `field.js`, then `stage1.js` …
  `stage4-5.js`).
- `css/global.css` — all styles, one file, organized in commented sections per stage.
- `js/shared.js` — common helpers/components used by every stage: the stage-advance state
  machine (`STS.goToStage`/`registerStageEnter`/`goToNextStage`), cta button click/touch/Enter
  binding, the typewriter effect, the reusable spinner, the "message moment" attempt-ladder
  component, the full-viewport blackout helper, the stage-3 background audio loop controllers,
  and the screen-mode/cross-window sync setup that splits frame and field across two windows for
  the exhibition deployment (see "Screen split (frame/field)" below).
  Everything is exposed on `window.STS`. Must load before any `stage-N.js` file.
- `js/field.js` — the background point-field engine (perspective, the curved "channel",
  three dot populations, density-based speed, path wobble), exposed as `window.Field` with
  `init/startIdleJitter/startFlow/stopFlow/setZoom`. Ported from and kept in sync with
  `prototypes/field-default.html`, where its visual tuning is done before porting changes back.
  Each stage drives its own timing externally (no fixed internal duration). Must load before
  any `stage-N.js` file that calls it.
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
over its full display duration (`applyLeakZoom` in `shared.js`; tunable via `LEAK_ZOOM_FILL_SCALE`).
Previously paired with a fade-to-black over the timeline's final 30%; the fade was removed per
feedback, zoom kept as-is.

## Loading spinner

`STS.runSpinner(mountEl, spinCount, onDone)` in `shared.js` rotates the shared circular spinner
for `spinCount` visible rotations (`SPIN_DURATION_MS` = 1350ms each, i.e. 1.5x the original 900ms —
slower motion, same rotation counts everywhere) then calls back. `load_anim_1`
… `load_anim_4` are the informal names for the 4/3/2/1-rotation presets respectively — a naming
convenience for picking a rotation count, not a strict per-moment ladder: individual message-
moment attempts (their `loadSpins` field) pick whichever preset fits that attempt's pacing, and
don't always run in descending order across a moment's attempts.

## Background point field

`js/field.js` (`window.Field`) renders a single full-viewport `<canvas id="field-canvas">`. Its
JS-side state (dots, animation clock) persists continuously across stage transitions, but the DOM
node itself is physically **reparented** on every stage change: `.stage` uses `position: fixed`,
which in every modern browser always forms its own stacking context regardless of z-index — so as
a sibling living outside every `.stage`, the canvas could only ever paint entirely behind or
entirely in front of the active stage's full contents as one atomic block; no z-index value can
slot it "between" a stage's own `.background-layer` and its `.frame`. `field.js` fixes this itself
(no changes needed to `shared.js` or any `stage-N.js`) by watching for the `.stage.is-active` class
change (`MutationObserver`) and moving the same canvas node to be a child of the newly active
stage, right after its `.background-layer` — within one stacking context, plain DOM order then
does the right thing: background-layer, then canvas, then `.frame` (moving a canvas node doesn't
clear its drawn bitmap or reset its context). `.field-canvas` has no explicit `z-index` and
`pointer-events: none` — purely decorative, never intercepts input.

Public API: `init(canvas)` (static default state, no motion), `startIdleJitter()` (idle wobble
only), `startFlow()` (channel-joining movement begins — no fixed duration; the caller decides how
long it runs), `stopFlow()` (freezes everything immediately, holds in place), `setZoom(scale)`
(camera zoom around the channel's center, e.g. so individual dots read clearly, applied instantly),
`animateZoomTo(targetScale, durationMs)` (same camera zoom, but eased from the current scale to
targetScale over durationMs using `buildupFraction` — a from-scratch analytic curve, not a named
easing preset: a brief quadratic ease-in (constant acceleration from rest) for the first
`ZOOM_BUILDUP_RAMP_FRACTION` of the duration (15%), algebraically solved so it hands off to
constant-velocity linear motion for the rest, matching both position and velocity at the seam (no
visible speed jump) and landing at exactly targetScale when the duration elapses; runs its own
`requestAnimationFrame` loop so it still animates even if the main tick loop isn't running, e.g.
after `stopFlow()` has frozen the field), `recoilZoom()` (a sharp, punchy kick: cancels any
in-flight `animateZoomTo` and snaps the *current* scale down by a fixed fraction —
`ZOOM_RECOIL_DROP_FRACTION`, 30% — over a fixed short duration — `ZOOM_RECOIL_DURATION_MS`, 0.2s —
using `easeOutQuart`, the only preset easing curve left in the zoom code), `setVisible(bool)`
(shows/hides the canvas without touching its running animation state). Each stage wires up its own
timing by calling these from its own moment logic — stage 1 only calls `init` (dots stay fully
static); stage 2 starts idle jitter when `s2_mom_02` starts playing, starts flow 5s later, and
stops flow the instant the video's `ended` event fires (see `stage2.js`'s
`FIELD_FLOW_START_DELAY_MS`) — so the flow's active duration is however long the real video leaves
after that 5s intro, not a hardcoded number, following the same "duration follows the real asset"
principle as `playLeakVideo`'s zoom/fade timing in `shared.js`. Stage 2 also runs a two-phase
gunshot "kick" on the zoom: phase 1 is `animateZoomTo`'s ramp-then-linear buildup from 1x to 2.3x
starting at the beginning of `s2_mom_03`, passed a pacing-estimate duration for the rest of stage 2
(`stage2.js`'s `POST_CUTOFF_LOAD_SPIN_COUNT` and `STS.SPIN_DURATION_MS`); phase 2 is `stage3.js`
calling `recoilZoom()` directly off `s3_gunshot_snd`'s native `play` event (fired when
`STS.gunshotAudio.start()` actually starts that file playing, at `s3_mom_05`, the very start of
stage 3) — a real event trigger, not a computed duration, so phase 1 always hands off to phase 2 at
exactly the right instant regardless of whether the stage-2 pacing estimate drifts.

`field.js` also gives the sparse/outer dots (never the main-channel/dense-area dots — `MIN_SPEED`
is a plain constant, untouched) a joining-speed ramp: their ceiling speed (`MAX_SPEED`) starts at 0
right when `startFlow()` fires and eases up (gentle ease-in — `easeInCubic`, very slow start,
picking up pace toward the end) to the normal value over `MAX_SPEED_RAMP_UP_DURATION_SEC` (10s),
via `maxSpeedAt(elapsedSec)`, computed once per frame in `updateDots()` and threaded through
`speedAt()`'s existing density-based interpolation rather than reading the `MAX_SPEED` constant
directly.

Stage 2 also mirrors its own load_anim_1 (4 rotations) then load_anim_2 (3 rotations) spinner beats
— which normally only play inside `.frame`, right after the video ends — onto the field layer
itself: `#stage-2-field-spinner`, a direct child of `#stage-2` sitting right after the field canvas
(same stacking position as the canvas — behind `.frame`, harmlessly covered by it in single-window
combined-mode fallback, but visible on the field-only screen/window where `.frame` is hidden — the
normal case in the two-window exhibition setup). `stage2.js`'s
`playFieldSpinnerSequence()` runs the same `STS.runSpinner` calls against it, triggered directly
alongside `Field.stopFlow()` in the video's `ended` handler — not queued through the `moments[]`
array, since that queue's own `activate()` toggles `.moment.is-active` on every `.moment` in the
stage wholesale, which would fight this element's visibility; it's deliberately not a `.moment` and
instead gets its own `"is-active"` class, added/removed directly by `playFieldSpinnerSequence()` for
exactly the run's duration (`display: none` otherwise). **EXPERIMENTAL, may be reverted:** it's
currently styled as a 30vw square box (`padding: 6vw` — CSS `%` padding resolves against the
containing block's width, not the element's own, so the 20%-of-30vw inset had to be written as a
literal `6vw` rather than `padding: 20%`), centered via `inset:0; margin:auto`, filled with
50%-opacity black. (The explicit `is-active` toggle exists *because of* this fill — before it, the
box read as invisible whenever `STS.runSpinner` had cleared its content back to empty; once it had
a background color, an empty-but-displayed box still rendered as a plain black square.)

The shared spinner component (`.message-moment__spinner`, mounted by `STS.runSpinner` — used by
every frame spinner beat *and* the field-mirrored one above) reads its color and size from
`--spinner-color`/`--spinner-size` CSS variables (falling back to `--color-fg`/`28px`) instead of
hardcoded values, so `.frame` and `#stage-2-field-spinner` can each set their own independently.
**EXPERIMENTAL, may be reverted:** color is currently `red` on both, as a one-off visual test; the
field's `--spinner-size` is `15vw` (50% of its own 30vw box), so the field spinner scales with its
own wrap box instead of inheriting the frame's fixed pixel size.

## Screen split (frame/field) — the exhibition deployment

**This two-window split is the actual exhibition deployment plan, not a dev/testing convenience.**
The installation runs as two synced browser windows — one showing `.frame` (the phone-card UI,
driven to a monitor/screen facing the participant), the other showing the field canvas full-viewport
(driven to a second, ambient display) — kept in lockstep via `BroadcastChannel`. Single-window
`"combined"` mode (both rendered together, as most of this doc otherwise describes for brevity)
is a **fallback**, not the primary setup — useful for local dev on one screen, or as a degraded mode
if the second display isn't available, but not what actually ships.

`?screen=frame` / `?screen=field` / no param (`"combined"`, the fallback) as a URL query param, read
once in `shared.js` into `STS.screenMode` and mirrored to a `data-screen-mode` attribute on `<html>`
for CSS. `?screen=frame` hides the field canvas (`Field.setVisible(false)`, called from `field.js`'s
own `init()`) and shows only `.frame`; `?screen=field` hides `.frame` (`display: none`, in
`global.css`) and shows only the field canvas full-viewport — one window per physical display.

Both windows load the same `index.html`, so they're two independent JS contexts — without help
they'd each try to run a stage's real logic (video/audio, timers) independently and drift apart, or
worse, both play the video's audio at once. A `BroadcastChannel` (`"sculpting-the-silence-sync"`,
same name in both `shared.js` and `field.js`) is what keeps them in sync — this is production-critical
plumbing now, not an optional nicety: whichever window actually runs the real logic (combined or
frame mode — in field mode `.frame`'s CTA buttons are hidden/inert, so nothing ever triggers stage
logic there) broadcasts every `goToStage` call and every `startIdleJitter`/`startFlow`/`stopFlow`/
`setZoom`/`animateZoomTo`/`recoilZoom` call; the other window applies only the "is-active" class
(`shared.js`'s `applyActiveStageClass`, not the full handler — never re-triggers video/audio) or the
internal field function directly (`field.js`'s `onmessage`, not the broadcasting wrapper — never
re-broadcasts). A window also asks for the current stage on load (`{type:"request-state"}`) so
opening the field window after the frame window has already advanced catches it up. `BroadcastChannel`
requires same-origin, which holds for two `file://` windows of the same path in Chromium (tested) as
well as two tabs of the same local server — this needs to be re-verified against whatever exact
browser/config the exhibition kiosk machines actually run, since it's no longer just a local dev
convenience but a hard runtime dependency for the installation to function correctly.

New frame-triggered effects that need to reach the field (e.g. a CTA button click) should follow the
same pattern already established by `Field`'s own methods: a real local function call from the
triggering code (`window.Field.someMethod()`, same-window, same JS context — the button and
`window.Field` both live in whichever window is driving stage logic) wrapped by `field.js` itself
calling `broadcastFieldCall(...)` after running the real effect, so it's mirrored to the other window
for free without the caller needing to know `BroadcastChannel` exists.

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
