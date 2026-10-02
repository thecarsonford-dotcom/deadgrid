# 20 One-Shot HTML5 Game Prompts for Local Coding LLMs

A set of copy-paste prompts for testing coding LLMs with complete, playable browser games.

Every challenge follows the same basic constraint: **build the whole game in one index.html file, use no external assets or libraries, make it playable offline, and prioritize polish/game feel instead of explanations.**

These work well for comparing local models and coding harnesses because the model has to handle gameplay state, input, rendering, collision, AI, progression, UI, persistence, and visual polish in one shot.

## Suggested test rules

- Give the model one prompt with no follow-up guidance.
- Require the final playable index.html directly.
- Do not allow external libraries, CDNs, APIs, images, fonts, or network requests.
- Run the output as-is before fixing anything.
- Judge: correctness, fun, visual polish, controls, progression, bugs, and whether all requested systems actually work.

---

## 1. ASTEROID GARDEN

~~~text
Build a complete single-file HTML5 canvas game in index.html called ASTEROID GARDEN. Requirements: a ship the player steers with the arrow keys or WASD; Space fires; drifting asteroids that split into smaller pieces when hit; a score shown on screen; three lives; the game ends when the lives are gone and R restarts it; the best score is kept in localStorage. Everything in one index.html, no external files or network. Make it look polished.
~~~

## 2. NEON DRIFT

~~~text
Build a complete single-file HTML5 canvas game in index.html called NEON DRIFT. Requirements: top-down arcade racing; arrow keys or WASD steer and accelerate; drifting with visible tire trails; winding neon track; AI opponents; checkpoints and lap counter; boost pads; collisions; three-lap race; best lap time stored in localStorage; R restarts. Everything in one index.html, no external files or network. Make it fast, colorful, polished, and satisfying.
~~~

## 3. DEAD SIGNAL

~~~text
Build a complete single-file HTML5 canvas game in index.html called DEAD SIGNAL. Requirements: top-down survival horror shooter; WASD movement; mouse aims; click fires; flashlight follows cursor; enemies emerge from darkness; limited ammunition; ammo pickups; health system; escalating waves; score and wave counter; game over when health reaches zero; R restarts; best score in localStorage. Everything in one index.html, no external files or network. Make it atmospheric, tense, polished, and creepy.
~~~

## 4. TINY TANK WAR

~~~text
Build a complete single-file HTML5 canvas game in index.html called TINY TANK WAR. Requirements: player controls a tank with WASD; mouse aims turret; click fires shells; destructible walls; enemy tanks with basic AI; explosions and screen shake; health bars; increasingly difficult levels; score; three lives; R restarts; best score stored in localStorage. Everything in one index.html, no external files or network. Make it polished and arcade-like.
~~~

## 5. VOID MINER

~~~text
Build a complete single-file HTML5 canvas game in index.html called VOID MINER. Requirements: pilot a mining ship with WASD; mouse aims mining laser; destroy asteroids to collect minerals; minerals can be spent between waves on hull, weapon, engine, and cargo upgrades; hostile drones attack periodically; score and resource counters; endless progression; game over on ship destruction; best score in localStorage. Everything in one index.html, no external files or network. Make it polished, addictive, and visually impressive.
~~~

## 6. CASTLE LAST STAND

~~~text
Build a complete single-file HTML5 canvas game in index.html called CASTLE LAST STAND. Requirements: defend a castle from waves of enemies; mouse places towers; towers automatically attack; several tower types with different range, fire rate, and damage; enemies follow a visible path; earn coins from kills; tower upgrades; castle health; wave counter; difficulty increases continuously; game over when castle health reaches zero; best wave saved in localStorage. Everything in one index.html, no external files or network. Make it polished and strategically satisfying.
~~~

## 7. ROOFTOP RUNNER

~~~text
Build a complete single-file HTML5 canvas game in index.html called ROOFTOP RUNNER. Requirements: endless side-scrolling parkour game; A/D or arrow keys move; Space jumps; wall jumps; slide under obstacles with S; procedurally generated rooftops; gaps, vents, drones, and collapsing platforms; speed gradually increases; distance score; coins; three lives; best distance stored in localStorage; R restarts. Everything in one index.html, no external files or network. Make movement fluid and visuals polished.
~~~

## 8. DUNGEON ZERO

~~~text
Build a complete single-file HTML5 canvas game in index.html called DUNGEON ZERO. Requirements: top-down roguelike dungeon crawler; WASD movement; mouse aims; click attacks; procedurally generated rooms connected by doors; enemies, treasure, health pickups, traps, and bosses; random weapon upgrades; health and XP system; leveling gives randomized upgrade choices; death restarts the run; best floor saved in localStorage. Everything in one index.html, no external files or network. Make it polished, replayable, and satisfying.
~~~

## 9. SKY ACE

~~~text
Build a complete single-file HTML5 canvas game in index.html called SKY ACE. Requirements: arcade aerial combat viewed from above; WASD flies the fighter; mouse aims; click fires machine guns; Space launches limited missiles; enemy fighters dogfight the player; ground anti-air guns; explosions, smoke trails, screen shake, and clouds; score multiplier for consecutive kills; three lives; increasingly difficult waves; best score saved in localStorage. Everything in one index.html, no external files or network. Make it fast and polished.
~~~

## 10. SUBMERGED

~~~text
Build a complete single-file HTML5 canvas game in index.html called SUBMERGED. Requirements: control a submarine with WASD; mouse aims; click fires torpedoes; explore a dark underwater environment with sonar pulses; hostile submarines and sea creatures; oxygen, hull health, and torpedo counters; collectible salvage; depth hazards; progressively harder regions; score; game over when hull reaches zero; best score stored in localStorage. Everything in one index.html, no external files or network. Make the underwater atmosphere beautiful and eerie.
~~~

## 11. CYBER SURVIVOR

~~~text
Build a complete single-file HTML5 canvas game in index.html called CYBER SURVIVOR. Requirements: Vampire-Survivors-style arena game; WASD movement; weapons fire automatically; enemies continuously surround the player; collect XP gems; level up and choose one of three randomized weapon or stat upgrades; multiple weapon types; bosses every few minutes; health bar; timer; kill counter; game over on death; best survival time stored in localStorage. Everything in one index.html, no external files or network. Make it extremely satisfying and polished.
~~~

## 12. GRAVITY LAB

~~~text
Build a complete single-file HTML5 canvas game in index.html called GRAVITY LAB. Requirements: physics puzzle platformer; A/D moves; Space jumps; clicking places a temporary gravity well that pulls objects and the player; levels contain platforms, movable crates, hazards, switches, and exits; progressively harder puzzles; limited gravity energy that recharges; level timer; deaths reset current level; best times saved in localStorage. Everything in one index.html, no external files or network. Make the physics feel smooth and the presentation polished.
~~~

## 13. OUTBREAK

~~~text
Build a complete polished single-file HTML5 canvas game in index.html called OUTBREAK. Make it feel like a compact blend of COD Zombies, Vampire Survivors, and an arcade roguelite.

Requirements: top-down arena survival; WASD movement; mouse aims; left-click shoots; Space performs a short dodge roll with cooldown. Start with a weak pistol. Add shotgun, SMG, assault rifle, revolver, and explosive weapon pickups, each with clearly different damage, spread, fire rate, reload speed, magazine size, recoil, and feel.

Zombies spawn in escalating numbered rounds and become faster, tougher, and more numerous. Include several enemy types: standard zombie, fast crawler, tank zombie, explosive zombie, and a dangerous boss every 5 rounds. Enemies should path toward the player and avoid getting permanently stuck on obstacles.

Create a compact abandoned facility or ruined-city arena with walls, barricades, debris, choke points, explosive barrels, and multiple interconnected areas. Barricades can be repaired between rounds and damaged by zombies.

Kills award money and XP. Between rounds, briefly pause combat and open a shop where the player can buy weapon upgrades, ammo, healing, maximum health, movement speed, reload speed, damage, fire rate, critical-hit chance, and barricade repairs. Every few rounds also present 3 randomized roguelite perks and let the player choose one. Include perks such as piercing bullets, lifesteal, explosive kills, faster dodge recharge, multishot, increased critical damage, and health regeneration.

Add satisfying combat feedback: muzzle flashes, bullet tracers, shell casings, hit flashes, damage numbers, stylized impact particles, explosions, enemy knockback, recoil, screen shake, weapon sounds synthesized with Web Audio, reload feedback, and brief dramatic effects for boss kills. Keep effects readable and performant.

HUD must show health, current weapon, ammo/magazine, money, XP, round number, kills, dodge cooldown, and current perks. Add a prominent round-start announcement and short countdown between rounds.

Include combo scoring: consecutive kills build a multiplier that decays if the player stops killing enemies. Award bonus money for high combos, critical hits, and clearing rounds without taking damage.

Add difficulty scaling that keeps the first few rounds accessible but makes later rounds chaotic. Spawn enemies intelligently around the edges of the arena instead of directly on top of the player.

Game over when health reaches zero. Show final round, kills, score, money earned, and best round. R restarts immediately. Save best score and best round with localStorage.

Include a title screen with PLAY, simple controls, and a short atmospheric subtitle. Add pause with Escape.

Everything must exist inside one index.html with inline CSS and JavaScript. No libraries, external assets, images, fonts, files, APIs, or network requests. Draw all graphics procedurally using Canvas and CSS.

Prioritize game feel, responsiveness, enemy variety, progression, replayability, visual polish, and satisfying combat over unnecessary complexity. Deliver the finished playable index.html directly, not an explanation or pseudocode.
~~~

## 14. SHADOW HEIST

~~~text
Build a complete single-file HTML5 canvas game in index.html called SHADOW HEIST. Requirements: top-down stealth game; WASD movement; guards patrol with visible vision cones; stay out of sight, hide behind walls, disable cameras, steal valuables, and reach the exit; guards investigate noise; Space creates a distraction; multiple increasingly difficult procedurally arranged missions; detection meter; score based on loot and stealth; best score stored in localStorage. Everything in one index.html, no external files or network. Make it tense and polished.
~~~

## 15. PIXEL FISHER

~~~text
Build a complete single-file HTML5 canvas game in index.html called PIXEL FISHER. Requirements: relaxing fishing game; move boat with A/D; click to cast; timing-based fishing mechanic; many fish species with different rarity and behavior; fish have size and value; sell catches to upgrade rod, line, lure, and boat; day/night cycle; rare legendary fish; collection log; total earnings and biggest catch stored in localStorage. Everything in one index.html, no external files or network. Make it charming, polished, and addictive.
~~~

## 16. MECH ARENA

~~~text
Build a complete single-file HTML5 canvas game in index.html called MECH ARENA. Requirements: top-down arena shooter; WASD moves mech; mouse aims; click fires primary cannon; Space uses special weapon; enemy mechs spawn in escalating waves; destructible cover; pickups; heat system prevents endless firing; between waves choose randomized upgrades to armor, weapons, speed, cooling, or special abilities; boss mechs; score and wave counter; best score saved in localStorage. Everything in one index.html, no external files or network. Make combat feel heavy and explosive.
~~~

## 17. TRAIN TO NOWHERE

~~~text
Build a complete single-file HTML5 canvas game in index.html called TRAIN TO NOWHERE. Requirements: defend a moving armored train from attackers; player walks across train cars with WASD; mouse aims and click shoots; enemies approach on motorcycles, cars, drones, and on foot; repair damaged train sections; collect ammunition; upgrade weapons between waves; train constantly moves through scrolling scenery; health, distance, kills, and ammo displayed; game ends if locomotive is destroyed; best distance stored in localStorage. Everything in one index.html, no external files or network. Make it cinematic and polished.
~~~

## 18. STAR COLONY

~~~text
Build a complete single-file HTML5 canvas game in index.html called STAR COLONY. Requirements: compact colony management game on an alien planet; mouse places buildings; gather energy, minerals, food, and population; buildings include generators, mines, farms, habitats, turrets, and research labs; expanding the colony reveals more terrain; hostile creatures attack at night; day/night cycle; technology upgrades; colony population score; game over if headquarters is destroyed; best colony score saved in localStorage. Everything in one index.html, no external files or network. Make the interface polished and easy to understand.
~~~

## 19. BOUNTY HUNTER

~~~text
Build a complete single-file HTML5 canvas game in index.html called BOUNTY HUNTER. Requirements: Wild-West top-down shooter; WASD movement; mouse aims; click shoots revolver; Space performs a dodge roll; towns, rocks, barrels, and cover; enemy bandits use ranged attacks and basic cover behavior; wanted targets act as minibosses; collect bounty money; purchase weapon, health, reload, and speed upgrades between missions; score and money displayed; best bounty total stored in localStorage. Everything in one index.html, no external files or network. Make it stylish, responsive, and polished.
~~~

## 20. DEEP CORE

~~~text
Build a complete single-file HTML5 canvas game in index.html called DEEP CORE. Requirements: endless downward mining game; A/D moves; Space jumps or uses jetpack; drill automatically destroys blocks below; terrain is procedurally generated with dirt, stone, ores, caves, lava, crystals, and ancient artifacts; limited fuel and health; collect resources and periodically reach underground stations to buy upgrades; depth meter and inventory; hazards increase with depth; best depth stored in localStorage. Everything in one index.html, no external files or network. Make digging satisfying with particles and screen effects.
~~~

## Bonus: NIGHT SHIFT

~~~text
Build a complete single-file HTML5 canvas game in index.html called NIGHT SHIFT. Requirements: horror security game set in an isolated facility; player views several rooms and security cameras; mouse controls interface; doors, lights, cameras, and scanners consume limited power; hostile creatures move through the facility according to different behaviors; audio and visual warnings hint at danger; survive from midnight until 6 AM; difficulty rises each night; jumpscares should be stylized rather than graphic; completed nights saved in localStorage. Everything in one index.html, no external files or network. Make it tense, atmospheric, polished, and genuinely scary.
~~~

---

## Good benchmark candidates

If you want prompts that stress more than basic rendering and movement:

- **OUTBREAK** — weapon handling, enemy AI, progression, shops, perks, waves, UI, persistence, and game feel.
- **DUNGEON ZERO** — procedural generation, room state, combat, progression, randomized upgrades, and bosses.
- **TRAIN TO NOWHERE** — moving-world presentation, multiple enemy types, defense systems, repair mechanics, and progression.
- **CYBER SURVIVOR** — enemy density, upgrade choices, autonomous weapons, scaling, boss encounters, and performance.
- **VOID MINER** — resource loops, upgrades, combat, movement, progression, and persistent scoring.

## Why single-file?

Single-file game tasks are useful because the result is easy to inspect and run. Save the model output as index.html and open it in a browser. There is no build system, dependency installation, asset pipeline, or backend to hide behind.

That makes it easier to compare the actual coding ability of different models and harnesses.

---

Feel free to use, modify, benchmark, or remix these prompts.
