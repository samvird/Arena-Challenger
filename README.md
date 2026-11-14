# Arena Challenger (Bounce Back)

A fast-paced 3D wave-survival arena brawler built with Three.js and vanilla ES modules—where **getting knocked out doesn't end your run, it makes you stronger.**

## Core Mechanic: Bounce Back
When your HP hits `0`, you **Bounce Back** instead of getting a Game Over:
- You revive on the spot with a shockwave that blasts nearby enemies away (`25` damage + heavy knockback).
- A **Past-Life Echo** AI ally spawns to fight alongside you (up to `8` active allies; beyond 8, Echoes gain `1.2x` damage).
- You draft **1 of 3 randomized Perks** (`Overcharge Edge`, `Kinetic Surge`, `Titan Frame`, `Echo Overdrive`, `Vampiric Strikes`, or `Seismic Sky-Slam`).

## Controls
- **Move**: `W A S D` or Arrow Keys
- **Camera**: Mouse (Pointer Lock)
- **Jump / Double Jump**: `Space`
- **Attack**: `Left Click` or `J`
- **Dash**: `Shift`
- **Aerial Ground Slam**: `E` or `Right Click` (while airborne)
- **Pause / Armory / Saves**: `Esc` or `P`

## Weapons
Unlock and swap between 4 custom weapons from the Lobby Blade Rack or Pause Menu Armory:
1. **Kirkland Bottle** — Balanced starter weapon
2. **Pizza Crust** — Fast swings & extra movement speed *(Unlock: Wave 2 or 1,000 Score)*
3. **Cherry Coke Can** — Heavy damage & knockback *(Unlock: 2 Bounce Backs)*
4. **Freedom Flagstaff** — Strongest final relic *(Unlock: 5 Bounce Backs or Wave 6)*

## Arena & Enemies
- **12 Perimeter Bumpers**: Knocking enemies into the outer bumpers bounces them inward and deals `18` bonus damage.
- **4 Quadrant Launch Pads**: Step on a pad to launch high into the air for a Seismic Ground Slam.
- **Wave Enemies**: Swarmers, Chargers (Wave 2+), Brutes (Wave 3+), Wave Bosses (every 3rd wave), and a **5% chance Rare Boss** on any wave.

## Running Locally
Because the project uses native ES modules and `importmap` (no build step required), serve it with any static HTTP server:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080` in your browser.
