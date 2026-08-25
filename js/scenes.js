/* Floridogs — rooms, outdoor backdrops and props, all drawn in the DS's
   256x192 logical screen space. */
(function (global) {
  'use strict';
  var U = global.FD.U;

  var S = {};

  /* Day/night tint applied over a scene. `h` is game hours 0..24. */
  S.tint = function (ctx, h, w, hgt) {
    var a = 0, col = '#0a1436';
    if (h < 6) a = 0.42;
    else if (h < 8) a = U.lerp(0.42, 0, (h - 6) / 2);
    else if (h > 21) a = U.clamp((h - 21) / 3, 0, 1) * 0.42;
    else if (h > 18) { a = U.lerp(0, 0.18, (h - 18) / 3); col = '#c4621f'; }
    if (a <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = col;
    ctx.fillRect(0, 0, w, hgt);
    ctx.restore();
  };

  S.livingRoom = function (ctx, t, hour) {
    var W = 256, H = 192, floorY = 74;

    /* wall */
    var wg = ctx.createLinearGradient(0, 0, 0, floorY);
    wg.addColorStop(0, '#f4e3c6');
    wg.addColorStop(1, '#e6d0ac');
    ctx.fillStyle = wg;
    ctx.fillRect(0, 0, W, floorY);

    /* window with a Florida sky */
    ctx.save();
    U.roundRect(ctx, 24, 8, 62, 48, 3);
    ctx.fillStyle = '#8fc9e8';
    ctx.fill();
    ctx.clip();
    var night = hour < 6.5 || hour > 19.5;
    if (night) {
      ctx.fillStyle = '#20325c'; ctx.fillRect(24, 8, 62, 48);
      ctx.fillStyle = '#f3f0d0';
      ctx.beginPath(); ctx.arc(70, 20, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (var i = 0; i < 9; i++) {
        ctx.fillRect(28 + (i * 37) % 56, 12 + (i * 23) % 34, 1, 1);
      }
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.ellipse(44 + Math.sin(t * 0.1) * 6, 22, 13, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(70 + Math.sin(t * 0.07) * 5, 30, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#5da35a';
      ctx.fillRect(24, 44, 62, 12);
      /* palm silhouette, because Floridogs */
      ctx.strokeStyle = '#4a7d3f'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(76, 50); ctx.quadraticCurveTo(74, 38, 78, 30); ctx.stroke();
      ctx.fillStyle = '#4a7d3f';
      for (var f = 0; f < 5; f++) {
        var a2 = -Math.PI * 0.9 + f * 0.42;
        ctx.beginPath();
        ctx.ellipse(78 + Math.cos(a2) * 7, 30 + Math.sin(a2) * 4, 8, 2.4, a2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.strokeStyle = '#c9a978'; ctx.lineWidth = 3;
    U.roundRect(ctx, 24, 8, 62, 48, 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(55, 8); ctx.lineTo(55, 56); ctx.moveTo(24, 32); ctx.lineTo(86, 32); ctx.lineWidth = 2; ctx.stroke();

    /* shelf with a photo and a plant */
    ctx.fillStyle = '#b98b58'; ctx.fillRect(150, 44, 68, 5);
    ctx.fillStyle = '#e9e2d2'; ctx.fillRect(158, 28, 16, 16);
    ctx.strokeStyle = '#9c7a4f'; ctx.lineWidth = 1.5; ctx.strokeRect(158, 28, 16, 16);
    ctx.fillStyle = '#7fae6a';
    ctx.beginPath(); ctx.ellipse(198, 36, 9, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c2764e'; ctx.fillRect(193, 38, 10, 7);

    /* baseboard + floor */
    ctx.fillStyle = '#cbb493'; ctx.fillRect(0, floorY - 6, W, 6);
    var fg = ctx.createLinearGradient(0, floorY, 0, H);
    fg.addColorStop(0, '#c79a63');
    fg.addColorStop(1, '#a97b47');
    ctx.fillStyle = fg;
    ctx.fillRect(0, floorY, W, H - floorY);
    ctx.strokeStyle = 'rgba(90,58,30,0.22)';
    ctx.lineWidth = 1;
    for (var b = 0; b < 9; b++) {
      var y = floorY + Math.pow(b / 8, 1.6) * (H - floorY);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    /* rug */
    ctx.save();
    ctx.fillStyle = '#8fb7c9';
    ctx.beginPath(); ctx.ellipse(128, 152, 92, 30, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#a8cddb';
    ctx.beginPath(); ctx.ellipse(128, 152, 78, 24, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8fb7c9';
    ctx.beginPath(); ctx.ellipse(128, 152, 60, 18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    /* dog bed, back left */
    S.dogBed(ctx, 34, 104);
    /* toy box, back right */
    ctx.fillStyle = '#d8a25a'; U.roundRect(ctx, 208, 86, 40, 26, 4); ctx.fill();
    ctx.fillStyle = '#b9853f'; U.roundRect(ctx, 208, 86, 40, 8, 4); ctx.fill();
  };

  S.dogBed = function (ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#7f6bb0';
    ctx.beginPath(); ctx.ellipse(0, 0, 30, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9b87cc';
    ctx.beginPath(); ctx.ellipse(0, -1, 23, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  S.bowl = function (ctx, x, y, level, kind) {
    ctx.save();
    ctx.translate(x, y);
    U.shadow(ctx, 0, 3, 15, 4, 0.18);
    /* bowl body */
    ctx.fillStyle = kind === 'water' ? '#5f9fd0' : '#d9683f';
    ctx.beginPath();
    ctx.moveTo(-14, -6);
    ctx.quadraticCurveTo(-11, 6, 0, 6);
    ctx.quadraticCurveTo(11, 6, 14, -6);
    ctx.closePath();
    ctx.fill();
    /* contents */
    if (level > 0.02) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, -6, 13.5, 4.4, 0, 0, Math.PI * 2);
      ctx.clip();
      if (kind === 'water') {
        ctx.fillStyle = '#8ed0f0';
        ctx.fillRect(-14, -10 + (1 - level) * 8, 28, 12);
      } else {
        ctx.fillStyle = '#8a5a34';
        ctx.fillRect(-14, -10 + (1 - level) * 8, 28, 12);
        ctx.fillStyle = '#a8703f';
        for (var i = 0; i < 10; i++) {
          ctx.beginPath();
          ctx.arc(-11 + (i * 7) % 23, -8 + (1 - level) * 7 + (i % 3), 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
    /* rim */
    ctx.strokeStyle = kind === 'water' ? '#3f7fae' : '#b64f2c';
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.ellipse(0, -6, 14, 4.6, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  };

  S.ball = function (ctx, x, y, r, spin) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spin || 0);
    var g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#ffe98a');
    g.addColorStop(1, '#e0a52c');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(150,90,20,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.62, -0.6, 2.2); ctx.stroke();
    ctx.restore();
  };

  S.disc = function (ctx, x, y, r, tiltAmt, spin) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((spin || 0) * 0.2);
    ctx.fillStyle = '#e0574f';
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * (0.28 + tiltAmt * 0.5), 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#b23b36'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.62, r * (0.28 + tiltAmt * 0.5) * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  };

  S.bone = function (ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = '#f0e6cf';
    ctx.beginPath();
    ctx.arc(-6, -3, 3.4, 0, Math.PI * 2); ctx.arc(-6, 3, 3.4, 0, Math.PI * 2);
    ctx.arc(6, -3, 3.4, 0, Math.PI * 2); ctx.arc(6, 3, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-6, -2.6, 12, 5.2);
    ctx.restore();
  };

  S.brush = function (ctx, x, y, ang) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang || 0);
    ctx.fillStyle = '#b5763c';
    U.roundRect(ctx, -9, -6, 18, 9, 3); ctx.fill();
    ctx.fillStyle = '#e9d9bd';
    for (var i = -3; i <= 3; i++) ctx.fillRect(i * 2.4 - 0.6, 2, 1.4, 5);
    ctx.fillStyle = '#8a5528';
    U.roundRect(ctx, -3, -13, 6, 8, 2); ctx.fill();
    ctx.restore();
  };

  S.shampoo = function (ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#7fc4e8';
    U.roundRect(ctx, -6, -10, 12, 16, 3); ctx.fill();
    ctx.fillStyle = '#4f9fc8';
    U.roundRect(ctx, -3, -15, 6, 6, 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-2, -4, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  S.leash = function (ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = '#d2523f'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, -3, 6, 0.5, Math.PI * 2.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, 1); ctx.quadraticCurveTo(9, 7, 3, 11); ctx.stroke();
    ctx.restore();
  };

  /* Neighbourhood used by the walk. Scrolls horizontally. */
  S.street = function (ctx, scroll, t, hour) {
    var W = 256, H = 192, horizon = 78;
    var sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#6fc3ea');
    sky.addColorStop(1, '#bfe6f4');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, horizon);

    /* distant houses */
    for (var i = -1; i < 8; i++) {
      var hx = ((i * 78 - scroll * 0.35) % (78 * 8) + 78 * 8) % (78 * 8) - 78;
      var hh = 30 + ((i * 37) % 3) * 8;
      ctx.fillStyle = ['#e8c7a2', '#d9b3d0', '#bcd9c0'][(i % 3 + 3) % 3];
      ctx.fillRect(hx, horizon - hh, 54, hh);
      ctx.fillStyle = '#a9705a';
      ctx.beginPath();
      ctx.moveTo(hx - 4, horizon - hh); ctx.lineTo(hx + 27, horizon - hh - 15); ctx.lineTo(hx + 58, horizon - hh);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7fa8c9';
      ctx.fillRect(hx + 10, horizon - hh + 10, 10, 10);
      ctx.fillRect(hx + 32, horizon - hh + 10, 10, 10);
    }

    /* palms */
    for (var p = 0; p < 5; p++) {
      var px = ((p * 120 - scroll * 0.6) % 600 + 600) % 600 - 60;
      ctx.strokeStyle = '#8a6a3c'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(px, horizon + 6); ctx.quadraticCurveTo(px - 4, horizon - 20, px + 3, horizon - 38); ctx.stroke();
      ctx.fillStyle = '#4f8f4a';
      for (var f = 0; f < 6; f++) {
        var a = -Math.PI * 0.95 + f * 0.36;
        ctx.beginPath();
        ctx.ellipse(px + 3 + Math.cos(a) * 13, horizon - 38 + Math.sin(a) * 7, 15, 4, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    /* grass verge, sidewalk, road */
    ctx.fillStyle = '#79b45f'; ctx.fillRect(0, horizon, W, 22);
    ctx.fillStyle = '#d8d2c4'; ctx.fillRect(0, horizon + 22, W, 46);
    ctx.fillStyle = '#c4bdad';
    for (var s = -1; s < 9; s++) {
      var sx = ((s * 34 - scroll) % 306 + 306) % 306 - 34;
      ctx.fillRect(sx, horizon + 22, 2, 46);
    }
    ctx.fillStyle = '#6f9c58'; ctx.fillRect(0, horizon + 68, W, H - horizon - 68);
    ctx.fillStyle = '#649050';
    for (var g = 0; g < 26; g++) {
      var gx = ((g * 23 - scroll * 1.3) % 300 + 300) % 300 - 22;
      ctx.fillRect(gx, horizon + 72 + (g % 4) * 8, 5, 3);
    }
  };

  /* Disc competition field. */
  S.field = function (ctx, scroll, t) {
    var W = 256, H = 192, horizon = 66;
    var sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#59b8e6');
    sky.addColorStop(1, '#c9ecf7');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, horizon);

    ctx.fillStyle = '#7db06a'; ctx.fillRect(0, horizon, W, H - horizon);
    /* mowed stripes give a sense of distance */
    for (var i = 0; i < 10; i++) {
      var y0 = horizon + Math.pow(i / 10, 1.5) * (H - horizon);
      var y1 = horizon + Math.pow((i + 0.5) / 10, 1.5) * (H - horizon);
      ctx.fillStyle = i % 2 ? '#74a862' : '#83b872';
      ctx.fillRect(0, y0, W, y1 - y0);
    }
    /* crowd fence */
    ctx.fillStyle = '#e4e0d2'; ctx.fillRect(0, horizon - 8, W, 8);
    ctx.fillStyle = '#c2bdab';
    for (var f = 0; f < 26; f++) ctx.fillRect(f * 10 - (scroll * 0.2 % 10), horizon - 8, 2, 8);
    /* distance markers */
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.4;
    [0.35, 0.55, 0.78].forEach(function (f2) {
      var y = horizon + f2 * (H - horizon);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    });
  };

  S.park = function (ctx, t, hour) {
    var W = 256, H = 192, horizon = 70;
    var sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#63bde8');
    sky.addColorStop(1, '#cdeaf6');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, horizon);
    ctx.fillStyle = '#7fb268'; ctx.fillRect(0, horizon, W, H - horizon);
    ctx.fillStyle = '#6ea159';
    ctx.beginPath(); ctx.ellipse(60, horizon + 8, 70, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(210, horizon + 14, 60, 14, 0, 0, Math.PI * 2); ctx.fill();
    /* pond */
    ctx.fillStyle = '#6fb6d8';
    ctx.beginPath(); ctx.ellipse(200, 108, 46, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(200 + Math.sin(t) * 3, 106, 24, 6, 0, 0, Math.PI * 2); ctx.stroke();
  };

  global.FD.Scenes = S;
})(window);
