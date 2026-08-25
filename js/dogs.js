/* Floridogs — the dogs themselves.
   Cherry is modelled from photographs: a ~60 lb Catahoula / bulldog mix, white coat
   under heavy dark brindle patching, a fully dark head with a white blaze, dark drop
   ears, amber eyes, black ticking down the legs — and her pink pearl necklace.
   Scooby's build is a placeholder until reference photos arrive (see README). */
(function (global) {
  'use strict';

  var BREEDS = {
    cherry: {
      id: 'cherry',
      name: 'Cherry',
      breed: 'Catahoula Mix',
      weight: 60,
      bio: 'Brindle and freckles, a whip tail that never stops, and a strong opinion about pearls.',
      personality: { energy: 0.85, affection: 0.95, focus: 0.7, appetite: 0.6, mischief: 0.5 },
      voice: { pitch: 1.0, big: true },
      build: {
        scale: 0.54,          /* withers height in screen pixels = 100 * scale */
        bodyLen: 1.0,
        chest: 1.0,
        legThick: 1.0,
        neck: 1.0,
        skull: 1.0,
        muzzleLen: 0.9,
        muzzleDepth: 1.05,
        earLen: 1.0,
        earType: 'drop',
        tailLen: 1.0,
        tailThin: 1.0
      },
      coat: {
        base: '#efe7dc',
        baseShade: '#d8ccbc',
        dark: '#3a2d26',
        darkShade: '#241b16',
        brindle: '#6a5140',
        nose: '#231b18',
        eye: '#8a5a2a',
        paw: '#3a2d26',
        innerEar: '#7a5c50',
        tongue: '#e3818b',
        headDark: true,
        blaze: 0.42,
        muzzleWhite: 0.55,
        chestWhite: true,
        speckles: 46,
        speckleColor: 'rgba(48,36,30,0.85)',
        brindleStripes: 9,
        tailTipWhite: 0.3,
        patches: [
          { part: 'body', x: 6, y: -82, rx: 26, ry: 14, rot: -0.06 },
          { part: 'body', x: -30, y: -76, rx: 20, ry: 16, rot: 0.12 },
          { part: 'body', x: -6, y: -90, rx: 13, ry: 7, rot: 0 },
          { part: 'body', x: 26, y: -74, rx: 13, ry: 12, rot: 0 },
          { part: 'body', x: -46, y: -64, rx: 9, ry: 9, rot: 0 },
          { part: 'body', x: -16, y: -68, rx: 9, ry: 8, rot: 0 }
        ]
      },
      accessory: 'pearls'
    },

    scooby: {
      id: 'scooby',
      name: 'Scooby',
      breed: 'Hound Mix',
      weight: 75,
      bio: 'Taller, goofier, and convinced every cupboard contains a snack.',
      personality: { energy: 0.6, affection: 0.8, focus: 0.5, appetite: 0.95, mischief: 0.8 },
      voice: { pitch: 0.82, big: true },
      build: {
        scale: 0.59,
        bodyLen: 1.06,
        chest: 1.08,
        legThick: 1.1,
        neck: 1.05,
        skull: 1.05,
        muzzleLen: 1.15,
        muzzleDepth: 0.95,
        earLen: 1.12,
        earType: 'drop',
        tailLen: 1.1,
        tailThin: 1.15
      },
      coat: {
        base: '#c98f4e',
        baseShade: '#a9713a',
        dark: '#5a3a22',
        darkShade: '#3c2515',
        brindle: '#8a5a33',
        nose: '#2a1f1a',
        eye: '#6d4423',
        paw: '#4a3020',
        innerEar: '#8a6048',
        tongue: '#e3818b',
        headDark: false,
        mask: true,
        blaze: 0.3,
        muzzleWhite: 0,
        chestWhite: true,
        speckles: 0,
        speckleColor: 'rgba(60,40,26,0.6)',
        brindleStripes: 0,
        tailTipWhite: 0.22,
        patches: [
          { part: 'body', x: 4, y: -86, rx: 24, ry: 11, rot: -0.05, color: 'dark' },
          { part: 'body', x: -32, y: -82, rx: 15, ry: 9, rot: 0.1, color: 'dark' }
        ]
      },
      accessory: 'bandana'
    }
  };

  /* Freckles/ticking are generated once per dog from a stable seed so they never move. */
  function makeSpeckles(spec, seed) {
    var rnd = global.FD.U.seeded(seed);
    var out = [];
    for (var i = 0; i < spec; i++) {
      out.push({
        x: -56 + rnd() * 104,
        y: -94 + rnd() * 46,
        r: 0.9 + rnd() * 2.4,
        a: 0.35 + rnd() * 0.5
      });
    }
    return out;
  }

  function makeLegTicks(count, seed) {
    var rnd = global.FD.U.seeded(seed);
    var out = [];
    for (var i = 0; i < count; i++) out.push({ t: rnd(), off: (rnd() - 0.5) * 5, r: 0.7 + rnd() * 1.3 });
    return out;
  }

  var Dogs = {
    breeds: BREEDS,

    /* Build the persistent record for a dog the player owns. */
    create: function (breedId, name) {
      var b = BREEDS[breedId];
      var seed = global.FD.U.hash(breedId + '|' + (name || b.name));
      return {
        breed: breedId,
        name: name || b.name,
        born: Date.now(),
        seed: seed,
        needs: { hunger: 0.8, thirst: 0.8, mood: 0.75, clean: 0.9, energy: 0.85 },
        bond: 0.15,
        hearts: 1,
        tricks: { sit: 0, down: 0, shake: 0, rollover: 0, speak: 0, jump: 0 },
        trickNames: {},
        stats: { walks: 0, contests: 0, discBest: 0, pets: 0, meals: 0, days: 0 },
        accessory: b.accessory,
        lastSeen: Date.now()
      };
    },

    spec: function (rec) {
      var b = BREEDS[rec.breed];
      return {
        breed: b,
        build: b.build,
        coat: b.coat,
        personality: b.personality,
        voice: b.voice,
        speckles: makeSpeckles(b.coat.speckles, rec.seed),
        legTicks: makeLegTicks(b.coat.speckles ? 14 : 0, rec.seed ^ 0x9e37),
        name: rec.name
      };
    }
  };

  global.FD = global.FD || {};
  global.FD.Dogs = Dogs;
})(window);
