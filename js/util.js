/* Floridogs — shared helpers */
(function (global) {
  'use strict';

  var U = {};

  U.clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.smooth = function (t) { return t * t * (3 - 2 * t); };
  U.approach = function (cur, target, rate, dt) { return U.lerp(cur, target, 1 - Math.pow(1 - rate, dt * 60)); };
  U.dist = function (ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); };
  U.rand = function (a, b) { return a + Math.random() * (b - a); };
  U.randInt = function (a, b) { return Math.floor(U.rand(a, b + 1)); };
  U.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  U.chance = function (p) { return Math.random() < p; };
  U.now = function () { return Date.now(); };

  /* Deterministic RNG so a dog's freckles land in the same place every session. */
  U.seeded = function (seed) {
    var s = seed >>> 0 || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  };
  U.hash = function (str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };

  U.save = function (key, obj) {
    try { localStorage.setItem(key, JSON.stringify(obj)); return true; } catch (e) { return false; }
  };
  U.load = function (key) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  };
  U.wipe = function (key) { try { localStorage.removeItem(key); } catch (e) {} };

  /* Rounded rect that works everywhere (Safari lacked roundRect for a long time). */
  U.roundRect = function (ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  U.text = function (ctx, str, x, y, opts) {
    opts = opts || {};
    ctx.save();
    ctx.font = (opts.weight || '') + ' ' + (opts.size || 10) + 'px ' + (opts.font || '"Trebuchet MS", system-ui, sans-serif');
    ctx.textAlign = opts.align || 'left';
    ctx.textBaseline = opts.baseline || 'alphabetic';
    if (opts.outline) {
      ctx.lineWidth = opts.outlineWidth || 3;
      ctx.strokeStyle = opts.outline;
      ctx.lineJoin = 'round';
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = opts.color || '#3a3226';
    ctx.fillText(str, x, y);
    ctx.restore();
  };

  U.wrapText = function (ctx, str, maxWidth, size) {
    ctx.save();
    ctx.font = size + 'px "Trebuchet MS", system-ui, sans-serif';
    var words = String(str).split(' '), lines = [], line = '';
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = words[i]; }
      else line = test;
    }
    if (line) lines.push(line);
    ctx.restore();
    return lines;
  };

  /* Heart shape used all over the Nintendogs UI. */
  U.heart = function (ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.32);
    ctx.bezierCurveTo(x - s * 0.15, y - s * 0.28, x - s, y + s * 0.06, x, y + s);
    ctx.bezierCurveTo(x + s, y + s * 0.06, x + s * 0.15, y - s * 0.28, x, y + s * 0.32);
    ctx.closePath();
  };

  U.star = function (ctx, x, y, r) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5;
      var rr = i % 2 ? r * 0.45 : r;
      ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  };

  U.shadow = function (ctx, x, y, rx, ry, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 0.22 : alpha;
    ctx.fillStyle = '#1d2a16';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  U.formatClock = function (mins) {
    var h = Math.floor(mins / 60) % 24, m = Math.floor(mins % 60);
    var ampm = h < 12 ? 'AM' : 'PM';
    var hh = h % 12; if (hh === 0) hh = 12;
    return hh + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
  };

  global.FD = global.FD || {};
  global.FD.U = U;
})(window);
