# Floridogs

A Nintendogs-style puppy sim built as a Nintendo DS on your phone: two stacked
screens, a stylus-driven touch screen, and dogs modelled on **Cherry** and
**Scooby**.

Play it at **https://badnew21.github.io/Floridogs/** — or open `index.html`
directly. No build step, no dependencies, no image or audio files: the dogs,
rooms and sounds are all drawn or synthesised at runtime.

On a phone, use your browser's *Add to Home Screen* to get it as a fullscreen
app with Cherry as the icon.

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

She gets visibly dirty as Clean drops, and shakes herself off the moment a
bath finishes. Presents turn up in the room from time to time — tap to open.
Walks earn coins and finds along the route, and the disc competition pays out
by score; catching depends on energy, grooming and mood, so a well-kept dog
competes better. Coins buy food, treats, shampoo and accessories in the shop.

You can keep both dogs. Adopt the second from **Menu → Kennel**, switch between
them there, and the one you're not playing with pads around, sits and naps in
the background.

## The dogs

**Cherry** is drawn from photographs: a ~60 lb Catahoula/bulldog mix, white
coat under heavy dark brindle patching, a solid dark head with a white blaze
down the muzzle, dark drop ears, amber eyes, black ticking down her legs — and
her pink pearl necklace, which is her default accessory.

Her tongue hangs out the way it does in most photographs of her: always while
she pants, and otherwise on and off as she idles.

**Scooby** is drawn from his photo too: a 100 lb foxhound/ridgeback mix in sandy
tan — long-legged and deep-chested, with a hound's long muzzle and big dark
folded ears, black brow marks over the eyes, a cream muzzle gone grey around the
lips and chin, his light blue collar, and a ridgeback's dorsal ridge up the
spine. He bays rather than barks. Next to Cherry's 60 lb he stands a clear head
taller.

Both dogs are described entirely by data — coat colours, patch shapes, ear
length, muzzle depth, personality weights — in one object each in `js/dogs.js`.

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
