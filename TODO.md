# DaggerQuest – Architectural TODO

Refactoring opportunities to tackle before scaling up. Ordered roughly by priority.

---

## 1. Break up the `UI` god object (1,286 lines)

`src/ui.ts` handles HUD orbs, equipment panel, inventory grid, ability bar, tooltips, drag-and-drop, icon management, and slot interactions — all in one class.

**Recommendation:** Split into focused classes:
- `OrbHUD` — health / mana orb rendering & masking
- `EquipmentPanel` — equipped-gear menu
- `InventoryPanel` — inventory grid
- `AbilityBar` — ability slots
- `TooltipManager` — tooltip construction / positioning
- `DragDropController` — drag-and-drop logic

Each owns its own layout, input handling, and state.

---

## 2. Introduce an event bus

Components communicate via direct imports and the global `state` singleton. For example `Player.pickupAndEquip()` directly calls `state.ui.setEquippedItem()`, and `Player` has both `unequipSlot` and `unequipSlotSilent` solely to control whether the UI is notified.

**Recommendation:** Add a lightweight typed event emitter / signal pattern:
- Player emits `item-equipped`, UI listens.
- Decouples game logic from presentation.
- Enables future systems (audio, achievements, networking) to plug in without touching existing code.

---

## 3. Data-drive area definitions

`src/farm.ts` is 224 lines of hardcoded positions, enemy stats, and dialog text. Every new area requires a similar hand-coded subclass.

**Recommendation:**
- Define areas as JSON / data files.
- Build a generic `AreaLoader` that reads them.
- Lets you add areas without writing new classes and opens the door to a level editor.

---

## 4. Eliminate stat boilerplate

`CharacterStats` has 29 fields repeated four times: interface definition, `CharacterOptions`, constructor destructuring, and property assignments (~120 lines of duplication in `src/character.ts`).

**Recommendation:**
- Store stats as a `Record<CharacterStatKey, number>` (or a thin wrapper class).
- Use `Object.assign(this.stats, DEFAULT_CHARACTER_STATS, opts)`.
- Collapses ~90 lines into ~3 and makes adding new stats trivial.

---

## 5. Separate inventory data model from UI

Inventory only exists as UI slot entries (`InventorySlotEntry[]`). The UI *is* the data. Serialisation, headless logic, and inventory rules would require gutting the UI.

**Recommendation:**
- Create an `Inventory` data class with `add` / `remove` / `swap` / `serialize` methods.
- The UI panel becomes a view that renders this model.

---

## 6. Build a real combat / damage system

14+ damage / resistance stat types are defined, but `Enemy.takeDamage()` just does `health -= amount`.

**Recommendation:**
- Create a `CombatResolver` that takes attacker stats + defender stats → final damage.
- Apply resistances, armour, and any modifiers.

---

## 7. Quick wins

| What | Where | Fix |
|------|-------|-----|
| Use PixiJS built-in `sortableChildren` | `src/area.ts` | Replace custom insertion sort with `container.sortableChildren = true` + set `zIndex` |
| Extract magic numbers to config | `src/ui.ts`, `src/collision.ts` | Move slot sizes, orb radius, font sizes, etc. to a `config.ts` |
| Consolidate ticker callbacks | `src/gear.ts` | One shared ticker that syncs all gear instead of 8+ per character |
| Clean up deprecated `fetchManifest` wrappers | `src/area.ts`, `src/item.ts` | Remove the deprecated static methods once all callers use `assets.ts` directly |

---

## Done

- [x] **Break up the `UI` god object** — Split the 1,286-line monolith into six focused classes (`OrbHUD`, `EquipmentPanel`, `InventoryPanel`, `AbilityBar`, `TooltipManager`, `DragDropController`) composed by a thin `UI` coordinator. Each class owns its own layout, state, and input handling. Public API unchanged.
- [x] **Fix dependency inversion: Entity → Area** — Extracted `SHADOW_BLUR` and `fetchManifest` into `src/assets.ts`. `Entity`, `Gear`, `Loot`, `Item`, and `UI` now import from `assets.ts` instead of `area.ts`.
