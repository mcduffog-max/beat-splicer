/* ---------------- Picture ---------------- */
/* ---------------- Frame-accurate engine ----------------
   Each frame is stamped with its exact position in the edit and the soundtrack is rendered sample-exact, then both are
   written straight into the file. Cuts land on the beat, the file starts on the first frame of the edit and runs to the
   exact length. Uses the browser's built-in encoders (WebCodecs) and a small, widely used file writer. */
