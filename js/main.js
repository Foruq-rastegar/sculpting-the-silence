/* ==========================================================================
   Sculpting the Silence — Stage controller
   Simple stage-switching pattern: each stage is a DOM section with
   id="stage-N" and class "stage". goToStage() toggles the "is-active"
   class. Add future stages by extending TOTAL_STAGES and giving each
   its own section in index.html.
   ========================================================================== */

(function () {
  "use strict";

  var TOTAL_STAGES = 3; // bump as stages 4-5 are added
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

  // Shared activation binding for every cta button (touch, mouse click, and
  // Enter while focused). A real <button> already turns a focused Enter
  // press into a synthetic "click", so the guard flag below just makes
  // sure that synthetic click doesn't fire the handler a second time.
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

  function exitStage1(event) {
    var frameEl = document.querySelector("#stage-1 .frame");
    if (frameEl) {
      frameEl.classList.add("frame--exiting");
    }
    goToNextStage();
  }

  /* ------------------------------------------------------------------
     Typing effect — reusable by any stage that needs typed-in text.
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

  /* ------------------------------------------------------------------
     Moment runner — plays an ordered list of moments one at a time.
     Each moment is { el, run(advance), startDelayMs }: el is shown
     (instantly, blank) while startDelayMs elapses, then run() is
     called to render the moment's content; run() calls advance() when
     the moment is done. Reusable by any stage built from auto-timed
     moments.
     ------------------------------------------------------------------ */
  function runMoments(momentEls, moments, onComplete) {
    var index = 0;

    function activate(activeEl) {
      momentEls.forEach(function (m) {
        m.classList.remove("is-active");
      });
      if (activeEl) activeEl.classList.add("is-active");
    }

    function playNext() {
      if (index >= moments.length) {
        onComplete();
        return;
      }

      var moment = moments[index];
      index += 1;
      activate(moment.el); // instant, blank — no fade

      var advanced = false;
      var advance = function () {
        if (advanced) return;
        advanced = true;
        playNext();
      };

      var startDelayMs = moment.startDelayMs || 0;
      if (startDelayMs > 0) {
        setTimeout(function () {
          moment.run(advance);
        }, startDelayMs);
      } else {
        moment.run(advance);
      }
    }

    playNext();
  }

  /* ------------------------------------------------------------------
     Full-viewport blackout — briefly covers everything (background
     layer and frame alike) with solid black, then calls back. Stage 2's
     moment-to-moment blackout is a dedicated .moment element driven by
     runMoments; this is the same effect as a standalone helper for
     anywhere else a hard black beat is needed (e.g. stage 3's ending).
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

  /* ------------------------------------------------------------------
     Stage 2 — automatic sequence: social feeds video, connectivity
     blackout graphic, gunfire warning. No buttons, all auto-timed.
     ------------------------------------------------------------------ */
  var NETBLOCKS_DATA = {
    title: "National Connectivity — Iran",
    unitLabel: "% of ordinary traffic levels",
    dataPoints: [
      { day: -5, connectivity: 96 },
      { day: -4, connectivity: 98 },
      { day: -3, connectivity: 94 },
      { day: -2, connectivity: 97 },
      { day: -1, connectivity: 99 },
      { day: 0, connectivity: 95 },
      { day: 0.3, connectivity: 55 },
      { day: 0.6, connectivity: 18 },
      { day: 1, connectivity: 1 },
      { day: 2, connectivity: 1 },
      { day: 3, connectivity: 2 },
      { day: 4, connectivity: 1 },
      { day: 5, connectivity: 2 },
      { day: 6, connectivity: 1 },
      { day: 7, connectivity: 2 },
      { day: 8, connectivity: 1 },
      { day: 9, connectivity: 2 },
      { day: 10, connectivity: 2 },
      { day: 11, connectivity: 3 },
      { day: 12, connectivity: 3 },
      { day: 13, connectivity: 2 },
      { day: 14, connectivity: 3 },
      { day: 15, connectivity: 6 },
      { day: 16, connectivity: 7 },
      { day: 18, connectivity: 8 },
      { day: 20, connectivity: 9 }
    ],
    annotation: { text: "18+ days of near-total blackout", atDay: 8 },
    style: {
      backgroundColor: "#0a0a0a",
      lineColor: "#2dd4bf",
      gridColor: "#2a2a2a",
      textColor: "#ffffff",
      lineWidthPx: 2
    },
    animation: { drawDurationMs: 3200, totalDurationMs: 7000 }
  };

  function renderNetblocksChart(mountEl, data) {
    if (!mountEl) return;
    mountEl.innerHTML = "";

    var svgNS = "http://www.w3.org/2000/svg";
    var svgW = 320;
    var svgH = 150;
    var padLeft = 34;
    var padRight = 10;
    var padTop = 26;
    var padBottom = 14;
    var plotW = svgW - padLeft - padRight;
    var plotH = svgH - padTop - padBottom;

    var days = data.dataPoints.map(function (p) { return p.day; });
    var minDay = Math.min.apply(null, days);
    var maxDay = Math.max.apply(null, days);

    function xForDay(day) {
      return padLeft + ((day - minDay) / (maxDay - minDay)) * plotW;
    }
    function yForValue(v) {
      return padTop + plotH - (v / 100) * plotH;
    }

    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 " + svgW + " " + svgH);
    svg.style.backgroundColor = data.style.backgroundColor;

    // Gridlines at 0/25/50/75/100.
    [0, 25, 50, 75, 100].forEach(function (v) {
      var y = yForValue(v);
      var line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", padLeft);
      line.setAttribute("x2", svgW - padRight);
      line.setAttribute("y1", y);
      line.setAttribute("y2", y);
      line.setAttribute("stroke", data.style.gridColor);
      line.setAttribute("stroke-width", "1");
      svg.appendChild(line);
    });

    var title = document.createElementNS(svgNS, "text");
    title.setAttribute("x", padLeft);
    title.setAttribute("y", 11);
    title.setAttribute("fill", data.style.textColor);
    title.setAttribute("font-size", "7");
    title.textContent = data.title;
    svg.appendChild(title);

    var unit = document.createElementNS(svgNS, "text");
    unit.setAttribute("x", padLeft);
    unit.setAttribute("y", padTop - 4);
    unit.setAttribute("fill", data.style.textColor);
    unit.setAttribute("font-size", "5.5");
    unit.setAttribute("opacity", "0.6");
    unit.textContent = data.unitLabel;
    svg.appendChild(unit);

    var pathData = data.dataPoints
      .map(function (p, idx) {
        var x = xForDay(p.day);
        var y = yForValue(p.connectivity);
        return (idx === 0 ? "M" : "L") + x.toFixed(2) + " " + y.toFixed(2);
      })
      .join(" ");

    var path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", pathData);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", data.style.lineColor);
    path.setAttribute("stroke-width", String(data.style.lineWidthPx));
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);

    mountEl.appendChild(svg);

    // Draw-on animation: start fully hidden, reveal over drawDurationMs.
    var length = path.getTotalLength();
    path.style.strokeDasharray = String(length);
    path.style.strokeDashoffset = String(length);
    path.getBoundingClientRect(); // force reflow before enabling transition
    path.style.transition = "stroke-dashoffset " + data.animation.drawDurationMs + "ms linear";
    requestAnimationFrame(function () {
      path.style.strokeDashoffset = "0";
    });

    // Annotation fades in once the line finishes drawing. This is an
    // internal data-reveal detail, not a stage/moment transition, so
    // it's exempt from the no-fade rule applied elsewhere.
    setTimeout(function () {
      var ax = Math.min(Math.max(xForDay(data.annotation.atDay), padLeft + 4), svgW - padRight - 4);
      var text = document.createElementNS(svgNS, "text");
      text.setAttribute("x", ax);
      text.setAttribute("y", padTop + 14);
      text.setAttribute("fill", data.style.textColor);
      text.setAttribute("font-size", "6.5");
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("opacity", "0");
      text.style.transition = "opacity 400ms ease";
      text.textContent = data.annotation.text;
      svg.appendChild(text);
      requestAnimationFrame(function () {
        text.setAttribute("opacity", "1");
      });
    }, data.animation.drawDurationMs);
  }

  function initStage2() {
    var stageEl = document.getElementById("stage-2");
    if (!stageEl) return;

    var momentEls = stageEl.querySelectorAll(".moment");
    var videoEl = document.getElementById("stage-2-video");
    var cutoffTextEl = document.getElementById("stage-2-cutoff-text");
    var chartMountEl = document.getElementById("stage-2-chart-mount");
    var gunfireTextEl = document.getElementById("stage-2-gunfire-text");
    var gunshotAudioEl = document.getElementById("stage-2-gunshot-audio");
    var waveformEl = document.getElementById("stage-2-waveform");

    var moments = [
      {
        // 2.1 — social feeds video. preload="none" on the <video> keeps it
        // from silently playing/finishing in the background during stage 1;
        // load()+play() here starts it fresh exactly when this moment begins.
        el: document.getElementById("stage-2-moment-video"),
        run: function (advance) {
          if (!videoEl) {
            advance();
            return;
          }
          var onEnded = function () {
            videoEl.removeEventListener("ended", onEnded);
            advance();
          };
          videoEl.addEventListener("ended", onEnded);
          videoEl.load();
          var playPromise = videoEl.play();
          if (playPromise && playPromise.catch) {
            playPromise.catch(function () {});
          }
        }
      },
      {
        // 2.2 — digital cutoff text + connectivity graph.
        el: document.getElementById("stage-2-moment-cutoff"),
        run: function (advance) {
          typeText(
            cutoffTextEl,
            "As the protests peaked, the government completely blacked out all communication channels in Iran.",
            14
          );
          renderNetblocksChart(chartMountEl, NETBLOCKS_DATA);
          setTimeout(advance, NETBLOCKS_DATA.animation.totalDurationMs);
        }
      },
      {
        // Black-screen beat between 2.2 and 2.3: covers the entire
        // viewport (background layer + frame, via a sibling element
        // outside .frame) with solid black for exactly 1000ms.
        el: document.getElementById("stage-2-moment-blackout"),
        run: function (advance) {
          setTimeout(advance, 1000);
        }
      },
      {
        // 2.3 — gunfire warning text.
        el: document.getElementById("stage-2-moment-gunfire"),
        run: function (advance) {
          typeText(gunfireTextEl, "They are shooting by shotguns ...", 14);

          if (!gunshotAudioEl) {
            advance();
            return;
          }
          var onEnded = function () {
            gunshotAudioEl.removeEventListener("ended", onEnded);
            if (waveformEl) waveformEl.classList.remove("waveform-indicator--playing");
            setTimeout(advance, 2000);
          };
          gunshotAudioEl.addEventListener("ended", onEnded);
          gunshotAudioEl.load();
          var playPromise = gunshotAudioEl.play();
          if (waveformEl) waveformEl.classList.add("waveform-indicator--playing");
          if (playPromise && playPromise.catch) {
            playPromise.catch(function () {});
          }
        }
      }
    ];

    runMoments(momentEls, moments, goToNextStage);
  }

  registerStageEnter(2, initStage2);

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

    // A response can be an ordered array of leaks (e.g. text caption then
    // video) shown one after another instead of a single response; the
    // whole chain is terminal, so it only ever runs once the message text
    // has already been cleared by the caller.
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
        var img = document.createElement("img");
        img.className = "message-moment__response-image";
        img.src = item.value;
        img.alt = "";
        actionEl.appendChild(img);
        setTimeout(advanceChain, item.displayMs || 3500);
        return;
      }

      // type === "text"
      var chainTextEl = document.createElement("p");
      chainTextEl.className = "frame__body message-moment__response-text";
      chainTextEl.textContent = item.value;
      actionEl.appendChild(chainTextEl);
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
      subtitleText.textContent = response.subtitle || "";
      wrapperEl.appendChild(subtitleText);

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
      var response = data.attempts[index].response;
      var isFinalAttempt = index === data.attempts.length - 1;

      if (Array.isArray(response)) {
        // A leak chain is always terminal.
        clearMessageText();
        showLeakChain(response, 0);
        return;
      }

      if (response.type === "image") {
        clearMessageText();
        var img = document.createElement("img");
        img.className = "message-moment__response-image";
        img.src = response.value;
        img.alt = "";
        actionEl.appendChild(img);
        setTimeout(finishMoment, 3500);
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
      responseText.textContent = response.value;
      actionEl.appendChild(responseText);

      if (isFinalAttempt) {
        setTimeout(finishMoment, 3500);
      } else {
        setTimeout(function () {
          actionEl.innerHTML = ""; // instant, no fade
          showAttemptButton(index + 1);
        }, 700);
      }
    }

    typeText(textEl, data.message, 14, function () {
      showAttemptButton(0);
    });
  }

  /* ------------------------------------------------------------------
     Message moment queue — runs a list of message-moment data objects
     back to back with runMessageMoment, in order, advancing to the next
     entry each time one completes. Reusable for stage 3's remaining rows.
     ------------------------------------------------------------------ */
  function runMessageMomentQueue(containerEl, queue, onQueueComplete) {
    var index = 0;

    function playNext() {
      if (index >= queue.length) {
        onQueueComplete();
        return;
      }
      var data = queue[index];
      index += 1;
      runMessageMoment(containerEl, data, playNext);
    }

    playNext();
  }

  /* ------------------------------------------------------------------
     "Name them" moment — stage 3's closing moment (s3_mom_12). Not a
     message-moment attempt ladder: no spinner, and its cta chain is
     intro -> search -> (persistent image + caption) -> more/more/.../
     more -> finalCta -> full-black beat -> onComplete. The image and
     caption, once shown, stay put for the rest of the sequence; only
     the reaction text and button beneath them change.
     ------------------------------------------------------------------ */
  function runNameThemMoment(containerEl, data, onComplete) {
    if (!containerEl) return;
    containerEl.innerHTML = "";

    var textEl = document.createElement("p");
    textEl.className = "frame__body";
    containerEl.appendChild(textEl);

    var actionEl = document.createElement("div");
    actionEl.className = "message-moment__action";
    containerEl.appendChild(actionEl);

    var imageWrapEl = null;

    function showButton(label, onClick) {
      actionEl.innerHTML = ""; // instant, no fade
      var button = document.createElement("button");
      button.type = "button";
      button.className = "button message-moment__button";
      button.textContent = label;
      bindTapAndClick(button, onClick);
      actionEl.appendChild(button);
      presentCtaButton(button);
    }

    function showReaction(reactionIndex) {
      actionEl.innerHTML = ""; // instant, no fade — button gone while this reaction types in

      var reactionText = document.createElement("p");
      reactionText.className = "frame__body message-moment__response-text name-them-moment__reaction";

      var existingReaction = containerEl.querySelector(".name-them-moment__reaction");
      if (existingReaction) existingReaction.remove(); // instant, no fade — image/caption untouched
      imageWrapEl.insertAdjacentElement("afterend", reactionText);

      var isLastReaction = reactionIndex === data.reactions.length - 1;
      typeText(reactionText, data.reactions[reactionIndex], 14, function () {
        if (isLastReaction) {
          showButton(data.finalCta, finish);
        } else {
          showButton(data.reactionCta, function () {
            showReaction(reactionIndex + 1);
          });
        }
      });
    }

    function showImageAndReactions() {
      textEl.remove(); // leak rule: text and leak never coexist, instant

      imageWrapEl = document.createElement("div");
      imageWrapEl.className = "name-them-moment__image-wrap";

      var captionEl = document.createElement("p");
      captionEl.className = "frame__body";
      captionEl.textContent = data.image.caption;
      imageWrapEl.appendChild(captionEl);

      var imgEl = document.createElement("img");
      imgEl.className = "message-moment__response-image";
      imgEl.src = data.image.src;
      imgEl.alt = "";
      imageWrapEl.appendChild(imgEl);

      containerEl.insertBefore(imageWrapEl, actionEl);

      showButton(data.reactionCta, function () {
        showReaction(0);
      });
    }

    function finish() {
      containerEl.innerHTML = ""; // instant, no fade — image, caption, text, button all gone
      coverViewportInBlack(1000, onComplete);
    }

    typeText(textEl, data.intro.text, 14, function () {
      showButton(data.intro.cta, showImageAndReactions);
    });
  }

  /* ------------------------------------------------------------------
     Stage 3 — message moments: button-driven attempt ladders, ending
     with the "name them" moment (s3_mom_12). Runs the queue in order,
     then the closing moment, then goToNextStage() (stub — stage 4
     isn't built yet).
     ------------------------------------------------------------------ */
  var MOM_MESSAGE_DATA = {
    message: "Mom???",
    attempts: [
      { cta: "Connect", loadSpins: 4, response: { type: "text", value: "No response" } },
      { cta: "Try again", loadSpins: 3, response: { type: "text", value: "No response" } },
      { cta: "Try again", loadSpins: 2, response: { type: "text", value: "No response" } },
      { cta: "Please try again", loadSpins: 1, response: { type: "image", value: "assets/images/s3_leak_01_img.png" } }
    ]
  };

  var WHAT_IS_HAPPENING_MESSAGE_DATA = {
    message: "What is happening there?",
    attempts: [
      { cta: "send", loadSpins: 4, response: { type: "text", value: "No connection" } },
      { cta: "Try again", loadSpins: 3, response: { type: "text", value: "No connection" } },
      { cta: "Try again", loadSpins: 2, response: { type: "image", value: "assets/images/s3_leak_02_img.png" } }
    ]
  };

  var ARE_YOU_SAFE_MESSAGE_DATA = {
    message: "Are you safe?",
    attempts: [
      { cta: "send", loadSpins: 4, response: { type: "text", value: "No connection" } },
      { cta: "Try again", loadSpins: 3, response: { type: "text", value: "No connection" } },
      { cta: "Try again", loadSpins: 2, response: { type: "text", value: "No connection" } },
      { cta: "Please try again", loadSpins: 1, response: { type: "image", value: "assets/images/s3_leak_03_img.png" } }
    ]
  };

  var AIDA_MESSAGE_DATA = {
    message: "Aidaaaaaaaaaaaaaaaaa????????????????",
    attempts: [
      { cta: "Connect", loadSpins: 4, response: { type: "text", value: "No connection" } },
      {
        cta: "Try again",
        loadSpins: 3,
        response: {
          type: "audio",
          value: "assets/audio/s3_leak_04_snd.mp3",
          subtitle: "Sepehr, Sepehr buddy, where are you my son?"
        }
      }
    ]
  };

  var ALI_MESSAGE_DATA = {
    message: "Aliii?????",
    attempts: [
      { cta: "Connect", loadSpins: 2, response: { type: "image", value: "assets/images/s3_leak_05_img.png" } }
    ]
  };

  var PAPA_MESSAGE_DATA = {
    message: "Papa?",
    attempts: [
      {
        cta: "Connect",
        loadSpins: 1,
        response: [
          { type: "text", value: "Don't weep for my death. Dance!", displayMs: 3000 },
          { type: "video", value: "assets/video/s3_leak_07_vid.mp4" }
        ]
      }
    ]
  };

  var JUST_LET_ME_KNOW_MESSAGE_DATA = {
    message: "Just let me know you are alive!! I'm begging you …",
    attempts: [
      { cta: "send", loadSpins: 2, response: { type: "text", value: "No connection" } },
      { cta: "Try again", loadSpins: 3, response: { type: "text", value: "#11780" } }
    ]
  };

  var STAGE_3_MESSAGE_MOMENTS = [
    MOM_MESSAGE_DATA,
    WHAT_IS_HAPPENING_MESSAGE_DATA,
    ARE_YOU_SAFE_MESSAGE_DATA,
    AIDA_MESSAGE_DATA,
    ALI_MESSAGE_DATA,
    PAPA_MESSAGE_DATA,
    JUST_LET_ME_KNOW_MESSAGE_DATA
  ];

  var NAME_THEM_MOMENT_DATA = {
    intro: { text: "What is #11780?", cta: "search" },
    image: { src: "assets/images/s3_leak_08_img.png", caption: "Body #11780: Unidentified" },
    reactions: [
      "Had any number ever made them sad? Yes, 11780.",
      "They wrote 'anonymous, 11780', but …",
      "all of us read it as: my heart, my dear brother, my child, my hero …",
      "Surely everyone had a name…",
      "Let me be the one who knows your name!"
    ],
    reactionCta: "more",
    finalCta: "Call them by their name"
  };

  function initStage3() {
    var momentMountEl = document.getElementById("stage-3-moment-mount");
    runMessageMomentQueue(momentMountEl, STAGE_3_MESSAGE_MOMENTS, function () {
      runNameThemMoment(momentMountEl, NAME_THEM_MOMENT_DATA, goToNextStage);
    });
  }

  registerStageEnter(3, initStage3);

  function init() {
    var continueBtn = document.getElementById("stage-1-continue-btn");
    if (continueBtn) {
      bindTapAndClick(continueBtn, exitStage1);
      presentCtaButton(continueBtn);
    }
  }

  document.addEventListener("DOMContentLoaded", init);

  // Exposed for future stages / debugging.
  window.goToStage = goToStage;
  window.goToNextStage = goToNextStage;
})();
