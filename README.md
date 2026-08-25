# Floridogs

A Nintendogs-style puppy sim built as a Nintendo DS on your phone: two stacked
screens, a stylus-driven touch screen, and dogs modelled on **Cherry** and
**Scooby**.

Open `index.html` — no build step, no dependencies, no assets. Everything
(dogs, rooms, sounds) is drawn or synthesised at runtime.

## Playing on a phone

The layout is a DS: a read-only top screen and a touch screen underneath, both
at the DS's real 4:3 / 256x192 proportions, scaled to fit. Portrait stacks
them; landscape puts them side by side. Every interaction is a tap, drag,
swipe or press-and-hold on the bottom screen.

Pick a tool from the tray along the bottom, then use it on your dog:

| Tool | What it does |
| --- | --- |
| **Pet** | Rub her to build affection. Also the training hand — see below. |
| **Brush** | Rub back and forth to groom; raises Clean and Mood. |
| **Wash** | Scrub for a bath. Uses a bottle of shampoo. |
| **Food** / **Water** | Fills the bowl. She comes over and eats when hungry. |
| **Treat** | Drag it around. Give it to her, hold it over her nose, or flick it up. |
| **Ball** / **Disc** | Drag out and flick to throw. She chases it down and brings it back. |
| **Menu** | Walk, disc competition, shop, kennel, records, save. |

**Call** whistles her over. **Tricks** opens the command panel.

### Teaching tricks

Tricks are taught the Nintendogs way: shape the behaviour by hand first, then
name it while she's doing it.

| Trick | Gesture (with the Pet hand) |
| --- | --- |
| Sit | Drag downwards on her hindquarters |
| Lie Down | Drag her shoulders down to the floor |
| Shake | Tap a front paw while she's sitting |
| Roll Over | Draw a circle on her belly while she's lying down |
| Speak | Hold a treat just above her nose |
| Jump | Flick a treat up over her head |

The moment she performs the action a **Name it!** banner appears — tap the word
(or, with the mic on, say it out loud) and the trick's meter fills. Once she
knows a trick, the Tricks panel commands it directly; success depends on how
well she knows it, her mood, energy and how much she likes you.

### Microphone (optional)

The 🎤 button under the screens asks for mic access. With it on, clapping or
calling brings her running, and speaking during the **Name it!** prompt teaches
the trick — the closest thing to the DS mic. It's entirely optional and the
game never records or transmits anything; it only measures loudness.

## Care

Food, Water, Mood, Clean and Energy drain in real time and keep draining while
the game is closed (capped at 14 hours, so a week away won't ruin anything).
She sleeps at night and wakes up rested. Hearts grow through feeding, petting,
play, walks and training. The game autosaves to `localStorage`.

Walks earn coins and presents. The disc competition pays out by score. Coins
buy food, treats, shampoo and accessories in the shop.

## The dogs

**Cherry** is drawn from photographs: a ~60 lb Catahoula/bulldog mix, white
coat under heavy dark brindle patching, a solid dark head with a white blaze
down the muzzle, dark drop ears, amber eyes, black ticking down her legs — and
her pink pearl necklace, which is her default accessory.

**Scooby**'s build is a placeholder: a taller, heavier tan hound with a dark
muzzle mask and a red bandana. Send reference photos and his coat, build, ears
and markings can be matched the way Cherry's were — the whole description lives
in one object in `js/dogs.js`.

## Code layout

```
index.html      DS shell (two screens, sound/mic/START buttons)
css/style.css   Handheld chrome, responsive portrait/landscape layout
js/util.js      Maths, storage, canvas helpers
js/audio.js     Synthesised barks, whistles, chimes; mic level metering
js/dogs.js      Breed/coat/personality definitions for Cherry and Scooby
js/render.js    The dog rig: poses, gait, coat painting, head, accessories
js/scenes.js    Living room, street, park, contest field, props
js/game.js      Needs simulation, behaviour state machine, tricks, save data
js/ui.js        Screens, tool tray, HUD, overlays
js/main.js      Canvas setup, stylus gestures, walk/contest loops, main loop
```

Dogs are drawn in a body-local space where the ground is `y=0`, up is negative,
the dog faces `+x`, and the withers sit at `y=-100`; every build scales from
that, so one rig fits any dog defined in `dogs.js`.
