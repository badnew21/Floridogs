/* Floridogs — procedural dog rendering.
   Dogs are drawn as vector art in a body-local space where the ground is y=0,
   "up" is negative y, the dog faces +x, and the withers sit at y=-100.
   Everything scales from that, so one rig fits every build in dogs.js. */
(function (global) {
  'use strict';

  var U = global.FD.U;

  /* ---------------------------------------------------------------- poses -- */
  var POSE = {
    stand: { hipX: -34, hipY: -86, shX: 30, shY: -90, hdX: 60, hdY: -112, hdRot: -0.06,
             fpX: 32, fpY: 0, rpX: -36, rpY: 0, ear: 0, mouth: 0, lid: 0, tailBase: -0.5, tailUp: 0 },
    alert: { hipX: -34, hipY: -88, shX: 31, shY: -93, hdX: 62, hdY: -120, hdRot: -0.16,
             fpX: 33, fpY: 0, rpX: -36, rpY: 0, ear: -0.35, mouth: 0, lid: -0.15, tailBase: -0.9, tailUp: 1 },
    sit:   { hipX: -28, hipY: -42, shX: 28, shY: -90, hdX: 58, hdY: -114, hdRot: -0.05,
             fpX: 34, fpY: 0, rpX: -12, rpY: 0, ear: -0.1, mouth: 0.15, lid: 0, tailBase: 0.1, tailUp: 0 },
    down:  { hipX: -30, hipY: -32, shX: 24, shY: -42, hdX: 52, hdY: -62, hdRot: 0.02,
             fpX: 56, fpY: -3, rpX: -14, rpY: -2, ear: 0.05, mouth: 0.1, lid: 0.15, tailBase: 0.6, tailUp: 0 },
    sleep: { hipX: -26, hipY: -26, shX: 16, shY: -32, hdX: 54, hdY: -17, hdRot: 0.34,
             fpX: 52, fpY: -3, rpX: -12, rpY: -2, ear: 0.25, mouth: 0, lid: 1, tailBase: 0.9, tailUp: 0 },
    eat:   { hipX: -34, hipY: -84, shX: 30, shY: -86, hdX: 60, hdY: -46, hdRot: 0.42,
             fpX: 32, fpY: 0, rpX: -36, rpY: 0, ear: 0.15, mouth: 0.5, lid: 0.25, tailBase: -0.4, tailUp: 0 },
    beg:   { hipX: -22, hipY: -34, shX: 4, shY: -92, hdX: 30, hdY: -122, hdRot: -0.15,
             fpX: 24, fpY: -60, rpX: -8, rpY: 0, ear: -0.25, mouth: 0.35, lid: 0, tailBase: 0.1, tailUp: 0 },
    bark:  { hipX: -34, hipY: -86, shX: 30, shY: -92, hdX: 62, hdY: -118, hdRot: -0.28,
             fpX: 32, fpY: 0, rpX: -36, rpY: 0, ear: -0.3, mouth: 1, lid: -0.1, tailBase: -0.8, tailUp: 1 },
    play:  { hipX: -34, hipY: -84, shX: 26, shY: -54, hdX: 58, hdY: -72, hdRot: 0.28,
             fpX: 52, fpY: -2, rpX: -34, rpY: 0, ear: -0.2, mouth: 0.6, lid: 0, tailBase: -1.0, tailUp: 1 },
    shakeoff: { hipX: -34, hipY: -84, shX: 30, shY: -88, hdX: 60, hdY: -110, hdRot: 0,
             fpX: 32, fpY: 0, rpX: -36, rpY: 0, ear: 0.3, mouth: 0.2, lid: 0.6, tailBase: -0.3, tailUp: 0 },
    scratch: { hipX: -30, hipY: -46, shX: 28, shY: -88, hdX: 58, hdY: -108, hdRot: 0.15,
             fpX: 34, fpY: 0, rpX: -12, rpY: 0, ear: 0.1, mouth: 0.3, lid: 0.5, tailBase: 0.2, tailUp: 0 }
  };
  var POSE_KEYS = Object.keys(POSE.stand);

  function blankPose() {
    var o = {};
    for (var i = 0; i < POSE_KEYS.length; i++) o[POSE_KEYS[i]] = POSE.stand[POSE_KEYS[i]];
    return o;
  }

  /* --------------------------------------------------------------- rigging -- */
  /* A dog leg is a zigzag: shoulder-elbow-wrist in front, hip-stifle-hock behind.
     Placing the joints along the root->paw line keeps that shape in every pose. */
  function legJoints(rx, ry, px, py, isFront) {
    var t1 = isFront ? 0.42 : 0.34, t2 = isFront ? 0.76 : 0.66;
    var o1 = isFront ? 2.5 : 9, o2 = isFront ? -2 : -8;
    return {
      rx: rx, ry: ry,
      jx: U.lerp(rx, px, t1) + o1, jy: U.lerp(ry, py, t1),
      kx: U.lerp(rx, px, t2) + o2, ky: U.lerp(ry, py, t2),
      px: px, py: py
    };
  }

  /* Paw trajectory for one leg of a gait cycle. */
  function gaitOffset(phase, stride, lift, duty) {
    phase = phase - Math.floor(phase);
    if (phase < duty) {
      var s = phase / duty;              /* stance: planted, sliding backwards */
      return { x: stride * (0.5 - s), y: 0 };
    }
    var w = (phase - duty) / (1 - duty); /* swing: lifts and reaches forward */
    return { x: stride * (-0.5 + w), y: -lift * Math.sin(Math.PI * w) };
  }

  /* --------------------------------------------------------------- drawing -- */
  function tapered(ctx, ax, ay, bx, by, w1, w2, color) {
    var dx = bx - ax, dy = by - ay, len = Math.sqrt(dx * dx + dy * dy) || 0.001;
    var nx = -dy / len, ny = dx / len;
    ctx.beginPath();
    ctx.moveTo(ax + nx * w1, ay + ny * w1);
    ctx.lineTo(bx + nx * w2, by + ny * w2);
    ctx.lineTo(bx - nx * w2, by - ny * w2);
    ctx.lineTo(ax - nx * w1, ay - ny * w1);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath(); ctx.arc(bx, by, w2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ax, ay, w1, 0, Math.PI * 2); ctx.fill();
  }

  function legPath(ctx, rig, color, thick, shade) {
    var c = shade ? shade : color;
    tapered(ctx, rig.rx, rig.ry, rig.jx, rig.jy, thick * 1.5, thick * 0.85, c);
    tapered(ctx, rig.jx, rig.jy, rig.kx, rig.ky, thick * 0.85, thick * 0.52, c);
    tapered(ctx, rig.kx, rig.ky, rig.px, rig.py, thick * 0.52, thick * 0.56, c);
  }

  function paw(ctx, x, y, r, color, toes) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y - r * 0.35, r * 1.15, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    if (toes) {
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      for (var i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.ellipse(x + i * r * 0.55, y - r * 0.18, r * 0.24, r * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /* Torso silhouette: one closed curve through withers, back, croup, rump,
     belly and chest, plus shoulder and thigh masses as clean subpaths. */
  function bodyPath(p, build) {
    var chest = build.chest;
    var shX = p.shX, shY = p.shY, hipX = p.hipX, hipY = p.hipY;
    var depth = 40 * chest;
    var lowest = Math.max(shY, hipY);

    var neckTop = { x: shX + 15, y: shY - 5 };
    var withers = { x: shX - 3, y: shY - 6 };
    var backMid = { x: (shX + hipX) / 2, y: (shY + hipY) / 2 - 3 };
    var croup = { x: hipX + 6, y: hipY - 6 };
    var rump = { x: hipX - 20, y: hipY + 6 };
    var rearBelly = { x: hipX - 2, y: Math.min(hipY + 30, -10) };
    var belly = { x: (shX + hipX) / 2 - 2, y: Math.min(lowest + depth - 8, -12) };
    var chestBot = { x: shX + 2, y: Math.min(shY + depth, -14) };
    var chestFront = { x: shX + 20, y: shY + depth * 0.5 };

    var path = new Path2D();
    path.moveTo(neckTop.x, neckTop.y);
    path.quadraticCurveTo(withers.x, withers.y - 3, backMid.x, backMid.y);
    path.quadraticCurveTo(croup.x + 4, croup.y - 3, rump.x + 2, rump.y);
    path.quadraticCurveTo(rump.x - 8, rump.y + 12, rearBelly.x - 8, rearBelly.y);
    path.quadraticCurveTo(belly.x, belly.y + 5, chestBot.x, chestBot.y);
    path.quadraticCurveTo(chestFront.x + 8, chestFront.y + 10, chestFront.x, chestFront.y);
    path.quadraticCurveTo(neckTop.x + 12, neckTop.y + 12, neckTop.x, neckTop.y);
    path.closePath();

    /* shoulder and thigh are shaded inside the silhouette rather than bulging
       out of it — a hard ellipse edge against a dark patch looks synthetic */
    var shR = 15 * chest, shH = 19 * chest;
    var thR = 17, thH = 21;
    var scx = shX - 4, scy = Math.min(shY + depth * 0.42, -16);
    var tcx = hipX - 4, tcy = Math.min(hipY + depth * 0.4, -16);

    return { path: path, cx: scx, cy: scy, hx: tcx, hy: tcy,
             chestR: shR, chestH: shH, hipR: thR, hipH: thH,
             top: Math.min(withers.y, croup.y) - 4, bottom: chestBot.y };
  }

  function blob(ctx, x, y, rx, ry, rot, seed) {
    var rnd = U.seeded(seed);
    ctx.beginPath();
    var steps = 12;
    for (var i = 0; i <= steps; i++) {
      var a = (i / steps) * Math.PI * 2;
      var wob = 0.78 + rnd() * 0.44;
      var px = Math.cos(a) * rx * wob, py = Math.sin(a) * ry * wob;
      var rx2 = px * Math.cos(rot) - py * Math.sin(rot);
      var ry2 = px * Math.sin(rot) + py * Math.cos(rot);
      if (i === 0) ctx.moveTo(x + rx2, y + ry2); else ctx.lineTo(x + rx2, y + ry2);
    }
    ctx.closePath();
  }

  function paintCoat(ctx, spec, region, seed, opts) {
    var coat = spec.coat;
    opts = opts || {};
    ctx.fillStyle = opts.base || coat.base;
    ctx.fill(region.path);

  }

  function paintPatches(ctx, spec, region, seedBase) {
    var coat = spec.coat;
    ctx.save();
    ctx.clip(region.path);
    for (var i = 0; i < coat.patches.length; i++) {
      var p = coat.patches[i];
      blob(ctx, p.x, p.y, p.rx, p.ry, p.rot, seedBase + i * 977);
      ctx.fillStyle = coat.dark;
      ctx.fill();
      /* brindle inside the dark patches */
      if (coat.brindleStripes) {
        ctx.save();
        ctx.clip();
        ctx.globalAlpha = 0.22;
        ctx.strokeStyle = coat.brindle;
        ctx.lineWidth = 1.3;
        for (var s = 0; s < 10; s++) {
          var x = p.x - p.rx + s * (p.rx * 2 / 9);
          ctx.beginPath();
          ctx.moveTo(x, p.y - p.ry - 4);
          ctx.quadraticCurveTo(x + 5, p.y, x - 1, p.y + p.ry + 4);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    ctx.restore();
  }

  function paintSpeckles(ctx, spec, region) {
    if (!spec.speckles.length) return;
    ctx.save();
    ctx.clip(region.path);
    for (var i = 0; i < spec.speckles.length; i++) {
      var s = spec.speckles[i];
      ctx.globalAlpha = s.a;
      ctx.fillStyle = spec.coat.speckleColor;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.r, s.r * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function paintDirt(ctx, spec, region, amount, seed) {
    if (amount <= 0.02) return;
    ctx.save();
    ctx.clip(region.path);
    var rnd = U.seeded(seed ^ 0x5eed);
    ctx.globalAlpha = U.clamp(amount, 0, 1) * 0.5;
    ctx.fillStyle = '#6b5233';
    for (var i = 0; i < 9; i++) {
      var x = -52 + rnd() * 96, y = -58 + rnd() * 38;
      blob(ctx, x, y, 5 + rnd() * 7, 3 + rnd() * 4, rnd() * 3, seed + i * 31);
      ctx.fill();
    }
    ctx.restore();
  }

  function paintShading(ctx, region) {
    ctx.save();
    ctx.clip(region.path);
    /* muscle volume at the shoulder and thigh */
    [[region.cx, region.cy, region.chestR], [region.hx, region.hy, region.hipR]].forEach(function (m) {
      var rg = ctx.createRadialGradient(m[0] - m[2] * 0.3, m[1] - m[2] * 0.4, m[2] * 0.15, m[0], m[1], m[2] * 1.5);
      rg.addColorStop(0, 'rgba(255,255,255,0.16)');
      rg.addColorStop(0.55, 'rgba(255,255,255,0.03)');
      rg.addColorStop(1, 'rgba(0,0,0,0.10)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(m[0], m[1], m[2] * 1.5, 0, Math.PI * 2);
      ctx.fill();
    });
    var g = ctx.createLinearGradient(0, region.top, 0, region.bottom + 6);
    g.addColorStop(0, 'rgba(255,255,255,0.20)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.0)');
    g.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = g;
    ctx.fillRect(-90, -140, 190, 160);
    ctx.restore();
  }

  /* ------------------------------------------------------------------ head -- */
  function drawEar(ctx, spec, side, droop, swing, counter) {
    var coat = spec.coat, b = spec.build;
    var len = 26 * b.earLen, w = 13 * b.earLen;
    ctx.save();
    ctx.rotate(0.26 + droop * 0.55 + swing * (side === 'near' ? 1 : 0.6) - (counter || 0));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-w * 0.9, len * 0.45, -w * 0.35, len);
    ctx.quadraticCurveTo(w * 0.5, len * 1.02, w * 0.75, len * 0.5);
    ctx.quadraticCurveTo(w * 0.9, len * 0.12, 0, 0);
    ctx.closePath();
    ctx.fillStyle = side === 'far' ? coat.darkShade : coat.dark;
    ctx.fill();
    if (side === 'near') {
      /* a soft rim keeps a dark ear readable against a dark head */
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    if (side === 'near') {
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(0, len * 0.12);
      ctx.quadraticCurveTo(-w * 0.35, len * 0.5, -w * 0.1, len * 0.82);
      ctx.quadraticCurveTo(w * 0.35, len * 0.7, w * 0.35, len * 0.32);
      ctx.closePath();
      ctx.fillStyle = coat.innerEar;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawHead(ctx, spec, p, t, opts) {
    var coat = spec.coat, b = spec.build;
    opts = opts || {};
    var skull = 20 * b.skull;
    var muzzleL = 20 * b.muzzleLen, muzzleD = 12 * b.muzzleDepth;
    var lid = U.clamp(p.lid + (opts.blink || 0), 0, 1);

    ctx.save();
    ctx.translate(p.hdX, p.hdY);
    ctx.rotate(p.hdRot);

    /* far ear behind the skull */
    ctx.save(); ctx.translate(-skull * 0.48, -skull * 0.5); drawEar(ctx, spec, 'far', p.ear, Math.sin(t * 6) * 0.05 * (opts.earFlap || 0), p.hdRot * 0.65); ctx.restore();

    /* skull */
    var headRegion = new Path2D();
    headRegion.ellipse(0, 0, skull * 1.04, skull * 0.95, 0, 0, Math.PI * 2);
    headRegion.moveTo(0, 0);
    headRegion.ellipse(skull * 0.62 + muzzleL * 0.42, skull * 0.34, muzzleL * 0.72, muzzleD * 0.8, 0.06, 0, Math.PI * 2);
    headRegion.moveTo(-skull * 0.2, -skull * 0.2);
    headRegion.lineTo(skull * 0.9, -skull * 0.1);
    headRegion.lineTo(skull * 0.95, skull * 0.9);
    headRegion.lineTo(-skull * 0.2, skull * 0.8);
    headRegion.closePath();

    ctx.fillStyle = coat.headDark ? coat.dark : coat.base;
    ctx.fill(headRegion);

    /* brindle texture on a dark head */
    if (coat.headDark && coat.brindleStripes) {
      ctx.save(); ctx.clip(headRegion);
      ctx.globalAlpha = 0.4; ctx.strokeStyle = coat.brindle; ctx.lineWidth = 1.7;
      for (var i = 0; i < 8; i++) {
        var x = -skull + i * (skull * 2.4 / 7);
        ctx.beginPath(); ctx.moveTo(x, -skull); ctx.quadraticCurveTo(x + 4, 0, x - 2, skull); ctx.stroke();
      }
      ctx.restore();
    }

    /* white blaze up the muzzle and between the eyes */
    if (coat.blaze) {
      ctx.save(); ctx.clip(headRegion);
      ctx.fillStyle = coat.base;
      ctx.beginPath();
      ctx.moveTo(skull * 0.28, -skull * 0.72);
      ctx.quadraticCurveTo(skull * 0.5, -skull * 0.1, skull * 0.62, skull * 0.5);
      ctx.quadraticCurveTo(skull * 0.9, skull * 0.9, skull * 1.5, skull * 0.72);
      ctx.quadraticCurveTo(skull * 1.1, skull * 0.2, skull * 0.62, -skull * 0.8);
      ctx.closePath();
      ctx.globalAlpha = 0.96;
      ctx.fill();
      /* white chin and lower muzzle */
      if (coat.muzzleWhite) {
        ctx.globalAlpha = 0.95;
        ctx.beginPath();
        ctx.ellipse(skull * 0.62 + muzzleL * 0.42, skull * 0.56, muzzleL * 0.68, muzzleD * 0.52, 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (coat.mask) {
      ctx.save(); ctx.clip(headRegion);
      ctx.fillStyle = coat.dark; ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.ellipse(skull * 0.85 + muzzleL * 0.42, skull * 0.36, muzzleL * 0.66, muzzleD * 0.62, 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /* soft shading */
    ctx.save(); ctx.clip(headRegion);
    var hg = ctx.createLinearGradient(0, -skull, 0, skull);
    hg.addColorStop(0, 'rgba(255,255,255,0.18)');
    hg.addColorStop(0.6, 'rgba(0,0,0,0)');
    hg.addColorStop(1, 'rgba(0,0,0,0.2)');
    ctx.fillStyle = hg; ctx.fillRect(-skull * 2, -skull * 2, skull * 5, skull * 4);
    ctx.restore();

    /* mouth / tongue */
    var open = p.mouth;
    var mx = skull * 0.62 + muzzleL * 0.5, my = skull * 0.42;
    if (open > 0.05) {
      ctx.fillStyle = '#3a1d1f';
      ctx.beginPath();
      ctx.ellipse(mx - muzzleL * 0.12, my + muzzleD * 0.28, muzzleL * 0.42, muzzleD * 0.42 * open + 1.2, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = coat.tongue;
      ctx.beginPath();
      ctx.ellipse(mx - muzzleL * 0.1, my + muzzleD * 0.34 + open * 2.4, muzzleL * 0.2, (muzzleD * 0.22) * open + 0.8, 0.1, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(mx + muzzleL * 0.3, my + muzzleD * 0.18);
      ctx.quadraticCurveTo(mx - muzzleL * 0.1, my + muzzleD * 0.4, mx - muzzleL * 0.45, my + muzzleD * 0.12);
      ctx.stroke();
    }

    /* nose */
    var nx = skull * 0.62 + muzzleL * 0.95, ny = skull * 0.2;
    ctx.fillStyle = coat.nose;
    ctx.beginPath();
    ctx.ellipse(nx, ny, muzzleL * 0.26, muzzleD * 0.3, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.ellipse(nx - muzzleL * 0.06, ny - muzzleD * 0.13, muzzleL * 0.09, muzzleD * 0.08, -0.3, 0, Math.PI * 2);
    ctx.fill();

    /* eyes */
    var eyes = [
      { x: skull * 0.5, y: -skull * 0.06, s: 1.0 },
      { x: skull * 0.02, y: -skull * 0.16, s: 0.86 }
    ];
    for (var e = 0; e < eyes.length; e++) {
      var ey = eyes[e], r = 4.6 * ey.s * b.skull;
      ctx.save();
      ctx.translate(ey.x, ey.y);
      if (lid > 0.85) {
        ctx.strokeStyle = 'rgba(20,14,10,0.85)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-r, 0); ctx.quadraticCurveTo(0, r * 0.7, r, -r * 0.1);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#f7f2ea';
        ctx.beginPath(); ctx.ellipse(0, 0, r * 1.02, r * (1 - lid * 0.6), 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = coat.eye;
        ctx.beginPath(); ctx.ellipse(r * 0.14, 0, r * 0.78, r * 0.82 * (1 - lid * 0.6), 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#160f0b';
        ctx.beginPath(); ctx.ellipse(r * 0.2, 0, r * 0.4, r * 0.46 * (1 - lid * 0.6), 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(r * 0.45, -r * 0.35, r * 0.24, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath(); ctx.arc(-r * 0.2, r * 0.3, r * 0.12, 0, Math.PI * 2); ctx.fill();
        /* upper lid */
        if (lid > 0.02) {
          ctx.fillStyle = coat.headDark ? coat.dark : coat.base;
          ctx.beginPath();
          ctx.ellipse(0, -r - r * 0.2 + lid * r * 1.25, r * 1.2, r, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    /* brow dots — the little tan spots above a brindle dog's eyes */
    if (coat.headDark) {
      ctx.fillStyle = 'rgba(150,110,70,0.5)';
      ctx.beginPath(); ctx.ellipse(skull * 0.46, -skull * 0.36, 2.6, 1.9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(skull * 0.02, -skull * 0.44, 2.3, 1.7, 0, 0, Math.PI * 2); ctx.fill();
    }

    /* near ear on top */
    ctx.save(); ctx.translate(-skull * 0.22, -skull * 0.62); drawEar(ctx, spec, 'near', p.ear, Math.sin(t * 6 + 1) * 0.06 * (opts.earFlap || 0), p.hdRot * 0.65); ctx.restore();

    ctx.restore();
  }

  /* ------------------------------------------------------------ accessories -- */
  function drawAccessory(ctx, spec, p, kind) {
    if (!kind || kind === 'none') return;
    var b = spec.build;
    /* sit the collar low on the neck, just ahead of the chest */
    var nx = U.lerp(p.shX + 12, p.hdX - 10, 0.34);
    var ny = U.lerp(p.shY - 2, p.hdY + 16, 0.34);
    var ang = Math.atan2(p.hdY + 14 - (p.shY - 2), p.hdX - 12 - (p.shX + 12));
    var rx = 11 * b.neck, ry = 5.5 * b.neck;

    ctx.save();
    ctx.translate(nx, ny);
    ctx.rotate(ang + Math.PI / 2);
    if (kind === 'pearls') {
      var beads = 11;
      for (var i = 0; i < beads; i++) {
        var a = -0.35 + (i / (beads - 1)) * (Math.PI + 0.7);
        var x = Math.cos(a) * rx, y = Math.sin(a) * ry;
        var g = ctx.createRadialGradient(x - 0.8, y - 1, 0.3, x, y, 2.8);
        g.addColorStop(0, '#fff0f4');
        g.addColorStop(0.55, '#f6c6d2');
        g.addColorStop(1, '#d495a8');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
      }
    } else if (kind === 'bandana') {
      ctx.strokeStyle = '#c8433f'; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, -0.25, Math.PI + 0.25); ctx.stroke();
    } else if (kind === 'collar') {
      ctx.strokeStyle = '#e2643c'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, -0.3, Math.PI + 0.3); ctx.stroke();
      ctx.fillStyle = '#e8c25a';
      ctx.beginPath(); ctx.arc(0, ry + 2, 2.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    if (kind === 'bandana') {
      ctx.save();
      ctx.translate(nx, ny);
      ctx.fillStyle = '#b93b37';
      ctx.beginPath();
      ctx.moveTo(-6, 1); ctx.lineTo(6, 1);
      ctx.quadraticCurveTo(3, 14, 0, 17);
      ctx.quadraticCurveTo(-3, 14, -6, 1);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d24b45';
      ctx.beginPath(); ctx.ellipse(0, 2, 5, 3.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  /* ------------------------------------------------------------------- dog -- */
  /* d: runtime dog (see game.js). Draws at d.x, d.y in current canvas space. */
  function drawDog(ctx, d, t) {
    var spec = d.spec, build = spec.build, coat = spec.coat;
    var p = d.pose;
    var s = build.scale * (d.scale || 1);
    var gaitAmp = d.gaitAmp || 0;

    ctx.save();
    ctx.translate(d.x, d.y + (d.hop || 0));

    /* contact shadow tracks the hop height */
    var shadowFade = U.clamp(1 - (-(d.hop || 0)) / 40, 0.25, 1);
    U.shadow(ctx, 0, 0, 42 * s * shadowFade, 8 * s * shadowFade, 0.2 * shadowFade);

    ctx.scale(d.facing * s, s);
    if (d.roll) ctx.transform(1, 0, 0, Math.cos(d.roll), 0, 0);
    ctx.rotate((d.tilt || 0) * d.facing);

    var region = bodyPath(p, build);
    var breath = Math.sin(t * (d.panting ? 7 : 2.2)) * (d.panting ? 1.4 : 0.7);

    /* --- legs: drawn under the torso so shoulders and thighs read as one mass --- */
    var legs = computeLegs(d, p, t, gaitAmp);
    var thick = 7.0 * build.legThick;
    ctx.save();
    ctx.translate(-4, 0);
    ctx.globalAlpha = 0.95;
    legPath(ctx, legs.rearFar, coat.base, thick, coat.baseShade);
    legPath(ctx, legs.frontFar, coat.base, thick, coat.baseShade);
    paw(ctx, legs.rearFar.px, legs.rearFar.py, thick * 0.72, coat.darkShade, false);
    paw(ctx, legs.frontFar.px, legs.frontFar.py, thick * 0.72, coat.darkShade, false);
    ctx.restore();

    ctx.save();
    ctx.translate(3, 0);
    legPath(ctx, legs.rearNear, coat.base, thick, coat.base);
    legPath(ctx, legs.frontNear, coat.base, thick, coat.base);
    drawLegTicks(ctx, spec, legs.rearNear);
    drawLegTicks(ctx, spec, legs.frontNear);
    paw(ctx, legs.rearNear.px, legs.rearNear.py, thick * 0.78, coat.paw, true);
    paw(ctx, legs.frontNear.px, legs.frontNear.py, thick * 0.78, coat.paw, true);
    ctx.restore();

    /* --- tail --- */
    drawTail(ctx, spec, p, d, t);

    /* --- torso --- */
    ctx.save();
    ctx.translate(0, breath * 0.4);
    paintCoat(ctx, spec, region, d.rec.seed);
    paintPatches(ctx, spec, region, d.rec.seed);
    paintSpeckles(ctx, spec, region);
    paintDirt(ctx, spec, region, 1 - (d.rec.needs ? d.rec.needs.clean : 1), d.rec.seed);
    paintShading(ctx, region);
    ctx.restore();

    /* --- neck --- */
    var nb = { x: p.shX + 6, y: p.shY - 2 };
    var neckW = 11 * build.neck;
    tapered(ctx, nb.x, nb.y + 6, p.hdX - 12, p.hdY + 12, neckW, neckW * 0.85, coat.headDark ? coat.dark : coat.base);
    if (coat.chestWhite && coat.headDark) {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = coat.base;
      ctx.beginPath();
      ctx.ellipse(nb.x + 3, nb.y + 20, 7, 9, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    drawHead(ctx, spec, p, t, { blink: d.blink, earFlap: d.earFlap });
    drawAccessory(ctx, spec, p, d.rec.accessory);

    ctx.restore();
  }

  function mixDark(c) { return c; }
  function shadeOf(coat, d, leg, far) { return far ? coat.baseShade : coat.base; }

  function drawLegTicks(ctx, spec, leg) {
    if (!spec.legTicks.length) return;
    ctx.save();
    ctx.fillStyle = spec.coat.speckleColor;
    for (var i = 0; i < spec.legTicks.length; i++) {
      var tk = spec.legTicks[i];
      var x = U.lerp(leg.jx, leg.px, tk.t) + tk.off * 0.5;
      var y = U.lerp(leg.jy, leg.py, tk.t);
      ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.ellipse(x, y, tk.r, tk.r * 0.85, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function computeLegs(d, p, t, gaitAmp) {
    var b = d.spec.build;
    var stride = 26 * (d.gaitSpeed || 1);
    var lift = 13 * (d.gaitSpeed || 1);
    var duty = d.running ? 0.42 : 0.62;
    var ph = d.gaitPhase || 0;
    var offs = d.running
      ? [0, 0.5, 0.5, 0]           /* trot: FL+RR, FR+RL */
      : [0, 0.5, 0.25, 0.75];      /* four-beat walk */

    function leg(rootX, rootY, pawX, pawY, phase, isFront) {
      var o = gaitAmp > 0.02 ? gaitOffset(phase, stride, lift, duty) : { x: 0, y: 0 };
      var tx = pawX + o.x * gaitAmp, ty = pawY + o.y * gaitAmp;
      return legJoints(rootX, rootY, tx, ty, isFront);
    }

    return {
      frontNear: leg(p.shX, p.shY + 4, p.fpX, p.fpY, ph + offs[0], true),
      frontFar:  leg(p.shX - 3, p.shY + 14, p.fpX - 5, p.fpY, ph + offs[1], true),
      rearNear:  leg(p.hipX, p.hipY + 4, p.rpX, p.rpY, ph + offs[2], false),
      rearFar:   leg(p.hipX - 3, p.hipY + 14, p.rpX - 5, p.rpY, ph + offs[3], false)
    };
  }

  function drawTail(ctx, spec, p, d, t) {
    var coat = spec.coat, b = spec.build;
    var base = { x: p.hipX - 14, y: p.hipY + 2 };
    var len = 46 * b.tailLen;
    var wag = (d.wag || 0) * Math.sin(t * (7 + (d.wag || 0) * 7));
    var up = p.tailUp || 0;

    /* base angle: pointing back and slightly down when relaxed, up when excited */
    var ang = Math.PI - 0.5 + up * 1.05 + wag * 0.30 - p.tailBase * 0.12;
    var pts = [{ x: base.x, y: base.y }];
    var x = base.x, y = base.y;
    for (var i = 0; i < 4; i++) {
      var seg = len / 4;
      ang += -0.14 + up * 0.42 + wag * 0.10;
      x += Math.cos(ang) * seg;
      y = Math.min(y + Math.sin(ang) * seg, -2);
      pts.push({ x: x, y: y });
    }
    var w = 4.2 / b.tailThin;
    for (var j = 0; j < pts.length - 1; j++) {
      var w1 = w * (1 - j * 0.19), w2 = w * (1 - (j + 1) * 0.19);
      var tip = coat.tailTipWhite && j >= pts.length - 2;
      tapered(ctx, pts[j].x, pts[j].y, pts[j + 1].x, pts[j + 1].y, w1, w2, tip ? coat.base : coat.dark);
    }
  }

  /* ---------------------------------------------------- portrait (top screen) */
  function drawPortrait(ctx, dogRec, spec, x, y, size, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 58, size / 58);
    ctx.translate(-10, 2);
    var p = blankPose();
    p.hdX = 0; p.hdY = 0; p.hdRot = -0.05; p.ear = 0; p.mouth = 0.25; p.lid = 0;
    drawHead(ctx, spec, p, t || 0, { blink: 0 });
    ctx.restore();
  }

  global.FD = global.FD || {};
  global.FD.Render = {
    POSE: POSE,
    POSE_KEYS: POSE_KEYS,
    blankPose: blankPose,
    drawDog: drawDog,
    drawPortrait: drawPortrait,
    tapered: tapered
  };
})(window);
