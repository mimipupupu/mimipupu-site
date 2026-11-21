(function(){
const DCLogic = window.DC.DCLogic;

class Component extends DCLogic {
  // Scroll scene: one rAF loop eases the scroll position and writes CSS variables
  // (--sy px scrolled, --p page progress 0-1, --sp per-section position) that the
  // markup turns into parallax transforms. Reduced-motion users get a static page.
  setRoot = (el) => { this.rootEl = el; };

  // Showcase: the track's position comes from state (galIdx, galDx), so it works
  // without measuring anything. While dragging, galDx follows the pointer (one
  // update per frame); releasing snaps to the nearest piece.
  galGo = (dir) => {
    const n = this.galCount || 1;
    this.setState({ galIdx: (this.state.galIdx + dir + n) % n, galDx: 0 });
  };

  galKey = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); this.galGo(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); this.galGo(-1); }
  };

  galDown = (e) => {
    if (this.props.swipeEnabled === false) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.drag = { x: e.clientX, y: e.clientY, t: Date.now(), moved: false, id: e.pointerId, el: e.currentTarget, dx: 0 };
  };

  galMove = (e) => {
    const d = this.drag;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.moved) {
      if (Math.abs(dx) < 6) return;
      if (Math.abs(dy) > Math.abs(dx)) { this.drag = null; return; }
      d.moved = true;
      try { d.el.setPointerCapture(d.id); } catch (err) {}
    }
    const n = this.galCount || 1, i = this.state.galIdx;
    const atEdge = (i === 0 && dx > 0) || (i === n - 1 && dx < 0);
    d.dx = atEdge ? dx * 0.35 : dx;
    if (!this.dragRaf) {
      this.dragRaf = requestAnimationFrame(() => {
        this.dragRaf = 0;
        if (this.drag) this.setState({ galDx: Math.round(this.drag.dx), galDrag: true });
      });
    }
  };

  galUp = () => {
    const d = this.drag;
    this.drag = null;
    if (this.dragRaf) { cancelAnimationFrame(this.dragRaf); this.dragRaf = 0; }
    if (!d || !d.moved) return;
    const dx = d.dx, v = dx / Math.max(1, Date.now() - d.t);
    this.justDragged = true;
    setTimeout(() => { this.justDragged = false; }, 60);
    const n = this.galCount || 1;
    let idx = this.state.galIdx;
    if (dx < -60 || v < -0.45) idx += 1;
    else if (dx > 60 || v > 0.45) idx -= 1;
    idx = Math.max(0, Math.min(n - 1, idx));
    this.setState({ galIdx: idx, galDx: 0, galDrag: false });
  };

  // Cylinder carousel: cylRot is a float in "cards"; the cylinder turns by
  // -cylRot * (360 / n) degrees. Wheel, drag and arrows move it; it always
  // settles on a whole number so one card faces the front.
  cylTilt = (e) => {
    if (this.reduceMotion || e.pointerType === 'touch' || this.cylDrag) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
    this.tiltNext = { tiltX: +(-py * 16).toFixed(1), tiltY: +(px * 20).toFixed(1) };
    if (!this.tiltRaf) this.tiltRaf = requestAnimationFrame(() => { this.tiltRaf = 0; if (this.tiltNext) this.setState(this.tiltNext); });
  };
  cylUntilt = () => { this.tiltNext = null; this.setState({ tiltX: 0, tiltY: 0 }); };
  cylStepTo = (target, animate) => { this.cylLiveRot = null; this.setState({ cylRot: target, cylAnim: animate !== false, tiltX: 0, tiltY: 0 }); };
  cylGo = (dir) => this.cylStepTo(Math.round(this.cylLiveRot != null ? this.cylLiveRot : this.state.cylRot) + dir);
  cylQueue = (rot) => {
    this.cylLiveRot = rot;
    if (!this.cylRaf) this.cylRaf = requestAnimationFrame(() => { this.cylRaf = 0; if (this.cylLiveRot != null) this.setState({ cylRot: this.cylLiveRot, cylAnim: false }); });
  };
  cylWheel = (e) => {
    // Only sideways scrolling (trackpad swipe, tilt wheel) or Shift + wheel turns the cards;
    // ordinary up/down scrolling is left to the page.
    const sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.2;
    if (!sideways && !e.shiftKey) return;
    const d = sideways ? e.deltaX : (e.deltaY || e.deltaX);
    if (!d) return;
    e.preventDefault();
    const now = Date.now();
    if (e.deltaMode === 1 || Math.abs(d) >= 50) {
      if (now - (this.cylWheelT || 0) < 280) return;
      this.cylWheelT = now;
      this.cylGo(d > 0 ? 1 : -1);
      return;
    }
    const base = this.cylLiveRot != null ? this.cylLiveRot : this.state.cylRot;
    this.cylQueue(base + d / 240);
    clearTimeout(this.cylSnapT);
    this.cylSnapT = setTimeout(() => { const r = this.cylLiveRot != null ? this.cylLiveRot : this.state.cylRot; this.cylStepTo(Math.round(r)); }, 170);
  };
  cylDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.cylDrag = { x: e.clientX, y: e.clientY, t: Date.now(), r0: this.state.cylRot, moved: false, id: e.pointerId, el: e.currentTarget, w: e.currentTarget.clientWidth, v: 0 };
  };
  cylMove = (e) => {
    const d = this.cylDrag;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.moved) {
      if (Math.abs(dx) < 6) return;
      if (Math.abs(dy) > Math.abs(dx)) { this.cylDrag = null; return; }
      d.moved = true;
      try { d.el.setPointerCapture(d.id); } catch (err) {}
      this.setState({ cylDragging: true });
    }
    const now = Date.now();
    const unit = Math.max(110, Math.min(240, d.w * 0.2));
    const next = d.r0 - dx / unit;
    d.v = d.last != null ? (next - d.last) / Math.max(1, now - (d.lt || now)) : 0;
    d.last = next; d.lt = now;
    this.cylQueue(next);
  };
  cylUp = () => {
    const d = this.cylDrag;
    this.cylDrag = null;
    if (!d || !d.moved) return;
    this.cylJust = true;
    setTimeout(() => { this.cylJust = false; }, 80);
    const fling = Math.max(-3, Math.min(3, d.v * 260));
    this.setState({ cylDragging: false });
    this.cylStepTo(Math.round((d.last != null ? d.last : d.r0) + fling));
  };

  // Shop cart: items keyed by product + variant; prices stored in USD and shown
  // in the visitor's chosen currency.
  addToCart = (item) => {
    const cart = this.state.cart.slice();
    const i = cart.findIndex((c) => c.key === item.key && c.variant === item.variant);
    if (i >= 0) cart[i] = { ...cart[i], qty: cart[i].qty + 1 };
    else cart.push({ ...item, qty: 1 });
    clearTimeout(this.toastT);
    this.setState({ cart, toast: 'Added: ' + item.title + (item.variant ? ' (' + item.variant + ')' : ''), orderDone: false, refCode: this.state.orderDone ? this.newRef() : this.state.refCode });
    this.toastT = setTimeout(() => this.setState({ toast: '' }), 2600);
  };

  // Shuffle: the deck gathers to the centre face-down while the cylinder
  // spins a full turn, the order changes, then the cards spread out and flip
  // back face-up one after another.
  cylDraw = () => {
    if (this.cylBusy) return;
    const n = this.galCount || 0;
    if (n < 2) return;
    const base = Math.round(this.cylLiveRot != null ? this.cylLiveRot : this.state.cylRot);
    this.cylLiveRot = null;
    const cur = ((base % n) + n) % n;
    let t = Math.floor(Math.random() * (n - 1)); if (t >= cur) t++;
    const off = (((t - cur) % n) + n) % n;
    const allDown = {}; for (let i = 0; i < n; i++) allDown[i] = true;
    const title = (this.cylTitles && this.cylTitles[t]) || 'a card';
    const msg = 'You drew ' + title;
    this.chime('draw');
    if (this.reduceMotion) { this.setState({ cylDown: { ...allDown, [t]: false }, cylRot: base + off, cylAnim: true, drawMsg: msg, tiltX: 0, tiltY: 0 }); return; }
    this.cylBusy = true;
    this.setState({ cylDown: allDown, cylStagger: true, cylAnim: true, drawMsg: '', tiltX: 0, tiltY: 0 });
    this.cylTimers = [
      setTimeout(() => this.setState({ cylStagger: false, cylAnim: 'spin', cylRot: base + n + off }), 650),
      setTimeout(() => { this.setState({ cylAnim: true, cylDown: { ...allDown, [t]: false }, drawMsg: msg }); this.chime('reveal'); }, 2400),
      setTimeout(() => { this.cylBusy = false; }, 3100)
    ];
  };
  // ---- Print fortune: draw one print, then a star dial sets a 15–35% discount. Saved in this browser. ----
  fortuneSave = () => {
    try { window.localStorage.setItem('mimipupu-fortune', JSON.stringify({ work: this.state.fWork, pct: this.state.fPct || null })); } catch (e) {}
  };
  fortuneDraw = () => {
    if (this.state.fWork || this.fBusy) return;
    const works = this.allWorks || [];
    if (!works.length) return;
    const pick = works[Math.floor(Math.random() * works.length)];
    this.chime('draw');
    if (this.reduceMotion) { this.setState({ fWork: pick.title, fFlick: null, fStage: 'art' }, ); setTimeout(this.fortuneSave, 0); this.chime('reveal'); return; }
    this.fBusy = true;
    let i = 0, delay = 70;
    const step = () => {
      i++;
      this.setState({ fFlick: works[i % works.length].title, fStage: 'drawing' });
      this.uiSound && this.state.soundOn && this.bell(1760 + (i % 4) * 220, 0.008, 0, 0.3);
      delay *= 1.16;
      if (delay < 420) this.fT = setTimeout(step, delay);
      else {
        this.fT = setTimeout(() => {
          this.fBusy = false;
          this.setState({ fWork: pick.title, fFlick: null, fStage: 'art' });
          setTimeout(this.fortuneSave, 0);
          this.chime('reveal');
        }, 260);
      }
    };
    step();
  };
  fortuneSpin = () => {
    // Test mode (Tweaks → discountTestMode): unlimited spins. Turn it OFF before publishing so each visitor gets one spin.
    const testMode = this.props.discountTestMode === true;
    if ((this.state.fPct && !testMode) || this.fBusy) return;
    // 15–50%. 15–35% is common; 36–50% is rare (8% chance in total, under 10%).
    const pct = Math.random() < 0.08 ? 36 + Math.floor(Math.random() * 15) : 15 + Math.floor(Math.random() * 21);
    const k = pct - 15, stepDeg = 360 / 36;
    const curDeg = this.state.fDeg || 0;
    const deg = Math.floor(curDeg / 360) * 360 - 360 * 5 - (k * stepDeg);
    // save straight away so a refresh can't re-roll it
    try { window.localStorage.setItem('mimipupu-fortune', JSON.stringify({ pct })); } catch (e) {}
    if (this.reduceMotion) { this.setState({ fPct: pct, fDeg: -(k * stepDeg), fStage: 'done' }); this.chime('seal'); return; }
    this.fBusy = true;
    this.setState({ fDeg: deg, fStage: 'spinning', fPctPending: pct, fPct: null });
    if (this.state.soundOn && this.ac) { for (let j = 0; j < 22; j++) this.bell(1567.98, 0.01 * (1 - j / 26), j * j * 0.0085, 0.25); }
    this.fT = setTimeout(() => { this.fBusy = false; this.setState({ fPct: pct, fStage: 'done', fPctPending: null }); this.chime('seal'); }, 4400);
  };
  fortuneShow = () => {
    const works = this.allWorks || [];
    const idx = works.findIndex((w) => w.title === this.state.fWork);
    if (idx < 0) return;
    const n = works.length;
    const cur = Math.round(this.state.cylRot || 0);
    const base = cur - (((cur % n) + n) % n);
    let target = base + idx; if (target - cur > n / 2) target -= n; if (cur - target > n / 2) target += n;
    this.setState({ filter: 'all', cylOrder: null, cylDown: {}, cylRot: target, cylAnim: true, tiltX: 0, tiltY: 0 });
    const st = document.querySelector('[data-cyl-stage]');
    if (st && st.scrollIntoView) st.scrollIntoView({ behavior: this.reduceMotion ? 'auto' : 'smooth', block: 'center' });
  };
  // ---- Ambient sound: soft generated chimes (Web Audio), off by default ----
  audioInit = () => {
    if (this.ac) return true;
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return false;
    const ac = new AC();
    const master = ac.createGain(); master.gain.value = 0;
    const delay = ac.createDelay(1.5); delay.delayTime.value = 0.42;
    const fb = ac.createGain(); fb.gain.value = 0.38;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    const wet = ac.createGain(); wet.gain.value = 0.5;
    master.connect(ac.destination);
    master.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(wet); wet.connect(ac.destination);
    this.ac = ac; this.acOut = master;
    const nb = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.8), ac.sampleRate);
    const nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    return true;
  };
  bell = (freq, vol, when, len) => {
    const ac = this.ac; if (!ac) return;
    const t = ac.currentTime + (when || 0);
    const L = len || 3.2;
    [[1, 1], [2.76, 0.18], [5.4, 0.05]].forEach(([m, g]) => {
      const o = ac.createOscillator(); const e = ac.createGain();
      o.type = 'sine'; o.frequency.value = freq * m;
      e.gain.setValueAtTime(0.0001, t);
      e.gain.exponentialRampToValueAtTime(vol * g, t + 0.012);
      e.gain.exponentialRampToValueAtTime(0.0001, t + L / m);
      o.connect(e); e.connect(this.acOut);
      o.start(t); o.stop(t + L / m + 0.05);
    });
  };
  // ---- Cosmic background music: slow drifting pad chords, a deep drone and distant star chimes ----
  padStart = () => {
    const ac = this.ac; if (!ac) return;
    this.padStop(true);
    const bus = ac.createGain(); bus.gain.value = 0;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.7;
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.045;
    const lfoAmt = ac.createGain(); lfoAmt.gain.value = 420;
    lfo.connect(lfoAmt); lfoAmt.connect(lp.frequency); lfo.start();
    bus.connect(lp); lp.connect(this.acOut);
    const t = ac.currentTime;
    bus.gain.setValueAtTime(0, t); bus.gain.linearRampToValueAtTime(1, t + 4);
    // deep drone (D) with a slow breathing swell
    const drone = ac.createOscillator(); drone.type = 'sine'; drone.frequency.value = 73.42;
    const dg = ac.createGain(); dg.gain.value = 0.035;
    const trem = ac.createOscillator(); trem.frequency.value = 0.08;
    const tremAmt = ac.createGain(); tremAmt.gain.value = 0.015;
    trem.connect(tremAmt); tremAmt.connect(dg.gain);
    drone.connect(dg); dg.connect(bus); drone.start(); trem.start();
    this.pad = { bus, lp, lfo, drone, trem, idx: 0 };
    this.padChord();
  };
  padChord = () => {
    const ac = this.ac, pad = this.pad;
    if (!ac || !pad) return;
    // D lydian drift: Dmaj9 → Bm11 → Gmaj7#11 → Em9
    const CHORDS = [
      [146.83, 220, 329.63, 369.99, 554.37],
      [123.47, 185, 293.66, 440, 659.25],
      [98, 146.83, 246.94, 369.99, 554.37],
      [164.81, 246.94, 293.66, 369.99, 493.88]
    ];
    const notes = CHORDS[pad.idx % CHORDS.length];
    pad.idx++;
    const t = ac.currentTime, len = 17;
    notes.forEach((f, i) => {
      [-7, 7].forEach((cents, j) => {
        const o = ac.createOscillator(); o.type = j ? 'triangle' : 'sine';
        o.frequency.value = f; o.detune.value = cents + (Math.random() * 4 - 2);
        const g = ac.createGain();
        const peak = (i === 0 ? 0.028 : 0.016) * (j ? 0.6 : 1);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + 5);
        g.gain.setValueAtTime(peak, t + len - 6);
        g.gain.linearRampToValueAtTime(0.0001, t + len);
        o.connect(g); g.connect(pad.bus); o.start(t); o.stop(t + len + 0.1);
      });
    });
    this.padT = setTimeout(this.padChord, 12000);
  };
  padStop = (now) => {
    clearTimeout(this.padT);
    const pad = this.pad; this.pad = null;
    if (!pad || !this.ac) return;
    const t = this.ac.currentTime, fade = now ? 0.2 : 2.5;
    pad.bus.gain.cancelScheduledValues(t); pad.bus.gain.setValueAtTime(pad.bus.gain.value, t); pad.bus.gain.linearRampToValueAtTime(0, t + fade);
    [pad.lfo, pad.drone, pad.trem].forEach((o) => { try { o.stop(t + fade + 0.1); } catch (e) {} });
  };
  ambientTick = () => {
    if (!this.state.soundOn || !this.ac) return;
    // distant star chimes in D lydian, soft and spaced out
    const notes = [587.33, 659.25, 739.99, 880, 987.77, 1108.73, 1174.66, 1479.98];
    this.bell(notes[Math.floor(Math.random() * notes.length)], 0.022, 0, 4.5);
    if (Math.random() < 0.3) this.bell(notes[Math.floor(Math.random() * notes.length)] * 2, 0.008, 0.35 + Math.random() * 0.4, 3.5);
    if (Math.random() < 0.18) this.swish(0, 2.6, 2400, 5200, 0.006, 'bandpass');
    this.ambT = setTimeout(this.ambientTick, 3200 + Math.random() * 4800);
  };
  chime = (kind) => {
    if (!this.state.soundOn || !this.ac) return;
    if (kind === 'draw') { [659.25, 783.99, 987.77].forEach((f, i) => this.bell(f, 0.045, i * 0.09, 1.6)); }
    else if (kind === 'reveal') { this.bell(1318.5, 0.06, 0, 2.6); this.bell(1975.5, 0.025, 0.06, 2); }
    else if (kind === 'seal') {
      const ac = this.ac, t = ac.currentTime + 0.32;
      const o = ac.createOscillator(); const e = ac.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.25);
      e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.16, t + 0.008); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      o.connect(e); e.connect(this.acOut); o.start(t); o.stop(t + 0.4);
      this.bell(783.99, 0.05, 0.42, 3); this.bell(1174.66, 0.035, 0.52, 3);
    }
  };
  swish = (when, dur, f0, f1, vol, type) => {
    const ac = this.ac; if (!ac || !this.noiseBuf) return;
    const t = ac.currentTime + (when || 0);
    const src = ac.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type || 'bandpass'; f.Q.value = 1.1;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.acOut);
    src.start(t, Math.random() * 0.3); src.stop(t + dur + 0.05);
  };
  uiSound = (kind) => {
    if (!this.state.soundOn || !this.ac) return;
    const hi = [1567.98, 1760, 2093, 2349.32];
    if (kind === 'tick') { this.bell(hi[Math.floor(Math.random() * hi.length)], 0.022, 0, 0.7); }
    else if (kind === 'turn') { this.swish(0, 0.2, 1100, 2600, 0.05); this.bell(2093, 0.012, 0.04, 0.5); }
    else if (kind === 'flip') { this.swish(0, 0.34, 520, 3400, 0.09); this.bell(1318.5, 0.028, 0.2, 1.8); this.bell(1975.5, 0.012, 0.26, 1.4); }
    else if (kind === 'flipMany') { for (let i = 0; i < 5; i++) this.swish(i * 0.08, 0.28, 600 + i * 120, 3000, 0.05); this.bell(1046.5, 0.03, 0.42, 2.2); this.bell(1567.98, 0.018, 0.5, 2); }
    else if (kind === 'shuffle') { for (let i = 0; i < 16; i++) this.swish(i * 0.045, 0.06, 2600, 4200, 0.045 * (1 - i / 22), 'highpass'); this.bell(783.99, 0.02, 0.78, 1.6); }
    else if (kind === 'seal') { this.bell(392, 0.05, 0, 2.2); this.bell(783.99, 0.022, 0.02, 1.8); }
  };
  uiClick = (e) => {
    if (!this.state.soundOn || !this.ac) return;
    const el = e.target && e.target.closest ? e.target.closest('button, a, [role="button"]') : null;
    if (!el || el.matches('.snd-tog, .seal-draw')) return;
    let kind = 'tick';
    if (el.matches('.tier-card')) kind = el.classList.contains('on') ? 'tick' : 'flip';
    else if (el.matches('.mf-back')) kind = 'flip';
    else if (el.matches('.cyl-btn')) kind = el.classList.contains('on') ? 'flip' : 'turn';
    else if (el.matches('.moon-dot')) kind = 'turn';
    else if (el.matches('.seal')) kind = /shuffle/i.test(el.textContent || '') ? 'shuffle' : 'flipMany';
    this.uiSound(kind);
  };
  toggleSound = () => {
    const on = !this.state.soundOn;
    if (on) {
      if (!this.audioInit()) return;
      this.ac.resume && this.ac.resume();
      const t = this.ac.currentTime;
      this.acOut.gain.cancelScheduledValues(t); this.acOut.gain.setValueAtTime(this.acOut.gain.value, t); this.acOut.gain.linearRampToValueAtTime(1, t + 0.6);
      this.setState({ soundOn: true }); this.bell(1174.66, 0.04, 0.05, 3.5); this.padStart(); clearTimeout(this.ambT); this.ambT = setTimeout(this.ambientTick, 2600);
    } else {
      clearTimeout(this.ambT);
      this.padStop();
      if (this.ac) { const t = this.ac.currentTime; this.acOut.gain.cancelScheduledValues(t); this.acOut.gain.setValueAtTime(this.acOut.gain.value, t); this.acOut.gain.linearRampToValueAtTime(0, t + 0.5); }
      this.setState({ soundOn: false });
    }
  };
  cylShuffle = () => {
    if (this.cylBusy) return;
    const n = this.galCount || 0;
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
    if (this.reduceMotion) { this.setState({ cylOrder: order, cylDown: {} }); return; }
    this.cylBusy = true;
    const base = Math.round(this.state.cylRot);
    this.setState({ cylPhase: 'gather', cylAnim: 'spin', cylRot: base + n, cylStagger: false });
    this.cylTimers = [
      setTimeout(() => this.setState({ cylOrder: order }), 900),
      setTimeout(() => this.setState({ cylPhase: 'idle', cylDown: {}, cylStagger: true, cylAnim: true }), 1050),
      setTimeout(() => { this.setState({ cylStagger: false }); this.cylBusy = false; }, 2200)
    ];
  };

  // Tarot spread: cards fan out face-down; drawing one flips it into the
  // "your card" slot; shuffling gathers, splits (riffle) and re-deals the deck.
  shuffleCards = () => {
    if (this.shuffling) return;
    const n = this.galCount || 0;
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
    if (this.reduceMotion) { this.setState({ cardOrder: order, drawn: -1 }); return; }
    this.shuffling = true;
    this.setState({ phase: 'gather', drawn: -1 });
    this.timers = [
      setTimeout(() => this.setState({ phase: 'split' }), 560),
      setTimeout(() => this.setState({ phase: 'gather', cardOrder: order }), 980),
      setTimeout(() => { this.setState({ phase: 'fan' }); this.shuffling = false; }, 1420)
    ];
  };

  // Zoom viewer: wheel / buttons / double-click / pinch to zoom, drag to pan.
  zClamp = (v) => Math.min(5, Math.max(1, v));
  zSet = (scale, x, y) => { const sc = this.zClamp(scale); this.setState({ zScale: sc, zX: sc === 1 ? 0 : x, zY: sc === 1 ? 0 : y }); };
  zIn = () => this.zSet(this.state.zScale * 1.5, this.state.zX * 1.5, this.state.zY * 1.5);
  zOut = () => this.zSet(this.state.zScale / 1.5, this.state.zX / 1.5, this.state.zY / 1.5);
  zReset = () => this.zSet(1, 0, 0);
  zWheel = (e) => { const f = e.deltaY < 0 ? 1.15 : 1 / 1.15; const sc = this.zClamp(this.state.zScale * f); const k = sc / this.state.zScale; this.zSet(sc, this.state.zX * k, this.state.zY * k); };
  zDbl = () => { if (this.state.zScale > 1) this.zReset(); else this.zSet(2.5, 0, 0); };
  zQueue = (patch) => {
    this.zPatch = Object.assign({}, this.zPatch || {}, patch);
    if (!this.zRaf) this.zRaf = requestAnimationFrame(() => { this.zRaf = 0; const p = this.zPatch; this.zPatch = null; if (p) this.setState(p); });
  };
  zDown = (e) => {
    if (!this.zp) this.zp = new Map();
    this.zp.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
    if (this.zp.size === 2) {
      const pts = Array.from(this.zp.values());
      this.pinch = { d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1, s: this.state.zScale };
      this.pan = null;
    } else {
      this.pan = { x: e.clientX, y: e.clientY, ox: this.state.zX, oy: this.state.zY };
    }
    this.setState({ zDragging: true });
  };
  zMove = (e) => {
    if (!this.zp || !this.zp.has(e.pointerId)) return;
    this.zp.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.zp.size === 2 && this.pinch) {
      const pts = Array.from(this.zp.values());
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      this.zQueue({ zScale: this.zClamp(this.pinch.s * d / this.pinch.d) });
    } else if (this.pan && this.state.zScale > 1) {
      this.zQueue({ zX: this.pan.ox + e.clientX - this.pan.x, zY: this.pan.oy + e.clientY - this.pan.y });
    }
  };
  zUp = (e) => {
    if (!this.zp) return;
    this.zp.delete(e.pointerId);
    if (this.zp.size < 2) this.pinch = null;
    if (this.zp.size === 0) {
      this.pan = null;
      this.setState({ zDragging: false });
      if (this.state.zScale <= 1.01) this.zSet(1, 0, 0);
    } else {
      const pt = Array.from(this.zp.values())[0];
      this.pan = { x: pt.x, y: pt.y, ox: this.state.zX, oy: this.state.zY };
    }
  };

  componentDidMount() {
    if (typeof window === 'undefined') return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.reduceMotion = reduce;
    // Moon-phase loader: wait for the banner image (min ~1.4s, max 4s), then fade out.
    {
      const t0 = Date.now();
      const minT = reduce ? 200 : 1400;
      let done = false;
      const finish = () => {
        if (done) return; done = true;
        clearTimeout(this.ldMax);
        this.ldT1 = setTimeout(() => {
          this.setState({ loader: 'hide' });
          this.ldT2 = setTimeout(() => this.setState({ loader: 'gone' }), reduce ? 60 : 900);
        }, Math.max(0, minT - (Date.now() - t0)));
      };
      const img = document.querySelector('#top img');
      if (!img || (img.complete && img.naturalWidth)) finish();
      else { img.addEventListener('load', finish, { once: true }); img.addEventListener('error', finish, { once: true }); }
      this.ldMax = setTimeout(finish, 4000);
    }
    document.addEventListener('click', this.uiClick, true);
    // Star-burst ripple from the click point on gilded / line buttons
    this.btnDown = (e) => {
      if (this.reduceMotion) return;
      const el = e.target && e.target.closest ? e.target.closest('.btn-gild, .btn-line') : null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--rx', (e.clientX - r.left).toFixed(0) + 'px');
      el.style.setProperty('--ry', (e.clientY - r.top).toFixed(0) + 'px');
      el.classList.remove('burst'); void el.offsetWidth; el.classList.add('burst');
      clearTimeout(el._burstT); el._burstT = setTimeout(() => el.classList.remove('burst'), 700);
    };
    document.addEventListener('pointerdown', this.btnDown, true);
    // Foil shine follows the pointer across card faces
    this.foilMove = (e) => {
      if (this.reduceMotion || e.pointerType === 'touch') return;
      const card = e.target && e.target.closest ? e.target.closest('.cyl-btn, .merch-card, .tier-card') : null;
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--fx', (((e.clientX - r.left) / r.width) * 100).toFixed(1) + '%');
      card.style.setProperty('--fy', (((e.clientY - r.top) / r.height) * 100).toFixed(1) + '%');
    };
    document.addEventListener('pointermove', this.foilMove, { passive: true });
    try {
      const fr = JSON.parse(window.localStorage.getItem('mimipupu-fortune') || 'null');
      if (fr && fr.pct) {
        const k = fr.pct - 15;
        this.setState({ fPct: fr.pct, fStage: 'done', fDeg: -(k * 360 / 36) });
      }
    } catch (e) {}
    if (!this.state.refCode) this.setState({ refCode: this.newRef() });
    // Day mode remembered in this browser
    try { if (window.localStorage.getItem('mimipupu-day') === '1') this.setState({ dayMode: true }); } catch (e) {}
    // Sparkle cursor with a faint star trail (mouse only, off for reduced motion)
    if (!reduce && window.matchMedia && window.matchMedia('(pointer: fine)').matches) {
      this.curEl = document.querySelector('.cur-trail');
      this.curPts = Array.from({ length: 6 }, () => ({ x: -99, y: -99 }));
      this.curM = { x: -99, y: -99 };
      const de = document.documentElement;
      this.curTick = () => {
        this.curRaf = 0;
        let tx = this.curM.x, ty = this.curM.y, moving = false;
        this.curPts.forEach((pt, i) => {
          const k = i === 0 ? 1 : 0.4;
          pt.x += (tx - pt.x) * k; pt.y += (ty - pt.y) * k;
          if (Math.abs(tx - pt.x) + Math.abs(ty - pt.y) > 0.3) moving = true;
          de.style.setProperty('--cx' + i, pt.x.toFixed(1) + 'px');
          de.style.setProperty('--cy' + i, pt.y.toFixed(1) + 'px');
          tx = pt.x; ty = pt.y;
        });
        if (moving) this.curRaf = requestAnimationFrame(this.curTick);
      };
      this.curMove = (e) => {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        this.curM.x = e.clientX; this.curM.y = e.clientY;
        if (this.curEl && !this.curOn) { this.curEl.classList.add('on'); this.curOn = true; }
        if (!this.curRaf) this.curRaf = requestAnimationFrame(this.curTick);
      };
      this.curLeave = () => { if (this.curEl) this.curEl.classList.remove('on'); this.curOn = false; };
      window.addEventListener('pointermove', this.curMove, { passive: true });
      document.documentElement.addEventListener('mouseleave', this.curLeave);
    }
    this.secIds = ['top', 'about', 'work', 'commissions', 'terms', 'merch', 'contact'];
    this.onSecScroll = () => {
      if (this.secRaf) return;
      this.secRaf = requestAnimationFrame(() => {
        this.secRaf = 0;
        const mid = window.innerHeight * 0.45;
        let best = this.state.activeSec;
        const de = document.documentElement;
        if (window.innerHeight + (window.scrollY || de.scrollTop) >= de.scrollHeight - 4) best = 'contact';
        else for (const id of this.secIds) {
          const el = document.getElementById(id);
          if (!el) continue;
          const r = el.getBoundingClientRect();
          if (r.top <= mid && r.bottom > mid) { best = id; break; }
        }
        if (best !== this.state.activeSec) this.setState({ activeSec: best });
        // Deck effect: the cards sit as a stacked deck until the carousel reaches the
        // middle of the screen, lay out while it is in view, and stack again after.
        const stage = document.querySelector('[data-cyl-stage]');
        if (stage) {
          const sr = stage.getBoundingClientRect();
          const vh = window.innerHeight;
          const st = this.state.cylStacked;
          // stacked while the carousel is still below (scrolling down into the shop)
          // or already above (scrolled past); laid out while it is in the middle.
          const above = st ? sr.bottom < vh * 0.62 : sr.bottom < vh * 0.55;
          const below = st ? sr.top > vh * 0.68 : sr.top > vh * 0.75;
          const want = above || below;
          if (want !== st) this.setState(want ? { cylStacked: true, tiltX: 0, tiltY: 0 } : { cylStacked: false });
        }
      });
    };
    window.addEventListener('scroll', this.onSecScroll, { passive: true });
    window.addEventListener('resize', this.onSecScroll, { passive: true });
    this.onSecScroll();
    this.cylEl = document.querySelector('[data-cyl-stage]');
    if (this.cylEl) this.cylEl.addEventListener('wheel', this.cylWheel, { passive: false });
    if (reduce || !this.rootEl) return;
    this.sections = Array.from(this.rootEl.querySelectorAll('[data-section]'));
    this.cur = window.scrollY || 0;
    this.target = this.cur;
    this.tick = () => {
      this.raf = 0;
      const d = this.target - this.cur;
      this.cur = Math.abs(d) < 0.4 ? this.target : this.cur + d * 0.14;
      const root = this.rootEl;
      if (!root) return;
      const vh = window.innerHeight || 1;
      const max = Math.max(1, document.documentElement.scrollHeight - vh);
      root.style.setProperty('--sy', this.cur.toFixed(1));
      root.style.setProperty('--p', Math.min(1, Math.max(0, this.cur / max)).toFixed(4));
      for (const el of this.sections) {
        const r = el.getBoundingClientRect();
        const sp = Math.max(-1.5, Math.min(1.5, (r.top + r.height / 2 - vh / 2) / vh));
        el.style.setProperty('--sp', sp.toFixed(3));
      }
      if (this.cur !== this.target) this.raf = requestAnimationFrame(this.tick);
    };
    this.onScroll = () => {
      this.target = window.scrollY || document.documentElement.scrollTop || 0;
      if (!this.raf) this.raf = requestAnimationFrame(this.tick);
    };
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.onScroll, { passive: true });
    if ('IntersectionObserver' in window) {
      this.io = new IntersectionObserver((entries) => {
        const seen = { ...this.state.seen };
        let changed = false;
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const k = en.target.getAttribute('data-section');
          if (!seen[k]) { seen[k] = true; changed = true; }
          this.io.unobserve(en.target);
        });
        if (changed) this.setState({ seen });
      }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
      this.sections.forEach((el) => this.io.observe(el));
      this.setState({ revealReady: true });
    }
    this.onScroll();
  }

  componentWillUnmount() {
    if (this.timers) this.timers.forEach(clearTimeout);
    if (this.zRaf) cancelAnimationFrame(this.zRaf);
    if (this.tiltRaf) cancelAnimationFrame(this.tiltRaf);
    if (this.cylEl) this.cylEl.removeEventListener('wheel', this.cylWheel);
    if (this.cylRaf) cancelAnimationFrame(this.cylRaf);
    clearTimeout(this.cylSnapT);
    if (this.cylTimers) this.cylTimers.forEach(clearTimeout);
    clearTimeout(this.toastT);
    clearTimeout(this.ldT1); clearTimeout(this.ldT2); clearTimeout(this.ldMax);
    clearTimeout(this.ambT); clearTimeout(this.padT); clearTimeout(this.fT);
    document.removeEventListener('click', this.uiClick, true);
    document.removeEventListener('pointerdown', this.btnDown, true);
    document.removeEventListener('pointermove', this.foilMove);
    if (this.ac && this.ac.close) { try { this.ac.close(); } catch (e) {} }
    if (this.curMove) window.removeEventListener('pointermove', this.curMove);
    if (this.curLeave) document.documentElement.removeEventListener('mouseleave', this.curLeave);
    if (this.curRaf) cancelAnimationFrame(this.curRaf);
    clearTimeout(this.merchT);
    if (this.onSecScroll) { window.removeEventListener('scroll', this.onSecScroll); window.removeEventListener('resize', this.onSecScroll); }
    if (this.secRaf) cancelAnimationFrame(this.secRaf);
    clearTimeout(this.flipAllT);
    if (this.dragRaf) cancelAnimationFrame(this.dragRaf);
    if (this.onScroll) {
      window.removeEventListener('scroll', this.onScroll);
      window.removeEventListener('resize', this.onScroll);
    }
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.io) this.io.disconnect();
  }

  // Order reference code, e.g. MP-4K7Q, shown with payment details so payments can be matched.
  newRef = () => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let r = ''; for (let i = 0; i < 4; i++) r += c[Math.floor(Math.random() * c.length)]; return 'MP-' + r; };
  state = { refCode: '', soundOn: false, drawMsg: '', loader: 'on', dayMode: false, cylStacked: false, merchUp: {}, merchStagger: false, cart: [], cartOpen: false, printSize: 'A4', toast: '', orderDone: false, orderName: '', orderEmail: '', orderAddr: '', orderErr: '', activeSec: 'top', cylRot: 0, cylAnim: true, cylDragging: false, cylOrder: null, cylDown: {}, cylPhase: 'idle', cylStagger: false, tiltX: 0, tiltY: 0, cardOrder: null, drawn: -1, drawCount: 0, phase: 'fan', zScale: 1, zX: 0, zY: 0, zDragging: false, curOpen: false, galIdx: 0, galDx: 0, galDrag: false, discordCopied: false, seen: {}, revealReady: false, region: '', payMethod: '', cur: 'USD', frame: 'bust', addons: {}, posterChars: 1, filter: 'all', lightbox: -1, tier: 'illustration', bg: 'none', extra: 0, commercial: false, name: '', email: '', brief: '', submitted: false, error: '', faq: -1 };

  renderVals() {
    const p = this.props;
    const s = this.state;
    const accent = p.accent ?? '#FF9A5C';
    const CURS = [
      // adj = regional pricing for commissions (1 = full US price). Tweaks → Regional pricing.
      { code: 'USD', full: 'US dollar', sym: 'US$', rate: 1, adj: 1 },
      { code: 'MYR', full: 'Malaysian ringgit', sym: 'RM', rate: p.rateMYR ?? 4.08, adj: p.adjMYR ?? 0.49 },
      { code: 'EUR', full: 'Euro', sym: '€', rate: p.rateEUR ?? 0.845, adj: p.adjEUR ?? 0.95 },
      { code: 'GBP', full: 'British pound', sym: '£', rate: p.rateGBP ?? 0.722, adj: p.adjGBP ?? 0.95 },
      { code: 'SGD', full: 'Singapore dollar', sym: 'S$', rate: p.rateSGD ?? 1.29, adj: p.adjSGD ?? 0.8 },
      { code: 'AUD', full: 'Australian dollar', sym: 'A$', rate: p.rateAUD ?? 1.43, adj: p.adjAUD ?? 0.9 },
      { code: 'JPY', full: 'Japanese yen', sym: '¥', rate: p.rateJPY ?? 156, adj: p.adjJPY ?? 0.75 }
    ];
    const curSel = CURS.find((c) => c.code === s.cur) || CURS[0];
    const open = p.commissionsOpen ?? true;
    const slotsTotal = Math.max(1, p.slotsTotal ?? 5);
    const slotsTaken = Math.min(slotsTotal, Math.max(0, p.slotsTaken ?? 2));
    const slotsLeft = slotsTotal - slotsTaken;
    const extraPct = p.extraCharPct ?? 50;
    const commercialPct = p.commercialPct ?? 50;
    const money = (n) => curSel.sym + Math.round(n * curSel.rate).toLocaleString('en-US');
    // Commission prices use regional pricing for the selected currency.
    const cAdj = curSel.adj ?? 1;
    const cmoney = (n) => curSel.sym + Math.round(n * curSel.rate * cAdj).toLocaleString('en-US');
    const currencies = CURS.map((c) => {
      const on = c.code === curSel.code;
      return { ...c, pressed: on ? 'true' : 'false', bg: on ? accent : 'transparent', fg: on ? '#3A1A06' : 'var(--tx, #FAF0E8)', pick: () => this.setState({ cur: c.code, curOpen: false }) };
    });

    const WORKS = (Array.isArray(p.works) && p.works.length) ? p.works.filter((w) => w && w.image).map((w) => ({ title: w.title || '', series: w.series || 'others', img: w.image, alt: w.alt || w.title || '', cat: w.shape === 'landscape' ? 'horizontal' : 'portrait', ratio: Number(w.ratio) || (w.shape === 'landscape' ? 1.78 : 0.707), tone: w.lightBg ? '#F3E6D0' : '#1A1411' })) : [
      { title: 'Paragons — Chapter I', cat: 'illustration', ratio: 0.707, tone: '#1A1411', img: 'img/03df3c9d278a8cbd60b72dc8cb17f175.jpg', alt: 'Paragons Chapter I cover art: a bearded giant, a young swordsman, a dragon and floating purple crystals', desc: '[A line about this piece: the story, the client or how you made it.]' },
      { title: 'Ryomen Sukuna, the Disgraced One', cat: 'portrait', ratio: 0.707, tone: '#1A1411', img: 'img/9ae24df67ecf9e6a0a05bc01b57a9d7a.jpg', alt: 'Ryomen Sukuna standing on a pile of horned skulls with a spear, in a boss-fight style frame' },
      { title: 'Hell answers to me', cat: 'portrait', ratio: 0.725, tone: '#1A1411', img: 'img/30b23740ba7659ec2c1e8ff5b54aeac9.jpg', alt: 'Doctor Doom in green cloak and armour holding a crowned head, with glowing gems orbiting his hand' },
      { title: 'Shinjuku Showdown', cat: 'horizontal', ratio: 1.79, tone: '#1A1411', img: 'img/f024ca5602d79262bc5b276dbb3d55c0.jpg', alt: 'Sukuna lunging towards a grinning white-haired Gojo across a purple domain' },
      { title: 'There are no strings on me...', cat: 'portrait', ratio: 0.891, tone: '#F3E6D0', img: 'img/134e11146d2bc194dd46728e0fc423e4.jpg', alt: 'Ultron in black and red armour floating in front of a swarm of drones' },
      { title: 'Fūga', cat: 'portrait', ratio: 0.707, tone: '#1A1411', img: 'img/daa255c6629c13474b2d5a2fc61e0fba.jpg', alt: 'Sukuna grinning in the dark, lit red by a flame in his hand' },
      { title: 'Shanks', cat: 'portrait', ratio: 0.707, tone: '#1A1411', img: 'img/783c5f1d583a7c7b27f42f56c01f879b.jpg', alt: 'Close-up portrait of red-haired Shanks with blood running over one eye' },
      { title: 'The Butcher', cat: 'portrait', ratio: 0.716, tone: '#1A1411', img: 'img/e0968bad3656f2c054d979556e1d3cac.webp', alt: 'A young fighter in a white cap and red scarf stands over a giant blood-stained cleaver, seen from below as a clawed green hand reaches in' },
      { title: 'Knives Out!', cat: 'portrait', ratio: 0.716, tone: '#1A1411', img: 'img/7e3a1ed3ecc7f3b7c408536b1108ece2.webp', alt: 'The same white-capped fighter grinning mid-leap over green fields, swinging a huge cleaver and a knife as rocks fly' },
      { title: 'Calamari and Garlic', cat: 'portrait', ratio: 0.716, tone: '#1A1411', img: 'img/6edd084276894c2ae820213b63926564.webp', alt: 'The white-capped fighter snarling as he swings through red tentacles, framed by bright white slash lines' },
      { title: 'The Plunderer', cat: 'portrait', ratio: 0.716, tone: '#1A1411', img: 'img/6fda83ead989037fd328c256ca8836ee.webp', alt: 'A bearded giant with glowing eyes holds up a radiant orb among huge red tentacles' },
      { title: 'Binding Pact', cat: 'portrait', ratio: 0.716, tone: '#1A1411', img: 'img/93622f2d5079ffe40584ba8bd5f32379.webp', alt: 'A grinning bearded warrior with a glowing red eye swings a bone-toothed club through streaks of red energy' },
      { title: 'The One on the Throne', cat: 'portrait', ratio: 0.716, tone: '#1A1411', img: 'img/d17b69c525d59f8030ec36dd8124e039.webp', alt: 'The bearded warrior charges forward with two jagged weapons as a molten explosion and tentacles erupt behind him' },
      { title: "Nah, I'd Win.", cat: 'portrait', ratio: 0.707, tone: '#F3E6D0', img: 'img/250b743c5d2b01ba734344a14dca7ef0.webp', alt: 'A white-haired man in a dark uniform lifts his blindfold to reveal bright blue eyes, grinning beside a speech bubble that reads Nah, I would win' },
      { title: "The Monarch's Decree", cat: 'horizontal', ratio: 1.776, tone: '#1A1411', img: 'img/c5d6be353b18e585adbcbaab552209f2.webp', alt: 'Wolf-like warriors kneel before a crowned king on a throne in a vast hall of twisted tree pillars, lit by candles and a glowing teal orb' },
      { title: "A man's dream will never die", cat: 'portrait', ratio: 0.769, tone: '#1A1411', img: 'img/36c30b524f4f6212b301ab7055d2783d.webp', alt: 'A grinning pirate in a skull-and-crossbones hat and yellow polka-dot bandana laughs with one glowing red eye beside a red ZEHAHAHA sound effect' }
    ];
    // Categories are by orientation: wider than tall = Horizontal, otherwise Portrait.
    const orient = (w) => ((w.ratio || 0.75) > 1 ? 'horizontal' : 'portrait');
    const CAT = { horizontal: 'Horizontal', portrait: 'Portrait' };
    // Series categories (filters + label), grouped in this order in the deck.
    const SERIES = [
      { key: 'jjk', label: 'Jujutsu Kaisen' },
      { key: 'onepiece', label: 'One Piece' },
      { key: 'paragons', label: 'Paragons' },
      { key: 'marvel', label: 'Marvel' },
      { key: 'others', label: 'Others' }
    ];
    const SERIES_OF = {
      'Paragons — Chapter I': 'paragons', 'Ryomen Sukuna, the Disgraced One': 'jjk', 'Hell answers to me': 'marvel', 'Shinjuku Showdown': 'jjk',
      'There are no strings on me...': 'marvel', 'Fūga': 'jjk', 'Shanks': 'onepiece', 'The Butcher': 'paragons', 'Knives Out!': 'paragons',
      'Calamari and Garlic': 'paragons', 'The Plunderer': 'paragons', 'Binding Pact': 'paragons', 'The One on the Throne': 'paragons',
      "Nah, I'd Win.": 'jjk', "The Monarch's Decree": 'others', "A man's dream will never die": 'onepiece'
    };
    const SERIES_LABEL = {}; SERIES.forEach((x) => { SERIES_LABEL[x.key] = x.label; });
    WORKS.forEach((w) => { w.series = w.series || SERIES_OF[w.title] || 'others'; });
    const seriesRank = (w) => SERIES.findIndex((x) => x.key === w.series);
    WORKS.sort((a, b) => seriesRank(a) - seriesRank(b));
    const shown = (s.filter === 'all' || !SERIES_LABEL[s.filter] ? WORKS : WORKS.filter((w) => w.series === s.filter)).map((w) => ({
      ...w, catLabel: SERIES_LABEL[w.series] || 'Others', hasImg: !!w.img, noImg: !w.img,
      alt: w.alt || w.title, desc: w.desc || '[A short description of this piece.]'
    }));
    const gN = shown.length;
    this.galCount = gN;
    const gIdx = Math.min(Math.max(0, s.galIdx), Math.max(0, gN - 1));
    const dragDx = s.galDx || 0;
    const prevI = gN ? (gIdx - 1 + gN) % gN : 0;
    const nextI = gN ? (gIdx + 1) % gN : 0;
    const works = shown.map((w, i) => {
      const on = i === gIdx;
      const rel = i < gIdx ? -1 : i > gIdx ? 1 : 0;
      return {
        ...w,
        tx: rel * 10,
        dx: on ? dragDx : 0,
        sc: on ? 1 : 1.08,
        op: on ? Math.max(0.35, 1 - Math.abs(dragDx) / 700).toFixed(3) : 0,
        pe: on ? 'auto' : 'none',
        tab: on ? 0 : -1,
        hidden: on ? 'false' : 'true',
        btnLabel: 'View ' + w.title + ' full size',
        open: () => {
          if (this.justDragged) return;
          this.setState({ lightbox: i });
        }
      };
    });
    const roman = (num) => { const m = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let r = ''; for (const [v, t] of m) { while (num >= v) { r += t; num -= v; } } return r; };
    const fullIndex = (w) => WORKS.findIndex((x) => x.title === w.title);
    const order = (s.cardOrder && s.cardOrder.length === gN) ? s.cardOrder : shown.map((_, i) => i);
    const dealt = !s.revealReady || !!s.seen.work;
    const phase = dealt ? s.phase : 'gather';
    const mid = (gN - 1) / 2;
    const drawnI = s.drawn >= 0 && s.drawn < gN ? s.drawn : -1;
    const cards = order.map((wi, pos) => {
      const w = shown[wi];
      const jx = (((pos * 37) % 9) - 4) * 0.04, ja = (((pos * 53) % 7) - 3) * 1.4;
      let rel = pos - mid, y = Math.round(Math.abs(pos - mid) * 3), ry = -16, rz = (((pos * 29) % 5) - 2) * 1.2;
      if (phase === 'gather') { rel = jx; y = 0; ry = -8; rz = ja; }
      else if (phase === 'split') { rel = pos % 2 ? 1.1 : -1.1; y = -12; ry = pos % 2 ? -24 : 8; rz = pos % 2 ? 6 : -6; }
      const isDrawn = wi === drawnI;
      if (isDrawn && phase === 'fan') y = -110;
      return {
        z: pos + 1, rel: rel.toFixed(3), y, ry, rz: rz.toFixed(1), op: isDrawn ? 0 : 1, delay: (pos * 0.035).toFixed(3),
        label: 'Card ' + (pos + 1) + ' of ' + gN + ', face down. Draw it',
        draw: () => { if (this.shuffling) return; this.setState({ drawn: wi, drawCount: this.state.drawCount + 1 }); }
      };
    });
    const dw = drawnI >= 0 ? shown[drawnI] : null;
    const drawnCard = dw ? { ...dw, numeral: roman(fullIndex(dw) + 1) } : { title: '', tone: '#1A1411', hasImg: false, noImg: true, numeral: '', catLabel: '', desc: '' };
    const cN = Math.max(1, gN);
    const cStep = 360 / cN;
    const cRot = s.cylRot || 0;
    const cActive = ((Math.round(cRot) % cN) + cN) % cN;
    const cRf = (Math.max(0.95, 0.5 / Math.tan(Math.PI / Math.max(3, cN))) * 1.2).toFixed(3);
    const openCard = (i) => this.setState({ lightbox: i, zScale: 1, zX: 0, zY: 0 });
    const SYMBOLS = ['M43.00 30.00a7 7 0 1 0 14 0a7 7 0 1 0 -14 0ZM44.20 30.00a5.8 5.8 0 1 0 11.6 0a5.8 5.8 0 1 0 -11.6 0Z','M50 23A7 7 0 0 1 50 37A3 7 0 0 0 50 23Z','M50 23A7 7 0 0 1 50 37Z','M50 23A7 7 0 0 1 50 37A3.6 7 0 0 1 50 23Z','M43.00 30.00a7 7 0 1 0 14 0a7 7 0 1 0 -14 0Z','M50 23A7 7 0 0 0 50 37A3 7 0 0 1 50 23Z','M46.00 30.00a4 4 0 1 0 8 0a4 4 0 1 0 -8 0ZM55.33 29.14L59.40 30.00L55.33 30.86ZM54.38 33.16L56.65 36.65L53.16 34.38ZM50.86 35.33L50.00 39.40L49.14 35.33ZM46.84 34.38L43.35 36.65L45.62 33.16ZM44.67 30.86L40.60 30.00L44.67 29.14ZM45.62 26.84L43.35 23.35L46.84 25.62ZM49.14 24.67L50.00 20.60L50.86 24.67ZM53.16 25.62L56.65 23.35L54.38 26.84Z','M50.00 21.50L51.15 27.23L56.01 23.99L52.77 28.85L58.50 30.00L52.77 31.15L56.01 36.01L51.15 32.77L50.00 38.50L48.85 32.77L43.99 36.01L47.23 31.15L41.50 30.00L47.23 28.85L43.99 23.99L48.85 27.23Z','M41 30Q50 21.5 59 30Q50 38.5 41 30ZM46.60 30.00a3.4 3.4 0 1 0 6.8 0a3.4 3.4 0 1 0 -6.8 0ZM48.40 30.00a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0Z','M46.60 30.00a3.4 3.4 0 1 0 6.8 0a3.4 3.4 0 1 0 -6.8 0ZM44 25.5A4.5 4.5 0 0 0 44 34.5A2 4.5 0 0 1 44 25.5ZM56 25.5A4.5 4.5 0 0 1 56 34.5A2 4.5 0 0 0 56 25.5Z','M47.00 30.00a3 3 0 1 0 6 0a3 3 0 1 0 -6 0ZM42.60 30.00a7.4 7.4 0 1 0 14.8 0a7.4 7.4 0 1 0 -14.8 0ZM43.60 30.00a6.4 6.4 0 1 0 12.8 0a6.4 6.4 0 1 0 -12.8 0Z'];
    const cOrder = (s.cylOrder && s.cylOrder.length === gN) ? s.cylOrder : shown.map((_, i) => i);
    const gathering = s.cylPhase === 'gather';
    this.cylTitles = cOrder.map((wi) => (shown[wi] && shown[wi].title) || '');
    const cylCards = cOrder.map((wi, i) => {
      const w = shown[wi];
      let diff = (((i - cRot) % cN) + cN) % cN;
      if (diff > cN / 2) diff -= cN;
      const dist = Math.abs(diff);
      const on = i === cActive && !s.cylDragging;
      const stacked = !!s.cylStacked;
      const down = gathering || stacked || !!s.cylDown[i];
      const front = i === cActive;
      return {
        ...w,
        flip: down ? 180 : 0,
        pressed: down ? 'true' : 'false',
        fd: s.cylStagger ? (i * 0.08).toFixed(2) : 0,
        tx: front && !down ? (s.tiltX || 0) : 0,
        ty: front && !down ? (s.tiltY || 0) : 0,
        tilt: front ? this.cylTilt : null,
        untilt: front ? this.cylUntilt : null,
        view: () => openCard(wi),
        numeral: roman(fullIndex(w) + 1),
        sym: SYMBOLS[(fullIndex(w) + SYMBOLS.length) % SYMBOLS.length],
        shape: orient(w) === 'horizontal' ? 'land' : '',
        capOp: stacked ? 0 : (1 - Math.min(dist, 2.5) * 0.36).toFixed(2),
        ang: (stacked ? cRot * cStep : i * cStep).toFixed(3),
        dz: stacked ? ((cN - dist) * 1.6).toFixed(1) : 0,
        dy: stacked ? (-(cN - dist) * 2.4).toFixed(1) : 0,
        rz: stacked ? ((((i * 37) % 7) - 3) * 1.3).toFixed(1) : 0,
        sd: stacked ? (dist * 0.05).toFixed(2) : ((cN - dist) * 0.03).toFixed(2),
        sc: on ? '1.08' : (1 - Math.min(dist, 2.5) * 0.05).toFixed(3),
        shade: Math.min(0.72, dist * 0.26).toFixed(2),
        tab: i === cActive ? 0 : -1,
        cls: (on ? 'on' : '') + (front && (s.tiltX || s.tiltY) ? ' tilting' : ''),
        label: front ? 'Flip ' + w.title + (down ? ' face up' : ' face down') : 'Bring ' + w.title + ' to the front',
        pick: () => {
          if (this.cylJust) return;
          const cur = Math.round(this.state.cylRot);
          const curIdx = ((cur % cN) + cN) % cN;
          if (i === curIdx) { if (!this.cylBusy) this.setState({ cylDown: { ...this.state.cylDown, [i]: !this.state.cylDown[i] }, tiltX: 0, tiltY: 0 }); return; }
          let d2 = (((i - cur) % cN) + cN) % cN;
          if (d2 > cN / 2) d2 -= cN;
          this.cylStepTo(cur + d2);
        }
      };
    });
    const cw = shown[cOrder[cActive]];
    const cylCur = cw ? { ...cw, numeral: roman(fullIndex(cw) + 1) } : { title: '', catLabel: '', desc: '', numeral: '' };
    const prevSlides = shown.map((w, i) => ({ ...w, op: i === prevI ? 1 : 0 }));
    const nextSlides = shown.map((w, i) => ({ ...w, op: i === nextI ? 1 : 0 }));
    const gal = shown[gIdx] || { title: '', catLabel: '', desc: '' };
    const pad2 = (v) => (v < 10 ? '0' : '') + v;

    const filters = [{ key: 'all', label: 'All' }].concat(SERIES).map((f) => {
      const on = s.filter === f.key || (f.key === 'all' && !SERIES_LABEL[s.filter]);
      return {
        ...f,
        count: f.key === 'all' ? WORKS.length : WORKS.filter((w) => w.series === f.key).length,
        pressed: on ? 'true' : 'false',
        bg: on ? 'var(--ivbg, #FAF0E8)' : 'transparent',
        fg: on ? 'var(--ivfg, #141414)' : 'var(--tx, #FAF0E8)',
        ink: on ? 'var(--pk, #FFD6A3)' : 'var(--tx2, #D7C6B8)',
        line: on ? 'var(--pk, #FFD6A3)' : 'transparent',
        pick: () => this.setState({ filter: f.key, lightbox: -1, galIdx: 0, galDx: 0, cardOrder: null, drawn: -1, cylRot: 0, cylAnim: false, cylOrder: null, cylDown: {} })
      };
    });

    const n = shown.length;
    const lbOpen = s.lightbox >= 0 && s.lightbox < n;
    const lb = lbOpen ? shown[s.lightbox] : (shown[0] || { title: '', tone: '#DADAD4', catLabel: '', hasImg: false, noImg: true });

    const TIERS = [
      { key: 'chibi', name: 'Chibi Character Stickers', desc: 'Cute chibi stickers of your character', price: p.priceChibi ?? 15, figure: 40, tarot: 'The Chibi', numeral: 'I', soft: 'M52.08 23.5a4.42 4.42 0 0 1 0 7.8a3.38 4.42 0 0 0 0 -7.8Z', sym: 'M47.87 27.66a0.57 0.94 0 1 0 1.14 0a0.57 0.94 0 1 0 -1.14 0ZM50.47 27.66a0.57 0.94 0 1 0 1.14 0a0.57 0.94 0 1 0 -1.14 0ZM42.88 25.32a0.36 0.36 0 1 0 0.72 0a0.36 0.36 0 1 0 -0.72 0ZM56.92 32.08a0.36 0.36 0 1 0 0.72 0a0.36 0.36 0 1 0 -0.72 0Z', ln: 'M45.58 27.4a4.42 4.42 0 1 0 8.84 0a4.42 4.42 0 1 0 -8.84 0M48.18 31.82q-.26 2.08 0 3.38M51.82 31.82q.26 2.08 0 3.38M49.22 32.6v2.86M50.78 32.6v2.86M48.44 35.46h1.3M50.26 35.46h1.3', incl: ['1 chibi character', 'Simple colour background', 'Transparent PNG for stickers', 'Personal use'] },
      { key: 'illustration', name: 'OC / Character / Creature Illustration', desc: 'A finished illustration of your OC, character or creature', price: p.priceIllustration ?? 70, figure: 52, tarot: 'The Illustrator', numeral: 'II', soft: 'M46.88 32.08a3.12 3.12 0 0 1 6.24 0Z', sym: 'M46.36 25.06l.26 .65 .65 .26 -.65 .26 -.26 .65 -.26 -.65 -.65 -.26 .65 -.26ZM53.04 25.06a.34 .34 0 1 0 .68 0a.34 .34 0 1 0 -.68 0ZM52.6 26.1a.91 .91 0 1 0 1.04 1.04a.78 .78 0 0 1 -1.04 -1.04Z', ln: 'M44.72 23.24h11.44v13.52h-11.44ZM46.88 32.08a3.12 3.12 0 0 1 6.24 0M50 28.44v-1.56M47.66 29.22l-.78 -1.04M52.34 29.22l.78 -1.04M46.1 30.78l-1.04 -.52M53.9 30.78l1.04 -.52M44.72 33.12q2.86 -2.08 5.72 -.52q2.86 1.56 5.72 -.52M44.72 35.2q3.38 -1.56 5.72 -.26q2.6 1.3 5.72 -.26', incl: ['1 character, bust (half or full body as add-on)', 'Full colour and shading', 'Simple background', 'High-res PNG + JPG'] },
      { key: 'poster', name: 'Poster / Comic Cover Illustration', desc: 'A full illustration for a poster or comic cover', price: p.pricePoster ?? 100, figure: 64, tarot: 'The Poster', numeral: 'III', sym: 'M52.08 31.56L52.73 33.12L54.29 33.77L52.73 34.42L52.08 35.98L51.43 34.42L49.87 33.77L51.43 33.12Z', ln: 'M44.8 23.76H55.2V36.24H44.8Z M44.8 28.96H49.48V36.24 M49.48 28.96L55.2 27.4 M48.7 25.84a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0', incl: ['Up to 5 characters (max 8)', 'Full scene background', 'Print-ready resolution', 'Space for title or logo'] },
      { key: 'design', name: 'Character / Creature Design + Sheets', desc: 'A new design with reference sheet', price: p.priceDesignSheet ?? 150, figure: 76, tarot: 'The Designer', numeral: 'IV', soft: 'M48.7 25.06a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0Z', sym: '', ln: 'M39.6 30a10.4 10.4 0 1 0 20.8 0a10.4 10.4 0 1 0 -20.8 0M48.7 25.06a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0M50 26.36v5.2M43.76 28.18h12.48M44.54 25.58l5.46 2.08 5.46 -2.08M50 31.56l-1.3 4.94M50 31.56l1.3 4.94M50 31.56l-3.64 3.9M50 31.56l3.64 3.9', ln2: 'M43.5 23.5h13v13h-13Z', incl: ['A new character or creature design', 'Front and back turnaround', 'Colour palette and details', 'Expression or prop sketches'] }
    ];
    const tier = TIERS.find((t) => t.key === s.tier) || TIERS[1];
    const tiers = TIERS.map((t) => {
      const on = t.key === s.tier;
      return {
        ...t, ln: t.ln || '', ln2: t.ln2 || '', soft: t.soft || '', dash: t.dash || 'none', cls: on ? 'on' : '', incl: t.incl.map((x) => ({ text: x })), aria: t.tarot + ': ' + t.name + ', from ' + money(t.price) + (on ? ', selected' : ''),
        priceLabel: cmoney(t.price),
        pressed: on ? 'true' : 'false',
        bg: on ? 'var(--ivbg, #FAF0E8)' : 'var(--s2, #211915)',
        fg: on ? 'var(--ivfg, #141414)' : 'var(--tx, #FAF0E8)',
        border: on ? accent : 'var(--ln, #382A22)',
        figBg: on ? accent : 'var(--ln, #4A382D)',
        pick: () => this.setState({ tier: t.key })
      };
    });

    const BGS = [
      { key: 'none', label: 'None', price: 0 },
      { key: 'simple', label: 'Simple', price: p.priceBgSimple ?? 20 },
      { key: 'detailed', label: 'Detailed scene', price: p.priceBgDetailed ?? 60 }
    ];
    const bgSel = BGS.find((b) => b.key === s.bg) || BGS[0];
    const bgs = BGS.map((b) => {
      const on = b.key === s.bg;
      return {
        ...b,
        priceLabel: b.price ? '+' + cmoney(b.price) : '',
        pressed: on ? 'true' : 'false',
        bg: on ? 'var(--ivbg, #FAF0E8)' : 'transparent',
        fg: on ? 'var(--ivfg, #141414)' : 'var(--tx, #FAF0E8)',
        border: on ? 'var(--ivbg, #FAF0E8)' : 'var(--ln, #4A382D)',
        pick: () => this.setState({ bg: b.key })
      };
    });

    const FRAMES = [
      { key: 'bust', label: 'Bust', price: 0 },
      { key: 'half', label: 'Half body', price: p.priceHalfBody ?? 15 },
      { key: 'full', label: 'Full body', price: p.priceFullBody ?? 25 }
    ];
    const showFrames = tier.key === 'illustration';
    const frameSel = FRAMES.find((f) => f.key === s.frame) || FRAMES[0];
    const frameCost = showFrames ? frameSel.price : 0;
    const frames = FRAMES.map((f) => {
      const on = f.key === frameSel.key;
      return { ...f, priceLabel: f.price ? '+' + cmoney(f.price) : 'included', pressed: on ? 'true' : 'false', bg: on ? 'var(--ivbg, #FAF0E8)' : 'transparent', fg: on ? 'var(--ivfg, #141414)' : 'var(--tx, #FAF0E8)', border: on ? 'var(--ivbg, #FAF0E8)' : 'var(--ln, #4A382D)', pick: () => this.setState({ frame: f.key }) };
    });
    const basePrice = tier.price + frameCost;

    const ADDONS = [
      { key: 'complex', label: 'Complex design', desc: 'Detailed outfits, markings, armour', price: p.addComplex ?? 15 },
      { key: 'expression', label: 'Extra expression', desc: 'An alternate face', price: p.addExpression ?? 10 },
      { key: 'outfit', label: 'Extra outfit', desc: 'An alternate outfit version', price: p.addOutfit ?? 20 },
      { key: 'rush', label: 'Rush delivery', desc: 'Front of the queue · % of the total price', pct: p.addRush ?? 65, price: 0 }
    ];
    const addSel = ADDONS.filter((a) => s.addons[a.key]);
    const addCost = addSel.reduce((t, a) => t + (a.pct != null ? 0 : a.price), 0);
    const rushSel = addSel.find((a) => a.pct != null);
    const addons = ADDONS.map((a) => {
      const on = !!s.addons[a.key];
      return { ...a, on, priceLabel: a.pct != null ? a.pct + '%' : cmoney(a.price), bg: on ? 'var(--s2, #2C211B)' : 'transparent', border: on ? accent : 'var(--ln, #4A382D)', toggle: () => this.setState({ addons: { ...s.addons, [a.key]: !on } }) };
    });

    // Additional characters: OC illustration and chibi, max 3 extra, each a % of the base price.
    // Poster / comic cover: up to 5 characters included, up to 8 in total.
    const POSTER_INCLUDED = 5, POSTER_MAX = 8, EXTRA_MAX = 3;
    const isPoster = tier.key === 'poster';
    const showChars = tier.key === 'illustration' || tier.key === 'chibi' || isPoster;
    const extraN = showChars && !isPoster ? Math.min(EXTRA_MAX, s.extra) : 0;
    const posterN = Math.min(POSTER_MAX, Math.max(1, s.posterChars));
    const posterExtraN = isPoster ? Math.max(0, posterN - POSTER_INCLUDED) : 0;
    const extraEach = basePrice * extraPct / 100;
    const extraCount = isPoster ? posterExtraN : extraN;
    const extraCost = extraEach * extraCount;
    const charsMin = isPoster ? 1 : 0;
    const charsMax = isPoster ? POSTER_MAX : EXTRA_MAX;
    const charsVal = isPoster ? posterN : extraN;
    const charsSpan = Math.max(1, charsMax - charsMin);
    const charsLv = (charsVal - charsMin) / charsSpan;
    const charsTicks = Array.from({ length: charsMax - charsMin + 1 }, (_, i) => ({ n: charsMin + i, p: (i / charsSpan * 100).toFixed(2), cls: charsMin + i <= charsVal ? 'lit' : '' }));
    const subtotal = basePrice + bgSel.price + extraCost + addCost;
    const commercialCost = s.commercial ? subtotal * commercialPct / 100 : 0;
    const beforeRush = subtotal + commercialCost;
    const rushCost = rushSel ? beforeRush * rushSel.pct / 100 : 0;
    const total = beforeRush + rushCost;

    const lines = [{ label: tier.name, amount: cmoney(tier.price) }];
    if (frameCost) lines.push({ label: frameSel.label, amount: '+' + cmoney(frameCost) });
    if (bgSel.price) lines.push({ label: 'Background: ' + bgSel.label.toLowerCase(), amount: '+' + cmoney(bgSel.price) });
    if (extraCount) lines.push({ label: extraCount + ' extra character' + (extraCount > 1 ? 's' : ''), amount: '+' + cmoney(extraCost) });
    addSel.forEach((a) => { if (a.pct == null) lines.push({ label: a.label, amount: '+' + cmoney(a.price) }); });
    if (s.commercial) lines.push({ label: 'Commercial use', amount: '+' + cmoney(commercialCost) });
    if (rushSel) lines.push({ label: 'Rush delivery (+' + rushSel.pct + '%)', amount: '+' + cmoney(rushCost) });

    const parts = [tier.name + (showFrames ? ' (' + frameSel.label.toLowerCase() + ')' : '')];
    if (bgSel.price) parts.push(bgSel.label.toLowerCase() + ' background');
    if (isPoster) parts.push(posterN + ' character' + (posterN > 1 ? 's' : ''));
    else if (extraN) parts.push('+' + extraN + ' character' + (extraN > 1 ? 's' : ''));
    addSel.forEach((a) => parts.push(a.label.toLowerCase()));
    if (s.commercial) parts.push('commercial');

    // Payment methods by region; links and details come from the Payment accounts tweaks.
    const safeLink = (u) => (typeof u === 'string' && /^https:\/\//i.test(u.trim())) ? u.trim() : '';
    // Opens the Google Form (proofFormLink) in a new tab, pre-filled with the request details.
    const openReqForm = (f) => {
      const base = safeLink(p.proofFormLink);
      if (!/docs\.google\.com\/forms\//i.test(base)) return;
      const q = { 798874226: f.name, 514363494: f.email, 2072207622: f.code, 2055556045: f.type, 413098599: f.what };
      const qs = Object.entries(q).filter(([, v]) => v).map(([k, v]) => 'entry.' + k + '=' + encodeURIComponent(v)).join('&');
      try { window.open(base.split('?')[0] + '?usp=pp_url&' + qs, '_blank', 'noopener'); } catch (e) {}
    };
    const region = s.region || (curSel.code === 'MYR' ? 'my' : 'intl');
    const regions = [
      { key: 'my', label: 'Malaysia' },
      { key: 'intl', label: 'Other countries' }
    ].map((r) => {
      const on = r.key === region;
      return { ...r, pressed: on ? 'true' : 'false', bg: on ? 'var(--ivbg, #FAF0E8)' : 'transparent', fg: on ? 'var(--ivfg, #141414)' : 'var(--tx, #FAF0E8)', border: on ? 'var(--ivbg, #FAF0E8)' : 'var(--ln, #4A382D)', pick: () => this.setState({ region: r.key, payMethod: '' }) };
    });
    const METHODS = {
      my: [
        { key: 'tng', name: "Touch 'n Go eWallet", desc: 'Pay with your TNG eWallet', link: safeLink(p.tngLink), details: p.tngDetails ?? '', cta: "Open TNG payment link", qr: 'img/97645a8f2d1a279e93be126ef74d6362.png', qrAlt: "Touch 'n Go eWallet DuitNow QR code for LEE CHI XUAN" },
        { key: 'bank', name: 'Bank transfer', desc: 'DuitNow or online banking', link: '', details: p.bankDetails ?? '', cta: '', qr: 'img/3cae68b1cd0514ca19e7a5b6a4820a0c.png', qrAlt: 'CIMB DuitNow QR code for LEE CHI XUAN' }
      ],
      intl: [
        { key: 'wise', name: 'Wise', desc: 'Low-fee international transfer', link: safeLink(p.wiseLink), details: '', cta: 'Pay with Wise' },
        ...(p.stripeEnabled === true ? [{ key: 'stripe', name: 'Stripe', desc: 'Credit or debit card', link: safeLink(p.stripeLink), details: '', cta: 'Pay by card with Stripe' }] : [])
      ]
    };
    const methodList = METHODS[region];
    const paySel = methodList.find((m) => m.key === s.payMethod) || methodList[0];
    const payMethods = methodList.map((m) => {
      const on = m.key === paySel.key;
      return { ...m, pressed: on ? 'true' : 'false', bg: on ? 'var(--ivbg, #FAF0E8)' : 'var(--s2, #211915)', fg: on ? 'var(--ivfg, #141414)' : 'var(--tx, #FAF0E8)', border: on ? accent : 'var(--ln, #382A22)', pick: () => this.setState({ payMethod: m.key }) };
    });
    const usesLink = paySel.key !== 'bank' && !paySel.qr;
    const pay = { name: paySel.name, details: paySel.details, hasDetails: !!(paySel.details && paySel.details.trim()), href: paySel.link, hasLink: !!paySel.link, missingLink: usesLink && !paySel.link, cta: paySel.cta, qr: paySel.qr || '', qrAlt: paySel.qrAlt || '', hasQr: !!paySel.qr };
    // ---- shop: prints, merch, cart ----
    const PSIZES = [
      { key: 'A5', price: p.printA5 ?? 12 },
      { key: 'A4', price: p.printA4 ?? 20 },
      { key: 'A3', price: p.printA3 ?? 32 }
    ];
    const pSel = PSIZES.find((z) => z.key === s.printSize) || PSIZES[1];
    const printSizes = PSIZES.map((z) => {
      const on = z.key === pSel.key;
      return { label: z.key, price: cmoney(z.price), pressed: on ? 'true' : 'false', bg: on ? '#F3E6D0' : 'transparent', fg: on ? '#2B1E16' : 'var(--tx, #FAF0E8)', border: on ? '#F3E6D0' : 'var(--ln, #4A382D)', pick: () => this.setState({ printSize: z.key }) };
    });
    const MERCH = [
      { key: 'stickers', name: '[Sticker sheet]', note: '[Size · finish]', price: 6, tone: '#F5D3C4' },
      { key: 'keychain', name: '[Acrylic keychain]', note: '[Size · charm details]', price: 10, tone: '#C8CCF5' },
      { key: 'pin', name: '[Enamel pin]', note: '[Size · finish]', price: 12, tone: '#D6E6D0' },
      { key: 'postcards', name: '[Postcard set]', note: '[Number of cards]', price: 8, tone: '#E8E1F7' },
      { key: 'tote', name: '[Tote bag]', note: '[Material · size]', price: 18, tone: '#F2E3B8' },
      { key: 'badge', name: '[Button badge]', note: '[Size]', price: 4, tone: '#CFE3EC' }
    ];
    const merch = MERCH.map((m, i) => {
      const up = !!s.merchUp[m.key];
      return {
        ...m, n: i + 1, price: money(m.price), sym: SYMBOLS[(i + 4) % SYMBOLS.length],
        soon: p.merchComingSoon !== false, avail: p.merchComingSoon === false,
        tone: p.merchComingSoon !== false ? 'radial-gradient(circle at 50% 45%, #2A1F18, #120E0C 75%)' : m.tone,
        cls: up ? '' : 'down', delay: s.merchStagger ? (i * 0.08).toFixed(2) : 0,
        frontHidden: up ? 'false' : 'true', frontTab: up ? 0 : -1,
        backHidden: up ? 'true' : 'false', backTab: up ? -1 : 0,
        reveal: () => this.setState({ merchUp: { ...this.state.merchUp, [m.key]: true }, merchStagger: false }),
        add: () => this.addToCart({ key: 'merch-' + m.key, title: m.name, variant: 'Siginnas', unitUSD: m.price, tone: m.tone })
      };
    });
    const merchAllUp = MERCH.every((m) => s.merchUp[m.key]);
    // Art prints use regional pricing (same as commissions); merch and shipping do not.
    const isPrintItem = (c) => c.key.indexOf('print-') === 0;
    const cartGrossFor = (adj) => s.cart.reduce((t, c) => t + c.unitUSD * (isPrintItem(c) ? adj : 1) * c.qty, 0);
    const cartGrossUSD = cartGrossFor(cAdj);
    const fortItem = s.fPct ? s.cart.filter((c) => c.key.indexOf('print-') === 0).sort((a, b) => b.unitUSD - a.unitUSD)[0] || null : null;
    const fortOffFor = (adj) => (fortItem ? fortItem.unitUSD * adj * s.fPct / 100 : 0);
    const fortOffUSD = fortOffFor(cAdj);
    // Shipping: Malaysia flat rate (RM, tracked courier) or overseas tracked airmail (USD). Free on 5+ art prints.
    const printQty = s.cart.filter((c) => c.key.indexOf('print-') === 0).reduce((t, c) => t + c.qty, 0);
    const FREE_SHIP_PRINTS = 5;
    const shipFree = printQty >= FREE_SHIP_PRINTS;
    const shipBaseUSD = region === 'my' ? (p.shipMalaysiaRM ?? 10) / (p.rateMYR ?? 4.08) : (p.shipOverseasUSD ?? 15);
    const shipUSD = s.cart.length && !shipFree ? shipBaseUSD : 0;
    const cartTotalUSD = cartGrossUSD - fortOffUSD + shipUSD;
    const shipLine = {
      label: region === 'my' ? 'Shipping · Malaysia (tracked courier)' : 'Shipping · Overseas (tracked airmail)',
      amount: shipFree ? 'Free' : (region === 'my' ? 'RM' + (p.shipMalaysiaRM ?? 10) : money(shipBaseUSD)),
      hint: shipFree ? '✦ Free shipping unlocked with ' + printQty + ' art prints' : (printQty > 0 ? 'Add ' + (FREE_SHIP_PRINTS - printQty) + ' more art print' + (FREE_SHIP_PRINTS - printQty === 1 ? '' : 's') + ' for free shipping' : 'Free shipping on 5 or more art prints'),
      free: shipFree
    };
    const cartCount = s.cart.reduce((t, c) => t + c.qty, 0);
    const cartItems = s.cart.map((c, idx) => ({
      ...c, unit: isPrintItem(c) ? cmoney(c.unitUSD) : money(c.unitUSD),
      inc: () => { const cart = this.state.cart.slice(); cart[idx] = { ...cart[idx], qty: cart[idx].qty + 1 }; this.setState({ cart }); },
      dec: () => { const cart = this.state.cart.slice(); if (cart[idx].qty > 1) cart[idx] = { ...cart[idx], qty: cart[idx].qty - 1 }; else cart.splice(idx, 1); this.setState({ cart }); }
    }));

    // Malaysian clients pay the Malaysian price in RM; others pay in USD at the selected currency's regional price.
    const payAmount = region === 'my'
      ? 'RM' + Math.round(total * (p.rateMYR ?? 4.08) * (p.adjMYR ?? 0.49)).toLocaleString('en-US')
      : 'US$' + Math.round(total * (curSel.code === 'MYR' ? 1 : cAdj)).toLocaleString('en-US');

    const slots = Array.from({ length: slotsTotal }, (_, i) => ({ bg: i < slotsTaken ? '#4A382D' : accent }));

    const STAGES = ['Queued', 'Sketching', 'Colouring', 'Final touches', 'Delivered'];
    // Queue comes from Tweaks → Commission queue → queueText: one line per order, "Name | Piece | Stage".
    // Stage can be a name (Queued, Sketching, Colouring, Final touches, Delivered) or a number 1–5.
    const QDEFAULT = 'Client A | Poster / Comic Cover Illustration | Final touches\nClient B | OC Illustration + simple background | Colouring\nClient C | Creature Design + Sheets | Sketching\nClient D | Chibi Character Stickers | Queued';
    const qText = (p.queueText ?? QDEFAULT);
    const queueIsExample = qText.trim() === QDEFAULT.trim();
    const parseStage = (v) => { const t = String(v || '').trim().toLowerCase(); const i = STAGES.findIndex((x) => x.toLowerCase() === t); if (i >= 0) return i; const n = parseInt(t, 10); return isNaN(n) ? 0 : Math.max(0, Math.min(STAGES.length - 1, n - 1)); };
    const queue = qText.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((a) => a[0]).map((a) => ({ client: a[0], piece: a[1] || '', step: parseStage(a[2]) })).map((q, qi) => ({ ...q, stage: STAGES[q.step], pct: Math.round(((q.step + 1) / STAGES.length) * 100), numeral: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][qi] || String(qi + 1), stepN: q.step + 1, phase: 'p' + q.step, moons: STAGES.map((_, i) => ({ cls: i < q.step ? 'done' : i === q.step ? 'cur' : 'todo' })) }));
    const stageLegend = STAGES.map((label, i) => ({ label, cls: 'leg p' + i }));

    const FAQS = [
      { q: 'How does the process work?', a: '[Describe your steps, e.g. brief → sketch approval → colour → final files.]' },
      { q: 'How and when do I pay?', a: '[Your payment terms and accepted methods.]' },
      { q: 'How long does a commission take?', a: '[Your usual turnaround time.]' },
      { q: 'How many revisions are included?', a: '[Your revision policy.]' },
      { q: 'What file will I receive?', a: '[File format, resolution and delivery method.]' }
    ];
    const faqs = FAQS.map((f, i) => {
      const on = s.faq === i;
      return { ...f, open: on, expanded: on ? 'true' : 'false', rot: on ? 45 : 0, toggle: () => this.setState({ faq: on ? -1 : i }) };
    });

    const rv = (k) => (s.revealReady && !s.seen[k] ? 'out' : 'in');
    const reveal = { about: rv('about'), work: rv('work'), commissions: rv('commissions'), terms: rv('terms'), merch: rv('merch') };
    const rnd = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
    const mkEmbers = (count, seed, min, max) => Array.from({ length: count }, (_, i) => ({
      x: (rnd(seed + i) * 100).toFixed(1), y: (rnd(seed + i + 50) * 100).toFixed(1),
      s: (min + rnd(seed + i + 90) * (max - min)).toFixed(1),
      d: (4 + rnd(seed + i + 130) * 4).toFixed(1), dl: (-rnd(seed + i + 170) * 6).toFixed(1)
    }));
    const embersFar = mkEmbers(14, 1, 1.5, 3);
    const embersNear = mkEmbers(12, 400, 2.5, 5);
    const sparkles = mkEmbers(11, 800, 7, 16);

    const closed = !open || slotsLeft === 0;

    const ld = s.loader || 'gone';
    const sceneCls = [ld === 'on' ? 'pre' : '', s.dayMode ? 'day' : ''].join(' ').trim();
    return {
      accent,
      nav: { about: s.activeSec === 'about' ? 'true' : 'false', work: s.activeSec === 'work' ? 'true' : 'false', merch: s.activeSec === 'merch' ? 'true' : 'false', commissions: (s.activeSec === 'commissions' || s.activeSec === 'terms') ? 'true' : 'false', contact: s.activeSec === 'contact' ? 'true' : 'false' },
      wwmDot: closed ? '#A8968A' : '#FFD6A3',
      portfolioHref: safeLink(p.portfolioLink) || '#work', portfolioTarget: safeLink(p.portfolioLink) ? '_blank' : '_self',
      fortune: (() => {
        this.allWorks = WORKS;
        const st = s.fStage || 'idle';
        const showTitle = s.fFlick || s.fWork;
        const w = WORKS.find((x) => x.title === showTitle);
        const pct = s.fPct;
        return {
          cls: 'st-' + st,
          hasImg: !!w, noImg: !w, img: w ? w.img : '', alt: w ? w.alt : '',
          title: s.fWork ? s.fWork : (st === 'drawing' ? 'Shuffling the stars…' : 'Not drawn yet'),
          deg: (s.fDeg || 0).toFixed(2),
          pctLabel: pct ? pct + '%' : (st === 'spinning' ? '…' : '?'),
          pctNote: pct ? 'off one art print' : 'Turn the dial to reveal',
          pct: pct || 0,
          canDraw: false, canSpin: (!pct || p.discountTestMode === true) && st !== 'spinning', done: !!pct,
          testMode: p.discountTestMode === true, spinLabel: pct ? '☾ Spin again (test mode)' : '☾ Turn the star dial',
          size: pSel.key, price: pct ? cmoney(pSel.price * (100 - pct) / 100) : cmoney(pSel.price),
          live: pct ? 'Your discount: ' + pct + '% off one art print' : ''
        };
      })(),
      fortuneDraw: this.fortuneDraw, fortuneSpin: this.fortuneSpin, fortuneShow: this.fortuneShow,
      fortuneAdd: () => { const w = WORKS.find((x) => x.title === s.fWork); if (w) this.addToCart({ key: 'print-' + w.title, title: w.title, variant: pSel.key + ' print', unitUSD: pSel.price, tone: w.tone }); },
      ship: shipLine, shipCls: shipFree ? 'free' : '', shipMY: p.shipMalaysiaRM ?? 10, shipIntl: money(p.shipOverseasUSD ?? 15),
      cartFortune: { on: !!fortItem, pct: s.fPct || 0, title: fortItem ? fortItem.title + (fortItem.variant ? ', ' + fortItem.variant : '') : '', amount: money(fortOffUSD) },
      refCode: s.refCode || 'MP-…',
      hasProofForm: !!safeLink(p.proofFormLink), proofHref: safeLink(p.proofFormLink) || '#',
      proofMail: 'mailto:mimipupu1608@gmail.com?subject=' + encodeURIComponent('Payment proof ' + (s.refCode || '')) + '&body=' + encodeURIComponent('Hi Mimipupu,\n\nHere is my payment receipt for order ' + (s.refCode || '') + ' (screenshot attached).\n\nName: \n'),
      ...(() => {
        const IV = '#F3E6D0';
        const EX = {
          chibi: [
            { src: 'img/28d1415b52d174f275440ab6af341917.webp', alt: 'Chibi of a pink-haired boy in a grey hoodie walking a grumpy pink cat', bg: IV },
            { src: 'img/d9e71796b924d17149c1f66ef6890e7f.webp', alt: 'Chibi of a blond fighter in a lilac suit carrying a glowing blue pickaxe', bg: IV }
          ],
          illustration: [
            { src: 'img/f175fd2675a183a7f368d243858a7319.webp', alt: 'Illustration of Ryomen Sukuna standing on a pile of horned skulls', bg: '#120E0C' },
            { src: 'img/285863942b7913a2d9af59099a702315.webp', alt: 'Illustration of Doctor Doom holding a severed crowned head and the Infinity Stones in green smoke', bg: '#120E0C' }
          ],
          poster: [
            { src: 'img/11013e2f6a85e69f60f7a3ff85d162ea.webp', alt: 'Paragons Chapter I comic cover poster with its full cast', bg: '#120E0C' },
            { src: 'img/9e64f6c2d72b72d87fc9050b4462c872.webp', alt: 'Sanctuary issue 4 comic cover: a figure holds a red flare in a misty alley', bg: '#120E0C' }
          ],
          design: [
            { src: 'img/ec5cc3472513faf5bdb0aa3f7e17b75a.webp', alt: 'Creature design sheet for Aurelius the Tyrant, a winged lion beast with transformation and scale studies', bg: '#120E0C' },
            { src: 'img/5af02d81d99103acdc825c972ff8e30c.webp', alt: 'Character design sheet for Edith Velmora the Foreseer, a blind old seer with a prosthetic arm and staff', bg: '#120E0C' }
          ]
        };
        const list = EX[tier.key] || [];
        const cur = (s.exOpen != null && s.exTier === tier.key) ? list[s.exOpen] : null;
        return {
          exTitle: (tier.tarot ? tier.tarot + ' · ' : '') + tier.name,
          examples: list.map((e, i) => ({ ...e, open: () => this.setState({ exOpen: i, exTier: tier.key }) })),
          exShow: !!cur, exImg: cur ? cur.src : '', exAlt: cur ? cur.alt : '', exBg: cur ? cur.bg : 'transparent',
          exClose: () => this.setState({ exOpen: null }),
          exKey: (e) => { if (e.key === 'Escape') this.setState({ exOpen: null }); }
        };
      })(),
      stageLegend, queueIsExample, stripeOn: p.stripeEnabled === true,
      accentText: s.dayMode ? '#A84A12' : accent,
      cylDraw: this.cylDraw, drawMsg: s.drawMsg || '',
      toggleSound: this.toggleSound, soundOn: !!s.soundOn, soundOff: !s.soundOn, soundPressed: s.soundOn ? 'true' : 'false', soundTitle: s.soundOn ? 'Turn ambient sound off' : 'Turn ambient sound on',
      sceneCls, loaderShow: ld !== 'gone', loaderCls: ld === 'hide' ? 'hide' : '',
      dayMode: !!s.dayMode, nightMode: !s.dayMode, dayPressed: s.dayMode ? 'true' : 'false',
      dayTitle: s.dayMode ? 'Switch to Night mode' : 'Switch to Day mode',
      toggleDay: () => { const v = !this.state.dayMode; this.setState({ dayMode: v }); try { window.localStorage.setItem('mimipupu-day', v ? '1' : '0'); } catch (e) {} },
      setRoot: this.setRoot, reveal, embersFar, embersNear, sparkles,
      prevSlides, nextSlides,
      tiltX: s.tiltX || 0, tiltY: s.tiltY || 0,
      tiltMove: (e) => {
        if (this.reduceMotion || e.pointerType === 'touch') return;
        const r = e.currentTarget.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        this.tiltNext = { tiltX: +(-py * 14).toFixed(1), tiltY: +(px * 18).toFixed(1) };
        if (!this.tiltRaf) this.tiltRaf = requestAnimationFrame(() => { this.tiltRaf = 0; if (this.tiltNext) this.setState(this.tiltNext); });
      },
      tiltLeave: () => { this.tiltNext = null; this.setState({ tiltX: 0, tiltY: 0 }); },
      navDots: [['top', 'Top'], ['about', 'About'], ['work', 'Prints'], ['commissions', 'Commissions'], ['terms', 'Terms'], ['merch', 'Merch'], ['contact', 'Contact']].map(([id, label]) => ({
        href: '#' + id, label, cls: s.activeSec === id ? 'on' : '', current: s.activeSec === id ? 'location' : 'false'
      })),
      printSizes, printPrice: cmoney(pSel.price),
      addPrint: () => { const w = shown[cOrder[cActive]]; if (w) this.addToCart({ key: 'print-' + w.title, title: w.title, variant: pSel.key + ' print', unitUSD: pSel.price, tone: w.tone }); },
      merchAllDown: MERCH.every((m) => !s.merchUp[m.key]) ? 'true' : 'false',
      merchFlipLabel: merchAllUp ? 'Flip all cards' : 'Reveal all cards',
      merchFlipAll: () => {
        const next = {};
        if (!merchAllUp) MERCH.forEach((m) => { next[m.key] = true; });
        clearTimeout(this.merchT);
        this.setState({ merchUp: next, merchStagger: !this.reduceMotion });
        this.merchT = setTimeout(() => this.setState({ merchStagger: false }), 1400);
      },
      merch, cartItems, cartCount, cartHasItems: cartCount > 0 && !s.orderDone, cartEmpty: cartCount === 0 && !s.orderDone,
      cartTotal: money(cartTotalUSD), cartAria: 'Cart, ' + cartCount + ' item' + (cartCount === 1 ? '' : 's'),
      cartPayAmount: (() => {
        const adjMY = p.adjMYR ?? 0.49, adjPay = curSel.code === 'MYR' ? 1 : cAdj;
        if (region === 'my') return 'RM' + Math.round((cartGrossFor(adjMY) - fortOffFor(adjMY) + shipUSD) * (p.rateMYR ?? 4.08)).toLocaleString('en-US');
        return 'US$' + Math.round(cartGrossFor(adjPay) - fortOffFor(adjPay) + shipUSD).toLocaleString('en-US');
      })(),
      payMethodNames: METHODS[region].map((m) => m.name).join(' or '),
      cartOpen: s.cartOpen, openCart: () => this.setState({ cartOpen: true, toast: '' }), closeCart: () => this.setState({ cartOpen: false }),
      cartKey: (e) => { if (e.key === 'Escape') { e.stopPropagation(); this.setState({ cartOpen: false }); } },
      toastOn: !!s.toast && !s.cartOpen, toastText: s.toast,
      orderDone: s.orderDone, orderName: s.orderName, orderEmail: s.orderEmail,
      orderHasError: !!s.orderErr, orderErr: s.orderErr,
      onOrderName: (e) => this.setState({ orderName: e.target.value }),
      onOrderEmail: (e) => this.setState({ orderEmail: e.target.value }),
      onOrderAddr: (e) => this.setState({ orderAddr: e.target.value }),
      placeOrder: () => {
        if (!s.orderName.trim()) return this.setState({ orderErr: 'Please add your name.' });
        if (!/^\S+@\S+\.\S+$/.test(s.orderEmail)) return this.setState({ orderErr: 'Please add a valid email address.' });
        if (s.orderAddr.trim().length < 8) return this.setState({ orderErr: 'Please add your shipping address.' });
        openReqForm({ name: s.orderName.trim(), email: s.orderEmail.trim(), code: s.refCode, type: 'Art print order', what: s.cart.map((c) => c.qty + ' × ' + c.title + (c.variant ? ' (' + c.variant + ')' : '')).join('\n') + '\nShip to: ' + s.orderAddr.trim() + '\nEstimated total: ' + money(cartTotalUSD) });
        this.setState({ orderDone: true, orderErr: '', cart: [], lastRef: this.state.refCode });
      },
      moons: cOrder.map((wi, i) => {
        // phase shape: full moon for the front card, waxing/waning crescents by distance
        let dd = (((i - cActive) % cN) + cN) % cN; if (dd > cN / 2) dd -= cN;
        // next to the front: half moon; further away: thinner crescents
        const sweep = dd < 0 ? 0 : 1, rx = (7 * Math.min(0.85, (Math.abs(dd) - 1) / 3)).toFixed(2);
        const d = dd === 0 ? 'M10 3 A7 7 0 1 1 10 17 A7 7 0 1 1 10 3Z'
          : 'M10 3 A7 7 0 0 ' + sweep + ' 10 17 A' + rx + ' 7 0 0 ' + (1 - sweep) + ' 10 3Z';
        return {
          d, cls: dd === 0 ? 'on' : '', current: dd === 0 ? 'true' : 'false',
          label: 'Card ' + (i + 1) + ': ' + shown[wi].title,
          go: () => { const cur = Math.round(this.state.cylRot); let d2 = (((i - cur) % cN) + cN) % cN; if (d2 > cN / 2) d2 -= cN; this.cylStepTo(cur + d2); }
        };
      }),
      cylCards, cylRf: cRf, cylDeg: (-cRot * cStep).toFixed(3), obsOuterDeg: (-cRot * cStep * 0.35).toFixed(3), obsZodDeg: (cRot * cStep * 0.6).toFixed(3), cylCur,
      cylStackCls: s.cylStacked ? 'stacked' : '',
      cylLive: s.cylAnim === false ? 'live' : s.cylAnim === 'spin' ? 'spin' : '', cylDragCls: s.cylDragging ? 'dragging' : '',
      cylPos: pad2(cActive + 1), cylTotal: pad2(gN), cylInfoCls: cActive % 2 ? 'b' : 'a',
      cylPrev: () => this.cylGo(-1), cylNext: () => this.cylGo(1), cylConfirm: () => openCard(cOrder[cActive]),
      cylCardRf: (cRf * (gathering ? 0.22 : 1) * (shown.some((w) => orient(w) === 'horizontal') ? 1.4 : 1)).toFixed(3),
      cylFlip: () => {
        if (this.cylBusy) return;
        const allDown = cOrder.length > 0 && cOrder.every((_, i) => this.state.cylDown[i]);
        const next = {};
        if (!allDown) cOrder.forEach((_, i) => { next[i] = true; });
        clearTimeout(this.flipAllT);
        this.setState({ cylDown: next, cylStagger: !this.reduceMotion, tiltX: 0, tiltY: 0 });
        this.flipAllT = setTimeout(() => this.setState({ cylStagger: false }), 1400);
      },
      cylFlipPressed: cOrder.length > 0 && cOrder.every((_, i) => s.cylDown[i]) ? 'true' : 'false',
      cylFlipLabel: cOrder.length > 0 && cOrder.every((_, i) => s.cylDown[i]) ? 'Reveal all cards' : 'Flip all cards',
      cylShuffle: this.cylShuffle,
      cylDown: this.cylDown, cylMove: this.cylMove, cylUp: this.cylUp,
      cylKey: (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); this.cylGo(1); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); this.cylGo(-1); }
        else if (e.key === 'Enter') openCard(cOrder[cActive]);
      },
      cards, cardCount: gN, hasDrawn: !!dw, noDrawn: !dw, drawnCard, flipCls: s.drawCount % 2 ? 'flipB' : 'flipA',
      shuffleCards: this.shuffleCards,
      returnCard: () => this.setState({ drawn: -1 }),
      zoomDrawn: () => { if (drawnI >= 0) this.setState({ lightbox: drawnI, zScale: 1, zX: 0, zY: 0 }); },
      zIn: this.zIn, zOut: this.zOut, zReset: this.zReset, zWheel: this.zWheel, zDbl: this.zDbl,
      zDown: this.zDown, zMove: this.zMove, zUp: this.zUp,
      zScale: s.zScale, zX: Math.round(s.zX), zY: Math.round(s.zY), zPct: Math.round(s.zScale * 100),
      zCls: (s.zScale > 1 ? 'zoomed' : '') + (s.zDragging ? ' dragging' : ''),
      zKey: (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); this.setState({ lightbox: -1 }); }
        else if (e.key === 'ArrowRight') this.setState({ lightbox: (s.lightbox + 1) % n, zScale: 1, zX: 0, zY: 0 });
        else if (e.key === 'ArrowLeft') this.setState({ lightbox: (s.lightbox - 1 + n) % n, zScale: 1, zX: 0, zY: 0 });
        else if (e.key === '+' || e.key === '=') this.zIn();
        else if (e.key === '-') this.zOut();
      },
      curOpen: s.curOpen, curExpanded: s.curOpen ? 'true' : 'false', curRot: s.curOpen ? 180 : 0,
      curCode: curSel.code, curFull: curSel.full, curSym: curSel.sym, curBorder: s.curOpen ? accent : 'var(--ln, #4A382D)',
      toggleCur: () => this.setState({ curOpen: !s.curOpen }),
      closeCur: () => this.setState({ curOpen: false }),
      curKey: (e) => { if (e.key === 'Escape' && s.curOpen) { e.stopPropagation(); this.setState({ curOpen: false }); } },
      galPrevTitle: (shown[prevI] || {}).title || '', galNextTitle: (shown[nextI] || {}).title || '',
      galDown: this.galDown, galMove: this.galMove, galUp: this.galUp, galKey: this.galKey,
      galPrev: () => this.galGo(-1), galNext: () => this.galGo(1),
      gal, galPos: pad2(gIdx + 1), galTotal: pad2(gN), galPct: gN ? Math.round(((gIdx + 1) / gN) * 100) : 0,
      galInfoCls: gIdx % 2 ? 'b' : 'a', galDragCls: (p.swipeEnabled === false ? '' : 'swipe') + (s.galDrag ? ' dragging' : ''),
      discordLabel: s.discordCopied ? 'Copied: mimipupu' : 'Discord: mimipupu',
      copyDiscord: () => {
        const done = () => { this.setState({ discordCopied: true }); clearTimeout(this.copyT); this.copyT = setTimeout(() => this.setState({ discordCopied: false }), 2000); };
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText('mimipupu').then(done, done);
          else done();
        } catch (e) { done(); }
      },
      statusLabel: closed ? 'Commissions closed' : 'Commissions open',
      statusBg: closed ? 'var(--s2, #2E231D)' : '#FFD6A3',
      statusFg: closed ? 'var(--tx2, #C4B2A5)' : '#3A1A06',
      slotsLeft, slotsTotal, slots, closed,
      filters, works,
      lbOpen, lb, lbPos: (s.lightbox + 1) + ' / ' + n,
      closeLb: () => this.setState({ lightbox: -1 }),
      prevLb: () => this.setState({ lightbox: (s.lightbox - 1 + n) % n, zScale: 1, zX: 0, zY: 0 }),
      nextLb: () => this.setState({ lightbox: (s.lightbox + 1) % n, zScale: 1, zX: 0, zY: 0 }),
      tiers, bgs, currencies, frames, showFrames, addons,
      converted: curSel.code !== 'USD',
      currencyNote: (curSel.code === 'USD' ? 'Prices in USD.' : 'Commission and art print prices in ' + curSel.code + ' are adjusted for the local market.') + ' Payment is in USD, or MYR for clients in Malaysia.',
      regions, payMethods, pay, payAmount,
      showChars, charsMin, charsMax, charsVal, charsTicks, charsLv: charsLv.toFixed(3), charsPct: (charsLv * 100).toFixed(2),
      charsLabel: isPoster ? 'Number of characters' : 'Additional characters',
      charsValue: isPoster ? posterN + ' / ' + POSTER_MAX : '+' + extraN,
      charsHint: isPoster ? 'Up to ' + POSTER_INCLUDED + ' characters included. Each character after that adds ' + cmoney(extraEach) + '.' : 'Up to ' + EXTRA_MAX + ' extra. Each adds ' + cmoney(extraEach) + '.',
      charsBorder: extraCount ? accent : 'var(--ln, #4A382D)',
      onChars: (e) => { const v = parseInt(e.target.value, 10) || 0; if (v !== charsVal && this.state.soundOn && this.ac) { const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5, 1567.98]; const k = Math.max(0, Math.min(notes.length - 1, v - charsMin + (v > charsVal ? 1 : 0))); this.bell(notes[k], 0.035 + 0.01 * ((v - charsMin) / charsSpan), 0, 1.6); } this.setState(isPoster ? { posterChars: v } : { extra: v }); },
      commercial: s.commercial,
      commercialPct,
      toggleCommercial: () => this.setState({ commercial: !s.commercial }),
      lines,
      total: cmoney(total),
      summaryLine: parts.join(', '),
      formTitle: closed ? 'Join the waitlist' : 'Send your request',
      submitLabel: closed ? 'Join waitlist' : 'Send request',
      showForm: !s.submitted,
      submitted: s.submitted,
      name: s.name,
      email: s.email,
      hasError: !!s.error,
      error: s.error,
      onName: (e) => this.setState({ name: e.target.value }),
      onEmail: (e) => this.setState({ email: e.target.value }),
      onBrief: (e) => this.setState({ brief: e.target.value }),
      submit: () => {
        if (!s.name.trim()) return this.setState({ error: 'Please add your name.' });
        if (!/^\S+@\S+\.\S+$/.test(s.email)) return this.setState({ error: 'Please add a valid email address.' });
        if (s.brief.trim().length < 10) return this.setState({ error: 'Tell me a little more about your idea.' });
        openReqForm({ name: s.name.trim(), email: s.email.trim(), code: s.refCode, type: 'Commission', what: parts.join(', ') + ' · estimated ' + cmoney(total) + '\n\n' + s.brief.trim() });
        this.setState({ submitted: true, error: '' });
        this.chime('seal');
      },
      reset: () => this.setState({ submitted: false, name: '', email: '', brief: '', error: '', refCode: this.newRef() }),
      queue, faqs
    };
  }
}

const DEFAULTS = {"accent": "#FF9A5C", "commissionsOpen": true, "discountTestMode": false, "merchComingSoon": true, "shipMalaysiaRM": 10, "shipOverseasUSD": 15, "adjMYR": 0.49, "adjEUR": 0.95, "adjGBP": 0.95, "adjSGD": 0.8, "adjAUD": 0.9, "adjJPY": 0.75, "slotsTotal": 5, "slotsTaken": 0, "priceChibi": 15, "priceIllustration": 70, "pricePoster": 100, "priceDesignSheet": 150, "priceHalfBody": 15, "priceFullBody": 25, "addComplex": 15, "addExpression": 10, "addOutfit": 20, "portfolioLink": "", "tngLink": "", "tngDetails": "LEE CHI XUAN\nScan the QR with Touch ’n Go or any Malaysian banking app.", "bankDetails": "CIMB Bank\nLEE CHI XUAN\n7074130182\nOr scan the DuitNow QR.", "wiseLink": "https://wise.com/pay/me/chixuanl3", "proofFormLink": "https://docs.google.com/forms/d/e/1FAIpQLScqOn7_OAXI7cuHO5C_3Hgs6A3yptwh2mUFmuf4StjQE1TvyA/viewform", "stripeEnabled": false, "queueText": "Client A | Poster / Comic Cover Illustration | Final touches\nClient B | OC Illustration + simple background | Colouring\nClient C | Creature Design + Sheets | Sketching\nClient D | Chibi Character Stickers | Queued", "stripeLink": "", "addRush": 65, "priceBgSimple": 20, "priceBgDetailed": 60, "extraCharPct": 50, "commercialPct": 50, "rateMYR": 4.08, "rateEUR": 0.845, "rateGBP": 0.722, "rateSGD": 1.29, "rateAUD": 1.43, "rateJPY": 156, "swipeEnabled": true, "printA5": 12, "printA4": 20, "printA3": 32};
const start = (content) => {
  const flat = {};
  Object.entries(content || {}).forEach(([k, v]) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(flat, v); else flat[k] = v;
  });
  const props = Object.assign({}, DEFAULTS, flat);
  window.DC.mount({ templateEl: document.getElementById('dc-tpl'), Component, props, container: document.getElementById('root') });
};
Promise.all(["commissions", "prices", "addons", "shop", "payment", "currency", "look", "prints"].map((n) => fetch('content/' + n + '.json', { cache: 'no-cache' }).then((r) => r.ok ? r.json() : {}).catch(() => ({}))))
  .then((parts) => start(Object.assign({}, ...parts)));
})();
