/* Floridogs — game state, care simulation and dog behaviour. */
(function (global) {
  'use strict';
  var U = global.FD.U, Audio = global.FD.Audio, Dogs = global.FD.Dogs, R = global.FD.Render;

  var SAVE_KEY = 'floridogs.save.v1';

  /* Needs drain per real hour. Tuned so a dog left alone all day is unhappy
     but never in real trouble, the same forgiving curve the DS games used. */
  var DRAIN = { hunger: 0.10, thirst: 0.13, clean: 0.045, mood: 0.06, energy: 0.055 };
  var OFFLINE_CAP_HOURS = 14;

  var TRICKS = [
    { id: 'sit', label: 'Sit', how: 'Drag down on her back end' },
    { id: 'down', label: 'Lie Down', how: 'Drag her shoulders to the floor' },
    { id: 'shake', label: 'Shake', how: 'Tap a front paw while she sits' },
    { id: 'rollover', label: 'Roll Over', how: 'Circle her belly while she lies down' },
    { id: 'speak', label: 'Speak', how: 'Wave a treat above her nose' },
    { id: 'jump', label: 'Jump', how: 'Flick a toy up over her head' }
  ];

  var G = {
    TRICKS: TRICKS,
    save: null,
    dogs: [],
    active: 0,
    mode: 'home',        /* home | walk | contest */
    messages: [],
    emotes: [],
    toys: [],
    clock: 0,            /* minutes since midnight, follows the real clock */
    day: 1,
    hour: 12,
    walk: null,
    contest: null,
    pendingTrick: null,  /* an action the dog just did that you can name */
    coins: 0,
    inventory: { food: 6, water: 6, treats: 3, shampoo: 2 },
    bowls: { food: 0, water: 0 },
    gift: null,
    giftTimer: 90
  };

  /* ------------------------------------------------------------ persistence */
  function blankSave() {
    return {
      version: 1,
      created: Date.now(),
      lastSeen: Date.now(),
      day: 1,
      coins: 40,
      inventory: { food: 6, water: 6, treats: 3, shampoo: 2 },
      bowls: { food: 0, water: 0 },
      dogs: [],
      active: 0,
      settings: { sound: true }
    };
  }

  G.hasSave = function () { return !!U.load(SAVE_KEY); };

  G.load = function () {
    var s = U.load(SAVE_KEY);
    if (!s || !s.dogs || !s.dogs.length) return false;
    G.save = s;
    G.coins = s.coins;
    G.inventory = s.inventory;
    G.bowls = s.bowls || { food: 0, water: 0 };
    G.day = s.day || 1;
    G.active = s.active || 0;
    G.dogs = s.dogs.map(makeRuntime);
    applyOffline(s.lastSeen || Date.now());
    G.syncClock();
    return true;
  };

  G.newGame = function () {
    G.save = blankSave();
    G.coins = G.save.coins;
    G.inventory = G.save.inventory;
    G.bowls = G.save.bowls;
    G.dogs = [];
    G.active = 0;
    G.syncClock();
  };

  G.adopt = function (breedId, name) {
    var rec = Dogs.create(breedId, name);
    G.save.dogs.push(rec);
    G.dogs.push(makeRuntime(rec));
    G.active = G.dogs.length - 1;
    G.persist();
    return G.dogs[G.dogs.length - 1];
  };

  G.persist = function () {
    if (!G.save) return;
    G.save.lastSeen = Date.now();
    G.save.coins = G.coins;
    G.save.inventory = G.inventory;
    G.save.bowls = G.bowls;
    G.save.day = G.day;
    G.save.active = G.active;
    G.save.dogs = G.dogs.map(function (d) { return d.rec; });
    U.save(SAVE_KEY, G.save);
  };

  G.eraseSave = function () { U.wipe(SAVE_KEY); };

  function applyOffline(lastSeen) {
    var hours = U.clamp((Date.now() - lastSeen) / 3600000, 0, OFFLINE_CAP_HOURS);
    if (hours < 0.02) return;
    G.dogs.forEach(function (d) {
      var n = d.rec.needs;
      n.hunger = U.clamp(n.hunger - DRAIN.hunger * hours, 0, 1);
      n.thirst = U.clamp(n.thirst - DRAIN.thirst * hours, 0, 1);
      n.clean = U.clamp(n.clean - DRAIN.clean * hours, 0, 1);
      n.mood = U.clamp(n.mood - DRAIN.mood * hours * 0.7, 0, 1);
      /* a dog left alone sleeps, so it comes back rested */
      n.energy = U.clamp(n.energy + 0.09 * hours, 0, 1);
      /* bowls left out get eaten while you are away */
      if (G.bowls.food > 0 && n.hunger < 0.75) {
        var eat = Math.min(G.bowls.food, hours * 0.3);
        G.bowls.food -= eat; n.hunger = U.clamp(n.hunger + eat * 0.8, 0, 1);
      }
      if (G.bowls.water > 0 && n.thirst < 0.8) {
        var dr = Math.min(G.bowls.water, hours * 0.35);
        G.bowls.water -= dr; n.thirst = U.clamp(n.thirst + dr * 0.9, 0, 1);
      }
    });
    if (hours > 6) G.day += 1;
    G.offlineHours = hours;
  }

  G.syncClock = function () {
    var now = new Date();
    G.clock = now.getHours() * 60 + now.getMinutes();
    G.hour = G.clock / 60;
  };

  /* --------------------------------------------------------------- runtime */
  function makeRuntime(rec) {
    var spec = Dogs.spec(rec);
    return {
      rec: rec,
      spec: spec,
      x: 128, y: 148, depth: 148,
      facing: -1,
      scale: 1,
      pose: R.blankPose(),
      poseName: 'stand',
      blink: 0, blinkTimer: U.rand(1, 4),
      wag: 0.2, earFlap: 0, hop: 0, roll: 0, tilt: 0,
      tongue: 0, lolling: false, lollTimer: 3,
      panting: false,
      gaitPhase: 0, gaitAmp: 0, gaitSpeed: 1, running: false,
      vx: 0, vy: 0,
      behavior: 'idle',
      btimer: 1.2,
      moveTo: null,
      lookAt: null,
      carrying: null,
      actionLock: 0,
      trickCue: null,
      lastBark: 0,
      bubbles: 0
    };
  }
  G.makeRuntime = makeRuntime;

  G.dog = function () { return G.dogs[G.active] || null; };
  G.other = function () { return G.dogs.length > 1 ? G.dogs[1 - G.active] : null; };

  G.hearts = function (rec) {
    var b = rec.bond;
    return U.clamp(1 + Math.floor(b * 5), 1, 5);
  };

  G.say = function (text, kind) {
    G.messages.unshift({ text: text, kind: kind || 'info', t: Date.now() });
    if (G.messages.length > 6) G.messages.pop();
  };

  G.emote = function (d, kind, dx, dy) {
    G.emotes.push({
      kind: kind, x: d.x + (dx || 0), y: d.y - 70 * d.spec.build.scale + (dy || 0),
      life: 1, vy: -14 - Math.random() * 8, vx: (Math.random() - 0.5) * 10
    });
    if (G.emotes.length > 24) G.emotes.shift();
  };

  /* ---------------------------------------------------------------- caring */
  G.addBond = function (d, amt) {
    var before = G.hearts(d.rec);
    d.rec.bond = U.clamp(d.rec.bond + amt, 0, 1);
    var after = G.hearts(d.rec);
    if (after > before) {
      G.say(d.rec.name + ' loves you a little more! ' + after + ' hearts.', 'good');
      Audio.chime(true);
    }
  };

  G.pet = function (d, strength) {
    var n = d.rec.needs;
    n.mood = U.clamp(n.mood + 0.004 * strength, 0, 1);
    G.addBond(d, 0.00035 * strength);
    d.rec.stats.pets++;
    d.petCharge = (d.petCharge || 0) + strength;
    d.petting = 0.5;
    if (d.petCharge > 26) {
      d.petCharge = 0;
      G.emote(d, 'heart');
      if (U.chance(0.4)) Audio.pant();
      if (n.energy > 0.25 && U.chance(0.25)) setBehavior(d, 'happy', 1.1);
    }
    d.wagTarget = 1;
  };

  G.putFood = function () {
    if (G.inventory.food <= 0) { G.say('No food left. Buy a bag at the shop.', 'warn'); return false; }
    G.inventory.food--;
    G.bowls.food = U.clamp(G.bowls.food + 1, 0, 1);
    G.say('You filled the food bowl.');
    Audio.blip(660, 0.06, 'triangle', 0.1);
    return true;
  };

  G.putWater = function () {
    if (G.inventory.water <= 0) { G.say('No fresh water jugs left.', 'warn'); return false; }
    G.inventory.water--;
    G.bowls.water = U.clamp(G.bowls.water + 1, 0, 1);
    G.say('You filled the water bowl.');
    Audio.splash();
    return true;
  };

  G.brushAt = function (d, worldX, worldY) {
    var n = d.rec.needs;
    n.clean = U.clamp(n.clean + 0.0022, 0, 1);
    n.mood = U.clamp(n.mood + 0.0012, 0, 1);
    G.addBond(d, 0.00012);
    if (U.chance(0.05)) G.emote(d, 'sparkle', (Math.random() - 0.5) * 30, 0);
  };

  G.washAt = function (d) {
    var n = d.rec.needs;
    var before = n.clean;
    n.clean = U.clamp(n.clean + 0.004, 0, 1);
    d.bubbles = U.clamp(d.bubbles + 0.03, 0, 1);
    if (U.chance(0.04)) G.emote(d, 'bubble', (Math.random() - 0.5) * 40, -10);
    if (before < 0.99 && n.clean >= 0.99) {
      setBehavior(d, 'shakeoff', 1.4);
      d.bubbles = 0;
      G.addBond(d, 0.01);
      G.say(d.rec.name + ' shakes off — sparkling clean!', 'good');
      Audio.splash();
      for (var i = 0; i < 6; i++) G.emote(d, 'bubble', (Math.random() - 0.5) * 50, -20);
    }
  };

  G.giveTreat = function (d) {
    if (G.inventory.treats <= 0) { G.say('You are out of treats.', 'warn'); return false; }
    G.inventory.treats--;
    d.rec.needs.hunger = U.clamp(d.rec.needs.hunger + 0.08, 0, 1);
    d.rec.needs.mood = U.clamp(d.rec.needs.mood + 0.1, 0, 1);
    G.addBond(d, 0.01);
    G.emote(d, 'heart');
    setBehavior(d, 'happy', 1.2);
    Audio.chime(true);
    return true;
  };

  /* ------------------------------------------------------------- behaviour */
  function setBehavior(d, name, time) {
    d.behavior = name;
    d.btimer = time || 1.5;
    d.behaviorStart = Date.now();
  }
  G.setBehavior = setBehavior;

  var POSE_FOR = {
    idle: 'stand', wander: 'stand', sit: 'sit', down: 'down', sleep: 'sleep',
    eat: 'eat', drink: 'eat', happy: 'play', bark: 'bark', fetchOut: 'stand',
    fetchBack: 'stand', beg: 'beg', shake: 'sit', rollover: 'down',
    scratch: 'scratch', shakeoff: 'shakeoff', sniff: 'eat', come: 'stand',
    playbow: 'play', jump: 'stand', stretch: 'down'
  };

  function wantsSleep(d) {
    var n = d.rec.needs;
    return n.energy < 0.16 || (G.hour > 22.5 || G.hour < 6) && n.energy < 0.55;
  }

  function pickIdle(d) {
    var n = d.rec.needs, pers = d.spec.personality;
    if (wantsSleep(d)) return setBehavior(d, 'sleep', U.rand(12, 30));
    if (G.bowls.food > 0.02 && n.hunger < 0.72) { d.moveTo = { x: G.foodBowl.x, y: G.foodBowl.y + 12 }; return setBehavior(d, 'goEat', 6); }
    if (G.bowls.water > 0.02 && n.thirst < 0.7) { d.moveTo = { x: G.waterBowl.x, y: G.waterBowl.y + 12 }; return setBehavior(d, 'goDrink', 6); }

    var r = Math.random();
    if (n.energy < 0.35) {
      if (r < 0.5) return setBehavior(d, 'down', U.rand(6, 14));
      return setBehavior(d, 'sit', U.rand(4, 9));
    }
    if (r < 0.26 * pers.energy) {
      d.moveTo = { x: U.rand(34, 218), y: U.rand(112, 152) };
      return setBehavior(d, 'wander', 6);
    }
    if (r < 0.4) return setBehavior(d, 'sit', U.rand(3, 8));
    if (r < 0.5) return setBehavior(d, 'sniff', U.rand(1.5, 3.5));
    if (r < 0.57) return setBehavior(d, 'scratch', 2.2);
    if (r < 0.63 && n.clean < 0.7) return setBehavior(d, 'shakeoff', 1.3);
    if (r < 0.7 && n.mood > 0.5) return setBehavior(d, 'playbow', 1.6);
    if (r < 0.75 && n.mood < 0.4) return setBehavior(d, 'bark', 0.8);
    if (r < 0.8) return setBehavior(d, 'down', U.rand(5, 12));
    return setBehavior(d, 'idle', U.rand(2, 5));
  }

  function moveToward(d, dt, tx, ty, speed) {
    var dx = tx - d.x, dy = ty - d.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 3) { d.gaitAmp = U.approach(d.gaitAmp, 0, 0.2, dt); return true; }
    var step = speed * dt;
    d.x += dx / dist * Math.min(step, dist);
    d.y += dy / dist * Math.min(step * 0.55, Math.abs(dy));
    if (Math.abs(dx) > 2) d.facing = dx > 0 ? 1 : -1;
    d.gaitAmp = U.approach(d.gaitAmp, 1, 0.16, dt);
    d.gaitSpeed = U.clamp(speed / 46, 0.7, 1.7);
    d.running = speed > 70;
    d.gaitPhase += dt * (speed / 26) * (d.running ? 0.85 : 0.72);
    return false;
  }

  /* Depth scaling gives the room a bit of 3D without a 3D engine. */
  function depthScale(d) { return U.clamp(0.80 + (d.y - 104) / 56 * 0.28, 0.74, 1.12); }

  function updateBehavior(d, dt) {
    var n = d.rec.needs;
    d.btimer -= dt;

    switch (d.behavior) {
      case 'wander':
        if (d.moveTo && moveToward(d, dt, d.moveTo.x, d.moveTo.y, 42)) { d.moveTo = null; setBehavior(d, 'idle', U.rand(0.8, 2.4)); }
        break;

      case 'come':
        if (d.moveTo && moveToward(d, dt, d.moveTo.x, d.moveTo.y, 92)) {
          d.moveTo = null;
          setBehavior(d, U.chance(0.55) ? 'sit' : 'happy', 2.4);
          G.emote(d, 'heart');
          G.addBond(d, 0.004);
        }
        break;

      case 'goEat':
        if (d.moveTo && moveToward(d, dt, d.moveTo.x, d.moveTo.y, 54)) { d.moveTo = null; setBehavior(d, 'eat', U.rand(3.5, 6)); d.facing = G.foodBowl.x > d.x ? 1 : -1; }
        break;
      case 'goDrink':
        if (d.moveTo && moveToward(d, dt, d.moveTo.x, d.moveTo.y, 54)) { d.moveTo = null; setBehavior(d, 'drink', U.rand(3, 5)); d.facing = G.waterBowl.x > d.x ? 1 : -1; }
        break;

      case 'eat':
        G.bowls.food = U.clamp(G.bowls.food - dt * 0.22, 0, 1);
        n.hunger = U.clamp(n.hunger + dt * 0.16, 0, 1);
        n.mood = U.clamp(n.mood + dt * 0.02, 0, 1);
        if (U.chance(dt * 2)) G.emote(d, 'crumb', 0, 24);
        if (d.btimer <= 0 || G.bowls.food <= 0.001 || n.hunger > 0.99) {
          d.rec.stats.meals++;
          G.addBond(d, 0.006);
          setBehavior(d, 'idle', 1.5);
        }
        break;

      case 'drink':
        G.bowls.water = U.clamp(G.bowls.water - dt * 0.24, 0, 1);
        n.thirst = U.clamp(n.thirst + dt * 0.2, 0, 1);
        if (d.btimer <= 0 || G.bowls.water <= 0.001 || n.thirst > 0.99) setBehavior(d, 'idle', 1.2);
        break;

      case 'fetchOut': {
        var toy = G.toys[0];
        if (!toy || toy.gone) { setBehavior(d, 'idle', 1); break; }
        if (toy.z > 6) { /* watch it fly */ d.lookAt = { x: toy.x, y: toy.y - toy.z }; break; }
        if (moveToward(d, dt, toy.x, toy.y, 108)) {
          d.carrying = toy;
          toy.held = true;
          Audio.bark(d.spec.voice.pitch * 1.1, d.spec.voice.big, d.spec.voice.bay);
          d.moveTo = { x: G.handHome.x, y: G.handHome.y };
          setBehavior(d, 'fetchBack', 8);
        }
        break;
      }

      case 'fetchBack':
        if (d.moveTo && moveToward(d, dt, d.moveTo.x, d.moveTo.y, 92)) {
          if (d.carrying) { d.carrying.held = false; d.carrying.z = 0; d.carrying.vx = 0; d.carrying.vy = 0; d.carrying = null; }
          G.addBond(d, 0.006);
          n.mood = U.clamp(n.mood + 0.06, 0, 1);
          n.energy = U.clamp(n.energy - 0.02, 0, 1);
          G.emote(d, 'note');
          setBehavior(d, 'happy', 1.4);
          G.say(d.rec.name + ' brought it back!', 'good');
        }
        break;

      case 'bark':
        if (!d.barked) { d.barked = true; Audio.bark(d.spec.voice.pitch, d.spec.voice.big, d.spec.voice.bay); }
        if (d.btimer <= 0) { d.barked = false; setBehavior(d, 'idle', U.rand(1, 3)); }
        break;

      case 'speakCmd':
        if (!d.barked) { d.barked = true; Audio.bark(d.spec.voice.pitch, d.spec.voice.big, d.spec.voice.bay); }
        if (d.btimer <= 0) { d.barked = false; setBehavior(d, 'sit', 2); }
        break;

      case 'shakeoff':
        d.tilt = Math.sin((Date.now() - d.behaviorStart) / 26) * 0.12;
        if (d.btimer <= 0) { d.tilt = 0; setBehavior(d, 'idle', 1); }
        break;

      case 'rollover':
        d.roll = Math.sin(U.clamp(1 - d.btimer / 1.6, 0, 1) * Math.PI * 2) * Math.PI;
        if (d.btimer <= 0) { d.roll = 0; setBehavior(d, 'down', 1.5); }
        break;

      case 'jump':
        d.hop = -Math.sin(U.clamp(1 - d.btimer / 0.8, 0, 1) * Math.PI) * 34;
        if (d.btimer <= 0) { d.hop = 0; setBehavior(d, 'idle', 1); }
        break;

      case 'happy':
        d.hop = -Math.abs(Math.sin((Date.now() - d.behaviorStart) / 110)) * 10;
        if (d.btimer <= 0) { d.hop = 0; setBehavior(d, 'idle', 1); }
        break;

      case 'sleep':
        n.energy = U.clamp(n.energy + dt * 0.02, 0, 1);
        if (n.energy > 0.92 || d.btimer <= 0) setBehavior(d, 'down', 3);
        break;

      case 'sit': case 'down': case 'idle': case 'sniff': case 'scratch':
      case 'playbow': case 'beg': case 'shake': case 'stay':
        if (d.btimer <= 0) pickIdle(d);
        break;

      default:
        if (d.btimer <= 0) pickIdle(d);
    }

    if (d.behavior !== 'wander' && d.behavior !== 'come' && d.behavior.indexOf('fetch') !== 0 &&
        d.behavior.indexOf('go') !== 0) {
      d.gaitAmp = U.approach(d.gaitAmp, 0, 0.18, dt);
    }
  }

  /* Blend the current pose toward the pose the behaviour asks for. */
  function updatePose(d, dt) {
    var target = POSE_FOR[d.behavior] || 'stand';
    if (d.behavior === 'fetchOut' || d.behavior === 'fetchBack' || d.behavior === 'come' || d.behavior === 'wander') {
      target = d.gaitAmp > 0.4 && d.running ? 'alert' : 'stand';
    }
    if (d.behavior === 'shake') target = 'sit';
    if (d.behavior === 'speakCmd') target = 'bark';
    if (d.behavior === 'sleep') target = 'sleep';

    var tp = R.POSE[target] || R.POSE.stand;
    var rate = 0.12;
    var b = d.spec.build;
    for (var i = 0; i < R.POSE_KEYS.length; i++) {
      var k = R.POSE_KEYS[i];
      /* head placement is per-build: a heavy hound carries it closer in */
      var off = k === 'hdX' ? (b.headDX || 0) : k === 'hdY' ? (b.headDY || 0) : 0;
      d.pose[k] = U.approach(d.pose[k], tp[k] + off, rate, dt);
    }

    /* head follows whatever it is interested in */
    if (d.lookAt) {
      var rel = (d.lookAt.x - d.x) * d.facing;
      d.pose.hdX += U.clamp(rel * 0.02, -6, 8);
      d.pose.hdY += U.clamp((d.lookAt.y - (d.y - 70)) * 0.06, -10, 14);
    }

    /* small idle life: breathing, blinking, ear flicks, tail */
    d.blinkTimer -= dt;
    if (d.blinkTimer <= 0) { d.blinkTimer = U.rand(1.8, 5.5); d.blinkPhase = 0.18; }
    if (d.blinkPhase > 0) { d.blinkPhase -= dt; d.blink = Math.sin(U.clamp(1 - d.blinkPhase / 0.18, 0, 1) * Math.PI); }
    else d.blink = 0;
    if (d.behavior === 'sleep') d.blink = 0;

    var wagWant = 0.15;
    var n = d.rec.needs;
    if (d.behavior === 'happy' || d.behavior === 'playbow' || d.behavior === 'fetchBack') wagWant = 1;
    else if (d.behavior === 'come' || d.behavior === 'eat' || d.behavior === 'shake') wagWant = 0.7;
    else if (d.behavior === 'sleep') wagWant = 0;
    else wagWant = 0.12 + n.mood * 0.45;
    if (d.wagTarget) { wagWant = Math.max(wagWant, d.wagTarget); d.wagTarget = U.approach(d.wagTarget, 0, 0.06, dt); }
    d.wag = U.approach(d.wag, wagWant, 0.08, dt);

    if (d.petting > 0) {
      d.petting -= dt;
      d.pose.lid = U.clamp(d.pose.lid + 0.45, 0, 0.85);
      d.pose.ear += 0.12;
      d.pose.hdRot += 0.05;
    }
    d.panting = d.running || d.behavior === 'happy' || n.thirst < 0.3;

    /* Tongue out: always while panting, and otherwise now and then, which is
       how Cherry looks in most photographs of her. */
    d.lollTimer -= dt;
    if (d.lollTimer <= 0) {
      var canLoll = n.mood > 0.3 && d.behavior !== 'sleep' && d.behavior !== 'eat' && d.behavior !== 'drink';
      d.lolling = !d.lolling && canLoll;
      d.lollTimer = d.lolling ? U.rand(2.5, 7) : U.rand(3, 11);
    }
    var tongueWant = 0;
    if (d.behavior === 'sleep' || d.behavior === 'eat' || d.behavior === 'drink') tongueWant = 0;
    else if (d.panting) tongueWant = 0.85;
    else if (d.behavior === 'playbow' || d.behavior === 'happy') tongueWant = 0.7;
    else if (d.lolling) tongueWant = 0.55;
    d.tongue = U.approach(d.tongue, tongueWant, 0.09, dt);
    d.scale = depthScale(d);
    d.bubbles = U.approach(d.bubbles, 0, 0.02, dt);
  }

  /* ------------------------------------------------------------------ toys */
  G.throwToy = function (kind, x, y, vx, vy, vz) {
    var toy = { kind: kind, x: x, y: y, z: 8, vx: vx, vy: vy, vz: vz, spin: 0, gone: false, held: false };
    G.toys = [toy];
    var d = G.dog();
    if (d) {
      d.lookAt = { x: x, y: y };
      if (d.rec.needs.energy > 0.12) setBehavior(d, 'fetchOut', 12);
      else { G.say(d.rec.name + ' is too tired to chase it.', 'warn'); Audio.whine(); }
    }
    return toy;
  };

  function updateToys(dt) {
    for (var i = G.toys.length - 1; i >= 0; i--) {
      var t = G.toys[i];
      if (t.held) {
        var d = G.dog();
        if (d && d.carrying === t) {
          var s = d.spec.build.scale * d.scale;
          t.x = d.x + d.facing * 46 * s;
          t.y = d.y;
          t.z = 62 * s;
          t.spin += dt * 2;
        }
        continue;
      }
      if (t.z > 0 || Math.abs(t.vz) > 1) {
        t.vz -= (t.kind === 'disc' ? 210 : 420) * dt;
        if (t.kind === 'disc') { t.vx *= (1 - 0.35 * dt); t.vz += 120 * dt; }
        t.x += t.vx * dt;
        t.y += t.vy * dt;
        t.z += t.vz * dt;
        t.spin += dt * 8;
        if (t.z <= 0) {
          t.z = 0;
          if (Math.abs(t.vz) > 60) { t.vz = -t.vz * 0.42; t.vx *= 0.6; t.vy *= 0.6; Audio.thud(0.08); }
          else { t.vz = 0; t.vx = 0; t.vy = 0; }
        }
      }
      t.x = U.clamp(t.x, 14, 242);
      t.y = U.clamp(t.y, 106, 154);
    }
  }

  /* -------------------------------------------------------------- commands */
  /* Physical guidance: the player shapes the behaviour with the stylus first,
     then names it — which is how you actually teach a dog in Nintendogs. */
  G.induce = function (d, trickId) {
    if (d.actionLock > 0) return false;
    switch (trickId) {
      case 'sit': setBehavior(d, 'sit', 4); break;
      case 'down': setBehavior(d, 'down', 5); break;
      case 'shake': setBehavior(d, 'shake', 2.2); break;
      case 'rollover': setBehavior(d, 'rollover', 1.6); break;
      case 'speak': setBehavior(d, 'speakCmd', 0.7); break;
      case 'jump': setBehavior(d, 'jump', 0.8); break;
      default: return false;
    }
    d.actionLock = 0.4;
    G.pendingTrick = { id: trickId, until: Date.now() + 6000, dog: d };
    return true;
  };

  G.teach = function (d, trickId) {
    var k = d.rec.tricks;
    if (k[trickId] === undefined) return;
    var gain = 0.16 + d.spec.personality.focus * 0.12 + d.rec.bond * 0.08;
    k[trickId] = U.clamp(k[trickId] + gain, 0, 1);
    G.addBond(d, 0.008);
    d.rec.needs.mood = U.clamp(d.rec.needs.mood + 0.03, 0, 1);
    G.emote(d, 'note');
    Audio.chime(true);
    var pct = Math.round(k[trickId] * 100);
    G.say(d.rec.name + ' is learning "' + trickLabel(trickId) + '" (' + pct + '%)', 'good');
    if (k[trickId] >= 1) G.say(d.rec.name + ' has mastered ' + trickLabel(trickId) + '!', 'good');
    G.pendingTrick = null;
    G.persist();
  };

  function trickLabel(id) {
    for (var i = 0; i < TRICKS.length; i++) if (TRICKS[i].id === id) return TRICKS[i].label;
    return id;
  }
  G.trickLabel = trickLabel;

  /* Asking for a trick the dog already knows. */
  G.command = function (d, trickId) {
    var known = d.rec.tricks[trickId] || 0;
    if (known <= 0.01) {
      G.say(d.rec.name + " doesn't know that one yet.", 'warn');
      setBehavior(d, U.chance(0.5) ? 'sniff' : 'idle', 1.6);
      G.emote(d, 'question');
      Audio.whine();
      return false;
    }
    var n = d.rec.needs;
    var focus = d.spec.personality.focus;
    var chance = U.clamp(known * (0.55 + focus * 0.3) + n.mood * 0.25 + d.rec.bond * 0.2 - (1 - n.energy) * 0.2, 0.05, 0.98);
    if (Math.random() < chance) {
      G.induceSilent(d, trickId);
      d.rec.tricks[trickId] = U.clamp(known + 0.02, 0, 1);
      G.addBond(d, 0.003);
      n.mood = U.clamp(n.mood + 0.02, 0, 1);
      G.emote(d, 'star');
      G.say(d.rec.name + ' did it — ' + trickLabel(trickId) + '!', 'good');
      Audio.blip(1180, 0.05, 'triangle', 0.1);
      G.coins += 1;
      return true;
    }
    G.emote(d, 'question');
    G.say(d.rec.name + ' tilts her head...', 'warn');
    setBehavior(d, 'idle', 1.4);
    return false;
  };

  G.induceSilent = function (d, trickId) {
    switch (trickId) {
      case 'sit': setBehavior(d, 'sit', 4.5); break;
      case 'down': setBehavior(d, 'down', 5); break;
      case 'shake': setBehavior(d, 'shake', 2.4); break;
      case 'rollover': setBehavior(d, 'rollover', 1.6); break;
      case 'speak': setBehavior(d, 'speakCmd', 0.7); break;
      case 'jump': setBehavior(d, 'jump', 0.8); break;
    }
  };

  G.call = function (d, loud) {
    if (!d) return;
    var n = d.rec.needs;
    if (d.behavior === 'sleep' && !loud) { Audio.whine(); return; }
    d.moveTo = { x: G.handHome.x, y: G.handHome.y };
    setBehavior(d, 'come', 6);
    d.earFlap = 1;
    G.emote(d, 'note');
    Audio.whistle();
    n.mood = U.clamp(n.mood + 0.01, 0, 1);
  };

  /* ------------------------------------------------------------------ walk */
  G.startWalk = function () {
    var d = G.dog();
    if (!d) return;
    if (d.rec.needs.energy < 0.15) { G.say(d.rec.name + ' is too tired for a walk.', 'warn'); return; }
    G.mode = 'walk';
    G.walk = { scroll: 0, distance: 0, target: 900, speed: 0, items: [], picked: 0, done: false, sniffing: 0 };
    for (var i = 0; i < 8; i++) {
      G.walk.items.push({ at: 120 + i * 95 + U.rand(-25, 25), kind: U.pick(['gift', 'coin', 'coin', 'bone']), taken: false });
    }
    d.x = 96; d.y = 146; d.facing = 1;
    setBehavior(d, 'wander', 999);
    G.say('Walk time! Hold the road to walk, tap treasures to grab them.');
  };

  G.endWalk = function (finished) {
    var d = G.dog();
    G.mode = 'home';
    if (d) {
      d.x = 128; d.y = 148; d.facing = -1;
      setBehavior(d, 'happy', 1.6);
      if (finished) {
        d.rec.stats.walks++;
        d.rec.needs.mood = U.clamp(d.rec.needs.mood + 0.35, 0, 1);
        d.rec.needs.energy = U.clamp(d.rec.needs.energy - 0.25, 0, 1);
        d.rec.needs.clean = U.clamp(d.rec.needs.clean - 0.18, 0, 1);
        d.rec.needs.thirst = U.clamp(d.rec.needs.thirst - 0.12, 0, 1);
        G.addBond(d, 0.05);
        G.say('Back home. That was a good walk!', 'good');
      }
    }
    G.walk = null;
    G.persist();
  };

  /* -------------------------------------------------------------- contest */
  G.startContest = function () {
    var d = G.dog();
    if (!d) return;
    if (d.rec.needs.energy < 0.2) { G.say(d.rec.name + ' needs a nap before competing.', 'warn'); return; }
    G.mode = 'contest';
    G.contest = { time: 60, score: 0, throws: 0, catches: 0, best: 0, disc: null, state: 'ready', combo: 0 };
    d.x = 52; d.y = 158; d.facing = 1;
    setBehavior(d, 'alertWait', 999);
    G.say('Disc competition! Swipe to throw, ' + d.rec.name + ' will run it down.');
  };

  G.endContest = function () {
    var c = G.contest, d = G.dog();
    if (!c || !d) { G.mode = 'home'; return; }
    var payout = Math.round(c.score * 1.6);
    G.coins += payout;
    d.rec.stats.contests++;
    if (c.score > d.rec.stats.discBest) d.rec.stats.discBest = c.score;
    d.rec.needs.energy = U.clamp(d.rec.needs.energy - 0.3, 0, 1);
    d.rec.needs.mood = U.clamp(d.rec.needs.mood + 0.3, 0, 1);
    d.rec.needs.thirst = U.clamp(d.rec.needs.thirst - 0.2, 0, 1);
    G.addBond(d, 0.04);
    G.say('Contest over! Score ' + c.score + ' — earned ' + payout + ' coins.', 'good');
    G.contest = null;
    G.mode = 'home';
    d.x = 128; d.y = 148;
    setBehavior(d, 'happy', 1.6);
    G.persist();
  };

  /* ------------------------------------------------------------------ tick */
  G.update = function (dt) {
    var realHours = dt / 3600;
    G.syncClock();

    G.dogs.forEach(function (d, i) {
      var n = d.rec.needs;
      var activeMult = i === G.active ? 1 : 0.6;
      n.hunger = U.clamp(n.hunger - DRAIN.hunger * realHours * activeMult, 0, 1);
      n.thirst = U.clamp(n.thirst - DRAIN.thirst * realHours * activeMult, 0, 1);
      n.clean = U.clamp(n.clean - DRAIN.clean * realHours * activeMult, 0, 1);
      n.mood = U.clamp(n.mood - DRAIN.mood * realHours * activeMult, 0, 1);
      if (d.behavior === 'sleep') n.energy = U.clamp(n.energy + realHours * 6, 0, 1);
      else n.energy = U.clamp(n.energy - DRAIN.energy * realHours * (d.running ? 3 : 1), 0, 1);

      d.actionLock = Math.max(0, d.actionLock - dt);
      d.earFlap = U.approach(d.earFlap, 0, 0.05, dt);

      if (i === G.active && G.mode === 'home') updateBehavior(d, dt);
      else if (i !== G.active) updateIdleDog(d, dt);
      updatePose(d, dt);
    });

    updateToys(dt);

    /* emotes float up and fade */
    for (var e = G.emotes.length - 1; e >= 0; e--) {
      var em = G.emotes[e];
      em.life -= dt * 0.9;
      em.y += em.vy * dt;
      em.x += em.vx * dt;
      em.vy *= 0.96;
      if (em.life <= 0) G.emotes.splice(e, 1);
    }

    if (G.pendingTrick && Date.now() > G.pendingTrick.until) G.pendingTrick = null;

    /* every so often a present turns up on the floor */
    if (G.mode === 'home' && !G.gift) {
      G.giftTimer -= dt;
      if (G.giftTimer <= 0) {
        G.giftTimer = U.rand(150, 320);
        G.gift = { x: U.rand(44, 210), y: U.rand(116, 150), t: 0 };
        G.say('A present arrived! Tap it to open.', 'good');
        Audio.chime(true);
      }
    }
    if (G.gift) G.gift.t += dt;

    G.autosaveTimer = (G.autosaveTimer || 0) + dt;
    if (G.autosaveTimer > 12) { G.autosaveTimer = 0; G.persist(); }
  };

  G.openGift = function () {
    if (!G.gift) return;
    G.gift = null;
    var roll = Math.random();
    if (roll < 0.35) {
      var c = U.randInt(8, 24);
      G.coins += c;
      G.say('The present had ' + c + ' coins inside!', 'good');
    } else if (roll < 0.62) {
      G.inventory.treats += 3;
      G.say('A box of treats!', 'good');
    } else if (roll < 0.82) {
      G.inventory.food += 2; G.inventory.water += 2;
      G.say('Food and water — someone is looking out for you.', 'good');
    } else {
      G.inventory.shampoo += 2;
      G.say('Two bottles of shampoo.', 'good');
    }
    var d = G.dog();
    if (d) { G.emote(d, 'star'); setBehavior(d, 'happy', 1.4); }
    Audio.chime(true);
    G.persist();
  };

  /* the dog you are not playing with still naps, sits and shifts around */
  function updateIdleDog(d, dt) {
    d.btimer -= dt;
    if (d.btimer > 0) return;
    var n = d.rec.needs;
    if (n.energy < 0.4 || G.hour > 22 || G.hour < 6.5) setBehavior(d, 'sleep', U.rand(20, 60));
    else setBehavior(d, U.pick(['sit', 'down', 'idle', 'sit']), U.rand(6, 18));
  }

  /* fixed props in the living room */
  G.foodBowl = { x: 200, y: 146 };
  G.waterBowl = { x: 232, y: 146 };
  G.handHome = { x: 128, y: 150 };

  global.FD.Game = G;
})(window);
