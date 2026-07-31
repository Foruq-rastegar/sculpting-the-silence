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
    message: "Mom",
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
        nextMessage: { text: "Hon??" }
      },
      {
        cta: "Try again",
        loadSpins: 2,
        response: { type: "text", value: "No response" },
        nextMessage: { text: "Give me an update please" }
      },
      { cta: "Please try again", loadSpins: 1, response: { type: "image", value: "assets/images/s3_leak_01_img.png" } }
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
      // Plain video leak like any other — no caption, no slide-up
      // transition (that one-off special case has been removed).
      { cta: "Connect", loadSpins: 4, response: { type: "video", value: "assets/video/s3_leak_07_vid.mp4" } }
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
        response: {
          type: "image",
          value: "assets/images/s3_leak_08_img.png",
          caption: "Body #11780: Unidentified"
        }
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
    reactions: [
      "Had any number ever made you sad?",
      "Yes, #11780.",
      "#11780 is not a number, that's my hero!",
      "They wrote 'unidentified #11780', but …",
      "We read it as my dear, my bro …",
      "Surely everyone had a name…",
      "Let me be the one who knows your name!"
    ],
    reactionCta: "more",
    finalCta: "Call them by name"
  };

  /* ------------------------------------------------------------------
     Message moment queue — runs a list of message-moment data objects
     back to back with STS.runMessageMoment, in order, advancing to the
     next entry each time one completes. onMomentStart(index) fires right
     before each entry starts, letting the caller (initStage3 below) sync
     the background audio loops to the queue.
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
      STS.runMessageMoment(containerEl, data, playNext);
    }

    playNext();
  }

  /* ------------------------------------------------------------------
     "Name them" moment — stage 3's closing moment (s3_mom_12). Not a
     message-moment attempt ladder: no spinner, no image — pure text.
     Its cta chain is intro -> search -> clear -> cycle through the 7
     reactions one at a time (word-by-word) via "more" -> finalCta ->
     full-black beat -> onComplete. Intro and every reaction reuse the
     same paragraph, so each swap is an instant clear (typeText resets
     the element before retyping) with no fade.
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

    function showReaction(reactionIndex) {
      actionEl.innerHTML = ""; // instant, no fade — button gone while this reaction types in
      var isLastReaction = reactionIndex === data.reactions.length - 1;
      STS.typeText(
        textEl,
        data.reactions[reactionIndex],
        14,
        function () {
          if (isLastReaction) {
            showButton(data.finalCta, finish);
          } else {
            showButton(data.reactionCta, function () {
              showReaction(reactionIndex + 1);
            });
          }
        },
        "word"
      );
    }

    function finish() {
      containerEl.innerHTML = ""; // instant, no fade — text, button all gone
      STS.coverViewportInBlack(1000, onComplete);
    }

    STS.typeText(
      textEl,
      data.intro.text,
      14,
      function () {
        showButton(data.intro.cta, function () {
          showReaction(0);
        });
      },
      "word"
    );
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

  function initStage3() {
    var momentMountEl = document.getElementById("stage-3-moment-mount");

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
      }
    );
  }

  STS.registerStageEnter(3, initStage3);
})();
