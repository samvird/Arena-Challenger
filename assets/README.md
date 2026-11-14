# Custom Hand-Made PNG Visuals

Drop your own transparent `.png` artwork into this `assets/` folder and list the filenames in `assets/manifest.json`—the game will automatically render them as floating 3D sprites instead of the placeholder shapes!

## Supported Filenames

### Characters & Allies
- `player.png` — Your main character sprite
- `echo.png` — Your Past-Life Echo ally sprite

### Enemies
- `swarmer.png` — Fast basic enemy
- `charger.png` — Charging enemy
- `brute.png` — Heavy brute enemy
- `boss.png` — Wave boss

### Swords (held in hand & shown in Lobby)
- `sword_iron_broadsword.png`
- `sword_kinetic_rapier.png`
- `sword_bumper_claymore.png`
- `sword_volt_katana.png`
- `sword_solaris_greatsword.png`

## Example `assets/manifest.json`
```json
{
  "sprites": [
    "player.png",
    "swarmer.png",
    "boss.png",
    "sword_iron_broadsword.png"
  ]
}
```
