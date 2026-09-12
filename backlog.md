Completed:

- [x] Nested locations (e.g. called out locations and rooms in a dungeon, hierarchy API, recursive tree explorer, inline sub-room creator)
- [x] Give agent clear definitions of Campaign, Arc, Quest Line, Quest, Scene, Encounter, Session, Beats, and Nested Locations in system prompt taxonomy
- [x] On import, all newly extracted nodes and edges default to Draft (`is_canon=False`)
- [x] Specialized modals for displaying different node types (Location, Creature/NPC/Monster/PC, Timeline/Arc/Quest/Session/Encounter, Item, Faction, Clue/Lore, Map)
- [x] Collapsible quest lines and encounters in Campaign Tapestry (single-line minimized mode, compact encounter density toggle, persistent user state)

Next:

- [ ] Multimodal Map Vision & Pin Alignment:
  - Enable Gemini vision on uploaded map images to detect keyed rooms, labels, landmarks, and relative `(x, y)` coordinates.
  - Ability to direct the agent to place pins for **existing nodes** (Locations, Encounters, NPCs, Clues) by matching room numbers or landmarks without creating duplicates.
  - Auto-generate room/location hierarchy and graph edges (`contains`, `leads_to`) from map layout.
  - Co-DM agent tools: `place_map_pin` and `scan_map_and_align_nodes`, with one-click trigger support in Map Studio.

Later:

- Voice input
- Different "modes" or views for the player portal (e.g. story view, map view, character view, etc.)
- build a faction and renown management mechanic
- integrate battle buddy and the tavern modules
