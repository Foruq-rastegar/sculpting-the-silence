/* ==========================================================================
   Sculpting the Silence — Stages 4 and 5 (combined)
   Stage 4: name moments — button-driven, one per victim. Types the name
   (title-style) then a subtext line, plays that moment's audio
   fire-and-forget, then shows the cta. Each moment's own "Call them by
   name" click also seeds its board entry (name/story sourced from
   NAME_MOMENTS_DATA, not a form — see addEntry()). All 9 named moments
   advance straight into stage 5.
   Stage 5, current default (USE_NEW_FINAL_SCENE = true), item 3's flow:
   s4_mom_22 ("#11780" title/subtext + a single "Explore to get more" CTA,
   runElevenExploreMoment) shows immediately once the scene's dot pattern
   has already appeared on the field (non-interactive, silent — see
   initStage5). The CTA swaps .frame out for the interactive final-scene
   canvas (beginFinalSceneExploration) — hover/tap now reveals a dot's
   name+"interact again" icon first, a second click/tap on that same dot
   its story (see wireFinalSceneInteractions). After ~15s of exploring, OR
   9 distinct dots hovered, whichever comes first, the fixed, always-the-
   same dot near the scene's center (window.FinalScene.
   ELEVEN780_PLACEHOLDER_DOT_INDEX) gets its pulse/ring highlight (same
   setTargetHighlight treatment as before) and becomes hoverable despite
   having no entry yet — activateEleven780Target/wireEleven780Target-
   Interaction. EXPERIMENTAL, round 4 (testing on #11780 only before any
   wider rollout): no popup — hovering it shows inline placeholder text
   ("Give them a voice by a name" / "...by a story") in the same tooltip
   position a named dot's would occupy; a first click swaps those
   placeholders for real inline `<input>`s; a second click submits
   whatever was typed, through the exact same resolution mechanism
   (addEntry/migrateEleven780PlaceholderOccupant/color+note assignment)
   any other dot's naming already used — colored+named if given a name,
   same as leaving it blank falls back to today's ordinary blank-name
   entry (no separate "Anonymous" decline path in this inline version) —
   and exploration continues uninterrupted throughout.
   LEGACY (USE_NEW_FINAL_SCENE = false): the old linear flow is left fully
   intact, untouched — s4_mom_22's two-way choice screen
   (runElevenChoiceMoment) into either s4_mom_23's standalone form
   (runElevenFormMoment) or a silent gray "Anonymous" entry with #11780
   permanently retired from the field (removeEleven780), both converging
   on the old collective board (DOM-based scattered names, showCollective-
   Board). initStage5 branches its ENTIRE flow on USE_NEW_FINAL_SCENE, not
   just which screen renders at the end, so flipping it stays a clean,
   complete, one-line rollback to the old flow exactly as it was.
   Every entry (whichever flow/screen writes or renders it) is permanently
   stored in localStorage (see ENTRIES_STORAGE_KEY's own doc comment) with
   both a dotId (linking it to a field.js channel-scene dot, used by the
   old board) and a finalSceneDotIndex (linking it to a dot in the new
   final scene's own fixed pattern) — the two are unrelated, since the new
   scene isn't part of the same s4_name_01-09/#11780 channel-dot system at
   all.
   Combined in one file since these two stages are tightly connected.
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
  // — its "Call them by name" click does one extra thing no earlier name
  // moment's click does: stops the underscore loop (previously stopped on
  // the closing form's submit; now stopped here instead, before the
  // s4_mom_22 choice screen even appears, since that screen no longer
  // guarantees the form path). Its STS.callNextInSequence() call resolves
  // s4_name_09 same as any other queue entry — #11780 is NOT in this
  // queue (see shared.js's CALL_BY_NAME_QUEUE), so nothing new starts
  // heartbeating after s4_name_09 resolves; #11780 has its own separate
  // activate/resolve triggers back in stage3.js's runNameThemMoment.
  // tagId ("s4_name_01".."09") is this moment's own field-dot tag —
  // sourced from data.name/data.subtext rather than a form, its board
  // entry is seeded right here, at the same click that resolves its dot.
  function runNameMoment(containerEl, data, onComplete, isLastMoment, tagId) {
    containerEl.innerHTML = "";
    var boxEl = STS.createMomentContentBox(containerEl, "moment-content-box--s4-name");

    // Fire-and-forget: this moment advances on button click, not on the
    // audio ending, so it's just started and never awaited or gated on.
    var audioEl = new Audio(data.audio);
    var playPromise = audioEl.play();
    if (playPromise && playPromise.catch) {
      playPromise.catch(function () {});
    }

    var nameEl = document.createElement("p");
    nameEl.className = "frame__title";
    boxEl.appendChild(nameEl);

    var ageEl = null;
    if (data.age) {
      ageEl = document.createElement("p");
      ageEl.className = "name-moment__age";
      boxEl.appendChild(ageEl);
    }

    var subtextEl = document.createElement("p");
    subtextEl.className = "frame__body";
    boxEl.appendChild(subtextEl);

    var actionEl = document.createElement("div");
    actionEl.className = "message-moment__action";
    boxEl.appendChild(actionEl);

    function showButton() {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "button message-moment__button";
      button.textContent = "Call them by name";
      STS.bindTapAndClick(button, function () {
        if (isLastMoment) {
          STS.underscoreAudio.stop(); // s4_mom_21 — stops here, ahead of s4_mom_22's choice screen
        }
        STS.callNextInSequence(); // resolves this moment's dot (tagId), starts the next one's heartbeat
        // Must run after callNextInSequence() above, not before — addEntry()
        // reads this dot's just-resolved color back from field.js, so tagId
        // needs to already be resolved by the time this call happens. Only
        // seeded once, ever, across every run — see entryExistsForDotId's
        // own doc comment.
        if (!entryExistsForDotId(tagId)) {
          addEntry(tagId, data.name, data.subtext, false);
        }
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
      var tagId = "s4_name_0" + (index + 1); // s4_name_01..09, matches field.js's memorialTagId scheme
      index += 1;
      runNameMoment(containerEl, data, playNext, isLastMoment, tagId);
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

  // Old collective board (DOM-based scattered names, reached via the
  // legacy choice -> form/anonymous flow) vs the new shared final scene
  // (js/final-scene.js, a fixed canvas dot pattern identical between field
  // and frame, reached via item 3's popup-based explore flow — see
  // initStage5 below, which branches its entire flow on this flag, not
  // just which screen renders at the end). Flip to false to revert to the
  // old board AND its old linear flow instantly — both left fully intact
  // below, untouched, specifically so this flag is a clean, one-line
  // rollback.
  var USE_NEW_FINAL_SCENE = true;

  // Item 3 — after the explore CTA is clicked, the visitor gets this long
  // exploring the scene before #11780 activates (see
  // activateEleven780Target) — OR until FINAL_SCENE_POPUP_HOVER_THRESHOLD
  // distinct dots have been hovered/tapped, whichever comes first. See
  // beginFinalSceneExploration.
  var FINAL_SCENE_POPUP_TIMER_MS = 10000; // round 8, item 2 — was 15000
  var FINAL_SCENE_POPUP_HOVER_THRESHOLD = 9;

  // EXPERIMENTAL, item 1 — once the visitor submits their own name/story in
  // the popup, keep that dot's name showing with no hover needed, for the
  // rest of the current run (cleared on the next page load along with
  // everything else — see shared.js's triggerNextRunReset()). Flip to
  // false to go back to hover-only (no persistent label).
  var PERSIST_OWN_ENTRY_LABEL = true;

  // localStorage-backed entry store — the permanent names/stories
  // registry. Append-only: an entry, once written, is never regenerated
  // or altered. Each entry is { dotId, name, story, color, x, y, note,
  // anonymous, finalSceneDotIndex }. dotId links a board entry back to a
  // specific field dot (field.js's memorialTagId — "#11780",
  // "s4_name_01".."09", or null for an entry with no linked dot) so
  // hovering it on the OLD board can trigger Field.showNameTooltip(dotId,
  // ...) — see renderCollectiveBoard() below. finalSceneDotIndex is a
  // SEPARATE, unrelated assignment: a permanent index into the NEW shared
  // final scene's own fixed 300-dot pattern (js/final-scene.js) — that dot
  // then keeps this entry's color/story forever, across every future run,
  // since the index is assigned once (see computeNextFinalSceneDotIndex()
  // below) and never reassigned. color/x/y/note/finalSceneDotIndex are all
  // decided once, at write time, in addEntry() — renderCollectiveBoard()
  // and the new final scene only ever read them back, never recompute them
  // (color/x/y/note used to be recomputed at render time, which meant
  // every existing entry's values silently reshuffled whenever the board
  // re-rendered — fixed by freezing them here instead).
  var ENTRIES_STORAGE_KEY = "sculptingTheSilenceEntries";
  // Exposed so shared.js's dev-tool "Reset entries" button (setupDevReset
  // EntriesButton) can clear this exact key without duplicating the
  // literal string in a second place — shared.js loads before this file,
  // but only ever reads this lazily, inside a click handler, well after
  // every script has finished loading.
  STS.ENTRIES_STORAGE_KEY = ENTRIES_STORAGE_KEY;

  // The next never-yet-used index into the final scene's fixed pattern —
  // one past whatever the highest already-assigned finalSceneDotIndex is,
  // wrapping (via modulo) if entries ever exceed FinalScene.DOT_COUNT
  // (a known, accepted limitation of a *fixed* dot count: a wrapped index
  // would double up on an already-assigned dot). Re-scans entries every
  // call rather than tracking a running counter, so it stays correct
  // regardless of how many entries are being backfilled in the same pass.
  function computeNextFinalSceneDotIndex(entries) {
    var maxAssigned = -1;
    entries.forEach(function (entry) {
      if (typeof entry.finalSceneDotIndex === "number" && entry.finalSceneDotIndex > maxAssigned) {
        maxAssigned = entry.finalSceneDotIndex;
      }
    });
    return (maxAssigned + 1) % window.FinalScene.DOT_COUNT;
  }

  // Backfills color/x/y/note/dotId/finalSceneDotIndex on any entry written
  // before this schema existed, so every entry loadEntries() returns is
  // guaranteed to have them — self-heals (and persists the backfilled
  // values, so it only ever needs to happen once per entry) rather than
  // requiring a one-time migration script. Returns true if anything was
  // backfilled.
  function ensureEntryDisplayFields(entries) {
    var changed = false;
    entries.forEach(function (entry) {
      if (entry.dotId === undefined) {
        entry.dotId = null;
        changed = true;
      }
      if (typeof entry.color !== "string") {
        entry.color = entry.anonymous ? COLLECTIVE_BOARD_ANONYMOUS_COLOR : randomBoardColor();
        changed = true;
      }
      if (typeof entry.x !== "number" || typeof entry.y !== "number") {
        var pos = randomBoardPosition();
        entry.x = pos.x;
        entry.y = pos.y;
        changed = true;
      }
      if (entry.note === undefined) {
        entry.note = entry.anonymous ? null : randomBoardNote();
        changed = true;
      }
      if (typeof entry.finalSceneDotIndex !== "number") {
        entry.finalSceneDotIndex = computeNextFinalSceneDotIndex(entries);
        changed = true;
      }
    });
    return changed;
  }

  function loadEntries() {
    try {
      var raw = window.localStorage.getItem(ENTRIES_STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      var entries = Array.isArray(parsed) ? parsed : [];
      if (ensureEntryDisplayFields(entries)) {
        try {
          window.localStorage.setItem(ENTRIES_STORAGE_KEY, JSON.stringify(entries));
        } catch (err) {
          // Storage unavailable/full — the backfilled values still work for
          // this session, just won't persist; nothing else to do here.
        }
      }
      return entries;
    } catch (err) {
      return [];
    }
  }

  // BUGFIX: s4_name_01..09's board entries are seeded from NAME_MOMENTS_DATA
  // (not a form — see runNameMoment's click handler), but the registry is
  // permanent, shared across every run via localStorage. Without this
  // check, every new visitor's click-through re-added all 9 as fresh
  // duplicate entries instead of only ever seeding them once, total, across
  // the whole exhibition. #11780's own entry is deliberately NOT deduped
  // this way — every run's real visitor submission is supposed to add a
  // new entry each time.
  function entryExistsForDotId(dotId) {
    return loadEntries().some(function (entry) { return entry.dotId === dotId; });
  }

  // dotId: the field dot this entry links to (see the schema comment
  // above) — "#11780", "s4_name_01".."09", or null if this entry has no
  // corresponding dot. color/x/y/note are decided once, right here, and
  // persisted — never recomputed later.
  //
  // BUGFIX: color used to always be an independently-randomized value
  // (randomBoardColor()), completely unrelated to whatever color
  // resolveNamedDot() had already picked for the linked dot itself — the
  // two never matched, so a dot never visually showed "its stored [board]
  // color" at all, hover or otherwise. Fixed by making the dot's own
  // already-resolved color (read via Field.getResolvedColor()) the
  // canonical value the board entry inherits, falling back to a fresh
  // random one only when there's no resolved dot to read from (no dotId,
  // no matching dot, or called before that dot's own resolveNamedDot()
  // has run). Every call site that both resolves a dot and adds its entry
  // must therefore resolve first, then addEntry — see runNameMoment's
  // click handler and initStage5's onWriteStory below.
  // Returns the newly-created entry (including its frozen color/
  // finalSceneDotIndex/etc.) so callers can drive the new final scene's
  // intro sequence off it directly — see initStage5 below.
  //
  // forcedFinalSceneDotIndex (item 3d) — the new popup-based flow's #11780
  // entry always resolves onto the same fixed "placeholder" dot
  // (window.FinalScene.ELEVEN780_PLACEHOLDER_DOT_INDEX), not the next
  // sequential slot computeNextFinalSceneDotIndex() would otherwise hand
  // out, since the visitor's given name/story is meant to attach to one
  // specific, always-the-same dot near the scene's center every time this
  // triggers, across every run. Omitted (undefined) by every other caller,
  // which keeps their normal sequential-assignment behavior unchanged.
  function addEntry(dotId, name, story, isAnonymous, forcedFinalSceneDotIndex) {
    var entries = loadEntries();
    var pos = randomBoardPosition();
    var resolvedColor = (!isAnonymous && dotId && window.Field && window.Field.getResolvedColor)
      ? window.Field.getResolvedColor(dotId)
      : null;
    var newEntry = {
      dotId: dotId || null,
      name: name,
      story: story,
      anonymous: !!isAnonymous,
      color: isAnonymous ? COLLECTIVE_BOARD_ANONYMOUS_COLOR : (resolvedColor || randomBoardColor()),
      x: pos.x,
      y: pos.y,
      note: isAnonymous ? null : randomBoardNote(),
      finalSceneDotIndex: (typeof forcedFinalSceneDotIndex === "number")
        ? forcedFinalSceneDotIndex
        : computeNextFinalSceneDotIndex(entries)
    };
    entries.push(newEntry);
    try {
      window.localStorage.setItem(ENTRIES_STORAGE_KEY, JSON.stringify(entries));
    } catch (err) {
      // Storage unavailable/full — fail silently, nothing else to do here.
    }
    return newEntry;
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
  // queue. #11780 isn't part of that queue at all — it's already been
  // activated and resolved by its own dedicated triggers back in
  // stage3.js's runNameThemMoment (s3_mom_12's "search" and "Call them by
  // name" ctas), well before this screen is ever reached.
  //
  // LEGACY (old board) ONLY as of item 3's redesign — reached only when
  // USE_NEW_FINAL_SCENE is false (see initStage5 below), so flipping that
  // flag back stays a clean, complete rollback to the exact old
  // choice -> form/anonymous -> board flow, unchanged. The current
  // default (USE_NEW_FINAL_SCENE = true) path uses runElevenExploreMoment
  // instead — same title/subtext, but a single "Explore to get more" CTA
  // rather than this screen's two-way branch, since that choice now
  // happens later, inline on the dot itself (see activateEleven780Target).
  function runElevenChoiceMoment(containerEl, onWriteStory, onReadOnly) {
    containerEl.innerHTML = "";
    var boxEl = STS.createMomentContentBox(containerEl, "moment-content-box--s5-choice");

    var titleEl = document.createElement("p");
    titleEl.className = "frame__title";
    boxEl.appendChild(titleEl);

    var subtextEl = document.createElement("p");
    subtextEl.className = "frame__body";
    boxEl.appendChild(subtextEl);

    var actionEl = document.createElement("div");
    actionEl.className = "message-moment__action stage-5__choice-action";
    boxEl.appendChild(actionEl);

    function showButtons() {
      var primaryBtn = document.createElement("button");
      primaryBtn.type = "button";
      primaryBtn.className = "button message-moment__button";
      primaryBtn.textContent = "Let me be the one who speaks for them";
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
        "Though #11780 was eventually reclaimed by those who loved them, they became the symbol of all those the regime tried to erase and silence. But no blackout can extinguish them—as long as someone is here to call them out of the silence.",
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
  //
  // LEGACY (old board) ONLY, same as runElevenChoiceMoment above — the
  // current default path no longer runs this screen at all (item 3
  // explicitly removes it there); the inline editor (see
  // activateEleven780Target) covers the same name/story input, triggered
  // later during exploration instead of immediately after the choice
  // screen.
  function runElevenFormMoment(containerEl, onSubmit) {
    containerEl.innerHTML = "";
    var boxEl = STS.createMomentContentBox(containerEl, "moment-content-box--s5-form");

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

    slideElIntoView(boxEl, nameFieldWrap, "stage-5__field--enter", function () {
      slideElIntoView(boxEl, recallFieldWrap, "stage-5__field--enter", function () {
        slideElIntoView(boxEl, actionEl, "stage-5__submit-action--enter", function () {
          STS.presentCtaButton(button);
        });
      });
    });
  }

  // s4_mom_22, item 3's redesigned new-scene flow (USE_NEW_FINAL_SCENE
  // default path) — same "#11780" title/subtext as the legacy
  // runElevenChoiceMoment above, but a single CTA instead of a two-way
  // branch: this screen no longer decides write-a-story vs read-only
  // itself. That choice happens later, inline on the dot itself (see
  // activateEleven780Target), once the visitor has actually spent some
  // time with the scene. By the time this screen shows, the scene's dot
  // pattern is already visible on the field (see initStage5) — just not
  // interactive yet; onExplore is what turns interactivity on.
  function runElevenExploreMoment(containerEl, onExplore) {
    containerEl.innerHTML = "";
    var boxEl = STS.createMomentContentBox(containerEl, "moment-content-box--s5-choice");

    var titleEl = document.createElement("p");
    titleEl.className = "frame__title";
    boxEl.appendChild(titleEl);

    var subtextEl = document.createElement("p");
    subtextEl.className = "frame__body";
    boxEl.appendChild(subtextEl);

    var actionEl = document.createElement("div");
    actionEl.className = "message-moment__action";
    boxEl.appendChild(actionEl);

    function showButton() {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "button message-moment__button";
      button.textContent = "Explore to get more";
      STS.bindTapAndClick(button, onExplore);
      actionEl.appendChild(button);
      STS.presentCtaButton(button);
    }

    STS.typeText(titleEl, "#11780", STAGE_4_CHARS_PER_SECOND, function () {
      STS.typeText(
        subtextEl,
        "Though #11780 was eventually reclaimed by those who loved them, they became the symbol of all those the regime tried to erase and silence. But no blackout can extinguish them—as long as someone is here to call them out of the silence.",
        STAGE_4_CHARS_PER_SECOND,
        showButton
      );
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

  // Color/position/note are each decided exactly once, by addEntry() (or
  // by ensureEntryDisplayFields() backfilling an older entry) — every one
  // of these is called at most once per entry, ever, not on every render.
  function randomBoardColor() {
    var hue = Math.floor(Math.random() * 360);
    return "hsl(" + hue + ", " + COLLECTIVE_BOARD_NAME_SATURATION + "%, " + COLLECTIVE_BOARD_NAME_LIGHTNESS + "%)";
  }

  function randomBoardPosition() {
    return {
      x: COLLECTIVE_BOARD_EDGE_MARGIN_PERCENT + Math.random() * (100 - COLLECTIVE_BOARD_EDGE_MARGIN_PERCENT * 2),
      y: COLLECTIVE_BOARD_EDGE_MARGIN_PERCENT + Math.random() * (100 - COLLECTIVE_BOARD_EDGE_MARGIN_PERCENT * 2)
    };
  }

  function randomBoardNote() {
    var noteIndex = Math.floor(Math.random() * COLLECTIVE_BOARD_NOTE_FREQUENCIES.length);
    return COLLECTIVE_BOARD_NOTE_FREQUENCIES[noteIndex];
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
    var activeDotId = null; // mirrors whichever entry's Field.showNameTooltip is currently active, if any

    function hideTooltip() {
      tooltipEl.hidden = true;
      tooltipEl.textContent = "";
      if (activeNameEl) {
        activeNameEl.classList.remove("collective-board__name--active");
        activeNameEl = null;
      }
      if (activeDotId && window.Field) {
        window.Field.hideNameTooltip(activeDotId);
      }
      activeDotId = null;
    }

    // entry carries everything frozen at write time (color/x/y/note — see
    // addEntry()), so this only ever reads, never recomputes.
    function showTooltip(nameEl, entry) {
      // Only actually a new activation (and thus a note/field reveal) if
      // this name wasn't already the active one — keeps a redundant click
      // on an already-hovered name (mouseenter already fired) from
      // double-playing.
      var isNewActivation = activeNameEl !== nameEl;

      if (activeNameEl) {
        activeNameEl.classList.remove("collective-board__name--active");
      }
      activeNameEl = nameEl;
      nameEl.classList.add("collective-board__name--active");
      tooltipEl.textContent = entry.story || "";
      tooltipEl.hidden = false;
      positionTooltipNear(tooltipEl, nameEl);

      if (isNewActivation) {
        playCollectiveBoardNote(entry.note);
        if (entry.dotId && window.Field) {
          activeDotId = entry.dotId;
          window.Field.showNameTooltip(entry.dotId, entry.name, entry.story);
        }
      }
    }

    loadEntries().forEach(function (entry) {
      var nameEl = document.createElement("span");
      nameEl.className = "collective-board__name";
      nameEl.textContent = entry.name;
      nameEl.style.color = entry.color;
      nameEl.style.left = entry.x + "%";
      nameEl.style.top = entry.y + "%";

      // Desktop hover.
      nameEl.addEventListener("mouseenter", function () {
        showTooltip(nameEl, entry);
      });
      nameEl.addEventListener("mouseleave", hideTooltip);

      // Touch tap (also fires for a mouse click, which is harmless —
      // mouseenter already shows it in that case). stopPropagation keeps
      // this from immediately re-triggering the document "tap elsewhere"
      // handler below.
      nameEl.addEventListener("click", function (event) {
        event.stopPropagation();
        showTooltip(nameEl, entry);
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

  /* ------------------------------------------------------------------
     New shared final scene (js/final-scene.js) — a separate, independently
     toggleable path from the old collective board above (see
     USE_NEW_FINAL_SCENE and initStage5() below). Every assigned dot's
     color/story comes straight from the same entries registry addEntry()
     already writes to; this just also drives a second, frame-side canvas
     renderer instance (field.js owns the #field-canvas one) with the same
     assignment list.
     ------------------------------------------------------------------ */
  var finalSceneRendererInstance = null;
  var finalSceneInteractionsWired = false;

  function getFinalSceneRenderer() {
    if (!finalSceneRendererInstance) {
      var canvasEl = document.getElementById("stage-5-final-scene-canvas");
      finalSceneRendererInstance = window.FinalScene.createRenderer(canvasEl);
      finalSceneRendererInstance.init();
    }
    return finalSceneRendererInstance;
  }

  // The full current assignment list, straight from the registry — every
  // entry that has a finalSceneDotIndex (all of them, after loadEntries()'s
  // own backfill) gets its dot colored on both canvases.
  function computeFinalSceneAssignments() {
    return loadEntries()
      .filter(function (entry) { return typeof entry.finalSceneDotIndex === "number"; })
      .map(function (entry) { return { dotIndex: entry.finalSceneDotIndex, color: entry.color }; });
  }

  // Item 2 — hover (mouse) and tap (touch/click) on the frame-side canvas,
  // two-tier: entering a dot (hover, or touch's own first tap) always
  // shows tier 1 (name + "interact again" icon) only; an explicit click on
  // the SAME already-active dot advances to tier 2 (name + story). Moving
  // the cursor off a dot's hit area clears the hover state immediately
  // (mousemove's own dotIndex===null branch, plus a canvas "mouseleave" for
  // when the cursor exits the canvas entirely without a trailing mousemove)
  // — the tooltip/name/story/note must never keep showing once the cursor
  // isn't actually over the dot anymore. An explicit click/tap on empty
  // space or a different dot also clears it (see the click handler below).
  // Feature — a dot with no entry at all ("anonymous": no name, no story,
  // no color, no note — plain unassigned background) offers the unclaimed-
  // slot editor on hover/first-tap too, same as the missing-field case
  // just above it; nothing is recorded unless the visitor actually submits
  // a name/story (see onNewDotSubmit, and hitTestAnyDotAt in
  // final-scene.js).
  // onDistinctDotRevealed(dotIndex) fires once per dot the first time it's
  // ever revealed this run — beginFinalSceneExploration uses it to count
  // toward the popup's hover-count trigger. Wired once; entryAt() re-reads
  // the registry on every call since new entries (the visitor's own,
  // written mid-exploration by the popup) CAN appear after this point now
  // (unlike the old linear flow this replaces), so a one-time cache here
  // would go stale.
  // Item 7 (bug fix, round 2) — lets activateEleven780Target() reset
  // whatever dot is currently mid-reveal the instant #11780 activates,
  // without needing to know which dot that is itself
  // (wireFinalSceneInteractions' own activeDotIndex is private to its
  // closure) — set once, below.
  var finalSceneResetActiveInteractionFn = null;

  function wireFinalSceneInteractions(renderer, canvasEl, onDistinctDotRevealed) {
    if (finalSceneInteractionsWired) return;
    finalSceneInteractionsWired = true;

    var activeDotIndex = null;
    var activeTier = 0;

    // Multiple entries can share the same finalSceneDotIndex now (see
    // addEntry's forcedFinalSceneDotIndex doc comment — every run's #11780
    // submission reuses the same fixed placeholder dot, and past runs'
    // entries for it are never deleted from localStorage), so this must
    // return the LAST match (the current run's), not the first/oldest.
    function entryAt(dotIndex) {
      var found = null;
      loadEntries().forEach(function (entry) {
        if (entry.finalSceneDotIndex === dotIndex) found = entry;
      });
      return found;
    }

    // Round 7 — "missing story only" / "missing name only": unlike the
    // fully-unnamed case (which activates on a SECOND click, since tier
    // 1's own hover already served as its prompt — see reveal()'s
    // placeholder substitution), these skip the tier system entirely and
    // activate straight into the dedicated editor's "prompt" on first
    // hover/tap — there's no "are you sure" gate needed since the dot
    // already has one real, committed value. hideActive() first in case
    // some OTHER dot's tier-1/2 tooltip was already showing, so the two
    // panels never overlap. Returns true if it activated either mode,
    // false if this entry is already fully resolved (nothing to offer).
    //
    // Bug fix (round 8, item 1) — passes entry.note through as
    // noteFrequency now, so the "first reveal plays the note" rule
    // actually applies here too (this entry already HAS a real note,
    // assigned back when it was first given a name or story — see
    // addEntry — but showInlineEditorPrompt used to always be told null
    // regardless, so it silently never played).
    //
    // Deliberately NOT gated on otherDotsNamingUnlocked (unlike the
    // fully-unnamed case's own call sites below) — see this round's own
    // notes: a dot can only ever REACH "missing story/name only" shape
    // via a prior #11780 (or other-dot) resolution, in this run or an
    // earlier one, so its own shape is already sufficient proof it's
    // eligible; gating it on THIS run's #11780 state would leave an
    // already-partial dot from a past run stuck showing nothing (name/
    // story blank, no placeholder) until #11780 happens to resolve again
    // this run — the exact "placeholder went missing" bug being fixed
    // here (item 3).
    function tryActivateMissingFieldEditor(dotIndex, entry) {
      if (isMissingStoryOnly(entry)) {
        hideActive();
        activateInlineEditor(dotIndex, {
          nameEditable: false, nameText: entry.name,
          storyEditable: true, storyText: INLINE_EDITOR_STORY_PLACEHOLDER,
          onSubmit: onOtherDotStoryOnlySubmit, onAbandon: null,
          noteFrequency: entry.note
        });
        showInlineEditorPrompt();
        return true;
      }
      if (isMissingNameOnly(entry)) {
        hideActive();
        activateInlineEditor(dotIndex, {
          nameEditable: true, nameText: INLINE_EDITOR_NAME_PLACEHOLDER,
          storyEditable: false, storyText: entry.story,
          onSubmit: onOtherDotNameOnlySubmit, onAbandon: null,
          noteFrequency: entry.note
        });
        showInlineEditorPrompt();
        return true;
      }
      return false;
    }

    function reveal(dotIndex, tier) {
      var entry = entryAt(dotIndex);
      if (!entry) return;
      var isNewDot = dotIndex !== activeDotIndex;
      activeDotIndex = dotIndex;
      activeTier = tier;

      // Item 5 (round 5) — once unlocked, a fully unnamed/anonymous dot
      // shows the same unified placeholders (round 6) as #11780's own
      // prompt instead of its real (blank, or literally "Anonymous")
      // content — this tier-1 reveal doubles as that dot's own "prompt"
      // step, so its second click below jumps straight to "editing"
      // rather than showing a separate prompt state of its own. A
      // "missing story only" dot (round 6) never reaches this function at
      // all — see the mousemove/handleActivationAt branches below, which
      // route it straight to the dedicated editor's own "prompt" instead,
      // since its real name has nothing to gate behind a reveal.
      var displayName = entry.name;
      var displayStory = entry.story;
      if (otherDotsNamingUnlocked && isUnnamedFinalSceneEntry(entry)) {
        displayName = INLINE_EDITOR_NAME_PLACEHOLDER;
        displayStory = INLINE_EDITOR_STORY_PLACEHOLDER;
      }

      renderer.showTooltip(dotIndex, displayName, displayStory, tier);
      // Sound only ever actually plays on the field side — see field.js's
      // showFinalSceneTooltip/maybePlayFinalSceneNote, gated there on
      // screenMode, not here. Only tier 1 (the first reveal) ever passes a
      // note — advancing to tier 2 on an already-active dot doesn't
      // re-trigger it.
      if (window.Field) {
        window.Field.showFinalSceneTooltip(dotIndex, displayName, displayStory, tier === 1 ? entry.note : null);
      }
      if (isNewDot && onDistinctDotRevealed) onDistinctDotRevealed(dotIndex);
    }

    function hideActive() {
      if (activeDotIndex === null) return;
      renderer.hideTooltip(activeDotIndex);
      if (window.Field) window.Field.hideFinalSceneTooltip(activeDotIndex);
      activeDotIndex = null;
      activeTier = 0;
    }

    finalSceneResetActiveInteractionFn = hideActive; // item 7 — see its own doc comment above

    // Item 4/5 (round 5) — the single decision point for every click/tap
    // on the canvas, in canvas-local coordinates so it can be driven from
    // either a real touchend or the browser's later synthetic click (see
    // the listeners below). If the inline editor (shared by #11780 and,
    // once unlocked, any other dot — see stage4-5.js's activateInlineEditor)
    // is currently targeting something, it owns this click entirely:
    // hitting its own target advances/submits it, hitting anything else
    // abandons it (item 4). hitTestHighlightedDotAt covers #11780 (no
    // registry entry yet, so hitTestDotAt alone would never find it);
    // hitTestDotAt covers an already-assigned "other" dot mid-edit.
    function handleActivationAt(canvasX, canvasY) {
      // Bug fix (round 5) — only while the editor is actually SHOWING
      // (prompt/editing) does it own every click; while merely "hidden"
      // (activated but never yet hovered/tapped — very plausible right
      // after the 15s/9-hover trigger fires, if the visitor's attention
      // is elsewhere), a click elsewhere must NOT immediately abandon
      // something the visitor hasn't even noticed yet, and must still
      // fall through to the regular tier system below for whatever was
      // actually clicked.
      if (inlineEditorTargetDotIndex !== null && inlineEditorState !== "hidden") {
        var hitsInlineTarget = renderer.hitTestHighlightedDotAt(canvasX, canvasY) ||
          renderer.hitTestDotAt(canvasX, canvasY) === inlineEditorTargetDotIndex;
        if (hitsInlineTarget) {
          if (inlineEditorState === "editing") {
            submitOrAbandonInlineEditor();
          } else {
            showInlineEditorEditing();
          }
        } else {
          abandonInlineEditor();
        }
        return;
      }

      // Still "hidden" — a click/tap landing exactly on it now is the
      // touch equivalent of hover (see the mousemove handler below):
      // advance to "prompt", the first of the three steps.
      if (inlineEditorTargetDotIndex !== null && renderer.hitTestHighlightedDotAt(canvasX, canvasY)) {
        showInlineEditorPrompt();
        return;
      }

      var dotIndex = renderer.hitTestDotAt(canvasX, canvasY);
      if (dotIndex === null) {
        // Feature — touch's own version of the mousemove handler's
        // anonymous-dot check below: a tap landing within an entry-less
        // dot's hit area, with no assigned dot to explain it, offers the
        // same unclaimed-slot editor (first tap = hover equivalent, same
        // as the missing-field case above).
        var anonymousDotIndex = renderer.hitTestAnyDotAt(canvasX, canvasY);
        if (anonymousDotIndex !== null) {
          hideActive();
          activateInlineEditor(anonymousDotIndex, {
            nameEditable: true, nameText: INLINE_EDITOR_NAME_PLACEHOLDER,
            storyEditable: true, storyText: INLINE_EDITOR_STORY_PLACEHOLDER,
            onSubmit: onNewDotSubmit, onAbandon: null
          });
          showInlineEditorPrompt();
        } else {
          hideActive(); // click/tap on empty space
        }
      } else if (dotIndex === activeDotIndex) {
        if (activeTier < 2) {
          var entry = entryAt(dotIndex);
          if (otherDotsNamingUnlocked && entry && isUnnamedFinalSceneEntry(entry)) {
            hideActive(); // this dot's own tooltip already showed the placeholders (tier 1, above) — the inline editor's panel takes over from here
            activateInlineEditor(dotIndex, {
              nameEditable: true, nameText: INLINE_EDITOR_NAME_PLACEHOLDER,
              storyEditable: true, storyText: INLINE_EDITOR_STORY_PLACEHOLDER,
              onSubmit: onOtherDotSubmit, onAbandon: onOtherDotAbandon
            });
            showInlineEditorEditing();
          } else {
            reveal(dotIndex, 2); // second click/tap on the same dot -> story
          }
        }
      } else {
        // Round 6/7 — a "missing story only" or "missing name only" dot
        // skips the regular tier-1 reveal entirely and activates the
        // dedicated editor's "prompt" state directly — touch's own
        // version of the mousemove handler's identical check below,
        // since touch has no separate hover to catch it there. Not
        // gated on otherDotsNamingUnlocked (unlike the fully-unnamed
        // branch above) — see tryActivateMissingFieldEditor's own doc
        // comment (round 8, item 3) for why.
        var missingFieldEntry = entryAt(dotIndex);
        if (!missingFieldEntry || !tryActivateMissingFieldEditor(dotIndex, missingFieldEntry)) {
          reveal(dotIndex, 1); // touch's own first tap on a not-yet-active dot
        }
      }
    }

    // Item 3 (round 5) — runs from touchend directly (suppressing the
    // following synthetic click, same pattern as shared.js's
    // STS.bindTapAndClick) instead of only the browser's later synthetic
    // click, so showInlineEditorEditing()'s input.focus() call stays
    // inside the original touch gesture's call stack — mobile browsers
    // often only reliably bring up the on-screen keyboard when focus()
    // runs synchronously off the real touch event, not a delayed
    // synthetic click. Every click-driven transition here goes through
    // this same path now, not just the editing one, so touch response is
    // consistently immediate rather than waiting on the synthetic click.
    var suppressNextClick = false;

    canvasEl.addEventListener("touchend", function (event) {
      var touch = event.changedTouches && event.changedTouches[0];
      if (!touch) return;
      suppressNextClick = true;
      var rect = canvasEl.getBoundingClientRect();
      handleActivationAt(touch.clientX - rect.left, touch.clientY - rect.top);
    });

    canvasEl.addEventListener("click", function (event) {
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }
      var rect = canvasEl.getBoundingClientRect();
      handleActivationAt(event.clientX - rect.left, event.clientY - rect.top);
    });

    canvasEl.addEventListener("mousemove", function (event) {
      var rect = canvasEl.getBoundingClientRect();
      var canvasX = event.clientX - rect.left;
      var canvasY = event.clientY - rect.top;

      // Bug fix (round 5) — while the editor is actively "editing" (a
      // focused <input>, only ever reached via an explicit click), it owns
      // hover: moving away must not disturb it (item 2's rule) or pop up
      // some OTHER dot's tier-1 tooltip while the editor panel is up.
      // "prompt" (a plain hover-triggered glance, not yet clicked into) is
      // deliberately NOT included here any more — see
      // hideInlineEditorPromptOnLeave()'s own doc comment for why it used
      // to be, and the bug that caused.
      if (inlineEditorTargetDotIndex !== null && inlineEditorState === "editing") {
        return;
      }

      // Still hovering the highlighted target (currently only #11780) —
      // keep/re-show its "prompt", the first of the three steps. Anywhere
      // else, falls through below, which now clears it (bug fix) instead
      // of leaving it stuck blocking the rest of the scene.
      if (inlineEditorTargetDotIndex !== null && renderer.hitTestHighlightedDotAt(canvasX, canvasY)) {
        showInlineEditorPrompt();
        return;
      }

      // Bug fix — no longer hovering the highlighted target (if any) and
      // its "prompt" was showing: hide it now rather than leaving it
      // rendered and leaving the mousemove guard above permanently
      // blocking every other dot's hover.
      if (inlineEditorState === "prompt") {
        hideInlineEditorPromptOnLeave();
      }

      var dotIndex = renderer.hitTestDotAt(canvasX, canvasY);
      if (dotIndex === activeDotIndex) return;

      // Bug fix — the cursor left the currently-active dot's hit area
      // (moved to empty canvas space, or to a spot that isn't within any
      // assigned dot's hitRadiusPx). Previously this just fell through
      // with no action, leaving that dot's name/story/note showing
      // indefinitely until some OTHER dot or a click cleared it. Hover
      // must clear the instant it actually ends.
      if (dotIndex === null) {
        // Feature — not an assigned (named/storied) dot, but might still
        // be within an "anonymous" one's hit area: no entry at all yet
        // (no name, no story, no color, no note — the untouched
        // background pattern dots). Offer the same unclaimed-slot editor
        // #11780/unlocked-other-dots already use, on hover alone, same as
        // the missing-field case. No note plays here (noteFrequency is
        // omitted -> null -> maybePlayFinalSceneNote's own gate skips it)
        // since there's nothing recorded yet to have a note.
        var anonymousDotIndex = renderer.hitTestAnyDotAt(canvasX, canvasY);
        if (anonymousDotIndex !== null) {
          hideActive();
          activateInlineEditor(anonymousDotIndex, {
            nameEditable: true, nameText: INLINE_EDITOR_NAME_PLACEHOLDER,
            storyEditable: true, storyText: INLINE_EDITOR_STORY_PLACEHOLDER,
            onSubmit: onNewDotSubmit, onAbandon: null
          });
          showInlineEditorPrompt();
          return;
        }

        hideActive();
        return;
      }

      // Round 6/7 — a "missing story only" or "missing name only" dot
      // (one real value already given, the other blank) skips the
      // regular tier-1 reveal on first hover and goes straight into the
      // dedicated editor's own "prompt" state (the real value shown as
      // plain text, the missing one as a placeholder) — unlike a fully-
      // unnamed dot, there's no "are you sure" gate needed since one
      // value here is already real/committed, so hover alone is enough
      // to invite completing the other. Not gated on
      // otherDotsNamingUnlocked (unlike the fully-unnamed case handled by
      // reveal()'s own placeholder substitution) — see
      // tryActivateMissingFieldEditor's own doc comment (round 8, item 3).
      var missingFieldEntry = entryAt(dotIndex);
      if (missingFieldEntry && tryActivateMissingFieldEditor(dotIndex, missingFieldEntry)) return;

      reveal(dotIndex, 1);
    });

    // Bug fix — mousemove stops firing entirely once the cursor exits the
    // canvas element, so neither the dotIndex===null branch nor the
    // "prompt" clear above ever gets a final call on the way out. A
    // dedicated mouseleave catches exactly that case for both state
    // machines. "editing" (a focused <input>) stays sticky, same as
    // mousemove above — the cursor leaving must not clear it out from
    // under the visitor mid-type.
    canvasEl.addEventListener("mouseleave", function () {
      if (inlineEditorTargetDotIndex !== null && inlineEditorState === "editing") {
        return;
      }
      if (inlineEditorState === "prompt") {
        hideInlineEditorPromptOnLeave();
      }
      hideActive();
    });
  }

  function showCollectiveBoard() {
    var frameEl = document.querySelector("#stage-5 .frame");
    if (frameEl) frameEl.style.display = "none";

    var boardEl = document.getElementById("stage-5-board");
    if (!boardEl) return;
    boardEl.hidden = false;
    renderCollectiveBoard(boardEl);
  }

  // Re-reads the registry and pushes the full current assignment list to
  // both renderers (frame-local + field, which also broadcasts) — used
  // after the popup resolves #11780, same pattern startFinalScene's
  // initial call already established.
  function refreshFinalSceneAssignments() {
    var assignments = computeFinalSceneAssignments();
    getFinalSceneRenderer().setAssignments(assignments);
    if (window.Field) window.Field.setFinalSceneAssignments(assignments);
  }

  // Bug fix (round 2, item 3) — the fixed "#11780 placeholder" dot is a
  // RECURRING slot, not a permanent home for whoever last filled it:
  // right before this run's own visitor claims it (submit OR decline —
  // both "fill" the slot), whichever entry currently occupies it from a
  // PAST run gets moved onto a fresh random dot elsewhere in the pattern
  // first, so it's preserved as a permanent part of the collective scene
  // instead of being silently overwritten (and, on the next app reset,
  // effectively erased from view) the instant this run's own entry claims
  // the same fixed index. No-op if the slot is already empty (first-ever
  // visitor, or a fresh dataset).
  function migrateEleven780PlaceholderOccupant(targetDotIndex) {
    var entries = loadEntries();
    var occupant = null;
    entries.forEach(function (entry) {
      if (entry.finalSceneDotIndex === targetDotIndex) occupant = entry; // last match = current occupant, same reasoning as entryAt() above
    });
    if (!occupant) return;

    var usedIndices = {};
    entries.forEach(function (entry) {
      if (typeof entry.finalSceneDotIndex === "number") usedIndices[entry.finalSceneDotIndex] = true;
    });
    var candidates = [];
    for (var i = 0; i < window.FinalScene.DOT_COUNT; i++) {
      if (!usedIndices[i]) candidates.push(i);
    }
    if (candidates.length === 0) return; // pattern full (300 entries) — leave it rather than losing data

    occupant.finalSceneDotIndex = candidates[Math.floor(Math.random() * candidates.length)];
    try {
      window.localStorage.setItem(ENTRIES_STORAGE_KEY, JSON.stringify(entries));
    } catch (err) {
      // Storage unavailable/full — fails silently, same as every other write in this file.
    }
  }

  /* ------------------------------------------------------------------
     Round 5 — generalized inline editor: one shared mechanism (this
     section) used both by #11780 (round 4's original test, now promoted
     out of "#11780-only" status per this round's item 5) and, once
     unlocked, any other unnamed/anonymous dot. Only one target is ever
     being edited at a time, so a single set of DOM elements/state is
     retargeted per activation rather than keeping one instance per dot.
     No popup, no camera move — keeps the exact same setTargetHighlight
     pulse/ring treatment for whichever dot is currently targeted. Three
     states:
       "hidden"  — just the highlighted, pulsing dot, nothing shown.
       "prompt"  — hover (or touch's first tap) shows this target's two
                   placeholder lines in the dot's normal tooltip position,
                   plus the usual "+" icon on the dot's own coordinates,
                   same as any other dot's tier-1 icon. Only #11780 ever
                   actually reaches this state on its own (see
                   wireFinalSceneInteractions' mousemove handler) — an
                   "other" dot's tier-1 hover (the REGULAR tier system,
                   showing these same placeholders once unlocked — see
                   reveal()) already plays this role, so activating the
                   editor for one jumps straight to "editing".
       "editing" — swaps the two placeholder lines for real inline
                   <input>s (using the same placeholder strings as each
                   input's own `placeholder` attribute). A second
                   click/tap, or pressing Enter in either field, submits
                   whatever was typed — or, if both are still blank,
                   resolves the same as explicitly leaving without
                   submitting (item 4, round 5): the target's own
                   onAbandon callback, always ending up "Anonymous" one
                   way or another. Clicking/tapping elsewhere while
                   "prompt" or "editing" also abandons (see
                   wireFinalSceneInteractions' handleActivationAt).
     Field-side mirror is read-only text via the existing
     Field.showFinalSceneTooltip broadcast (the field window is ambient,
     never directly interactive — see CLAUDE.md's screen-split section);
     the actual <input>s only ever exist on the frame side.
     ------------------------------------------------------------------ */
  var INLINE_EDITOR_OFFSET_Y_PX = 16; // matches final-scene.js's own TOOLTIP_OFFSET_Y_PX

  var inlineEditorTargetDotIndex = null; // set by activateInlineEditor(), cleared once resolved/abandoned
  var inlineEditorState = "hidden"; // "hidden" | "prompt" | "editing"
  var inlineEditorEls = null;
  var inlineEditorNameEditable = true;  // round 6 — false for "missing story only" dots (see activateInlineEditor)
  var inlineEditorStoryEditable = true; // round 7 — false for "missing name only" dots, the mirror case
  var inlineEditorNamePlaceholder = "";  // doubles as "the real, already-given name" when inlineEditorNameEditable is false
  var inlineEditorStoryPlaceholder = ""; // doubles as "the real, already-given story" when inlineEditorStoryEditable is false
  var inlineEditorOnSubmit = null;  // signature depends on which field(s) are editable — see submitOrAbandonInlineEditor
  var inlineEditorOnAbandon = null; // function(dotIndex) — blank submit, or leaving without submitting, when BOTH fields are editable; never called otherwise (nothing to "abandon" when the dot already has a real name or story)
  var inlineEditorNoteFrequency = null; // round 8, item 1 — the dot's already-assigned note (missing story/name only cases); null when there's no entry/note yet (#11780's own first prompt, or a fully unnamed dot)

  // Reuses .final-scene__tooltip's own look (dark blurred panel) and the
  // regular tier-1 icon's classname for visual consistency — a SEPARATE
  // DOM instance from final-scene.js's own tooltip/icon, though, since
  // this one needs real <input>s swapped in for "editing" and that file
  // stays entirely storage/entry-agnostic on purpose (see its own doc
  // comment).
  function getOrCreateInlineEditor() {
    if (inlineEditorEls) return inlineEditorEls;

    var panelEl = document.createElement("div");
    panelEl.className = "final-scene__tooltip final-scene__tooltip--inline-editor"; // round 7, item 3 — see the modifier's own CSS doc comment

    var nameTextEl = document.createElement("p");
    nameTextEl.className = "final-scene__tooltip-name";
    var nameInputEl = document.createElement("input");
    nameInputEl.type = "text";
    nameInputEl.className = "final-scene__inline-editor-input";
    nameInputEl.hidden = true;

    var storyTextEl = document.createElement("p");
    storyTextEl.className = "final-scene__tooltip-story";
    var storyInputEl = document.createElement("input");
    storyInputEl.type = "text";
    storyInputEl.className = "final-scene__inline-editor-input";
    storyInputEl.hidden = true;

    panelEl.appendChild(nameTextEl);
    panelEl.appendChild(nameInputEl);
    panelEl.appendChild(storyTextEl);
    panelEl.appendChild(storyInputEl);
    document.body.appendChild(panelEl);

    // Standalone, same reasoning as final-scene.js's own tooltip icon —
    // needs to sit exactly on the dot's coordinates (not the panel's own
    // offset position below it), which a position:fixed element inside a
    // transformed ancestor (panelEl's own translate()) can't reliably do.
    var iconEl = document.createElement("span");
    iconEl.className = "final-scene__tooltip-icon";
    iconEl.textContent = "+";
    iconEl.hidden = true;
    document.body.appendChild(iconEl);

    // Item 2 (round 5) — Enter submits from either field, same as
    // clicking "+" a second time (including the "blank -> abandon" rule
    // — see submitOrAbandonInlineEditor).
    function onEditorKeydown(event) {
      if (event.key !== "Enter") return;
      event.preventDefault();
      submitOrAbandonInlineEditor();
    }
    nameInputEl.addEventListener("keydown", onEditorKeydown);
    storyInputEl.addEventListener("keydown", onEditorKeydown);

    inlineEditorEls = {
      panelEl: panelEl,
      nameTextEl: nameTextEl,
      nameInputEl: nameInputEl,
      storyTextEl: storyTextEl,
      storyInputEl: storyInputEl,
      iconEl: iconEl
    };
    return inlineEditorEls;
  }

  function positionInlineEditor() {
    var renderer = getFinalSceneRenderer();
    var pos = renderer.getDotScreenPos(inlineEditorTargetDotIndex);
    var els = getOrCreateInlineEditor();
    els.panelEl.style.left = pos.x + "px";
    els.panelEl.style.top = (pos.y + INLINE_EDITOR_OFFSET_Y_PX) + "px";
    els.iconEl.style.left = pos.x + "px";
    els.iconEl.style.top = pos.y + "px";
  }

  function showInlineEditorPrompt() {
    inlineEditorState = "prompt";
    var els = getOrCreateInlineEditor();
    positionInlineEditor();

    els.nameTextEl.textContent = inlineEditorNamePlaceholder;
    els.nameTextEl.hidden = false;
    els.nameInputEl.hidden = true;
    els.storyTextEl.textContent = inlineEditorStoryPlaceholder;
    els.storyTextEl.hidden = false;
    els.storyInputEl.hidden = true;
    els.panelEl.classList.add("final-scene__tooltip--visible");
    els.iconEl.hidden = false;

    if (window.Field) {
      // Bug fix (round 8, item 1) — used to hardcode null here regardless
      // of whether this dot already had a real note (true for "missing
      // story only"/"missing name only" — the entry, and its note, were
      // already assigned on an earlier submission), so the "first reveal
      // plays the note" rule (see reveal()'s own note-gating) silently
      // never applied to this whole prompt path. inlineEditorNoteFrequency
      // is set per activation — see activateInlineEditor's own doc
      // comment and tryActivateMissingFieldEditor above.
      window.Field.showFinalSceneTooltip(inlineEditorTargetDotIndex, inlineEditorNamePlaceholder, inlineEditorStoryPlaceholder, inlineEditorNoteFrequency);
    }
  }

  function showInlineEditorEditing() {
    inlineEditorState = "editing";
    var els = getOrCreateInlineEditor();
    positionInlineEditor();

    // Round 6/7 — a "missing story only" dot's name (or a "missing name
    // only" dot's story — round 7's mirror case) is real and already
    // given, never editable: it stays plain read-only text throughout
    // (inlineEditorNamePlaceholder/inlineEditorStoryPlaceholder double as
    // "the real, already-given value" in that case — see
    // activateInlineEditor's own doc comment); only the field that's
    // actually still missing ever becomes an <input>.
    if (inlineEditorNameEditable) {
      els.nameTextEl.hidden = true;
      els.nameInputEl.hidden = false;
      els.nameInputEl.value = "";
      els.nameInputEl.placeholder = inlineEditorNamePlaceholder;
    } else {
      els.nameTextEl.textContent = inlineEditorNamePlaceholder;
      els.nameTextEl.hidden = false;
      els.nameInputEl.hidden = true;
    }

    if (inlineEditorStoryEditable) {
      els.storyTextEl.hidden = true;
      els.storyInputEl.hidden = false;
      els.storyInputEl.value = "";
      els.storyInputEl.placeholder = inlineEditorStoryPlaceholder;
    } else {
      els.storyTextEl.textContent = inlineEditorStoryPlaceholder;
      els.storyTextEl.hidden = false;
      els.storyInputEl.hidden = true;
    }

    els.panelEl.classList.add("final-scene__tooltip--visible");
    els.iconEl.hidden = false;

    var focusTarget = inlineEditorNameEditable ? els.nameInputEl : (inlineEditorStoryEditable ? els.storyInputEl : null);
    if (focusTarget) focusTarget.focus();

    if (window.Field) {
      // Field side stays read-only text (see this section's own doc
      // comment) — the real value for whichever field isn't editable,
      // otherwise still just the placeholder, since nothing's been typed
      // yet either way.
      window.Field.showFinalSceneTooltip(inlineEditorTargetDotIndex, inlineEditorNamePlaceholder, inlineEditorStoryPlaceholder, null);
    }
  }

  function hideInlineEditor() {
    inlineEditorState = "hidden";
    if (inlineEditorEls) {
      inlineEditorEls.panelEl.classList.remove("final-scene__tooltip--visible");
      inlineEditorEls.iconEl.hidden = true;
    }
    if (window.Field && inlineEditorTargetDotIndex !== null) {
      window.Field.hideFinalSceneTooltip(inlineEditorTargetDotIndex);
    }
  }

  function clearInlineEditorTarget() {
    var renderer = getFinalSceneRenderer();
    renderer.clearTargetHighlight();
    if (window.Field) window.Field.clearFinalSceneTargetHighlight();
    inlineEditorTargetDotIndex = null;
  }

  // Bug fix — the cursor leaving a dot's hover area must hide that dot's
  // name/story text immediately, same rule as the regular reveal()/
  // hideActive() path, but this "prompt" state (round 6/7's missing-story-
  // only/missing-name-only dots, and #11780's own highlighted-target
  // glance) lives in a completely separate state machine
  // (inlineEditorTargetDotIndex/inlineEditorState), which the hideActive()
  // fix never touched — so its panel used to stay rendered indefinitely
  // after hover ended, AND every mousemove handler call above still saw
  // inlineEditorState !== "hidden" and returned immediately, silently
  // blocking every OTHER dot's hover (text and note) until an unrelated
  // click happened to land on/off the stuck target.
  //
  // Only ever called while state is "prompt" (a plain hover-triggered
  // glance) — "editing" (a focused <input>, reached only via an explicit
  // click) stays sticky on purpose, unaffected by hover moving elsewhere.
  //
  // Missing-field dots (onAbandon: null, see tryActivateMissingFieldEditor)
  // have no persistent-invitation semantics of their own — the highlight
  // ring and target index were only ever set up for THIS glance, so they're
  // torn down fully (clearInlineEditorTarget too) leaving zero residual
  // state to interfere with the next dot hovered. #11780's own prompt
  // (onAbandon set) keeps its target/ring — that's a standing invitation
  // independent of any one glance, not something un-hovering it should
  // cancel; only hiding its panel is appropriate here.
  function hideInlineEditorPromptOnLeave() {
    if (inlineEditorState !== "prompt") return;
    hideInlineEditor();
    if (!inlineEditorOnAbandon) {
      clearInlineEditorTarget();
    }
  }

  // Second click/tap on "+", or Enter in either field. Blank submit
  // (item 4, round 5) routes to onAbandon instead of onSubmit — same
  // outcome as never having submitted at all — but ONLY when both fields
  // are editable (#11780, or a fully unnamed/anonymous "other" dot):
  // when just one field is editable (round 6/7's "missing story only" /
  // "missing name only"), there's no "Anonymous" to fall back to — the
  // dot already has a real name or story — so a blank submit there is
  // just a no-op cancel, same as abandonInlineEditor's no-onAbandon case.
  // onSubmit's own signature also differs per mode (see
  // onOtherDotSubmit/onOtherDotStoryOnlySubmit/onOtherDotNameOnlySubmit).
  function submitOrAbandonInlineEditor() {
    var els = getOrCreateInlineEditor();
    var dotIndex = inlineEditorTargetDotIndex;
    var onSubmit = inlineEditorOnSubmit;
    var onAbandon = inlineEditorOnAbandon;
    var nameEditable = inlineEditorNameEditable;
    var storyEditable = inlineEditorStoryEditable;
    var nameValue = nameEditable ? els.nameInputEl.value.trim() : null;
    var storyValue = storyEditable ? els.storyInputEl.value.trim() : null;

    hideInlineEditor();
    clearInlineEditorTarget();

    if (nameEditable && storyEditable) {
      if (nameValue || storyValue) {
        if (onSubmit) onSubmit(dotIndex, nameValue, storyValue);
      } else if (onAbandon) {
        onAbandon(dotIndex);
      }
    } else if (nameEditable) {
      if (nameValue && onSubmit) onSubmit(dotIndex, nameValue);
    } else if (storyEditable) {
      if (storyValue && onSubmit) onSubmit(dotIndex, storyValue);
    }
    refreshFinalSceneAssignments();
  }

  // Item 4 (round 5) — click/tap elsewhere while "prompt" or "editing" is
  // showing abandons it the same way a blank submit does (see above).
  function abandonInlineEditor() {
    var dotIndex = inlineEditorTargetDotIndex;
    var onAbandon = inlineEditorOnAbandon;

    hideInlineEditor();
    clearInlineEditorTarget();

    if (onAbandon) onAbandon(dotIndex);
    refreshFinalSceneAssignments();
  }

  // dotIndex: the target's finalSceneDotIndex — for #11780 always the
  // recurring placeholder index; for an "other" dot, whichever one the
  // visitor's second click (or, for "missing story/name only", first
  // hover) landed on. options: { nameEditable, nameText, storyEditable,
  // storyText, onSubmit, onAbandon, noteFrequency } — an options object
  // rather than more positional params now that both fields can
  // independently be editable or fixed. nameText/storyText: a placeholder
  // string when that field IS editable; the dot's REAL, already-given
  // value when it's NOT (round 6/7 — stays plain read-only text
  // throughout, see showInlineEditorEditing). onSubmit/onAbandon: how
  // that specific target resolves the registry — differs per mode (see
  // onEleven780Submit/onOtherDotSubmit/onOtherDotStoryOnlySubmit/
  // onOtherDotNameOnlySubmit below). noteFrequency (round 8, item 1): the
  // entry's already-assigned note, if any — omitted/null for #11780's own
  // first prompt or a fully-unnamed dot (no entry yet, nothing to play).
  function activateInlineEditor(dotIndex, options) {
    inlineEditorTargetDotIndex = dotIndex;
    inlineEditorNameEditable = options.nameEditable;
    inlineEditorNamePlaceholder = options.nameText;
    inlineEditorStoryEditable = options.storyEditable;
    inlineEditorStoryPlaceholder = options.storyText;
    inlineEditorOnSubmit = options.onSubmit;
    inlineEditorOnAbandon = options.onAbandon;
    inlineEditorNoteFrequency = options.noteFrequency || null;

    var renderer = getFinalSceneRenderer();
    renderer.setTargetHighlight(dotIndex);
    if (window.Field) window.Field.setFinalSceneTargetHighlight(dotIndex);
  }

  // Round 6 — unified placeholder copy, used everywhere an empty name or
  // story field appears: #11780's own prompt, any other fully unnamed/
  // anonymous dot (once unlocked), and a "missing story only" dot's story
  // line. One shared pair rather than a separate copy per case, so the
  // wording can never drift out of sync between them.
  var INLINE_EDITOR_NAME_PLACEHOLDER = "Give them a voice by a name";
  var INLINE_EDITOR_STORY_PLACEHOLDER = "Call them out of the silence by a story";

  /* ------------------------------------------------------------------
     #11780's own configuration of the generalized editor above.
     ------------------------------------------------------------------ */
  function onEleven780Submit(dotIndex, nameValue, storyValue) {
    migrateEleven780PlaceholderOccupant(dotIndex);
    // #11780 is already resolved as a channel dot by this point —
    // stage3.js's runNameThemMoment resolves it back at s3_mom_12's 8th
    // cta ("Call them by name"), well before stage 4 even starts — but
    // that's a different dot in a different system (field.js's channel
    // scene); this entry is about the NEW final scene's own fixed
    // placeholder dot, so addEntry() gets no resolvedColor to read and
    // just randomizes its own color, same as every s4_name_01..09 entry
    // effectively would if it had no linked channel dot.
    var entry = addEntry("#11780", nameValue, storyValue, false, dotIndex);
    if (PERSIST_OWN_ENTRY_LABEL && entry.name) {
      var renderer = getFinalSceneRenderer();
      renderer.setPersistentLabel(dotIndex, entry.name);
      if (window.Field) window.Field.setFinalScenePersistentLabel(dotIndex, entry.name);
    }
    otherDotsNamingUnlocked = true; // item 5 — see its own doc comment below
  }

  // Item 4 (round 5) — blank submit or leaving without submitting: same
  // gray "Anonymous" entry the old decline button used to write, still
  // going through the recurring-slot migration first (a leftover
  // occupant is still possible in principle, even after item 1's
  // proactive migration at run-start — e.g. another abandon earlier this
  // same run).
  function onEleven780Abandon(dotIndex) {
    migrateEleven780PlaceholderOccupant(dotIndex);
    addEntry("#11780", "Anonymous", "", true, dotIndex);
    otherDotsNamingUnlocked = true; // item 5 — see its own doc comment below
  }

  // Called once, when the 15s/9-hover trigger fires (see
  // beginFinalSceneExploration). No dynamic repositioning needed here —
  // that was only ever about dodging round 2's old popup panel (round 3,
  // item 1), which this mechanism has no equivalent of — so it's always
  // the plain fixed "nearest to center" index.
  function activateEleven780Target() {
    // Item 7 (bug fix, round 2) — whatever dot was mid-reveal right as
    // #11780 activates (very plausible: the hover-count trigger fires
    // exactly *during* a hover) gets reset back to hidden first, so it's
    // never showing alongside the newly-highlighted #11780 dot.
    if (finalSceneResetActiveInteractionFn) finalSceneResetActiveInteractionFn();

    activateInlineEditor(window.FinalScene.ELEVEN780_PLACEHOLDER_DOT_INDEX, {
      nameEditable: true,
      nameText: INLINE_EDITOR_NAME_PLACEHOLDER,
      storyEditable: true,
      storyText: INLINE_EDITOR_STORY_PLACEHOLDER,
      onSubmit: onEleven780Submit,
      onAbandon: onEleven780Abandon
    });
  }

  /* ------------------------------------------------------------------
     Item 5 (round 5) — the same generalized editor, applied to every
     OTHER unnamed/anonymous dot, unlocked only once #11780 itself has
     resolved (submit or abandon — see onEleven780Submit/onEleven780Abandon
     above). Activation itself happens from wireFinalSceneInteractions'
     own tier1->tier2 click transition (that dot's tier-1 hover already
     doubles as this editor's "prompt" step — see reveal()'s placeholder
     substitution there), not from a dedicated trigger of its own.
     ------------------------------------------------------------------ */
  var otherDotsNamingUnlocked = false;

  // Round 7 fix — narrowed to BOTH fields blank (or explicitly
  // anonymous): used to also catch "has a story but no name" here, which
  // silently routed that case through the "offer both fields" flow below
  // instead of the dedicated "missing name only" one (see
  // isMissingNameOnly) that actually matches it.
  function isUnnamedFinalSceneEntry(entry) {
    return !!entry.anonymous || (!entry.name && !entry.story);
  }

  // Round 6 — a dot that already has a real name (and thus already has
  // its own color/note — see addEntry) but was submitted with no story.
  // Deliberately excludes anonymous entries (name is literally
  // "Anonymous", not a real given name) — those stay in the fully-
  // unnamed bucket above, offering both fields, not just this one.
  function isMissingStoryOnly(entry) {
    return !entry.anonymous && !!entry.name && !entry.story;
  }

  // Round 7 — the mirror case: a real story already given, but no name
  // yet (e.g. #11780 resolved with only a story typed in — see item 5's
  // state machine). Same reasoning as isMissingStoryOnly above, just the
  // other field.
  function isMissingNameOnly(entry) {
    return !entry.anonymous && !entry.name && !!entry.story;
  }

  // Edits the existing entry IN PLACE — unlike #11780, this dot doesn't
  // move or get a new slot, it just finally has a name/story attached.
  // Gets a real color/note now too if it was anonymous (an anonymous
  // entry has neither — see addEntry's isAnonymous branch — and "gray
  // but now named" isn't a state this scene has any visual language
  // for); a blank-name-but-already-colored entry keeps its existing
  // color/note untouched.
  function updateEntryAtFinalSceneDotIndex(dotIndex, name, story) {
    var entries = loadEntries();
    var target = null;
    entries.forEach(function (entry) {
      if (entry.finalSceneDotIndex === dotIndex) target = entry; // last match, same reasoning as entryAt()/migrateEleven780PlaceholderOccupant elsewhere
    });
    if (!target) return null;

    if (target.anonymous) {
      target.color = randomBoardColor();
      target.note = randomBoardNote();
    }
    target.name = name;
    target.story = story;
    target.anonymous = false;

    try {
      window.localStorage.setItem(ENTRIES_STORAGE_KEY, JSON.stringify(entries));
    } catch (err) {
      // Storage unavailable/full — fails silently, same as every other write in this file.
    }
    return target;
  }

  // Item 4 (round 5), applied to an "other" dot: blank submit or leaving
  // without submitting resets it to the standard gray "Anonymous" shape
  // in place — whatever it was before (blank-name-but-colored, or
  // already anonymous) ends up the same regardless.
  function resolveEntryAnonymousAtFinalSceneDotIndex(dotIndex) {
    var entries = loadEntries();
    var target = null;
    entries.forEach(function (entry) {
      if (entry.finalSceneDotIndex === dotIndex) target = entry;
    });
    if (!target) return;

    target.anonymous = true;
    target.name = "Anonymous";
    target.story = "";
    target.color = COLLECTIVE_BOARD_ANONYMOUS_COLOR;
    target.note = null;

    try {
      window.localStorage.setItem(ENTRIES_STORAGE_KEY, JSON.stringify(entries));
    } catch (err) {
      // Storage unavailable/full — fails silently, same as every other write in this file.
    }
  }

  function onOtherDotSubmit(dotIndex, nameValue, storyValue) {
    updateEntryAtFinalSceneDotIndex(dotIndex, nameValue, storyValue);
  }

  function onOtherDotAbandon(dotIndex) {
    resolveEntryAnonymousAtFinalSceneDotIndex(dotIndex);
  }

  // Feature — a genuinely "anonymous" dot: no entry at all yet (unlike
  // isUnnamedFinalSceneEntry's dots above, which already exist in the
  // registry as a blank/"Anonymous" entry — these are the untouched
  // background pattern dots, no name/story/color/note because nothing has
  // ever been written for them). No onAbandon counterpart here, on
  // purpose — see the mousemove/handleActivationAt call sites: leaving
  // without typing anything must leave zero trace, not create a new
  // registry entry just because the visitor glanced at a random dot.
  // dotId is null (same as every other final-scene-only entry not linked
  // back to the old field.js channel scene — see addEntry's own doc
  // comment) and forcedFinalSceneDotIndex is this exact dot, not the next
  // sequential slot, since the visitor picked it themselves by hovering it.
  function onNewDotSubmit(dotIndex, nameValue, storyValue) {
    addEntry(null, nameValue, storyValue, false, dotIndex);
  }

  // Round 6 — "missing story only": the dot already has a real name (and
  // its own color/note), so only the story is ever written here — name,
  // color, note, anonymous all stay exactly as they already were.
  function updateStoryOnlyAtFinalSceneDotIndex(dotIndex, story) {
    var entries = loadEntries();
    var target = null;
    entries.forEach(function (entry) {
      if (entry.finalSceneDotIndex === dotIndex) target = entry; // last match, same reasoning as entryAt() elsewhere
    });
    if (!target) return null;

    target.story = story;

    try {
      window.localStorage.setItem(ENTRIES_STORAGE_KEY, JSON.stringify(entries));
    } catch (err) {
      // Storage unavailable/full — fails silently, same as every other write in this file.
    }
    return target;
  }

  function onOtherDotStoryOnlySubmit(dotIndex, storyValue) {
    updateStoryOnlyAtFinalSceneDotIndex(dotIndex, storyValue);
  }

  // Round 7 — "missing name only", the mirror of "missing story only"
  // above: the dot already has a real story (and its own color/note), so
  // only the name is ever written here.
  function updateNameOnlyAtFinalSceneDotIndex(dotIndex, name) {
    var entries = loadEntries();
    var target = null;
    entries.forEach(function (entry) {
      if (entry.finalSceneDotIndex === dotIndex) target = entry; // last match, same reasoning as entryAt() elsewhere
    });
    if (!target) return null;

    target.name = name;

    try {
      window.localStorage.setItem(ENTRIES_STORAGE_KEY, JSON.stringify(entries));
    } catch (err) {
      // Storage unavailable/full — fails silently, same as every other write in this file.
    }
    return target;
  }

  function onOtherDotNameOnlySubmit(dotIndex, nameValue) {
    updateNameOnlyAtFinalSceneDotIndex(dotIndex, nameValue);
  }

  // Item 3b/3c — called once, from the "Explore to get more" CTA: swaps
  // the frame's own .frame card out for the interactive final-scene
  // canvas (same swap the old showNewFinalScene used to do, just
  // triggered here instead of at the very end of a longer form flow),
  // wires up hover/tap, and starts the popup-trigger watchers (timer OR
  // distinct-dot-hover count, whichever comes first).
  function beginFinalSceneExploration() {
    var frameEl = document.querySelector("#stage-5 .frame");
    if (frameEl) frameEl.style.display = "none";

    var containerEl = document.getElementById("stage-5-final-scene");
    if (containerEl) containerEl.hidden = false;

    var canvasEl = document.getElementById("stage-5-final-scene-canvas");
    var renderer = getFinalSceneRenderer();
    renderer.setAssignments(computeFinalSceneAssignments());
    // Bug fix (round 2, item 1) — the heartbeat pulse was starting the
    // instant the scene first appeared (well before this CTA), since the
    // renderer's own render loop runs continuously from init(). Now it
    // stays visually static until interactivity actually begins, here.
    renderer.startAnimating();
    if (window.Field) window.Field.startFinalSceneAnimation();

    var eleven780Activated = false;
    var revealedDotIndices = {};
    var revealedCount = 0;
    var eleven780TimerId = null;

    function maybeActivateEleven780() {
      if (eleven780Activated) return;
      eleven780Activated = true;
      if (eleven780TimerId !== null) clearTimeout(eleven780TimerId);
      activateEleven780Target();
    }

    eleven780TimerId = setTimeout(maybeActivateEleven780, FINAL_SCENE_POPUP_TIMER_MS);

    function onDistinctDotRevealed(dotIndex) {
      if (revealedDotIndices[dotIndex]) return;
      revealedDotIndices[dotIndex] = true;
      revealedCount += 1;
      if (revealedCount >= FINAL_SCENE_POPUP_HOVER_THRESHOLD) maybeActivateEleven780();
    }

    wireFinalSceneInteractions(renderer, canvasEl, onDistinctDotRevealed);
  }

  function initStage5() {
    var momentMountEl = document.getElementById("stage-5-moment-mount");

    // Underscore audio is now stopped earlier, at s4_mom_21's "Call them
    // by name" click (see stage4-5.js's runNameMoment) — ahead of this
    // choice screen either way.
    if (!USE_NEW_FINAL_SCENE) {
      // LEGACY (old board) flow — unchanged: choice -> form/anonymous ->
      // board. See runElevenChoiceMoment/runElevenFormMoment's own doc
      // comments for why these stay exactly as they were.
      function goToFinalScreenFrom() {
        momentMountEl.innerHTML = ""; // instant, no fade
        showCollectiveBoard();
      }

      runElevenChoiceMoment(
        momentMountEl,
        function onWriteStory() {
          momentMountEl.innerHTML = ""; // instant, no fade — s4_mom_22 -> s4_mom_23 is its own separate page, not a continuous screen
          runElevenFormMoment(momentMountEl, function onSubmit(nameValue, storyValue) {
            addEntry("#11780", nameValue, storyValue, false);
            goToFinalScreenFrom();
          });
        },
        function onReadOnly() {
          addEntry("#11780", "Anonymous", "", true);
          if (window.Field) window.Field.removeEleven780();
          goToFinalScreenFrom();
        }
      );
      return;
    }

    // Bug fix (round 5, item 1) — root cause: migrateEleven780Placeholder-
    // Occupant() only ever ran from inside the #11780 resolution flow
    // itself (submit/abandon), so a PAST run's occupant kept showing at
    // the fixed placeholder index for this run's ENTIRE exploration, all
    // the way up until (if ever) THIS run's visitor actually resolved
    // #11780 themselves — nothing ran the migration proactively on a
    // fresh run. Running it right here, before the scene's very first
    // assignment snapshot is computed, guarantees #11780 always starts
    // this run already empty/unassigned, with the past occupant already
    // relocated — never a stale identity lingering after a reset.
    migrateEleven780PlaceholderOccupant(window.FinalScene.ELEVEN780_PLACEHOLDER_DOT_INDEX);

    // Item 3 — new popup-based flow (current default). The scene's dot
    // pattern appears on the field immediately, visually present but not
    // yet interactive (no listeners are attached to any canvas until the
    // "Explore to get more" CTA below) and silent (no hover/tap means no
    // note ever plays). #11780 isn't in the assignment list yet — it's
    // still an unassigned, gray dot at this point, same as any other
    // never-yet-resolved dot in the pattern.
    if (window.Field) window.Field.startFinalScene(computeFinalSceneAssignments());

    runElevenExploreMoment(momentMountEl, function onExplore() {
      momentMountEl.innerHTML = ""; // instant, no fade
      beginFinalSceneExploration();
    });
  }

  STS.registerStageEnter(5, initStage5);
})();
