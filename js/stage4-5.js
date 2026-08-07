/* ==========================================================================
   Sculpting the Silence — Stages 4 and 5 (combined)
   Stage 4: name moments — button-driven, one per victim. Types the name
   (title-style) then a subtext line, plays that moment's audio
   fire-and-forget, then shows the cta. All 9 named moments advance
   straight into stage 5.
   Stage 5: s4_mom_22 (the "#11780" reveal + choice screen) offers two
   separate paths — write a name/story (into s4_mom_23, its own standalone
   form page, a hard cut rather than a continuous screen) or skip straight
   to s5_mom_24 (the collective board) with #11780 added as a silent,
   gray "Anonymous" entry and permanently retired from the field. Both
   paths converge on the board. Combined in one file since these two
   stages are tightly connected.
   ========================================================================== */

(function () {
  "use strict";

  var STS = window.STS;

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
    { name: "Sajad Vala Manesh", subtext: "Perhaps he was waiting for a pair of shoes, a gift their emigrated sister would bring.", audio: "assets/audio/s4_name_03_snd.mp3" },
    { name: "Ayda Heidari", subtext: "Perhaps she had said it's not tolerable any more, and something must be done.", audio: "assets/audio/s4_name_04_snd.mp3" },
    { name: "Frahad Farsi", subtext: "But perhaps, struggling with their fears, he left a note: \"if I do not come back, do not weep at my grave — dance.\"", audio: "assets/audio/s4_name_05_snd.mp3" },
    { name: "Latif Karimi", subtext: "Perhaps he wanted to call his emigrated sister.", audio: "assets/audio/s4_name_06_snd.mp3" },
    { name: "Sepehr Shokri", subtext: "Perhaps he wanted to say: \"We are many, and this time we will make a change\".", audio: "assets/audio/s4_name_07_snd.mp3" },
    { name: "Mahmoud Rastegar", subtext: "Perhaps he wanted to say: \"I have missed you so much.\" But many tries, and no connection.", audio: "assets/audio/s4_name_08_snd.mp3" },
    { name: "Raha Azadi", subtext: "Perhaps, running away, she thought that if she had better shoes, she could have made it out alive.", audio: "assets/audio/s4_name_09_snd.mp3" }
  ];

  // isLastMoment marks the 9th/final name moment (Raha Azadi, s4_mom_21)
  // — its "Call them by name" click does two extra things no earlier name
  // moment's click does: stops the underscore loop (previously stopped on
  // the closing form's submit; now stopped here instead, before the
  // s4_mom_22 choice screen even appears, since that screen no longer
  // guarantees the form path), and — via the same general
  // STS.callNextInSequence() every occurrence of this CTA already calls —
  // resolves s4_name_09 and starts #11780's heartbeat, since #11780 is the
  // 10th and final entry in shared.js's CALL_BY_NAME_QUEUE. No special-
  // casing needed for the queue advance itself, only for the audio stop.
  function runNameMoment(containerEl, data, onComplete, isLastMoment) {
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
      button.textContent = "Call them by name";
      STS.bindTapAndClick(button, function () {
        if (isLastMoment) {
          STS.underscoreAudio.stop(); // s4_mom_21 — stops here, ahead of s4_mom_22's choice screen
        }
        STS.callNextInSequence(); // resolves this moment's dot, starts the next one's heartbeat
        containerEl.innerHTML = ""; // instant, no fade
        onComplete();
      });
      actionEl.appendChild(button);
      STS.presentCtaButton(button);
    }

    STS.typeText(nameEl, data.name, STAGE_4_CHARS_PER_SECOND, function () {
      if (ageEl) {
        STS.typeText(ageEl, data.age, STAGE_4_CHARS_PER_SECOND, function () {
          STS.typeText(subtextEl, data.subtext, STAGE_4_CHARS_PER_SECOND, showButton);
        });
      } else {
        STS.typeText(subtextEl, data.subtext, STAGE_4_CHARS_PER_SECOND, showButton);
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
      var isLastMoment = index === queue.length - 1;
      index += 1;
      runNameMoment(containerEl, data, playNext, isLastMoment);
    }

    playNext();
  }

  function initStage4() {
    var momentMountEl = document.getElementById("stage-4-moment-mount");
    // s4_mom_22 (the "#11780" choice screen) now opens stage 5's own
    // moments (see initStage5 below) instead of running as its own moment
    // here, so all 9 named moments advance straight into stage 5.
    runNameMomentQueue(momentMountEl, NAME_MOMENTS_DATA, STS.goToNextStage);
  }

  STS.registerStageEnter(4, initStage4);

  /* ------------------------------------------------------------------
     Stage 5 — s4_mom_22 (the "#11780" choice screen, runElevenChoiceMoment)
     branches to either s4_mom_23 (its own standalone form page,
     runElevenFormMoment) or straight past it, both converging on
     s5_mom_24 (collective board). No auto-advance, no loop after the
     board — it's the last moment in the current build.
     ------------------------------------------------------------------ */

  // Now shown as s5_mom_24's small footer instead of its own screen —
  // placeholder text, swap in the real closing statement here when ready.
  var CLOSING_STATEMENT_TEXT = "Thank you for calling them out of silence.";

  // localStorage-backed entry store shared by s4_mom_23/s4_mom_22's skip
  // path (writes) and s5_mom_24 (reads). Each entry is { name, story,
  // anonymous }: anonymous is only true for the single "Anonymous #11780"
  // entry added when s4_mom_22's alternative CTA skips the form — every
  // other entry (including older ones written before this field existed)
  // is falsy/undefined here, i.e. a normal named entry.
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

  function addEntry(name, story, isAnonymous) {
    var entries = loadEntries();
    entries.push({ name: name, story: story, anonymous: !!isAnonymous });
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

  // s4_mom_22 — the "#11780" reveal + choice screen. Distinct from the
  // generic "Call them by name" CTA (see STS.callNextInSequence): this
  // screen offers two separate paths of its own instead of advancing that
  // queue — the queue already finished with this dot back at s4_mom_21's
  // click, which started #11780's heartbeat as the queue's 10th/final
  // entry (see shared.js's CALL_BY_NAME_QUEUE).
  function runElevenChoiceMoment(containerEl, onWriteStory, onReadOnly) {
    containerEl.innerHTML = "";

    var titleEl = document.createElement("p");
    titleEl.className = "frame__title";
    containerEl.appendChild(titleEl);

    var subtextEl = document.createElement("p");
    subtextEl.className = "frame__body";
    containerEl.appendChild(subtextEl);

    var actionEl = document.createElement("div");
    actionEl.className = "message-moment__action stage-5__choice-action";
    containerEl.appendChild(actionEl);

    function showButtons() {
      var primaryBtn = document.createElement("button");
      primaryBtn.type = "button";
      primaryBtn.className = "button message-moment__button";
      primaryBtn.textContent = "Let me give them a name and story";
      STS.bindTapAndClick(primaryBtn, onWriteStory);
      actionEl.appendChild(primaryBtn);

      var secondaryBtn = document.createElement("button");
      secondaryBtn.type = "button";
      secondaryBtn.className = "button button--secondary message-moment__button";
      secondaryBtn.textContent = "Let me just read their stories";
      STS.bindTapAndClick(secondaryBtn, onReadOnly);
      actionEl.appendChild(secondaryBtn);

      STS.presentCtaButton(primaryBtn);
    }

    STS.typeText(titleEl, "#11780", STAGE_4_CHARS_PER_SECOND, function () {
      STS.typeText(
        subtextEl,
        "They erased their names. They silenced their stories. But no blackout can make us forget. Be the one who calls them back from the silence.",
        STAGE_4_CHARS_PER_SECOND,
        showButtons
      );
    });
  }

  // s4_mom_23 — standalone closing form page. A hard cut from s4_mom_22
  // (its own separate page transition, not a continuation of the same
  // screen — see initStage5's onWriteStory below), but its own two fields
  // still slide in one after another via the same slideElIntoView pattern
  // the old merged screen used.
  function runElevenFormMoment(containerEl, onSubmit) {
    containerEl.innerHTML = "";

    var nameFieldWrap = document.createElement("div");
    nameFieldWrap.className = "stage-5__field";
    var nameLabel = document.createElement("label");
    nameLabel.className = "stage-5__field-label";
    nameLabel.textContent = "Give the Anonymous #11780 a name";
    nameLabel.setAttribute("for", "stage-5-name-input");
    var nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.id = "stage-5-name-input";
    nameInput.className = "stage-5__field-input";
    nameInput.placeholder = "Anonymous #11780";
    nameFieldWrap.appendChild(nameLabel);
    nameFieldWrap.appendChild(nameInput);

    var recallFieldWrap = document.createElement("div");
    recallFieldWrap.className = "stage-5__field";
    var recallLabel = document.createElement("label");
    recallLabel.className = "stage-5__field-label";
    recallLabel.textContent = "Echo their voice with a story";
    recallLabel.setAttribute("for", "stage-5-recall-input");
    var recallInput = document.createElement("input");
    recallInput.type = "text";
    recallInput.id = "stage-5-recall-input";
    recallInput.className = "stage-5__field-input";
    recallInput.placeholder = "Perhaps they…";
    recallInput.maxLength = 80;
    recallFieldWrap.appendChild(recallLabel);
    recallFieldWrap.appendChild(recallInput);

    var actionEl = document.createElement("div");
    actionEl.className = "message-moment__action stage-5__submit-action";

    var button = document.createElement("button");
    button.type = "button";
    button.className = "button message-moment__button";
    button.textContent = "Call them out of silence";
    STS.bindTapAndClick(button, function () {
      onSubmit(nameInput.value.trim(), recallInput.value.trim());
    });
    actionEl.appendChild(button);

    slideElIntoView(containerEl, nameFieldWrap, "stage-5__field--enter", function () {
      slideElIntoView(containerEl, recallFieldWrap, "stage-5__field--enter", function () {
        slideElIntoView(containerEl, actionEl, "stage-5__submit-action--enter", function () {
          STS.presentCtaButton(button);
        });
      });
    });
  }

  var COLLECTIVE_BOARD_NAME_SATURATION = 70; // %
  var COLLECTIVE_BOARD_NAME_LIGHTNESS = 65; // % — stays readable on black
  var COLLECTIVE_BOARD_EDGE_MARGIN_PERCENT = 6; // keep names off the very edge
  var COLLECTIVE_BOARD_ANONYMOUS_COLOR = "hsl(0, 0%, 55%)"; // gray, no hue — the "Anonymous #11780" entry only

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
      footerEl.textContent = CLOSING_STATEMENT_TEXT; // shows instantly, no typing animation
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

      if (entry.anonymous) {
        nameEl.style.color = COLLECTIVE_BOARD_ANONYMOUS_COLOR;
      } else {
        var hue = Math.floor(Math.random() * 360);
        nameEl.style.color = "hsl(" + hue + ", " + COLLECTIVE_BOARD_NAME_SATURATION + "%, " + COLLECTIVE_BOARD_NAME_LIGHTNESS + "%)";
      }

      var x = COLLECTIVE_BOARD_EDGE_MARGIN_PERCENT + Math.random() * (100 - COLLECTIVE_BOARD_EDGE_MARGIN_PERCENT * 2);
      var y = COLLECTIVE_BOARD_EDGE_MARGIN_PERCENT + Math.random() * (100 - COLLECTIVE_BOARD_EDGE_MARGIN_PERCENT * 2);
      nameEl.style.left = x + "%";
      nameEl.style.top = y + "%";

      // Assigned once per entry (index keeps it stable even for two
      // entries with the same/blank name) and reused on every hover/tap —
      // never re-randomized. Anonymous is silent (no sound) — leaving
      // noteFrequency undefined does that for free, since
      // playCollectiveBoardNote() already no-ops on a falsy frequency.
      var noteFrequency;
      if (!entry.anonymous) {
        var noteIndex = hashStringToIndex(index + "|" + entry.name, COLLECTIVE_BOARD_NOTE_FREQUENCIES.length);
        noteFrequency = COLLECTIVE_BOARD_NOTE_FREQUENCIES[noteIndex];
      }

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

    // Underscore audio is now stopped earlier, at s4_mom_21's "Call them
    // by name" click (see stage4-5.js's runNameMoment) — ahead of this
    // choice screen, since it no longer always leads to the form.
    function goToBoard() {
      momentMountEl.innerHTML = ""; // instant, no fade
      showCollectiveBoard(); // straight to s5_mom_24 — no standalone thank-you screen
    }

    runElevenChoiceMoment(
      momentMountEl,
      function onWriteStory() {
        momentMountEl.innerHTML = ""; // instant, no fade — s4_mom_22 -> s4_mom_23 is its own separate page, not a continuous screen
        runElevenFormMoment(momentMountEl, function onSubmit(nameValue, storyValue) {
          addEntry(nameValue, storyValue);
          // Same general mechanism as s4_name_01..09's own resolution —
          // #11780 now has a name/story, so it gets a random permanent
          // color and its heartbeat stops, same as every other resolved
          // dot in the queue.
          if (window.Field) window.Field.resolveNamedDot("#11780");
          goToBoard();
        });
      },
      function onReadOnly() {
        addEntry("Anonymous", "", true);
        if (window.Field) window.Field.removeEleven780();
        goToBoard();
      }
    );
  }

  STS.registerStageEnter(5, initStage5);
})();
