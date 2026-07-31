/* ==========================================================================
   Sculpting the Silence — Stage 2 (automatic sequence)
   Social feeds video, connectivity blackout graphic, gunfire warning. No
   buttons, all auto-timed via the moment runner below.
   ========================================================================== */

(function () {
  "use strict";

  var STS = window.STS;

  // Feature flag for s2_mom_04 (the gunfire warning moment, moment 2.4 in
  // this file's numbering — the blackout beat at 2.3 only exists as its
  // lead-in). Set to false to skip both entirely, going straight from
  // moment 2.2 to whatever follows 2.4 (stage 3), without deleting either
  // moment's code.
  var ENABLE_S2_MOM_04 = true;

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
     Stage 2 — automatic sequence: social feeds video, connectivity
     blackout graphic, gunfire warning. No buttons, all auto-timed.
     ------------------------------------------------------------------ */
  var CUTOFF_TEXT = "As the protests peaked, the government completely blacked out all communication channels in Iran.";
  var CUTOFF_CHARS_PER_SECOND = 14;

  // Escalating hours-then-days counter (moment 2.2) — ported verbatim
  // from the approved prototypes/netblocks-chart.html, replacing the old
  // NetBlocks line chart entirely.
  var HOURS_MAX = 23;
  var HOUR_TICKS = HOURS_MAX + 1; // firings to display 1..23, then one more to detect >23 and switch

  var DAYS_MAX = 18;
  var DAY_TICKS = DAYS_MAX - 1; // firings to walk from the immediate "1" up to the final "18"

  // Share of the total duration spent in the (faster) hour sprint before
  // handing off to the (slower) day count — tune to taste.
  var HOUR_PHASE_DURATION_SHARE = 0.45;

  // A brief hold on the final "18+" state before the moment advances.
  var COUNTER_HOLD_MS = 500;

  function setCounter(numberEl, captionEl, numberText, unit) {
    numberEl.textContent = numberText;
    captionEl.textContent = unit ? unit + " of digital blackout in Iran" : "";
  }

  // Counts 0 -> HOURS_MAX (caption unit "hour") then 1 -> DAYS_MAX
  // (caption unit "day"), timed to finish at totalDurationMs from now
  // (hour phase gets HOUR_PHASE_DURATION_SHARE of it, day phase gets the
  // rest). The final value is shown as "18+" (trailing plus), not plain
  // "18". Returns a stop function so a replay can cancel an in-flight run.
  function playEscalatingCounter(numberEl, captionEl, totalDurationMs) {
    var hourStepMs = (totalDurationMs * HOUR_PHASE_DURATION_SHARE) / HOUR_TICKS;
    var dayStepMs = (totalDurationMs * (1 - HOUR_PHASE_DURATION_SHARE)) / DAY_TICKS;

    var hourTimer = null;
    var dayTimer = null;

    function stop() {
      if (hourTimer) clearInterval(hourTimer);
      if (dayTimer) clearInterval(dayTimer);
    }

    function startDaysPhase() {
      var day = 1;
      setCounter(numberEl, captionEl, String(day), "day");
      dayTimer = setInterval(function () {
        day += 1;
        if (day >= DAYS_MAX) {
          clearInterval(dayTimer);
          setCounter(numberEl, captionEl, DAYS_MAX + "+", "day");
          return;
        }
        setCounter(numberEl, captionEl, String(day), "day");
      }, dayStepMs);
    }

    var hour = 0;
    setCounter(numberEl, captionEl, String(hour), "hour");
    hourTimer = setInterval(function () {
      hour += 1;
      if (hour > HOURS_MAX) {
        clearInterval(hourTimer);
        startDaysPhase();
        return;
      }
      setCounter(numberEl, captionEl, String(hour), "hour");
    }, hourStepMs);

    return stop;
  }

  function initStage2() {
    var stageEl = document.getElementById("stage-2");
    if (!stageEl) return;

    var momentEls = stageEl.querySelectorAll(".moment");
    var videoEl = document.getElementById("stage-2-video");
    var cutoffTextEl = document.getElementById("stage-2-cutoff-text");
    var counterNumberEl = document.getElementById("stage-2-counter-number");
    var counterCaptionEl = document.getElementById("stage-2-counter-caption");
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
        // 2.2 — digital cutoff text + escalating hours-then-days counter.
        // Both start together: the counter's total duration is derived
        // from the typing duration so they land at roughly the same
        // moment (see prototypes/netblocks-chart.html).
        el: document.getElementById("stage-2-moment-cutoff"),
        run: function (advance) {
          var typingDurationMs = (CUTOFF_TEXT.length / CUTOFF_CHARS_PER_SECOND) * 1000;

          STS.typeText(cutoffTextEl, CUTOFF_TEXT, CUTOFF_CHARS_PER_SECOND);
          playEscalatingCounter(counterNumberEl, counterCaptionEl, typingDurationMs);

          setTimeout(advance, typingDurationMs + COUNTER_HOLD_MS);
        }
      }
    ];

    // 2.3 (blackout lead-in) + 2.4 (gunfire warning, s2_mom_04) — only
    // included when the flag above is on; skipping both leaves the code
    // intact but simply never queues it, going straight from 2.2 to
    // whatever runMoments' onComplete does (stage 3).
    if (ENABLE_S2_MOM_04) {
      moments.push({
        // Black-screen beat between 2.2 and 2.4: covers the entire
        // viewport (background layer + frame, via a sibling element
        // outside .frame) with solid black for exactly 1000ms.
        el: document.getElementById("stage-2-moment-blackout"),
        run: function (advance) {
          setTimeout(advance, 1000);
        }
      });

      moments.push({
        // 2.4 — gunfire warning text (s2_mom_04).
        el: document.getElementById("stage-2-moment-gunfire"),
        run: function (advance) {
          STS.typeText(gunfireTextEl, "They are shooting by shotguns ...", 14);

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
      });
    }

    runMoments(momentEls, moments, STS.goToNextStage);
  }

  STS.registerStageEnter(2, initStage2);
})();
