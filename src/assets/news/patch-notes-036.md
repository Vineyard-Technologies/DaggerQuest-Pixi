---
description: "Introduces currency system, merchant functionality, area persistence, and numerous UI and interaction improvements."
version: "0.3.6"
type: "patch-notes"
---

## Updates

- UI components have a fixed ordering, instead of putting the last component moved on top.
- Updated the dialog of **The Guide**, and added a second message.
- Reduced music volume. This is a temporary solution until we add volume sliders in the Settings menu.
- The distance with which an NPC can be interacted with is determined individually for each NPC, instead of being derived off of the player's pickup range.
- Added coins, the currency of **Ashladon**. All items have a coin value, which appears in the mouse-over tooltips.
- Added **The Merchant** to **Windmill Level 2**. You can sell your items to him, and buy back items that you've sold.
- Color coordinated the menus for equipped items, and the inventory of players and merchants.
- Enemies, loot, chests and NPCs no longer reset after leaving the area they are in and returning later.
- The windmill fan sound effect plays while inside on **Windmill Level 1** and **Windmill Level 2**.
- The enemy info mouse-over information fades in and out just like the rest of the interface.
- The Settings menu is only available in-game, and no longer accessible from the main menu.

## Bug Fixes

- UI components would be broken after going to a new area if they had been rearranged.
- Picking up the tutorial loot, then leaving the area and coming back and picking up the tutorial loot again, would break most item functionality.
- Clicking on an enemy while the player couldn't move would result in the player attacking that enemy, if that enemy later came near to the player.
- The sizing of the header text in some locations was incorrect.
- Menus would flicker when appearing or disappearing on low-end systems.
- The necessary distance between the player and an NPC in order to initiate interaction wasn't isometrically correct.
- NPC portraits obscured loot and item tooltips.
- Dragging and dropping an item outside of the window would essentially destroy it.
- Moving the mouse outside the window while dragging an item would cause the player to move toward the mouse location.
- The sound effect for the basic attack and **Heroic Strike** would still play if the player was stunned before the attack did any damage.
- Ranged projectiles shot from the player that were already mid-flight would be destroyed if the player died.
- The player's gear wouldn't become invisible if the player did.
- Projectiles with audio that plays continually (like the buzzing of the **Goblin Warlock**'s lightning orb) wouldn't stop playing immediately after changing areas.
- Various control issues if the player's action speed was changed while they were currently stunned or blocking.
- Key bindings could not be set if the player was stunned or blocking.
- The player would switch to the idle animation after pausing, even when previously walking.
- The player's action speed was affecting the speed of the idle animation.