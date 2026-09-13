Completed:

- [x] Nested locations (e.g. called out locations and rooms in a dungeon, hierarchy API, recursive tree explorer, inline sub-room creator)
- [x] Give agent clear definitions of Campaign, Arc, Quest Line, Quest, Scene, Encounter, Session, Beats, and Nested Locations in system prompt taxonomy
- [x] On import, all newly extracted nodes and edges default to Draft (`is_canon=False`)
- [x] Specialized modals for displaying different node types (Location, Creature/NPC/Monster/PC, Timeline/Arc/Quest/Session/Encounter, Item, Faction, Clue/Lore, Map)
- [x] Collapsible quest lines and encounters in Campaign Tapestry (single-line minimized mode, compact encounter density toggle, persistent user state)
- [x] Multimodal Map Vision & Pin Alignment:
  - Enable Gemini vision on uploaded map images to detect keyed rooms, labels, landmarks, and relative `(x, y)` coordinates.
  - Ability to direct the agent to place pins for **existing nodes** (Locations, Encounters, NPCs, Clues) by matching room numbers or landmarks without creating duplicates.
  - Auto-generate room/location hierarchy and graph edges (`contains`, `leads_to`) from map layout.
  - Co-DM agent tools: `place_map_pin` and `scan_map_and_align_nodes`, with one-click trigger support in Map Studio.
- [x] Visual representation of Quests, Sub-Quests, and Quest Branches:
  - Interactive **Story Flow & Branches DAG** view mode in Campaign Tapestry with topological stages, bezier curves, and branch condition chips.
  - **Nested Sub-Quest story lanes** in matrix timeline with objective rollup badges (`2/3 obj`) and indented child lanes.
  - **Branch & Prerequisite badges** on quest row headers with jump links.
  - Dedicated **Story Flow & Dependencies panel** in `TimelineModal` to manage prerequisites, sub-quests, and downstream consequence branches.
  - `+ Sub-Quest` inline action in `HierarchyPlanner`.

- [x] Horizontal Timeline Expansion/Collapse & Encounter Precedence Prototype Suite:
  - 5 stand-alone interactive prototypes and Master Hub (`/prototypes/index.html`)
  - Prototype 1: Accordion Rails & Horizontal Beat Pipeline (`#1 ➔ #2 ➔ #3` flow)
  - Prototype 2: Multi-Track Story Metro (Subway tracks, station hubs, transfer stops)
  - Prototype 3: Precedence & Decision Branching DAG (Dynamic SVG curves, condition pills)
  - Prototype 4: Evolved 2D Matrix Canvas (48px column folding, cell mini-pipelines)
  - Prototype 5: DM Pacing & Gantt Stepper (Tension curve, time budgets, live sliders)
  - Integrated "Timeline Prototypes" launcher button in app `Navbar.tsx`

- [x] Incorporate chosen horizontal collapse & encounter precedence pattern into main CampaignTapestry.tsx matrix:
  - Collapsible session columns (48px folded vertical spine, sticky headers, unfold animation, text overflow protections)
  - Collapsible Arc groupings spanning sessions with clean act badge banners
  - Dynamic session column widths auto-calculated based on encounter card density (no dead whitespace, no internal horizontal scroll)
  - Precedence bezier curves between encounters (`precedes` relation) with collision-aware floating condition badges
  - Smart condition dot (`.matrix-condition-dot`) when space is tight or overlapping cards, revealing a rich definition tooltip on hover without obscuring card contents
  - Cross-quest milestone emitter/receiver flow badges with jump navigation
  - Full authoring controls in encounter and quest modals (precedence edges, milestone connections, reordering)

Next:

- [ ] Color corrections in parchment chat

Later:

- [ ] think through how to have Monsters with stat blocks (especially humanoid) and then NPCs that leverage those stat blocks. this is almost a class instantiation situation where I might want to have Bandit as a monster, but Xanathar bandit as an NPC that is a Bandit (with changes) that has a particular disposition toward the PCs and role to play.- Voice input
- Different "modes" or views for the player portal (e.g. story view, map view, character view, etc.)
- build a faction and renown management mechanic
- integrate battle buddy and the tavern modules
- Role/Task-Specific System Prompts (Mode Switching): Separate operational mode (ultra-lean prompt for graph updates, reordering, status toggles) from creative Co-DM mode (worldbuilding, dialogue, boxed text)
- Explicit Context Caching (`genai.caching.CachedContent`) for large campaigns, sourcebooks, and adventure modules exceeding 32k tokens
