/* ==========================================================================
   Sculpting the Silence — Stage controller
   Simple stage-switching pattern: each stage is a DOM section with
   id="stage-N" and class "stage". goToStage() toggles the "is-active"
   class. Add future stages by extending TOTAL_STAGES and giving each
   its own section in index.html.
   ========================================================================== */

(function () {
  "use strict";

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

    // Every stage-3 leak image (standalone or within a chain): a slow,
    // gentle zoom-in over the image's full display duration, so it's
    // subtly still growing right up until it's cleared from the screen.
    function renderZoomingLeakImage(mountEl, src, durationMs, onDone) {
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

      setTimeout(onDone, durationMs);
    }

    // Plays the exit half of s3_mom_10's one-off transition: the given
    // element slides up and fades out over ~500ms, then is removed.
    function slideOutThenRemove(el, onDone) {
      el.classList.add("message-moment__response-text--exit");
      setTimeout(function () {
        el.remove();
        onDone();
      }, 500);
    }

    // Plays the enter half: video (and optional caption) mount in a
    // pre-transition "below and faded out" state, then a forced reflow +
    // rAF removes that state so the transition to normal plays.
    function playLeakVideoWithSlideFadeIn(mountEl, item, onEnded) {
      var wrapperEl = document.createElement("div");
      wrapperEl.className = "message-moment__video-response";
      mountEl.appendChild(wrapperEl);

      var video = document.createElement("video");
      video.className = "message-moment__response-video message-moment__response-video--enter";
      video.src = item.value;
      video.autoplay = true;
      video.playsInline = true;
      video.preload = "none";
      wrapperEl.appendChild(video);

      var captionEl = null;
      if (item.caption) {
        captionEl = document.createElement("p");
        captionEl.className = "frame__body message-moment__response-video-caption message-moment__response-video-caption--enter";
        captionEl.textContent = item.caption;
        wrapperEl.appendChild(captionEl);
      }

      video.getBoundingClientRect(); // force reflow before enabling the transition
      requestAnimationFrame(function () {
        video.classList.remove("message-moment__response-video--enter");
        if (captionEl) captionEl.classList.remove("message-moment__response-video-caption--enter");
      });

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
    // has already been cleared by the caller. chainTransition is an
    // opt-in per-attempt flag: "slide-fade" plays s3_mom_10's one-off
    // typed-text-slides-out / video-slides-in transition; everywhere else
    // it's undefined and every chain step stays instant, as before.
    function showLeakChain(responses, chainIndex, chainTransition) {
      actionEl.innerHTML = ""; // instant, no fade
      var item = responses[chainIndex];
      var isLastInChain = chainIndex === responses.length - 1;

      function advanceChain() {
        if (isLastInChain) {
          finishMoment();
        } else {
          showLeakChain(responses, chainIndex + 1, chainTransition);
        }
      }

      if (item.type === "video") {
        if (chainTransition === "slide-fade") {
          playLeakVideoWithSlideFadeIn(actionEl, item, advanceChain);
        } else {
          playLeakVideo(actionEl, item.value, advanceChain);
        }
        return;
      }

      if (item.type === "image") {
        renderZoomingLeakImage(actionEl, item.value, item.displayMs || 3500, advanceChain);
        return;
      }

      // type === "text"
      if (chainTransition === "slide-fade") {
        var typedTextEl = document.createElement("p");
        typedTextEl.className = "frame__body message-moment__response-text";
        actionEl.appendChild(typedTextEl);
        typeText(typedTextEl, item.value, 14, function () {
          setTimeout(function () {
            slideOutThenRemove(typedTextEl, advanceChain);
          }, 600);
        });
        return;
      }

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
      var attempt = data.attempts[index];
      var response = attempt.response;
      var isFinalAttempt = index === data.attempts.length - 1;

      if (Array.isArray(response)) {
        // A leak chain is always terminal.
        clearMessageText();
        showLeakChain(response, 0, attempt.chainTransition);
        return;
      }

      if (response.type === "image") {
        clearMessageText();
        renderZoomingLeakImage(actionEl, response.value, 3500, finishMoment);
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

  /* ------------------------------------------------------------------
     Message moment queue — runs a list of message-moment data objects
     back to back with runMessageMoment, in order, advancing to the next
     entry each time one completes. Reusable for stage 3's remaining rows.
     ------------------------------------------------------------------ */
  function runMessageMomentQueue(containerEl, queue, onQueueComplete, onMomentStart) {
    var index = 0;

    function playNext() {
      if (index >= queue.length) {
        onQueueComplete();
        return;
      }
      var data = queue[index];
      var startingIndex = index;
      index += 1;
      if (onMomentStart) onMomentStart(startingIndex);
      runMessageMoment(containerEl, data, playNext);
    }

    playNext();
  }

  /* ------------------------------------------------------------------
     "Name them" moment — stage 3's closing moment (s3_mom_12). Not a
     message-moment attempt ladder: no spinner, and its cta chain is
     intro -> search -> image + typed caption -> more (shrinks the image
     into its permanent spot, then types reactions[0]) -> more/more/...
     -> finalCta -> full-black beat -> onComplete. The caption and every
     reaction after it are typed into the same "zone" beneath the image;
     the image itself persists once shown, only shrinking once on the
     first "more" click.
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

    // Creates (or instantly swaps in) the paragraph used for both the
    // caption and every reaction after it — one shared "zone" beneath
    // the image, per the spec's "same zone reactions will later use".
    function freshZoneTextEl() {
      var existing = containerEl.querySelector(".name-them-moment__zone-text");
      if (existing) existing.remove(); // instant, no fade — image untouched
      var zoneTextEl = document.createElement("p");
      zoneTextEl.className = "frame__body message-moment__response-text name-them-moment__zone-text";
      imageWrapEl.insertAdjacentElement("afterend", zoneTextEl);
      return zoneTextEl;
    }

    function showReaction(reactionIndex) {
      actionEl.innerHTML = ""; // instant, no fade — button gone while this reaction types in
      var zoneTextEl = freshZoneTextEl();

      var isLastReaction = reactionIndex === data.reactions.length - 1;
      typeText(zoneTextEl, data.reactions[reactionIndex], 14, function () {
        if (isLastReaction) {
          showButton(data.finalCta, finish);
        } else {
          showButton(data.reactionCta, function () {
            showReaction(reactionIndex + 1);
          });
        }
      });
    }

    // First "more" click only: shrinks the image into its permanent
    // spot/size, then starts the reaction chain.
    function shrinkImageThenShowFirstReaction() {
      imageWrapEl.classList.add("name-them-moment__image-wrap--shrunk");
      setTimeout(function () {
        showReaction(0);
      }, 500); // matches the shrink transition duration
    }

    function showImage() {
      textEl.remove(); // leak rule: text and leak never coexist, instant

      imageWrapEl = document.createElement("div");
      imageWrapEl.className = "name-them-moment__image-wrap";

      var imgEl = document.createElement("img");
      imgEl.className = "message-moment__response-image";
      imgEl.src = data.image.src;
      imgEl.alt = "";
      imageWrapEl.appendChild(imgEl);

      containerEl.insertBefore(imageWrapEl, actionEl);

      var zoneTextEl = freshZoneTextEl();
      typeText(zoneTextEl, data.captionBelow, 14, function () {
        showButton(data.reactionCta, shrinkImageThenShowFirstReaction);
      });
    }

    function finish() {
      containerEl.innerHTML = ""; // instant, no fade — image, text, button all gone
      coverViewportInBlack(1000, onComplete);
    }

    typeText(textEl, data.intro.text, 14, function () {
      showButton(data.intro.cta, showImage);
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
    message: "Aida??????",
    attempts: [
      {
        cta: "Connect",
        loadSpins: 2,
        response: { type: "text", value: "No connection" },
        nextMessage: { text: "Aidaaaaa???????????" }
      },
      {
        cta: "Try again",
        loadSpins: 3,
        response: { type: "text", value: "No connection" },
        nextMessage: { text: "Aidaaaaa???????????", fontSizeDeltaPx: 2 }
      },
      {
        cta: "Pleaaaaaaaase",
        loadSpins: 4,
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
      {
        cta: "Connect",
        loadSpins: 3,
        response: { type: "text", value: "No conn…" },
        nextMessage: { text: "Ali jan?", fontSizeDeltaPx: 2 }
      },
      { cta: "Connect", loadSpins: 4, response: { type: "image", value: "assets/images/s3_leak_05_img.png" } }
    ]
  };

  var PAPA_MESSAGE_DATA = {
    message: "Papa?",
    attempts: [
      {
        cta: "Connect",
        loadSpins: 1,
        // chainTransition: "slide-fade" is the one-off exception noted in
        // showLeakChain — typed text slides up/out, then the video (with
        // its caption) slides/fades in. Every other chain stays instant.
        response: [
          { type: "text", value: "Don't weep for my death. Dance!" },
          {
            type: "video",
            value: "assets/video/s3_leak_07_vid.mp4",
            caption: "Moments of Dance at the Funerals"
          }
        ],
        chainTransition: "slide-fade"
      }
    ]
  };

  var JUST_LET_ME_KNOW_MESSAGE_DATA = {
    message: "Just let me know you are alive!!",
    attempts: [
      {
        cta: "send",
        loadSpins: 2,
        response: { type: "text", value: "No connection" },
        nextMessage: { text: "I'm begging you …" }
      },
      { cta: "Try again", loadSpins: 4, response: { type: "text", value: "#11780" } }
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
    intro: { text: "#11780?????", cta: "search" },
    image: { src: "assets/images/s3_leak_08_img.png" },
    captionBelow: "Body #11780: Unidentified",
    reactions: [
      "Had any number ever made them sad?",
      "Yes, 11780.",
      "They wrote 'anonymous, 11780', but …",
      "all of us read it as: my heart, my dear brother, my child, my hero …",
      "Surely everyone had a name…",
      "Let me be the one who knows your name!"
    ],
    reactionCta: "more",
    finalCta: "Call them by their name"
  };

  // Background gunshot loop: starts at s3_mom_05 ("Mom???", the very
  // start of stage 3), keeps looping underneath every moment in between,
  // and is fully stopped/unloaded right as s3_mom_10 ("Papa?") begins.
  var STAGE_3_GUNSHOT_START_INDEX = STAGE_3_MESSAGE_MOMENTS.indexOf(MOM_MESSAGE_DATA);
  var STAGE_3_GUNSHOT_STOP_INDEX = STAGE_3_MESSAGE_MOMENTS.indexOf(PAPA_MESSAGE_DATA);
  var STAGE_3_GUNSHOT_VOLUME = 0.35;

  // Longer underscore loop: also starts at s3_mom_05, but — unlike the
  // gunshot track — keeps looping underneath all of stage 3, all of stage
  // 4, and into stage 5's merged 11780+form screen. It's only stopped once
  // the form is actually submitted (see initStage5).
  var STAGE_3_UNDERSCORE_START_INDEX = STAGE_3_GUNSHOT_START_INDEX;
  var STAGE_3_UNDERSCORE_VOLUME = 0.25;

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

  function initStage3() {
    var momentMountEl = document.getElementById("stage-3-moment-mount");
    var gunshotAudioEl = document.getElementById("stage-3-gunshot-audio");
    var underscoreAudioEl = document.getElementById("stage-3-underscore-audio");

    runMessageMomentQueue(
      momentMountEl,
      STAGE_3_MESSAGE_MOMENTS,
      function () {
        runNameThemMoment(momentMountEl, NAME_THEM_MOMENT_DATA, goToNextStage);
      },
      function (momentIndex) {
        if (momentIndex === STAGE_3_UNDERSCORE_START_INDEX) {
          startLoopingAudio(underscoreAudioEl, STAGE_3_UNDERSCORE_VOLUME);
        }

        if (!gunshotAudioEl) return;

        if (momentIndex === STAGE_3_GUNSHOT_START_INDEX) {
          startLoopingAudio(gunshotAudioEl, STAGE_3_GUNSHOT_VOLUME);
        } else if (momentIndex === STAGE_3_GUNSHOT_STOP_INDEX) {
          gunshotAudioEl.pause();
          gunshotAudioEl.currentTime = 0;
        }
      }
    );
  }

  registerStageEnter(3, initStage3);

  /* ------------------------------------------------------------------
     Stage 4 — name moments: button-driven, one per victim. Types the
     name (title-style) then a subtext line, plays that moment's audio
     fire-and-forget (advancement here is button-driven, not tied to the
     audio ending), then shows the cta. Ends with one auto-advancing
     moment (no button, no audio) after all named moments are done.
     ------------------------------------------------------------------ */
  // Stage-4-only override: a bit faster than the app's global typing
  // rate (14 chars/sec, used by stages 2-3). Doesn't affect them.
  var STAGE_4_CHARS_PER_SECOND = 20;

  var NAME_MOMENTS_DATA = [
    { name: "Reza Moradi", subtext: "Perhaps he had braided a lover's hair.", audio: "assets/audio/s4_name_01_snd.mp3" },
    { name: "Sogand Mansoori", age: "14 years old", subtext: "Perhaps she had once danced at a friend's party.", audio: "assets/audio/s4_name_02_snd.mp3" },
    { name: "Sajad Vala Manesh", subtext: "Perhaps they were waiting for a pair of shoes, a gift their emigrated sister would bring.", audio: "assets/audio/s4_name_03_snd.mp3" },
    { name: "Ayda Heidari", subtext: "Perhaps she had said it's not tolerable any more, and something must be done.", audio: "assets/audio/s4_name_04_snd.mp3" },
    { name: "Frahad Farsi", subtext: "But perhaps, struggling with their fears, he left a note: \"if I do not come back, do not weep at my grave — dance.\"", audio: "assets/audio/s4_name_05_snd.mp3" },
    { name: "Latif Karimi", subtext: "Perhaps he wanted to call his emigrated sister.", audio: "assets/audio/s4_name_06_snd.mp3" },
    { name: "Sepehr Shokri", subtext: "Perhaps she wanted to say: \"We are many, and this time we will make a change\".", audio: "assets/audio/s4_name_07_snd.mp3" },
    { name: "Mahmoud Rastegar", subtext: "Perhaps he wanted to say: \"I have missed you so much.\" But many tries, and no connection.", audio: "assets/audio/s4_name_08_snd.mp3" },
    { name: "Raha Azadi", subtext: "Perhaps, running away, he thought that if he had better shoes, he could have made it out alive.", audio: "assets/audio/s4_name_09_snd.mp3" }
  ];

  function runNameMoment(containerEl, data, onComplete) {
    containerEl.innerHTML = "";

    // Fire-and-forget: this moment advances on button click, not on the
    // audio ending, so it's just started and never awaited or gated on.
    var audioEl = new Audio(data.audio);
    var playPromise = audioEl.play();
    if (playPromise && playPromise.catch) {
      playPromise.catch(function () {});
    }

    var nameEl = document.createElement("p");
    nameEl.className = "frame__title";
    containerEl.appendChild(nameEl);

    var ageEl = null;
    if (data.age) {
      ageEl = document.createElement("p");
      ageEl.className = "name-moment__age";
      containerEl.appendChild(ageEl);
    }

    var subtextEl = document.createElement("p");
    subtextEl.className = "frame__body";
    containerEl.appendChild(subtextEl);

    var actionEl = document.createElement("div");
    actionEl.className = "message-moment__action";
    containerEl.appendChild(actionEl);

    function showButton() {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "button message-moment__button";
      button.textContent = "Call them by their name";
      bindTapAndClick(button, function () {
        containerEl.innerHTML = ""; // instant, no fade
        onComplete();
      });
      actionEl.appendChild(button);
      presentCtaButton(button);
    }

    typeText(nameEl, data.name, STAGE_4_CHARS_PER_SECOND, function () {
      if (ageEl) {
        typeText(ageEl, data.age, STAGE_4_CHARS_PER_SECOND, function () {
          typeText(subtextEl, data.subtext, STAGE_4_CHARS_PER_SECOND, showButton);
        });
      } else {
        typeText(subtextEl, data.subtext, STAGE_4_CHARS_PER_SECOND, showButton);
      }
    });
  }

  function runNameMomentQueue(containerEl, queue, onQueueComplete) {
    var index = 0;

    function playNext() {
      if (index >= queue.length) {
        onQueueComplete();
        return;
      }
      var data = queue[index];
      index += 1;
      runNameMoment(containerEl, data, playNext);
    }

    playNext();
  }

  function initStage4() {
    var momentMountEl = document.getElementById("stage-4-moment-mount");
    // s4_mom_22 ("11780" reveal) now opens stage 5's merged screen (see
    // runFinalNameAndFormMoment) instead of running as its own moment here,
    // so all 9 named moments advance straight into stage 5.
    runNameMomentQueue(momentMountEl, NAME_MOMENTS_DATA, goToNextStage);
  }

  registerStageEnter(4, initStage4);

  /* ------------------------------------------------------------------
     Stage 5 — s4_mom_22 + s5_mom_23 merged into one continuous screen
     (runFinalNameAndFormMoment), then s5_mom_24 (collective board) the
     instant the form is submitted. No auto-advance, no loop after the
     board — it's the last moment in the current build.
     ------------------------------------------------------------------ */

  // Now shown as s5_mom_24's small footer instead of its own screen —
  // placeholder text, swap in the real closing statement here when ready.
  var CLOSING_STATEMENT_TEXT = "Thank you for calling them out of silence.";

  // localStorage-backed entry store shared by s5_mom_23 (writes) and
  // s5_mom_24 (reads). Each entry is { name, story }.
  var ENTRIES_STORAGE_KEY = "sculptingTheSilenceEntries";

  function loadEntries() {
    try {
      var raw = window.localStorage.getItem(ENTRIES_STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function addEntry(name, story) {
    var entries = loadEntries();
    entries.push({ name: name, story: story });
    try {
      window.localStorage.setItem(ENTRIES_STORAGE_KEY, JSON.stringify(entries));
    } catch (err) {
      // Storage unavailable/full — fail silently, nothing else to do here.
    }
  }

  // Slides a freshly-appended element in from 16px below/faded-out to its
  // resting place — same forced-reflow-then-rAF pattern as the stage-3
  // leak video enter transition. enterClassName is the modifier that holds
  // the pre-transition state; the base class already carries the
  // transition + resting state, so removing it plays the slide-in.
  function slideElIntoView(containerEl, el, enterClassName, onDone) {
    el.classList.add(enterClassName);
    containerEl.appendChild(el);
    el.getBoundingClientRect(); // force reflow before enabling the transition
    requestAnimationFrame(function () {
      el.classList.remove(enterClassName);
    });
    setTimeout(onDone, 500);
  }

  // Merged s4_mom_22 ("11780" reveal) + s5_mom_23 (closing form) — one
  // continuous frame instead of a hard cut. The title+subtext stay on
  // screen once typed, and the form's two fields + submit button slide in
  // below them one after another rather than appearing as a fresh screen.
  function runFinalNameAndFormMoment(containerEl, onSubmit) {
    containerEl.innerHTML = "";

    var titleEl = document.createElement("p");
    titleEl.className = "frame__title";
    containerEl.appendChild(titleEl);

    var subtextEl = document.createElement("p");
    subtextEl.className = "frame__body";
    containerEl.appendChild(subtextEl);

    function showForm() {
      var nameFieldWrap = document.createElement("div");
      nameFieldWrap.className = "stage-5__field";
      var nameLabel = document.createElement("label");
      nameLabel.className = "stage-5__field-label";
      nameLabel.textContent = "How do you call them?";
      nameLabel.setAttribute("for", "stage-5-name-input");
      var nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.id = "stage-5-name-input";
      nameInput.className = "stage-5__field-input";
      nameInput.placeholder = "11780";
      nameFieldWrap.appendChild(nameLabel);
      nameFieldWrap.appendChild(nameInput);

      var recallFieldWrap = document.createElement("div");
      recallFieldWrap.className = "stage-5__field";
      var recallLabel = document.createElement("label");
      recallLabel.className = "stage-5__field-label";
      recallLabel.textContent = "How do you recall them?";
      recallLabel.setAttribute("for", "stage-5-recall-input");
      var recallInput = document.createElement("input");
      recallInput.type = "text";
      recallInput.id = "stage-5-recall-input";
      recallInput.className = "stage-5__field-input";
      recallInput.placeholder = "Perhaps they …";
      recallInput.maxLength = 80;
      recallFieldWrap.appendChild(recallLabel);
      recallFieldWrap.appendChild(recallInput);

      var actionEl = document.createElement("div");
      actionEl.className = "message-moment__action stage-5__submit-action";

      var button = document.createElement("button");
      button.type = "button";
      button.className = "button message-moment__button";
      button.textContent = "Call them out of silence";
      bindTapAndClick(button, function () {
        var nameValue = nameInput.value.trim();
        var recallValue = recallInput.value.trim();
        var participated = nameValue !== "" || recallValue !== "";

        if (participated) {
          // TODO: drive the field/dots "participated" visual once that
          // layer exists.
          addEntry(nameValue, recallValue);
        } else {
          // TODO: drive the field/dots "did not participate" visual once
          // that layer exists.
        }

        onSubmit();
      });
      actionEl.appendChild(button);

      slideElIntoView(containerEl, nameFieldWrap, "stage-5__field--enter", function () {
        slideElIntoView(containerEl, recallFieldWrap, "stage-5__field--enter", function () {
          slideElIntoView(containerEl, actionEl, "stage-5__submit-action--enter", function () {
            presentCtaButton(button);
          });
        });
      });
    }

    typeText(titleEl, "11780", STAGE_4_CHARS_PER_SECOND, function () {
      typeText(
        subtextEl,
        "Their body, perhaps, was never identified by their family. But there might still be a human to call them by a name, to recall them by a memory…",
        STAGE_4_CHARS_PER_SECOND,
        function () {
          setTimeout(showForm, 400);
        }
      );
    });
  }

  var COLLECTIVE_BOARD_NAME_SATURATION = 70; // %
  var COLLECTIVE_BOARD_NAME_LIGHTNESS = 65; // % — stays readable on black
  var COLLECTIVE_BOARD_EDGE_MARGIN_PERCENT = 6; // keep names off the very edge

  // A-minor pentatonic (A C D E G) across 3 octaves — every combination of
  // notes in this set sounds consonant, so a random pick per name never
  // clashes with another.
  var COLLECTIVE_BOARD_NOTE_FREQUENCIES = [
    220.00, 261.63, 293.66, 329.63, 392.00, // A3 C4 D4 E4 G4
    440.00, 523.25, 587.33, 659.25, 783.99, // A4 C5 D5 E5 G5
    880.00, 1046.50, 1174.66, 1318.51, 1567.98 // A5 C6 D6 E6 G6
  ];

  // Deterministic string hash (no crypto needed — just needs to spread
  // inputs evenly across the scale), so the same entry always lands on the
  // same note within a render instead of re-randomizing on every hover.
  function hashStringToIndex(str, modulo) {
    var hash = 0;
    for (var i = 0; i < str.length; i += 1) {
      hash = (hash * 31 + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % modulo;
  }

  // Lazily created — browsers require it to be spun up from/near a user
  // gesture, and the board only exists after the stage-5 form submit click.
  var collectiveBoardAudioCtx = null;

  // Fundamental (loudest) plus two quiet upper partials (~2x, ~3x) — a
  // rough handpan/hang-drum approximation: those instruments ring with a
  // metallic, bell-like color from overtones layered above the struck
  // note, rather than a single flat pitch.
  var COLLECTIVE_BOARD_NOTE_PARTIALS = [
    { multiplier: 1, gain: 1.0 },
    { multiplier: 2, gain: 0.28 },
    { multiplier: 3, gain: 0.12 }
  ];

  // Soft-attack, long-decay tone for a name's note: a master gain node
  // carries the envelope (fast fade-in, slow exponential fade-out so it
  // rings out like a struck handpan instead of cutting off sharply), fed
  // by one oscillator per partial above, each pre-scaled to its own level.
  function playCollectiveBoardNote(frequency) {
    if (!frequency) return;

    var AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!collectiveBoardAudioCtx) {
      collectiveBoardAudioCtx = new AudioContextClass();
    }
    var ctx = collectiveBoardAudioCtx;
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    var now = ctx.currentTime;
    var attack = 0.02;
    var decay = 2.0;
    var stopAt = now + attack + decay;
    var peakGain = 0.18;

    var masterGain = ctx.createGain();
    // exponentialRampToValueAtTime can't target 0, so ramp to a value low
    // enough to read as silent, then snap the rest of the way there.
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.linearRampToValueAtTime(peakGain, now + attack);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
    masterGain.gain.setValueAtTime(0, stopAt);
    masterGain.connect(ctx.destination);

    COLLECTIVE_BOARD_NOTE_PARTIALS.forEach(function (partial) {
      var oscillator = ctx.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency * partial.multiplier;

      var partialGain = ctx.createGain();
      partialGain.gain.value = partial.gain;

      oscillator.connect(partialGain);
      partialGain.connect(masterGain);
      oscillator.start(now);
      oscillator.stop(stopAt);
    });
  }

  // Downloads the current localStorage entries array as entries.json —
  // a manual backup mechanism, not part of the experience itself.
  function exportEntriesAsJSON() {
    var json = JSON.stringify(loadEntries(), null, 2);
    var blob = new Blob([json], { type: "application/json" });
    var url = URL.createObjectURL(blob);

    var link = document.createElement("a");
    link.href = url;
    link.download = "entries.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Keeps the tooltip on-screen near its name, regardless of where that
  // name landed in the random scatter.
  function positionTooltipNear(tooltipEl, nameEl) {
    var margin = 8;
    var nameRect = nameEl.getBoundingClientRect();

    tooltipEl.style.left = nameRect.left + "px";
    tooltipEl.style.top = nameRect.bottom + margin + "px";

    var tooltipRect = tooltipEl.getBoundingClientRect();
    var left = nameRect.left;
    var top = nameRect.bottom + margin;

    if (left + tooltipRect.width > window.innerWidth - margin) {
      left = window.innerWidth - margin - tooltipRect.width;
    }
    if (left < margin) left = margin;

    if (top + tooltipRect.height > window.innerHeight - margin) {
      top = nameRect.top - margin - tooltipRect.height;
    }
    if (top < margin) top = margin;

    tooltipEl.style.left = left + "px";
    tooltipEl.style.top = top + "px";
  }

  // s5_mom_24 — full-viewport collective board: every stored entry's
  // name scattered at a random position/color; hover or tap reveals its
  // story near it. Zero entries just leaves the dark background empty.
  function renderCollectiveBoard(boardEl) {
    var namesMountEl = document.getElementById("stage-5-board-names");
    var tooltipEl = document.getElementById("stage-5-board-tooltip");
    var exportBtn = document.getElementById("stage-5-board-export-btn");
    var footerEl = document.getElementById("stage-5-board-footer");
    if (!namesMountEl || !tooltipEl) return;

    if (footerEl) {
      footerEl.textContent = "";
      typeText(footerEl, CLOSING_STATEMENT_TEXT, 14);
    }

    namesMountEl.innerHTML = "";
    var activeNameEl = null;

    function hideTooltip() {
      tooltipEl.hidden = true;
      tooltipEl.textContent = "";
      if (activeNameEl) {
        activeNameEl.classList.remove("collective-board__name--active");
        activeNameEl = null;
      }
    }

    function showTooltip(nameEl, story, noteFrequency) {
      // Only actually a new activation (and thus a note) if this name
      // wasn't already the active one — keeps a redundant click on an
      // already-hovered name (mouseenter already fired) from double-playing.
      var isNewActivation = activeNameEl !== nameEl;

      if (activeNameEl) {
        activeNameEl.classList.remove("collective-board__name--active");
      }
      activeNameEl = nameEl;
      nameEl.classList.add("collective-board__name--active");
      tooltipEl.textContent = story || "";
      tooltipEl.hidden = false;
      positionTooltipNear(tooltipEl, nameEl);

      if (isNewActivation) {
        playCollectiveBoardNote(noteFrequency);
      }
    }

    loadEntries().forEach(function (entry, index) {
      var nameEl = document.createElement("span");
      nameEl.className = "collective-board__name";
      nameEl.textContent = entry.name;

      var hue = Math.floor(Math.random() * 360);
      nameEl.style.color = "hsl(" + hue + ", " + COLLECTIVE_BOARD_NAME_SATURATION + "%, " + COLLECTIVE_BOARD_NAME_LIGHTNESS + "%)";

      var x = COLLECTIVE_BOARD_EDGE_MARGIN_PERCENT + Math.random() * (100 - COLLECTIVE_BOARD_EDGE_MARGIN_PERCENT * 2);
      var y = COLLECTIVE_BOARD_EDGE_MARGIN_PERCENT + Math.random() * (100 - COLLECTIVE_BOARD_EDGE_MARGIN_PERCENT * 2);
      nameEl.style.left = x + "%";
      nameEl.style.top = y + "%";

      // Assigned once per entry (index keeps it stable even for two
      // entries with the same/blank name) and reused on every hover/tap —
      // never re-randomized.
      var noteIndex = hashStringToIndex(index + "|" + entry.name, COLLECTIVE_BOARD_NOTE_FREQUENCIES.length);
      var noteFrequency = COLLECTIVE_BOARD_NOTE_FREQUENCIES[noteIndex];

      // Desktop hover.
      nameEl.addEventListener("mouseenter", function () {
        showTooltip(nameEl, entry.story, noteFrequency);
      });
      nameEl.addEventListener("mouseleave", hideTooltip);

      // Touch tap (also fires for a mouse click, which is harmless —
      // mouseenter already shows it in that case). stopPropagation keeps
      // this from immediately re-triggering the document "tap elsewhere"
      // handler below.
      nameEl.addEventListener("click", function (event) {
        event.stopPropagation();
        showTooltip(nameEl, entry.story, noteFrequency);
      });

      namesMountEl.appendChild(nameEl);
    });

    document.addEventListener("click", hideTooltip);

    if (exportBtn) {
      exportBtn.addEventListener("click", function (event) {
        event.stopPropagation();
        exportEntriesAsJSON();
      });
    }
  }

  function showCollectiveBoard() {
    var frameEl = document.querySelector("#stage-5 .frame");
    if (frameEl) frameEl.style.display = "none";

    var boardEl = document.getElementById("stage-5-board");
    if (!boardEl) return;
    boardEl.hidden = false;
    renderCollectiveBoard(boardEl);
  }

  function initStage5() {
    var momentMountEl = document.getElementById("stage-5-moment-mount");
    runFinalNameAndFormMoment(momentMountEl, function onSubmit() {
      // Long background track (started at s3_mom_05) ends the instant the
      // form is submitted; s5_mom_24 (the board) has no underscore audio.
      var underscoreAudioEl = document.getElementById("stage-3-underscore-audio");
      if (underscoreAudioEl) {
        underscoreAudioEl.pause();
        underscoreAudioEl.currentTime = 0;
      }

      momentMountEl.innerHTML = ""; // instant, no fade
      showCollectiveBoard(); // straight to s5_mom_24 — no standalone thank-you screen
    });
  }

  registerStageEnter(5, initStage5);

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
