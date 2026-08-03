/* ==========================================================================
   Sculpting the Silence — background point field
   Ported from prototypes/field-default.html (perspective, the curved
   "channel", the three dot populations, density-based speed, path wobble,
   the core density band, size gradient). Exposed as window.Field with a
   small public API — init/startIdleJitter/startFlow/stopFlow/setZoom —
   driven externally by each stage's own timing rather than a fixed
   internal duration. Must load before any stage-N.js file that calls it.
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
  var MIN_SPEED = 4;                    // px/sec, densest areas
  var MAX_SPEED = 5;                    // px/sec, sparsest areas
  var CONVERGE_RATE = 0.6;              // 1/sec, how fast a side-street/off-screen dot's
                                         // offset collapses into the channel at top speed

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

  function gaussianRandom() {
    var u = 1 - Math.random();
    var v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
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

  // Forward-drift pace in px/sec: MAX_SPEED in sparse areas, easing down to MIN_SPEED as
  // density rises.
  function speedAt(t, offset) {
    var density = densityAt(t, offset);
    return MAX_SPEED - (MAX_SPEED - MIN_SPEED) * density;
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
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      if (elapsedSec < d.entryTimeSec) continue;

      var speed = speedAt(d.t, d.offset); // px/sec
      d.t += (speed / height) * dt;

      if (!d.isChannelDot) {
        // Ease the offset into the channel at a rate tied to the same density-driven pace.
        var decay = CONVERGE_RATE * (speed / MAX_SPEED);
        d.offset *= Math.exp(-decay * dt);
      }
    }
  }

  function jitter(nowSec, phase, freq) {
    return JITTER_AMOUNT * Math.sin(nowSec * JITTER_SPEED * freq + phase);
  }

  function renderFrame(nowSec) {
    if (!ctx) return;
    lastRenderedNowSec = nowSec;

    // Background fill always covers the untransformed viewport exactly, regardless of zoom.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#fff";

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

      var x = channelXAt(d.t) + d.offset + wobbleAt(d) + jitter(nowSec, d.phaseX, d.freqX);
      var y = d.t * height + jitter(nowSec, d.phaseY, d.freqY);

      // Dots continue past the bottom edge (passing by, not stopping dead) — no need to
      // clamp or cull, the canvas simply won't render points outside its bounds.
      ctx.beginPath();
      ctx.arc(x, y, sizeAt(d.t) / 2, 0, Math.PI * 2);
      ctx.fill();
    }
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
    zoomScale = scale;
    zoomPivotX = channelXAt(0.5);
    zoomPivotY = height * 0.5;
    renderFrame(lastRenderedNowSec); // force a redraw even while frozen/static
  }

  window.Field = {
    init: init,
    startIdleJitter: startIdleJitter,
    startFlow: startFlow,
    stopFlow: stopFlow,
    setZoom: setZoom
  };
})();
