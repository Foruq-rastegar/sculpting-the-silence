/* ==========================================================================
   Sculpting the Silence — Stage 3 (message moments)
   Button-driven attempt ladders (built on STS.runMessageMoment from
   shared.js), ending with the "name them" moment (s3_mom_12). Runs the
   queue in order, then the closing moment, then goToNextStage().
   ========================================================================== */

(function () {
  "use strict";

  var STS = window.STS;

  var MOM_MESSAGE_DATA = {
    message: "Mom?",
    attempts: [
      {
        cta: "Connect",
        loadSpins: 4,
        response: { type: "text", value: "No response" },
        nextMessage: { text: "Mom??" }
      },
      {
        cta: "Try again",
        loadSpins: 3,
        response: { type: "text", value: "No response" },
        nextMessage: { text: "Give me an update please!!" }
      },
      {
        cta: "Try again",
        loadSpins: 2,
        response: { type: "text", value: "No response" },
        nextMessage: { text: "Momm??" }
      },
      { cta: "Please try again", loadSpins: 1, response: { type: "video", value: "assets/video/s3_leak_01_vid.mp4" } }
    ]
  };

  var WHAT_IS_HAPPENING_MESSAGE_DATA = {
    message: "What the hell is happening there?",
    attempts: [
      { cta: "send", loadSpins: 4, response: { type: "text", value: "No connection" } },
      {
        cta: "Try again",
        loadSpins: 3,
        response: { type: "text", value: "No connection" },
        nextMessage: { text: "Aida?" }
      },
      { cta: "Try again", loadSpins: 2, response: { type: "image", value: "assets/images/s3_leak_02_img.png" } }
    ]
  };

  var ARE_YOU_SAFE_MESSAGE_DATA = {
    message: "Are you safe?",
    attempts: [
      {
        cta: "send",
        loadSpins: 4,
        response: { type: "text", value: "No connection" },
        nextMessage: { text: "For the sake of God give me a sign …" }
      },
      {
        cta: "Try again",
        loadSpins: 3,
        response: { type: "text", value: "No connection" },
        nextMessage: { text: "😭😭😭😭😭😭" }
      },
      {
        cta: "Please try again",
        loadSpins: 2,
        response: { type: "text", value: "No connection" },
        nextMessage: { text: "Dad??" }
      },
      { cta: "Please, please try again", loadSpins: 1, response: { type: "image", value: "assets/images/s3_leak_03_img.png" } }
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
        loadSpins: 2,
        response: { type: "text", value: "No conn…" },
        nextMessage: { text: "😭😭😭😭" }
      },
      { cta: "Connect", loadSpins: 4, response: { type: "image", value: "assets/images/s3_leak_05_img.png" } }
    ]
  };

  var DAD_MESSAGE_DATA = {
    message: "Dad?",
    attempts: [
      {
        cta: "Connect",
        loadSpins: 1,
        response: { type: "text", value: "No connection" },
        nextMessage: { text: "Do you hear me?" }
      },
      { cta: "Connect", loadSpins: 4, response: { type: "image", value: "assets/images/s3_leak_07_img.png" } }
    ]
  };

  var ARE_YOU_ALIVE_MESSAGE_DATA = {
    message: "Are you alive? 😭",
    attempts: [
      {
        cta: "send",
        loadSpins: 2,
        response: { type: "text", value: "No connection" },
        nextMessage: { text: "Tell me something!" }
      },
      {
        cta: "Try again",
        loadSpins: 4,
        response: { type: "text", value: "#11780" },
        nextMessage: { text: "I'm begging you …" }
      },
      {
        cta: "Try again",
        loadSpins: 1,
        response: { type: "text", value: "#11780" }
      }
    ]
  };

  var STAGE_3_MESSAGE_MOMENTS = [
    MOM_MESSAGE_DATA,
    WHAT_IS_HAPPENING_MESSAGE_DATA,
    ARE_YOU_SAFE_MESSAGE_DATA,
    AIDA_MESSAGE_DATA,
    ALI_MESSAGE_DATA,
    DAD_MESSAGE_DATA,
    ARE_YOU_ALIVE_MESSAGE_DATA
  ];

  var NAME_THEM_MOMENT_DATA = {
    intro: { text: "#11780?????", cta: "search" },
    steps: [
      { type: "text", value: "Had any number ever made you sad?" },
      { type: "text", value: "Yes, #11780." },
      { type: "text", value: "#11780 is not a number, that's my hero!" },
      {
        type: "image-with-caption",
        image: "assets/images/s3_leak_08_img.png",
        caption: "They wrote 'unidentified #11780', but …"
      },
      { type: "text", value: "We read it as my dear, my bro …" },
      { type: "text", value: "Surely everyone had a name…" },
      { type: "text", value: "Let me be the one who knows your name!" }
    ],
    stepCta: "more",
    finalCta: "Call them by name"
  };

  /* ------------------------------------------------------------------
     Message moment queue — runs a list of message-moment data objects
     back to back with STS.runMessageMoment, in order, advancing to the
     next entry each time one completes. onMomentStart(index) fires right
     before each entry starts, letting the caller (initStage3 below) sync
     the background audio loops to the queue. onLeakShown is passed through
     to every STS.runMessageMoment call unchanged (see its own doc comment
     in shared.js).
     ------------------------------------------------------------------ */
  function runMessageMomentQueue(containerEl, queue, onQueueComplete, onMomentStart, onLeakShown) {
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
      STS.runMessageMoment(containerEl, data, playNext, onLeakShown);
    }

    playNext();
  }

  /* ------------------------------------------------------------------
     "Name them" moment — stage 3's closing moment (s3_mom_12). Not a
     message-moment attempt ladder: no spinner. Its cta chain is intro ->
     search -> clear -> cycle through the 7 steps one at a time via
     "more" -> finalCta -> full-black beat -> onComplete. Each step is
     either plain text or an image+caption pair; nothing persists
     between steps except whichever one is current — every step is an
     instant clear (no fade) before the next one shows.
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

    function showButton(label, onClick) {
      actionEl.innerHTML = ""; // instant, no fade
      var button = document.createElement("button");
      button.type = "button";
      button.className = "button message-moment__button";
      button.textContent = label;
      STS.bindTapAndClick(button, onClick);
      actionEl.appendChild(button);
      STS.presentCtaButton(button);
    }

    // Removes whatever image the previous step may have shown — nothing
    // persists between steps except the current one.
    function clearPreviousImage() {
      var existing = containerEl.querySelector(".name-them-moment__image-wrap");
      if (existing) existing.remove();
    }

    function showStep(stepIndex) {
      actionEl.innerHTML = ""; // instant, no fade — button gone while this step shows in
      clearPreviousImage();

      var step = data.steps[stepIndex];
      var isLastStep = stepIndex === data.steps.length - 1;

      function onStepShown() {
        if (isLastStep) {
          showButton(data.finalCta, finish);
        } else {
          showButton(data.stepCta, function () {
            showStep(stepIndex + 1);
          });
        }
      }

      if (step.type === "image-with-caption") {
        var imageWrapEl = document.createElement("div");
        imageWrapEl.className = "name-them-moment__image-wrap";

        var imgEl = document.createElement("img");
        imgEl.className = "message-moment__response-image";
        imgEl.src = step.image;
        imgEl.alt = "";
        imageWrapEl.appendChild(imgEl);

        containerEl.insertBefore(imageWrapEl, textEl);
        STS.typeText(textEl, step.caption, 14, onStepShown);
      } else {
        STS.typeText(textEl, step.value, 14, onStepShown);
      }
    }

    function finish() {
      containerEl.innerHTML = ""; // instant, no fade — everything gone
      STS.coverViewportInBlack(1000, onComplete);
    }

    STS.typeText(textEl, data.intro.text, 14, function () {
      showButton(data.intro.cta, function () {
        showStep(0);
      });
    });
  }

  // Background gunshot loop: starts at s3_mom_05 ("Mom", the very
  // start of stage 3), keeps looping underneath every moment in between,
  // and is fully stopped/unloaded right as s3_mom_10 ("Dad?") begins.
  var STAGE_3_GUNSHOT_START_INDEX = STAGE_3_MESSAGE_MOMENTS.indexOf(MOM_MESSAGE_DATA);
  var STAGE_3_GUNSHOT_STOP_INDEX = STAGE_3_MESSAGE_MOMENTS.indexOf(DAD_MESSAGE_DATA);

  // Longer underscore loop: also starts at s3_mom_05, but — unlike the
  // gunshot track — keeps looping underneath all of stage 3, all of stage
  // 4, and into stage 5's merged 11780+form screen. It's only stopped once
  // the form is actually submitted (see stage4-5.js's initStage5).
  var STAGE_3_UNDERSCORE_START_INDEX = STAGE_3_GUNSHOT_START_INDEX;

  // Field memorial reveal (s3_mom_05 through s3_mom_10): the 5 gray-out
  // jumps are paced against this estimate, measured via an automated,
  // as-fast-as-possible click-through of every attempt between "Mom?" and
  // "Dad?" (real elapsed time from s3_gunshot_snd's "play" to its "pause").
  // A real participant reading each message will very likely take longer
  // than this — that's fine, since the real "pause" event (not this
  // estimate) is what actually ends the reveal; this number only affects
  // how evenly-paced the 5 jumps look along the way.
  var GUNSHOT_DURATION_ESTIMATE_MS = 83800; // ~83.8s

  function initStage3() {
    var momentMountEl = document.getElementById("stage-3-moment-mount");
    var gunshotAudioEl = document.getElementById("stage-3-gunshot-audio");

    if (gunshotAudioEl && window.Field) {
      // Triggers phase 2 of the field zoom (recoilZoom(), a sharp -30%
      // snap) and the field's memorial reveal (startMemorialReveal(), see
      // field.js — this also starts fleeing group 1, the first of 4
      // staggered groups, see below) the instant s3_gunshot_snd actually
      // starts playing (STS.gunshotAudio.start() below, at s3_mom_05) — a
      // real event trigger off the audio file's own native "play" event,
      // not a computed duration, so both always hand off at exactly the
      // right instant.
      var onGunshotPlay = function () {
        gunshotAudioEl.removeEventListener("play", onGunshotPlay);
        window.Field.recoilZoom();
        window.Field.startMemorialReveal(GUNSHOT_DURATION_ESTIMATE_MS);
      };
      gunshotAudioEl.addEventListener("play", onGunshotPlay);

      // Stopping s3_gunshot_snd is an explicit STS.gunshotAudio.stop() call
      // (below, at s3_mom_10/"Dad?") — not a natural "ended", since the
      // element loops indefinitely. That stop() calls audioEl.pause(),
      // which still fires the audio element's own native "pause" event, so
      // this is the same event-driven pattern as the "play" listener above:
      // finishes the memorial reveal exactly when the audio actually stops,
      // not on a computed delay.
      var onGunshotPause = function () {
        gunshotAudioEl.removeEventListener("pause", onGunshotPause);
        window.Field.stopMemorialReveal();
      };
      gunshotAudioEl.addEventListener("pause", onGunshotPause);
    }

    runMessageMomentQueue(
      momentMountEl,
      STAGE_3_MESSAGE_MOMENTS,
      function () {
        runNameThemMoment(momentMountEl, NAME_THEM_MOMENT_DATA, STS.goToNextStage);
      },
      function (momentIndex) {
        if (momentIndex === STAGE_3_UNDERSCORE_START_INDEX) {
          STS.underscoreAudio.start();
        }

        if (momentIndex === STAGE_3_GUNSHOT_START_INDEX) {
          STS.gunshotAudio.start();
        } else if (momentIndex === STAGE_3_GUNSHOT_STOP_INDEX) {
          STS.gunshotAudio.stop();
        }
      },
      // EXPERIMENTAL — staggers the field's fleeing dots into 4 groups (see
      // field.js's startFleeGroup()): group 1 already starts with
      // startMemorialReveal() above, off s3_gunshot_snd's own "play" event.
      // Groups 2-4 have no native media event to hook (images don't fire
      // "play"), so they're triggered off this leak-shown callback instead
      // — the same moment-runner-level signal frame already has for when a
      // specific leak begins rendering, matched here by asset filename.
      // Also drives two later, unrelated #11780-only field effects off the
      // same signal: response.value is a plain string ("#11780") rather
      // than a file path for ARE_YOU_ALIVE_MESSAGE_DATA's final attempt
      // (s3_mom_11), matched with === instead of indexOf.
      function (response) {
        if (!window.Field || !response || typeof response.value !== "string") return;
        if (response.value.indexOf("s3_leak_01_vid") !== -1) {
          window.Field.startFleeGroup(2);
        } else if (response.value.indexOf("s3_leak_02_img") !== -1) {
          window.Field.startFleeGroup(3);
        } else if (response.value.indexOf("s3_leak_03_img") !== -1) {
          window.Field.startFleeGroup(4);
        } else if (response.value.indexOf("s3_leak_07_img") !== -1) {
          window.Field.addEleven780Stroke();
        } else if (response.value === "#11780") {
          window.Field.doubleEleven780Size();
        }
      }
    );
  }

  STS.registerStageEnter(3, initStage3);
})();
