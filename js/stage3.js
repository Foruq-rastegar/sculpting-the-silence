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
      // TEST SWAP — was { type: "image", value: "assets/images/s3_leak_07_img.png" }
      // (s3_leak_07_img). That image used to also double as the timing
      // trigger for ready_to_call_status(); that trigger has since moved
      // to s3_mom_11 (see onLeakShown below), so this response is now
      // purely a text-vs-image test with no other role attached.
      { cta: "Connect", loadSpins: 4, response: { type: "text", value: "No connection" } }
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

  // Shared across every s3_mom_12 reaction step below (not swapped per
  // response) — blurred via .name-them-moment__avatar's own filter, not a
  // pre-blurred source file.
  var PROFILE_ICON_SRC = "assets/icons/s3_profile_icon.png";

  var NAME_THEM_MOMENT_DATA = {
    intro: { text: "#11780?????", cta: "search" },
    steps: [
      // s3_diaspora_react_01_txt
      { text: "Mahsa: Had any number ever made you sad?" },
      // s3_diaspora_react_02_txt
      { text: "Ahmad: Yes, #11780." },
      // s3_diaspora_react_03_txt
      { text: "Zahra: #11780 is not a number, that's my hero!" },
      // s3_leak_08_img + s3_diaspora_react_04_txt
      {
        image: "assets/images/s3_leak_08_img.png",
        text: "Pouya: They wrote 'unidentified #11780', but …"
      },
      // s3_diaspora_react_05_txt
      { text: "Bahram: We read it as my dear, my bro …" },
      // s3_diaspora_react_06_txt
      { text: "Foruq: Surely everyone had a name…" },
      // s3_diaspora_react_07_txt
      { text: "Arezoo: Let me be the one who knows your name!" }
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
     message-moment attempt ladder: no spinner. Its cta chain is intro's
     "search" (1st cta) -> clear -> cycle through the 7 steps one at a
     time via "more" (2nd-7th ctas) -> finalCta "Call them by name" (8th
     cta) -> full-black beat -> onComplete. Each step is either plain text
     or an image+caption pair; nothing persists between steps except
     whichever one is current — every step is an instant clear (no fade)
     before the next one shows. The 1st and 8th ctas each also carry their
     own independent #11780 field effects (see showButton's handlers
     below) — unrelated to the step-cycling itself.
     ------------------------------------------------------------------ */
  function runNameThemMoment(containerEl, data, onComplete) {
    if (!containerEl) return;
    containerEl.innerHTML = "";

    // s3_leak_08_img (the "image-with-caption" step below) has no
    // applyLeakZoomAndFade treatment — unlike every other stage-3 leak —
    // but it's still excluded from the wrapper, same rule as every other
    // leak's media: mounts unwrapped into mediaEl, a sibling of boxEl,
    // reusing the same .message-moment__leak-media class/pattern as
    // runMessageMoment's leakMediaEl. Only the caption (typed into textEl,
    // same as this moment's other step text) and the action button wrap
    // normally in boxEl.
    var mediaEl = document.createElement("div");
    mediaEl.className = "message-moment__leak-media";
    containerEl.appendChild(mediaEl);

    var boxEl = STS.createMomentContentBox(containerEl, "moment-content-box--s3-name-them");

    // Icon+text row for the 7 diaspora-reaction steps below (each pairs a
    // blurred profile icon with a "Name: quote" line) — avatarEl starts
    // hidden (no .is-active) since the intro line ("#11780?????", typed
    // into the same textEl below) isn't one of those reactions and
    // shouldn't show an icon; showStep() reveals it starting at step 0 and
    // it then stays visible for the rest of the moment.
    var reactionEl = document.createElement("div");
    reactionEl.className = "name-them-moment__reaction";
    boxEl.appendChild(reactionEl);

    var avatarEl = document.createElement("img");
    avatarEl.className = "name-them-moment__avatar";
    avatarEl.src = PROFILE_ICON_SRC;
    avatarEl.alt = "";
    reactionEl.appendChild(avatarEl);

    var textEl = document.createElement("p");
    textEl.className = "frame__body";
    reactionEl.appendChild(textEl);

    var actionEl = document.createElement("div");
    actionEl.className = "message-moment__action";
    boxEl.appendChild(actionEl);

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
      mediaEl.innerHTML = "";
      mediaEl.classList.remove("is-active");
    }

    function showStep(stepIndex) {
      actionEl.innerHTML = ""; // instant, no fade — button gone while this step shows in
      clearPreviousImage();
      avatarEl.classList.add("is-active"); // every step (0-6) is a reaction, unlike the intro above
      boxEl.classList.remove("name-them-moment__box--tight-to-image");

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

      if (step.image) {
        var imageWrapEl = document.createElement("div");
        imageWrapEl.className = "name-them-moment__image-wrap";

        var imgEl = document.createElement("img");
        imgEl.className = "message-moment__response-image";
        imgEl.src = step.image;
        imgEl.alt = "";
        imageWrapEl.appendChild(imgEl);

        mediaEl.appendChild(imageWrapEl);
        mediaEl.classList.add("is-active");
        boxEl.classList.add("name-them-moment__box--tight-to-image");
      }

      STS.typeText(textEl, step.text, 14, onStepShown);
    }

    function finish() {
      STS.callNextInSequence(); // 8th/final cta ("Call them by name") — starts s4_name_01's heartbeat, same as before
      if (window.Field) {
        // #11780 was already highlighted by the intro's "search" cta by
        // this point — resolve it here (permanent color, heartbeat
        // stopped) rather than waiting for its own turn in the s4_name
        // queue, since it isn't part of that queue at all (see
        // shared.js's CALL_BY_NAME_QUEUE).
        window.Field.resolveNamedDot("#11780");
      }
      containerEl.innerHTML = ""; // instant, no fade — everything gone
      // No coverViewportInBlack() beat here anymore — it covered the field
      // as well as the frame for 1s, which read as an unwanted black flash
      // on the stage 3->4 transition; removed per feedback so this handoff
      // is instant on both, same as every other stage change.
      onComplete();
    }

    STS.typeText(textEl, data.intro.text, 14, function () {
      showButton(data.intro.cta, function () {
        // 1st cta ("search") — #11780 only, entirely separate from the
        // s4_name_01..09 queue (see shared.js's CALL_BY_NAME_QUEUE):
        // starts its heartbeat + ready-to-call stroke, and labels it on
        // the field with its own tag text. Reuses the name-tooltip
        // primitive with an empty story — see drawActiveNameTooltip() in
        // field.js, which just skips the story lines when there's none.
        if (window.Field) {
          window.Field.s4_heartbeat_anim("#11780");
          window.Field.ready_to_call_status();
          window.Field.showNameTooltip("#11780", "#11780", "");
        }
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
      // Triggers phase 2 of the field zoom and the field's memorial reveal
      // (startMemorialReveal(), see field.js — this also starts fleeing
      // group 1, the first of 4 staggered groups, see below) the instant
      // s3_gunshot_snd actually starts playing (STS.gunshotAudio.start()
      // below, at s3_mom_05) — a real event trigger off the audio file's
      // own native "play" event, not a computed duration, so both always
      // hand off at exactly the right instant.
      //
      // EXPERIMENTAL, may be reverted — test: was window.Field.recoilZoom()
      // (a sharp -30% snap-and-settle from whatever scale phase 1 reached);
      // now window.Field.resetZoom() (full reset straight to 1x, no zoom at
      // all), paired with stage2.js's STAGE2_FIELD_ZOOM test value. Revert
      // this call back to recoilZoom() to restore the previous tuned
      // system.
      var onGunshotPlay = function () {
        gunshotAudioEl.removeEventListener("play", onGunshotPlay);
        window.Field.resetZoom();
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
      // Also drives #11780's three activation effects together off one
      // later, unrelated signal: response.value is a plain string
      // ("#11780") rather than a file path for ARE_YOU_ALIVE_MESSAGE_DATA's
      // final attempt (s3_mom_11, "res2"), matched with === instead of
      // indexOf. ready_to_call_status() and s4_heartbeat_anim() used to
      // fire earlier, off DAD_MESSAGE_DATA's final attempt (s3_mom_10) —
      // moved here so all three (size, stroke, heartbeat) land on the same
      // beat instead of being split across two moments. (s4_heartbeat_anim
      // already applies the ready-to-call stroke itself the instant it
      // starts — see field.js's runHeartbeatOnDot — so the explicit
      // ready_to_call_status() call below is technically redundant, but
      // kept for parity with s3_mom_12's own "search" cta, which still
      // calls both the same way.)
      function (response) {
        if (!window.Field || !response || typeof response.value !== "string") return;
        if (response.value.indexOf("s3_leak_01_vid") !== -1) {
          window.Field.startFleeGroup(2);
        } else if (response.value.indexOf("s3_leak_02_img") !== -1) {
          window.Field.startFleeGroup(3);
        } else if (response.value.indexOf("s3_leak_03_img") !== -1) {
          window.Field.startFleeGroup(4);
        } else if (response.value === "#11780") {
          window.Field.doubleEleven780Size();
          window.Field.ready_to_call_status();
          window.Field.s4_heartbeat_anim("#11780");
        }
      }
    );
  }

  STS.registerStageEnter(3, initStage3);

  /* ------------------------------------------------------------------
     Dev tool — one more skip button alongside shared.js's per-stage ones
     (same #dev-stage-skip container, same .dev-stage-skip__btn styling),
     but moment-level instead of stage-level: jumps straight to s3_mom_12
     ("Name Them") rather than just the start of stage 3, since it's the
     moment being tested most right now. goToStage's skipHandler flag
     (see shared.js) consumes stage 3's one-shot initStage3 handler
     without running it, so the normal message-moment ladder before
     s3_mom_12 never starts and can't race this direct call for control
     of #stage-3-moment-mount.
     ------------------------------------------------------------------ */
  (function setupDevJumpToNameThemButton() {
    var containerEl = document.getElementById("dev-stage-skip");
    if (!containerEl) return;

    var button = document.createElement("button");
    button.type = "button";
    button.className = "dev-stage-skip__btn";
    button.textContent = "s3_mom_12";
    button.addEventListener("click", function () {
      STS.goToStage(3, true);
      var momentMountEl = document.getElementById("stage-3-moment-mount");
      if (momentMountEl) {
        runNameThemMoment(momentMountEl, NAME_THEM_MOMENT_DATA, STS.goToNextStage);
      }
    });
    containerEl.appendChild(button);
  })();
})();
