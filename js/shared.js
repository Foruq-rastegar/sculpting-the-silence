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

  function goToStage(stageNumber) {
    if (stageNumber < 1 || stageNumber > TOTAL_STAGES) {
      console.warn("goToStage: invalid stage number", stageNumber);
      return;
    }

    var stages = document.querySelectorAll(".stage");
    stages.forEach(function (stageEl) {
      stageEl.classList.remove("is-active");
    });

    var nextStageEl = document.getElementById("stage-" + stageNumber);
    if (nextStageEl) {
      nextStageEl.classList.add("is-active");
    }

    currentStage = stageNumber;

    var handler = stageEnterHandlers[stageNumber];
    if (handler) {
      delete stageEnterHandlers[stageNumber]; // run once
      handler();
    }
  }

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
  var SPIN_DURATION_MS = 900;

  function runMessageMoment(containerEl, data, onComplete) {
    if (!containerEl) return;
    containerEl.innerHTML = "";

    var textEl = document.createElement("p");
    textEl.className = "frame__body message-moment__text";
    containerEl.appendChild(textEl);

    var actionEl = document.createElement("div");
    actionEl.className = "message-moment__action";
    containerEl.appendChild(actionEl);

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
      actionEl.innerHTML = ""; // instant, no fade
      var attempt = data.attempts[index];

      var spinner = document.createElement("div");
      spinner.className = "message-moment__spinner";
      spinner.style.animationDuration = SPIN_DURATION_MS + "ms";
      spinner.style.animationIterationCount = String(attempt.loadSpins);
      actionEl.appendChild(spinner);

      spinner.addEventListener("animationend", function onSpinEnd() {
        spinner.removeEventListener("animationend", onSpinEnd);
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

    // Same pattern as stage 2's social-feeds video: autoplay/inline with
    // sound, no controls, advances on the native 'ended' event. Playing
    // with audio is safe here since stage 1 already required a user
    // click ("Run the Experience") earlier in the session.
    function playLeakVideo(mountEl, src, onEnded) {
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
      video.load();
      var playPromise = video.play();
      if (playPromise && playPromise.catch) {
        playPromise.catch(function () {});
      }
    }

    // Every stage-3 leak image (standalone or within a chain): a slow,
    // gentle zoom-in over the image's full display duration, so it's
    // subtly still growing right up until it's cleared from the screen.
    // An optional caption types in below it, fire-and-forget (doesn't
    // gate onDone/durationMs).
    function renderZoomingLeakImage(mountEl, src, durationMs, onDone, caption) {
      var img = document.createElement("img");
      img.className = "message-moment__response-image";
      img.src = src;
      img.alt = "";
      mountEl.appendChild(img);

      img.style.transition = "transform " + durationMs + "ms linear";
      img.getBoundingClientRect(); // force reflow before enabling the transition
      requestAnimationFrame(function () {
        img.style.transform = "scale(1.08)";
      });

      if (caption) {
        var captionEl = document.createElement("p");
        captionEl.className = "frame__body message-moment__response-text";
        mountEl.appendChild(captionEl);
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
        playLeakVideo(actionEl, item.value, advanceChain);
        return;
      }

      if (item.type === "image") {
        renderZoomingLeakImage(actionEl, item.value, item.displayMs || 3500, advanceChain, item.caption);
        return;
      }

      // type === "text"

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
      var attempt = data.attempts[index];
      var response = attempt.response;
      var isFinalAttempt = index === data.attempts.length - 1;

      if (Array.isArray(response)) {
        // A leak chain is always terminal.
        clearMessageText();
        showLeakChain(response, 0);
        return;
      }

      if (response.type === "image") {
        clearMessageText();
        renderZoomingLeakImage(actionEl, response.value, 3500, finishMoment, response.caption);
        return;
      }

      if (response.type === "video") {
        clearMessageText();
        playLeakVideo(actionEl, response.value, finishMoment);
        return;
      }

      if (response.type === "audio") {
        clearMessageText();
        showAudioResponse(response);
        return;
      }

      // type === "text": short "retry" display mid-ladder (message stays
      // visible, this is not a leak), or the terminal leak treatment
      // (same as image/audio/video) when it's the final attempt.
      if (isFinalAttempt) {
        clearMessageText();
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
})();
