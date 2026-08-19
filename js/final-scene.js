/* ==========================================================================
   Sculpting the Silence — shared final scene (field + frame, identical)
   A fixed, deterministic pattern of dots on black — generated fresh from a
   fixed seed every time (never regenerated per run, never persisted
   anywhere; the same seed always reproduces the same DOT_COUNT positions in
   any JS context). Exposed as window.FinalScene: generateDotPattern() is a
   pure, canvas-free function; createRenderer(canvasEl) returns a
   self-contained per-canvas renderer, used independently by field.js (the
   existing #field-canvas) and stage4-5.js (a new frame-side canvas) — two
   separate instances that render identically because they compute the same
   pattern from the same seed, not because state is shared between them.

   Deliberately has NO dependency on field.js's own channel/perspective
   rendering (none of that applies to a static scattered pattern) and NO
   knowledge of the entries registry or localStorage — a renderer only ever
   receives an already-computed {dotIndex, color} assignment list from its
   caller. Kept this decoupled on purpose: the old collective board
   (stage4-5.js) and this new scene are meant to be independently
   toggleable (see stage4-5.js's USE_NEW_FINAL_SCENE flag), so nothing here
   should reach back into that older system or vice versa.

   Text (name/story tooltips, the persistent own-entry label, the intro
   spotlight's label) is a DOM overlay, not canvas-drawn — unlike field.js's
   own channel-scene name-tooltip. Deliberate: this scene's dots are static
   (no zoom, no motion), so a DOM element needs no transform math to stay
   correctly positioned, and it gets CSS `backdrop-filter` for free (a
   translucent panel that softly blurs the dots behind the text, per the
   legibility pass — canvas has no equivalent "blur what's already been
   drawn beneath this specific region" primitive without expensive
   per-frame re-rendering).

   Tooltip reveal is two-tier (showTooltip's tier param): tier 1 shows a
   dot's name plus a small "interact again" icon, tier 2 swaps the icon for
   the story. Which tier applies on a given hover/tap is decided entirely
   by the caller (stage4-5.js's interaction state machine, since it also
   has to coordinate the same state across two renderer instances — this
   one and field.js's own — over BroadcastChannel); this file just renders
   whichever tier it's told, with no memory of past interactions itself.

   setTargetHighlight/clearTargetHighlight draw an in-place ring + size
   bump on one dot (e.g. the "#11780 placeholder" dot while its popup form
   is open) without touching anything else on screen — deliberately not a
   camera zoom/pan, since this scene has none (see above: no zoom, no
   motion) and everything else needs to stay exactly where it is so
   exploration of the rest of the scene isn't interrupted.

   Must load after shared.js, before field.js and stage4-5.js.
   ========================================================================== */

(function () {
  "use strict";

  var DOT_COUNT = 300;
  var PATTERN_SEED = 42; // fixed — same pattern every run, in every JS context

  // EXPERIMENTAL — colour test: was #808080 (mid gray), briefly tried pure
  // #000000 (invisible against the black background), now a darker gray
  // than the original — visible but subdued, so unassigned dots read as
  // quiet background texture rather than competing with assigned ones.
  var GRAY_DOT_COLOR = "#404040";
  var DOT_RADIUS_PX = 2.5;       // unassigned dots, and an assigned dot's un-pulsed base radius
  var EDGE_MARGIN_PERCENT = 4;   // keep dots off the very edge of whichever canvas renders them

  var HEARTBEAT_MIN_SCALE = 0.5;
  var HEARTBEAT_MAX_SCALE = 2.0;
  var HEARTBEAT_PERIOD_MS = 1200; // continuous ambient pulse for every assigned dot, all the time —
                                   // computed once per frame from wall-clock time rather than a
                                   // per-dot animation loop, since every assigned dot shares the
                                   // exact same phase (no per-dot rAF bookkeeping needed here, unlike
                                   // field.js's older one-shot heartbeat mechanism).

  var TOOLTIP_OFFSET_Y_PX = 16; // below the dot

  var FADE_DURATION_MS = 600; // focus-only -> full reveal crossfade, dots (canvas) — the tooltip's
                               // own fade is plain CSS (see .final-scene__tooltip's transition in
                               // global.css), not driven from here.

  // Deterministic seeded PRNG (mulberry32) — same seed always produces the
  // same sequence, in any JS context, with no external randomness and
  // nothing to persist.
  function mulberry32(seed) {
    var state = seed >>> 0;
    return function () {
      state = (state + 0x6D2B79F5) | 0;
      var t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Pure — no canvas, no persisted state. Positions are percentages (0-100)
  // so any renderer scales them to its own canvas's actual pixel size.
  function generateDotPattern() {
    var rand = mulberry32(PATTERN_SEED);
    var pattern = [];
    for (var i = 0; i < DOT_COUNT; i++) {
      pattern.push({
        x: EDGE_MARGIN_PERCENT + rand() * (100 - EDGE_MARGIN_PERCENT * 2),
        y: EDGE_MARGIN_PERCENT + rand() * (100 - EDGE_MARGIN_PERCENT * 2)
      });
    }
    return pattern;
  }

  // Same A-minor-pentatonic, layered-oscillator handpan approximation as
  // stage4-5.js's playCollectiveBoardNote for the old board — an
  // independent copy rather than a shared call, so the old and new final
  // screens stay fully decoupled/toggleable.
  var audioCtx = null;
  var NOTE_PARTIALS = [
    { multiplier: 1, gain: 1.0 },
    { multiplier: 2, gain: 0.28 },
    { multiplier: 3, gain: 0.12 }
  ];

  function playNoteTone(frequency) {
    if (!frequency) return;
    var AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) audioCtx = new AudioContextClass();
    if (audioCtx.state === "suspended") audioCtx.resume();

    var now = audioCtx.currentTime;
    var attack = 0.02;
    var decay = 2.0;
    var stopAt = now + attack + decay;
    var peakGain = 0.18;

    var masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.linearRampToValueAtTime(peakGain, now + attack);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
    masterGain.gain.setValueAtTime(0, stopAt);
    masterGain.connect(audioCtx.destination);

    NOTE_PARTIALS.forEach(function (partial) {
      var oscillator = audioCtx.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency * partial.multiplier;

      var partialGain = audioCtx.createGain();
      partialGain.gain.value = partial.gain;

      oscillator.connect(partialGain);
      partialGain.connect(masterGain);
      oscillator.start(now);
      oscillator.stop(stopAt);
    });
  }

  /* ------------------------------------------------------------------
     Renderer — one instance per canvas. Owns its own rAF loop (started by
     init(), never stopped for the canvas's lifetime — matches field.js's
     own "keep running, rely on display:none to avoid paint cost" pattern
     rather than adding a separate visibility-driven pause/resume). Dots
     are drawn on canvas every frame (for the heartbeat pulse); the text
     tooltip is a DOM element, positioned/shown only when something
     actually changes (state-driven, not per-frame) — the pattern is
     static, so a dot's screen position only ever changes on resize.
     ------------------------------------------------------------------ */
  function createRenderer(canvasEl) {
    var ctx = canvasEl.getContext("2d");
    var width = 0;
    var height = 0;
    var pattern = generateDotPattern();
    var assignmentsByIndex = {}; // dotIndex -> color, for every currently-assigned dot

    // Tooltip — single active, last-write-wins (tolerates out-of-order
    // show/hide calls, e.g. across the two-window BroadcastChannel sync,
    // without requiring perfectly paired events). Priority when more than
    // one could apply: focus (intro) > real hover > persistent label.
    // Item 2 — two-tier reveal: activeTooltipTier 1 shows name+icon only
    // (first hover/tap), tier 2 shows name+story (second click/tap on the
    // same dot). The tier itself is decided by the caller (stage4-5.js's
    // interaction state machine) — this renderer just renders whichever
    // tier it's told.
    var activeTooltipDotIndex = null;
    var activeTooltipText = null; // { name, story }
    var activeTooltipTier = 1;

    // Item 3c — in-place highlight for the fixed "#11780 placeholder" dot
    // while the popup form is open: no camera/zoom (the scene has none —
    // see the file-level doc comment), just a bigger pulse + a ring drawn
    // on top of that one dot, everything else rendered exactly as normal.
    var highlightDotIndex = null;
    var TARGET_HIGHLIGHT_SCALE_MULTIPLIER = 1.6;
    var TARGET_HIGHLIGHT_RING_PADDING_PX = 5;

    // Bug fix (round 2, item 1) — the scene must read as visually static
    // until the visitor actually clicks "Explore to get more": every
    // assigned dot's heartbeat pulse stays frozen at its resting scale
    // until startAnimating() is called (see stage4-5.js's
    // beginFinalSceneExploration), even though the dots themselves are
    // already drawn/visible well before that (see initStage5). The render
    // loop itself never stops — only the pulse math is gated — so resize
    // and the target-highlight ring still work normally throughout.
    var animationsActive = false;

    // EXPERIMENTAL — item 1: the visitor's own just-submitted dot keeps
    // showing its name (not story) with no hover needed, for the rest of
    // the current run — see setPersistentLabel()/clearPersistentLabel().
    // Easy to stop using: callers simply never call setPersistentLabel.
    var persistentLabelDotIndex = null;
    var persistentLabelName = null;

    // Focus/reveal intro sequence.
    var mode = "revealed"; // "revealed" | "focus" | "transitioning"
    var focusDotIndex = null;
    var focusColor = null;
    var focusText = null;
    var transitionStartMs = null;

    // DOM tooltip — see the file-level doc comment for why this is a DOM
    // element rather than canvas text. Appended to document.body (not
    // canvasEl.parentNode) so it's never affected by field.js's own
    // canvas-reparenting logic, and never needs to worry about an
    // ancestor establishing an unexpected containing block for its own
    // position:fixed.
    var tooltipEl = document.createElement("div");
    tooltipEl.className = "final-scene__tooltip";
    var tooltipNameEl = document.createElement("p");
    tooltipNameEl.className = "final-scene__tooltip-name";
    var tooltipStoryEl = document.createElement("p");
    tooltipStoryEl.className = "final-scene__tooltip-story";
    tooltipEl.appendChild(tooltipNameEl);
    tooltipEl.appendChild(tooltipStoryEl);
    document.body.appendChild(tooltipEl);

    // Item 2 (bug fix, round 2) — tier-1-only "interact again" indicator.
    // A SEPARATE top-level element, not nested inside tooltipEl: it needs
    // to sit exactly on top of the dot itself (not the name/story panel's
    // own offset position below it) so a click on it — which passes
    // through, since it's pointer-events:none like the rest of the
    // tooltip — lands on the same canvas coordinates hitTestDotAt()
    // checks, fixing the "clicking the icon doesn't reveal the story" bug.
    // Nesting it inside tooltipEl would put it inside an ancestor with its
    // own `transform` (tooltipEl's translate()), which per spec makes a
    // position:fixed descendant resolve against THAT ancestor's box
    // instead of the viewport — exactly the kind of drift that broke the
    // alignment this depends on, so it gets its own independent element.
    var tooltipIconEl = document.createElement("span");
    tooltipIconEl.className = "final-scene__tooltip-icon";
    tooltipIconEl.textContent = "+";
    document.body.appendChild(tooltipIconEl);

    function resize() {
      width = canvasEl.clientWidth || window.innerWidth;
      height = canvasEl.clientHeight || window.innerHeight;
      canvasEl.width = width;
      canvasEl.height = height;
      updateTooltipPosition();
    }

    function dotScreenPos(dotIndex) {
      var p = pattern[dotIndex];
      return { x: (p.x / 100) * width, y: (p.y / 100) * height };
    }

    function heartbeatScale(nowMs) {
      if (!animationsActive) return 1; // frozen at resting scale — see animationsActive's own doc comment
      var phase = (nowMs % HEARTBEAT_PERIOD_MS) / HEARTBEAT_PERIOD_MS;
      var wave = (Math.sin(phase * Math.PI * 2 - Math.PI / 2) + 1) / 2; // 0..1, starts at the trough
      return HEARTBEAT_MIN_SCALE + (HEARTBEAT_MAX_SCALE - HEARTBEAT_MIN_SCALE) * wave;
    }

    function drawDot(dotIndex, color, scale, alpha) {
      var pos = dotScreenPos(dotIndex);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, DOT_RADIUS_PX * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Item 3c — a plain white ring drawn around the currently-highlighted
    // dot, on top of its normal fill. Radius tracks the dot's own current
    // (already-scaled) drawn radius so the ring stays a constant gap
    // around it through the heartbeat pulse rather than a fixed offset.
    function drawTargetHighlightRing(dotIndex, dotRadiusPx, alpha) {
      var pos = dotScreenPos(dotIndex);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, dotRadiusPx + TARGET_HIGHLIGHT_RING_PADDING_PX, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    function renderRevealed(nowMs, alpha) {
      for (var i = 0; i < pattern.length; i++) {
        var color = assignmentsByIndex[i];
        var isHighlighted = i === highlightDotIndex;
        // Bug fix (round 7, item 4) — the heartbeat pulse used to be
        // gated on `color` alone, so the highlighted target dot never
        // pulsed while it was still unassigned (no entry yet, e.g.
        // #11780 right after its 15s/9-hover trigger fires, before
        // anything's been submitted) — it just sat at a flat, static
        // 1.6x size. The highlight is meant to always pulse, assigned or
        // not, so it's included in the gate here too.
        var scale = (color || isHighlighted) ? heartbeatScale(nowMs) : 1;
        if (isHighlighted) scale *= TARGET_HIGHLIGHT_SCALE_MULTIPLIER;
        drawDot(i, color || GRAY_DOT_COLOR, scale, alpha);
        if (isHighlighted) drawTargetHighlightRing(i, DOT_RADIUS_PX * scale, alpha);
      }
    }

    function renderFocus(nowMs, alpha) {
      if (focusDotIndex === null) return;
      drawDot(focusDotIndex, focusColor || GRAY_DOT_COLOR, heartbeatScale(nowMs), alpha);
    }

    function render(nowMs) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);

      if (mode === "focus") {
        renderFocus(nowMs, 1);
      } else if (mode === "transitioning") {
        var t = Math.min((nowMs - transitionStartMs) / FADE_DURATION_MS, 1);
        renderFocus(nowMs, 1 - t);
        renderRevealed(nowMs, t);
        if (t >= 1) {
          mode = "revealed";
          focusDotIndex = null;
          focusText = null;
        }
      } else {
        renderRevealed(nowMs, 1);
      }
    }

    function loop(now) {
      render(now);
      requestAnimationFrame(loop);
    }

    // Re-derives what the tooltip should show right now (priority: focus
    // > real hover > persistent label > hidden) and updates the DOM
    // element accordingly. Called from every state-changing method below,
    // not from the render loop — the pattern never moves, so there's
    // nothing to recompute per frame.
    function updateTooltipPosition() {
      var dotIndex = null;
      var text = null;
      var tier = 2; // focus/persistent-label are always a full, single-shot reveal — only the real hover/tap path is tiered

      if (mode === "focus" && focusDotIndex !== null) {
        dotIndex = focusDotIndex;
        text = focusText;
      } else if (mode !== "transitioning" && activeTooltipDotIndex !== null) {
        dotIndex = activeTooltipDotIndex;
        text = activeTooltipText;
        tier = activeTooltipTier;
      } else if (mode !== "transitioning" && persistentLabelDotIndex !== null) {
        dotIndex = persistentLabelDotIndex;
        text = { name: persistentLabelName, story: null };
      }

      if (dotIndex === null || !text || (!text.name && !text.story)) {
        tooltipEl.classList.remove("final-scene__tooltip--visible");
        tooltipIconEl.hidden = true;
        return;
      }

      // Item 2 — tier 1: name + "interact again" icon, no story yet. Tier
      // 2: name + story, icon gone.
      var showStory = tier >= 2;
      tooltipNameEl.textContent = text.name || "";
      tooltipNameEl.hidden = !text.name;
      tooltipStoryEl.textContent = showStory ? (text.story || "") : "";
      tooltipStoryEl.hidden = !showStory || !text.story;

      var pos = dotScreenPos(dotIndex);
      tooltipEl.style.left = pos.x + "px";
      tooltipEl.style.top = (pos.y + TOOLTIP_OFFSET_Y_PX) + "px";
      tooltipEl.classList.add("final-scene__tooltip--visible");

      // Item 2 (bug fix) — positioned at the dot's own coordinates, not
      // the name/story panel's offset position (see tooltipIconEl's own
      // doc comment above for why it's a separate element in the first
      // place). Round-3 fix: shows for tier 1 regardless of whether this
      // particular entry has a name (a blank-name-but-colored entry, or a
      // gray "Anonymous" one, still gets the same invite-to-interact icon
      // as a fully-named one — the earlier `|| !text.name` here silently
      // hid it whenever the name was empty, which is exactly the dots
      // this icon matters most for).
      tooltipIconEl.hidden = showStory;
      tooltipIconEl.style.left = pos.x + "px";
      tooltipIconEl.style.top = pos.y + "px";
    }

    function init() {
      resize();
      window.addEventListener("resize", resize);
      requestAnimationFrame(loop);
    }

    // list: array of { dotIndex, color }. Replaces the full assignment set
    // — callers pass the complete current list every time, not a delta.
    function setAssignments(list) {
      assignmentsByIndex = {};
      (list || []).forEach(function (item) {
        if (item && typeof item.dotIndex === "number") {
          assignmentsByIndex[item.dotIndex] = item.color;
        }
      });
    }

    // Item 2 — tier: 1 (name + icon only) or 2 (name + story). Defaults to
    // 1 so any pre-existing caller that never passes a tier gets the
    // conservative first-reveal behavior rather than jumping straight to
    // the story.
    function showTooltip(dotIndex, name, story, tier) {
      activeTooltipDotIndex = dotIndex;
      activeTooltipText = { name: name, story: story };
      activeTooltipTier = tier || 1;
      updateTooltipPosition();
    }

    function hideTooltip(dotIndex) {
      if (activeTooltipDotIndex !== dotIndex) return; // stale/superseded call — no-op
      activeTooltipDotIndex = null;
      activeTooltipText = null;
      activeTooltipTier = 1;
      updateTooltipPosition();
    }

    // Bug fix (round 2, item 1) — see animationsActive's own doc comment.
    function startAnimating() {
      animationsActive = true;
    }

    // Item 3c — see the var declarations above.
    function setTargetHighlight(dotIndex) {
      highlightDotIndex = dotIndex;
    }

    function clearTargetHighlight() {
      highlightDotIndex = null;
    }

    // EXPERIMENTAL, item 1 — see the var declarations above.
    function setPersistentLabel(dotIndex, name) {
      persistentLabelDotIndex = dotIndex;
      persistentLabelName = name;
      updateTooltipPosition();
    }

    function clearPersistentLabel() {
      persistentLabelDotIndex = null;
      persistentLabelName = null;
      updateTooltipPosition();
    }

    function focusOnly(dotIndex, color, name, story) {
      mode = "focus";
      focusDotIndex = dotIndex;
      focusColor = color;
      focusText = { name: name, story: story };
      updateTooltipPosition();
    }

    function revealAll() {
      if (mode === "revealed") return;
      mode = "transitioning";
      transitionStartMs = performance.now();
      updateTooltipPosition(); // hides the focus label — fades out via the tooltip's own CSS transition
    }

    // hitRadiusPx is generous (well beyond the dot's own drawn radius) —
    // easier to hit on touch. Only assigned (named/storied) dots are
    // candidates here — see hitTestAnyDotAt below for the unassigned
    // ("anonymous") ones, kept as a separate function rather than folded
    // in here so a caller can tell the two cases apart (assigned vs. a
    // fresh, unclaimed dot) from which one matched.
    function hitTestDotAt(canvasX, canvasY) {
      var hitRadiusPx = 20;
      var closestIndex = null;
      var closestDistSq = hitRadiusPx * hitRadiusPx;
      for (var key in assignmentsByIndex) {
        if (!assignmentsByIndex.hasOwnProperty(key)) continue;
        var dotIndex = Number(key);
        var pos = dotScreenPos(dotIndex);
        var dx = pos.x - canvasX;
        var dy = pos.y - canvasY;
        var distSq = dx * dx + dy * dy;
        if (distSq <= closestDistSq) {
          closestDistSq = distSq;
          closestIndex = dotIndex;
        }
      }
      return closestIndex;
    }

    // Feature — hit-tests EVERY pattern dot, assigned or not (unlike
    // hitTestDotAt above, which only ever matches already-named/storied
    // dots), so an "anonymous" background dot (no entry, drawn in
    // GRAY_DOT_COLOR) can be hovered too and offered the same unclaimed-
    // slot editor. Explicitly skips already-assigned dots — those are
    // hitTestDotAt's own territory — so a caller checking both never gets
    // a double match in a dense area.
    function hitTestAnyDotAt(canvasX, canvasY) {
      var hitRadiusPx = 20;
      var closestIndex = null;
      var closestDistSq = hitRadiusPx * hitRadiusPx;
      for (var i = 0; i < pattern.length; i++) {
        if (assignmentsByIndex.hasOwnProperty(i)) continue;
        var pos = dotScreenPos(i);
        var dx = pos.x - canvasX;
        var dy = pos.y - canvasY;
        var distSq = dx * dx + dy * dy;
        if (distSq <= closestDistSq) {
          closestDistSq = distSq;
          closestIndex = i;
        }
      }
      return closestIndex;
    }

    // EXPERIMENTAL, round-4 test — the #11780 inline-editing mechanism
    // (stage4-5.js) needs to hit-test specifically against the currently
    // highlighted dot even though it has no entry yet (setTargetHighlight
    // marks it before any assignment exists) — a plain, separate check
    // rather than folding it into hitTestDotAt() above, which stays
    // scoped to assigned dots only, unchanged.
    function hitTestHighlightedDotAt(canvasX, canvasY) {
      if (highlightDotIndex === null) return false;
      var hitRadiusPx = 20;
      var pos = dotScreenPos(highlightDotIndex);
      var dx = pos.x - canvasX;
      var dy = pos.y - canvasY;
      return (dx * dx + dy * dy) <= hitRadiusPx * hitRadiusPx;
    }

    // EXPERIMENTAL, round-4 test — lets stage4-5.js position its own
    // dedicated inline-editor DOM (not the tooltip this file itself
    // manages) directly on a dot's current on-screen coordinates, the
    // same math updateTooltipPosition() already uses internally.
    function getDotScreenPos(dotIndex) {
      return dotScreenPos(dotIndex);
    }

    return {
      init: init,
      setAssignments: setAssignments,
      showTooltip: showTooltip,
      hideTooltip: hideTooltip,
      setPersistentLabel: setPersistentLabel,
      clearPersistentLabel: clearPersistentLabel,
      focusOnly: focusOnly,
      revealAll: revealAll,
      startAnimating: startAnimating,
      setTargetHighlight: setTargetHighlight,
      clearTargetHighlight: clearTargetHighlight,
      hitTestDotAt: hitTestDotAt,
      hitTestAnyDotAt: hitTestAnyDotAt,
      hitTestHighlightedDotAt: hitTestHighlightedDotAt,
      getDotScreenPos: getDotScreenPos
    };
  }

  // Item 3d — the "#11780 placeholder" dot: whichever pattern dot lands
  // nearest the exact center (50, 50), computed once from the same fixed
  // seed every pattern already uses. Always the same index, in any JS
  // context, every time this app runs — not randomized or persisted,
  // since it doesn't need to be (the pattern itself is already
  // deterministic).
  function computeCenterDotIndex() {
    var pattern = generateDotPattern();
    var bestIndex = 0;
    var bestDistSq = Infinity;
    for (var i = 0; i < pattern.length; i++) {
      var dx = pattern[i].x - 50;
      var dy = pattern[i].y - 50;
      var distSq = dx * dx + dy * dy;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestIndex = i;
      }
    }
    return bestIndex;
  }

  window.FinalScene = {
    DOT_COUNT: DOT_COUNT,
    ELEVEN780_PLACEHOLDER_DOT_INDEX: computeCenterDotIndex(),
    generateDotPattern: generateDotPattern,
    createRenderer: createRenderer,
    playNoteTone: playNoteTone
  };
})();
