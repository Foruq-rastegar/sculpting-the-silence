/* ==========================================================================
   Sculpting the Silence — bundled seed data for the collective/final-scene
   entries registry (js/stage4-5.js's loadEntries()/ENTRIES_STORAGE_KEY). 15
   hand-written exhibition-testing entries, applied ONLY when localStorage's
   "sculptingTheSilenceEntries" key is genuinely missing or empty — an
   existing registry, even with just one real visitor entry, is never
   touched or overwritten (see loadEntries()'s own seeding check).

   Deliberately a plain <script src> global, not a .json file loaded via
   fetch(): the offline flash-drive build opens index.html via file://
   (see CLAUDE.md's BroadcastChannel doc comment, which required this exact
   setup to be tested), and fetch() of a local file is blocked outright
   under file:// by Chromium's CORS policy ("URL scheme 'file' is not
   supported" — verified). A <script src> tag has no such restriction and
   is how every other JS file in this app already loads, so this works
   identically for the offline build and the GitHub Pages build with no
   build-specific branching.

   Shape matches addEntry()'s own minimal input (dotId, name, story,
   anonymous) — color/x/y/note/finalSceneDotIndex are deliberately omitted
   here and left to loadEntries()'s existing ensureEntryDisplayFields()
   backfill, same as any other legacy-shape entry.

   Must load before js/stage4-5.js.
   ========================================================================== */
window.STS_SEED_ENTRIES = [
  { "dotId": null, "name": "Anonymous", "story": "", "anonymous": true },
  { "dotId": null, "name": "Junas", "story": "He was trying to help his children to get to school.", "anonymous": false },
  { "dotId": null, "name": "Anonymous", "story": "", "anonymous": true },
  { "dotId": null, "name": "John Doe", "story": "Liked being anonymous", "anonymous": false },
  { "dotId": null, "name": "", "story": "She has a rosy cheeks", "anonymous": false },
  { "dotId": null, "name": "Ahmet", "story": "He was going to get married on the next summer", "anonymous": false },
  { "dotId": null, "name": "Sean", "story": "He may just want to finish the novel after school", "anonymous": false },
  { "dotId": null, "name": "Mani", "story": "He was learning German to come here, to me!", "anonymous": false },
  { "dotId": null, "name": "Anonymous", "story": "", "anonymous": true },
  { "dotId": null, "name": "Azadeh", "story": "She loved feeling the wind in her hair", "anonymous": false },
  { "dotId": null, "name": "Anonymous", "story": "", "anonymous": true },
  { "dotId": null, "name": "Kris", "story": "", "anonymous": false },
  { "dotId": null, "name": "Vandal", "story": "He was brave and fearless", "anonymous": false },
  { "dotId": null, "name": "Meher", "story": "Perhaps she was trying to contact her daughter in Europe", "anonymous": false },
  { "dotId": null, "name": "Matin", "story": "He was so tiny for this pain", "anonymous": false }
];
