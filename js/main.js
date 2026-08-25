/* Floridogs — boot, input (stylus gestures), and the main loop. */
(function (global) {
  'use strict';
  var U = global.FD.U, G = global.FD.Game, R = global.FD.Render, S = global.FD.Scenes,
      UI = global.FD.UI, Audio = global.FD.Audio, Dogs = global.FD.Dogs;

  var LW = 256, LH = 192;
  var topCv = document.getElementById('topScreen');
  var btmCv = document.getElementById('btmScreen');
  var topCtx = topCv.getContext('2d');
  var btmCtx = btmCv.getContext('2d');

  /* Canvas backing size only changes on resize, so measuring every frame
     would force a layout for nothing. */
  function fit(canvas, ctx) {
    var rect = canvas.getBoundingClientRect();
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(rect.width * dpr));
    var h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.setTransform(w / LW, 0, 0, h / LH, 0, 0);
  }
  var needsFit = true;

  /* --------------------------------------------------------------- input -- */
  var IN = {
    down: false, x: 0, y: 0, px: 0, py: 0, sx: 0, sy: 0,
    vx: 0, vy: 0, moved: 0, angle: 0, lastAngle: null, startT: 0,
    pressed: null, region: null, holdOverHead: 0
  };

  function toLogical(ev) {
    var rect = btmCv.getBoundingClientRect();
    var cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left;
    var cy = (ev.touches ? ev.touches[0].clientY : ev.clientY) - rect.top;
    return { x: cx / rect.width * LW, y: cy / rect.height * LH };
  }

  function dogLocal(d, x, y) {
    var s = d.spec.build.scale * (d.scale || 1);
    return { x: (x - d.x) / (s * d.facing), y: (y - d.y) / s, s: s };
  }

  function overDog(d, x, y) {
    if (!d) return false;
    var l = dogLocal(d, x, y);
    return l.x > -72 && l.x < 92 && l.y > -140 && l.y < 14;
  }

  function bodyRegion(d, x, y) {
    var l = dogLocal(d, x, y);
    var p = d.pose;
    if (U.dist(l.x, l.y, p.hdX, p.hdY) < 30) return 'head';
    if (U.dist(l.x, l.y, p.fpX, p.fpY) < 22) return 'paw';
    if (l.x < -12) return 'rear';
    if (l.y > -58) return 'belly';
    return 'shoulder';
  }

  function onDown(ev) {
    ev.preventDefault();
    Audio.unlock();
    var p = toLogical(ev);
    IN.down = true; IN.x = p.x; IN.y = p.y; IN.px = p.x; IN.py = p.y;
    IN.sx = p.x; IN.sy = p.y; IN.moved = 0; IN.angle = 0; IN.lastAngle = null;
    IN.startT = performance.now(); IN.vx = 0; IN.vy = 0; IN.holdOverHead = 0;
    IN.pressed = UI.hitTest(p.x, p.y);
    IN.consumed = !!IN.pressed;

    if (IN.pressed) return;
    startToolGesture(p);
  }

  function onMove(ev) {
    if (!IN.down) return;
    ev.preventDefault();
    var p = toLogical(ev);
    IN.px = IN.x; IN.py = IN.y;
    IN.x = p.x; IN.y = p.y;
    var dx = IN.x - IN.px, dy = IN.y - IN.py;
    IN.moved += Math.sqrt(dx * dx + dy * dy);
    IN.vx = U.lerp(IN.vx, dx * 60, 0.5);
    IN.vy = U.lerp(IN.vy, dy * 60, 0.5);

    /* accumulate turning for the roll-over circle gesture */
    var d = G.dog();
    if (d) {
      var a = Math.atan2(IN.y - d.y + 40, IN.x - d.x);
      if (IN.lastAngle !== null) {
        var da = a - IN.lastAngle;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        IN.angle += da;
      }
      IN.lastAngle = a;
    }

    if (!IN.consumed) moveToolGesture(p);
    if (UI.heldItem) { UI.heldItem.x = p.x; UI.heldItem.y = p.y; }
  }

  function onUp(ev) {
    if (!IN.down) return;
    if (ev.cancelable) ev.preventDefault();
    IN.down = false;
    var p = { x: IN.x, y: IN.y };

    if (IN.pressed) {
      var still = UI.hitTest(p.x, p.y);
      if (still && still.id === IN.pressed.id) handleButton(IN.pressed.id, IN.pressed.data);
      IN.pressed = null;
      IN.consumed = false;
      return;
    }
    endToolGesture(p);
    IN.consumed = false;
  }

  /* ---------------------------------------------------- gestures per tool -- */
  function startToolGesture(p) {
    var d = G.dog();
    if (G.mode === 'contest') { return; }
    if (G.mode === 'walk') { if (G.walk) G.walk.holding = true; return; }
    if (!d) return;

    var tool = UI.tool;
    if (tool === 'ball' || tool === 'disc') {
      UI.heldItem = { kind: tool, x: p.x, y: p.y };
      UI.hint = 'Flick to throw';
    } else if (tool === 'treat') {
      if (G.inventory.treats <= 0) { UI.toastMsg('No treats left — visit the shop.'); return; }
      UI.heldItem = { kind: 'treat', x: p.x, y: p.y };
      UI.hint = 'Hold it over her nose, or flick it up';
    } else if (tool === 'brush') {
      UI.heldItem = { kind: 'brush', x: p.x, y: p.y };
      UI.hint = 'Rub back and forth';
    } else if (tool === 'shampoo') {
      if (G.inventory.shampoo <= 0) { UI.toastMsg('Out of shampoo.'); return; }
      UI.heldItem = { kind: 'shampoo', x: p.x, y: p.y };
      UI.hint = 'Scrub all over';
    } else {
      UI.heldItem = { kind: 'hand', x: p.x, y: p.y };
      IN.region = overDog(d, p.x, p.y) ? bodyRegion(d, p.x, p.y) : null;
    }
  }

  function moveToolGesture(p) {
    var d = G.dog();
    if (G.mode === 'walk' || G.mode === 'contest' || !d) return;
    var tool = UI.tool;
    var on = overDog(d, p.x, p.y);

    if (tool === 'hand' && on) {
      var strength = U.clamp(Math.abs(IN.x - IN.px) + Math.abs(IN.y - IN.py), 0, 8);
      G.pet(d, strength);
      d.lookAt = { x: p.x, y: p.y };
      var region = IN.region || bodyRegion(d, p.x, p.y);
      var netY = IN.y - IN.sy;

      if (region === 'rear' && netY > 24 && d.behavior !== 'sit' && d.actionLock <= 0) {
        G.induce(d, 'sit');
        UI.toastMsg('Good sit!');
      } else if ((region === 'shoulder' || region === 'head') && netY > 30 &&
                 (d.behavior === 'sit' || d.behavior === 'idle' || d.behavior === 'stand') && d.actionLock <= 0) {
        G.induce(d, 'down');
        UI.toastMsg('Nice, lying down.');
      } else if (region === 'belly' && d.behavior === 'down' && Math.abs(IN.angle) > Math.PI * 1.6 && d.actionLock <= 0) {
        G.induce(d, 'rollover');
        UI.toastMsg('Roll over!');
        IN.angle = 0;
      }
    } else if (tool === 'brush' && on) {
      G.brushAt(d, p.x, p.y);
      d.wagTarget = 0.8;
    } else if (tool === 'shampoo' && on) {
      if (!IN.usedShampoo) { IN.usedShampoo = true; G.inventory.shampoo--; }
      G.washAt(d);
    } else if (tool === 'treat') {
      /* holding the treat just above the nose asks for a bark */
      var head = headWorld(d);
      if (U.dist(p.x, p.y, head.x, head.y - 14) < 26) {
        IN.holdOverHead += 1 / 60;
        d.lookAt = { x: p.x, y: p.y };
        if (IN.holdOverHead > 0.9 && d.actionLock <= 0) {
          G.induce(d, 'speak');
          UI.toastMsg('Speak!');
          IN.holdOverHead = -2;
        }
      } else IN.holdOverHead = Math.max(0, IN.holdOverHead - 0.02);
    }
  }

  function headWorld(d) {
    var s = d.spec.build.scale * (d.scale || 1);
    return { x: d.x + d.pose.hdX * s * d.facing, y: d.y + d.pose.hdY * s };
  }

  function endToolGesture(p) {
    var d = G.dog();
    var item = UI.heldItem;
    UI.heldItem = null;
    UI.hint = '';
    IN.usedShampoo = false;

    if (G.mode === 'walk') { if (G.walk) G.walk.holding = false; return; }
    if (G.mode === 'contest') { throwDisc(p); return; }
    if (!d || !item) return;

    var tap = IN.moved < 8 && (performance.now() - IN.startT) < 350;

    if (item.kind === 'ball' || item.kind === 'disc') {
      var speed = Math.sqrt(IN.vx * IN.vx + IN.vy * IN.vy);
      if (speed < 40) {
        G.throwToy(item.kind, p.x, U.clamp(p.y, 110, 152), 0, 0, 40);
      } else {
        var vz = U.clamp(-IN.vy * 0.9, 60, 320);
        G.throwToy(item.kind, p.x, U.clamp(p.y, 110, 152), IN.vx * 0.8, U.clamp(IN.vy * 0.25, -30, 30), vz);
        Audio.blip(520, 0.05, 'sine', 0.07);
      }
      return;
    }

    if (item.kind === 'treat') {
      if (IN.vy < -220 && d.actionLock <= 0) {
        G.induce(d, 'jump');
        UI.toastMsg('Jump!');
        return;
      }
      if (overDog(d, p.x, p.y) || tap) { G.giveTreat(d); return; }
      return;
    }

    if (item.kind === 'hand') {
      if (tap && overDog(d, p.x, p.y)) {
        var region = bodyRegion(d, p.x, p.y);
        if (region === 'paw' && (d.behavior === 'sit' || d.behavior === 'shake') && d.actionLock <= 0) {
          G.induce(d, 'shake');
          UI.toastMsg('Shake!');
        } else if (region === 'head') {
          d.earFlap = 1;
          G.emote(d, 'heart');
          G.pet(d, 6);
          if (U.chance(0.4)) Audio.pant();
        } else {
          G.emote(d, 'heart');
        }
      } else if (tap && p.y > 96 && p.y < UI.TRAY_Y - 4) {
        /* tap the floor: she trots over to look */
        d.moveTo = { x: U.clamp(p.x, 24, 228), y: U.clamp(p.y, 108, 152) };
        G.setBehavior(d, 'wander', 6);
      }
    }
  }

  /* ------------------------------------------------------------- buttons -- */
  function handleButton(id, data) {
    Audio.unlock();
    Audio.blip(880, 0.03, 'square', 0.05);
    var d = G.dog();

    if (id.indexOf('tool:') === 0) {
      var tid = id.slice(5);
      if (tid === 'menu') { UI.overlay = 'menu'; return; }
      UI.tool = tid;
      if (tid === 'food') { G.putFood(); UI.tool = 'hand'; }
      else if (tid === 'water') { G.putWater(); UI.tool = 'hand'; }
      return;
    }

    switch (id) {
      case 'title:continue':
        if (G.load()) {
          UI.screen = 'home';
          G.say('Welcome back! ' + (G.dog() ? G.dog().rec.name + ' missed you.' : ''), 'good');
          if (G.offlineHours > 1) G.say('You were away ' + Math.round(G.offlineHours) + 'h.', 'info');
        } else UI.toastMsg('No saved game yet.');
        return;
      case 'title:new':
        if (G.hasSave()) {
          UI.askConfirm('Start over? Your current dogs will be gone.', function () {
            G.eraseSave(); G.newGame(); UI.overlay = null; UI.screen = 'adopt';
          });
        } else { G.newGame(); UI.screen = 'adopt'; }
        return;

      case 'adopt:cherry': case 'adopt:scooby': {
        var bid = id.split(':')[1];
        if (G.dogs.some(function (x) { return x.rec.breed === bid; })) { UI.toastMsg('Already yours!'); return; }
        var nd = G.adopt(bid, Dogs.breeds[bid].name);
        Audio.chime(true);
        G.say('You adopted ' + nd.rec.name + '!', 'good');
        UI.toastMsg(nd.rec.name + ' joins the family!');
        if (G.dogs.length === 1) { UI.screen = 'home'; G.say('Try the hand tool — rub her to say hello.'); }
        return;
      }
      case 'adopt:done': UI.screen = 'home'; return;

      case 'call': if (d) G.call(d, true); return;
      case 'tricks': UI.trickPanel = !UI.trickPanel; return;

      case 'gift': G.openGift(); return;
      case 'bowl:food': G.putFood(); return;
      case 'bowl:water': G.putWater(); return;

      case 'menu:close': case 'shop:close': case 'care:close': case 'kennel:close':
        UI.overlay = null; return;
      case 'menu:care': UI.overlay = 'care'; return;
      case 'menu:shop': UI.overlay = 'shop'; return;
      case 'menu:kennel': UI.overlay = 'kennel'; return;
      case 'menu:save': G.persist(); UI.toastMsg('Game saved.'); UI.overlay = null; return;
      case 'menu:walk': UI.overlay = null; G.startWalk(); return;
      case 'menu:contest': UI.overlay = null; G.startContest(); return;

      case 'walk:home': G.endWalk(G.walk && G.walk.distance > G.walk.target * 0.4); return;
      case 'contest:quit': G.endContest(); return;

      case 'care:rename': {
        if (!d) return;
        var nn = global.prompt('New name for ' + d.rec.name + ':', d.rec.name);
        if (nn && nn.trim()) {
          d.rec.name = nn.trim().slice(0, 12);
          d.spec = Dogs.spec(d.rec);
          G.persist();
          UI.toastMsg('Renamed to ' + d.rec.name);
        }
        return;
      }
      case 'care:accessory': {
        if (!d) return;
        var opts = ['pearls', 'bandana', 'collar', 'none'];
        var owned = (G.save.owned = G.save.owned || {});
        var i = opts.indexOf(d.rec.accessory || 'none');
        for (var step = 1; step <= opts.length; step++) {
          var cand = opts[(i + step) % opts.length];
          if (cand === 'none' || cand === Dogs.breeds[d.rec.breed].accessory || owned[cand]) { d.rec.accessory = cand; break; }
        }
        G.persist();
        return;
      }

      case 'kennel:adopt': UI.overlay = null; UI.screen = 'adopt'; return;

      case 'confirm:yes': if (UI.confirm && UI.confirm.onYes) UI.confirm.onYes(); UI.confirm = null; if (UI.overlay === 'confirm') UI.overlay = null; return;
      case 'confirm:no': UI.confirm = null; UI.overlay = null; return;

      case 'walkitem': {
        if (!data || data.taken || !G.walk) return;
        data.taken = true;
        G.walk.picked++;
        if (data.kind === 'coin') { var c = U.randInt(3, 9); G.coins += c; UI.toastMsg('Found ' + c + ' coins!'); }
        else if (data.kind === 'bone') { G.inventory.treats++; UI.toastMsg('Found a treat!'); }
        else {
          var roll = U.pick(['food', 'water', 'shampoo', 'treats']);
          G.inventory[roll] += 2;
          UI.toastMsg('A present: ' + roll + ' x2!');
        }
        Audio.chime(true);
        if (d) G.emote(d, 'star');
        return;
      }
    }

    if (id.indexOf('cmd:') === 0 && d) { G.command(d, id.slice(4)); return; }
    if (id.indexOf('name:') === 0 && d) { G.teach(d, id.slice(5)); return; }
    if (id.indexOf('kennel:') === 0) {
      var idx = parseInt(id.split(':')[1], 10);
      if (!isNaN(idx) && G.dogs[idx]) { G.active = idx; G.dogs[idx].x = 128; G.dogs[idx].y = 150; UI.overlay = null; G.persist(); }
      return;
    }
    if (id.indexOf('buy:') === 0) {
      var what = id.slice(4);
      var prices = { food: 15, water: 10, treats: 20, shampoo: 18, pearls: 40, bandana: 30, collar: 25 };
      var price = prices[what];
      if (G.coins < price) { UI.toastMsg('Not enough coins.'); Audio.blip(220, 0.08, 'square', 0.07); return; }
      G.coins -= price;
      if (what === 'food') G.inventory.food += 3;
      else if (what === 'water') G.inventory.water += 3;
      else if (what === 'treats') G.inventory.treats += 5;
      else if (what === 'shampoo') G.inventory.shampoo += 2;
      else {
        G.save.owned = G.save.owned || {};
        G.save.owned[what] = true;
        if (d) d.rec.accessory = what;
        UI.toastMsg(d ? d.rec.name + ' looks great!' : 'Bought!');
      }
      Audio.chime(true);
      G.persist();
      return;
    }
  }

  /* ------------------------------------------------------- walk & contest */
  function updateWalk(dt) {
    var w = G.walk, d = G.dog();
    if (!w || !d) return;
    var want = w.holding ? 78 : 0;
    w.speed = U.approach(w.speed, want, 0.08, dt);
    w.scroll += w.speed * dt;
    w.distance += w.speed * dt * 0.55;
    d.gaitAmp = U.approach(d.gaitAmp, w.speed > 6 ? 1 : 0, 0.14, dt);
    d.gaitSpeed = 1.05;
    d.running = w.speed > 60;
    d.gaitPhase += dt * (w.speed / 24);
    d.facing = 1;
    d.behavior = w.speed > 6 ? 'wander' : 'idle';
    d.wagTarget = w.speed > 6 ? 0.8 : 0.3;

    if (!w.reached && w.distance >= w.target) {
      w.reached = true;
      G.say('You reached the park! Tap Go Home when you are ready.', 'good');
      Audio.chime(true);
      d.rec.needs.mood = U.clamp(d.rec.needs.mood + 0.15, 0, 1);
    }
    if (U.chance(dt * 0.25)) G.emote(d, U.chance(0.5) ? 'note' : 'heart');
  }

  function throwDisc(p) {
    var c = G.contest, d = G.dog();
    if (!c || !d || c.disc) return;
    var speed = Math.sqrt(IN.vx * IN.vx + IN.vy * IN.vy);
    if (speed < 30) return;
    c.disc = {
      x: d.x + 14, y: d.y, z: 24,
      vx: U.clamp(IN.vx * 1.15, 30, 340),
      vy: U.clamp(IN.vy * 0.3, -40, 40),
      vz: U.clamp(-IN.vy * 0.55, 20, 190),
      spin: 0, caught: false, landed: false, startX: d.x
    };
    c.throws++;
    c.state = 'flying';
    G.setBehavior(d, 'chase', 99);
    Audio.blip(700, 0.05, 'sine', 0.07);
  }

  function updateContest(dt) {
    var c = G.contest, d = G.dog();
    if (!c || !d) return;
    c.time -= dt;
    if (c.lastScoreLife > 0) { c.lastScoreLife -= dt; c.lastScoreY -= dt * 14; }
    if (c.time <= 0) { G.endContest(); return; }

    var dz = c.disc;
    if (dz) {
      dz.vz -= 190 * dt;
      dz.vz += 96 * dt;               /* the glide that keeps a disc up */
      dz.vx *= (1 - 0.3 * dt);
      dz.x += dz.vx * dt;
      dz.y += dz.vy * dt;
      dz.z += dz.vz * dt;
      dz.spin += dt * 14;
      if (dz.x > 248) { dz.vx *= -0.3; dz.x = 248; }
      dz.y = U.clamp(dz.y, 96, 182);

      /* the dog runs to the disc and leaps for it */
      var targetX = dz.x + 6;
      var dx = targetX - d.x;
      d.facing = dx >= 0 ? 1 : -1;
      var run = U.clamp(Math.abs(dx) * 3, 0, 165);
      d.x += Math.sign(dx) * Math.min(run * dt, Math.abs(dx));
      d.y = U.approach(d.y, dz.y, 0.06, dt);
      d.gaitAmp = 1; d.running = true; d.gaitSpeed = 1.5;
      d.gaitPhase += dt * 6;
      d.behavior = 'fetchOut';

      var near = Math.abs(d.x - dz.x) < 26;
      var catchable = dz.z > 8 && dz.z < 70 * d.spec.build.scale + 26;
      if (!dz.caught && near && catchable) {
        /* condition matters: a tired, scruffy or sulky dog drops catches */
        var n = d.rec.needs;
        var skill = (0.42 + d.rec.bond * 0.3 + n.energy * 0.24) * (0.72 + n.clean * 0.16 + n.mood * 0.16);
        if (Math.random() < skill) {
          dz.caught = true;
          var dist = Math.max(0, dz.x - dz.startX);
          var air = U.clamp(dz.z / 20, 0, 4);
          var pts = Math.round(dist / 6 + air * 5 + (dz.z > 30 ? 12 : 0));
          c.score += pts; c.catches++;
          c.lastScore = pts; c.lastScoreX = dz.x; c.lastScoreY = dz.y - dz.z - 20; c.lastScoreLife = 1.2;
          G.emote(d, 'star');
          Audio.bark(d.spec.voice.pitch * 1.15, false);
          d.hop = -22;
        }
      }
      if (dz.caught) {
        dz.x = d.x + 12 * d.facing; dz.y = d.y; dz.z = 52 * d.spec.build.scale;
        dz.returnT = (dz.returnT || 0) + dt;
        if (dz.returnT > 0.7) { c.disc = null; c.state = 'ready'; d.hop = 0; resetDogToLine(d); }
      } else if (dz.z <= 0) {
        dz.z = 0; dz.vx = 0; dz.vz = 0;
        dz.landed = true;
        if (Math.abs(d.x - dz.x) < 18) {
          var pts2 = Math.round(Math.max(0, dz.x - dz.startX) / 14);
          c.score += pts2;
          c.lastScore = pts2; c.lastScoreX = dz.x; c.lastScoreY = dz.y - 24; c.lastScoreLife = 1.2;
          c.disc = null; c.state = 'ready';
          resetDogToLine(d);
        }
      }
    } else {
      /* trot back to the throwing line */
      var homeX = 60;
      if (Math.abs(d.x - homeX) > 3) {
        d.facing = homeX > d.x ? 1 : -1;
        d.x += Math.sign(homeX - d.x) * Math.min(120 * dt, Math.abs(homeX - d.x));
        d.y = U.approach(d.y, 150, 0.06, dt);
        d.gaitAmp = 1; d.gaitPhase += dt * 4.5; d.running = true;
        d.behavior = 'fetchBack';
      } else {
        d.gaitAmp = U.approach(d.gaitAmp, 0, 0.2, dt);
        d.running = false;
        d.facing = 1;
        d.behavior = 'alert';
      }
    }
    d.scale = U.clamp(0.78 + (d.y - 104) / 80 * 0.36, 0.7, 1.2);
  }

  function resetDogToLine(d) { d.behavior = 'fetchBack'; }

  /* ------------------------------------------------------------ mic input */
  var micCooldown = 0;
  function updateMic(dt) {
    if (!Audio.micOn) return;
    micCooldown -= dt;
    var level = Audio.sampleMic();
    if (level > 0.16 && micCooldown <= 0) {
      micCooldown = 1.4;
      var d = G.dog();
      if (!d) return;
      if (G.pendingTrick && G.pendingTrick.dog === d) G.teach(d, G.pendingTrick.id);
      else if (G.mode === 'home') G.call(d, true);
    }
  }

  /* ------------------------------------------------------------- rollover */
  var topFrame = 0;
  function drawEverything(t) {
    if (needsFit) { fit(topCv, topCtx); fit(btmCv, btmCtx); needsFit = false; }
    /* the touch screen is what you interact with, so it always redraws;
       the top screen is a passive camera and can run at half rate */
    btmCtx.clearRect(0, 0, LW, LH);
    UI.drawBottom(btmCtx, t);
    if ((topFrame++ & 1) === 0) {
      topCtx.clearRect(0, 0, LW, LH);
      UI.drawTop(topCtx, t);
    }
  }

  /* ---------------------------------------------------------------- loop -- */
  var last = performance.now(), acc = 0;
  function frame(now) {
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    var t = now / 1000;

    UI.tick(dt);
    if (UI.screen === 'home' || UI.screen === 'adopt') {
      G.update(dt);
      if (G.mode === 'walk') updateWalk(dt);
      else if (G.mode === 'contest') updateContest(dt);
      updateMic(dt);
    }

    drawEverything(t);
    requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------------- boot -- */
  function bindShellButtons() {
    var sBtn = document.getElementById('btnSound');
    var mBtn = document.getElementById('btnMic');
    var stBtn = document.getElementById('btnStart');
    sBtn.addEventListener('click', function () {
      Audio.enabled = !Audio.enabled;
      sBtn.classList.toggle('off', !Audio.enabled);
      if (Audio.enabled) { Audio.unlock(); Audio.blip(880, 0.05, 'triangle', 0.08); }
    });
    mBtn.classList.add('off');
    mBtn.addEventListener('click', function () {
      Audio.unlock();
      Audio.toggleMic(function (on, err) {
        mBtn.classList.toggle('off', !on);
        mBtn.classList.toggle('rec', !!on);
        if (on) UI.toastMsg('Mic on — clap or call her name!');
        else if (err === 'denied') UI.toastMsg('Microphone blocked.');
        else UI.toastMsg('Mic off.');
      });
    });
    stBtn.addEventListener('click', function () {
      if (UI.screen === 'title' || UI.screen === 'adopt') return;
      UI.overlay = UI.overlay ? null : 'menu';
    });
  }

  function bindPointer() {
    var opts = { passive: false };
    btmCv.addEventListener('pointerdown', onDown, opts);
    global.addEventListener('pointermove', onMove, opts);
    global.addEventListener('pointerup', onUp, opts);
    global.addEventListener('pointercancel', onUp, opts);
    btmCv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  }

  function boot() {
    G.newGame();               /* a blank slate until Continue loads a save */
    bindShellButtons();
    bindPointer();
    global.addEventListener('resize', function () { needsFit = true; });
    global.addEventListener('orientationchange', function () { needsFit = true; });
    global.addEventListener('visibilitychange', function () { if (document.hidden) G.persist(); });
    global.addEventListener('pagehide', function () { G.persist(); });
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
