/* Floridogs — screens, stylus gestures and the two-screen HUD.
   The bottom screen is the touch screen: every interaction lives there.
   The top screen is read-only status, like the DS original. */
(function (global) {
  'use strict';
  var U = global.FD.U, G = global.FD.Game, R = global.FD.Render, S = global.FD.Scenes, Audio = global.FD.Audio;

  var W = 256, H = 192;
  var TRAY_Y = 162, TRAY_H = 30;

  var UI = {
    screen: 'title',        /* title | adopt | home | walk | contest | menu | shop | status */
    tool: 'hand',
    overlay: null,          /* menu | shop | tricks | care | confirm */
    heldItem: null,         /* item being dragged from the tray */
    buttons: [],
    toast: null,
    t: 0,
    hint: '',
    trickPanel: false,
    confirm: null,
    micHint: 0
  };

  var TOOLS = [
    { id: 'hand', label: 'Pet' },
    { id: 'brush', label: 'Brush' },
    { id: 'shampoo', label: 'Wash' },
    { id: 'food', label: 'Food' },
    { id: 'water', label: 'Water' },
    { id: 'treat', label: 'Treat' },
    { id: 'ball', label: 'Ball' },
    { id: 'disc', label: 'Disc' },
    { id: 'menu', label: 'Menu' }
  ];

  /* ------------------------------------------------------------ ui helpers */
  function beginFrame() { UI.buttons.length = 0; }

  function btn(ctx, id, x, y, w, h, label, opts) {
    opts = opts || {};
    UI.buttons.push({ id: id, x: x, y: y, w: w, h: h, data: opts.data });
    var active = opts.active;
    ctx.save();
    U.roundRect(ctx, x, y, w, h, opts.r === undefined ? 6 : opts.r);
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    if (opts.danger) { g.addColorStop(0, '#f19a92'); g.addColorStop(1, '#d9584e'); }
    else if (active) { g.addColorStop(0, '#ffd98a'); g.addColorStop(1, '#f0a83c'); }
    else { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#dfe8ef'); }
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = active ? '#c8802a' : '#9fb3c4';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    if (label) {
      U.text(ctx, label, x + w / 2, y + h / 2 + (opts.size || 10) * 0.36, {
        size: opts.size || 10, align: 'center', color: opts.color || '#3d4a57', weight: 'bold'
      });
    }
    ctx.restore();
    return { x: x, y: y, w: w, h: h };
  }

  function panel(ctx, x, y, w, h, title) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.28)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
    U.roundRect(ctx, x, y, w, h, 8);
    ctx.fillStyle = '#fffdf6';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#e3b978'; ctx.lineWidth = 2; ctx.stroke();
    if (title) {
      U.roundRect(ctx, x, y, w, 20, 8);
      ctx.fillStyle = '#f0b64f'; ctx.fill();
      ctx.fillRect(x, y + 14, w, 6);
      ctx.fillStyle = '#f0b64f';
      U.text(ctx, title, x + w / 2, y + 14, { size: 11, align: 'center', color: '#5c3d12', weight: 'bold' });
    }
    ctx.restore();
  }

  function hit(px, py) {
    for (var i = UI.buttons.length - 1; i >= 0; i--) {
      var b = UI.buttons[i];
      if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return b;
    }
    return null;
  }

  UI.toastMsg = function (msg) { UI.toast = { text: msg, life: 2.2 }; };

  /* ----------------------------------------------------------- tool icons */
  function drawToolIcon(ctx, id, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    switch (id) {
      case 'hand':
        ctx.fillStyle = '#f3c9a3';
        U.roundRect(ctx, -5, -2, 10, 11, 4); ctx.fill();
        ctx.fillStyle = '#f8d8b8';
        for (var i = 0; i < 4; i++) { U.roundRect(ctx, -5 + i * 2.7, -9 + (i === 0 ? 2 : 0), 2.2, 8, 1.1); ctx.fill(); }
        break;
      case 'brush': S.brush(ctx, 0, 2, 0); break;
      case 'shampoo': S.shampoo(ctx, 0, 3); break;
      case 'food': S.bowl(ctx, 0, 4, 1, 'food'); break;
      case 'water': S.bowl(ctx, 0, 4, 1, 'water'); break;
      case 'treat': S.bone(ctx, 0, 1, 0.85); break;
      case 'ball': S.ball(ctx, 0, 1, 7, 0); break;
      case 'disc': S.disc(ctx, 0, 2, 9, 0.15, 0); break;
      case 'menu':
        ctx.fillStyle = '#5c6b7a';
        for (var m = 0; m < 3; m++) U.roundRect(ctx, -7, -6 + m * 5, 14, 3, 1.5), ctx.fill();
        break;
    }
    ctx.restore();
  }

  function drawTray(ctx) {
    ctx.save();
    var g = ctx.createLinearGradient(0, TRAY_Y, 0, H);
    g.addColorStop(0, '#f6efe0');
    g.addColorStop(1, '#e4d6bd');
    ctx.fillStyle = g;
    ctx.fillRect(0, TRAY_Y, W, TRAY_H);
    ctx.strokeStyle = '#c8b18c'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, TRAY_Y + 0.5); ctx.lineTo(W, TRAY_Y + 0.5); ctx.stroke();
    ctx.restore();

    var n = TOOLS.length, cw = W / n;
    for (var i = 0; i < n; i++) {
      var t = TOOLS[i], x = i * cw, sel = UI.tool === t.id && t.id !== 'menu';
      UI.buttons.push({ id: 'tool:' + t.id, x: x, y: TRAY_Y, w: cw, h: TRAY_H });
      if (sel) {
        U.roundRect(ctx, x + 1.5, TRAY_Y + 2, cw - 3, TRAY_H - 4, 5);
        ctx.fillStyle = '#ffd98a'; ctx.fill();
        ctx.strokeStyle = '#dc9a2c'; ctx.lineWidth = 1.4; ctx.stroke();
      }
      drawToolIcon(ctx, t.id, x + cw / 2, TRAY_Y + 12, 0.95);
      U.text(ctx, t.label, x + cw / 2, TRAY_Y + 27, { size: 7, align: 'center', color: '#6b5a3e', weight: 'bold' });
      /* stock counts */
      var stock = t.id === 'food' ? G.inventory.food : t.id === 'water' ? G.inventory.water :
                  t.id === 'treat' ? G.inventory.treats : t.id === 'shampoo' ? G.inventory.shampoo : null;
      if (stock !== null) {
        ctx.fillStyle = stock > 0 ? '#5e8f4a' : '#c1503f';
        ctx.beginPath(); ctx.arc(x + cw - 7, TRAY_Y + 7, 6, 0, Math.PI * 2); ctx.fill();
        U.text(ctx, String(stock), x + cw - 7, TRAY_Y + 10, { size: 8, align: 'center', color: '#fff', weight: 'bold' });
      }
    }
  }

  /* -------------------------------------------------------------- emotes */
  function drawEmote(ctx, em) {
    var a = U.clamp(em.life, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(em.x, em.y);
    var s = 1 + (1 - a) * 0.4;
    ctx.scale(s, s);
    switch (em.kind) {
      case 'heart':
        U.heart(ctx, 0, -6, 7); ctx.fillStyle = '#ef6b8a'; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
        break;
      case 'note':
        ctx.fillStyle = '#4a7fc1';
        ctx.beginPath(); ctx.ellipse(-2, 0, 3.2, 2.4, -0.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(0.6, -9, 1.6, 9);
        ctx.beginPath(); ctx.moveTo(2.2, -9); ctx.quadraticCurveTo(7, -8, 5.4, -4); ctx.lineTo(2.2, -5); ctx.closePath(); ctx.fill();
        break;
      case 'star': U.star(ctx, 0, -4, 6); ctx.fillStyle = '#f5cd4b'; ctx.fill(); break;
      case 'question':
        U.text(ctx, '?', 0, 0, { size: 14, align: 'center', color: '#5a6b7c', weight: 'bold', outline: '#fff' });
        break;
      case 'sparkle':
        U.star(ctx, 0, -3, 4); ctx.fillStyle = '#ffffff'; ctx.fill();
        break;
      case 'bubble':
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath(); ctx.arc(0, -3, 4.2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(140,190,220,0.9)'; ctx.lineWidth = 1; ctx.stroke();
        break;
      case 'crumb':
        ctx.fillStyle = '#8a5a34';
        ctx.beginPath(); ctx.arc(0, 0, 1.6, 0, Math.PI * 2); ctx.fill();
        break;
      case 'zzz':
        U.text(ctx, 'z', 0, 0, { size: 11, align: 'center', color: '#7f8fa3', weight: 'bold', outline: '#fff' });
        break;
    }
    ctx.restore();
  }

  function drawZzz(ctx, d, t) {
    for (var i = 0; i < 3; i++) {
      var ph = (t * 0.5 + i * 0.33) % 1;
      ctx.save();
      ctx.globalAlpha = 1 - ph;
      var s = d.spec.build.scale * (d.scale || 1);
      var x = d.x + (d.pose.hdX * s + 12) * d.facing + ph * 10, y = d.y + d.pose.hdY * s - 8 - ph * 22;
      U.text(ctx, 'z', x, y, { size: 8 + ph * 6, align: 'center', color: '#5d7089', weight: 'bold', outline: '#fff', outlineWidth: 2 });
      ctx.restore();
    }
  }

  /* --------------------------------------------------------- top screen -- */
  function needBar(ctx, x, y, w, label, v, color) {
    U.text(ctx, label, x, y + 7, { size: 8, color: '#4c4438', weight: 'bold' });
    var bx = x + 34, bw = w - 34;
    U.roundRect(ctx, bx, y, bw, 8, 4);
    ctx.fillStyle = '#e2dccd'; ctx.fill();
    U.roundRect(ctx, bx + 1, y + 1, Math.max(2, (bw - 2) * v), 6, 3);
    ctx.fillStyle = v < 0.25 ? '#d95a4a' : color;
    ctx.fill();
    if (v < 0.25) {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(UI.t * 6) * 0.5;
      U.text(ctx, '!', bx + bw + 5, y + 7, { size: 9, color: '#d33', weight: 'bold' });
      ctx.restore();
    }
  }

  /* The DS top screen is a second camera on your dog, with a slim info bar —
     status detail lives in the Care menu, as it does in the original. */
  UI.drawTop = function (ctx, t) {
    var d = G.dog();
    if (UI.screen === 'title' || !d) { drawTitleTop(ctx, t); return; }

    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();

    /* camera: a gentle push-in that follows her around the room */
    var camX = U.clamp(d.x, 100, 156), Z = 1.34;
    ctx.translate(128, 128);
    ctx.scale(Z, Z);
    ctx.translate(-camX, -132);

    if (G.mode === 'walk' && G.walk) {
      S.street(ctx, G.walk.scroll, t, G.hour);
      d.y = 146; R.drawDog(ctx, d, t);
    } else if (G.mode === 'contest' && G.contest) {
      S.field(ctx, 0, t);
      if (G.contest.disc) S.disc(ctx, G.contest.disc.x, G.contest.disc.y - G.contest.disc.z, 11, 0.4, G.contest.disc.spin);
      R.drawDog(ctx, d, t);
    } else {
      S.livingRoom(ctx, t, G.hour);
      S.bowl(ctx, G.foodBowl.x, G.foodBowl.y, G.bowls.food, 'food');
      S.bowl(ctx, G.waterBowl.x, G.waterBowl.y, G.bowls.water, 'water');
      var other = G.other();
      if (other) { other.x = 40; other.y = 108; other.facing = 1; other.scale = 0.72; R.drawDog(ctx, other, t); }
      G.toys.forEach(function (toy) {
        if (toy.kind === 'ball') S.ball(ctx, toy.x, toy.y - toy.z, 6, toy.spin);
        else S.disc(ctx, toy.x, toy.y - toy.z, 10, U.clamp(toy.z / 60, 0, 0.6), toy.spin);
      });
      R.drawDog(ctx, d, t);
      if (d.behavior === 'sleep') drawZzz(ctx, d, t);
    }
    G.emotes.forEach(function (em) { drawEmote(ctx, em); });
    ctx.restore();

    S.tint(ctx, G.hour, W, H);

    /* latest message as a soft banner across the top */
    var msg = G.messages[0];
    if (msg && Date.now() - msg.t < 6000) {
      ctx.save();
      ctx.globalAlpha = U.clamp((6000 - (Date.now() - msg.t)) / 900, 0, 1);
      U.roundRect(ctx, 8, 6, W - 16, 20, 10);
      ctx.fillStyle = 'rgba(255,253,246,0.92)'; ctx.fill();
      ctx.strokeStyle = 'rgba(224,185,120,0.9)'; ctx.lineWidth = 1.4; ctx.stroke();
      var col = msg.kind === 'good' ? '#3f7a3a' : msg.kind === 'warn' ? '#a8562c' : '#4c4438';
      var lines = U.wrapText(ctx, msg.text, W - 40, 9);
      U.text(ctx, lines[0] + (lines.length > 1 ? '…' : ''), W / 2, 20, { size: 9, align: 'center', color: col, weight: 'bold' });
      ctx.restore();
    }

    /* mode readouts sit above the info bar */
    if (G.mode === 'walk' && G.walk) {
      var pr = U.clamp(G.walk.distance / G.walk.target, 0, 1);
      ctx.save();
      U.roundRect(ctx, 40, 136, 176, 16, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
      U.roundRect(ctx, 43, 139, Math.max(3, 170 * pr), 10, 5);
      ctx.fillStyle = '#7fc26a'; ctx.fill();
      U.text(ctx, Math.round(G.walk.distance) + ' / ' + G.walk.target + ' steps · found ' + G.walk.picked,
        128, 147, { size: 8, align: 'center', color: '#4c4438', weight: 'bold' });
      ctx.restore();
    } else if (G.mode === 'contest' && G.contest) {
      ctx.save();
      U.roundRect(ctx, 60, 132, 136, 22, 11);
      ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.fill();
      U.text(ctx, 'Score ' + G.contest.score, 72, 148, { size: 12, color: '#3f3527', weight: 'bold' });
      U.text(ctx, Math.ceil(G.contest.time) + 's', 186, 148, { size: 12, align: 'right', color: G.contest.time < 10 ? '#d33' : '#3f3527', weight: 'bold' });
      ctx.restore();
    }

    drawInfoBar(ctx, d, t);
  };

  /* Name, hearts, clock and coins — everything else is a menu away. */
  function drawInfoBar(ctx, d, t) {
    var barY = H - 30;
    ctx.save();
    var g = ctx.createLinearGradient(0, barY, 0, H);
    g.addColorStop(0, 'rgba(255,251,240,0.94)');
    g.addColorStop(1, 'rgba(240,228,201,0.96)');
    ctx.fillStyle = g;
    ctx.fillRect(0, barY, W, 30);
    ctx.strokeStyle = 'rgba(200,177,140,0.9)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, barY + 0.5); ctx.lineTo(W, barY + 0.5); ctx.stroke();
    ctx.restore();

    /* portrait medallion */
    ctx.save();
    ctx.beginPath(); ctx.arc(20, barY + 15, 13, 0, Math.PI * 2);
    ctx.fillStyle = '#e8f2f8'; ctx.fill();
    ctx.strokeStyle = '#d6b884'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.clip();
    R.drawPortrait(ctx, d.rec, d.spec, 18, barY + 16, 26, t);
    ctx.restore();

    U.text(ctx, d.rec.name, 37, barY + 13, { size: 11, color: '#3f3527', weight: 'bold' });
    var hearts = G.hearts(d.rec);
    for (var i = 0; i < 5; i++) {
      U.heart(ctx, 41 + i * 10, barY + 18, 4);
      ctx.fillStyle = i < hearts ? '#ef6b8a' : '#e2dccd';
      ctx.fill();
    }

    /* needs shown as small coloured pips; they flash when something runs low */
    var n = d.rec.needs;
    var pips = [
      { v: n.hunger, c: '#e0913c' }, { v: n.thirst, c: '#4ba3d8' }, { v: n.mood, c: '#e2688f' },
      { v: n.clean, c: '#7fc26a' }, { v: n.energy, c: '#b184d4' }
    ];
    for (var p = 0; p < pips.length; p++) {
      var x = 110 + p * 13;
      U.roundRect(ctx, x, barY + 8, 11, 14, 3);
      ctx.fillStyle = '#e6dfd0'; ctx.fill();
      var h2 = Math.max(2, 12 * pips[p].v);
      U.roundRect(ctx, x + 1, barY + 21 - h2, 9, h2, 2.5);
      ctx.fillStyle = pips[p].v < 0.25 ? (Math.sin(UI.t * 8) > 0 ? '#d95a4a' : '#f0a094') : pips[p].c;
      ctx.fill();
    }

    ctx.fillStyle = '#e8c25a';
    ctx.beginPath(); ctx.arc(180, barY + 15, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c39a34'; ctx.lineWidth = 1; ctx.stroke();
    U.text(ctx, String(G.coins), 189, barY + 19, { size: 10, color: '#4c4438', weight: 'bold' });
    U.text(ctx, U.formatClock(G.clock), W - 5, barY + 13, { size: 9, align: 'right', color: '#6b6152', weight: 'bold' });
    U.text(ctx, 'Day ' + G.day, W - 5, barY + 24, { size: 8, align: 'right', color: '#8b8271' });
  }

  function drawTitleTop(ctx, t) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#8ed5f0');
    g.addColorStop(0.65, '#cfeefb');
    g.addColorStop(0.651, '#7fbe63');
    g.addColorStop(1, '#5e9a49');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    /* sun and palms */
    ctx.fillStyle = '#ffe07a';
    ctx.beginPath(); ctx.arc(212, 34, 18, 0, Math.PI * 2); ctx.fill();
    for (var p = 0; p < 3; p++) {
      var px = 30 + p * 96;
      ctx.strokeStyle = '#8a6a3c'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(px, 130); ctx.quadraticCurveTo(px - 6, 100, px + 4, 78); ctx.stroke();
      ctx.fillStyle = '#4f8f4a';
      for (var f = 0; f < 6; f++) {
        var a = -Math.PI * 0.95 + f * 0.36 + Math.sin(t + p) * 0.03;
        ctx.beginPath();
        ctx.ellipse(px + 4 + Math.cos(a) * 16, 78 + Math.sin(a) * 8, 18, 5, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    U.text(ctx, 'FLORIDOGS', 128, 60, { size: 34, align: 'center', color: '#ef7a3d', weight: 'bold', outline: '#fff', outlineWidth: 7 });
    U.text(ctx, 'a sunshine state puppy sim', 128, 78, { size: 10, align: 'center', color: '#3f6b8a', weight: 'bold' });
  }

  /* ------------------------------------------------------- bottom screen -- */
  UI.drawBottom = function (ctx, t) {
    beginFrame();
    if (UI.screen === 'title') drawTitleBottom(ctx, t);
    else if (UI.screen === 'adopt') drawAdopt(ctx, t);
    else if (G.mode === 'walk') drawWalk(ctx, t);
    else if (G.mode === 'contest') drawContest(ctx, t);
    else drawHome(ctx, t);
    /* overlays and toasts belong to every screen, including the title */
    if (UI.overlay) drawOverlay(ctx, t);
    drawToast(ctx);
  };

  function drawTitleBottom(ctx, t) {
    S.livingRoom(ctx, t, G.hour);
    ctx.save();
    ctx.fillStyle = 'rgba(255,253,244,0.86)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    U.text(ctx, 'FLORIDOGS', 128, 44, { size: 26, align: 'center', color: '#ef7a3d', weight: 'bold', outline: '#fff', outlineWidth: 6 });
    U.text(ctx, 'Nintendogs-style care & play', 128, 60, { size: 9, align: 'center', color: '#7b6a52' });

    var hasSave = G.hasSave();
    btn(ctx, 'title:continue', 58, 78, 140, 28, hasSave ? 'Continue' : 'Continue (no save)', { active: hasSave });
    btn(ctx, 'title:new', 58, 112, 140, 28, hasSave ? 'New Game' : 'Start');
    U.text(ctx, 'Best on a phone — tap, drag and swipe the bottom screen.', 128, 156, { size: 8, align: 'center', color: '#8b8271' });
    U.text(ctx, 'Cherry & Scooby edition', 128, 170, { size: 8, align: 'center', color: '#b09a78' });
  }

  function drawAdopt(ctx, t) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#e8f4fb'); g.addColorStop(1, '#cfe4f0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    U.text(ctx, 'Choose your dog', 128, 18, { size: 13, align: 'center', color: '#3f5b6b', weight: 'bold' });

    var ids = ['cherry', 'scooby'];
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i], b = global.FD.Dogs.breeds[id];
      var owned = G.dogs.some(function (d) { return d.rec.breed === id; });
      var x = 12 + i * 122, y = 28, w = 110, h = 120;
      panel(ctx, x, y, w, h);
      ctx.save();
      ctx.beginPath(); ctx.rect(x + 3, y + 3, w - 6, 62); ctx.clip();
      ctx.fillStyle = '#eef6fb'; ctx.fillRect(x + 3, y + 3, w - 6, 62);
      var previewRec = global.FD.Dogs.create(id, b.name);
      var previewSpec = global.FD.Dogs.spec(previewRec);
      var pd = {
        rec: previewRec, spec: previewSpec, x: x + w / 2, y: y + 62, facing: -1, scale: 0.82,
        pose: R.blankPose(), wag: 0.7, blink: 0, gaitAmp: 0, gaitPhase: 0, hop: 0
      };
      pd.pose.mouth = 0.3;
      R.drawDog(ctx, pd, t + i);
      ctx.restore();
      U.text(ctx, b.name, x + w / 2, y + 80, { size: 13, align: 'center', color: '#3f3527', weight: 'bold' });
      U.text(ctx, b.breed + ' · ' + b.weight + ' lb', x + w / 2, y + 92, { size: 8, align: 'center', color: '#6b6152' });
      var lines = U.wrapText(ctx, b.bio, w - 14, 7);
      for (var l = 0; l < Math.min(2, lines.length); l++) {
        U.text(ctx, lines[l], x + w / 2, y + 104 + l * 9, { size: 7, align: 'center', color: '#8b8271' });
      }
      btn(ctx, 'adopt:' + id, x + 14, y + h - 2, w - 28, 20, owned ? 'Adopted' : 'Adopt', { active: !owned, size: 9 });
    }
    if (G.dogs.length) btn(ctx, 'adopt:done', 88, 160, 80, 22, 'Done', { size: 10 });
  }

  /* ------------------------------------------------------------ home room */
  function drawHome(ctx, t) {
    var d = G.dog();
    S.livingRoom(ctx, t, G.hour);

    /* bowls */
    S.bowl(ctx, G.foodBowl.x, G.foodBowl.y, G.bowls.food, 'food');
    S.bowl(ctx, G.waterBowl.x, G.waterBowl.y, G.bowls.water, 'water');
    UI.buttons.push({ id: 'bowl:food', x: G.foodBowl.x - 16, y: G.foodBowl.y - 14, w: 32, h: 24 });
    UI.buttons.push({ id: 'bowl:water', x: G.waterBowl.x - 16, y: G.waterBowl.y - 14, w: 32, h: 24 });

    /* a present waiting to be opened */
    if (G.gift) {
      var bob = Math.sin(G.gift.t * 3) * 2;
      ctx.save();
      U.shadow(ctx, G.gift.x, G.gift.y + 8, 12, 4, 0.18);
      ctx.fillStyle = '#e0574f';
      U.roundRect(ctx, G.gift.x - 11, G.gift.y - 12 + bob, 22, 18, 3); ctx.fill();
      ctx.fillStyle = '#f5d76e';
      ctx.fillRect(G.gift.x - 2, G.gift.y - 12 + bob, 4, 18);
      ctx.fillRect(G.gift.x - 11, G.gift.y - 5 + bob, 22, 4);
      ctx.fillStyle = '#f5d76e';
      ctx.beginPath(); ctx.arc(G.gift.x - 4, G.gift.y - 14 + bob, 3.4, 0, Math.PI * 2);
      ctx.arc(G.gift.x + 4, G.gift.y - 14 + bob, 3.4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      UI.buttons.push({ id: 'gift', x: G.gift.x - 16, y: G.gift.y - 22, w: 32, h: 32 });
    }

    /* the other dog naps in the background if you own both */
    var other = G.other();
    if (other) {
      other.x = 40; other.y = 108; other.facing = 1; other.scale = 0.72;
      R.drawDog(ctx, other, t);
    }

    /* dog and toys are sorted by depth so nothing floats in front of the wrong thing */
    function drawToy(toy) {
      if (toy.z > 2) U.shadow(ctx, toy.x, toy.y, 6, 2, 0.16);
      if (toy.kind === 'ball') S.ball(ctx, toy.x, toy.y - toy.z, 6, toy.spin);
      else S.disc(ctx, toy.x, toy.y - toy.z, 10, U.clamp(toy.z / 60, 0, 0.6), toy.spin);
    }
    G.toys.forEach(function (toy) { if (!toy.held && d && toy.y < d.y) drawToy(toy); });

    if (d) {
      R.drawDog(ctx, d, t);
      if (d.behavior === 'sleep') drawZzz(ctx, d, t);
      if (d.bubbles > 0.05) drawSuds(ctx, d, t);
    }

    G.toys.forEach(function (toy) { if (toy.held || !d || toy.y >= d.y) drawToy(toy); });

    /* item held by the stylus */
    if (UI.heldItem) drawHeldItem(ctx, UI.heldItem);

    G.emotes.forEach(function (em) { drawEmote(ctx, em); });

    /* time of day only dims the room, never the controls */
    S.tint(ctx, G.hour, W, TRAY_Y);

    /* call + tricks */
    btn(ctx, 'call', W - 60, 6, 54, 20, 'Call', { size: 9 });
    btn(ctx, 'tricks', W - 60, 30, 54, 20, 'Tricks', { size: 9, active: UI.trickPanel });

    if (UI.trickPanel) drawTrickPanel(ctx, t);
    if (G.pendingTrick) drawNamePrompt(ctx, t);

    drawTray(ctx);
    drawHint(ctx);
  }

  function hearts(d) {
    var h = G.hearts(d.rec), s = '';
    for (var i = 0; i < h; i++) s += '♥';
    return s;
  }

  function chip(ctx, x, y, text) {
    ctx.save();
    var w = ctx.measureText ? 0 : 0;
    ctx.font = 'bold 9px "Trebuchet MS", system-ui, sans-serif';
    w = ctx.measureText(text).width + 12;
    U.roundRect(ctx, x, y, w, 14, 7);
    ctx.fillStyle = 'rgba(255,255,255,0.82)'; ctx.fill();
    ctx.strokeStyle = 'rgba(160,140,110,0.6)'; ctx.lineWidth = 1; ctx.stroke();
    U.text(ctx, text, x + 6, y + 10, { size: 9, color: '#6a5b40', weight: 'bold' });
    ctx.restore();
  }

  function drawSuds(ctx, d, t) {
    ctx.save();
    ctx.globalAlpha = U.clamp(d.bubbles, 0, 1) * 0.9;
    for (var i = 0; i < 12; i++) {
      var a = i * 1.7 + t * 0.6;
      var x = d.x + Math.cos(a) * 26 * d.scale;
      var y = d.y - 40 * d.scale + Math.sin(a * 1.3) * 20 * d.scale;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(x, y, 3 + (i % 3), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawHeldItem(ctx, item) {
    ctx.save();
    switch (item.kind) {
      case 'ball': S.ball(ctx, item.x, item.y, 7, UI.t * 3); break;
      case 'disc': S.disc(ctx, item.x, item.y, 11, 0.5, UI.t); break;
      case 'treat': S.bone(ctx, item.x, item.y, 1); break;
      case 'brush': S.brush(ctx, item.x, item.y, Math.sin(UI.t * 12) * 0.3); break;
      case 'shampoo': S.shampoo(ctx, item.x, item.y); break;
      case 'hand':
        ctx.globalAlpha = 0.9;
        drawToolIcon(ctx, 'hand', item.x, item.y, 1.5);
        break;
    }
    ctx.restore();
  }

  function drawTrickPanel(ctx, t) {
    var d = G.dog(); if (!d) return;
    panel(ctx, 6, 52, 244, 84, 'Commands');
    var cols = 3;
    for (var i = 0; i < G.TRICKS.length; i++) {
      var tr = G.TRICKS[i];
      var cx = 14 + (i % cols) * 78, cy = 76 + Math.floor(i / cols) * 24;
      var known = d.rec.tricks[tr.id] || 0;
      btn(ctx, 'cmd:' + tr.id, cx, cy, 72, 20, tr.label, { size: 9, active: known > 0.99 });
      /* learning meter under the label */
      U.roundRect(ctx, cx + 4, cy + 16, 64, 3, 1.5);
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fill();
      U.roundRect(ctx, cx + 4, cy + 16, Math.max(1, 64 * known), 3, 1.5);
      ctx.fillStyle = '#5fa8e0'; ctx.fill();
    }
    U.text(ctx, 'Teach by hand: ' + G.TRICKS[Math.floor(UI.t / 4) % G.TRICKS.length].label + ' — ' +
      G.TRICKS[Math.floor(UI.t / 4) % G.TRICKS.length].how, 128, 130, { size: 7.5, align: 'center', color: '#8b8271' });
  }

  function drawNamePrompt(ctx, t) {
    var pt = G.pendingTrick;
    var pulse = 0.5 + Math.sin(UI.t * 7) * 0.5;
    panel(ctx, 28, 6, 200, 40);
    U.text(ctx, 'Name it! Tap the word', 128, 20, { size: 9, align: 'center', color: '#6b6152' });
    ctx.save();
    ctx.globalAlpha = 0.6 + pulse * 0.4;
    btn(ctx, 'name:' + pt.id, 84, 24, 88, 18, G.trickLabel(pt.id), { size: 10, active: true });
    ctx.restore();
    if (Audio.micOn) U.text(ctx, '(or say it out loud)', 210, 20, { size: 7, align: 'right', color: '#9a8f7b' });
  }

  function drawHint(ctx) {
    if (!UI.hint) return;
    ctx.save();
    ctx.globalAlpha = 0.85;
    U.text(ctx, UI.hint, 128, TRAY_Y - 6, { size: 8, align: 'center', color: '#4c4438', outline: 'rgba(255,255,255,0.9)', outlineWidth: 3 });
    ctx.restore();
  }

  function drawToast(ctx) {
    if (!UI.toast) return;
    var a = U.clamp(UI.toast.life, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    var w = 200;
    U.roundRect(ctx, (W - w) / 2, 132, w, 20, 10);
    ctx.fillStyle = 'rgba(40,34,26,0.85)'; ctx.fill();
    U.text(ctx, UI.toast.text, W / 2, 146, { size: 9, align: 'center', color: '#fff', weight: 'bold' });
    ctx.restore();
  }

  /* ---------------------------------------------------------------- walk */
  function drawWalk(ctx, t) {
    var d = G.dog(), w = G.walk;
    S.street(ctx, w.scroll, t, G.hour);

    /* pickups along the route */
    w.items.forEach(function (it) {
      if (it.taken) return;
      var x = it.at - w.scroll + 40;
      if (x < -20 || x > 276) return;
      var y = 150;
      var bob = Math.sin(t * 3 + it.at) * 2;
      if (it.kind === 'gift') {
        ctx.fillStyle = '#e0574f'; U.roundRect(ctx, x - 8, y - 14 + bob, 16, 14, 2); ctx.fill();
        ctx.fillStyle = '#f5d76e'; ctx.fillRect(x - 1.5, y - 14 + bob, 3, 14);
        ctx.fillRect(x - 8, y - 8 + bob, 16, 3);
      } else if (it.kind === 'coin') {
        ctx.fillStyle = '#e8c25a';
        ctx.beginPath(); ctx.ellipse(x, y - 8 + bob, 6, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#c39a34'; ctx.lineWidth = 1.2; ctx.stroke();
      } else {
        S.bone(ctx, x, y - 8 + bob, 1);
      }
      UI.buttons.push({ id: 'walkitem', x: x - 14, y: y - 24, w: 28, h: 28, data: it });
    });

    if (d) { d.y = 146; R.drawDog(ctx, d, t); }
    G.emotes.forEach(function (em) { drawEmote(ctx, em); });
    S.tint(ctx, G.hour, W, TRAY_Y);

    /* controls */
    chip(ctx, 6, 6, Math.round(w.distance) + ' steps');
    chip(ctx, 6, 22, 'Found ' + w.picked);
    btn(ctx, 'walk:home', W - 66, 6, 60, 20, 'Go Home', { size: 9 });
    U.text(ctx, w.distance >= w.target ? 'Park reached — head home!' : 'Hold anywhere to walk →',
      128, 50, { size: 9, align: 'center', color: '#3d4a57', outline: 'rgba(255,255,255,0.9)', outlineWidth: 4 });

    drawTray(ctx);
  }

  /* ------------------------------------------------------------- contest */
  function drawContest(ctx, t) {
    var d = G.dog(), c = G.contest;
    S.field(ctx, 0, t);

    if (c.disc) {
      var dz = c.disc;
      U.shadow(ctx, dz.x, dz.y, 8, 3, 0.2);
      S.disc(ctx, dz.x, dz.y - dz.z, 11, U.clamp(dz.z / 90, 0, 0.6), dz.spin);
    }
    if (d) R.drawDog(ctx, d, t);
    G.emotes.forEach(function (em) { drawEmote(ctx, em); });

    chip(ctx, 6, 6, 'Score ' + c.score);
    chip(ctx, 6, 22, Math.ceil(c.time) + 's left');
    btn(ctx, 'contest:quit', W - 60, 6, 54, 20, 'Finish', { size: 9 });
    if (c.state === 'ready') {
      U.text(ctx, 'Swipe to throw the disc', 128, 172, { size: 11, align: 'center', color: '#2f4a2a', outline: 'rgba(255,255,255,0.9)', outlineWidth: 4, weight: 'bold' });
    }
    if (c.lastScore && c.lastScoreLife > 0) {
      ctx.save();
      ctx.globalAlpha = U.clamp(c.lastScoreLife, 0, 1);
      U.text(ctx, '+' + c.lastScore, c.lastScoreX, c.lastScoreY, { size: 16, align: 'center', color: '#fff', outline: '#2f4a2a', outlineWidth: 4, weight: 'bold' });
      ctx.restore();
    }
  }

  /* -------------------------------------------------------------- overlay */
  function drawOverlay(ctx, t) {
    ctx.save();
    ctx.fillStyle = 'rgba(20,26,32,0.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    if (UI.overlay === 'menu') {
      panel(ctx, 28, 14, 200, 164, 'Menu');
      var items = [
        ['menu:care', 'Care & Stats'],
        ['menu:walk', 'Go for a Walk'],
        ['menu:contest', 'Disc Competition'],
        ['menu:shop', 'Shop'],
        ['menu:kennel', 'Kennel / Switch Dog'],
        ['menu:save', 'Save Game']
      ];
      for (var i = 0; i < items.length; i++) {
        btn(ctx, items[i][0], 42, 40 + i * 21, 172, 18, items[i][1], { size: 10 });
      }
      btn(ctx, 'menu:close', 96, 40 + items.length * 21 + 4, 64, 18, 'Close', { size: 10 });
    } else if (UI.overlay === 'shop') {
      panel(ctx, 16, 14, 224, 164, 'Shop — ' + G.coins + ' coins');
      var stock = [
        ['buy:food', 'Bag of food x3', 15],
        ['buy:water', 'Water jug x3', 10],
        ['buy:treats', 'Treats x5', 20],
        ['buy:shampoo', 'Shampoo x2', 18],
        ['buy:pearls', 'Pink pearls', 40],
        ['buy:bandana', 'Red bandana', 30],
        ['buy:collar', 'Orange collar', 25]
      ];
      for (var s = 0; s < stock.length; s++) {
        var y = 38 + s * 19;
        btn(ctx, stock[s][0], 26, y, 150, 17, stock[s][1], { size: 9 });
        U.text(ctx, stock[s][2] + 'c', 216, y + 12, { size: 9, align: 'right', color: G.coins >= stock[s][2] ? '#3f7a3a' : '#b04b3c', weight: 'bold' });
      }
      btn(ctx, 'shop:close', 100, 174, 56, 16, 'Close', { size: 9 });
    } else if (UI.overlay === 'care') {
      var d = G.dog();
      panel(ctx, 16, 14, 224, 164, d ? d.rec.name + "'s Record" : 'Record');
      if (d) {
        var st = d.rec.stats, rows = [
          ['Breed', d.spec.breed.breed],
          ['Weight', d.spec.breed.weight + ' lb'],
          ['Hearts', G.hearts(d.rec) + ' / 5'],
          ['Walks', String(st.walks)],
          ['Meals', String(st.meals)],
          ['Pets', String(st.pets)],
          ['Contests', String(st.contests)],
          ['Best disc score', String(st.discBest)]
        ];
        for (var r = 0; r < rows.length; r++) {
          var rx = r < 4 ? 28 : 134, ry = 42 + (r % 4) * 13;
          U.text(ctx, rows[r][0], rx, ry, { size: 8, color: '#6b6152' });
          U.text(ctx, rows[r][1], rx + 94, ry, { size: 8, align: 'right', color: '#3f3527', weight: 'bold' });
        }
        var nn = d.rec.needs;
        needBar(ctx, 28, 96, 200, 'Food', nn.hunger, '#e0913c');
        needBar(ctx, 28, 108, 200, 'Water', nn.thirst, '#4ba3d8');
        needBar(ctx, 28, 120, 200, 'Mood', nn.mood, '#e2688f');
        needBar(ctx, 28, 132, 200, 'Clean', nn.clean, '#7fc26a');
        needBar(ctx, 28, 144, 200, 'Energy', nn.energy, '#b184d4');
        btn(ctx, 'care:rename', 28, 158, 84, 16, 'Rename', { size: 9 });
        btn(ctx, 'care:accessory', 120, 158, 108, 16, 'Accessory: ' + (d.rec.accessory || 'none'), { size: 8 });
      }
      btn(ctx, 'care:close', 108, 176, 40, 14, 'Close', { size: 8 });
    } else if (UI.overlay === 'kennel') {
      panel(ctx, 16, 14, 224, 164, 'Kennel');
      for (var k = 0; k < G.dogs.length; k++) {
        var dd = G.dogs[k];
        btn(ctx, 'kennel:' + k, 30, 40 + k * 26, 196, 22, dd.rec.name + '  ' + hearts(dd), { size: 10, active: k === G.active });
      }
      if (G.dogs.length < 2) btn(ctx, 'kennel:adopt', 30, 40 + G.dogs.length * 26, 196, 22, 'Adopt another dog', { size: 10 });
      btn(ctx, 'kennel:close', 100, 160, 56, 18, 'Close', { size: 9 });
    } else if (UI.overlay === 'confirm' && UI.confirm) {
      panel(ctx, 32, 56, 192, 78);
      var lines = U.wrapText(ctx, UI.confirm.text, 168, 10);
      for (var l = 0; l < lines.length; l++) U.text(ctx, lines[l], 128, 82 + l * 13, { size: 10, align: 'center', color: '#4c4438' });
      btn(ctx, 'confirm:yes', 48, 108, 68, 20, 'Yes', { size: 10, active: true });
      btn(ctx, 'confirm:no', 140, 108, 68, 20, 'No', { size: 10 });
    }
  }

  UI.askConfirm = function (text, onYes) {
    UI.confirm = { text: text, onYes: onYes };
    UI.overlay = 'confirm';
  };

  UI.tick = function (dt) {
    UI.t += dt;
    if (UI.toast) { UI.toast.life -= dt; if (UI.toast.life <= 0) UI.toast = null; }
  };

  UI.TOOLS = TOOLS;
  UI.hitTest = hit;
  UI.TRAY_Y = TRAY_Y;
  global.FD.UI = UI;
})(window);
