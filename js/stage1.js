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
    var continueBtn = document.getElementById("stage-1-continue-btn");
    if (continueBtn) {
      STS.bindTapAndClick(continueBtn, exitStage1);
      STS.presentCtaButton(continueBtn);
    }
  }

  document.addEventListener("DOMContentLoaded", initStage1);
})();
