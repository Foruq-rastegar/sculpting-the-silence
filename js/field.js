/* ==========================================================================
   Sculpting the Silence — background point field
   Ported from prototypes/field-default.html (perspective, the curved
   "channel", the three dot populations, density-based speed, path wobble,
   the core density band, size gradient). Exposed as window.Field, grouped
   roughly by what it drives:
     - channel scene: init/startIdleJitter/startFlow/stopFlow/setZoom/
       animateZoomTo/recoilZoom/resetZoom/setVisible
     - stage-3 memorial reveal: startMemorialReveal/stopMemorialReveal/
       startFleeGroup
     - #11780/named-dot interactions: ready_to_call_status/
       doubleEleven780Size/removeEleven780/s4_heartbeat_anim/
       resolveNamedDot/getResolvedColor/showNameTooltip/hideNameTooltip
     - shared final scene (js/final-scene.js): startFinalScene/
       setFinalSceneAssignments/showFinalSceneTooltip/
       hideFinalSceneTooltip/focusFinalSceneOnly/revealFinalScene/
       setFinalScenePersistentLabel/clearFinalScenePersistentLabel/
       setFinalSceneTargetHighlight/clearFinalSceneTargetHighlight/
       startFinalSceneAnimation
   Driven externally by each stage's own timing rather than a fixed
   internal duration. Must load after js/final-scene.js (window.FinalScene,
   the shared final-scene dot pattern/renderer) and before any stage-N.js
   file that calls it. Every method above except init/setVisible also
   broadcasts over
   BroadcastChannel (see shared.js) for the frame/field screen split — the
   two-window exhibition deployment, not just a dev convenience; setVisible
   and init stay local to each window.
   ========================================================================== */

(function () {
  "use strict";

  // ---- Tunable constants (unchanged from the approved prototype) --------

  // Perspective — size gradient from the vanishing point (top) to nearest (bottom)
  var MIN_DOT_SIZE = 1;                 // px radius at the vanishing point (top)
  var MAX_DOT_SIZE = 8;                 // px radius at the nearest point (bottom)

  // The channel ("main street") — a single curved path dots flow along
  var CHANNEL_CURVE_PX = 140;           // how far left the channel drifts by the bottom
  var CHANNEL_FALLOFF = 6;              // higher = tighter channel (density falls off faster
                                         // with horizontal distance from the curve)
  var CHANNEL_CORE_BAND_FRAC = 0.025;   // width (as a fraction of screen width) of the flat
                                         // "core band" straddling the curve where density stays
                                         // at its maximum, before the falloff begins
  var DENSITY_TOP_TO_BOTTOM_BIAS = 2.4; // higher = channel density increases more steeply
                                         // toward the bottom (matches perspective)

  // Starting populations
  var CHANNEL_DOT_COUNT = 4800;         // population 1: already inside the channel
  var SIDE_STREET_DOT_COUNT = 560;      // population 2: on-screen, outside the channel
  var SIDE_STREET_SPREAD = 3;           // how much wider than the channel's own falloff the
                                         // side-street scatter is (sparser, wider spread)
  var OFFSCREEN_DOT_COUNT = 880;        // population 3: start entirely off-screen

  var OFFSCREEN_ENTRY_RATE = 24;        // off-screen dots entering the frame per second,
                                         // spread out (never a batch) once flow begins
  var ENTRY_STAGGER_SECONDS = 1.5;      // small random stagger so dots of a kind don't all
                                         // start moving in perfect unison

  // Density-based speed, in px/sec
  var MIN_SPEED = 4;                    // px/sec, densest areas — constant, untouched by the ramp below
  var MAX_SPEED = 5;                    // px/sec, sparsest areas — the *normal* (steady-state) value
  var CONVERGE_RATE = 0.6;              // 1/sec, how fast a side-street/off-screen dot's
                                         // offset collapses into the channel at top speed

  // Joining-speed ramp: the sparse/outer dots' ceiling speed (MAX_SPEED)
  // starts at 0 and eases up to normal over the first part of the flow
  // phase, rather than being at full speed immediately — a gentle ease-in
  // (very slow start, picking up pace toward the end). MIN_SPEED (the
  // main-channel/dense-area speed) is never touched. Timed from the
  // instant startFlow() fires (elapsedSec, reset to 0 there). See
  // maxSpeedAt() below.
  var MAX_SPEED_RAMP_UP_DURATION_SEC = 10; // ramps 0 -> normal MAX_SPEED over this long

  // Stage 3 memorial reveal (s3_mom_05 through s3_mom_10) — see
  // startMemorialReveal()/stopMemorialReveal() below for the full behavior.
  var MEMORIAL_EDGE_MARGIN_FRACTION = 0.3;  // tagging eligibility excludes this fraction from each edge — already exceeds item 2 (round 7)'s "at least 20% from the field's own edges" minimum, unchanged
  var MEMORIAL_GRAY_TOTAL_FRACTION = 0.2;   // 20% of all visible dots end up gray
  // Cumulative-fraction checkpoints used only to place dots within the
  // ordered reveal sequence (index i corresponds to reaching this fraction
  // of the full 20% cohort) — the reveal itself is one smooth continuous
  // sweep through that order, not discrete jumps at these points.
  var MEMORIAL_GRAY_STEP_FRACTIONS = [0.03, 0.07, 0.11, 0.16, 0.20];
  var MEMORIAL_ELEVEN_SEVEN_EIGHTY_STEP_INDEX = 2; // #11780 must be positioned at/before the 11% mark (index 2)
  // EXPERIMENTAL — colour test: was #808080 (achromatic gray); swapped to
  // red to see how it reads. mixWhiteToMemorialGray() below interpolates
  // per-channel now (rather than a single shared channel value) so this
  // still works once the target color is no longer achromatic.
  var MEMORIAL_GRAY_COLOR_RGB = { r: 255, g: 0, b: 0 };

  // Fleeing dots — the reverse of the joining-speed ramp above: starts at
  // MAX_SPEED (the same 5px/sec ceiling stage 2's flow uses) and eases down
  // to MIN_SPEED (4px/sec) over this duration, same easeInCubic shape as
  // maxSpeedAt() but run backwards, then holds at MIN_SPEED — a steady,
  // bounded drift rather than an unbounded burst.
  var EXIT_SPEED_RAMP_DURATION_SEC = 10;

  // EXPERIMENTAL — staggers the fleeing (non-memorial) dots into 4 groups
  // with separate start triggers instead of all fleeing at once (see
  // startFleeGroup() below). Shares of the fleeing pool, not cumulative.
  var MEMORIAL_FLEE_GROUP_FRACTIONS = [0.4, 0.3, 0.2, 0.1];
  // Group 4 ("the wounded") uses a visibly slower bounded range than the
  // other 3 groups — roughly half of MIN_SPEED/MAX_SPEED, tune to taste.
  var MEMORIAL_WOUNDED_MIN_SPEED = MIN_SPEED / 2;
  var MEMORIAL_WOUNDED_MAX_SPEED = MAX_SPEED / 2;
  // Random per-dot offset added on top of each dot's "straight away from
  // the field's center" base angle, so dots that start close together
  // (most of the population, tightly clustered along the channel's own
  // left-curving line) don't all compute nearly-identical escape angles
  // and read as a herd — total width of the random range in radians, e.g.
  // Math.PI here means +/-90 degrees off the base angle. Capped at 90
  // degrees each way deliberately: cos(90deg) = 0, so the jittered
  // direction can never end up pointing back toward center, only anywhere
  // from "straight out" to "sideways" relative to it.
  var MEMORIAL_FLEE_DIRECTION_SPREAD_RAD = Math.PI;

  // EXPERIMENTAL — leftover white dots still fleeing (or never triggered)
  // when s3_gunshot_snd stops: split into 3 groups, each starting its own
  // gradual (not instant) fade to gray after its own delay, all finished
  // no later than MEMORIAL_LEFTOVER_TOTAL_DURATION_SEC after stop. Shares
  // of the leftover pool, not cumulative — see runLeftoverGrayOut() below.
  // Total duration was 8s (delays [0, 3, 5]) — stretched to 20s, delays
  // scaled by the same 2.5x (20/8) so the 30%/40%/30% group split and each
  // group's own relative pacing (delay vs. its own transition length,
  // durationSec = total - delay in runLeftoverGrayOut) stay identical,
  // just slower throughout.
  var MEMORIAL_LEFTOVER_GROUP_FRACTIONS = [0.3, 0.4, 0.3];
  var MEMORIAL_LEFTOVER_GROUP_DELAYS_SEC = [0, 7.5, 12.5];
  var MEMORIAL_LEFTOVER_TOTAL_DURATION_SEC = 20;

  var JITTER_AMOUNT = 1.4;              // px, idle wobble amplitude
  var JITTER_SPEED = 1.0;               // idle wobble oscillation speed multiplier

  // Path wobble — a proportion of side-street/off-screen dots take a slightly winding path
  // toward the channel instead of a dead-straight line
  var WOBBLE_PROPORTION = 0.4;          // fraction of non-channel dots that get any wobble at all
  var WOBBLE_AMOUNT = 34;               // px, max lateral wobble offset
  var WOBBLE_FREQUENCY = 8;             // noise "waves" per full top-to-bottom journey
  // -------------------------------------------------------------------------

  var canvas = null;
  var ctx = null;
  var width = 0;
  var height = 0;

  var dots = [];

  var rafId = null;
  var lastFrameTime = 0;
  var lastRenderedNowSec = 0;
  var physicsActive = false; // true once startFlow() has been called
  var elapsedSec = 0;        // time since startFlow() — gates staggered entry, not visibility

  var zoomScale = 1;
  var zoomPivotX = 0;
  var zoomPivotY = 0;
  var zoomAnimId = null; // rAF id for an in-flight zoom animation, separate from the main tick loop
  var zoomDelayTimeoutId = null; // setTimeout id for recoilZoom()'s pre-punch delay

  var memorialActive = false;
  var memorialAnimId = null;            // single rAF loop driving both fleeing motion and the smooth gray-out, separate from zoomAnimId/rafId
  var memorialElapsedSec = 0;           // time since startMemorialReveal() fired, reset there
  var memorialOrderedGrayDots = null;   // flat, ordered array of the full 20% cohort — revealed as a growing prefix
  var memorialRevealedCount = 0;        // how many of memorialOrderedGrayDots are currently gray
  // 4 independent flee groups (see startFleeGroup()) — each dot's own
  // fleeGroup (1-4) looks up its group's shared distanceTraveled at render
  // time; distanceTraveled only advances once that group's own elapsedSec
  // starts counting (i.e. once active is true).
  var memorialFleeGroups = null;
  var memorialEleven780Dot = null; // cached reference to the #11780 dot, set once in startMemorialReveal()
  var memorialLeftoverAnimId = null;   // rAF loop for the leftover-white-dots gradual gray-out (runLeftoverGrayOut())
  var memorialLeftoverDots = null;     // flat array of leftover dots, each with its own leftoverDelaySec/leftoverDurationSec

  /* ------------------------------------------------------------------
     Cross-window sync (BroadcastChannel) — dev/testing only, see
     shared.js. The window actually driving a stage's real logic (combined
     or frame mode) calls window.Field's methods normally; those wrapped
     methods (see the Public API section below) also broadcast the call so
     a field-mode window's own local Field instance mirrors the same
     motion state. Received messages call the internal functions directly
     (not the broadcasting wrapper) so nothing re-broadcasts.
     ------------------------------------------------------------------ */
  var SYNC_CHANNEL_NAME = "sculpting-the-silence-sync"; // must match shared.js's channel name
  var syncChannel = ("BroadcastChannel" in window) ? new BroadcastChannel(SYNC_CHANNEL_NAME) : null;

  function broadcastFieldCall(method, args) {
    if (syncChannel) syncChannel.postMessage({ type: "field", method: method, args: args || [] });
  }

  function gaussianRandom() {
    var u = 1 - Math.random();
    var v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // Fisher-Yates, in place — used by startMemorialReveal() to randomize
  // which dots fill out the 20% gray cohort beyond the 10 tagged ones.
  function shuffleArray(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
  }

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  // Ease-in-ease-out, 0..1 in, 0..1 out — used for the leftover-white-dots
  // gradual gray fade (runLeftoverGrayOut()) so each dot's own transition
  // reads as a genuine smooth fade rather than a linear ramp.
  function smoothstep(t) {
    var c = clamp01(t);
    return c * c * (3 - 2 * c);
  }

  // White -> MEMORIAL_GRAY_COLOR_RGB at a given fraction (0 = white, 1 =
  // fully the target color) — per-channel interpolation, since the target
  // is no longer guaranteed achromatic (see the color-test comment above).
  function mixWhiteToMemorialGray(fraction) {
    var f = clamp01(fraction);
    var r = Math.round(255 + (MEMORIAL_GRAY_COLOR_RGB.r - 255) * f);
    var g = Math.round(255 + (MEMORIAL_GRAY_COLOR_RGB.g - 255) * f);
    var b = Math.round(255 + (MEMORIAL_GRAY_COLOR_RGB.b - 255) * f);
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  // x position of the channel at depth t (0 = vanishing point/top, 1 = nearest/bottom).
  // Squared term makes the curve start nearly vertical and lean gradually left with depth.
  function channelXAt(t) {
    return width / 2 - CHANNEL_CURVE_PX * (t * t);
  }

  function sizeAt(t) {
    return MIN_DOT_SIZE + (MAX_DOT_SIZE - MIN_DOT_SIZE) * clamp01(t);
  }

  // How wide the channel's falloff is at a given depth (widens with depth, perspective).
  function channelSigmaAt(t) {
    return (width / CHANNEL_FALLOFF) * (0.3 + 0.7 * clamp01(t));
  }

  // Local dot density near the channel at (t, offset): 0 (sparse) .. 1 (densest). Density is
  // flat at its maximum within a small core band straddling the curve, then falls off with
  // gaussian falloff beyond that band, rather than peaking at a single point.
  function densityAt(t, offset) {
    var sigma = channelSigmaAt(t);
    var coreHalfWidth = (width * CHANNEL_CORE_BAND_FRAC) / 2;
    var beyondCore = Math.max(0, Math.abs(offset) - coreHalfWidth);
    var lateral = Math.exp(-(beyondCore * beyondCore) / (2 * sigma * sigma));
    var vertical = Math.pow(clamp01(t), DENSITY_TOP_TO_BOTTOM_BIAS);
    return vertical * lateral;
  }

  // Very slow start, picking up pace toward the end — used by maxSpeedAt()'s
  // joining-speed ramp below, and (run backwards) by exitSpeedAt() further
  // down for the memorial reveal's fleeing dots.
  function easeInCubic(t) {
    return t * t * t;
  }

  // The sparse/outer-dot ceiling speed at a given point in the flow phase
  // (elapsedSec, time since startFlow()): eases from 0 up to the normal
  // MAX_SPEED over MAX_SPEED_RAMP_UP_DURATION_SEC, then holds at MAX_SPEED.
  // MIN_SPEED (the main-channel/dense-area speed) never goes through this
  // function and is unaffected.
  function maxSpeedAt(elapsedSec) {
    if (elapsedSec >= MAX_SPEED_RAMP_UP_DURATION_SEC) {
      return MAX_SPEED;
    }
    var t = elapsedSec / MAX_SPEED_RAMP_UP_DURATION_SEC;
    return MAX_SPEED * easeInCubic(t);
  }

  // The reverse of maxSpeedAt() above: starts at a ceiling speed and eases
  // down to a floor speed over EXIT_SPEED_RAMP_DURATION_SEC (same
  // easeInCubic shape run backwards in time), then holds at the floor —
  // bounded, not an unbounded/dynamically-scaled speed. useWoundedRange
  // switches to MEMORIAL_WOUNDED_MIN_SPEED/MAX_SPEED (flee group 4, "the
  // wounded") instead of the normal MIN_SPEED/MAX_SPEED (groups 1-3,
  // stage 2's own flow range). Used by the memorial reveal's fleeing dots
  // (see startFleeGroup() below).
  function exitSpeedAt(elapsedSec, useWoundedRange) {
    var floorSpeed = useWoundedRange ? MEMORIAL_WOUNDED_MIN_SPEED : MIN_SPEED;
    var ceilingSpeed = useWoundedRange ? MEMORIAL_WOUNDED_MAX_SPEED : MAX_SPEED;
    if (elapsedSec >= EXIT_SPEED_RAMP_DURATION_SEC) {
      return floorSpeed;
    }
    var t = 1 - elapsedSec / EXIT_SPEED_RAMP_DURATION_SEC;
    return floorSpeed + (ceilingSpeed - floorSpeed) * easeInCubic(t);
  }

  // Forward-drift pace in px/sec: maxSpeed (see maxSpeedAt()) in sparse
  // areas, easing down to MIN_SPEED as density rises. MIN_SPEED itself is
  // always the constant declared above, regardless of maxSpeed.
  function speedAt(t, offset, maxSpeed) {
    var density = densityAt(t, offset);
    return maxSpeed - (maxSpeed - MIN_SPEED) * density;
  }

  // Minimal smooth 1D value noise (Perlin-style) — no external deps.
  function noiseHashAt(n) {
    var s = Math.sin(n * 127.1) * 43758.5453123;
    return s - Math.floor(s);
  }

  function noise1D(x) {
    var i = Math.floor(x);
    var f = x - i;
    var u = f * f * (3 - 2 * f);
    return noiseHashAt(i) + (noiseHashAt(i + 1) - noiseHashAt(i)) * u;
  }

  // Perpendicular-to-travel wobble offset for a dot, in px. Zero for dots that weren't
  // assigned a wobble, or for channel dots (which already ride the channel itself).
  function wobbleAt(d) {
    if (!d.hasWobble) return 0;
    var n = noise1D(d.t * WOBBLE_FREQUENCY + d.noiseSeed);
    return (n - 0.5) * 2 * WOBBLE_AMOUNT;
  }

  function randomJitterPhases() {
    return {
      phaseX: Math.random() * Math.PI * 2,
      phaseY: Math.random() * Math.PI * 2,
      freqX: 0.6 + Math.random() * 0.6,
      freqY: 0.6 + Math.random() * 0.6
    };
  }

  function makeDot(t, offset, isChannelDot, alwaysVisible, entryTimeSec) {
    var phases = randomJitterPhases();
    return {
      t: t,
      offset: offset,
      isChannelDot: isChannelDot,
      alwaysVisible: alwaysVisible, // on-screen from the start (channel/side-street); false
                                    // for off-screen dots, which stay hidden until entryTimeSec
      entryTimeSec: entryTimeSec,
      hasWobble: !isChannelDot && Math.random() < WOBBLE_PROPORTION,
      noiseSeed: Math.random() * 1000,
      phaseX: phases.phaseX,
      phaseY: phases.phaseY,
      freqX: phases.freqX,
      freqY: phases.freqY
    };
  }

  // Population 1: already inside the channel, tightly bound to its density falloff.
  function makeChannelDot() {
    var t = Math.pow(Math.random(), 1 / DENSITY_TOP_TO_BOTTOM_BIAS);
    var offset = gaussianRandom() * channelSigmaAt(t);
    return makeDot(t, offset, true, true, 0);
  }

  // Population 2: on-screen, outside the channel — sparser, wider spread, already visible.
  function makeSideStreetDot() {
    var t = Math.random();
    var offset = gaussianRandom() * channelSigmaAt(t) * SIDE_STREET_SPREAD;
    var entryTimeSec = Math.random() * ENTRY_STAGGER_SECONDS;
    return makeDot(t, offset, false, true, entryTimeSec);
  }

  // A point just outside the canvas bounds, near an edge.
  function offscreenPoint() {
    var margin = Math.min(width, height) * 0.25;
    var r = Math.random();
    var x, y;
    if (r < 0.4) {
      x = -Math.random() * margin;
      y = Math.random() * height * 0.7;
    } else if (r < 0.8) {
      x = width + Math.random() * margin;
      y = Math.random() * height * 0.7;
    } else if (r < 0.9) {
      x = Math.random() * width;
      y = -Math.random() * margin;
    } else {
      x = Math.random() * width;
      y = height + Math.random() * margin * 0.5;
    }
    return { x: x, y: y };
  }

  // Population 3: start entirely off-screen, hidden until their staggered entry time (paced
  // by OFFSCREEN_ENTRY_RATE) once flow begins, so the edges never dump in a batch.
  function makeOffscreenDot(index) {
    var p = offscreenPoint();
    var t = clamp01(p.y / height);
    var offset = p.x - channelXAt(t);
    var entryTimeSec = (index / OFFSCREEN_ENTRY_RATE) + Math.random() * ENTRY_STAGGER_SECONDS;
    return makeDot(t, offset, false, false, entryTimeSec);
  }

  function generateDots() {
    dots = [];
    var i;
    for (i = 0; i < CHANNEL_DOT_COUNT; i++) dots.push(makeChannelDot());
    for (i = 0; i < SIDE_STREET_DOT_COUNT; i++) dots.push(makeSideStreetDot());
    for (i = 0; i < OFFSCREEN_DOT_COUNT; i++) dots.push(makeOffscreenDot(i));
  }

  function updateDots(dt) {
    var maxSpeed = maxSpeedAt(elapsedSec); // same for every dot this frame

    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      if (d.isMemorial || d.isFleeing) continue; // driven by the memorial reveal instead, see below
      if (elapsedSec < d.entryTimeSec) continue;

      var speed = speedAt(d.t, d.offset, maxSpeed); // px/sec
      d.t += (speed / height) * dt;

      if (!d.isChannelDot) {
        // Ease the offset into the channel at a rate tied to the same density-driven pace.
        // Deliberately normalized against the constant MAX_SPEED, not the local ramped
        // maxSpeed — maxSpeed is intentionally near 0 early in the joining-speed ramp, and
        // dividing by it there would blow up this ratio and snap dots onto the channel
        // line almost instantly. Keeps convergence decoupled from the forward-speed ramp.
        var decay = CONVERGE_RATE * (speed / MAX_SPEED);
        d.offset *= Math.exp(-decay * dt);
      }
    }
  }

  function jitter(nowSec, phase, freq) {
    return JITTER_AMOUNT * Math.sin(nowSec * JITTER_SPEED * freq + phase);
  }

  // Un-transformed (pre-zoom) canvas-space position of a dot at the given
  // point in time — factored out of renderFrame's per-dot loop so
  // drawActiveNameTooltip() (see below) can place text at the exact same
  // spot a dot itself is drawn at, without duplicating this branching.
  function dotPosition(d, nowSec) {
    if (d.isFleeing) {
      // Driven entirely by this dot's own flee group's shared
      // distanceTraveled (see startFleeGroup()), not the channel model —
      // no jitter/wobble, a straight line away from the field's center.
      var fleeGroup = memorialFleeGroups[d.fleeGroup - 1];
      return {
        x: d.fleeStartX + d.fleeDirX * fleeGroup.distanceTraveled,
        y: d.fleeStartY + d.fleeDirY * fleeGroup.distanceTraveled
      };
    }
    if (d.isMemorial) {
      // Frozen the instant the memorial reveal started (updateDots skips
      // these, so t/offset never change) — no jitter/wobble, "stays in
      // place" as specified.
      return { x: channelXAt(d.t) + d.offset, y: d.t * height };
    }
    return {
      x: channelXAt(d.t) + d.offset + wobbleAt(d) + jitter(nowSec, d.phaseX, d.freqX),
      y: d.t * height + jitter(nowSec, d.phaseY, d.freqY)
    };
  }

  // Same screen-space formula the zoom transform itself applies (see the
  // ctx.setTransform call in renderFrame) — used to place the name-tooltip
  // text at a dot's real on-screen position while drawing it with the
  // transform reset to identity (see drawActiveNameTooltip()), so the text
  // stays a constant screen size regardless of zoom instead of scaling
  // with it.
  function canvasToScreen(x, y) {
    return {
      x: zoomPivotX * (1 - zoomScale) + x * zoomScale,
      y: zoomPivotY * (1 - zoomScale) + y * zoomScale
    };
  }

  function renderFrame(nowSec) {
    if (!ctx) return;
    lastRenderedNowSec = nowSec;

    // Background fill always covers the untransformed viewport exactly, regardless of zoom.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);

    // Zoom is a camera transform around a pivot point on the channel — dots (and their
    // sizes) are magnified along with everything else, no per-dot math needed.
    ctx.setTransform(
      zoomScale, 0, 0, zoomScale,
      zoomPivotX * (1 - zoomScale),
      zoomPivotY * (1 - zoomScale)
    );

    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      if (!d.alwaysVisible && elapsedSec < d.entryTimeSec) continue;

      var pos = dotPosition(d, nowSec);
      var x = pos.x, y = pos.y;

      // permanentColor (set by resolveNamedDot() once an s4_name_0N dot's
      // heartbeat is resolved) wins outright; otherwise colorMix (0 = white,
      // 1 = fully the memorial color) is the source of truth for gray/red
      // rendering: the original 20% cohort sets it straight to 1 (instant,
      // as before), while leftover-white dots (runLeftoverGrayOut) ease it
      // up gradually — both paths just read the same value here.
      ctx.fillStyle = d.permanentColor ? d.permanentColor : (d.colorMix ? mixWhiteToMemorialGray(d.colorMix) : "#fff");

      // EXPERIMENTAL — #11780-only doubled radius (doubleEleven780Size()),
      // and s4_heartbeat_anim()'s own continuous pulse (see below) both
      // ride the same sizeMultiplier.
      var radius = (sizeAt(d.t) / 2) * (d.sizeMultiplier || 1);

      // Dots continue past the bottom edge (passing by, not stopping dead) — no need to
      // clamp or cull, the canvas simply won't render points outside its bounds.
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      // #11780's "ready to call" marking — a plain white 1px stroke, no
      // blur (see ready_to_call_status() below; an earlier red/blurred
      // version wasn't good and was replaced with this).
      if (d.readyToCallStroke) {
        ctx.save();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
    }

    drawActiveNameTooltip(nowSec);
  }

  function tick(now) {
    var dt = lastFrameTime ? Math.min((now - lastFrameTime) / 1000, 0.05) : 0;
    lastFrameTime = now;

    if (physicsActive) {
      elapsedSec += dt;
      updateDots(dt);
    }

    renderFrame(now / 1000);
    rafId = requestAnimationFrame(tick);
  }

  function startLoop() {
    if (rafId !== null) return; // already running (idle jitter and/or flow)
    lastFrameTime = 0;
    rafId = requestAnimationFrame(tick);
  }

  function stopLoop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function resize() {
    if (!canvas) return;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    generateDots();
    renderFrame(lastRenderedNowSec);
  }

  // .stage uses position:fixed, which always forms its own stacking context
  // in every modern browser regardless of z-index — so as a sibling living
  // outside every .stage, this canvas can only ever paint entirely behind or
  // entirely in front of the active stage's full contents as one atomic
  // block; no z-index value can slot it "between" a stage's own
  // .background-layer and its .frame. The fix is to physically move this
  // same canvas node (preserving its bitmap/context/animation state) to be a
  // child of whichever .stage is active, right after that stage's own
  // .background-layer — within a single stacking context, plain DOM order
  // then does the right thing: background-layer, then canvas, then .frame.
  function reparentIntoActiveStage() {
    if (!canvas) return;
    var activeStage = document.querySelector(".stage.is-active");
    if (!activeStage) return;

    var backgroundLayer = activeStage.querySelector(".background-layer");
    if (backgroundLayer) {
      if (backgroundLayer.nextElementSibling !== canvas) {
        backgroundLayer.insertAdjacentElement("afterend", canvas);
      }
    } else if (activeStage.firstChild !== canvas) {
      activeStage.insertBefore(canvas, activeStage.firstChild);
    }
  }

  // Stage transitions toggle "is-active" on the relevant .stage elements
  // (see STS.goToStage in shared.js) — watching for that class change here
  // keeps the canvas correctly placed with no changes needed to shared.js
  // or any stage-N.js file, now or as future stages wire up their own timing.
  function watchStageChanges() {
    var stages = document.querySelectorAll(".stage");
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].attributeName === "class") {
          reparentIntoActiveStage();
          return;
        }
      }
    });
    stages.forEach(function (stageEl) {
      observer.observe(stageEl, { attributes: true, attributeFilter: ["class"] });
    });
  }

  /* ------------------------------------------------------------------
     Public API
     ------------------------------------------------------------------ */

  // Sets up the field on the given canvas and renders its static default
  // state. No motion at all until startIdleJitter()/startFlow() are called.
  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext("2d");
    zoomScale = 1;
    zoomPivotX = 0;
    zoomPivotY = 0;
    physicsActive = false;
    elapsedSec = 0;

    reparentIntoActiveStage();
    watchStageChanges();

    window.addEventListener("resize", resize);
    resize(); // sizes the canvas, generates dots, draws one static frame

    // Dev/testing screen modes (see shared.js): ?screen=frame shows only
    // .frame (CSS handles that), so hide the field here to match; the
    // engine keeps running underneath, just not painted.
    if (window.STS && window.STS.screenMode === "frame") {
      setVisible(false);
    }
  }

  // Shows/hides the canvas without touching its running animation state —
  // used by ?screen=frame (dev/testing, see shared.js) to hide the field
  // while .frame is shown. Purely local: visibility depends on which
  // screen mode THIS window is, so it's never broadcast to the other one.
  function setVisible(visible) {
    if (!canvas) return;
    canvas.style.display = visible ? "" : "none";
  }

  // Dots only do their small idle wobble in place — no directional movement.
  function startIdleJitter() {
    if (!canvas) return;
    startLoop();
  }

  // Begins the channel-joining movement. Duration isn't hardcoded here — the
  // caller drives how long this runs and calls stopFlow() when it should end.
  function startFlow() {
    if (!canvas) return;
    if (!physicsActive) elapsedSec = 0; // flow's own clock starts fresh
    physicsActive = true;
    startLoop(); // no-op if the loop is already running from startIdleJitter()
  }

  // Freezes all motion immediately — dots hold wherever they currently are.
  function stopFlow() {
    stopLoop();
    physicsActive = false;
  }

  // Zooms the camera around the channel's center (its position at mid-depth),
  // so dots appear larger/more distinguishable. scale 1 = no zoom.
  function setZoom(scale) {
    cancelZoomAnimation();
    zoomScale = scale;
    zoomPivotX = channelXAt(0.5);
    zoomPivotY = height * 0.5;
    renderFrame(lastRenderedNowSec); // force a redraw even while frozen/static
  }

  // Sharper than a cubic ease-out (quartic) — fast initial drop that settles
  // very quickly, used by recoilZoom's punchy "kick" (see below). This is
  // the only preset easing curve left in the zoom code; the buildup below is
  // a from-scratch analytic ramp/linear blend, not a named easing preset.
  function easeOutQuart(t) {
    var inv = 1 - t;
    return 1 - inv * inv * inv * inv;
  }

  function cancelZoomAnimation() {
    if (zoomAnimId !== null) {
      cancelAnimationFrame(zoomAnimId);
      zoomAnimId = null;
    }
    if (zoomDelayTimeoutId !== null) {
      clearTimeout(zoomDelayTimeoutId);
      zoomDelayTimeoutId = null;
    }
  }

  // Phase 1 — buildup: a brief quadratic ease-in (constant acceleration from
  // rest, position(t) = a*t^2) for the first ZOOM_BUILDUP_RAMP_FRACTION of
  // the duration, then constant-velocity linear motion for the rest of it.
  // "a" is solved so the two segments meet with matching position AND
  // velocity at the seam (no visible speed jump) and the whole curve lands
  // at exactly 1.0 (i.e. targetScale) when t=1 — not a percentage-based
  // keyframe table, just one algebraic split with no other easing applied
  // on top.
  var ZOOM_BUILDUP_RAMP_FRACTION = 0.15; // fraction of the duration spent easing in before going linear

  function buildupFraction(t) {
    var r = ZOOM_BUILDUP_RAMP_FRACTION;
    var a = 1 / (r * (2 - r)); // solved from: a*r^2 + (2*a*r)*(1-r) = 1

    if (t <= r) {
      return a * t * t;
    }

    var rampEndValue = a * r * r;
    var rampEndVelocity = 2 * a * r; // matches the ramp's slope at t=r, in fraction-per-t units
    return rampEndValue + rampEndVelocity * (t - r);
  }

  // Eases the camera zoom from its current scale to targetScale over
  // durationMs using buildupFraction (see above) — e.g. stage 2's zoom
  // building up across the real elapsed time until s3_gunshot_snd starts
  // playing. Runs its own rAF loop so it animates even while the main tick
  // loop isn't running (e.g. after stopFlow() has frozen the field). Has its
  // own pivot recompute (matching setZoom) so it works regardless of
  // whether the canvas was just resized.
  function animateZoomTo(targetScale, durationMs) {
    if (!canvas) return;
    cancelZoomAnimation();

    if (!durationMs || durationMs <= 0) {
      setZoom(targetScale);
      return;
    }

    var startScale = zoomScale;
    var startTime = null;
    zoomPivotX = channelXAt(0.5);
    zoomPivotY = height * 0.5;

    function step(now) {
      if (startTime === null) startTime = now;
      var t = Math.min((now - startTime) / durationMs, 1);
      zoomScale = startScale + (targetScale - startScale) * buildupFraction(t);
      renderFrame(lastRenderedNowSec);

      if (t < 1) {
        zoomAnimId = requestAnimationFrame(step);
      } else {
        zoomAnimId = null;
      }
    }

    zoomAnimId = requestAnimationFrame(step);
  }

  // Phase 2 — recoil: delay, then a sharp punch, then a decaying elastic
  // settle. Call recoilZoom() directly off the real event that should
  // trigger it (e.g. s3_gunshot_snd's "play" event in stage3.js), not a
  // computed delay — the ZOOM_RECOIL_DELAY_MS wait below happens *inside*
  // this function, so phase 1 (animateZoomTo) still hands off to phase 2 at
  // exactly the right instant regardless of how long phase 1 actually ran.
  var ZOOM_RECOIL_DELAY_MS = 100;               // 0.1s reaction beat before the punch starts
  var ZOOM_RECOIL_DROP_FRACTION = 0.3;          // punch sheds 30% of whatever scale it's at
  var ZOOM_RECOIL_PUNCH_DURATION_MS = 200;      // 0.2s sharp drop
  var ZOOM_RECOIL_SETTLE_DURATION_MS = 200;     // 0.2s decaying wobble right after the punch
  var ZOOM_RECOIL_SETTLE_WOBBLE_FRACTION = 0.1; // wobble envelope: roughly +/-10% of the settled scale
  var ZOOM_RECOIL_SETTLE_CYCLES = 2.5;          // oscillation cycles across the settle window

  // Settle/shake: a genuine decaying elastic oscillation (small range, short
  // duration, a physical camera-shake settle) around settledScale — unlike
  // phase 1's buildup, an elastic wobble is the right fit here. The
  // envelope is (1 - t) * ZOOM_RECOIL_SETTLE_WOBBLE_FRACTION: zero at t=0,
  // so it starts exactly where the punch left off (no jump), and zero at
  // t=1, so it lands at exactly settledScale rather than merely approaching
  // it asymptotically.
  function runRecoilSettle(settledScale) {
    var startTime = null;

    function step(now) {
      if (startTime === null) startTime = now;
      var t = Math.min((now - startTime) / ZOOM_RECOIL_SETTLE_DURATION_MS, 1);
      var envelope = ZOOM_RECOIL_SETTLE_WOBBLE_FRACTION * (1 - t);
      var oscillation = Math.sin(2 * Math.PI * ZOOM_RECOIL_SETTLE_CYCLES * t);
      zoomScale = settledScale * (1 + envelope * oscillation);
      renderFrame(lastRenderedNowSec);

      if (t < 1) {
        zoomAnimId = requestAnimationFrame(step);
      } else {
        zoomScale = settledScale; // exact settle, no residual floating-point wobble
        renderFrame(lastRenderedNowSec);
        zoomAnimId = null;
      }
    }

    zoomAnimId = requestAnimationFrame(step);
  }

  // Punch: sharp ease-out drop from the current scale to -30% of it, then
  // chains straight into the settle/shake above.
  function runRecoilPunch() {
    var startScale = zoomScale;
    var settledScale = startScale * (1 - ZOOM_RECOIL_DROP_FRACTION);
    var startTime = null;

    function step(now) {
      if (startTime === null) startTime = now;
      var t = Math.min((now - startTime) / ZOOM_RECOIL_PUNCH_DURATION_MS, 1);
      zoomScale = startScale + (settledScale - startScale) * easeOutQuart(t);
      renderFrame(lastRenderedNowSec);

      if (t < 1) {
        zoomAnimId = requestAnimationFrame(step);
      } else {
        runRecoilSettle(settledScale);
      }
    }

    zoomAnimId = requestAnimationFrame(step);
  }

  function recoilZoom() {
    if (!canvas) return;
    cancelZoomAnimation();
    zoomPivotX = channelXAt(0.5);
    zoomPivotY = height * 0.5;

    zoomDelayTimeoutId = setTimeout(function () {
      zoomDelayTimeoutId = null;
      runRecoilPunch();
    }, ZOOM_RECOIL_DELAY_MS);
  }

  // EXPERIMENTAL, may be reverted — test alternative to recoilZoom() above
  // (left fully intact, just unused while this is active): rather than
  // holding at rest and then snapping, resetZoom() actively continues the
  // zoom-in through the window before the snap — a faster, further push
  // past stage2.js's STAGE2_FIELD_ZOOM buildup target, sustained for
  // ZOOM_RESET_PUSH_DURATION_MS (building more tension right as the
  // gunshot fires) — then snaps back down to a fixed 1.0 (no zoom at all)
  // over the short ZOOM_RESET_SNAP_DURATION_MS that follows, using the
  // same easeOutQuart punch curve as recoilZoom. Sequence: trigger -> 0.6s
  // continued push-in -> 0.15s sharp snap to 1x. Call directly off the
  // same real event recoilZoom used to be triggered from (s3_gunshot_snd's
  // "play" event in stage3.js).
  var ZOOM_RESET_PUSH_SCALE = 1.6;       // further zoom-in target during the push, beyond stage2.js's STAGE2_FIELD_ZOOM buildup
  var ZOOM_RESET_PUSH_DURATION_MS = 600; // 0.6s continued push-in, faster than phase 1's buildup
  var ZOOM_RESET_SNAP_DURATION_MS = 150; // 0.15s sharp snap back to 1x

  function runZoomResetSnap() {
    var startScale = zoomScale;
    var startTime = null;

    function step(now) {
      if (startTime === null) startTime = now;
      var t = Math.min((now - startTime) / ZOOM_RESET_SNAP_DURATION_MS, 1);
      zoomScale = startScale + (1 - startScale) * easeOutQuart(t);
      renderFrame(lastRenderedNowSec);

      if (t < 1) {
        zoomAnimId = requestAnimationFrame(step);
      } else {
        zoomScale = 1; // exact settle, no residual floating-point drift
        renderFrame(lastRenderedNowSec);
        zoomAnimId = null;
      }
    }

    zoomAnimId = requestAnimationFrame(step);
  }

  // Linear — a faster, steady continued push-in, distinct from phase 1's
  // ease-in-then-linear buildup — straight into runZoomResetSnap() the
  // instant it reaches ZOOM_RESET_PUSH_SCALE.
  function runZoomResetPush() {
    var startScale = zoomScale;
    var startTime = null;

    function step(now) {
      if (startTime === null) startTime = now;
      var t = Math.min((now - startTime) / ZOOM_RESET_PUSH_DURATION_MS, 1);
      zoomScale = startScale + (ZOOM_RESET_PUSH_SCALE - startScale) * t;
      renderFrame(lastRenderedNowSec);

      if (t < 1) {
        zoomAnimId = requestAnimationFrame(step);
      } else {
        zoomScale = ZOOM_RESET_PUSH_SCALE;
        renderFrame(lastRenderedNowSec);
        runZoomResetSnap();
      }
    }

    zoomAnimId = requestAnimationFrame(step);
  }

  function resetZoom() {
    if (!canvas) return;
    cancelZoomAnimation();
    zoomPivotX = channelXAt(0.5);
    zoomPivotY = height * 0.5;
    runZoomResetPush();
  }

  /* ------------------------------------------------------------------
     Stage 3 memorial reveal (s3_mom_05 through s3_mom_10) — two parallel
     behaviors, both started by startMemorialReveal() and both guaranteed
     to reach their end state exactly when stopMemorialReveal() is called
     (stage3.js calls these directly off s3_gunshot_snd's "play"/"pause"
     events, the same event-driven pattern as recoilZoom()). Both run off a
     single shared rAF loop (runMemorialTick) for the entire START-to-STOP
     window, not a short burst:

     1. A fixed 20% of all currently-visible dots turn gray via one smooth,
        continuous linear sweep from 0% to 20% across the real START-to-
        STOP duration (estimatedDurationMs is a pacing guess only — the
        real "play" to "pause" gap is user-paced and can't be known in
        advance). 10 specific dots are tagged as part of that 20%: the most
        central on-screen dot (excluding any candidate the active .frame's
        own content would cover — see frameOccupiesScreenPos(), item 5) as
        "#11780", plus 9 more central dots as "s4_name_01".."s4_name_09".
        Dots are revealed in a precomputed
        order built from 5 cumulative-fraction checkpoints
        (MEMORIAL_GRAY_STEP_FRACTIONS) — #11780 is positioned at the 11%
        checkpoint, the other 9 spread round-robin across all 5 — so they
        still land at the same relative point in the timeline as before,
        just reached by continuous sweep instead of a discrete jump. The
        remaining, untagged dots that pad out the 20% are chosen with a
        weighted bias toward the main flow channel (reusing densityAt()) and
        away from the field's edges (see memorialGraySelectionWeight()).
        Every dot in the 20% freezes in place (no drift, no jitter) the
        instant the reveal starts, not just once it visibly turns gray.
     2. EXPERIMENTAL — every other visible dot flees straight away from the
        field's center, but not all at once: split into 4 groups
        (MEMORIAL_FLEE_GROUP_FRACTIONS, 40/30/20/10%) with separate start
        triggers. Group 1 starts right here in startMemorialReveal() itself
        (stage3.js calls that off s3_gunshot_snd's "play" event); groups
        2-4 are started later by stage3.js calling startFleeGroup(2|3|4)
        off frame-side leak-shown signals (s3_leak_01_vid/02_img/03_img —
        see stage3.js, since images have no native "play" event to hook the
        way audio/video do). Each group has its own independent speed ramp
        — starts at MAX_SPEED and eases down to MIN_SPEED over
        EXIT_SPEED_RAMP_DURATION_SEC (the reverse of maxSpeedAt()'s joining
        ramp, bounded within the same range rather than an unbounded burst),
        then holds at MIN_SPEED — except group 4 ("the wounded"), which
        uses MEMORIAL_WOUNDED_MIN_SPEED/MAX_SPEED, a visibly slower range.
        stopMemorialReveal() force-completes the gray-out (grays out any
        still-pending dots) and starts a *gradual* gray-out for whatever's
        still white at that exact instant (see runLeftoverGrayOut(): 3
        staggered groups, each easing its own color from white to gray, all
        finished within MEMORIAL_LEFTOVER_TOTAL_DURATION_SEC) rather than
        snapping them all gray instantly — so no white dots linger or keep
        fleeing indefinitely once s3_gunshot_snd actually stops, but the
        transition itself still reads as a fade, not a jump. Position is
        untouched throughout (frozen wherever each dot's own flee group had
        gotten to).

     Separately, ready_to_call_status()/doubleEleven780Size() (plus
     s4_heartbeat_anim(), see further below) are one-off, independent
     visual tweaks to the cached #11780 dot (memorialEleven780Dot) — a
     plain white 1px stroke (no blur), a doubled radius, and a continuous
     pulse respectively — all three triggered together by stage3.js off
     #11780's own text showing as a frame-side resource (s3_mom_11),
     unrelated to whether the reveal/flee/leftover-gray-out machinery
     above is still running.
     ------------------------------------------------------------------ */

  function isVisibleDot(d) {
    return d.alwaysVisible || elapsedSec >= d.entryTimeSec;
  }

  function baseDotPosition(d) {
    return { x: channelXAt(d.t) + d.offset, y: d.t * height };
  }

  // Selection weight for the untagged dots padding out the 20% gray cohort:
  // higher near the main flow channel (reusing densityAt()'s existing 0..1
  // "how close to the channel" measure) and lower near the field's edges
  // (same MEMORIAL_EDGE_MARGIN_FRACTION concept as the tagged dots' hard
  // central-40% box, but a smooth falloff here rather than a hard cutoff —
  // there needs to be a large enough pool to fill the full 20% cohort from,
  // which a strict central-only box wouldn't leave since the channel's own
  // density peaks toward the bottom/near edge, not the exact center).
  function memorialGraySelectionWeight(d) {
    var pos = baseDotPosition(d);
    var edgeMargin = Math.min(width, height) * MEMORIAL_EDGE_MARGIN_FRACTION;
    var edgeDist = Math.min(pos.x, width - pos.x, pos.y, height - pos.y);
    var edgeWeight = edgeMargin > 0 ? clamp01(edgeDist / edgeMargin) : 1;
    var channelWeight = densityAt(d.t, d.offset);
    return Math.max(0.05, channelWeight) * Math.max(0.05, edgeWeight);
  }

  // Weighted, without-replacement shuffle (standard trick: give every item
  // a Math.random()^(1/weight) key, sort descending) — like shuffleArray()
  // but biased by memorialGraySelectionWeight() instead of uniform.
  function weightedShuffleByChannelAndEdge(arr) {
    var keyed = arr.map(function (d) {
      return { dot: d, key: Math.pow(Math.random(), 1 / memorialGraySelectionWeight(d)) };
    });
    keyed.sort(function (a, b) { return b.key - a.key; });
    return keyed.map(function (entry) { return entry.dot; });
  }

  // Single shared rAF loop driving both memorial-reveal behaviors for the
  // whole START-to-STOP window (estimatedDurationSec paces the gray-out
  // sweep only — stopMemorialReveal() is what actually ends things).
  function runMemorialTick(estimatedDurationSec) {
    var lastNow = null;

    function step(now) {
      if (lastNow === null) lastNow = now;
      var dt = Math.min((now - lastNow) / 1000, 0.05);
      lastNow = now;
      memorialElapsedSec += dt;

      // Behavior 2: each active flee group advances independently, on its
      // own elapsedSec (time since *that* group's own trigger fired) and
      // own bounded speed range (group 4 uses the slower "wounded" range).
      for (var g = 0; g < memorialFleeGroups.length; g++) {
        var group = memorialFleeGroups[g];
        if (!group.active) continue;
        group.elapsedSec += dt;
        var isWoundedGroup = g === memorialFleeGroups.length - 1;
        group.distanceTraveled += exitSpeedAt(group.elapsedSec, isWoundedGroup) * dt;
      }

      // Behavior 1: smooth linear gray-out, 0 -> the full cohort size.
      var progress = estimatedDurationSec > 0 ? Math.min(memorialElapsedSec / estimatedDurationSec, 1) : 1;
      var targetRevealed = Math.floor(memorialOrderedGrayDots.length * progress);
      for (var i = memorialRevealedCount; i < targetRevealed; i++) {
        memorialOrderedGrayDots[i].colorMix = 1;
      }
      memorialRevealedCount = Math.max(memorialRevealedCount, targetRevealed);

      renderFrame(lastRenderedNowSec);

      if (memorialActive) {
        memorialAnimId = requestAnimationFrame(step);
      } else {
        memorialAnimId = null;
      }
    }

    memorialAnimId = requestAnimationFrame(step);
  }

  // Item 5 (bug-fix round 2) — general placement rule: no tagged dot
  // (#11780 or s4_name_01..09) may land underneath the active stage's
  // .frame content. .frame's own background is transparent — only its
  // inner .moment-content-box (per-moment, opaque) actually occludes
  // anything — but tagged dots freeze in place at tag time and then stay
  // frozen through every later stage-3/4 moment's own differently-sized
  // content-box, so this checks against .frame's own full bounding rect
  // (a stable superset of wherever any moment's content-box could ever
  // render within it) rather than the live content-box, which would only
  // be correct for whichever one moment happens to be on screen right
  // now. Screen-space (getBoundingClientRect(), real on-screen pixels),
  // compared against a dot's actual on-screen position AFTER the current
  // camera zoom (canvasToScreen()) — .frame is a plain DOM element, never
  // transformed by the canvas's own zoom, so comparing anything else
  // (e.g. raw untransformed canvas coordinates) would drift out of sync
  // with reality the moment zoomScale != 1.
  //
  // Bug fix (round 7, item 2) — the rect itself used to be the exact
  // exclusion zone, with no buffer, so a tagged dot could still land
  // immediately adjacent to .frame's edge and read as visually "stuck
  // to"/half-hidden-by it. Now padded out by FRAME_EXCLUSION_MARGIN_-
  // FRACTION (20%) of .frame's own width on every side before the
  // containment check, so a tagged dot always keeps at least that much
  // daylight around the frame, not just outside its literal box.
  var FRAME_EXCLUSION_MARGIN_FRACTION = 0.2;

  function frameOccupiesScreenPos(screenX, screenY) {
    var frameEl = document.querySelector(".stage.is-active .frame");
    if (!frameEl) return false;
    var rect = frameEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false; // hidden (e.g. the field-only screen mode)
    var margin = rect.width * FRAME_EXCLUSION_MARGIN_FRACTION;
    return screenX >= rect.left - margin && screenX <= rect.right + margin &&
      screenY >= rect.top - margin && screenY <= rect.bottom + margin;
  }

  // estimatedDurationMs: a pacing estimate for the smooth gray-out sweep
  // only (see stage3.js) — stopMemorialReveal() is the authoritative end,
  // called directly off the real stop event, not derived from this.
  function startMemorialReveal(estimatedDurationMs) {
    if (!canvas) return;
    if (memorialAnimId !== null) {
      cancelAnimationFrame(memorialAnimId);
      memorialAnimId = null;
    }

    var visibleDots = [];
    for (var i = 0; i < dots.length; i++) {
      if (isVisibleDot(dots[i])) visibleDots.push(dots[i]);
    }

    // -- Setup: tag 10 specific dots, all from the central 40% (excluding
    // MEMORIAL_EDGE_MARGIN_FRACTION from every edge) and never one the
    // active .frame's content would cover (item 5) --
    var marginX = width * MEMORIAL_EDGE_MARGIN_FRACTION;
    var marginY = height * MEMORIAL_EDGE_MARGIN_FRACTION;
    var centralCandidates = [];
    for (var i = 0; i < visibleDots.length; i++) {
      var pos = baseDotPosition(visibleDots[i]);
      if (pos.x < marginX || pos.x > width - marginX || pos.y < marginY || pos.y > height - marginY) continue;
      var screenPos = canvasToScreen(pos.x, pos.y);
      if (frameOccupiesScreenPos(screenPos.x, screenPos.y)) continue;
      centralCandidates.push(visibleDots[i]);
    }

    var eleven780Dot = null;
    var bestDistSq = Infinity;
    for (var i = 0; i < centralCandidates.length; i++) {
      var pos = baseDotPosition(centralCandidates[i]);
      var dx = pos.x - width / 2;
      var dy = pos.y - height / 2;
      var distSq = dx * dx + dy * dy;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        eleven780Dot = centralCandidates[i];
      }
    }

    var remainingCentral = centralCandidates.filter(function (d) { return d !== eleven780Dot; });
    shuffleArray(remainingCentral);
    var nameDots = remainingCentral.slice(0, 9);
    var taggedDots = eleven780Dot ? [eleven780Dot].concat(nameDots) : nameDots;

    if (eleven780Dot) {
      eleven780Dot.memorialTagId = "#11780";
      eleven780Dot.memorialStepIndex = MEMORIAL_ELEVEN_SEVEN_EIGHTY_STEP_INDEX;
    }
    memorialEleven780Dot = eleven780Dot; // cached for ready_to_call_status()/doubleEleven780Size()
    for (var i = 0; i < nameDots.length; i++) {
      nameDots[i].memorialTagId = "s4_name_0" + (i + 1);
      nameDots[i].memorialStepIndex = i % MEMORIAL_GRAY_STEP_FRACTIONS.length;
    }

    // -- Build the full 20% gray cohort: the 10 tagged dots plus others,
    // bucketed by which checkpoint's cumulative count they fill, topping
    // each bucket up so the cumulative count hits that checkpoint's target
    // fraction. The buckets are then flattened into one ordered array —
    // revealed as a smooth continuous sweep (runMemorialTick), not discrete
    // jumps at the checkpoints; the checkpoints only fix each dot's
    // position in that order (see the doc comment above). --
    var stepBuckets = [[], [], [], [], []];
    for (var i = 0; i < taggedDots.length; i++) {
      stepBuckets[taggedDots[i].memorialStepIndex].push(taggedDots[i]);
    }

    var pool = visibleDots.filter(function (d) { return taggedDots.indexOf(d) === -1; });
    pool = weightedShuffleByChannelAndEdge(pool);
    var poolCursor = 0;
    var cumulativeSoFar = 0;
    for (var step = 0; step < MEMORIAL_GRAY_STEP_FRACTIONS.length; step++) {
      cumulativeSoFar += stepBuckets[step].length;
      var targetCumulative = Math.round(visibleDots.length * MEMORIAL_GRAY_STEP_FRACTIONS[step]);
      while (cumulativeSoFar < targetCumulative && poolCursor < pool.length) {
        var extraDot = pool[poolCursor];
        extraDot.memorialStepIndex = step;
        stepBuckets[step].push(extraDot);
        poolCursor++;
        cumulativeSoFar++;
      }
    }

    var orderedGrayDots = stepBuckets[0].concat(stepBuckets[1], stepBuckets[2], stepBuckets[3], stepBuckets[4]);
    for (var i = 0; i < orderedGrayDots.length; i++) {
      var d = orderedGrayDots[i];
      d.isMemorial = true;
      d.colorMix = 0; // jumps to 1 as the continuous sweep passes this dot's index
    }

    // -- Behavior 2: everyone else visible is split into 4 flee groups
    // (MEMORIAL_FLEE_GROUP_FRACTIONS), away from the field's center. Every
    // dot gets its direction/start position fixed now, but only group 1's
    // dots are marked isFleeing right away — groups 2-4 wait for their own
    // startFleeGroup() trigger (see below) before they start moving. --
    var fleePool = [];
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      if (d.isMemorial || !isVisibleDot(d)) continue;
      fleePool.push(d);
    }
    shuffleArray(fleePool);

    memorialFleeGroups = [
      { distanceTraveled: 0, elapsedSec: 0, active: false },
      { distanceTraveled: 0, elapsedSec: 0, active: false },
      { distanceTraveled: 0, elapsedSec: 0, active: false },
      { distanceTraveled: 0, elapsedSec: 0, active: false }
    ];

    var fleeGroupCursor = 0;
    var fleeCumulativeFraction = 0;
    for (var g = 0; g < MEMORIAL_FLEE_GROUP_FRACTIONS.length; g++) {
      fleeCumulativeFraction += MEMORIAL_FLEE_GROUP_FRACTIONS[g];
      var isLastGroup = g === MEMORIAL_FLEE_GROUP_FRACTIONS.length - 1;
      var groupEnd = isLastGroup ? fleePool.length : Math.round(fleePool.length * fleeCumulativeFraction);
      for (; fleeGroupCursor < groupEnd; fleeGroupCursor++) {
        var fleeDot = fleePool[fleeGroupCursor];
        var pos = baseDotPosition(fleeDot);
        // Base angle: straight away from the field's center. Randomized
        // per-dot on top of that (see MEMORIAL_FLEE_DIRECTION_SPREAD_RAD)
        // so dots starting close together still scatter instead of moving
        // as a uniform herd.
        var baseAngle = Math.atan2(pos.y - height / 2, pos.x - width / 2);
        var angle = baseAngle + (Math.random() - 0.5) * MEMORIAL_FLEE_DIRECTION_SPREAD_RAD;
        fleeDot.fleeGroup = g + 1; // 1-4
        fleeDot.fleeStartX = pos.x;
        fleeDot.fleeStartY = pos.y;
        fleeDot.fleeDirX = Math.cos(angle);
        fleeDot.fleeDirY = Math.sin(angle);
        fleeDot.isFleeing = g === 0; // group 1 starts immediately; 2-4 wait for startFleeGroup()
      }
    }
    memorialFleeGroups[0].active = true;

    memorialOrderedGrayDots = orderedGrayDots;
    memorialRevealedCount = 0;
    memorialElapsedSec = 0;
    memorialActive = true;

    var estimatedDurationSec = (estimatedDurationMs > 0 ? estimatedDurationMs : 1) / 1000;
    runMemorialTick(estimatedDurationSec);
  }

  // Starts flee group 2, 3, or 4 (1-indexed) — group 1 already starts
  // inside startMemorialReveal() itself. A no-op if the reveal isn't
  // active or the group has already been started (guards against a
  // duplicate/out-of-order trigger from stage3.js).
  function startFleeGroup(groupNumber) {
    if (!memorialActive || !memorialFleeGroups) return;
    var group = memorialFleeGroups[groupNumber - 1];
    if (!group || group.active) return;

    group.active = true;
    group.elapsedSec = 0;
    for (var i = 0; i < dots.length; i++) {
      if (dots[i].fleeGroup === groupNumber) dots[i].isFleeing = true;
    }
  }

  // EXPERIMENTAL — leftover white dots (wounded, later died): 3 groups,
  // staggered start delays (MEMORIAL_LEFTOVER_GROUP_DELAYS_SEC), each
  // easing its own colorMix from 0 to 1 (smoothstep, not instant) over
  // whatever's left of MEMORIAL_LEFTOVER_TOTAL_DURATION_SEC after its own
  // delay — so a group starting later simply gets a shorter transition,
  // guaranteeing every group finishes at the same total deadline. Position
  // is untouched throughout (still driven by the dot's own flee group's,
  // by-then-frozen, distanceTraveled — see renderFrame).
  function runLeftoverGrayOut() {
    var lastNow = null;
    var elapsedSec = 0;

    function step(now) {
      if (lastNow === null) lastNow = now;
      var dt = Math.min((now - lastNow) / 1000, 0.05);
      lastNow = now;
      elapsedSec += dt;

      for (var i = 0; i < memorialLeftoverDots.length; i++) {
        var d = memorialLeftoverDots[i];
        var localElapsed = elapsedSec - d.leftoverDelaySec;
        var progress = d.leftoverDurationSec > 0 ? localElapsed / d.leftoverDurationSec : (localElapsed >= 0 ? 1 : 0);
        d.colorMix = smoothstep(progress);
      }

      renderFrame(lastRenderedNowSec);

      if (elapsedSec < MEMORIAL_LEFTOVER_TOTAL_DURATION_SEC) {
        memorialLeftoverAnimId = requestAnimationFrame(step);
      } else {
        // Exact final state, no residual floating-point shortfall.
        for (var i = 0; i < memorialLeftoverDots.length; i++) {
          memorialLeftoverDots[i].colorMix = 1;
        }
        renderFrame(lastRenderedNowSec);
        memorialLeftoverAnimId = null;
      }
    }

    memorialLeftoverAnimId = requestAnimationFrame(step);
  }

  // Authoritative end of the memorial reveal — call directly off the real
  // stop event (s3_gunshot_snd's "pause" in stage3.js), not a computed
  // delay. Force-completes the gray-out sweep regardless of where
  // startMemorialReveal()'s pacing estimate left it, then starts the
  // leftover-white-dots gradual gray-out above so no white dots linger or
  // continue fleeing indefinitely past this point.
  function stopMemorialReveal() {
    if (!memorialActive) return;
    memorialActive = false;

    if (memorialOrderedGrayDots) {
      for (var i = memorialRevealedCount; i < memorialOrderedGrayDots.length; i++) {
        memorialOrderedGrayDots[i].colorMix = 1;
      }
      memorialRevealedCount = memorialOrderedGrayDots.length;
    }

    if (memorialAnimId !== null) {
      cancelAnimationFrame(memorialAnimId);
      memorialAnimId = null;
    }

    // Every dot that was ever assigned to a flee group (d.fleeGroup is only
    // set on fleeing-pool dots, see startMemorialReveal()) and isn't
    // already part of the gray cohort is "leftover" — split into 3 groups
    // (MEMORIAL_LEFTOVER_GROUP_FRACTIONS). Marked isMemorial now (so
    // updateDots would skip it, matching every other memorial dot) but
    // deliberately NOT touching isFleeing, so renderFrame's position branch
    // (isFleeing is checked before isMemorial) keeps using this dot's flee
    // position — already frozen, since the rAF loop that advanced it just
    // stopped above — instead of snapping back to its pre-flee channel
    // position the way a fresh isMemorial dot would.
    var leftoverPool = [];
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      if (d.isMemorial || !d.fleeGroup) continue;
      leftoverPool.push(d);
    }
    shuffleArray(leftoverPool);

    var leftoverCursor = 0;
    var leftoverCumulativeFraction = 0;
    for (var lg = 0; lg < MEMORIAL_LEFTOVER_GROUP_FRACTIONS.length; lg++) {
      leftoverCumulativeFraction += MEMORIAL_LEFTOVER_GROUP_FRACTIONS[lg];
      var isLastLeftoverGroup = lg === MEMORIAL_LEFTOVER_GROUP_FRACTIONS.length - 1;
      var groupEnd = isLastLeftoverGroup ? leftoverPool.length : Math.round(leftoverPool.length * leftoverCumulativeFraction);
      var delaySec = MEMORIAL_LEFTOVER_GROUP_DELAYS_SEC[lg];
      var durationSec = MEMORIAL_LEFTOVER_TOTAL_DURATION_SEC - delaySec;
      for (; leftoverCursor < groupEnd; leftoverCursor++) {
        var leftoverDot = leftoverPool[leftoverCursor];
        leftoverDot.isMemorial = true;
        leftoverDot.colorMix = 0;
        leftoverDot.leftoverDelaySec = delaySec;
        leftoverDot.leftoverDurationSec = durationSec;
      }
    }

    memorialLeftoverDots = leftoverPool;
    if (memorialLeftoverAnimId !== null) {
      cancelAnimationFrame(memorialLeftoverAnimId);
      memorialLeftoverAnimId = null;
    }
    if (memorialLeftoverDots.length > 0) {
      runLeftoverGrayOut();
    }

    renderFrame(lastRenderedNowSec);
  }

  // The "ready to call" marking itself — a plain white 1px stroke, no
  // blur — generalized to take any dot rather than being hardcoded to
  // #11780 (see ready_to_call_status()/runHeartbeatOnDot() below, both of
  // which apply it to their own target dot).
  function readyToCallStatusOnDot(dot) {
    if (!dot) return;
    dot.readyToCallStroke = true;
    renderFrame(lastRenderedNowSec);
  }

  // EXPERIMENTAL — #11780-only interactions, triggered off frame-side
  // resource-show events (see stage3.js): the "ready to call" stroke above
  // and doubled size, both when #11780 itself shows as text (s3_mom_11) —
  // alongside s4_heartbeat_anim("#11780"), also triggered there (see
  // further below). No-ops if #11780 was never tagged (see
  // startMemorialReveal()) — shouldn't happen in practice, just
  // defensive. ready_to_call_status() itself stays a public zero-arg call
  // (stage3.js's own call site is unchanged) — it's just a thin wrapper
  // around readyToCallStatusOnDot(memorialEleven780Dot) now, the same
  // helper runHeartbeatOnDot() below calls generically for any dot.
  function ready_to_call_status() {
    readyToCallStatusOnDot(memorialEleven780Dot);
  }

  function doubleEleven780Size() {
    if (!memorialEleven780Dot) return;
    memorialEleven780Dot.sizeMultiplier = 2;
    renderFrame(lastRenderedNowSec);
  }

  // The "read only" skip path (s4_mom_22's alternative CTA, see
  // stage4-5.js): retires #11780 from the field permanently — same "gone
  // for good, not coming back" permanence as a fleeing dot, just via a
  // color change instead of motion, since #11780 never joins a flee group.
  // Turns solid black (invisible against the canvas's own black
  // background) and clears its heartbeat/stroke so nothing else touches
  // it again.
  function removeEleven780() {
    if (!memorialEleven780Dot) return;
    stopHeartbeatOnDot(memorialEleven780Dot);
    memorialEleven780Dot.readyToCallStroke = false;
    memorialEleven780Dot.permanentColor = "#000";
    renderFrame(lastRenderedNowSec);
  }

  /* ------------------------------------------------------------------
     s4_heartbeat_anim — reusable pulse animation, generalized to accept
     any target dot (by its memorialTagId, e.g. "s4_name_01", or "#11780"
     — see CALL_BY_NAME_QUEUE in shared.js) rather than being hardcoded to
     one specific dot. Continuously oscillates that dot's sizeMultiplier
     between HEARTBEAT_MIN_SCALE (50%) and HEARTBEAT_MAX_SCALE (200%) via
     its own rAF loop, stored on the dot itself (d.heartbeatRafId) so more
     than one dot could in principle pulse at once. Also applies the same
     "ready to call" white-stroke marking #11780 already got on its own
     (readyToCallStatusOnDot(), see above) to every dot the instant its
     heartbeat starts — retroactively, this is what makes s4_name_01..09
     get the stroke too, not just #11780. Runs until resolveNamedDot() (or
     a fresh s4_heartbeat_anim() call on the same dot) stops it — see the
     "call next in sequence" queue in shared.js (STS.callNextInSequence),
     which is what actually drives these two functions from the "Call them
     by name" CTA.
     ------------------------------------------------------------------ */
  var HEARTBEAT_MIN_SCALE = 0.5;
  var HEARTBEAT_MAX_SCALE = 2.0;
  var HEARTBEAT_PERIOD_MS = 1200; // one full pulse cycle

  function findDotByTag(tagId) {
    for (var i = 0; i < dots.length; i++) {
      if (dots[i].memorialTagId === tagId) return dots[i];
    }
    return null;
  }

  function stopHeartbeatOnDot(dot) {
    if (dot && dot.heartbeatRafId !== null && dot.heartbeatRafId !== undefined) {
      cancelAnimationFrame(dot.heartbeatRafId);
      dot.heartbeatRafId = null;
    }
  }

  function runHeartbeatOnDot(dot) {
    stopHeartbeatOnDot(dot); // cancel any previous loop already running on this dot
    readyToCallStatusOnDot(dot); // white 1px stroke — same "ready to call" marking #11780 gets, now generalized to every dot the instant its heartbeat starts
    var startTime = null;

    function step(now) {
      if (startTime === null) startTime = now;
      var phase = ((now - startTime) % HEARTBEAT_PERIOD_MS) / HEARTBEAT_PERIOD_MS; // 0..1
      var wave = (Math.sin(phase * Math.PI * 2 - Math.PI / 2) + 1) / 2; // 0..1, starts at the trough
      dot.sizeMultiplier = HEARTBEAT_MIN_SCALE + (HEARTBEAT_MAX_SCALE - HEARTBEAT_MIN_SCALE) * wave;
      renderFrame(lastRenderedNowSec);
      dot.heartbeatRafId = requestAnimationFrame(step);
    }

    dot.heartbeatRafId = requestAnimationFrame(step);
  }

  function s4_heartbeat_anim(targetTagId) {
    var dot = findDotByTag(targetTagId);
    if (!dot) return;
    runHeartbeatOnDot(dot);
  }

  // Fallback only now (see NAMED_DOT_FIXED_COLORS below) — kept for any
  // tag that isn't one of the 10 known ones, so resolveNamedDot() never
  // has to no-op on a missing color.
  function randomPermanentColor() {
    var hue = Math.floor(Math.random() * 360);
    return "hsl(" + hue + ", 70%, 60%)";
  }

  // Explicit, fixed colors for the 10 dots that resolve before stage 5
  // (s4_name_01..09 and #11780) — 10 hues spread evenly around the wheel
  // (36 degrees apart) at a consistently high saturation/lightness so none
  // of them drift into brown, gray, or any other desaturated/grayscale
  // tone (those ranges are reserved for unresolved/anonymous dots — see
  // final-scene.js's GRAY_DOT_COLOR and stage4-5.js's
  // COLLECTIVE_BOARD_ANONYMOUS_COLOR). Same hsl() family randomPermanentColor()
  // already used, just fixed values instead of a random pick, so every
  // run reliably gives each of these 10 a strongly distinct, non-random
  // color from a curated palette rather than an occasional near-duplicate
  // or muddy hue.
  var NAMED_DOT_FIXED_COLORS = {
    "s4_name_01": "hsl(0, 80%, 55%)",   // red
    "s4_name_02": "hsl(36, 80%, 55%)",  // orange
    "s4_name_03": "hsl(72, 80%, 55%)",  // yellow-green
    "s4_name_04": "hsl(108, 80%, 55%)", // green
    "s4_name_05": "hsl(144, 80%, 55%)", // green-cyan
    "s4_name_06": "hsl(180, 80%, 55%)", // cyan
    "s4_name_07": "hsl(216, 80%, 55%)", // blue
    "s4_name_08": "hsl(252, 80%, 55%)", // blue-violet
    "s4_name_09": "hsl(288, 80%, 55%)", // violet
    "#11780": "hsl(324, 80%, 55%)"      // magenta
  };

  // Stops targetTagId's heartbeat (if any) and marks it "resolved": one of
  // the 10 fixed colors above (or a random fallback for any other tag),
  // permanently 2x size (not just the heartbeat's own 50%-200% pulse —
  // this is its lasting resolved state, so resolved dots stay visibly
  // larger even once the pulse itself has stopped). Called by
  // STS.callNextInSequence() (shared.js) right before it starts the next
  // dot's heartbeat. This is the single place a resolved dot's color is
  // decided — stage4-5.js's addEntry() reads it back afterward via
  // getResolvedColor() rather than picking its own, so a board entry's
  // stored color always matches its dot exactly (see the doc comment on
  // getResolvedColor() below for why that matters).
  function resolveNamedDot(targetTagId) {
    var dot = findDotByTag(targetTagId);
    if (!dot) return;
    stopHeartbeatOnDot(dot);
    dot.sizeMultiplier = 2;
    dot.permanentColor = NAMED_DOT_FIXED_COLORS[targetTagId] || randomPermanentColor();
    renderFrame(lastRenderedNowSec);
  }

  // Query-only, never broadcast (see broadcastFieldCall's doc comment —
  // only state-mutating calls need to be mirrored to the other window).
  // Lets a caller (stage4-5.js's addEntry()) read back whatever color
  // resolveNamedDot() already picked for a dot, instead of independently
  // randomizing a second, different color of its own — the bug this
  // fixes: a board entry's stored `color` and its linked dot's actual
  // on-field color used to be two unrelated random values that never
  // matched. Returns null if the dot isn't tagged or hasn't been resolved
  // yet (no permanentColor set).
  function getResolvedColor(targetTagId) {
    var dot = findDotByTag(targetTagId);
    return (dot && dot.permanentColor) ? dot.permanentColor : null;
  }

  /* ------------------------------------------------------------------
     Name tooltip — a continuous hover/enter-leave state (unlike every
     other dot interaction above, which is a one-shot click), showing a
     board entry's name+story as text on the field near its linked dot.
     Driven by stage4-5.js's collective board: mouseenter/tap calls
     showNameTooltip(dotId, name, story), mouseleave/tap-elsewhere calls
     hideNameTooltip(dotId). Also reused, on a timer instead of a real
     hover, for the "auto-reveal on submit" beat (see stage4-5.js).

     Deliberately last-write-wins rather than requiring perfectly paired
     show/hide calls: activeTooltipDotId is the single source of truth for
     "what's currently shown" — a new showNameTooltip() call always just
     switches to it (no need to hide the previous one first), and
     hideNameTooltip(dotId) only clears the tooltip if dotId is still the
     active one, so a stale/late hide (e.g. arriving after a newer show,
     plausible given real-world latency once this is broadcast across the
     two-window exhibition split) can't clobber whatever's showing now.
     Only one tooltip is ever shown at a time — true of both a mouse (one
     hover at a time) and touch (one tap at a time), so no need to track
     more than one.
     ------------------------------------------------------------------ */
  var activeTooltipDot = null;   // cached dot reference, avoids a findDotByTag() scan every render frame
  var activeTooltipDotId = null; // the tag id currently shown — hideNameTooltip's last-write-wins key
  var activeTooltipText = null;  // { name, story }

  function showNameTooltip(dotId, name, story) {
    var dot = findDotByTag(dotId);
    if (!dot) return;
    activeTooltipDot = dot;
    activeTooltipDotId = dotId;
    activeTooltipText = { name: name, story: story };
    renderFrame(lastRenderedNowSec);
  }

  function hideNameTooltip(dotId) {
    if (activeTooltipDotId !== dotId) return; // stale/superseded call — no-op, see doc comment above
    activeTooltipDot = null;
    activeTooltipDotId = null;
    activeTooltipText = null;
    renderFrame(lastRenderedNowSec);
  }

  var TOOLTIP_FONT_FAMILY = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"; // matches css/global.css's --font-family
  var TOOLTIP_LINE_HEIGHT_PX = 16;
  var TOOLTIP_MAX_WIDTH_PX = 220;   // story text wraps within this width
  var TOOLTIP_OFFSET_Y_PX = 18;     // below the dot, in screen (not canvas/zoom) space

  // Greedy word-wrap into lines no wider than maxWidth, measured with
  // ctx's currently-set font — canvas has no native text-wrapping, so this
  // is done by hand rather than pulling in a DOM element for it (see the
  // "why canvas text, not a DOM overlay" reasoning below).
  function wrapTextLines(measureCtx, text, maxWidth) {
    var words = text.split(" ");
    var lines = [];
    var current = "";
    for (var i = 0; i < words.length; i++) {
      var attempt = current ? current + " " + words[i] : words[i];
      if (current && measureCtx.measureText(attempt).width > maxWidth) {
        lines.push(current);
        current = words[i];
      } else {
        current = attempt;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  // Drawn as plain canvas text (ctx.fillText), not a DOM overlay — a DOM
  // tooltip positioned over a dot would need to re-derive the exact same
  // zoom-transform math canvasToScreen() already encapsulates in a second
  // place (CSS/JS instead of canvas), and keep it in sync with any future
  // change to the zoom system; staying inside the canvas keeps there being
  // only one place that ever computes a dot's on-screen position. The
  // transform is reset to identity for the text draw only, so it reads at
  // a constant screen size regardless of the field's current zoom level —
  // dots (drawn earlier in renderFrame, under the zoomed transform) still
  // scale with zoom as normal; only this text opts out.
  function drawActiveNameTooltip(nowSec) {
    if (!activeTooltipDot || !activeTooltipText) return;

    var canvasPos = dotPosition(activeTooltipDot, nowSec);
    var screenPos = canvasToScreen(canvasPos.x, canvasPos.y);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";

    var y = screenPos.y + TOOLTIP_OFFSET_Y_PX;

    ctx.font = "bold 12px " + TOOLTIP_FONT_FAMILY;
    if (activeTooltipText.name) {
      ctx.fillText(activeTooltipText.name, screenPos.x, y);
      y += TOOLTIP_LINE_HEIGHT_PX;
    }

    if (activeTooltipText.story) {
      ctx.font = "12px " + TOOLTIP_FONT_FAMILY;
      var storyLines = wrapTextLines(ctx, activeTooltipText.story, TOOLTIP_MAX_WIDTH_PX);
      for (var i = 0; i < storyLines.length; i++) {
        ctx.fillText(storyLines[i], screenPos.x, y);
        y += TOOLTIP_LINE_HEIGHT_PX;
      }
    }

    ctx.restore();
  }

  /* ------------------------------------------------------------------
     Shared final scene (js/final-scene.js) — takes over #field-canvas
     entirely once started: stopLoop() below halts the channel scene's own
     rAF loop for good (this is a one-way switch, not toggled back), and
     window.FinalScene's own renderer instance runs its own independent
     loop against the same canvas element from then on. field.js stays
     storage-ignorant here too, same as the rest of this file — every call
     below receives its data (assignments, or a specific dot's color/
     name/story) from its caller (stage4-5.js, which owns the entries
     registry) rather than reading localStorage itself.

     Sound (playNoteTone) is gated on STS.screenMode !== "field" — audio
     (including headphones) only ever plays on the frame side, since that's
     the only window with real user input; field is a passive visual mirror
     and must stay silent. This works regardless of whether a call is local
     (this window is the one driving stage logic) or arrived over the
     two-window BroadcastChannel sync (see the wrappers below): either way,
     the function actually executes inside THIS window's own JS context, so
     checking THIS window's own screenMode is exactly the right gate — a
     field-mode window suppresses its own sound whether the call originated
     locally or was relayed in from the other window.
     ------------------------------------------------------------------ */
  var finalSceneRenderer = null;

  function startFinalScene(assignments) {
    if (!canvas || !window.FinalScene) return;
    stopLoop(); // one-way handoff — the channel scene never resumes on this canvas
    if (!finalSceneRenderer) {
      finalSceneRenderer = window.FinalScene.createRenderer(canvas);
      finalSceneRenderer.init();
    }
    finalSceneRenderer.setAssignments(assignments);
  }

  function setFinalSceneAssignments(assignments) {
    if (finalSceneRenderer) finalSceneRenderer.setAssignments(assignments);
  }

  // Bug fix (round 2, item 1) — the heartbeat pulse stays frozen until
  // this is called (see final-scene.js's animationsActive doc comment).
  function startFinalSceneAnimation() {
    if (finalSceneRenderer) finalSceneRenderer.startAnimating();
  }

  function maybePlayFinalSceneNote(noteFrequency) {
    if (noteFrequency && window.FinalScene && window.STS && window.STS.screenMode !== "field") {
      window.FinalScene.playNoteTone(noteFrequency);
    }
  }

  function showFinalSceneTooltip(dotIndex, name, story, noteFrequency) {
    if (finalSceneRenderer) finalSceneRenderer.showTooltip(dotIndex, name, story);
    maybePlayFinalSceneNote(noteFrequency);
  }

  function hideFinalSceneTooltip(dotIndex) {
    if (finalSceneRenderer) finalSceneRenderer.hideTooltip(dotIndex);
  }

  // Entry-path-specific intro (see stage4-5.js): shows only this one dot,
  // highlighted, before revealFinalScene() below brings in the rest.
  // noteFrequency is optional — passed for the form-submit path (plays,
  // subject to the same screenMode gate above), omitted for the anonymous
  // path (that entry's own stored note is already null, so callers can
  // just pass it through unconditionally either way).
  function focusFinalSceneOnly(dotIndex, color, name, story, noteFrequency) {
    if (finalSceneRenderer) finalSceneRenderer.focusOnly(dotIndex, color, name, story);
    maybePlayFinalSceneNote(noteFrequency);
  }

  function revealFinalScene() {
    if (finalSceneRenderer) finalSceneRenderer.revealAll();
  }

  // EXPERIMENTAL, item 1 — the visitor's own just-submitted dot keeps its
  // name showing with no hover needed, for the rest of the current run
  // (cleared on the next page load, along with everything else — see
  // shared.js's triggerNextRunReset()). Easy to stop using: stage4-5.js
  // simply never calls setFinalScenePersistentLabel.
  function setFinalScenePersistentLabel(dotIndex, name) {
    if (finalSceneRenderer) finalSceneRenderer.setPersistentLabel(dotIndex, name);
  }

  function clearFinalScenePersistentLabel() {
    if (finalSceneRenderer) finalSceneRenderer.clearPersistentLabel();
  }

  // Item 3c — in-place highlight (no camera zoom, this scene has none) for
  // the fixed "#11780 placeholder" dot while its popup form is open.
  function setFinalSceneTargetHighlight(dotIndex) {
    if (finalSceneRenderer) finalSceneRenderer.setTargetHighlight(dotIndex);
  }

  function clearFinalSceneTargetHighlight() {
    if (finalSceneRenderer) finalSceneRenderer.clearTargetHighlight();
  }

  if (syncChannel) {
    syncChannel.onmessage = function (event) {
      var msg = event.data;
      if (!msg || msg.type !== "field") return;

      // Calls the internal function directly (not the broadcasting
      // wrapper below), so receiving a message never re-broadcasts it.
      switch (msg.method) {
        case "startIdleJitter": startIdleJitter(); break;
        case "startFlow": startFlow(); break;
        case "stopFlow": stopFlow(); break;
        case "setZoom": setZoom(msg.args && msg.args[0]); break;
        case "animateZoomTo": animateZoomTo(msg.args && msg.args[0], msg.args && msg.args[1]); break;
        case "recoilZoom": recoilZoom(); break;
        case "resetZoom": resetZoom(); break;
        case "startMemorialReveal": startMemorialReveal(msg.args && msg.args[0]); break;
        case "stopMemorialReveal": stopMemorialReveal(); break;
        case "startFleeGroup": startFleeGroup(msg.args && msg.args[0]); break;
        case "ready_to_call_status": ready_to_call_status(); break;
        case "doubleEleven780Size": doubleEleven780Size(); break;
        case "removeEleven780": removeEleven780(); break;
        case "s4_heartbeat_anim": s4_heartbeat_anim(msg.args && msg.args[0]); break;
        case "resolveNamedDot": resolveNamedDot(msg.args && msg.args[0]); break;
        case "showNameTooltip": showNameTooltip(msg.args && msg.args[0], msg.args && msg.args[1], msg.args && msg.args[2]); break;
        case "hideNameTooltip": hideNameTooltip(msg.args && msg.args[0]); break;
        case "startFinalScene": startFinalScene(msg.args && msg.args[0]); break;
        case "setFinalSceneAssignments": setFinalSceneAssignments(msg.args && msg.args[0]); break;
        case "showFinalSceneTooltip": showFinalSceneTooltip(msg.args && msg.args[0], msg.args && msg.args[1], msg.args && msg.args[2], msg.args && msg.args[3]); break;
        case "hideFinalSceneTooltip": hideFinalSceneTooltip(msg.args && msg.args[0]); break;
        case "focusFinalSceneOnly": focusFinalSceneOnly(msg.args && msg.args[0], msg.args && msg.args[1], msg.args && msg.args[2], msg.args && msg.args[3], msg.args && msg.args[4]); break;
        case "revealFinalScene": revealFinalScene(); break;
        case "setFinalScenePersistentLabel": setFinalScenePersistentLabel(msg.args && msg.args[0], msg.args && msg.args[1]); break;
        case "clearFinalScenePersistentLabel": clearFinalScenePersistentLabel(); break;
        case "setFinalSceneTargetHighlight": setFinalSceneTargetHighlight(msg.args && msg.args[0]); break;
        case "clearFinalSceneTargetHighlight": clearFinalSceneTargetHighlight(); break;
        case "startFinalSceneAnimation": startFinalSceneAnimation(); break;
      }
    };
  }

  window.Field = {
    init: init, // not broadcast — each window generates its own dot population
    startIdleJitter: function () {
      startIdleJitter();
      broadcastFieldCall("startIdleJitter");
    },
    startFlow: function () {
      startFlow();
      broadcastFieldCall("startFlow");
    },
    stopFlow: function () {
      stopFlow();
      broadcastFieldCall("stopFlow");
    },
    setZoom: function (scale) {
      setZoom(scale);
      broadcastFieldCall("setZoom", [scale]);
    },
    animateZoomTo: function (targetScale, durationMs) {
      animateZoomTo(targetScale, durationMs);
      broadcastFieldCall("animateZoomTo", [targetScale, durationMs]);
    },
    recoilZoom: function () {
      recoilZoom();
      broadcastFieldCall("recoilZoom");
    },
    resetZoom: function () {
      resetZoom();
      broadcastFieldCall("resetZoom");
    },
    startMemorialReveal: function (estimatedDurationMs) {
      startMemorialReveal(estimatedDurationMs);
      broadcastFieldCall("startMemorialReveal", [estimatedDurationMs]);
    },
    stopMemorialReveal: function () {
      stopMemorialReveal();
      broadcastFieldCall("stopMemorialReveal");
    },
    startFleeGroup: function (groupNumber) {
      startFleeGroup(groupNumber);
      broadcastFieldCall("startFleeGroup", [groupNumber]);
    },
    ready_to_call_status: function () {
      ready_to_call_status();
      broadcastFieldCall("ready_to_call_status");
    },
    doubleEleven780Size: function () {
      doubleEleven780Size();
      broadcastFieldCall("doubleEleven780Size");
    },
    removeEleven780: function () {
      removeEleven780();
      broadcastFieldCall("removeEleven780");
    },
    s4_heartbeat_anim: function (targetTagId) {
      s4_heartbeat_anim(targetTagId);
      broadcastFieldCall("s4_heartbeat_anim", [targetTagId]);
    },
    resolveNamedDot: function (targetTagId) {
      resolveNamedDot(targetTagId);
      broadcastFieldCall("resolveNamedDot", [targetTagId]);
    },
    getResolvedColor: getResolvedColor, // query-only, not broadcast — see its own doc comment
    showNameTooltip: function (dotId, name, story) {
      showNameTooltip(dotId, name, story);
      broadcastFieldCall("showNameTooltip", [dotId, name, story]);
    },
    hideNameTooltip: function (dotId) {
      hideNameTooltip(dotId);
      broadcastFieldCall("hideNameTooltip", [dotId]);
    },
    startFinalScene: function (assignments) {
      startFinalScene(assignments);
      broadcastFieldCall("startFinalScene", [assignments]);
    },
    setFinalSceneAssignments: function (assignments) {
      setFinalSceneAssignments(assignments);
      broadcastFieldCall("setFinalSceneAssignments", [assignments]);
    },
    startFinalSceneAnimation: function () {
      startFinalSceneAnimation();
      broadcastFieldCall("startFinalSceneAnimation");
    },
    showFinalSceneTooltip: function (dotIndex, name, story, noteFrequency) {
      showFinalSceneTooltip(dotIndex, name, story, noteFrequency);
      broadcastFieldCall("showFinalSceneTooltip", [dotIndex, name, story, noteFrequency]);
    },
    hideFinalSceneTooltip: function (dotIndex) {
      hideFinalSceneTooltip(dotIndex);
      broadcastFieldCall("hideFinalSceneTooltip", [dotIndex]);
    },
    focusFinalSceneOnly: function (dotIndex, color, name, story, noteFrequency) {
      focusFinalSceneOnly(dotIndex, color, name, story, noteFrequency);
      broadcastFieldCall("focusFinalSceneOnly", [dotIndex, color, name, story, noteFrequency]);
    },
    revealFinalScene: function () {
      revealFinalScene();
      broadcastFieldCall("revealFinalScene");
    },
    setFinalScenePersistentLabel: function (dotIndex, name) {
      setFinalScenePersistentLabel(dotIndex, name);
      broadcastFieldCall("setFinalScenePersistentLabel", [dotIndex, name]);
    },
    setFinalSceneTargetHighlight: function (dotIndex) {
      setFinalSceneTargetHighlight(dotIndex);
      broadcastFieldCall("setFinalSceneTargetHighlight", [dotIndex]);
    },
    clearFinalSceneTargetHighlight: function () {
      clearFinalSceneTargetHighlight();
      broadcastFieldCall("clearFinalSceneTargetHighlight");
    },
    clearFinalScenePersistentLabel: function () {
      clearFinalScenePersistentLabel();
      broadcastFieldCall("clearFinalScenePersistentLabel");
    },
    setVisible: setVisible // local-only (see above), never broadcast
  };
})();
