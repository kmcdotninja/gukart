# GUKART polish checklist

Rule: cards are panels with cut (chamfered) corners; buttons are slanted parallelograms. Keep the existing style and fix only what breaks it. No "01"-style numbering.

## 2. One style everywhere
- [x] Results screen and garage tag: remove the "01"
- [x] Map: the place card gets chamfered corners (it's a card)
- [x] Map: ALL / RACES / LANDMARKS tabs become parallelograms (they're buttons)
- [x] Map: island chips become parallelograms (they're buttons)
- [x] Map: back button uses a filled icon, like the rest of the icon set

## 3. In-race HUD
- [x] Coaching prompts ("← → TO STEER") move off the player's kart

## 4. World
- [x] Sand shoulders: tyre tracks, stones and dry grass instead of flat sand
- [x] Houses: weathering (damp, grimy foot, sun-bleached top, rain streaks) instead of clean flat plaster
- [x] Map: remove the straight seam line in the sea

## Requests along the way
- [x] Map: fewer labels (landmarks become small markers, name on tap)
- [x] Map: no numbers on the island chips
- [x] Garage: remove the vehicle info card ("Wins: 0") from customising
- [x] Garage: CUSTOMISE built like RACE (white, same slant, same faded stripes)
- [x] Every vehicle gets a real, visible seat (muscle car first)
- [x] Phone garage: shrink the monster truck so it isn't cut off
- [x] Arrows: our own designed arrow icons everywhere, no text arrows (rule)
- [x] Tidy style.css: fold the override layers into one clean file, with no visible change
- [x] Loader: a poster-style splash (Buddy drifting the monster through Kano), a chunkier logo, everything preloaded before the game opens
- [x] Haptics: vibration on bumps, hits, boosts and button presses (where the phone supports it)
- [x] Controls: its own screen (from pause, with a back button), not an accordion; keys drawn as our own key caps in the game's font with our arrow icons
- [x] Loader logo as SVG shapes, so it never flashes a fallback font
- [x] Several loader posters to choose from
- [x] Logo: your uppercase Figma logo, orange swoosh, dark-blue outlines (loader + home)
- [x] Weapon pod redesigned (was a curved sheet: a shared-geometry bug)
- [x] Home: removed the best-time / "finish to unlock" line
- [x] GO! instead of GUDU!
- [x] Start gate: toll-plaza gantry with start lights
- [x] Shield pickup
- [x] Nothing solid on the road: buildings, walls and trees are checked as they're placed and left out (with a console warning) if they'd reach the tarmac; tools/road-check.mjs sweeps a circuit for anything else in the way. Fixed the Amiri Diwan arcade lying across the Msheireb road.
