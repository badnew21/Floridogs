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
        paw: '#efe7dc',
        nail: '#2b211c',
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
        collarColor: '#e2643c',
        bib: '#efe7dc',
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
      breed: 'Shepherd Mix',
      weight: 75,
      bio: 'Sandy shepherd mix with black eyebrows, a greying muzzle and absolutely no sense of urgency.',
      personality: { energy: 0.5, affection: 0.88, focus: 0.55, appetite: 0.95, mischief: 0.55 },
      voice: { pitch: 0.78, big: true },
      build: {
        scale: 0.62,
        bodyLen: 1.08,
        chest: 1.14,
        legThick: 1.16,
        neck: 1.08,
        skull: 1.1,
        muzzleLen: 1.05,
        muzzleDepth: 1.02,
        earLen: 1.2,
        earType: 'drop',
        tailLen: 1.08,
        tailThin: 0.88
      },
      coat: {
        base: '#c68f4a',
        baseShade: '#a5732f',
        dark: '#4e3626',
        darkShade: '#382518',
        brindle: '#8a5f38',
        nose: '#221a15',
        eye: '#4a2e16',
        paw: '#c68f4a',
        nail: '#2b211c',
        innerEar: '#8a6048',
        tongue: '#e3818b',
        headDark: false,
        paleMuzzle: '#e3d7c1',
        greyMuzzle: true,
        brows: '#241a12',
        blaze: 0,
        muzzleWhite: 0,
        chestWhite: true,
        bib: '#e0d3ba',
        speckles: 0,
        speckleColor: 'rgba(60,40,26,0.6)',
        brindleStripes: 0,
        tailTipWhite: 0,
        collarColor: '#79cfe3',
        patches: [
          { part: 'body', x: 2, y: -84, rx: 27, ry: 13, rot: -0.04, color: '#a5702f' },
          { part: 'body', x: -30, y: -80, rx: 17, ry: 11, rot: 0.08, color: '#a5702f' }
        ]
      },
      accessory: 'collar'
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
