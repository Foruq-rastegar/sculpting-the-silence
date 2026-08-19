/* ==========================================================================
   Sculpting the Silence — shared helpers
   Common code used across every stage: the state-machine/stage-advance
   core (goToStage/registerStageEnter/goToNextStage), cta button focus/
   Enter/click handling, the typewriter effect, the reusable message-moment
   "attempt ladder" component, the full-viewport blackout helper, and the
   two background audio loop controllers (gunshot + underscore). Exposes
   everything on window.STS for the per-stage files to use. Must load
   before any stage-N.js file.
   ========================================================================== */

(function () {
  "use strict";

  window.STS = window.STS || {};
  var STS = window.STS;

  /* ------------------------------------------------------------------
     Screen mode — dev/testing only, not the final exhibition
     architecture. ?screen=frame / ?screen=field / no param (combined,
     default, current behavior). Exposed as STS.screenMode; CSS hooks off
     the matching data-screen-mode attribute on <html> (see global.css).
     ------------------------------------------------------------------ */
  var screenModeParam = new URLSearchParams(window.location.search).get("screen");
  var screenMode = (screenModeParam === "frame" || screenModeParam === "field") ? screenModeParam : "combined";
  document.documentElement.setAttribute("data-screen-mode", screenMode);
  STS.screenMode = screenMode;

  /* ------------------------------------------------------------------
     Round 8, item 4 — the "more" (⋯) toggle for every dev-tool control
     (Stages/Settings, see index.html's #dev-more-panel). Bug fix: this
     was documented in index.html/global.css's own comments as living
     here, but the actual click wiring was never written — the button
     existed and was styled, but nothing ever listened for a click on it,
     so it did nothing. Plain show/hide via the `hidden` attribute; no
     outside-click-to-close (kept deliberately simple — this is a quick
     dev tool, not a real UI menu).
     ------------------------------------------------------------------ */
  (function setupDevMoreMenu() {
    var toggleBtn = document.getElementById("dev-more-toggle-btn");
    var panel = document.getElementById("dev-more-panel");
    if (!toggleBtn || !panel) return;

    toggleBtn.addEventListener("click", function () {
      panel.hidden = !panel.hidden;
    });
  })();

  /* ------------------------------------------------------------------
     On-screen frame/field toggle buttons — dev/testing only, same
     purpose as ?screen= above but live-toggleable in either window
     without editing the URL (the URL param still sets the initial
     state). The frame button drives a "frame-hidden" class on <html>
     (see global.css) via classList.toggle, so each click cleanly adds
     or removes it rather than juggling an attribute value; the field
     button calls Field.setVisible() directly, same as ?screen=frame
     does from within field.js's init(). Local-only, like
     Field.setVisible itself — never broadcast to the other window.
     ------------------------------------------------------------------ */
  (function setupDevScreenToggleButtons() {
    var frameBtn = document.getElementById("dev-toggle-frame-btn");
    var fieldBtn = document.getElementById("dev-toggle-field-btn");
    if (!frameBtn || !fieldBtn) return;

    var frameVisible = screenMode !== "field";
    var fieldVisible = screenMode !== "frame";
    frameBtn.classList.toggle("is-off", !frameVisible);
    fieldBtn.classList.toggle("is-off", !fieldVisible);

    frameBtn.addEventListener("click", function () {
      frameVisible = !frameVisible;
      document.documentElement.classList.toggle("frame-hidden", !frameVisible);
      frameBtn.classList.toggle("is-off", !frameVisible);
    });

    fieldBtn.addEventListener("click", function () {
      fieldVisible = !fieldVisible;
      if (window.Field) window.Field.setVisible(fieldVisible);
      fieldBtn.classList.toggle("is-off", !fieldVisible);
    });
  })();

  /* ------------------------------------------------------------------
     Cross-window sync (BroadcastChannel) — dev/testing only. When the
     frame and field are opened as two separate windows/monitors, this
     keeps them showing the same stage and field motion state instead of
     each window independently (and, for the field window, silently)
     re-running stage logic like video/audio playback. The window that
     actually runs a stage's real logic (combined mode, or frame mode)
     broadcasts every stage change here; a field-mode window only ever
     applies the "is-active" class from an incoming message — it never
     runs stageEnterHandlers itself, so it never independently starts
     playback. Field's own start/stop/zoom calls are broadcast the same
     way from within field.js.
     ------------------------------------------------------------------ */
  var SYNC_CHANNEL_NAME = "sculpting-the-silence-sync"; // field.js must match this name
  var syncChannel = ("BroadcastChannel" in window) ? new BroadcastChannel(SYNC_CHANNEL_NAME) : null;
  STS.syncChannel = syncChannel;

  /* ------------------------------------------------------------------
     State machine — stage-advance core. Each stage is a DOM section with
     id="stage-N" and class "stage". goToStage() toggles the "is-active"
     class. Add future stages by extending TOTAL_STAGES and giving each
     its own section in index.html.
     ------------------------------------------------------------------ */
  var TOTAL_STAGES = 5; // bump as more stages are added
  var currentStage = 1;

  // Stages that run automatically (no button) register a one-time
  // "on enter" handler here instead of wiring themselves into goToStage.
  var stageEnterHandlers = {};

  function registerStageEnter(stageNumber, handler) {
    stageEnterHandlers[stageNumber] = handler;
  }

  // DOM bookkeeping only — no stageEnterHandlers side effects. Shared by
  // goToStage (which also runs the handler) and by an incoming sync
  // message (which must NOT re-trigger a stage's video/audio locally).
  function applyActiveStageClass(stageNumber) {
    var stages = document.querySelectorAll(".stage");
    stages.forEach(function (stageEl) {
      stageEl.classList.remove("is-active");
    });

    var stageEl = document.getElementById("stage-" + stageNumber);
    if (stageEl) {
      stageEl.classList.add("is-active");
    }
  }

  // skipHandler (optional) — still consumes the stage's one-shot enter
  // handler (so it can never fire late/out of order later), but doesn't
  // run it. For dev tools that jump straight to one specific moment deep
  // inside a stage (see stage3.js's s3_mom_12 skip button) and want to
  // drive that moment directly instead of racing against the stage's own
  // normal from-the-top setup.
  function goToStage(stageNumber, skipHandler) {
    if (stageNumber < 1 || stageNumber > TOTAL_STAGES) {
      console.warn("goToStage: invalid stage number", stageNumber);
      return;
    }

    applyActiveStageClass(stageNumber);
    currentStage = stageNumber;

    // Round 7, item 1 — global idle auto-reset, starting the first time
    // stage 2 or later is reached (stage 1 is the intro/"Run the
    // Experience" screen — no auto-reset before the visitor has actually
    // engaged at all). Started here, in goToStage() itself, rather than
    // through registerStageEnter() (a one-shot, single-handler-per-stage
    // slot each stage's own file already uses for its own setup — this
    // needs to run alongside that, not instead of it). Only ever fires in
    // whichever window actually drives stage changes — a field-only
    // window applies incoming sync messages directly (see
    // applyActiveStageClass in syncChannel.onmessage below), never
    // through goToStage(), so it never independently starts a duplicate
    // timer; triggerNextRunReset() below already broadcasts the reset to
    // it regardless. Supersedes the old final-screen-only idle reset
    // stage4-5.js used to start on its own (see GLOBAL_IDLE_RESET_MS —
    // same 30s, same startIdleAutoReset/triggerNextRunReset pair, just no
    // longer scoped to only the final screen).
    if (stageNumber >= 2 && !globalIdleResetStarted) {
      globalIdleResetStarted = true;
      startIdleAutoReset(GLOBAL_IDLE_RESET_MS, triggerNextRunReset);
    }

    if (syncChannel) {
      syncChannel.postMessage({ type: "stage", stage: stageNumber });
    }

    var handler = stageEnterHandlers[stageNumber];
    if (handler) {
      delete stageEnterHandlers[stageNumber]; // run once
      if (!skipHandler) handler();
    }
  }

  if (syncChannel) {
    syncChannel.onmessage = function (event) {
      var msg = event.data;
      if (!msg) return;

      if (msg.type === "stage") {
        applyActiveStageClass(msg.stage);
        currentStage = msg.stage;
      } else if (msg.type === "request-state") {
        // A window just opened (e.g. the field monitor, after the frame
        // window already advanced) — tell it where we currently are.
        syncChannel.postMessage({ type: "stage", stage: currentStage });
      } else if (msg.type === "reset-for-next-run") {
        // See triggerNextRunReset() below — reload locally so both windows
        // land back on stage 1 together, ready for the next visitor.
        window.location.reload();
      }
    };

    // Ask whoever's already open/driving for the current stage, so a
    // window opened after the other one has already advanced can catch
    // up instead of sitting on stage 1.
    syncChannel.postMessage({ type: "request-state" });
  }

  /* ------------------------------------------------------------------
     Idle auto-reset — item 4: if nothing happens on the final page for a
     while, get the app ready for the next visitor. A full page reload
     (not an in-app goToStage(1)) is deliberate: registerStageEnter()
     handlers are one-shot by design (deleted right after they fire, see
     goToStage() above), so this app's state machine has no way to safely
     re-run a stage's setup a second time in the same page load — a reload
     is what actually resets everything (field.js's dots, the final
     scene's persistent label, heartbeats, audio elements, memorial-reveal
     state, all of it) without hunting down and manually clearing every
     piece of scattered transient state by hand.
     ------------------------------------------------------------------ */
  var IDLE_RESET_EVENTS = ["mousemove", "click", "touchstart", "keydown"];

  // Round 7, item 1 — global from stage 2 onward (see goToStage() above),
  // not just the final screen.
  var GLOBAL_IDLE_RESET_MS = 60000; // 1 minute — was 30s
  var globalIdleResetStarted = false;

  // Starts (or restarts) a timer that calls onIdle after timeoutMs of no
  // matching document-level activity. Callers decide when it's relevant to
  // start counting (see goToStage() above) — this itself has no opinion on
  // which stage/screen is active.
  function startIdleAutoReset(timeoutMs, onIdle) {
    var timer = null;

    function resetTimer() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(onIdle, timeoutMs);
    }

    IDLE_RESET_EVENTS.forEach(function (eventName) {
      document.addEventListener(eventName, resetTimer);
    });
    resetTimer();
  }

  // Broadcasts first (so the other window — e.g. the field-only display in
  // the two-window exhibition split — reloads too, rather than being left
  // stranded on the old final screen) and then reloads this window
  // directly; window.location.reload() preserves the current URL
  // (including any ?screen= param), so each window comes back up in the
  // same screen mode it was already in.
  function triggerNextRunReset() {
    if (syncChannel) syncChannel.postMessage({ type: "reset-for-next-run" });
    window.location.reload();
  }

  STS.startIdleAutoReset = startIdleAutoReset;
  STS.triggerNextRunReset = triggerNextRunReset;

  /* ------------------------------------------------------------------
     Dev tool — "Reset entries": clears the stage-5 entries registry
     (localStorage key exposed as STS.ENTRIES_STORAGE_KEY by stage4-5.js,
     read lazily here inside the click handler rather than at setup time,
     since stage4-5.js — loaded after this file — hasn't run yet when this
     IIFE itself executes) with one click, the same effect as the manual
     `localStorage.removeItem(...)` DevTools console command this
     replaces. Purely a data change — doesn't reload or touch the current
     session's already-rendered final scene, so its effect is only
     visible on the next run (matching how the registry itself is only
     ever read at stage-5 setup time anyway).
     ------------------------------------------------------------------ */
  (function setupDevResetEntriesButton() {
    var button = document.getElementById("dev-reset-entries-btn");
    if (!button) return;

    var defaultLabel = button.textContent;
    var revertLabelTimer = null;

    button.addEventListener("click", function () {
      var key = STS.ENTRIES_STORAGE_KEY;
      if (key) window.localStorage.removeItem(key);

      // Brief on-click confirmation, since there's otherwise no visible
      // effect (no reload, no on-screen registry display outside stage 5).
      if (revertLabelTimer) clearTimeout(revertLabelTimer);
      button.textContent = "Cleared!";
      revertLabelTimer = setTimeout(function () {
        button.textContent = defaultLabel;
      }, 1200);
    });
  })();

  /* ------------------------------------------------------------------
     Dev tool — "Refresh": manually fires the exact same full-reload
     reset the idle timer (see startIdleAutoReset/triggerNextRunReset
     above) uses, on demand, so testing doesn't have to sit through the
     30s idle wait to recover back to stage 1 after getting stuck.
     ------------------------------------------------------------------ */
  (function setupDevRefreshButton() {
    var button = document.getElementById("dev-refresh-btn");
    if (!button) return;

    button.addEventListener("click", function () {
      triggerNextRunReset();
    });
  })();

  function goToNextStage() {
    var nextStage = currentStage + 1;

    if (nextStage > TOTAL_STAGES) {
      // Stub: later stages aren't built yet.
      console.log("stage " + currentStage + " complete -> stage " + nextStage);
      return;
    }

    goToStage(nextStage);
  }

  STS.registerStageEnter = registerStageEnter;
  STS.goToStage = goToStage;
  STS.goToNextStage = goToNextStage;

  // Exposed for future stages / debugging.
  window.goToStage = goToStage;
  window.goToNextStage = goToNextStage;

  /* ------------------------------------------------------------------
     Dev tool — stage-skip buttons, one per stage (TOTAL_STAGES above is
     the single source of truth for the count, so this never drifts out
     of sync with it), jumping straight to that stage via goToStage()
     — i.e. skipping everything before it, including any setup earlier
     stages would otherwise have run (field.js tagging, audio elements,
     etc.), so a stage jumped to directly may look/behave less complete
     than reaching it normally. That's an accepted tradeoff of a blunt
     dev tool, not something this fixes.

     Kept visible unconditionally for now, per current instructions —
     the intended hook point for a later show/hide toggle (keyboard
     shortcut or ?dev= URL param, not built yet) is right here: gate the
     containerEl.hidden assignment (or the whole IIFE) on that condition
     once it exists, same shape as STS.screenMode's own URL-param read
     above.
     ------------------------------------------------------------------ */
  (function setupDevStageSkipButtons() {
    var containerEl = document.getElementById("dev-stage-skip");
    if (!containerEl) return;

    for (var stageNumber = 1; stageNumber <= TOTAL_STAGES; stageNumber++) {
      (function (stageNumber) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "dev-stage-skip__btn";
        button.textContent = "Stage " + stageNumber;
        button.addEventListener("click", function () {
          goToStage(stageNumber);
        });
        containerEl.appendChild(button);
      })(stageNumber);
    }
  })();

  /* ------------------------------------------------------------------
     Cta button handling — shared activation binding for every cta button
     (touch, mouse click, and Enter while focused), plus a document-level
     Enter fallback independent of DOM focus timing.
     ------------------------------------------------------------------ */
  // A real <button> already turns a focused Enter press into a synthetic
  // "click", so the guard flag below just makes sure that synthetic click
  // doesn't fire the handler a second time.
  function bindTapAndClick(el, handler) {
    var suppressNextClick = false;

    el.addEventListener("touchend", function (event) {
      suppressNextClick = true;
      event.preventDefault();
      handler(event);
    });

    el.addEventListener("keydown", function (event) {
      if (event.key !== "Enter") return;
      suppressNextClick = true;
      handler(event);
    });

    el.addEventListener("click", function (event) {
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }
      handler(event);
    });
  }

  // Tracks whichever cta button is currently on screen, across every
  // stage/moment, so the document-level Enter fallback below always knows
  // what to activate.
  var activeCtaButton = null;

  // Every cta button must call this right after being inserted into the
  // DOM: it both focuses the button (so native focused-Enter activation
  // works) and updates the tracked reference (so the fallback below still
  // works even when focus doesn't land, e.g. a button appearing the
  // instant a moment auto-advances, with no prior user interaction).
  function presentCtaButton(el) {
    activeCtaButton = el;
    if (el && typeof el.focus === "function") {
      el.focus();
    }
  }

  // Safety net independent of DOM focus timing: set up once (not per
  // moment). If the tracked button is already focused, its own keydown
  // listener (in bindTapAndClick) handles Enter natively, so this skips.
  // Otherwise it triggers that button directly, regardless of what
  // actually has focus.
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Enter") return;
    if (!activeCtaButton || !document.contains(activeCtaButton)) return;
    if (document.activeElement === activeCtaButton) return;
    activeCtaButton.click();
  });

  STS.bindTapAndClick = bindTapAndClick;
  STS.presentCtaButton = presentCtaButton;

  /* ------------------------------------------------------------------
     Typing effect — reusable by any stage that needs typed-in text.
     Reveals one character at a time, at charsPerSecond.
     ------------------------------------------------------------------ */
  function typeText(element, text, charsPerSecond, onComplete) {
    if (!element) return function () {};

    var intervalMs = 1000 / (charsPerSecond || 30);
    var i = 0;
    element.textContent = "";

    var timer = setInterval(function () {
      i += 1;
      element.textContent = text.slice(0, i);
      if (i >= text.length) {
        clearInterval(timer);
        if (onComplete) onComplete();
      }
    }, intervalMs);

    return function stopTyping() {
      clearInterval(timer);
    };
  }

  STS.typeText = typeText;

  /* ------------------------------------------------------------------
     Full-viewport blackout — briefly covers everything (background
     layer and frame alike) with solid black, then calls back. Stage 2's
     moment-to-moment blackout is a dedicated .moment element driven by
     that stage's own moment runner; this is the same effect as a
     standalone helper for anywhere else a hard black beat is needed
     (e.g. stage 3's ending).
     ------------------------------------------------------------------ */
  function coverViewportInBlack(durationMs, onDone) {
    var overlayEl = document.createElement("div");
    overlayEl.className = "viewport-blackout";
    document.body.appendChild(overlayEl);
    setTimeout(function () {
      document.body.removeChild(overlayEl);
      onDone();
    }, durationMs);
  }

  STS.coverViewportInBlack = coverViewportInBlack;

  /* ------------------------------------------------------------------
     Moment content box (see .moment-content-box in global.css) — a
     background panel behind a moment's own content, rolled out from an
     s2_mom_03 test. For static-HTML moments (stage 2) the wrapper div is
     written directly in index.html; for JS-built moment content (stage
     4/5's own render functions, and stage 3's once that's decided — see
     its own open question) this creates and appends it the same way,
     returning it so the caller appends its own children there instead of
     to containerEl. containerEl itself (the .moment/.message-moment
     element) is never touched beyond gaining this one child — same
     "purely additive" approach as the static-HTML case.
     extraClassName is optional — each moment that uses this also gets one
     of the .moment-content-box--* min-height modifiers in global.css,
     since different moments need different floors; passing it here
     avoids needing containerEl's own id/class to double as a CSS
     selector hook for that (several moments share one mount element
     across different content, e.g. stage 5's choice vs. form moments
     both render into #stage-5-moment-mount, so an id-based selector
     couldn't tell them apart).
     ------------------------------------------------------------------ */
  function createMomentContentBox(containerEl, extraClassName) {
    var boxEl = document.createElement("div");
    boxEl.className = extraClassName ? "moment-content-box " + extraClassName : "moment-content-box";
    containerEl.appendChild(boxEl);
    return boxEl;
  }

  STS.createMomentContentBox = createMomentContentBox;

  /* ------------------------------------------------------------------
     Message moment — reusable "attempt ladder" component: types a
     message, shows a CTA button, and on click runs a spinner for a
     configured number of visible rotations before revealing that
     attempt's response. An intermediate text response (not the final
     attempt) chains into the next attempt's button, with the message
     staying visible. A terminal "leak" — image, audio, video, the
     final attempt's text, or an ordered array of these shown one after
     another — ends the moment; the original typed message is cleared
     the instant a leak is about to show, since a message and a leak
     must never be visible at the same time. Stage 3 calls this once
     per message-moment data object, in order.
     ------------------------------------------------------------------ */
  // Item 1 (slower loading animations) — was 900ms; same visible rotation
  // counts everywhere (spinCount, per-attempt loadSpins), just 1.5x slower
  // motion per rotation.
  var SPIN_DURATION_MS = 1350;

  // Rotates mountEl's spinner for spinCount visible rotations then calls
  // onDone — the same spinner used by every message-moment attempt below,
  // exposed so other stages (e.g. stage 2's transitional beats) can reuse
  // it outside the attempt-ladder flow.
  function runSpinner(mountEl, spinCount, onDone) {
    mountEl.innerHTML = ""; // instant, no fade
    var spinner = document.createElement("div");
    spinner.className = "message-moment__spinner";
    spinner.style.animationDuration = SPIN_DURATION_MS + "ms";
    spinner.style.animationIterationCount = String(spinCount);
    mountEl.appendChild(spinner);

    spinner.addEventListener("animationend", function onSpinEnd() {
      spinner.removeEventListener("animationend", onSpinEnd);
      onDone();
    });
  }

  STS.runSpinner = runSpinner;
  STS.SPIN_DURATION_MS = SPIN_DURATION_MS; // exposed so callers can compute a spinner's total duration (spinCount * this)

  // onLeakShown(response) is optional — fired right as a terminal leak
  // (image/video/audio/chain, or the final attempt's text) begins
  // rendering, i.e. at the same points clearMessageText() is called below.
  // Lets a caller (e.g. stage3.js) react to a *specific* leak actually
  // showing on frame, since images/text have no native "play" event to
  // hook the way audio/video do.
  function runMessageMoment(containerEl, data, onComplete, onLeakShown) {
    if (!containerEl) return;
    containerEl.innerHTML = "";

    // boxEl wraps the message text, the attempt button/spinner, and any
    // leak's *accompanying* text (caption/subtitle) or a terminal text
    // leak — everything except leak image/video media itself, which
    // mounts into leakMediaEl instead (a sibling, never wrapped) so
    // applyLeakZoom's zoom-to-fill-and-overflow effect (see its
    // own doc comment below) stays completely untouched by the wrapper's
    // own max-width/background. boxEl is hidden (setBoxVisible(false))
    // whenever a leak with nothing of its own to show in it is on screen
    // (image/video with no caption) — otherwise it'd sit there as a
    // visibly empty dark panel next to the leak for no reason.
    var boxEl = createMomentContentBox(containerEl, "moment-content-box--s3-message");

    function setBoxVisible(visible) {
      boxEl.style.display = visible ? "" : "none";
    }

    var textEl = document.createElement("p");
    textEl.className = "frame__body message-moment__text";
    boxEl.appendChild(textEl);

    var actionEl = document.createElement("div");
    actionEl.className = "message-moment__action";
    boxEl.appendChild(actionEl);

    // Leak image/video media only — see boxEl's own doc comment above.
    // Hidden (no .is-active) whenever nothing's currently mounted in it.
    var leakMediaEl = document.createElement("div");
    leakMediaEl.className = "message-moment__leak-media";
    containerEl.appendChild(leakMediaEl);

    function clearLeakMedia() {
      leakMediaEl.innerHTML = "";
      leakMediaEl.classList.remove("is-active");
    }

    function showAttemptButton(index) {
      actionEl.innerHTML = ""; // instant, no fade
      var attempt = data.attempts[index];

      var button = document.createElement("button");
      button.type = "button";
      button.className = "button message-moment__button";
      button.textContent = attempt.cta;
      bindTapAndClick(button, function () {
        runAttempt(index);
      });
      actionEl.appendChild(button);
      presentCtaButton(button);
    }

    function runAttempt(index) {
      var attempt = data.attempts[index];
      runSpinner(actionEl, attempt.loadSpins, function () {
        showResponse(index);
      });
    }

    function finishMoment() {
      containerEl.innerHTML = ""; // instant, no fade
      onComplete();
    }

    // A leak (image/audio/video/terminal-text/chain) is about to show —
    // the original message must never be visible alongside it.
    function clearMessageText() {
      textEl.textContent = "";
    }

    // EXPERIMENT — zoom-to-fill: every stage-3 leak image and video
    // (standalone or within a chain) EXCEPT s3_leak_08_img (rendered
    // separately by runNameThemMoment's own image+caption layout, never
    // through here). Over the leak's full display duration it slowly
    // zooms from its normal framing up to LEAK_ZOOM_FILL_SCALE — enough
    // to fill and slightly overflow the frame (.frame has
    // overflow: visible). Previously paired with a fade-to-black over the
    // timeline's final share; the fade was removed per feedback, zoom
    // kept as-is.
    var LEAK_ZOOM_FILL_SCALE = 1.4;

    function applyLeakZoom(el, durationMs) {
      el.style.transition = "transform " + durationMs + "ms linear";
      el.getBoundingClientRect(); // force reflow before enabling the transition
      requestAnimationFrame(function () {
        el.style.transform = "scale(" + LEAK_ZOOM_FILL_SCALE + ")";
      });
    }

    // Same pattern as stage 2's social-feeds video: autoplay/inline with
    // sound, no controls, advances on the native 'ended' event. Playing
    // with audio is safe here since stage 1 already required a user
    // click ("Run the Experience") earlier in the session. mountEl is
    // always leakMediaEl (never boxEl) — videos never carry a caption in
    // this codebase, so boxEl has nothing to show alongside one and stays
    // hidden for the video's whole duration.
    function playLeakVideo(mountEl, src, onEnded) {
      setBoxVisible(false);
      mountEl.classList.add("is-active");

      var video = document.createElement("video");
      video.className = "message-moment__response-video";
      video.src = src;
      video.autoplay = true;
      video.playsInline = true;
      video.preload = "none";
      mountEl.appendChild(video);

      var handleEnded = function () {
        video.removeEventListener("ended", handleEnded);
        onEnded();
      };
      video.addEventListener("ended", handleEnded);

      // The zoom timeline is tied to the clip's own length, known only
      // once its metadata has loaded.
      video.addEventListener("loadedmetadata", function onLoadedMetadata() {
        video.removeEventListener("loadedmetadata", onLoadedMetadata);
        applyLeakZoom(video, video.duration * 1000);
      });

      video.load();
      var playPromise = video.play();
      if (playPromise && playPromise.catch) {
        playPromise.catch(function () {});
      }
    }

    // Every stage-3 leak image (standalone or within a chain): the
    // zoom-to-fill treatment above, timed to the image's full display
    // duration. An optional caption types in below it, fire-and-forget
    // (doesn't gate onDone/durationMs). Media and caption mount
    // separately — the image stays unwrapped (leakMediaEl, so
    // applyLeakZoom's overflow is never clipped by boxEl), the caption
    // goes in boxEl (captionMountEl, normally actionEl) which is only
    // shown when there's actually a caption to display.
    function renderZoomingLeakImage(mediaMountEl, captionMountEl, src, durationMs, onDone, caption) {
      mediaMountEl.classList.add("is-active");
      setBoxVisible(!!caption);

      var img = document.createElement("img");
      img.className = "message-moment__response-image";
      img.src = src;
      img.alt = "";
      mediaMountEl.appendChild(img);

      applyLeakZoom(img, durationMs);

      if (caption) {
        var captionEl = document.createElement("p");
        captionEl.className = "frame__body message-moment__response-text";
        captionMountEl.appendChild(captionEl);
        typeText(captionEl, caption, 14);
      }

      setTimeout(onDone, durationMs);
    }

    // A response can be an ordered array of leaks (e.g. text then video)
    // shown one after another instead of a single response; the whole
    // chain is terminal, so it only ever runs once the message text has
    // already been cleared by the caller. Every chain step is instant, as
    // with any other leak.
    function showLeakChain(responses, chainIndex) {
      actionEl.innerHTML = ""; // instant, no fade
      clearLeakMedia();
      var item = responses[chainIndex];
      var isLastInChain = chainIndex === responses.length - 1;

      function advanceChain() {
        if (isLastInChain) {
          finishMoment();
        } else {
          showLeakChain(responses, chainIndex + 1);
        }
      }

      if (item.type === "video") {
        playLeakVideo(leakMediaEl, item.value, advanceChain);
        return;
      }

      if (item.type === "image") {
        renderZoomingLeakImage(leakMediaEl, actionEl, item.value, item.displayMs || 3500, advanceChain, item.caption);
        return;
      }

      // type === "text"
      setBoxVisible(true);

      var chainTextEl = document.createElement("p");
      chainTextEl.className = "frame__body message-moment__response-text";
      actionEl.appendChild(chainTextEl);
      typeText(chainTextEl, item.value, 14);
      setTimeout(advanceChain, item.displayMs || 3500);
    }

    // Reuses the stage-2 moment-2.3 waveform-indicator pattern: bars start
    // animating exactly when audio.play() is called and freeze on 'ended'.
    function showAudioResponse(response) {
      var wrapperEl = document.createElement("div");
      wrapperEl.className = "message-moment__audio-response";
      actionEl.appendChild(wrapperEl);

      var subtitleText = document.createElement("p");
      subtitleText.className = "frame__body message-moment__response-text";
      wrapperEl.appendChild(subtitleText);
      if (response.subtitle) typeText(subtitleText, response.subtitle, 14);

      var waveformEl = document.createElement("div");
      waveformEl.className = "waveform-indicator message-moment__waveform";
      for (var i = 0; i < 14; i += 1) {
        var bar = document.createElement("span");
        bar.className = "waveform-indicator__bar";
        waveformEl.appendChild(bar);
      }
      wrapperEl.appendChild(waveformEl);

      var audioEl = document.createElement("audio");
      audioEl.src = response.value;
      audioEl.preload = "none";
      wrapperEl.appendChild(audioEl);

      var onEnded = function () {
        audioEl.removeEventListener("ended", onEnded);
        waveformEl.classList.remove("waveform-indicator--playing");
        setTimeout(finishMoment, 2000);
      };
      audioEl.addEventListener("ended", onEnded);
      audioEl.load();
      var playPromise = audioEl.play();
      waveformEl.classList.add("waveform-indicator--playing");
      if (playPromise && playPromise.catch) {
        playPromise.catch(function () {});
      }
    }

    function showResponse(index) {
      actionEl.innerHTML = ""; // instant, no fade
      clearLeakMedia();
      var attempt = data.attempts[index];
      var response = attempt.response;
      var isFinalAttempt = index === data.attempts.length - 1;

      if (Array.isArray(response)) {
        // A leak chain is always terminal.
        clearMessageText();
        if (onLeakShown) onLeakShown(response[0]);
        showLeakChain(response, 0);
        return;
      }

      if (response.type === "image") {
        clearMessageText();
        if (onLeakShown) onLeakShown(response);
        renderZoomingLeakImage(leakMediaEl, actionEl, response.value, 3500, finishMoment, response.caption);
        return;
      }

      if (response.type === "video") {
        clearMessageText();
        if (onLeakShown) onLeakShown(response);
        playLeakVideo(leakMediaEl, response.value, finishMoment);
        return;
      }

      if (response.type === "audio") {
        clearMessageText();
        if (onLeakShown) onLeakShown(response);
        setBoxVisible(true);
        showAudioResponse(response);
        return;
      }

      // type === "text": short "retry" display mid-ladder (message stays
      // visible, this is not a leak), or the terminal leak treatment
      // (same as image/audio/video) when it's the final attempt.
      setBoxVisible(true);
      if (isFinalAttempt) {
        clearMessageText();
        if (onLeakShown) onLeakShown(response);
      }

      var responseText = document.createElement("p");
      responseText.className = "frame__body message-moment__response-text";
      actionEl.appendChild(responseText);
      // "No response"/"No connection" show instantly — every other
      // response text still types in char-by-char.
      if (response.value === "No response" || response.value === "No connection") {
        responseText.textContent = response.value;
      } else {
        typeText(responseText, response.value, 14);
      }

      if (isFinalAttempt) {
        setTimeout(finishMoment, 3500);
      } else {
        setTimeout(function () {
          actionEl.innerHTML = ""; // instant, no fade
          var nextMessage = attempt.nextMessage;
          if (nextMessage) {
            // Retype the frame's message before the next attempt's cta —
            // an absolute size for this retyping only, never cumulative.
            textEl.style.fontSize = nextMessage.fontSizeDeltaPx
              ? "calc(var(--font-size-body) + " + nextMessage.fontSizeDeltaPx + "px)"
              : "";
            typeText(textEl, nextMessage.text, 14, function () {
              showAttemptButton(index + 1);
            });
          } else {
            showAttemptButton(index + 1);
          }
        }, 700);
      }
    }

    typeText(textEl, data.message, 14, function () {
      showAttemptButton(0);
    });
  }

  STS.runMessageMoment = runMessageMoment;

  /* ------------------------------------------------------------------
     Background audio loop controllers — gunshot (used only within stage
     3) and underscore (started at the same point in stage 3, but kept
     running through stage 4 and into stage 5's form). Centralized here
     since both stage 3 (start/stop) and stage 5 (underscore stop on
     submit) need to trigger them.
     ------------------------------------------------------------------ */
  function startLoopingAudio(audioEl, volume) {
    if (!audioEl) return;
    audioEl.loop = true;
    audioEl.volume = volume;
    audioEl.load();
    var playPromise = audioEl.play();
    if (playPromise && playPromise.catch) {
      playPromise.catch(function () {});
    }
  }

  function stopLoopingAudio(audioEl) {
    if (!audioEl) return;
    audioEl.pause();
    audioEl.currentTime = 0;
  }

  var STAGE_3_GUNSHOT_VOLUME = 0.35;
  var STAGE_3_UNDERSCORE_VOLUME = 0.25;

  STS.gunshotAudio = {
    start: function () {
      startLoopingAudio(document.getElementById("stage-3-gunshot-audio"), STAGE_3_GUNSHOT_VOLUME);
    },
    stop: function () {
      stopLoopingAudio(document.getElementById("stage-3-gunshot-audio"));
    }
  };

  STS.underscoreAudio = {
    start: function () {
      startLoopingAudio(document.getElementById("stage-3-underscore-audio"), STAGE_3_UNDERSCORE_VOLUME);
    },
    stop: function () {
      stopLoopingAudio(document.getElementById("stage-3-underscore-audio"));
    }
  };

  /* ------------------------------------------------------------------
     "Call them by name" queue — the same CTA (label "Call them by name")
     appears once at the end of stage 3 (s3_mom_12, runNameThemMoment's
     finalCta, its 8th cta) and once per named moment in stage 4 (one per
     entry in stage4-5.js's NAME_MOMENTS_DATA). Every click of any of
     those occurrences should call STS.callNextInSequence() here, which
     drives a single shared queue of the 9 tagged field dots (s4_name_01
     .. s4_name_09, tagged by field.js's startMemorialReveal()):
       - resolves whichever dot was mid-heartbeat from the *previous*
         click (Field.resolveNamedDot — random permanent color, heartbeat
         stopped), if any;
       - then starts Field.s4_heartbeat_anim on the next dot in the queue.
     The very first click (s3_mom_12's finalCta) has nothing to resolve
     yet — see callByNameQueueIndex's initial value below.

     #11780 is NOT part of this queue — it has its own dedicated pair of
     direct Field calls, both from s3_mom_12 (see stage3.js's
     runNameThemMoment): the intro's "search" cta (1st of the moment's 8
     ctas) starts its heartbeat + ready-to-call stroke + field text label,
     and the finalCta ("Call them by name", the same click that fires
     callNextInSequence() above) separately resolves it via
     Field.resolveNamedDot("#11780") — already highlighted by "search" by
     that point, so it's resolved immediately rather than waiting its turn
     in this queue. (#11780 briefly *was* this queue's 10th/final entry in
     an earlier version — moved back out once it got its own dedicated
     activate/resolve triggers, since leaving it in the queue too would
     have made the 9th name moment's click (s4_mom_21) restart its
     heartbeat well after it had already been resolved.)
     ------------------------------------------------------------------ */
  var CALL_BY_NAME_QUEUE = [
    "s4_name_01", "s4_name_02", "s4_name_03", "s4_name_04", "s4_name_05",
    "s4_name_06", "s4_name_07", "s4_name_08", "s4_name_09"
  ];
  var callByNameQueueIndex = -1; // index of the dot currently mid-heartbeat, or -1 if none yet

  function callNextInSequence() {
    if (!window.Field) return;

    if (callByNameQueueIndex >= 0 && callByNameQueueIndex < CALL_BY_NAME_QUEUE.length) {
      window.Field.resolveNamedDot(CALL_BY_NAME_QUEUE[callByNameQueueIndex]);
    }

    callByNameQueueIndex += 1;
    if (callByNameQueueIndex < CALL_BY_NAME_QUEUE.length) {
      window.Field.s4_heartbeat_anim(CALL_BY_NAME_QUEUE[callByNameQueueIndex]);
    }
  }

  STS.callNextInSequence = callNextInSequence;
})();
