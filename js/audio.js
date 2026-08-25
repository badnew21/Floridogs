/* Floridogs — everything you hear is synthesised, so there are no audio assets to ship. */
(function (global) {
  'use strict';

  var A = { enabled: true, ctx: null, mic: null, micOn: false, micLevel: 0, micPeak: 0 };
  var noiseBuf = null;

  function ac() {
    if (!A.ctx) {
      var C = global.AudioContext || global.webkitAudioContext;
      if (!C) return null;
      A.ctx = new C();
    }
    if (A.ctx.state === 'suspended') A.ctx.resume();
    return A.ctx;
  }
  A.unlock = function () { ac(); };

  function noise(ctx) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    return src;
  }

  function env(ctx, node, t0, attack, hold, release, peak) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.setValueAtTime(peak, t0 + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
    node.connect(g);
    return g;
  }

  /* A bark: a short noisy burst pushed through a moving band-pass, plus a voiced tone. */
  A.bark = function (pitch, big, bay) {
    if (!A.enabled) return;
    var ctx = ac(); if (!ctx) return;
    var t = ctx.currentTime;
    pitch = pitch || 1;
    var base = (big ? 160 : 260) * pitch;
    var dur = bay ? 0.62 : 0.25;

    var osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    if (bay) {
      /* a hound's bay: rises, holds, then falls away */
      osc.frequency.setValueAtTime(base * 1.15, t);
      osc.frequency.exponentialRampToValueAtTime(base * 1.75, t + 0.14);
      osc.frequency.setValueAtTime(base * 1.75, t + 0.3);
      osc.frequency.exponentialRampToValueAtTime(base * 0.85, t + dur);
    } else {
      osc.frequency.setValueAtTime(base * 1.6, t);
      osc.frequency.exponentialRampToValueAtTime(base * 0.75, t + 0.13);
    }

    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = bay ? 5.5 : 3.2;
    bp.frequency.setValueAtTime(base * (bay ? 3.0 : 4.2), t);
    bp.frequency.exponentialRampToValueAtTime(base * 1.7, t + (bay ? 0.4 : 0.15));

    var n = noise(ctx);
    var ng = ctx.createGain(); ng.gain.value = bay ? 0.2 : 0.5;
    n.connect(ng); ng.connect(bp);
    osc.connect(bp);

    var g = bay ? env(ctx, bp, t, 0.05, 0.28, 0.3, 0.3)
                : env(ctx, bp, t, 0.012, 0.035, 0.13, 0.32);
    g.connect(ctx.destination);
    osc.start(t); n.start(t);
    osc.stop(t + dur + 0.1); n.stop(t + dur + 0.1);
  };

  A.whine = function () {
    if (!A.enabled) return;
    var ctx = ac(); if (!ctx) return;
    var t = ctx.currentTime;
    var o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(520, t);
    o.frequency.linearRampToValueAtTime(760, t + 0.18);
    o.frequency.linearRampToValueAtTime(430, t + 0.5);
    var g = env(ctx, o, t, 0.05, 0.18, 0.3, 0.14);
    g.connect(ctx.destination);
    o.start(t); o.stop(t + 0.6);
  };

  A.pant = function () {
    if (!A.enabled) return;
    var ctx = ac(); if (!ctx) return;
    var t = ctx.currentTime;
    for (var i = 0; i < 2; i++) {
      var n = noise(ctx);
      var f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 900 + i * 200; f.Q.value = 1.1;
      n.connect(f);
      var g = env(ctx, f, t + i * 0.16, 0.02, 0.02, 0.09, 0.07);
      g.connect(ctx.destination);
      n.start(t + i * 0.16); n.stop(t + i * 0.16 + 0.2);
    }
  };

  A.whistle = function () {
    if (!A.enabled) return;
    var ctx = ac(); if (!ctx) return;
    var t = ctx.currentTime;
    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(1700, t + 0.18);
    o.frequency.exponentialRampToValueAtTime(1200, t + 0.42);
    var g = env(ctx, o, t, 0.03, 0.24, 0.16, 0.16);
    g.connect(ctx.destination);
    o.start(t); o.stop(t + 0.55);
  };

  A.blip = function (freq, dur, type, vol) {
    if (!A.enabled) return;
    var ctx = ac(); if (!ctx) return;
    var t = ctx.currentTime;
    var o = ctx.createOscillator();
    o.type = type || 'square';
    o.frequency.value = freq || 880;
    var g = env(ctx, o, t, 0.005, dur || 0.04, 0.05, vol || 0.09);
    g.connect(ctx.destination);
    o.start(t); o.stop(t + (dur || 0.04) + 0.12);
  };

  A.chime = function (up) {
    if (!A.enabled) return;
    var notes = up ? [660, 880, 1320] : [880, 660, 440];
    notes.forEach(function (f, i) { setTimeout(function () { A.blip(f, 0.07, 'triangle', 0.11); }, i * 70); });
  };

  A.thud = function (vol) {
    if (!A.enabled) return;
    var ctx = ac(); if (!ctx) return;
    var t = ctx.currentTime;
    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.12);
    var g = env(ctx, o, t, 0.005, 0.02, 0.12, vol || 0.13);
    g.connect(ctx.destination);
    o.start(t); o.stop(t + 0.2);
  };

  A.splash = function () {
    if (!A.enabled) return;
    var ctx = ac(); if (!ctx) return;
    var t = ctx.currentTime;
    var n = noise(ctx);
    var f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(2600, t + 0.3);
    n.connect(f);
    var g = env(ctx, f, t, 0.02, 0.1, 0.28, 0.1);
    g.connect(ctx.destination);
    n.start(t); n.stop(t + 0.5);
  };

  /* Optional microphone: clapping or calling the dog's name brings it running,
     the same way the DS mic worked. Permission is only requested on a tap. */
  A.toggleMic = function (cb) {
    if (A.micOn) {
      if (A.mic && A.mic.stream) A.mic.stream.getTracks().forEach(function (t) { t.stop(); });
      A.mic = null; A.micOn = false; A.micLevel = 0;
      cb && cb(false);
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { cb && cb(false, 'no-mic'); return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var ctx = ac(); if (!ctx) return;
      var src = ctx.createMediaStreamSource(stream);
      var an = ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      A.mic = { stream: stream, analyser: an, data: new Uint8Array(an.frequencyBinCount) };
      A.micOn = true;
      cb && cb(true);
    }).catch(function () { cb && cb(false, 'denied'); });
  };

  A.sampleMic = function () {
    if (!A.micOn || !A.mic) { A.micLevel = 0; return 0; }
    var an = A.mic.analyser, data = A.mic.data;
    an.getByteTimeDomainData(data);
    var sum = 0;
    for (var i = 0; i < data.length; i++) { var v = (data[i] - 128) / 128; sum += v * v; }
    var rms = Math.sqrt(sum / data.length);
    A.micLevel = rms;
    if (rms > A.micPeak) A.micPeak = rms; else A.micPeak *= 0.92;
    return rms;
  };

  global.FD = global.FD || {};
  global.FD.Audio = A;
})(window);
