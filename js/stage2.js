/* ==========================================================================
   Sculpting the Silence — Stage 2 (automatic sequence)
   Social feeds video, connectivity blackout graphic, gunfire warning. No
   buttons, all auto-timed via the moment runner below.
   ========================================================================== */

(function () {
  "use strict";

  var STS = window.STS;

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
          STS.typeText(
            cutoffTextEl,
            "As the protests peaked, the government completely blacked out all communication channels in Iran.",
            14,
            null,
            "word"
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
          STS.typeText(gunfireTextEl, "They are shooting by shotguns ...", 14, null, "word");

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

    runMoments(momentEls, moments, STS.goToNextStage);
  }

  STS.registerStageEnter(2, initStage2);
})();
