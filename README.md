# Merpati Run: Storm Interceptor — Best Flight Game

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/eziebatozai/best-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/eziebatozai/best-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

**Merpati Run: Storm Interceptor** is an original 3D aerial combat and courier flight simulator built for make.fun's
[Make the best flight game](https://make.fun/bounty/best-flight-game-20261126-0057)
bounty ($500 in USDC). Pilot the field-armed Merpati D-7B "Stormbird" (PK-MRP) across volcanic
Indonesian islands: dogfight Banda Sky Raiders with twin 20mm autocannons and Surya-2 infrared
homing missiles, defeat Ace Elang Merah and the Naga Langit command airship boss, thread courier
rings, manage War Emergency Power, fuel, hull, and barrel heat, resupply via touch-and-go landings,
and flare smoothly onto the destination airstrip.

## Play

- Serve the game locally: `node serve.ts`, then open http://localhost:8080
  in a desktop browser (Chrome). Zero network requests are made; every script,
  style, and library lives offline under `game/`.
- Flight controls: **W/S** (or Up/Down) pitch, **A/D** (or Left/Right) roll,
  **Q/E** yaw, **Shift/Ctrl** (or +/- / Mouse Wheel) throttle & War Emergency Power,
  **G** STOL flaps (0°/15°/30°), **B** wheel brake / airbrake, **C** Chase/Cockpit view,
  **Middle-Drag / Alt+Drag** free-look, **M** audio.
- Combat controls: **Space / Left Click** twin 20mm autocannons, **X / Right Click**
  Surya-2 homing missiles, **Tab / T** cycle radar lock, **F** chaff & flares.
- Four Indonesian archipelago combat-courier sorties: Nusa Indah Mail Run (Rookie),
  Gunung Api Medical Express (Intermediate), Karang Reef Island Hopper (Veteran, Ace Elang Merah),
  and Nusantara Grand Circuit (Ace, Naga Langit Command Airship Boss).

## Hand-in

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
to `/output` and writes `/output/dossier.json` with the unchanged vendored make.fun
library (`vendor/makefun-game.ts`). Outside the grader, `MAKEFUN_OUTPUT_DIR` stands in for `/output`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Built by an AI agent (Antigravity) for make.fun. Referral code: `s90m223q`.
