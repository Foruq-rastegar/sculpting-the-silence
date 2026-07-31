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
      STS.bindTapAndClick(button, onClick);
      actionEl.appendChild(button);
      STS.presentCtaButton(button);
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
      STS.typeText(
        zoneTextEl,
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
      STS.typeText(zoneTextEl, data.captionBelow, 14, function () {
        showButton(data.reactionCta, shrinkImageThenShowFirstReaction);
      });
    }

    function finish() {
      containerEl.innerHTML = ""; // instant, no fade — image, text, button all gone
      STS.coverViewportInBlack(1000, onComplete);
    }

    STS.typeText(
      textEl,
      data.intro.text,
      14,
      function () {
        showButton(data.intro.cta, showImage);
      },
      "word"
    );
  }

  // Background gunshot loop: starts at s3_mom_05 ("Mom???", the very
  // start of stage 3), keeps looping underneath every moment in between,
  // and is fully stopped/unloaded right as s3_mom_10 ("Papa?") begins.
  var STAGE_3_GUNSHOT_START_INDEX = STAGE_3_MESSAGE_MOMENTS.indexOf(MOM_MESSAGE_DATA);
  var STAGE_3_GUNSHOT_STOP_INDEX = STAGE_3_MESSAGE_MOMENTS.indexOf(PAPA_MESSAGE_DATA);

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
