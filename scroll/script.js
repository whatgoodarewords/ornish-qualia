/* A Summons for the Unsimulated: mobile scroll preview.
   Two independent parts: the unfurling intro and the Recorder.
   Either may fail without taking the reading page down with it. */

/* ---------------------------------------------------------------- intro --- */
(() => {
  const root = document.documentElement;
  const $ = id => document.getElementById(id);
  const scroll = $("scroll"), sheet = $("sheet"), rollBottom = $("rollBottom"),
        skipBtn = $("skipBtn"), replayBtn = $("replayBtn"), title = $("title");

  const HOLD = 520;      // ms the sealed roll rests before it opens
  const UNFURL = 1950;   // ms of visible unfurling
  const still = () => window.matchMedia &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  let raf = 0, failsafe = 0, holdTimer = 0, running = false;

  // If the paper image cannot load, draw the rolls in CSS instead.
  const probe = new Image();
  probe.onerror = () => root.classList.add("paper-fallback");
  probe.src = "assets/paper.png";

  const set = (k, v) => scroll.style.setProperty(k, v);
  const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  function finish(focusTitle) {
    cancelAnimationFrame(raf);
    clearTimeout(failsafe); clearTimeout(holdTimer);
    clearTimeout(window.__summonsWatchdog); clearTimeout(window.__summonsHardStop);
    running = false;
    root.classList.remove("intro", "unfurling", "measured");
    ["--lift", "--clip", "--dy"].forEach(k => scroll.style.removeProperty(k));
    scroll.firstElementChild.style.clipPath = "";
    rollBottom.style.clipPath = "";
    window.removeEventListener("resize", onResize);
    document.removeEventListener("keydown", onKey);
    if (focusTitle && title) title.focus({ preventScroll: true });
  }

  function onResize() { finish(false); }
  function onKey(e) { if (e.key === "Escape") finish(true); }

  function measure() {
    // Static layout is what the reader ends up with; transforms do not move it.
    set("--lift", "0px");
    const vh = window.innerHeight;
    const topRoll = scroll.firstElementChild;
    const rh = rollBottom.offsetHeight;
    // Curl centres inside each roll element: paper.png geometry (image rows
    // ~92 and ~1432, see style.css) or half the CSS fallback roll.
    const fallback = root.classList.contains("paper-fallback");
    const px = scroll.offsetWidth / 905;
    const topCurl = fallback ? topRoll.offsetHeight / 2 : px * 52;
    const bottomCurl = fallback ? rh / 2 : px * 87;
    const finalBottom = rollBottom.offsetTop;                       // article coords
    const closedBottom = topRoll.offsetTop + topCurl - bottomCurl;  // curl over curl
    const sheetTop = sheet.offsetTop;
    const articleTop = scroll.getBoundingClientRect().top + window.scrollY;
    // Unfurl until the lower curl has just left the screen, then settle the
    // rest (out of sight) in one step: the visible motion keeps its pace.
    const offscreen = vh - articleTop + 4;
    const end = Math.min(finalBottom, Math.max(closedBottom + rh, offscreen));
    const lift = Math.max(0, vh * .42 - (articleTop + topRoll.offsetTop + topCurl));
    // Each curl crop also carries a strip of flat sheet (below the top curl,
    // above the bottom curl). Those strips may only show where the revealed
    // sheet is behind them, or the closed roll grows ghost bands.
    const topH = topRoll.offsetHeight;
    const topCurlBottom = fallback ? topH : px * 94;   // image row ~134
    const bandMid = fallback ? 0 : px * 52;            // image row ~1397: curl top, mid-width
    const bandEnd = fallback ? 0 : px * 18;            // image row ~1363: spiral ends rise higher
    const endW = px * 110, ramp = px * 60, rollW = rollBottom.offsetWidth;
    return { bottomCurl, finalBottom, closedBottom, sheetTop, end, lift,
             topRoll, topH, topCurlBottom, bandMid, bandEnd, endW, ramp, rollW, rh };
  }

  function frame(m, pos, lift) {
    set("--lift", lift.toFixed(1) + "px");
    set("--dy", (pos - m.finalBottom).toFixed(1) + "px");
    const clip = Math.max(0, pos + m.bottomCurl - m.sheetTop);
    set("--clip", clip.toFixed(1) + "px");
    // top roll: hide its sheet strip below the curl until the sheet is there
    const rt = Math.max(0, m.topH - Math.max(m.topCurlBottom, m.sheetTop + clip));
    m.topRoll.style.clipPath = `inset(0 -60px ${rt.toFixed(1)}px -60px)`;
    // bottom roll: hide its sheet strip above the curl where no sheet is behind it
    const gap = Math.max(0, m.sheetTop - pos);
    // Top edge follows the rolled sheet: high at the spiral ends, easing down
    // to the curl top toward the centre with no corners (cubic, flat tangents).
    const mid = Math.min(m.bandMid, gap), end = Math.min(m.bandEnd, gap);
    const w = m.rollW, a = m.endW, c = m.endW + m.ramp * 1.5, h = m.rh + 80;
    const f = n => n.toFixed(1);
    rollBottom.style.clipPath = `path("M -60 ${f(end)} L 0 ${f(end)} ` +
      `C ${f(a)} ${f(end)} ${f(a)} ${f(mid)} ${f(c)} ${f(mid)} L ${f(w - c)} ${f(mid)} ` +
      `C ${f(w - a)} ${f(mid)} ${f(w - a)} ${f(end)} ${f(w)} ${f(end)} ` +
      `L ${f(w + 60)} ${f(end)} L ${f(w + 60)} ${f(h)} L -60 ${f(h)} Z")`;
  }

  function play() {
    if (running) return;
    running = true;
    window.scrollTo(0, 0);
    root.classList.add("intro");
    root.classList.remove("unfurling", "measured");
    window.addEventListener("resize", onResize);
    document.addEventListener("keydown", onKey);
    failsafe = setTimeout(() => finish(false), HOLD + UNFURL + 2500);

    // Wait (briefly) for the type and the closing seal, so what is measured
    // and shown is final; never longer than 900ms.
    const closedSeal = document.getElementById("closedSeal");
    const ready = Promise.all([
      document.fonts && document.fonts.ready,
      closedSeal && closedSeal.decode ? closedSeal.decode().catch(() => {}) : null,
    ]);
    const fontsReady = Promise.race([ready, new Promise(r => setTimeout(r, 900))]);

    fontsReady.then(() => {
      if (!running) return;
      const m = measure();
      frame(m, m.closedBottom, m.lift);
      root.classList.add("measured");
      holdTimer = setTimeout(() => {
        if (!running) return;
        root.classList.add("unfurling");
        const t0 = performance.now();
        const step = now => {
          if (!running) return;
          const t = Math.min(1, (now - t0) / UNFURL);
          const pos = m.closedBottom + (m.end - m.closedBottom) * easeInOut(t);
          const lift = m.lift * (1 - easeOut(Math.min(1, t / .7)));
          frame(m, pos, lift);
          if (t < 1) raf = requestAnimationFrame(step);
          else finish(false);
        };
        raf = requestAnimationFrame(step);
      }, HOLD);
    }).catch(() => finish(false));
  }

  try {
    if (skipBtn) skipBtn.addEventListener("click", () => finish(true));
    if (replayBtn) {
      if (still()) replayBtn.hidden = true;
      replayBtn.addEventListener("click", () => { if (!still()) play(); });
    }
    if (root.classList.contains("intro")) {
      // Take over from the head watchdog; ours runs for the real duration.
      clearTimeout(window.__summonsWatchdog);
      clearTimeout(window.__summonsHardStop);
      running = false;
      play();
    }
  } catch (err) {
    finish(false);
  }
})();

/* ------------------------------------------------------------- backdrop --- */
(() => {
  const KEY = "summons-preview-backdrop";
  const root = document.documentElement;
  const radios = document.querySelectorAll('input[name="backdrop"]');
  let current = root.getAttribute("data-backdrop") || "forest";
  radios.forEach(r => {
    r.checked = r.value === current;
    r.addEventListener("change", () => {
      if (!r.checked) return;
      current = r.value;
      root.setAttribute("data-backdrop", current);
      try { localStorage.setItem(KEY, current); } catch (e) { /* private mode */ }
    });
  });
})();

/* ------------------------------------------------------------- recorder --- */
(() => {
  const LIMIT = 300; // seconds: five Minutes
  const MAILTO = "mailto:concierge@castle.community?subject=Five%20Minutes";

  const $ = id => document.getElementById(id);
  const sealBtn = $("sealBtn"), status = $("recStatus"), trace = $("trace"),
        timeEl = $("recTime"), actions = $("recActions"),
        sendWrap = $("sendWrap"), sendBtn = $("sendBtn"),
        hearBtn = $("hearBtn"), burnBtn = $("burnBtn"), recorder = $("recorder"),
        wax = $("sealImg");
  if (!sealBtn) return;

  // idle | asking | recording | stopping | review | sealed | unavailable
  let state = "idle", gen = 0, discard = false,
      rec = null, stream = null, chunks = [], blob = null, blobUrl = null,
      mime = "", startedAt = 0, elapsed = 0, raf = 0,
      audioCtx = null, analyser = null, player = null;

  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const say = html => { status.innerHTML = html; };
  const PROMPT = '<span class="hand" aria-hidden="true">☞</span> Press the Seal, and speak.';

  function pickMime() {
    if (!window.MediaRecorder) return null;
    for (const m of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"])
      try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) { /* old engines */ }
    return "";
  }
  const supported = () => pickMime() !== null &&
    !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  function unavailable() {
    state = "unavailable";
    sealBtn.disabled = true;
    wax.alt = "Wax seal; no Recorder on this device";
    say("This Machine knows no Recorder. Answer by Letter below.");
  }

  function setBusy(on) {
    if (on) sealBtn.setAttribute("aria-busy", "true");
    else sealBtn.removeAttribute("aria-busy");
  }

  // ---- the trace: one quill line across the five minutes
  let tctx = null, env = null, plotW = 0, plotH = 0;
  function traceSetup() {
    trace.hidden = false;
    const dpr = window.devicePixelRatio || 1;
    const r = trace.getBoundingClientRect();
    plotW = Math.max(1, Math.round(r.width));
    plotH = Math.max(1, Math.round(r.height));
    trace.width = plotW * dpr; trace.height = plotH * dpr;
    tctx = trace.getContext("2d");
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    env = new Float32Array(plotW);
  }
  function traceDraw(head, dried) {
    if (!tctx || !env) return;
    const cy = plotH / 2, hairline = 0.8;
    tctx.clearRect(0, 0, plotW, plotH);
    for (let x = 0; x <= head; x++) {
      const h = Math.max(hairline, env[x] * plotH * 0.94);
      tctx.fillStyle = (!dried && head - x < 9) ? "rgba(163,49,30,.9)" : "rgba(33,26,19,.85)";
      tctx.fillRect(x, cy - h / 2, 1, h);
    }
    if (!dried) {
      tctx.fillStyle = "#a3311e";
      tctx.beginPath();
      tctx.arc(Math.min(head + 1.5, plotW - 2), cy, 2, 0, Math.PI * 2);
      tctx.fill();
    }
  }

  function tick() {
    elapsed = (performance.now() - startedAt) / 1000;
    const left = Math.max(0, LIMIT - elapsed);
    timeEl.textContent = fmt(left);
    let peak = 0;
    if (analyser) {
      const buf = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) {
        const d = (v - 128) / 128;
        sum += d * d;
        const a = d < 0 ? -d : d;
        if (a > peak) peak = a;
      }
      wax.style.setProperty("--lvl", Math.min(1, Math.sqrt(sum / buf.length) * 4).toFixed(3));
    }
    if (env) {
      const head = Math.min(plotW - 1, Math.floor(elapsed / LIMIT * plotW));
      env[head] = Math.max(env[head], Math.min(1, peak * 1.15));
      traceDraw(head, false);
    }
    if (left <= 0) { finish(true); return; }
    raf = requestAnimationFrame(tick);
  }

  // ---- release everything that holds the microphone
  function releaseMic() {
    cancelAnimationFrame(raf);
    if (stream) { stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} }); stream = null; }
    if (audioCtx) { try { audioCtx.close(); } catch (e) {} audioCtx = null; analyser = null; }
  }

  async function begin() {
    if (state !== "idle") return;                 // one request at a time
    if (!supported()) { unavailable(); return; }
    const m = pickMime();
    const my = ++gen;
    state = "asking";
    sealBtn.disabled = true; setBusy(true);

    let s = null;
    try {
      s = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      if (my !== gen) return;
      state = "idle"; sealBtn.disabled = false; setBusy(false);
      const name = err && err.name;
      if (name === "NotFoundError" || name === "OverconstrainedError")
        say("No Microphone answers. Answer by Letter below.");
      else
        say("Your Machine refuses the Recorder. Grant it the Microphone, or answer by Letter below.");
      return;
    }
    // The page was hidden or reset while we waited: give the microphone back.
    if (my !== gen || state !== "asking") { s.getTracks().forEach(t => t.stop()); return; }

    stream = s;
    try {
      mime = m;
      chunks = [];
      discard = false;
      rec = new MediaRecorder(stream, m ? { mimeType: m } : undefined);
      rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = onStopped;
      rec.onerror = () => { discard = true; abort("The Recorder faltered. Press the Seal, and speak, or answer by Letter below."); };
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        audioCtx.createMediaStreamSource(stream).connect(analyser);
      } catch (e) { analyser = null; }
      rec.start();
    } catch (err) {
      rec = null;
      releaseMic();
      state = "idle"; sealBtn.disabled = false; setBusy(false);
      say("The Recorder failed to wake. Answer by Letter below.");
      return;
    }
    state = "recording";
    setBusy(false); sealBtn.disabled = false;
    wax.alt = "Wax seal; press again to stop";
    recorder.classList.add("recording");
    startedAt = performance.now();
    traceSetup();
    timeEl.hidden = false;
    say("The Recorder listens; the Needle writes. Press the Seal again when you are done.");
    raf = requestAnimationFrame(tick);
  }

  function finish(timeUp) {
    if (state !== "recording") return;
    state = "stopping";
    cancelAnimationFrame(raf);
    if (timeUp) say("Time is spent.");
    try { rec.stop(); } catch (e) { abort(); }
  }

  function onStopped() {
    releaseMic();
    recorder.classList.remove("recording");
    wax.style.setProperty("--lvl", 0);
    wax.alt = "Wax seal; press to speak";
    timeEl.hidden = true;
    rec = null;
    if (discard || state !== "stopping") { discard = false; return; }
    if (env) traceDraw(Math.min(plotW - 1, Math.floor(elapsed / LIMIT * plotW)), true);
    if (elapsed < 3 || !chunks.length) { reset("Too brief to judge. Press the Seal, and speak."); return; }
    blob = new Blob(chunks, { type: mime || "audio/webm" });
    blobUrl = URL.createObjectURL(blob);
    player = new Audio(blobUrl);
    player.onended = () => { hearBtn.textContent = "Hear it"; };
    state = "review";
    say(`Your Answer stands at ${fmt(elapsed)}.`);
    actions.hidden = false; sendWrap.hidden = false; sendBtn.disabled = false;
    sealBtn.disabled = true;
  }

  // Tear down any in-flight attempt (asking, recording, stopping).
  function abort(msg) {
    gen++;
    if (rec && rec.state !== "inactive") { discard = true; try { rec.stop(); } catch (e) {} }
    rec = null;
    releaseMic();
    recorder.classList.remove("recording");
    reset(msg);
  }

  function reset(msg) {
    if (player) { player.pause(); player = null; }
    if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
    blob = null; chunks = []; elapsed = 0;
    actions.hidden = true; sendWrap.hidden = true;
    trace.hidden = true; env = null; tctx = null;
    timeEl.hidden = true; timeEl.textContent = fmt(LIMIT);
    hearBtn.textContent = "Hear it";
    wax.style.setProperty("--lvl", 0);
    wax.alt = "Wax seal; press to speak";
    sealBtn.disabled = false; setBusy(false);
    state = "idle";
    say(msg || PROMPT);
  }

  // No post-house: hand them the file and open a Letter to carry it.
  function send() {
    if (state !== "review" || !blob) return;
    sendBtn.disabled = true;
    const ext = blob.type.includes("mp4") ? "m4a" : "webm";
    const name = `Answer-for-the-Clearing.${ext}`;
    const a = document.createElement("a");
    a.href = blobUrl; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => {
      location.href = MAILTO + "&body=" +
        encodeURIComponent("My Answer is attached: five minutes, unprompted.");
    }, 600);
    say(`The Answer is saved to your Machine as <i>${name}</i>. Affix it to the Letter now opening.`);
    actions.hidden = true; sendWrap.hidden = true;
    if (player) player.pause();
    state = "sealed";
  }

  sealBtn.addEventListener("click", () => {
    if (state === "idle") begin();
    else if (state === "recording") finish(false);
  });
  hearBtn.addEventListener("click", e => {
    e.preventDefault();
    if (!player) return;
    if (player.paused) {
      const p = player.play();
      if (p && p.catch) p.catch(() => { hearBtn.textContent = "Hear it"; });
      hearBtn.textContent = "Enough";
    } else { player.pause(); player.currentTime = 0; hearBtn.textContent = "Hear it"; }
  });
  burnBtn.addEventListener("click", e => { e.preventDefault(); reset(); });
  [hearBtn, burnBtn].forEach(el => el.addEventListener("keydown", e => {
    if (e.key === " ") { e.preventDefault(); el.click(); }
  }));
  sendBtn.addEventListener("click", send);

  // Leaving the page always gives the microphone back.
  window.addEventListener("pagehide", () => {
    if (state === "asking" || state === "recording" || state === "stopping")
      abort();
    else releaseMic();
  });

  if (!supported()) unavailable();
})();
