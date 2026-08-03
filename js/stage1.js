/* ==========================================================================
   Sculpting the Silence — Stage 1 (Content Warning)
   Already active on page load (index.html sets "is-active" on #stage-1
   directly), so there's no registerStageEnter here — just wiring the
   continue button that exits it.
   ========================================================================== */

(function () {
  "use strict";

  var STS = window.STS;

  function exitStage1(event) {
    var frameEl = document.querySelector("#stage-1 .frame");
    if (frameEl) {
      frameEl.classList.add("frame--exiting");
    }
    STS.goToNextStage();
  }

  function initStage1() {
    // Background point field: static default state only. No idle jitter,
    // no flow — dots don't move at all during stage 1.
    var fieldCanvas = document.getElementById("field-canvas");
    if (fieldCanvas && window.Field) {
      window.Field.init(fieldCanvas);
    }

    // s1_mom_01 (title + body) shows instantly — no typing animation.
    // Both are already static text in index.html, so there's nothing
    // else to wire up here besides the continue button.
    var continueBtn = document.getElementById("stage-1-continue-btn");
    if (continueBtn) {
      STS.bindTapAndClick(continueBtn, exitStage1);
      STS.presentCtaButton(continueBtn);
    }
  }

  document.addEventListener("DOMContentLoaded", initStage1);
})();
