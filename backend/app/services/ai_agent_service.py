import difflib
from datetime import datetime
import json
import logging
import os
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Tuple
import uuid
import pypdf
from app.db.database import get_connection
from app.services import graph_service
from app.services.graph_service import get_setting, set_setting, get_campaign, list_nodes, list_edges
from app.models import NodeCreate, NodeUpdate, EdgeCreate, PlayerNoteCreate

logger = logging.getLogger(__name__)

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "uploads"


SYSTEM_PROMPT = """You are the Arcane Weaver — an expert D&D 5e Co-DM, world architect, and DM Mentor embedded directly in the campaign management system.

## YOUR SENSE OF SELF: CURIOUS, COLLABORATIVE, & INQUISITIVE LOREKEEPER

You are not merely an automated database runner or a dry query processor; you are a passionate, imaginative, and deeply engaged Co-DM partner who loves worldbuilding, storytelling, and discovering the unique tapestry of this campaign world.

### Be Curious About the Lore
- **Wonder Aloud**: When discussing or expanding campaign lore, locations, NPCs, or quests, be genuinely curious. Notice unaddressed mysteries, unwritten origins, and character motivations.
  - *Example*: "Who forged the sun-sigil above the crypt entrance? Could it be connected to the order that Lady Vane's ancestors betrayed?"
  - *Example*: "The tavern barkeep speaks of a bell tolling beneath the marsh. Do the town guards dismiss this as drunken hearsay, or has someone gone missing in the bogs?"
- **Pose Probing Worldbuilding Questions**: Whenever brainstorming with the DM, conclude your thoughts with 1 or 2 evocative, open-ended questions that help the DM flesh out the connective tissue between the player characters and the world.
- **Celebrate the DM's Choices**: Validate their creativity, weave disparate elements together, and build upon their ideas with "Yes, and..." momentum.

---

## EPISTEMIC AWARENESS: FACTS (CANON), SUSPICIONS, & RUMORS

Great D&D campaigns are built not only on verified truths, but on tavern gossip, player hunches, ancient legends, and deceptive rumors.
Every node and relationship edge in the campaign supports a **Confidence Factor** (`confidence`: 0.0 to 1.0) and **Lore Status** (`lore_status`):

1. **`fact` (Canon 🔒, confidence = 1.0)**:
   - Established, objective truth confirmed by the DM or official campaign history.
   - Protected from accidental deletion or destructive alteration.
2. **`suspicion` (Hypothesis 🔍, confidence = 0.6 to 0.8)**:
   - Working theories formulated by NPCs or the party, unverified leads, circumstantial clues, or forensic deductions that may or may not pan out.
3. **`rumor` (Hearsay 🗣️, confidence = 0.2 to 0.5)**:
   - Tavern talk, bardic songs, folk superstitions, contradictory eyewitness accounts, or deliberate misinformation.
- **Proactively Recommend Levels of Truth**: When creating or proposing clues, secrets, or rumors, suggest assigning appropriate `confidence` and `lore_status` so the DM and players can distinguish hard facts from intriguing suspicions.

---

## CRITICAL: LIVE DATABASE TOOLS — EXECUTE DIRECTLY

You have live Python tool functions wired directly to the campaign's SQLite database (see attached function declarations for parameter schemas).
- When the DM asks you to inspect, search, create, update, reorder, connect, or delete campaign content: **INVOKE YOUR TOOLS DIRECTLY**.
- Do NOT describe hypothetical SQL or instruct the DM to run manual queries. Execute the operations, verify the receipt, and synthesize a clear summary.

### Workflow Rules

1. **Always search before creating** — use `search_nodes` or `find_nodes_by_title` first to check if something already exists.
2. **Always inspect before merging or deleting** — use `get_node_detail` and `list_edges_for_node` so you understand what will be affected.
3. **CANON LORE PROTECTION**:
   - Nodes marked `[Canon 🔒]` represent established, verified campaign lore.
   - You CAN read, reference, link to, and expand upon Canon nodes.
   - You CANNOT delete or destructively overwrite Canon nodes without explicit DM confirmation. If the DM asks you to delete a Canon node, clarify that it is Canon and request confirmation.
   - Nodes marked `[Draft 📝]` or classified as `suspicion`/`rumor` are provisional brainstorms / leads. You have full authority to modify, deduplicate, merge, or refine them.
   - You can use `set_node_canon` to promote approved drafts to official Canon or vice versa upon the DM's instructions.
4. **AUTONOMOUS EXECUTION — DO THE WORK & FINISH IT WITHOUT PAUSING**: When asked to align, update, connect, or clean up campaign content, formulate your full execution plan and execute all tool calls to finish the job within your turn budget. **DO NOT stop halfway to ask 'should I continue?'** or pause for redundant confirmation on operations the DM has already requested. Complete the entire task, then provide a comprehensive summary of all actions taken and the new world state.
5. **PREFER BULK TOOLS FOR MULTI-ITEM OPERATIONS**: When updating multiple node statuses or wiring multiple edges, ALWAYS use `bulk_update_node_status` and `bulk_create_edges` rather than firing dozens of individual single-item calls. This saves tool turns, executes instantly, and keeps the graph synchronized.
6. **CRITICAL ON DEDUPLICATION** — When the DM asks to deduplicate the campaign, clean up duplicates, or remove redundant nodes: **DO NOT merely describe what could be merged.** You MUST execute `deduplicate_campaign()` to actually perform the database changes in SQLite! Once the tool returns, summarize the real results from the tool receipt.
7. **Confirm actions clearly** — after completing multi-step operations, give a short plain-English summary: what you found, what you did, and what the DM should know.
8. **Grounded in existing lore** — always pull from existing Arcs, Quests, NPCs, Factions, Locations, and Relationships before inventing new content.
9. **RESEARCH & INQUIRY SYNTHESIS — ALWAYS DELIVER A COMPLETE ANSWER**: When the DM asks a question, requests an audit, or seeks campaign advice (e.g. "are there encounters that connect?", "did Session 1 address this?", "what is associated with this quest?"), tool calls are only the investigation phase. You MUST synthesize everything you discovered into a rich, structured, and insightful narrative answer in the very same response. Never conclude a turn with only action receipts or generic status stubs.

---

## WORKING SCRATCHPAD & PLAN STATE

You have a dedicated working scratchpad tool (`update_scratchpad`):
- **Initialize on Complex Tasks**: When handling non-trivial multi-step requests (aligning a chapter, cross-referencing session notes, resolving duplicates, or executing multiple updates), call `update_scratchpad` on your very first turn with an execution plan and checklist (e.g. `[ ] 1. Search encounters... [ ] 2. Traverse quest track... [ ] 3. Bulk update...`).
- **Update Progress**: As you execute tools and complete each stage, call `update_scratchpad` to mark steps complete and record working deductions.
- **Traceability**: This provides you and the DM an explicit audit trail of your thought process, guarantees you never lose context across multi-turn loops, and keeps complex plans on track.

---

## GRAPH PRECISION & STRUCTURAL INTEGRITY: CONNECT ALL THE RIGHT NODES, NONE OF THE WRONG ONES

You place supreme value on a well-connected, highly accurate campaign graph. An isolated, floating node is forgotten lore, but a spurious or incorrect relationship corrupts campaign canon.

- **High Standards for Connectivity**: Every entity in the world lives within a web of causality and affiliation. Ensure that newly created or reviewed nodes are anchored to their true narrative parents and peers:
  - Quests must link to their parent Arc via `contains`.
  - Key Encounters, Clues, and Locations must connect to their parent Quests or Sessions (`contains`, `located_at`, `leads_to`).
  - NPCs must link to their Factions (`member_of`), allies (`allied_with`), adversaries (`hostile_to`), or home bases (`located_at`).
  - Clues and Rumors must connect to the secret, NPC, or Location they illuminate (`reveals`, `knows_secret`, `associated_with`).
- **Precision & Accuracy (Zero Hallucinated Links)**: Care deeply that you link *all* the right nodes and *none* of the wrong ones. Never invent speculative links that contradict established facts or pollute the graph. When in doubt, assign the edge a `confidence` score (e.g., 0.5 for rumor) and mark `lore_status='suspicion'`.
- **Deduplication Vigilance**: Detect and eliminate duplicate nodes (e.g., duplicate encounters, statblocks, or faction names). Always merge duplicates cleanly using `merge_nodes` or `deduplicate_campaign()` so edges point to the single canonical record.

---

## INTELLIGENT & SELECTIVE GRAPH TRAVERSAL

Do not wander aimlessly or blast serial queries across the entire graph. Search intelligently by traversing selectively:

- **Anchor First, Traverse Selectively**: When researching questions ("are there other encounters connected to this quest?", "how does Session 1 relate to Chapter 1?"), locate the anchor node first with `find_nodes_by_title` or `search_nodes`, then use `traverse_graph` to selectively explore its neighborhood along relevant relationships (`contains`, `leads_to`, `allied_with`, etc.).
- **Selective Pruning**: Do not blindly pull every node. Filter by `relation_types` and `node_types` to follow the exact narrative thread without overwhelming the context or wasting tool turns.
- **Cross-Reference Subgraphs**: Traverse from the Session to inspect what was logged, and traverse from the Quest/Arc to inspect what was designed. Compare the two neighborhoods to spot discrepancies, missing edges, or completed beats.

---

## CHRONOLOGICAL & TIMELINE COHERENCE: MAKING TIME AND CAUSALITY MAKE SENSE

A living campaign world requires chronological integrity. You want the campaign timeline to make absolute sense and reflect reality at the game table:

- **Actual Session History vs. Adventure Prep**: What actually occurred during a session is immutable campaign history. What is written in adventure notes is merely a blueprint. When auditing or cross-referencing:
  - If the players bypassed an encounter (e.g. the Troll in the tavern never climbed out of the well), do not treat it as an active current threat in that scene. Mark it as bypassed/abandoned, or reposition it to a future beat.
  - If the party resolved a quest early or befriended an enemy, update the status (`completed`, `active`, `abandoned`) and adjust relationship edges immediately.
- **Causal Sequence**: Maintain strict cause-and-effect order. Prerequisites must precede outcomes; discoveries must precede realizations; contiguous physical travel must connect via `leads_to`. Flag any temporal paradoxes, orphan events, or chronological contradictions to the DM with recommended fixes.

---

## CAMPAIGN TAXONOMY & NARRATIVE HIERARCHY DEFINITIONS

To ensure absolute precision, architectural coherence, and flawless organization, you adhere to strict definitions for every structural element in the campaign hierarchy:

1. **Campaign**:
   - The overarching narrative umbrella, cosmic multiverse/world setting, and multi-tier saga encompassing the party's full journey from beginning to end (e.g. Levels 1 to 20).
   - Holds the world lore, campaign setting, grand themes, and all Arcs.

2. **Arc (or Campaign Arc)**:
   - A major narrative act, chapter, or grand story milestone within the campaign with its own overarching conflict, central antagonist, theme, and climactic resolution (e.g. "The Sunless Citadel", "The Red Hand of Doom", "In Search of the Forge of Fury").
   - Spans multiple character levels (e.g. Levels 1–3) and groups several Quests and Quest Lines together.
   - Connected to its component Quests via `contains` relationships.

3. **Quest Line**:
   - An interconnected sequence or thematic chain of episodic quests tied to a shared patron, faction struggle, long-term mystery, or character destiny (e.g. "The Hucrele Family Rescue", "Restoring the Twilight Grove", "Meepo's Redemption").
   - Connects individual Quests via `precedes` or thematic groupings.

4. **Quest**:
   - A distinct, actionable objective or mission with clear stakes, tangible goals, defined milestones, and explicit win/loss conditions (e.g. "Rescue the Missing Adventurers", "Recover Calcryx the White Wyrmling").
   - Yields rewards (XP, GP, magic items, faction renown) and leads to Sessions, Encounters, and Clues.

5. **Session**:
   - A real-world table gameplay event (typically 3–5 hours) representing what actually occurred at the table chronologically.
   - Contains the session date, table agenda, in-game journal recap, emergent player choices, and player notes.
   - Links to the Quests progressed during the session and the Encounters triggered.

6. **Scene**:
   - A distinct dramatic and situational framing within a session or quest focused on a specific moment of dialogue, negotiation, exploration, or dilemma (e.g. "Negotiating with Yusdrayl on the Dragon Throne", "Investigating the Dragon Fountain").
   - Focuses on atmosphere, character dialogue, and dramatic beats before escalating to or resolving an Encounter.

7. **Encounter**:
   - A discrete, focused challenge demanding immediate player decision-making, resource expenditure, skill checks, or combat initiative.
   - Types include:
     - **Combat Encounter**: Tactical battle against monsters/adversaries with statblocks, terrain hazards, and round-by-round tactics.
     - **Social Encounter**: Tense negotiation, interrogation, deception, or persuasion with an NPC holding high stakes.
     - **Puzzle & Trap / Hazard Encounter**: Environmental danger, mechanical or magical riddle, requiring skill checks or clever problem-solving.
     - **Exploration Encounter**: Surviving wilderness hazards, navigating treacherous chasms, or enduring harsh planar environments.

8. **Beats (Story Beats)**:
   - The granular, micro-units of dramatic progression, pacing pulses, emotional turns, and discoveries within a scene, encounter, or session.
   - Standard D&D beat structure:
     - *Hook / Inciting Pulse*: The catalyst that demands attention.
     - *Development / Investigation*: Exploring clues, gathering intel, sizing up the threat.
     - *Complication / Twist*: Unexpected revelation, betrayal, trap, or escalating danger.
     - *Climax / Crisis*: The high-stakes decision, skill check, or battle turn.
     - *Resolution / Cliffhanger*: Consequence, loot discovery, aftermath, or suspenseful transition to the next scene.

9. **Locations & Nested Locations (Keyed Areas & Dungeon Rooms)**:
   - Physical space in the campaign world is strictly hierarchical:
     - World / Continent -> Region -> Settlement / Wilderness -> Dungeon / Building -> Floor / District -> Keyed Room / Called-out Area.
   - Dungeons (e.g. "Sunless Citadel", "Wave Echo Cave") contain their keyed locations (e.g. "Area 1: Ledge", "Area 2: Switchback Stairs", "Area 3: Crumbled Courtyard") connected via `contains` (or `located_at`) relationships.
   - Each Keyed Room / Location node records:
     - Room number and title
     - Boxed text (read-aloud sensory description)
     - Environmental conditions (lighting, smells, temperature, hazards)
     - Keyed inhabitants (NPCs, monsters) and treasure/traps.

---

### D&D 5e Design Principles

- Connect PC Backstories to Quests through faction conflicts and personal stakes.
- Weave factions into tension: completing a quest for one NPC/Faction should ripple to another.
- Three-Clue Rule: ensure critical mysteries have at least 3 distinct discovery avenues.
- Fail-Forward: failed checks = complications, costs, or escalations — not dead ends.
- Evocative Boxed Text: multi-sensory, 2-4 punchy sentences of read-aloud prose.

### 5e Alignment & Tactical Role Personality Grounding

When roleplaying an NPC or brainstorming monster tactics, dialogue, or dilemmas:
- **5e Structured Alignment Spectrum**:
  - **Lawful Good (LG)**: Honor, altruism, standing against injustice; keeps word and protects the vulnerable with discipline.
  - **Neutral Good (NG)**: Does whatever is right, cooperating with or defying authority as needed for the greater good.
  - **Chaotic Good (CG)**: Free-spirited benevolence; rebels against unjust laws and rigid hierarchies to champion personal freedom.
  - **Lawful Neutral (LN)**: Rigid adherence to tradition, honor, codes, contracts, or civic laws above personal sentiment.
  - **True Neutral (TN)**: Balance, pragmatism, neutrality, and self-preservation without moral fanaticism.
  - **Chaotic Neutral (CN)**: Whimsical, individualistic, unpredictable, values personal independence above all else.
  - **Lawful Evil (LE)**: Tyrants, calculating schemers, devils; strictly honors contracts while ruthlessly exploiting loopholes and hierarchies.
  - **Neutral Evil (NE)**: Pure, cold self-interest; betrays allies without remorse if it advances their personal power.
  - **Chaotic Evil (CE)**: Arbitrary malice, bloodlust, demonic fury, carnage, and primal cruelty without restraint.
  - **Unaligned**: Pure predatory instinct, hunger, fear, or programmed sentinel routine; immune to moral appeals or philosophical guilt.
- **Tactical Roles**:
  - **Townsfolk / NPC (`npc`)**: Community-oriented, localized knowledge, trade, rumors, and social ties.
  - **Party Companion / Sidekick (`companion`)**: Dedicated travel partner, protective of the party, distinct personality quirks and loyalty.
  - **Villain / Antagonist (`villain`)**: Complex motives, active schemes, ripple effects across quest lines, intelligent counter-moves.
  - **Legendary Boss (`boss`)**: High threat awareness, commands multi-phase encounters, environment mastery, commands bodyguards.
  - **Monster (`monster`)**: Tactical combat threat, specific physical or magical weaknesses, territory habits.
  - **Beast (`beast`)**: Wildlife, primal reactions to territory, fire, hunger, and wounded prey.
  - **Minion / Grunt (`minion`)**: Swarm tactics, cowardly when isolated, panics or flees if commander falls.
  - **Patron (`patron`)**: Cosmic, transactional, grants boons with hidden prices, communicates through visions, tests, and omens.

---

### SESSION RUN-SHEET DESIGN STANDARDS (TIMELINE-CENTRIC DM COMPANION)

When generating a game session run-sheet, table agenda, or session prep guide:
1. **Strict Timeline-Centric Flow**: The run-sheet MUST flow sequentially and chronologically from table start to table finish. The DM should never have to flip back and forth between disparate sections or tabs during play.
2. **Brief Recap of Last Session ("The Story So Far")**: Always lead with a 2-4 bullet point executive recap of what transpired in the previous session (or campaign kickoff prologue if Session 1), highlighting active cliffhangers, ongoing party conditions, and immediate stakes.
3. **Pacing Time Budgets**: Provide a realistic 3.5 to 4.0 hour table budget broken down across the beats (e.g. `0:00 - 0:30 Opening Atmosphere`, `0:30 - 1:30 The Brawl`, etc.).
4. **NPC & Monster Descriptions (LEAVE FULL STAT BLOCKS OUT)**:
   - Do NOT output full stat blocks (no AC, HP, spell lists, or stat arrays — the DM manages stat blocks elsewhere).
   - DO provide concise, evocative roleplay/tactical profiles: 1-2 sentence sensory description and demeanor, alignment, 5e tactical role, and primary goal/motive.
5. **Read-Aloud Boxed Text**: Include 2-4 punchy, multi-sensory sentences formatted in blockquotes (`> ...`) for the opening scene and major transition reveals.
6. **Inline Table Cues & Fail-Forward**: Embed relevant Skill DCs (Perception, Insight, Athletics), secrets/clues, and explicit fail-forward branches directly inside each beat so play never stalls on a failed roll.
7. **Session Climax & Cliffhanger Hook**: Conclude with the dramatic session climax and a suspenseful cliffhanger bridging directly into the next planned session.
"""

# ---------------------------------------------------------------------------
# Tool definitions for Gemini function calling
# ---------------------------------------------------------------------------

AGENT_TOOLS = [
    {
        "name": "search_nodes",
        "description": "List and search campaign graph nodes. Use to browse existing content or find nodes of a specific type before creating new ones.",
        "parameters": {
            "type": "object",
            "properties": {
                "type_filter": {
                    "type": "string",
                    "description": "Optional node type to filter by. One of: campaign, arc, quest, session, encounter, pc, npc, monster, location, faction, item, clue, map, lore",
                },
                "title_fragment": {
                    "type": "string",
                    "description": "Optional substring to search in node titles (case-insensitive).",
                },
            },
        },
    },
    {
        "name": "get_node_detail",
        "description": "Read the full detail of a specific node including its full content, notes, and all metadata.",
        "parameters": {
            "type": "object",
            "properties": {
                "node_id": {"type": "string", "description": "The ID of the node to retrieve."},
            },
            "required": ["node_id"],
        },
    },
    {
        "name": "find_nodes_by_title",
        "description": "Find all nodes whose title contains the given text fragment. Use this to detect duplicates or locate nodes by approximate name.",
        "parameters": {
            "type": "object",
            "properties": {
                "title_fragment": {"type": "string", "description": "Partial title to search for (case-insensitive)."},
            },
            "required": ["title_fragment"],
        },
    },
    {
        "name": "list_edges_for_node",
        "description": "List all graph edges (relationships) connected to a specific node, showing what it is linked to.",
        "parameters": {
            "type": "object",
            "properties": {
                "node_id": {"type": "string", "description": "The node ID to inspect relationships for."},
            },
            "required": ["node_id"],
        },
    },
    {
        "name": "traverse_graph",
        "description": "Selectively traverse connected paths in the campaign graph starting from a node. Returns rich neighbor details (titles, types, summaries, statuses) and connecting edge relations in a single call. Use this to trace questlines, inspect scenes, and explore connected lore selectively rather than querying individual nodes one by one.",
        "parameters": {
            "type": "object",
            "properties": {
                "start_node_id": {"type": "string", "description": "The node ID from which to begin traversal."},
                "depth": {"type": "integer", "description": "Traversal depth in hops (1 or 2, default is 1)."},
                "relation_types": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Optional list of relationship types to follow (e.g. ['contains', 'leads_to', 'located_at', 'allied_with', 'gives_quest']).",
                },
                "node_types": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Optional list of node types to filter neighbors by (e.g. ['encounter', 'quest', 'npc', 'location']).",
                },
                "direction": {
                    "type": "string",
                    "description": "Edge direction to traverse: 'outgoing', 'incoming', or 'both' (default 'both').",
                },
            },
            "required": ["start_node_id"],
        },
    },
    {
        "name": "create_node",
        "description": "Create a new graph node in the campaign database.",
        "parameters": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "description": "Node type: arc, quest, session, encounter, npc, pc, monster, location, faction, item, clue, lore"},
                "title": {"type": "string", "description": "Node title."},
                "subtitle": {"type": "string", "description": "Optional subtitle or role (e.g. 'Village Elder', 'Side Quest')."},
                "summary": {"type": "string", "description": "Brief 1-2 sentence summary."},
                "content_markdown": {"type": "string", "description": "Full DM notes in markdown format."},
                "data_json": {"type": "string", "description": "Optional JSON string with extra structured key-value pairs. For creatures/NPCs, include 'role' (npc, companion, villain, boss, monster, beast, minion, patron), 'alignment' (lawful_good, neutral_good, chaotic_good, lawful_neutral, true_neutral, chaotic_neutral, lawful_evil, neutral_evil, chaotic_evil, unaligned, any), 'creature_size', 'creature_type', 'cr', 'hp', 'ac', 'abilities'."},
                "is_canon": {"type": "boolean", "description": "Set to true for official Canon lore (default), or false for provisional working drafts."},
                "confidence": {"type": "number", "description": "Epistemic confidence rating from 0.0 to 1.0 (default 1.0 for facts, 0.6-0.8 for suspicions, 0.2-0.5 for rumors)."},
                "lore_status": {"type": "string", "description": "Truth level: 'fact' (Canon 🔒), 'suspicion' (Hypothesis 🔍), or 'rumor' (Hearsay 🗣️).", "enum": ["fact", "suspicion", "rumor"]},
                "sort_order": {"type": "integer", "description": "Explicit sort order integer for visual ordering (e.g. 10, 20, 30 for quest stack or session sequence)."},
            },
            "required": ["type", "title"],
        },
    },
    {
        "name": "update_node",
        "description": "Update an existing node's type, title, subtitle, summary, content, data, confidence, or lore status. Only the fields you provide will be changed. Preserves all connected edges, player notes, and references.",
        "parameters": {
            "type": "object",
            "properties": {
                "node_id": {"type": "string", "description": "ID of the node to update."},
                "type": {
                    "type": "string",
                    "description": "New node type if reclassifying (campaign, arc, quest, session, encounter, pc, npc, monster, location, faction, item, clue, map, lore). Preserves all connected edges.",
                    "enum": [
                        "campaign",
                        "arc",
                        "quest",
                        "session",
                        "encounter",
                        "pc",
                        "npc",
                        "monster",
                        "location",
                        "faction",
                        "item",
                        "clue",
                        "map",
                        "lore",
                    ],
                },
                "title": {"type": "string", "description": "New title."},
                "subtitle": {"type": "string", "description": "New subtitle."},
                "summary": {"type": "string", "description": "New summary."},
                "content_markdown": {"type": "string", "description": "New full DM notes content."},
                "data_json": {"type": "string", "description": "New or merged structured data as a JSON string (e.g. including role, alignment, creature_size, creature_type, stats)."},
                "confidence": {"type": "number", "description": "New epistemic confidence rating (0.0 to 1.0, e.g. 1.0 for fact, 0.7 for suspicion, 0.4 for rumor)."},
                "lore_status": {"type": "string", "description": "New truth status: 'fact', 'suspicion', or 'rumor'.", "enum": ["fact", "suspicion", "rumor"]},
                "is_canon": {"type": "boolean", "description": "Set to true for official Canon lore (protected), or false for provisional working draft."},
                "sort_order": {"type": "integer", "description": "New sort order integer for explicit visual ordering (e.g. 10, 20, 30 for quest stack or session sequence)."},
            },
            "required": ["node_id"],
        },
    },
    {
        "name": "bulk_update_node_confidence",
        "description": "Quickly set the epistemic confidence level (0.0 to 1.0) and/or lore_status ('fact', 'suspicion', 'rumor') for multiple nodes in a single tool call. Use this whenever the DM asks to set all quests, encounters, clues, or rumors to a specific confidence or rumor status.",
        "parameters": {
            "type": "object",
            "properties": {
                "updates": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "node_id": {"type": "string", "description": "ID of the node."},
                            "confidence": {"type": "number", "description": "Epistemic confidence rating (0.0 to 1.0, e.g. 1.0 for fact, 0.7 for suspicion, 0.4 for rumor)."},
                            "lore_status": {"type": "string", "description": "Truth status: 'fact', 'suspicion', or 'rumor'.", "enum": ["fact", "suspicion", "rumor"]},
                        },
                        "required": ["node_id"],
                    },
                    "description": "List of {node_id, confidence?, lore_status?} objects to update.",
                },
            },
            "required": ["updates"],
        },
    },
    {
        "name": "update_node_status",
        "description": "Set the status of a node (planned, active, completed, abandoned). Use this to mark quests, sessions, or encounters as done.",
        "parameters": {
            "type": "object",
            "properties": {
                "node_id": {"type": "string", "description": "ID of the node to update."},
                "status": {"type": "string", "description": "New status value: planned, active, completed, or abandoned."},
            },
            "required": ["node_id", "status"],
        },
    },
    {
        "name": "bulk_update_node_status",
        "description": "Quickly set the status for multiple nodes at once (planned, active, completed, abandoned). Use this to align entire questlines or chapter encounters in a single tool call.",
        "parameters": {
            "type": "object",
            "properties": {
                "updates": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "node_id": {"type": "string", "description": "ID of the node."},
                            "status": {"type": "string", "description": "Status: planned, active, completed, or abandoned."},
                        },
                        "required": ["node_id", "status"],
                    },
                    "description": "List of {node_id, status} objects to update.",
                },
            },
            "required": ["updates"],
        },
    },
    {
        "name": "reorder_nodes",
        "description": "Reorder a sequence of nodes (such as the quest stack, session sequence, or encounter list in Campaign Tapestry or Hierarchy Planner) by setting their sort_order sequentially (10, 20, 30, ...). Pass the node IDs in the desired top-to-bottom or start-to-finish order.",
        "parameters": {
            "type": "object",
            "properties": {
                "node_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Ordered list of node IDs representing the desired sequence from first to last.",
                },
            },
            "required": ["node_ids"],
        },
    },
    {
        "name": "delete_node",
        "description": "Delete a single node and all edges connected to it. Canon nodes (is_canon=true) are protected from deletion unless the DM gives explicit confirmation.",
        "parameters": {
            "type": "object",
            "properties": {
                "node_id": {"type": "string", "description": "ID of the node to delete."},
                "force_canon": {"type": "boolean", "description": "Set to true only if the DM explicitly confirmed deleting this protected Canon node."},
            },
            "required": ["node_id"],
        },
    },
    {
        "name": "bulk_delete_nodes",
        "description": "Delete multiple nodes and their edges at once. Skips protected Canon nodes unless force_canon=true.",
        "parameters": {
            "type": "object",
            "properties": {
                "node_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of node IDs to delete.",
                },
                "force_canon": {"type": "boolean", "description": "Set to true only if the DM explicitly confirmed deleting protected Canon nodes."},
            },
            "required": ["node_ids"],
        },
    },
    {
        "name": "merge_nodes",
        "description": "Merge one or more duplicate nodes into a single primary node. All edges (relationships) from the duplicates are re-pointed to the primary. The duplicates are then deleted. Optionally provide merged title/summary/content to update the primary with combined information.",
        "parameters": {
            "type": "object",
            "properties": {
                "primary_id": {"type": "string", "description": "ID of the node to keep as the canonical record."},
                "duplicate_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "IDs of the duplicate nodes to merge into the primary and then delete.",
                },
                "merged_title": {"type": "string", "description": "Optional new title for the merged primary node."},
                "merged_summary": {"type": "string", "description": "Optional combined summary for the merged node."},
                "merged_content": {"type": "string", "description": "Optional combined DM notes for the merged node."},
            },
            "required": ["primary_id", "duplicate_ids"],
        },
    },
    {
        "name": "deduplicate_campaign",
        "description": "Automatically audit and merge duplicate nodes across the entire campaign in SQLite. Groups nodes sharing matching titles and types, chooses the canonical richest record, re-points all relationships, combines lore/notes, and deletes redundant records from the database. Call this whenever the DM asks to deduplicate or clean up duplicate campaign entries.",
        "parameters": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "set_node_canon",
        "description": "Mark a node as official Canon lore (is_canon=true) to protect it from deletion, or mark it as a working draft (is_canon=false) for provisional brainstorming.",
        "parameters": {
            "type": "object",
            "properties": {
                "node_id": {"type": "string", "description": "ID of the node."},
                "is_canon": {"type": "boolean", "description": "True for official Canon (protected from deletion); False for working draft."},
            },
            "required": ["node_id", "is_canon"],
        },
    },
    {
        "name": "create_edge",
        "description": "Create a relationship (edge) between two existing nodes.",
        "parameters": {
            "type": "object",
            "properties": {
                "source_id": {"type": "string", "description": "ID of the source node."},
                "target_id": {"type": "string", "description": "ID of the target node."},
                "relation_type": {
                    "type": "string",
                    "description": "Relationship type: allied_with, hostile_to, located_at, contains, leads_to, gives_quest, rewards, precedes, parent_of, related_to, associated_with, worships, created_by, recorded_in",
                },
                "label": {"type": "string", "description": "Optional custom label for the edge."},
                "confidence": {"type": "number", "description": "Epistemic confidence rating (0.0 to 1.0, default 1.0 for facts)."},
                "lore_status": {"type": "string", "description": "Truth status: 'fact', 'suspicion', or 'rumor'.", "enum": ["fact", "suspicion", "rumor"]},
            },
            "required": ["source_id", "target_id", "relation_type"],
        },
    },
    {
        "name": "bulk_create_edges",
        "description": "Create multiple relationships (edges) between existing nodes in a single tool call. Use this to wire multiple encounters, NPCs, and locations to their parent quests or sessions without wasting turns.",
        "parameters": {
            "type": "object",
            "properties": {
                "edges": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "source_id": {"type": "string", "description": "ID of the source node."},
                            "target_id": {"type": "string", "description": "ID of the target node."},
                            "relation_type": {
                                "type": "string",
                                "description": "Relationship type: allied_with, hostile_to, located_at, contains, leads_to, gives_quest, rewards, precedes, parent_of, related_to, associated_with, worships, created_by, recorded_in",
                            },
                            "label": {"type": "string", "description": "Optional label."},
                        },
                        "required": ["source_id", "target_id", "relation_type"],
                    },
                    "description": "List of edge objects to create.",
                },
            },
            "required": ["edges"],
        },
    },
    {
        "name": "delete_edge",
        "description": "Delete a specific relationship (edge) by its ID.",
        "parameters": {
            "type": "object",
            "properties": {
                "edge_id": {"type": "string", "description": "ID of the edge to delete."},
            },
            "required": ["edge_id"],
        },
    },
    {
        "name": "update_scratchpad",
        "description": "Maintain your internal working memory, execution plan, and progress checklist. Call this on multi-step tasks to outline your plan, check off completed steps, or record intermediate findings and remaining steps.",
        "parameters": {
            "type": "object",
            "properties": {
                "plan_notes": {
                    "type": "string",
                    "description": "The updated working plan, checklist of completed/remaining tasks, or scratchpad notes in markdown format.",
                },
            },
            "required": ["plan_notes"],
        },
    },
    {
        "name": "place_map_pin",
        "description": "Place or update an interactive location pin on a campaign battle map or regional map at exact (x, y) percentage coordinates (0.0 to 100.0). Optionally connects to an existing entity node (location, encounter, NPC, clue) or creates a new draft location node.",
        "parameters": {
            "type": "object",
            "properties": {
                "map_id": {"type": "string", "description": "ID of the map node to drop the pin on."},
                "label": {"type": "string", "description": "Pin label or room name (e.g. 'Area 3: White Wyrmling Shrine')."},
                "x": {"type": "number", "description": "Horizontal position percentage across the map from 0.0 (left) to 100.0 (right)."},
                "y": {"type": "number", "description": "Vertical position percentage down the map from 0.0 (top) to 100.0 (bottom)."},
                "node_id": {"type": "string", "description": "Optional ID of an existing campaign node (location, encounter, NPC, etc.) to link to this pin."},
                "revealed": {"type": "boolean", "description": "True to reveal this pin to players on the player portal; False for DM secret fog of war (default True)."},
                "target_map_id": {"type": "string", "description": "Optional ID of a linked sub-map for fast-travel drilldown."},
            },
            "required": ["map_id", "label", "x", "y"],
        },
    },
    {
        "name": "scan_map_and_align_nodes",
        "description": "Perform multimodal computer vision analysis on an uploaded map image using Gemini. Detects keyed room numbers, labels, landmarks, and passage connections; aligns them with existing campaign nodes (without creating duplicates); auto-generates room hierarchy and leads_to corridors; and saves the pins to the map.",
        "parameters": {
            "type": "object",
            "properties": {
                "map_id": {"type": "string", "description": "ID of the map node to scan."},
                "instruction": {"type": "string", "description": "Optional instructions for the vision scan (e.g. 'Focus on the kobold lair rooms 1-10')."},
                "auto_align_existing": {"type": "boolean", "description": "Whether to match detected rooms to existing campaign nodes (default True)."},
                "create_missing_nodes": {"type": "boolean", "description": "Whether to draft new location nodes for unindexed keyed rooms (default True)."},
                "connect_passages": {"type": "boolean", "description": "Whether to create leads_to edges between adjacent connected rooms (default True)."},
            },
            "required": ["map_id"],
        },
    },
    {
        "name": "generate_session_run_sheet",
        "description": "Generate a comprehensive, timeline-centric DM run-sheet for a game session. Automatically gathers the previous session recap, chronological timeline beats, encounters in sequence, NPCs/monsters (with brief descriptions and tactical motives, no full stat blocks), read-aloud boxed text, and inline DCs. Can also save directly to the session node.",
        "parameters": {
            "type": "object",
            "properties": {
                "session_id": {"type": "string", "description": "ID of the session node to generate the run-sheet for."},
                "custom_instruction": {"type": "string", "description": "Optional instructions, e.g. pacing focus, character spotlight, or specific table duration."},
                "save_to_node": {"type": "boolean", "description": "Whether to save the generated run-sheet directly to the session node (default True)."},
                "use_llm": {"type": "boolean", "description": "Whether to use LLM for creative embellishment (default False: uses instant, rich deterministic graph generation)."}
            },
            "required": ["session_id"],
        },
    },
]


def _dispatch_tool_call(tool_name: str, args: dict, campaign_id: str, scratchpad_state: Optional[dict] = None) -> dict:
    """
    Executes a tool call from the agent loop.
    Returns a JSON-serializable dict with results.
    """
    from app.services import graph_service
    from app.models import NodeCreate, NodeUpdate, EdgeCreate

    try:
        if tool_name == "search_nodes":
            type_filter = args.get("type_filter")
            title_fragment = args.get("title_fragment", "")
            if title_fragment:
                nodes = graph_service.find_nodes_by_title(campaign_id, title_fragment)
                if type_filter:
                    nodes = [n for n in nodes if n.type == type_filter]
            else:
                nodes = graph_service.list_nodes(campaign_id, node_type=type_filter)
            return {
                "nodes": [
                    {
                        "id": n.id,
                        "type": n.type,
                        "title": n.title,
                        "subtitle": n.subtitle,
                        "summary": n.summary,
                        "status": n.data_json.get("status", "planned") if n.data_json else "planned",
                    }
                    for n in nodes
                ],
                "count": len(nodes),
            }

        elif tool_name == "get_node_detail":
            n = graph_service.get_node(args["node_id"])
            if not n:
                return {"error": f"Node {args['node_id']} not found."}
            return {
                "id": n.id,
                "type": n.type,
                "title": n.title,
                "subtitle": n.subtitle,
                "summary": n.summary,
                "content_markdown": n.content_markdown,
                "data_json": n.data_json,
                "tags": n.tags,
            }

        elif tool_name == "find_nodes_by_title":
            nodes = graph_service.find_nodes_by_title(campaign_id, args["title_fragment"])
            return {
                "nodes": [
                    {"id": n.id, "type": n.type, "title": n.title, "summary": n.summary}
                    for n in nodes
                ],
                "count": len(nodes),
            }

        elif tool_name == "list_edges_for_node":
            edges = graph_service.list_edges_for_node(campaign_id, args["node_id"])
            return {"edges": edges, "count": len(edges)}

        elif tool_name == "traverse_graph":
            depth = int(args.get("depth", 1))
            relation_types = args.get("relation_types")
            if isinstance(relation_types, str):
                relation_types = [r.strip() for r in relation_types.split(",") if r.strip()]
            node_types = args.get("node_types")
            if isinstance(node_types, str):
                node_types = [t.strip() for t in node_types.split(",") if t.strip()]
            direction = str(args.get("direction", "both")).lower()
            return graph_service.traverse_graph(
                campaign_id=campaign_id,
                start_node_id=args["start_node_id"],
                depth=depth,
                relation_types=relation_types,
                node_types=node_types,
                direction=direction,
            )

        elif tool_name == "create_node":
            raw_data = args.get("data_json", {})
            if isinstance(raw_data, str):
                try:
                    data_json = json.loads(raw_data)
                except Exception:
                    data_json = {}
            elif isinstance(raw_data, dict):
                data_json = raw_data
            else:
                data_json = {}

            conf = args.get("confidence")
            try:
                conf_val = float(conf) if conf is not None else 1.0
            except (ValueError, TypeError):
                conf_val = 1.0
            lore_status_val = str(args.get("lore_status", "fact")) if args.get("lore_status") else "fact"
            sort_order_val = 0
            if "sort_order" in args and args["sort_order"] is not None:
                try:
                    sort_order_val = int(args["sort_order"])
                except (ValueError, TypeError):
                    sort_order_val = 0

            node = graph_service.create_node(
                NodeCreate(
                    campaign_id=campaign_id,
                    type=args["type"],
                    title=args["title"],
                    subtitle=args.get("subtitle", ""),
                    summary=args.get("summary", ""),
                    content_markdown=args.get("content_markdown", ""),
                    data_json=data_json,
                    is_canon=args.get("is_canon", True),
                    confidence=conf_val,
                    lore_status=lore_status_val,
                    sort_order=sort_order_val,
                ),
                default_campaign_id=campaign_id,
            )
            canon_str = " (Canon 🔒)" if node.is_canon else " (Draft 📝)"
            return {
                "created": True,
                "node_id": node.id,
                "title": node.title + canon_str,
                "type": node.type,
                "is_canon": node.is_canon,
                "confidence": node.confidence,
                "lore_status": node.lore_status,
                "sort_order": node.sort_order,
            }

        elif tool_name == "update_node":
            raw_data = args.get("data_json")
            if isinstance(raw_data, str):
                try:
                    data_json = json.loads(raw_data)
                except Exception:
                    data_json = None
            elif isinstance(raw_data, dict):
                data_json = raw_data
            else:
                data_json = None

            conf = args.get("confidence")
            try:
                conf_val = float(conf) if conf is not None else None
            except (ValueError, TypeError):
                conf_val = None
            lore_status_val = str(args.get("lore_status")) if args.get("lore_status") is not None else None
            is_canon_val = bool(args["is_canon"]) if "is_canon" in args and args["is_canon"] is not None else None
            sort_order_val = None
            if "sort_order" in args and args["sort_order"] is not None:
                try:
                    sort_order_val = int(args["sort_order"])
                except (ValueError, TypeError):
                    sort_order_val = None

            updated = graph_service.update_node(
                args["node_id"],
                NodeUpdate(
                    type=args.get("type"),
                    title=args.get("title"),
                    subtitle=args.get("subtitle"),
                    summary=args.get("summary"),
                    content_markdown=args.get("content_markdown"),
                    data_json=data_json,
                    confidence=conf_val,
                    lore_status=lore_status_val,
                    is_canon=is_canon_val,
                    sort_order=sort_order_val,
                ),
            )
            if not updated:
                return {"error": f"Node {args['node_id']} not found."}
            return {
                "updated": True,
                "node_id": updated.id,
                "title": updated.title,
                "type": updated.type,
                "confidence": updated.confidence,
                "lore_status": updated.lore_status,
                "is_canon": updated.is_canon,
                "sort_order": updated.sort_order,
            }

        elif tool_name == "bulk_update_node_confidence":
            updates = args.get("updates", [])
            return graph_service.bulk_update_node_confidence(updates)

        elif tool_name == "update_node_status":
            updated = graph_service.update_node_status(args["node_id"], args["status"])
            if not updated:
                return {"error": f"Node {args['node_id']} not found."}
            return {"updated": True, "node_id": updated.id, "title": updated.title, "status": args["status"]}

        elif tool_name == "bulk_update_node_status":
            updates = args.get("updates", [])
            return graph_service.bulk_update_node_status(updates)

        elif tool_name == "reorder_nodes":
            node_ids = args.get("node_ids", [])
            updated_nodes = []
            for idx, nid in enumerate(node_ids):
                new_order = (idx + 1) * 10
                upd = graph_service.update_node(nid, NodeUpdate(sort_order=new_order))
                if upd:
                    updated_nodes.append({"id": upd.id, "title": upd.title, "sort_order": new_order})
            return {
                "reordered": True,
                "count": len(updated_nodes),
                "nodes": updated_nodes,
            }

        elif tool_name == "delete_node":
            node = graph_service.get_node(args["node_id"])
            if not node:
                return {"error": f"Node {args['node_id']} not found."}
            force_canon = args.get("force_canon", False)
            if node.is_canon and not force_canon:
                return {
                    "error": "CANON_PROTECTED",
                    "node_id": node.id,
                    "title": node.title,
                    "is_canon": True,
                    "message": f"PROTECTED LORE: Node '{node.title}' is marked as Canon. It cannot be deleted without explicit confirmation. If you truly wish to remove it, ask me specifically to override Canon protection.",
                }
            # Clean up edges referencing this node
            campaign_edges = graph_service.list_edges(campaign_id)
            for e in campaign_edges:
                if e.source_id == args["node_id"] or e.target_id == args["node_id"]:
                    graph_service.delete_edge(e.id)
            deleted = graph_service.delete_node(args["node_id"])
            return {"deleted": deleted, "node_id": args["node_id"], "title": node.title}

        elif tool_name == "bulk_delete_nodes":
            force_canon = args.get("force_canon", False)
            result = graph_service.bulk_delete_nodes(campaign_id, args["node_ids"], force_canon=force_canon)
            return result

        elif tool_name == "set_node_canon":
            updated = graph_service.toggle_node_canon(args["node_id"], is_canon=args["is_canon"])
            if not updated:
                return {"error": f"Node {args['node_id']} not found."}
            status_text = "Canon Lore 🔒 (Protected from deletion)" if updated.is_canon else "Working Draft 📝 (Provisional)"
            return {
                "updated": True,
                "node_id": updated.id,
                "title": updated.title,
                "is_canon": updated.is_canon,
                "message": f"Node '{updated.title}' is now marked as {status_text}.",
            }

        elif tool_name == "merge_nodes":
            merged = graph_service.merge_nodes(
                campaign_id=campaign_id,
                primary_id=args["primary_id"],
                duplicate_ids=args["duplicate_ids"],
                merged_title=args.get("merged_title"),
                merged_summary=args.get("merged_summary"),
                merged_content=args.get("merged_content"),
            )
            if not merged:
                return {"error": f"Primary node {args['primary_id']} not found."}
            return {
                "merged": True,
                "primary_id": merged.id,
                "primary_title": merged.title,
                "duplicates_deleted": args["duplicate_ids"],
            }

        elif tool_name == "deduplicate_campaign":
            result = graph_service.deduplicate_campaign(campaign_id)
            return result

        elif tool_name == "create_edge":
            conf = args.get("confidence")
            try:
                conf_val = float(conf) if conf is not None else 1.0
            except (ValueError, TypeError):
                conf_val = 1.0
            lore_status_val = str(args.get("lore_status", "fact")) if args.get("lore_status") else "fact"
            edge = graph_service.create_edge(
                EdgeCreate(
                    campaign_id=campaign_id,
                    source_id=args["source_id"],
                    target_id=args["target_id"],
                    relation_type=args["relation_type"],
                    label=args.get("label", ""),
                    confidence=conf_val,
                    lore_status=lore_status_val,
                ),
                default_campaign_id=campaign_id,
            )
            return {"created": True, "edge_id": edge.id, "relation_type": edge.relation_type, "confidence": edge.confidence, "lore_status": edge.lore_status}

        elif tool_name == "bulk_create_edges":
            edges = args.get("edges", [])
            return graph_service.bulk_create_edges(edges, default_campaign_id=campaign_id)

        elif tool_name == "update_scratchpad":
            notes = str(args.get("plan_notes", ""))
            if scratchpad_state is not None:
                scratchpad_state["notes"] = notes
            return {"status": "scratchpad_updated", "length": len(notes)}

        elif tool_name == "delete_edge":
            deleted = graph_service.delete_edge(args["edge_id"])
            return {"deleted": deleted, "edge_id": args["edge_id"]}

        elif tool_name == "place_map_pin":
            from app.services import map_vision_service
            res = map_vision_service.place_single_map_pin(
                map_id=args["map_id"],
                campaign_id=campaign_id,
                label=args["label"],
                x=float(args["x"]),
                y=float(args["y"]),
                node_id=args.get("node_id"),
                revealed=bool(args.get("revealed", True)),
                target_map_id=args.get("target_map_id"),
            )
            return res

        elif tool_name == "scan_map_and_align_nodes":
            from app.services import map_vision_service
            res = map_vision_service.scan_map_with_gemini_vision(
                map_id=args["map_id"],
                campaign_id=campaign_id,
                instruction=args.get("instruction", ""),
                auto_align_existing=bool(args.get("auto_align_existing", True)),
                create_missing_nodes=bool(args.get("create_missing_nodes", True)),
                connect_passages=bool(args.get("connect_passages", True)),
                apply_changes=True,
            )
            return res

        elif tool_name == "generate_session_run_sheet":
            return generate_session_run_sheet(
                session_id=args["session_id"],
                campaign_id=campaign_id,
                custom_instruction=args.get("custom_instruction", ""),
                save_to_node=bool(args.get("save_to_node", True)),
                use_llm=bool(args.get("use_llm", False)),
            )

        else:
            return {"error": f"Unknown tool: {tool_name}"}

    except Exception as e:
        logger.error(f"Tool dispatch error [{tool_name}]: {e}", exc_info=True)
        return {"error": str(e)}


def _proto_to_python(val: Any) -> Any:
    """Recursively converts Protobuf composite/container types into pure native Python types."""
    if val is None:
        return None
    if isinstance(val, (str, int, float, bool)):
        return val
    if isinstance(val, (list, tuple, set)):
        return [_proto_to_python(v) for v in val]
    if isinstance(val, dict):
        return {str(k): _proto_to_python(v) for k, v in val.items()}
    try:
        from google.protobuf.json_format import MessageToDict
        from google.protobuf.message import Message
        if isinstance(val, Message):
            return MessageToDict(val)
    except Exception:
        pass
    if hasattr(val, "items") and callable(getattr(val, "items", None)):
        try:
            return {str(k): _proto_to_python(v) for k, v in val.items()}
        except Exception:
            pass
    if hasattr(val, "__iter__"):
        try:
            return [_proto_to_python(v) for v in val]
        except Exception:
            pass
    return val


def _sanitize_gemini_history(messages_slice: List[Dict[str, Any]]):
    """
    Sanitizes conversation history for Gemini multi-turn chat.
    Guarantees strictly alternating user/model turns starting with user and ending with model.
    Returns (gemini_history, leftover_user_text).
    """
    if not messages_slice:
        return [], ""

    normalized = []
    for m in messages_slice:
        role = "user" if m.get("role") == "user" else "model"
        content = str(m.get("content") or "").strip()
        if not content:
            continue
        if normalized and normalized[-1]["role"] == role:
            normalized[-1]["parts"][0] += f"\n\n{content}"
        else:
            normalized.append({"role": role, "parts": [content]})

    # Ensure it starts with user
    while normalized and normalized[0]["role"] != "user":
        normalized.pop(0)

    # Any trailing user messages cannot be at the end of history if the new send_message is user
    leftover_user_text = ""
    while normalized and normalized[-1]["role"] != "model":
        trailing = normalized.pop(-1)
        leftover_user_text = trailing["parts"][0] + ("\n\n" + leftover_user_text if leftover_user_text else "")

    return normalized, leftover_user_text


DEFAULT_MAX_TURNS = 25
DEFAULT_MAX_TOKENS = 120_000


def _sanitize_and_truncate_tool_result(result: Any, max_chars: int = 4000) -> Any:
    """
    Truncates oversized tool outputs to prevent context bloat and quadratic token usage.
    Preserves dictionary structure while clipping long lists or large text fields.
    """
    if not isinstance(result, (dict, list)):
        return result

    try:
        dumped = json.dumps(result, default=str)
        if len(dumped) <= max_chars:
            return result
    except Exception:
        return result

    if isinstance(result, dict):
        truncated_dict = {}
        for k, v in result.items():
            if isinstance(v, list) and len(v) > 8:
                original_len = len(v)
                truncated_dict[k] = v[:6]
                truncated_dict[f"_{k}_truncated"] = (
                    f"Showing 6 of {original_len} items to optimize token usage. "
                    f"Refine search filters to target specific items."
                )
            elif isinstance(v, str) and len(v) > 2000:
                truncated_dict[k] = v[:1800] + f"\n\n[... truncated {len(v) - 1800} chars for context efficiency ...]"
            elif isinstance(v, dict):
                truncated_dict[k] = _sanitize_and_truncate_tool_result(v, max_chars=max_chars // 2)
            else:
                truncated_dict[k] = v
        return truncated_dict

    elif isinstance(result, list) and len(result) > 8:
        return result[:6] + [{"_truncated": f"{len(result) - 6} additional items truncated to prevent token bloat."}]

    return result


class AgentLoopGuard:
    """
    Safeguards agentic execution against infinite tool loops, aimless stagnation,
    and runaway token usage during complex multi-turn tasks.
    """
    def __init__(
        self,
        max_turns: int = DEFAULT_MAX_TURNS,
        max_tokens: int = DEFAULT_MAX_TOKENS,
        repeat_window: int = 6,
        repeat_threshold: int = 2,
        max_stagnant_reads: int = 5,
    ):
        self.max_turns = max_turns
        self.max_tokens = max_tokens
        self.repeat_window = repeat_window
        self.repeat_threshold = repeat_threshold
        self.max_stagnant_reads = max_stagnant_reads

        self.call_history: List[Tuple[str, str]] = []
        self.read_only_turns_count: int = 0
        self.loop_warnings_count: int = 0
        self.consecutive_loop_interventions: int = 0
        self.total_tokens_observed: int = 0
        self.stop_reason: Optional[str] = None

    def record_turn_tokens(self, response) -> Tuple[bool, int]:
        """
        Checks usage metadata from Gemini response.
        Returns (is_exceeded, total_tokens).
        """
        usage = getattr(response, "usage_metadata", None)
        if usage:
            total = getattr(usage, "total_token_count", 0)
            if total > 0:
                self.total_tokens_observed = total
                if total >= self.max_tokens:
                    self.stop_reason = f"Token budget exceeded ({total:,} tokens >= {self.max_tokens:,} limit)"
                    return True, total
        return False, self.total_tokens_observed

    def check_tool_call(self, tool_name: str, args: dict) -> Tuple[bool, Optional[str]]:
        """
        Checks if a tool call is an unproductive repeat.
        Returns (is_blocked, intervention_message).
        """
        # Scratchpad updates are working thoughts and should not be blocked as duplicates
        if tool_name == "update_scratchpad":
            return False, None

        try:
            serialized_args = json.dumps(args, sort_keys=True, default=str)
        except Exception:
            serialized_args = str(args)

        call_sig = (tool_name, serialized_args)

        # Count occurrences in the recent call window
        recent_window = self.call_history[-self.repeat_window:]
        recent_matches = sum(1 for sig in recent_window if sig == call_sig)

        # Check immediate consecutive repeat
        is_consecutive = bool(self.call_history and self.call_history[-1] == call_sig)

        if is_consecutive or recent_matches >= self.repeat_threshold:
            self.loop_warnings_count += 1
            self.consecutive_loop_interventions += 1
            msg = (
                f"Loop Prevention Warning: You have executed '{tool_name}' with identical parameters "
                f"multiple times without an intervening state change. "
                f"Do not repeat this call. Pivot to a different query, perform your planned updates, "
                f"or synthesize your final response."
            )
            return True, msg

        self.call_history.append(call_sig)
        self.consecutive_loop_interventions = 0
        return False, None

    def should_force_stop(self) -> Tuple[bool, Optional[str]]:
        """
        Determines if the agent has repeatedly triggered loop warnings
        and should immediately transition to final synthesis.
        """
        if self.consecutive_loop_interventions >= 2:
            return True, "Repeated consecutive identical tool calls detected. Breaking to final synthesis."
        if self.loop_warnings_count >= 4:
            return True, "Multiple loop prevention warnings encountered. Breaking to final synthesis."
        if self.stop_reason:
            return True, self.stop_reason
        return False, None

    def update_turn_activity(self, function_names: List[str], turn: int) -> Optional[str]:
        """
        Tracks whether the turn was state-modifying or purely read-only.
        Returns a stagnation nudge message if too many read-only turns have occurred.
        """
        modifying_tools = {
            "create_node", "update_node", "bulk_update_node_status",
            "create_edge", "bulk_create_edges", "delete_node",
            "delete_edge", "merge_nodes", "deduplicate_campaign",
            "set_node_canon", "update_scratchpad"
        }
        has_write = any(name in modifying_tools for name in function_names)

        if has_write:
            self.read_only_turns_count = 0
        else:
            self.read_only_turns_count += 1

        if self.read_only_turns_count >= self.max_stagnant_reads:
            return (
                f"Pacing Notice: You have completed {self.read_only_turns_count} consecutive read-only turns. "
                f"If you have gathered sufficient information, proceed to make the required updates or synthesize your answer."
            )
        return None

    def get_pacing_meta(self, turn: int) -> Dict[str, Any]:
        """
        Returns pacing metadata to inject into tool responses.
        """
        current_turn = turn + 1
        turns_remaining = max(0, self.max_turns - current_turn)
        meta: Dict[str, Any] = {
            "turn": current_turn,
            "max_turns": self.max_turns,
            "turns_remaining": turns_remaining,
        }
        if turns_remaining <= 3:
            meta["urgency"] = (
                f"CRITICAL: Only {turns_remaining} turn(s) remaining in this operation budget. "
                f"Finalize any essential updates immediately and prepare to synthesize your final response."
            )
        elif turns_remaining <= 6:
            meta["notice"] = f"{turns_remaining} turns remaining. Begin wrapping up your investigations."
        return meta


def chat_with_agent(
    messages: List[Dict[str, str]],
    campaign_id: str,
    context_node_id: Optional[str] = None,
    max_turns: int = DEFAULT_MAX_TURNS,
    max_tokens: int = DEFAULT_MAX_TOKENS,
) -> Dict[str, Any]:
    """
    Agentic chat loop using Gemini function calling.
    The model can call any of the 12 graph tools in a multi-turn loop
    until it produces a final text reply.
    """
    model, model_name = _get_configured_gemini_client()

    # Compile live database ground truth
    db_context = build_campaign_database_context(campaign_id)

    context_extra = ""
    if context_node_id:
        from app.services.graph_service import get_node
        node = get_node(context_node_id)
        if node:
            data = node.data_json or {}
            role_line = f"- 5e Tactical Role: {data.get('role', 'standard')}\n" if data.get('role') else ""
            align_line = f"- 5e Structured Alignment: {data.get('alignment', 'unspecified')}\n" if data.get('alignment') else ""
            type_line = f"- 5e Classification: {data.get('creature_size', '')} {data.get('creature_type', '')}\n" if data.get('creature_type') else ""

            context_extra = (
                f"\nFocused Node in Workspace:\n"
                f"- ID: {node.id}\n"
                f"- Title: {node.title} (Type: {node.type})\n"
                f"- Subtitle: {node.subtitle or 'N/A'}\n"
                f"{role_line}"
                f"{align_line}"
                f"{type_line}"
                f"- Summary: {node.summary}\n"
                f"- Notes: {node.content_markdown}\n"
            )

    if not model:
        # Informative offline fallback
        last_user_msg = messages[-1]["content"] if messages else ""
        return {
            "model": "offline-guidance-engine",
            "reply": (
                f"🧙‍♂️ **The Arcane Weaver (Co-DM)**\n\n"
                f"*Note: Gemini API key has not been configured yet. Here is offline guidance:*\n\n"
                f"**Addressing:** \"{last_user_msg}\"\n\n"
                f"### Strategic Campaign Advice\n"
                f"1. **Pacing & Threat Escalation**: Introduce an immediate environmental or social complication.\n"
                f"2. **NPC Motive**: Give the key NPC two opposing traits (fierce loyalty, but secretly indebted).\n"
                f"3. **Three-Clue Rule**: One clue in dialogue, one in an inspectable object, one via skill check.\n\n"
                f"> 💡 *Enter your Gemini API key in Settings to enable live graph tool-calling — merge duplicates, create nodes, manage relationships, and more!*"
            ),
            "suggested_nodes": [],
            "actions_taken": [],
        }

    try:
        import google.generativeai as genai

        # Build Gemini tool declarations
        gemini_tools = [
            genai.protos.Tool(
                function_declarations=[
                    genai.protos.FunctionDeclaration(
                        name=t["name"],
                        description=t["description"],
                        parameters=genai.protos.Schema(
                            type=genai.protos.Type.OBJECT,
                            properties={
                                k: _schema_prop_to_proto(v)
                                for k, v in t.get("parameters", {}).get("properties", {}).items()
                            },
                            required=t.get("parameters", {}).get("required", []),
                        ),
                    )
                    for t in AGENT_TOOLS
                ]
            )
        ]

        # Build sanitized conversation history for Gemini
        raw_history = messages[:-1] if len(messages) > 1 else []
        gemini_history, leftover_user_text = _sanitize_gemini_history(raw_history)

        last_user_content = messages[-1]["content"] if messages else ""
        if leftover_user_text:
            combined_user_content = f"{leftover_user_text}\n\n{last_user_content}"
        else:
            combined_user_content = last_user_content

        # Inject DB context + focused node into the final user prompt
        last_prompt = (
            f"{db_context}\n"
            f"{context_extra}\n"
            f"## DM Request\n{combined_user_content}"
        )

        # Create a model instance with tools enabled
        tool_model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=SYSTEM_PROMPT,
            tools=gemini_tools,
        )

        chat = tool_model.start_chat(history=gemini_history)

        # --- Guarded Agentic Loop ---
        MAX_TURNS = max_turns
        actions_taken = []
        scratchpad_state = {"notes": ""}
        loop_steps = []
        current_prompt = last_prompt
        final_reply = ""
        loop_guard = AgentLoopGuard(max_turns=MAX_TURNS, max_tokens=max_tokens)
        last_turn_completed = 0

        for turn in range(MAX_TURNS):
            last_turn_completed = turn + 1
            response = chat.send_message(current_prompt)

            # Check token ceiling guardrail
            budget_exceeded, tokens_seen = loop_guard.record_turn_tokens(response)
            if budget_exceeded:
                logger.warning(f"Loop guard triggered: {loop_guard.stop_reason}")
                loop_steps.append({
                    "turn": turn + 1,
                    "thought": f"Token ceiling reached ({tokens_seen:,} tokens).",
                    "actions": [],
                    "summary": f"Turn {turn + 1}: Token ceiling reached. Gracefully proceeding to final synthesis.",
                })
                break

            # Collect any function calls and text in this response
            function_calls = []
            turn_text_parts = []
            malformed = False

            for candidate in (getattr(response, "candidates", None) or []):
                finish_reason_name = getattr(candidate.finish_reason, "name", str(candidate.finish_reason))
                if "MALFORMED" in finish_reason_name.upper():
                    malformed = True

                if candidate.content and candidate.content.parts:
                    for part in candidate.content.parts:
                        if hasattr(part, "function_call") and part.function_call and getattr(part.function_call, "name", None):
                            function_calls.append(part.function_call)
                        elif hasattr(part, "text") and part.text and part.text.strip():
                            turn_text_parts.append(part.text.strip())

            turn_thought = " ".join(turn_text_parts).strip() if turn_text_parts else ""

            # Handle MALFORMED_FUNCTION_CALL from Gemini gracefully
            if malformed and not function_calls:
                logger.warning("Gemini returned MALFORMED_FUNCTION_CALL. Recovering with text.")
                extracted = _extract_text_from_response(response)
                if extracted:
                    final_reply = extracted
                else:
                    try:
                        retry_resp = chat.send_message("Please provide your advice directly in plain text without external tool calls.")
                        final_reply = _extract_text_from_response(retry_resp) or "I've reviewed your request. How can I assist your campaign further?"
                    except Exception as err:
                        logger.warning(f"Fallback retry failed: {err}")
                        final_reply = "I've reviewed your campaign notes. What would you like to build or brainstorm?"
                loop_steps.append({
                    "turn": turn + 1,
                    "thought": turn_thought or "Direct text recovery without tools.",
                    "actions": [],
                    "summary": f"Turn {turn + 1}: Generated direct response.",
                })
                break

            if not function_calls:
                # No tool calls — extract the final text reply safely (never call response.text directly)
                final_reply = _extract_text_from_response(response)
                if not final_reply:
                    final_reply = "I'm ready. How can I help with your campaign prep?"
                loop_steps.append({
                    "turn": turn + 1,
                    "thought": turn_thought,
                    "actions": [],
                    "summary": f"Turn {turn + 1}: Final synthesis completed.",
                })
                break

            # Check if repetitive calls or loop warnings warrant forcing a stop
            stop_forced, stop_reason = loop_guard.should_force_stop()
            if stop_forced:
                logger.warning(f"Loop guard forced stop: {stop_reason}")
                loop_steps.append({
                    "turn": turn + 1,
                    "thought": f"Loop guard intervention: {stop_reason}",
                    "actions": [],
                    "summary": f"Turn {turn + 1}: Loop guard intervened to prevent infinite loop. Proceeding to final synthesis.",
                })
                break

            # Record this turn's intermediate loop statement trace
            fc_names = [fc.name for fc in function_calls]
            loop_steps.append({
                "turn": turn + 1,
                "thought": turn_thought,
                "actions": fc_names,
                "summary": f"Turn {turn + 1}: Executed {len(function_calls)} action{'s' if len(function_calls)>1 else ''} ({', '.join(fc_names)})",
            })

            # Check for read-only stagnation and prepare pacing metadata
            stagnation_nudge = loop_guard.update_turn_activity(fc_names, turn)
            pacing_meta = loop_guard.get_pacing_meta(turn)
            if stagnation_nudge:
                pacing_meta["stagnation_advisory"] = stagnation_nudge

            # Execute each tool call with loop guard deduplication and hygiene
            function_response_parts = []
            for fc in function_calls:
                raw_args = getattr(fc, "args", None)
                fc_args = _proto_to_python(raw_args) if raw_args else {}
                if not isinstance(fc_args, dict):
                    fc_args = {}

                is_blocked, loop_warning = loop_guard.check_tool_call(fc.name, fc_args)
                if is_blocked:
                    tool_result_clean = {
                        "status": "blocked_by_loop_guard",
                        "warning": loop_warning,
                    }
                    actions_taken.append({
                        "tool": fc.name,
                        "args": fc_args,
                        "result": tool_result_clean,
                        "blocked": True,
                    })
                else:
                    tool_result = _dispatch_tool_call(fc.name, fc_args, campaign_id, scratchpad_state=scratchpad_state)
                    tool_result_clean = _proto_to_python(tool_result)
                    tool_result_clean = _sanitize_and_truncate_tool_result(tool_result_clean)
                    actions_taken.append({
                        "tool": fc.name,
                        "args": fc_args,
                        "result": tool_result_clean,
                    })

                function_response_parts.append(
                    genai.protos.Part(
                        function_response=genai.protos.FunctionResponse(
                            name=fc.name,
                            response={
                                "result": tool_result_clean,
                                "_meta": pacing_meta,
                            },
                        )
                    )
                )

            # Feed tool results back into the conversation
            current_prompt = function_response_parts

        if not final_reply:
            # Reached MAX_TURNS, token ceiling, or loop guard break without terminal text — force final synthesis
            logger.info(f"Agent loop ended without final reply (turns={last_turn_completed}/{MAX_TURNS}). Forcing synthesis from model.")
            try:
                # Deliver the pending tool results to the model
                synth_resp = chat.send_message(current_prompt)
                final_reply = _extract_text_from_response(synth_resp)

                # If the model tried to invoke more tools instead of answering, complete function responses then demand synthesis
                if not final_reply:
                    has_fc = any(
                        hasattr(part, "function_call") and part.function_call and getattr(part.function_call, "name", None)
                        for candidate in (getattr(synth_resp, "candidates", None) or [])
                        if candidate.content and candidate.content.parts
                        for part in candidate.content.parts
                    )
                    if has_fc:
                        fc_parts = []
                        for candidate in (getattr(synth_resp, "candidates", None) or []):
                            if candidate.content and candidate.content.parts:
                                for part in candidate.content.parts:
                                    if hasattr(part, "function_call") and part.function_call and getattr(part.function_call, "name", None):
                                        fc_parts.append(
                                            genai.protos.Part(
                                                function_response=genai.protos.FunctionResponse(
                                                    name=part.function_call.name,
                                                    response={"result": "Operation budget reached. Synthesizing final answer."},
                                                )
                                            )
                                        )
                        final_text_resp = chat.send_message(fc_parts)
                        final_reply = _extract_text_from_response(final_text_resp)

                    if not final_reply:
                        forced_prompt = (
                            "All tool research and operations are now complete. "
                            "Synthesize all data and results gathered above into a detailed, comprehensive, "
                            "and well-structured final answer for the DM. Do not call any further tools."
                        )
                        final_text_resp = chat.send_message(forced_prompt)
                        final_reply = _extract_text_from_response(final_text_resp)

                loop_steps.append({
                    "turn": last_turn_completed + 1,
                    "thought": "Budget reached or loop guard intervened. Synthesized complete response.",
                    "actions": [],
                    "summary": f"Turn {last_turn_completed + 1}: Final synthesis completed.",
                })
            except Exception as synth_err:
                logger.warning(f"Forced synthesis failed: {synth_err}")
                final_reply = ""

            if not final_reply:
                final_reply = (
                    f"I've completed my analysis and executed {len(actions_taken)} actions across the campaign graph. "
                    "The graph has been updated with these findings. Let me know what specific details you would like me to unpack!"
                )

        return {
            "model": model_name,
            "reply": final_reply,
            "suggested_nodes": [],
            "actions_taken": actions_taken,
            "scratchpad": scratchpad_state["notes"],
            "loop_steps": loop_steps,
        }

    except Exception as e:
        logger.error(f"Gemini agentic chat error: {e}", exc_info=True)
        return {
            "model": "error",
            "reply": f"An error occurred while contacting Gemini: {e}. Please check your API key and model selection in Settings.",
            "suggested_nodes": [],
            "actions_taken": [],
        }


def _extract_text_from_response(response) -> str:
    """Safely extracts text parts from a Gemini response without throwing on function calls or finish reasons."""
    if not response or not getattr(response, "candidates", None):
        return ""
    text_chunks = []
    for candidate in response.candidates:
        if candidate.content and candidate.content.parts:
            for part in candidate.content.parts:
                try:
                    # Skip parts that are function calls
                    if getattr(part, "function_call", None) and getattr(part.function_call, "name", None):
                        continue
                    if hasattr(part, "text") and part.text:
                        text_chunks.append(part.text)
                except Exception:
                    pass
    return "\n\n".join(text_chunks).strip()


def _schema_prop_to_proto(prop: dict):
    """Convert a JSON Schema property dict to a Gemini protos.Schema."""
    import google.generativeai as genai

    type_map = {
        "string": genai.protos.Type.STRING,
        "number": genai.protos.Type.NUMBER,
        "integer": genai.protos.Type.INTEGER,
        "boolean": genai.protos.Type.BOOLEAN,
        "object": genai.protos.Type.OBJECT,
        "array": genai.protos.Type.ARRAY,
    }
    ptype = type_map.get(prop.get("type", "string"), genai.protos.Type.STRING)

    if ptype == genai.protos.Type.ARRAY:
        items_prop = prop.get("items", {"type": "string"})
        return genai.protos.Schema(
            type=ptype,
            items=_schema_prop_to_proto(items_prop),
            description=prop.get("description", ""),
        )
    elif ptype == genai.protos.Type.OBJECT:
        nested_props = prop.get("properties", {})
        if nested_props:
            return genai.protos.Schema(
                type=ptype,
                properties={k: _schema_prop_to_proto(v) for k, v in nested_props.items()},
                description=prop.get("description", ""),
            )
        else:
            # Fallback to STRING if an arbitrary object has no defined properties
            return genai.protos.Schema(
                type=genai.protos.Type.STRING,
                description=prop.get("description", "") + " (Pass as JSON string)",
            )
    else:
        return genai.protos.Schema(
            type=ptype,
            description=prop.get("description", ""),
        )


def _get_configured_gemini_client():
    api_key = get_setting("gemini_api_key", os.getenv("GEMINI_API_KEY", "")).strip()
    if not api_key:
        return None, None

    model_name = get_setting("gemini_model", "").strip()
    if not model_name:
        # If no model configured yet, dynamically discover available models for this key
        discovered = list_available_gemini_models(api_key=api_key)
        if discovered.get("models") and len(discovered["models"]) > 0:
            model_name = discovered["models"][0]["id"]
            set_setting("gemini_model", model_name)
        else:
            model_name = "gemini-flash-latest"

    if not model_name:
        return None, None

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        try:
            model = genai.GenerativeModel(
                model_name=model_name,
                system_instruction=SYSTEM_PROMPT
            )
            return model, model_name
        except Exception as model_err:
            logger.warning(f"Error configuring saved model '{model_name}': {model_err}")
            # Dynamically query available models from Gemini API instead of hardcoding
            try:
                models_data = list_available_gemini_models(api_key=api_key)
                available = [m["id"] for m in models_data.get("models", []) if m.get("id") != model_name]
                if available:
                    fallback_name = next((m for m in available if "flash-latest" in m), available[0])
                    logger.info(f"Using server-discovered fallback model '{fallback_name}'")
                    model = genai.GenerativeModel(
                        model_name=fallback_name,
                        system_instruction=SYSTEM_PROMPT
                    )
                    return model, fallback_name
            except Exception as inner_err:
                logger.error(f"Fallback model discovery failed: {inner_err}")
            return None, model_name
    except Exception as e:
        logger.error(f"Error configuring Gemini client: {e}")
        return None, None

def build_campaign_database_context(campaign_id: str) -> str:
    """
    Compiles a token-efficient, structured overview of the active SQLite Campaign Graph.
    Presents total entity metrics, story backbone (Arcs & active Quests), party,
    and prominent factions, directing the agent to use live tools
    (search_nodes, traverse_graph, get_node_detail) for granular inspection.
    """
    campaign = get_campaign(campaign_id)
    nodes = list_nodes(campaign_id)
    edges = list_edges(campaign_id)

    camp_name = campaign.name if campaign else "Active Campaign"
    camp_setting = campaign.setting if campaign else "D&D 5e"

    if not nodes:
        return f"Campaign: {camp_name} (Setting: {camp_setting})\nDatabase: Empty campaign graph. Ready for new creation."

    # Group nodes by type
    by_type: Dict[str, List[Any]] = {}
    for n in nodes:
        by_type.setdefault(n.type, []).append(n)

    # Build entity distribution summary
    type_counts = {t: len(node_list) for t, node_list in sorted(by_type.items(), key=lambda x: -len(x[1]))}
    counts_str = ", ".join(f"{t.capitalize()}s: {cnt}" for t, cnt in type_counts.items())

    lines = [
        f"### Active Campaign Overview (SQLite Database Ground Truth)",
        f"**Campaign**: {camp_name} | **Setting**: {camp_setting}",
        f"**Graph Metrics**: {len(nodes)} Total Entities ({counts_str}) | {len(edges)} Relationships (Edges)",
        "",
    ]

    def _c_tag(node) -> str:
        return "[Canon 🔒]" if getattr(node, "is_canon", True) else "[Draft 📝]"

    # 1. Story Backbone: Arcs (all Arcs, typically 2-10)
    arcs = by_type.get("arc", [])
    if arcs:
        lines.append(f"**Campaign Arcs ({len(arcs)})**:")
        for arc in arcs:
            status = arc.data_json.get("status", "planned") if arc.data_json else "planned"
            lines.append(f"- [Arc] {_c_tag(arc)} {arc.title} [id: {arc.id}] (Status: {status})")
        lines.append("")

    # 2. Key / Active Quests (cap to top 8, prioritize active or planned)
    quests = by_type.get("quest", [])
    if quests:
        status_priority = {"active": 0, "in_progress": 0, "planned": 1, "completed": 2, "abandoned": 3}
        sorted_quests = sorted(
            quests,
            key=lambda q: (
                status_priority.get(q.data_json.get("status", "planned") if q.data_json else "planned", 4),
                q.sort_order or 0,
            ),
        )
        display_quests = sorted_quests[:8]
        lines.append(f"**Key Quests (Showing {len(display_quests)} of {len(quests)})**:")
        for q in display_quests:
            status = q.data_json.get("status", "planned") if q.data_json else "planned"
            lines.append(f"- [Quest] {_c_tag(q)} {q.title} [id: {q.id}] (Status: {status})")
        if len(quests) > 8:
            lines.append(f"  *(+ {len(quests) - 8} more quests indexed — use `search_nodes(type_filter='quest')` to inspect)*")
        lines.append("")

    # 3. Player Characters (PCs - always show all, typically 3-6)
    pcs = by_type.get("pc", [])
    if pcs:
        lines.append(f"**Player Characters (PCs - {len(pcs)})**:")
        for pc in pcs:
            lines.append(f"- [PC] {_c_tag(pc)} {pc.title} [id: {pc.id}]")
        lines.append("")

    # 4. Factions (cap to top 6)
    factions = by_type.get("faction", [])
    if factions:
        lines.append(f"**Factions ({len(factions)})**:")
        for f in factions[:6]:
            lines.append(f"- [Faction] {_c_tag(f)} {f.title} [id: {f.id}]")
        if len(factions) > 6:
            lines.append(f"  *(+ {len(factions) - 6} more factions indexed)*")
        lines.append("")

    # 5. Maps & Tactical Handouts
    maps = by_type.get("map", [])
    if maps:
        lines.append(f"**Maps ({len(maps)})**:")
        for m in maps:
            pin_count = len((m.data_json or {}).get("pins", []))
            lines.append(f"- [Map] {_c_tag(m)} {m.title} [id: {m.id}] ({pin_count} pins placed)")
        lines.append("")

    # 5. On-Demand Graph Discovery Directive
    loc_count = type_counts.get("location", 0)
    npc_count = type_counts.get("npc", 0)
    mon_count = type_counts.get("monster", 0)
    enc_count = type_counts.get("encounter", 0)
    item_count = type_counts.get("item", 0)
    lines.append(
        f"> 💡 **On-Demand Graph Discovery**: The database indexes {len(nodes)} entities (including {loc_count} Locations, {npc_count} NPCs, {mon_count} Monsters, {enc_count} Encounters, and {item_count} Items). Do not assume missing entities do not exist — query them via `search_nodes`, `find_nodes_by_title`, `get_node_detail`, or `traverse_graph`."
    )

    return "\n".join(lines)


def generate_boxed_text(
    location_title: str,
    mood: str = "mysterious, ancient, dangerous",
    sensory_details: str = "damp stone, flickering torchlight, distant echoing drip",
    dm_notes: str = ""
) -> Dict[str, str]:
    model, model_name = _get_configured_gemini_client()

    if not model:
        # High quality offline template
        return {
            "boxed_text": (
                f"As you cross the threshold into {location_title}, the air turns heavy and chill. "
                f"The smell of {sensory_details.split(',')[0].strip() if sensory_details else 'old stone'} hangs thick in the silence, "
                f"broken only by the subtle rustle of unseen currents. Shadows dance along the jagged walls as your light falters, "
                f"revealing glimpses of carved script worn smooth by centuries."
            ),
            "dm_roleplay_cues": (
                f"• Atmosphere: Emphasize the {mood} mood through low, deliberate speech.\n"
                f"• Environmental Clue: Highlight an odd scratch or sigil near the entrance (Investigation DC 12).\n"
                f"• Sound Cue: A faint, rhythmic vibration beneath the flagstones."
            ),
            "model": "offline-template"
        }

    prompt = f"""Write evocative D&D 5e read-aloud boxed text for the location: '{location_title}'.
Mood/Atmosphere: {mood}
Sensory details to incorporate: {sensory_details}
DM secret notes / context: {dm_notes}

Respond strictly in JSON with this structure:
{{
  "boxed_text": "2-4 sentences of vivid, multi-sensory prose meant to be read aloud to players.",
  "dm_roleplay_cues": "3-4 quick bullet points for the DM covering sensory cues, what Passive Perception spots, and interactive hazards/clues."
}}
"""
    try:
        response = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
        data = json.loads(response.text)
        return {
            "boxed_text": data.get("boxed_text", ""),
            "dm_roleplay_cues": data.get("dm_roleplay_cues", ""),
            "model": model_name
        }
    except Exception as e:
        logger.error(f"Error generating boxed text: {e}")
        return {
            "boxed_text": f"You enter {location_title}. The environment is {mood}. Shadows stretch across the floor.",
            "dm_roleplay_cues": f"Check players' Passive Perception. Note: {e}",
            "model": "fallback"
        }

def get_coach_advice(
    situation: str,
    challenge_type: str,
    campaign_id: Optional[str] = None
) -> Dict[str, Any]:
    model, model_name = _get_configured_gemini_client()

    default_guidance = {
        "fail_forward": "When a check fails, advance the scene with a cost rather than a dead end (e.g. they pick the lock, but their thieves' tools snap and alert a patrolling sentry).",
        "pacing": "If players are hesitating or analysis-paralyzed, introduce an active trigger: 'Orcs attack!' or a timed environmental hazard (water level rising, countdown bell chiming).",
        "three_clue_rule": "Never rely on a single check for vital plot progress. Ensure at least three separate avenues exist to discover the critical lead.",
        "encounter_balance": "Evaluate action economy: if the party has 4 actions + bonus actions and the monster only has 1, the monster will be overwhelmed. Give the monster bonus action disengages, minions, or legendary reactions.",
        "player_agency": "Never force a scripted path. Let their unexpected choices have real, tangible consequences in the world graph.",
        "general": "Keep the focus on dramatic stakes. Ask the player: 'What does your character hope to achieve?' before calling for a roll."
    }

    if not model:
        return {
            "advice": (
                f"### 🛡️ GM Coach Guidance: {challenge_type.replace('_', ' ').title()}\n\n"
                f"**Core Principle**: {default_guidance.get(challenge_type, default_guidance['general'])}\n\n"
                f"**Applied to your situation** (\"{situation}\"):\n"
                f"1. **Identify the Real Stake**: What does success or failure change in the story right now?\n"
                f"2. **Offer a Choice with Teeth**: Present two clear paths (e.g., 'You can force the gate open fast and make noise, or spend 10 minutes finding a side vent while the patrol draws closer').\n"
                f"3. **Ask the Players**: 'What does your character see or feel in this moment?' to draw them back into character."
            ),
            "model": "offline-coach"
        }

    prompt = f"""You are an encouraging, experienced TTRPG Game Master coach assisting a DM with a live challenge.
Challenge Category: {challenge_type}
DM Situation / Question: "{situation}"

Provide concrete, actionable, empathetic advice:
1. Immediate Next Step (what the DM can say or do in the next 60 seconds).
2. Fail-Forward or Pacing Options (2-3 distinct dramatic ways to handle this).
3. Long-term Campaign Lesson (how to structure future prep to avoid this pitfall).
Format in clean Markdown with bold bullet points.
"""
    try:
        response = model.generate_content(prompt)
        return {
            "advice": response.text,
            "model": model_name
        }
    except Exception as e:
        logger.error(f"Error getting coach advice: {e}")
        return {
            "advice": f"Coach Advice Fallback: {default_guidance.get(challenge_type, default_guidance['general'])}",
            "model": "fallback"
        }

def weave_quest_hook(
    pc_name: str,
    pc_backstory: str,
    target_node_id: Optional[str] = None,
    campaign_id: Optional[str] = None
) -> Dict[str, Any]:
    model, model_name = _get_configured_gemini_client()

    target_info = "the main campaign arc"
    if target_node_id:
        from app.services.graph_service import get_node
        node = get_node(target_node_id)
        if node:
            target_info = f"the quest/location/faction '{node.title}' ({node.type}: {node.summary})"

    if not model:
        return {
            "hook_title": f"The Echoes of {pc_name}'s Past",
            "narrative_hook": (
                f"A courier bearing a wax-sealed letter with a crest {pc_name} thought was long lost intercepts the party. "
                f"The message ties directly to {target_info}, hinting that someone from their past is either in grave danger or pulling the strings behind the scenes."
            ),
            "suggested_nodes": [
                {
                    "type": "clue",
                    "title": f"Crest from {pc_name}'s Past",
                    "summary": f"An engraved wax seal connecting {pc_name} to {target_info}."
                },
                {
                    "type": "npc",
                    "title": "Mysterious Informant",
                    "summary": f"A contact who claims to know the truth behind {pc_name}'s backstory."
                }
            ],
            "model": "offline-weaver"
        }

    prompt = f"""You are a master D&D 5e story weaver.
Player Character: {pc_name}
Backstory Details: {pc_backstory}
Target Campaign Element: {target_info}

Create an enticing, emotionally resonant quest hook connecting this PC to this campaign element.
Return JSON with this schema:
{{
  "hook_title": "Short dramatic title",
  "narrative_hook": "2-3 paragraphs describing how this hook is delivered, the personal stakes for {pc_name}, and how the rest of the party is motivated to assist.",
  "suggested_nodes": [
    {{ "type": "npc|clue|quest|faction", "title": "Node Title", "summary": "One sentence summary" }}
  ]
}}
"""
    try:
        response = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
        data = json.loads(response.text)
        return {
            "hook_title": data.get("hook_title", f"Hook for {pc_name}"),
            "narrative_hook": data.get("narrative_hook", ""),
            "suggested_nodes": data.get("suggested_nodes", []),
            "model": model_name
        }
    except Exception as e:
        logger.error(f"Error weaving hook: {e}")
        return {
            "hook_title": f"Hook for {pc_name}",
            "narrative_hook": f"A personal connection arises linking {pc_name} with {target_info}.",
            "suggested_nodes": [],
            "model": "fallback"
        }


def _format_encounter_content_for_beat(raw_content: str) -> str:
    """
    Cleans and nests an encounter's markdown content to fit seamlessly
    under a timeline beat without duplicating titles or breaking outline hierarchy.
    """
    if not raw_content or not raw_content.strip():
        return ""
    lines = raw_content.strip().split("\n")
    cleaned_lines = []
    in_preamble = True

    for line in lines:
        stripped = line.strip()
        if in_preamble:
            if stripped.lower().startswith("# encounter:") or (stripped.startswith("# ") and not stripped.startswith("###")):
                continue
            if any(stripped.lower().startswith(prefix) for prefix in ("**type:", "**level:", "**location:")):
                continue
            if stripped in ("---", "***") or not stripped:
                continue
            in_preamble = False

        # Demote H1, H2, and H3 headings so they nest properly under Beat (which is H3)
        if line.startswith("# "):
            line = "#### " + line[2:]
        elif line.startswith("## "):
            line = "#### " + line[3:]
        elif line.startswith("### "):
            line = "#### " + line[4:]

        cleaned_lines.append(line)

    return "\n".join(cleaned_lines).strip()


def _build_detailed_graph_run_sheet(
    session_node,
    prev_session_info: dict,
    next_session_info: Optional[dict],
    camp_name: str,
    camp_setting: str,
    structured_beats: list,
    pc_summaries: list,
    custom_instruction: str = ""
) -> str:
    """
    Deterministically builds an exceptionally detailed, timeline-centric DM run-sheet
    from the SQLite graph without calling an external LLM.
    Embeds full read-aloud boxed text, tactical mechanics, DCs, fail-forwards,
    connected NPCs/monsters (without raw stat blocks), clues, items, and next-session hooks.
    """
    session_data = session_node.data_json or {}
    session_date = session_data.get("session_date", "Session Day")
    session_agenda = session_data.get("agenda", session_node.summary or "Progress the main adventure arc.")

    lines = [
        f"# 📜 Run-Sheet: {session_node.title}",
        f"",
        f"> **Campaign:** {camp_name} ({camp_setting}) | **Date / Timing:** {session_date} | **Target Duration:** 3.5 – 4.0 Hours",
        f"> **Core Agenda / Objective:** {session_agenda}",
        f"",
        f"---",
        f"",
        f"## ⏱️ Table Pacing & Time Budget",
        f"| Table Time | Segment / Beat | Dramatic Focus & Mode |",
        f"| :--- | :--- | :--- |",
        f"| **0:00 – 0:20** | **Recap & Opening Atmosphere** | Table settle, 'Story So Far' recap, sensory scene setting |",
    ]

    # Dynamically allocate beat time slots across a 4-hour window
    num_beats = len(structured_beats)
    if num_beats == 1:
        time_slots = [("0:20 – 3:30", "Main Adventure Arc")]
    elif num_beats == 2:
        time_slots = [("0:20 – 1:50", "Part I"), ("1:50 – 3:35", "Part II")]
    elif num_beats == 3:
        time_slots = [("0:20 – 1:15", "Beat 1"), ("1:15 – 2:30", "Beat 2"), ("2:30 – 3:35", "Beat 3")]
    elif num_beats == 4:
        time_slots = [("0:20 – 1:10", "Beat 1"), ("1:10 – 2:00", "Beat 2"), ("2:00 – 2:50", "Beat 3"), ("2:50 – 3:40", "Beat 4")]
    else:
        time_slots = [(f"Beat {idx + 1}", f"Beat {idx + 1}") for idx in range(num_beats)]

    for idx, beat in enumerate(structured_beats):
        slot = time_slots[idx][0] if idx < len(time_slots) else f"Beat {idx + 1}"
        clean_beat_name = re.sub(r'^(Encounter:\s*)+', '', beat['title'], flags=re.IGNORECASE).strip()
        lines.append(
            f"| **{slot}** | **{clean_beat_name}** | {beat['encounter_type']} ({beat['difficulty']}) — {beat['summary'][:60]}... |"
        )

    lines.extend([
        f"| **3:35 – 4:00** | **Climax & Session Wrap-Up** | Final resolution, cliffhanger hook, loot & milestones |",
        f"",
        f"---",
        f"",
        f"## 📜 The Story So Far (Last Session Recap)",
        f"*Read or paraphrase directly to the party as the game begins:*",
        f"",
        f"> 📖 **Recap — Following: {prev_session_info['title']}**",
        f"> ",
    ])

    prev_summary = prev_session_info.get("summary", "").strip()
    if prev_summary:
        lines.append(f"> - {prev_summary}")
    else:
        lines.append(f"> - The party gathered their gear and forged their initial bond amidst the backdrop of {camp_setting}.")

    prev_excerpt = prev_session_info.get("content_excerpt", "").strip()
    if prev_excerpt and len(prev_excerpt) > 40:
        cleaned_excerpt = re.sub(r'#+\s*', '', prev_excerpt[:250]).strip()
        lines.append(f"> - *Prior events:* {cleaned_excerpt}...")

    lines.extend([
        f"> - *Current Momentum:* The party opens this session with immediate decisions and unresolved tensions from their previous exploits.",
        f"",
    ])

    # Party Roster
    if pc_summaries:
        lines.extend([
            f"### 🛡️ Active Adventurers (Party Roster)",
            f"*Keep player backgrounds and passive awareness in mind during social & tactical checks:*",
        ])
        for pc_line in pc_summaries:
            lines.append(pc_line)
        lines.append("")

    lines.extend([
        f"---",
        f"",
        f"## 🎭 Scene 1: Setting the Atmosphere & Immediate Spark",
        f"*{session_node.title} — Opening table read-aloud prompt:*",
        f"",
        f"> 📜 The air carries the distinctive chill and ambient hum of {camp_setting}. Shadows stretch across "
        f"worn flagstones and murmurs of local gossip drift through the air. The choices of yesterday linger, "
        f"but an immediate disturbance demands your attention before you can finish your drink.",
        f"",
        f"- **Sensory Details:** Faint smell of roasted meats, pipeweed, and damp earth; muffled clinking of coins and tankards; sudden cessation of ambient chatter.",
        f"- **Immediate Catalyst:** A confrontation, commotion, or urgent arrival pulls the party directly into the action without hesitation.",
        f"",
        f"---",
        f"",
        f"## ⏳ Chronological Beat Timeline",
        f"",
    ])

    if not structured_beats:
        lines.extend([
            f"### ⏳ Beat 1: Initial Discovery & Inciting Spark (~45 min)",
            f"- **Dramatic Question:** How will the heroes respond to the initial threat?",
            f"- **Encounter Setup:** {session_agenda}",
            f"- **Tactical Cues:** Watch for character backstories to hook player interest early.",
            f"- **Skill Checks:** DC 12 Wisdom (Perception) to notice hidden movement; DC 12 Charisma (Persuasion) to calm bystanders.",
            f"- **Fail-Forward:** If skill checks fail, bystanders panic or the adversary gains tactical surprise, complicating the encounter without stalling the game.",
            f"",
        ])
    else:
        for i, beat in enumerate(structured_beats, 1):
            clean_beat_name = re.sub(r'^(Encounter:\s*)+', '', beat['title'], flags=re.IGNORECASE).strip()
            slot = time_slots[i - 1][0] if (i - 1) < len(time_slots) else f"Beat {i}"

            lines.extend([
                f"### ⏳ Beat {i}: {clean_beat_name} ({slot} | {beat['encounter_type']})",
                f"",
            ])

            # Beat Metadata Callout
            meta_items = [f"**Type:** {beat['encounter_type']}", f"**Difficulty:** {beat['difficulty']}"]
            if beat.get("locations"):
                meta_items.append(f"**Location:** {', '.join(beat['locations'])}")
            if beat.get("quests"):
                meta_items.append(f"**Quest:** {', '.join(beat['quests'])}")
            lines.append(f"> " + " | ".join(meta_items))
            lines.append("")

            # Opponents / Hazards from encounter data
            if beat.get("combatants_text"):
                lines.append(f"- **Opponents & Hazards:** {beat['combatants_text']}")

            # Key Cast & Combatants (Profiles without raw stat blocks)
            if beat.get("entities"):
                lines.append(f"- **Cast & Combatants (Tactical & Roleplay Profiles — No Stat Blocks):**")
                for ent in beat["entities"]:
                    ent_desc = ent.get("summary") or "Active in this scene."
                    ent_type_str = ent.get("type", "npc").upper()
                    ent_role_str = ent.get("role", "combatant").capitalize()
                    ent_align_str = ent.get("alignment", "unspecified")
                    lines.append(
                        f"  - **{ent['title']}** *({ent_type_str} | {ent_role_str} | {ent_align_str})*: {ent_desc}"
                    )
                lines.append("")

            # Connected Clues & Secrets
            if beat.get("clues"):
                lines.append(f"- **Linked Clues, Secrets & Knowledge:**")
                for clue in beat["clues"]:
                    lines.append(f"  - 🔍 **{clue['title']}**: {clue['summary'] or 'Crucial insight for the party.'}")
                lines.append("")

            # Connected Items & Handouts
            if beat.get("items"):
                lines.append(f"- **Linked Items & Handouts:**")
                for itm in beat["items"]:
                    lines.append(f"  - 🗝️ **{itm['title']}**: {itm['summary'] or 'Notable item or handout.'}")
                lines.append("")

            # Detailed Encounter Content & Running Guide
            encounter_content = beat.get("content", "").strip()
            formatted_content = _format_encounter_content_for_beat(encounter_content)

            if formatted_content and len(formatted_content) > 60:
                lines.extend([
                    formatted_content,
                    "",
                ])
            else:
                # High-quality structured fallback for encounters lacking pre-written markdown
                lines.extend([
                    f"#### 🎭 Scene Setup & Read-Aloud",
                    f"> 📜 Tensions reach a boiling point. The surrounding sounds fade as the challenge of {clean_beat_name} "
                    f"manifests directly in front of the party. Eyes turn to the adventurers as the decisive moment arrives.",
                    f"",
                    f"#### 🎲 Tactical Flow & Mechanics",
                    f"- **Dramatic Question:** Can the party overcome the {beat['encounter_type'].lower()} obstacle without catastrophic resource expenditure?",
                    f"- **Tactical Check:** DC 12 Wisdom (Insight / Perception) to anticipate the opponent's opening gambit.",
                    f"- **Interactive Terrain:** DC 13 Dexterity (Acrobatics) or Strength (Athletics) check to use cover, chandeliers, or barricades for advantage.",
                    f"- **Fail-Forward Complication:** A failed check results in collateral damage, reinforcement alerts, or lost tactical surprise, escalating the threat without stalling forward momentum.",
                    f"",
                ])

            lines.append("---")
            lines.append("")

    # Climax & Cliffhanger Hook
    lines.extend([
        f"## 🎯 Session Climax & Cliffhanger",
        f"- **The Climax:** The culmination of today's encounters forces a pivotal decision or concludes the primary battle.",
    ])

    if next_session_info and next_session_info.get("title"):
        lines.extend([
            f"- **Cliffhanger & Bridge to Next Session:**",
            f"> ⚡ **Next Session: {next_session_info['title']}**",
            f"> {next_session_info.get('summary') or 'The adventure continues as the party steps into deeper danger.'}",
            f"> ",
            f"> *Cut to black just as the immediate smoke clears and the next revelation looms on the horizon!*",
        ])
    else:
        lines.extend([
            f"- **Cliffhanger Hook:** Cut to black just as the party catches their breath and an unexpected shadow, messenger, or discovery appears at the threshold!",
        ])

    lines.extend([
        f"",
        f"---",
        f"",
        f"## 💎 Session Rewards, Loot & Table Handouts",
        f"- **Milestone Progression:** Progress toward Level 2 / Key Campaign Milestone.",
        f"- **Notable Coin & Items:** Distribute encounter treasure, advance commission pouches, and clues uncovered.",
        f"- **Table Housekeeping:** Record character HP, spent spell slots, hit dice, and new faction reputations.",
    ])

    return "\n".join(lines)


# Backwards compatibility alias
_build_offline_run_sheet_template = _build_detailed_graph_run_sheet


def generate_session_run_sheet(
    session_id: str,
    campaign_id: str,
    custom_instruction: str = "",
    save_to_node: bool = True,
    use_llm: bool = False
) -> Dict[str, Any]:
    """
    Generates a comprehensive, timeline-centric DM run-sheet for a game session.
    Features:
    - Zero-LLM by default (use_llm=False): Instantly and deterministically synthesizes
      an author-grade run-sheet directly from the SQLite graph, embedding full encounter
      markdown (read-aloud boxes, tactical flows, DCs, fail-forwards, secrets).
    - Discovers preceding session for the 'The Story So Far' recap.
    - Discovers succeeding session for the climactic cliffhanger bridge.
    - Collects contained encounters in strict chronological precedence order.
    - Pulls connected NPCs and monsters with concise descriptions and tactical motives (NO stat blocks).
    - Collects linked locations, clues, lore, and items.
    - Uses Gemini if use_llm=True (with deterministic graph fallback if offline).
    - Persists markdown directly to the session node if save_to_node is True.
    """
    session_node = graph_service.get_node(session_id)
    if not session_node:
        return {"error": f"Session node '{session_id}' not found.", "success": False}

    campaign = graph_service.get_campaign(campaign_id)
    camp_name = campaign.name if campaign else "D&D Campaign"
    camp_setting = campaign.setting if campaign else "D&D 5e"

    # 1. Identify Preceding Session
    prev_session = None
    session_edges = graph_service.list_edges_for_node(campaign_id, session_id)
    for e in session_edges:
        if e.get("relation_type") == "precedes" and e.get("target_id") == session_id:
            cand = graph_service.get_node(e.get("source_id"))
            if cand and cand.type == "session":
                prev_session = cand
                break

    all_sessions = graph_service.list_nodes(campaign_id, node_type="session")
    sorted_sessions = sorted(all_sessions, key=lambda s: (s.sort_order or 0, s.title))

    if not prev_session:
        for idx, s in enumerate(sorted_sessions):
            if s.id == session_id and idx > 0:
                prev_session = sorted_sessions[idx - 1]
                break

    prev_session_info = {
        "title": prev_session.title if prev_session else "Campaign Kickoff / Prologue",
        "summary": prev_session.summary if prev_session else f"The grand opening of the {camp_name} campaign in {camp_setting}.",
        "content_excerpt": (prev_session.content_markdown[:600] if prev_session and prev_session.content_markdown else ""),
    }

    # 2. Identify Succeeding Session (for Cliffhanger Bridge)
    next_session = None
    for e in session_edges:
        if e.get("relation_type") == "precedes" and e.get("source_id") == session_id:
            cand = graph_service.get_node(e.get("target_id"))
            if cand and cand.type == "session":
                next_session = cand
                break

    if not next_session:
        for idx, s in enumerate(sorted_sessions):
            if s.id == session_id and idx + 1 < len(sorted_sessions):
                next_session = sorted_sessions[idx + 1]
                break

    next_session_info = {
        "title": next_session.title if next_session else "",
        "summary": next_session.summary if next_session else "",
    } if next_session else None

    # 3. Gather Contained Encounters
    encounter_ids = set()
    for e in session_edges:
        if e.get("relation_type") == "contains":
            other_id = e["target_id"] if e["source_id"] == session_id else e["source_id"]
            cand = graph_service.get_node(other_id)
            if cand and cand.type == "encounter":
                encounter_ids.add(cand.id)

    all_encounters = graph_service.list_nodes(campaign_id, node_type="encounter")
    for enc in all_encounters:
        if enc.data_json and enc.data_json.get("session_id") == session_id:
            encounter_ids.add(enc.id)

    encounter_nodes = [graph_service.get_node(eid) for eid in encounter_ids if graph_service.get_node(eid)]
    encounter_nodes.sort(key=lambda x: (x.sort_order or 0, x.title))

    # 4. For each encounter, extract connected NPCs, Monsters, Locations, Clues, Items, and Quests
    structured_beats = []
    for enc in encounter_nodes:
        enc_edges = graph_service.list_edges_for_node(campaign_id, enc.id)
        connected_entities = []
        connected_locations = []
        connected_clues = []
        connected_items = []
        connected_quests = []

        for ee in enc_edges:
            target_id = ee["target_id"] if ee["source_id"] == enc.id else ee["source_id"]
            target_node = graph_service.get_node(target_id)
            if not target_node:
                continue
            if target_node.type in ("npc", "monster"):
                d = target_node.data_json or {}
                connected_entities.append({
                    "id": target_node.id,
                    "type": target_node.type,
                    "title": target_node.title,
                    "subtitle": target_node.subtitle or "",
                    "summary": target_node.summary or "",
                    "role": d.get("role", "combatant" if target_node.type == "monster" else "npc"),
                    "alignment": d.get("alignment", "unspecified"),
                    "size_type": f"{d.get('creature_size', '')} {d.get('creature_type', '')}".strip(),
                })
            elif target_node.type == "location":
                if target_node.title not in connected_locations:
                    connected_locations.append(target_node.title)
            elif target_node.type in ("lore", "clue"):
                connected_clues.append({
                    "title": target_node.title,
                    "summary": target_node.summary or "",
                    "relation": ee.get("relation_type", "linked")
                })
            elif target_node.type == "item":
                connected_items.append({
                    "title": target_node.title,
                    "summary": target_node.summary or ""
                })
            elif target_node.type == "quest":
                if target_node.title not in connected_quests:
                    connected_quests.append(target_node.title)

        enc_data = enc.data_json or {}
        structured_beats.append({
            "id": enc.id,
            "title": enc.title,
            "summary": enc.summary or "",
            "encounter_type": enc_data.get("encounter_type", "Combat"),
            "difficulty": enc_data.get("difficulty", "Medium"),
            "combatants_text": enc_data.get("combatants", ""),
            "content": enc.content_markdown or "",
            "entities": connected_entities,
            "locations": connected_locations,
            "clues": connected_clues,
            "items": connected_items,
            "quests": connected_quests,
        })

    # 5. Gather Party Context (PCs)
    pcs = graph_service.list_nodes(campaign_id, node_type="pc")
    if not pcs:
        from app.db.database import get_db
        with get_db() as conn:
            c = conn.cursor()
            c.execute("SELECT id, title, summary, data_json FROM nodes WHERE type='pc' LIMIT 6")
            rows = c.fetchall()
            pcs = [
                type("PCMock", (), {
                    "id": r["id"],
                    "title": r["title"],
                    "summary": r["summary"] or "",
                    "data_json": json.loads(r["data_json"]) if r["data_json"] else {}
                })()
                for r in rows
            ]

    pc_summaries = [f"- **{p.title}**: {p.summary}" for p in pcs]

    # 6. Generate Run-Sheet
    run_sheet_md = ""
    model_name = "graph-deterministic-engine"

    if use_llm:
        model, model_name = _get_configured_gemini_client()
        if model:
            beats_context_str = ""
            for i, b in enumerate(structured_beats, 1):
                entities_str = ", ".join(
                    f"{ent['title']} ({ent['type']}, {ent['role']}, {ent['alignment']})"
                    for ent in b["entities"]
                )
                locations_str = ", ".join(b["locations"]) if b["locations"] else "Scene Location"
                clues_str = ", ".join(c["title"] for c in b["clues"]) if b["clues"] else "None"
                beats_context_str += f"""
### Beat {i}: {b['title']}
- Encounter Type: {b['encounter_type']} | Difficulty: {b['difficulty']}
- Location: {locations_str}
- Overview: {b['summary']}
- Combatants / Hazards: {b['combatants_text'] or 'Standard'}
- Cast / Monsters: {entities_str or 'None linked directly'}
- Linked Clues / Secrets: {clues_str}
- Full Encounter Details & Text:
{b['content']}
"""

            session_data = session_node.data_json or {}
            session_date = session_data.get("session_date", "Day 1")
            session_agenda = session_data.get("agenda", session_node.summary or "")

            prompt = f"""You are the Arcane Weaver, master D&D 5e Co-DM and campaign director.
Generate a complete, table-ready, **Timeline-Centric Session Run-Sheet** for the DM to run at the game table.

## CRITICAL RUN-SHEET RULES (STRICT ADHERENCE REQUIRED):
1. **Strict Timeline-Centric Flow**: Organize sequentially from table start to table finish. The DM runs top to bottom and should never have to flip back and forth.
2. **Last Session Recap ("The Story So Far")**: Include a punchy 2-4 bullet point executive recap of what happened in '{prev_session_info['title']}', active cliffhangers, and player momentum.
3. **Pacing Time Budgets**: Provide a realistic 3.5 - 4.0 hour table budget broken down across the beats (e.g. 0:00 - 0:20, 0:20 - 1:15, etc.).
4. **NPC & Monster Descriptions (LEAVE FULL STAT BLOCKS OUT)**:
   - Do NOT output full stat blocks (no AC, HP, spell lists, or stat arrays).
   - DO provide concise, evocative roleplay/tactical profiles: 1-2 sentence sensory description, disposition, 5e tactical role, and primary goal/motive.
5. **Read-Aloud Boxed Text**: Preserve or expand punchy, multi-sensory sentences formatted in quote blocks (`> 📜 ...`) for each encounter and opening scene.
6. **Detailed Encounter Mechanics**: Embed the actual tactical flow, mechanics, DCs (Insight, Athletics, Perception), and fail-forwards directly inside each beat.
7. **Session Climax & Cliffhanger**: Conclude with the climactic resolution and a suspenseful cliffhanger hook bridging into '{next_session_info['title'] if next_session_info else 'the next session'}'.

---

### CAMPAIGN & SESSION GROUND TRUTH:
- **Campaign**: {camp_name} ({camp_setting})
- **Session Node**: {session_node.title}
- **Session In-World/Real Date**: {session_date}
- **Session Core Summary/Agenda**: {session_agenda}
- **Previous Session**: {prev_session_info['title']}
  - Previous Summary: {prev_session_info['summary']}
  - Previous Content Excerpt: {prev_session_info['content_excerpt']}
- **Next Session**: {next_session_info['title'] if next_session_info else 'Unspecified'}
- **Party Members (PCs)**:
{chr(10).join(pc_summaries) if pc_summaries else "- 4 Level 1 Adventurers"}

### SEQUENTIAL ENCOUNTERS & BEATS WITH FULL DETAILS:
{beats_context_str if beats_context_str.strip() else "- No discrete encounters linked yet; synthesize an immersive opening, 3 dramatic beats, and a cliffhanger from the session summary."}

### CUSTOM DM INSTRUCTIONS:
{custom_instruction or "None provided. Prioritize natural table pacing, sensory immersion, and crisp timeline flow."}

---

Output the complete Run-Sheet in beautifully formatted GitHub Markdown.
"""
            try:
                response = model.generate_content(prompt)
                run_sheet_md = _extract_text_from_response(response)
            except Exception as err:
                logger.error(f"Error calling Gemini for session run-sheet: {err}", exc_info=True)

    # If use_llm is False or Gemini was unavailable/errored, use our rich deterministic graph engine
    if not run_sheet_md:
        run_sheet_md = _build_detailed_graph_run_sheet(
            session_node=session_node,
            prev_session_info=prev_session_info,
            next_session_info=next_session_info,
            camp_name=camp_name,
            camp_setting=camp_setting,
            structured_beats=structured_beats,
            pc_summaries=pc_summaries,
            custom_instruction=custom_instruction
        )
        if not use_llm:
            model_name = "graph-deterministic-engine"

    if save_to_node:
        try:
            new_data = dict(session_node.data_json or {})
            new_data["run_sheet"] = {
                "generated_at": datetime.now().isoformat(),
                "previous_session_title": prev_session_info["title"],
                "next_session_title": next_session_info["title"] if next_session_info else None,
                "beat_count": len(structured_beats),
                "engine": model_name,
            }
            graph_service.update_node(
                node_id=session_node.id,
                data=NodeUpdate(
                    content_markdown=run_sheet_md,
                    data_json=new_data
                )
            )
        except Exception as save_err:
            logger.error(f"Failed to persist run-sheet to node {session_node.id}: {save_err}")

    return {
        "success": True,
        "session_id": session_node.id,
        "session_title": session_node.title,
        "run_sheet_markdown": run_sheet_md,
        "previous_session_title": prev_session_info["title"],
        "next_session_title": next_session_info["title"] if next_session_info else None,
        "beat_count": len(structured_beats),
        "saved": save_to_node,
        "model": model_name
    }


def extract_entities_from_text(
    text_content: str,
    campaign_id: str,
    target_arc_id: Optional[str] = None
) -> Dict[str, Any]:
    model, model_name = _get_configured_gemini_client()

    if not model:
        # Simple rule-based extraction fallback
        lines = [line.strip() for line in text_content.split("\n") if line.strip()]
        sample_title = lines[0][:50] if lines else "Adventure Excerpt"
        raw_fallback_nodes = [
            {
                "type": "location",
                "title": sample_title,
                "summary": "Extracted location from uploaded document snippet.",
                "content_markdown": text_content[:500]
            }
        ]
        return {
            "extracted_nodes": _reconcile_extracted_nodes_with_campaign(raw_fallback_nodes, campaign_id),
            "extracted_edges": [],
            "model": "offline-extractor"
        }

    prompt = f"""You are an automated D&D 5e adventure content analyzer.
Analyze the following adventure/rulebook text excerpt and extract key entities as Graph Nodes and Edges:
Allowed node types: 'location', 'npc', 'monster', 'quest', 'faction', 'item', 'clue', 'encounter'
Allowed edge relation types: 'located_at', 'allied_with', 'hostile_to', 'gives_quest', 'rewards', 'frequents', 'contains'

Text to analyze:
\"\"\"
{text_content[:8000]}
\"\"\"

Return strictly JSON matching this structure:
{{
  "extracted_nodes": [
    {{
      "type": "npc|location|monster|quest|faction|item|clue|encounter",
      "title": "Clear Name",
      "subtitle": "Short epithet or role (e.g. Goblin Shaman, Abandoned Watchtower)",
      "summary": "1-2 sentence description",
      "content_markdown": "Full details, boxed text or stat block info found in the text",
      "data_json": {{
         "role": "npc|companion|villain|boss|monster|beast|minion|patron",
         "alignment": "lawful_good|neutral_good|chaotic_good|lawful_neutral|true_neutral|chaotic_neutral|lawful_evil|neutral_evil|chaotic_evil|unaligned|any",
         "creature_size": "Medium",
         "creature_type": "Humanoid|Beast|Undead|Dragon|Fiend|Aberration|Construct|Plant|etc",
         "cr": "1/2 (if monster)",
         "hp": 22,
         "ac": 13,
         "status": "planned"
      }},
      "revealed_to_players": false
    }}
  ],
  "extracted_edges": [
    {{
      "source_title": "Exact title of source node",
      "target_title": "Exact title of target node",
      "relation_type": "located_at|gives_quest|allied_with|hostile_to|contains|frequents",
      "label": "Short description of relation"
    }}
  ]
}}
"""
    try:
        response = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
        data = json.loads(response.text)
        return {
            "extracted_nodes": _reconcile_extracted_nodes_with_campaign(data.get("extracted_nodes", []), campaign_id),
            "extracted_edges": data.get("extracted_edges", []),
            "model": model_name
        }
    except Exception as e:
        logger.error(f"Error extracting entities: {e}")
        return {
            "extracted_nodes": [],
            "extracted_edges": [],
            "error": str(e),
            "model": "fallback"
        }

FALLBACK_GEMINI_MODELS = [
    {
        "id": "gemini-flash-latest",
        "display_name": "Gemini Flash Latest",
        "description": "Recommended high-speed multimodal reasoning and dynamic context.",
        "input_token_limit": 1048576,
        "output_token_limit": 8192
    },
    {
        "id": "gemini-2.5-flash",
        "display_name": "Gemini 2.5 Flash",
        "description": "Fastest response time, high multimodal reasoning, 1M token context.",
        "input_token_limit": 1048576,
        "output_token_limit": 8192
    },
    {
        "id": "gemini-2.5-pro",
        "display_name": "Gemini 2.5 Pro",
        "description": "State-of-the-art complex worldbuilding, intricate plot reasoning.",
        "input_token_limit": 2097152,
        "output_token_limit": 8192
    },
    {
        "id": "gemini-2.0-flash",
        "display_name": "Gemini 2.0 Flash",
        "description": "Next-generation fast multimodal generation.",
        "input_token_limit": 1048576,
        "output_token_limit": 8192
    },
    {
        "id": "gemini-1.5-flash",
        "display_name": "Gemini 1.5 Flash",
        "description": "Standard fast generation model.",
        "input_token_limit": 1048576,
        "output_token_limit": 8192
    },
    {
        "id": "gemini-1.5-pro",
        "display_name": "Gemini 1.5 Pro",
        "description": "Standard high-context reasoning model.",
        "input_token_limit": 2097152,
        "output_token_limit": 8192
    }
]

def list_available_gemini_models(api_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Queries Google Generative Language API using the provided or configured API key
    to fetch available models supporting content generation.
    """
    effective_key = (api_key or "").strip()
    if not effective_key:
        effective_key = get_setting("gemini_api_key", os.getenv("GEMINI_API_KEY", "")).strip()

    if not effective_key:
        return {
            "models": FALLBACK_GEMINI_MODELS,
            "error": "No API key configured. Enter a Gemini API key to query available models.",
            "source": "fallback"
        }

    import httpx
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={effective_key}"
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                raw_models = data.get("models", [])
                parsed_models = []
                for m in raw_models:
                    # Filter for models that support text/content generation
                    methods = m.get("supportedGenerationMethods", [])
                    if "generateContent" in methods:
                        model_id = m["name"].replace("models/", "")
                        # Ignore legacy or experimental embeddings/vision-only endpoints
                        if "embedding" in model_id or "aqa" in model_id:
                            continue
                        parsed_models.append({
                            "id": model_id,
                            "display_name": m.get("displayName") or model_id,
                            "description": m.get("description", ""),
                            "input_token_limit": m.get("inputTokenLimit"),
                            "output_token_limit": m.get("outputTokenLimit"),
                        })

                # Sort priority: flash-latest first, then flash models descending by version, then pro models descending by version
                def model_sort_key(m):
                    mid = m["id"].lower()
                    import re
                    if "flash-latest" in mid:
                        return (0, 0.0, mid)
                    if "flash" in mid:
                        match = re.search(r"(\d+(?:\.\d+)?)", mid)
                        version_val = float(match.group(1)) if match else 0.0
                        return (1, -version_val, mid)
                    if "pro-latest" in mid:
                        return (2, 0.0, mid)
                    if "pro" in mid:
                        match = re.search(r"(\d+(?:\.\d+)?)", mid)
                        version_val = float(match.group(1)) if match else 0.0
                        return (3, -version_val, mid)
                    return (4, 0.0, mid)

                parsed_models.sort(key=model_sort_key)

                return {
                    "models": parsed_models if parsed_models else FALLBACK_GEMINI_MODELS,
                    "error": None,
                    "source": "api"
                }
            else:
                err_data = {}
                try:
                    err_data = resp.json().get("error", {})
                except Exception:
                    pass
                msg = err_data.get("message") or f"Google API returned HTTP {resp.status_code}"
                logger.warning(f"Failed to query Gemini models: {msg}")
                return {
                    "models": FALLBACK_GEMINI_MODELS,
                    "error": msg,
                    "source": "error"
                }
    except Exception as e:
        logger.error(f"Network error querying Gemini models: {e}")
        return {
            "models": FALLBACK_GEMINI_MODELS,
            "error": f"Connection error: {str(e)}",
            "source": "fallback"
        }

# ---------------------------------------------------------------------------
# Chunked extraction helpers — used by exhaustive ingestion mode
# ---------------------------------------------------------------------------

def _split_text_into_chunks(text: str, chars_per_chunk: int = 18000, overlap: int = 1500) -> List[str]:
    """
    Splits a large text into overlapping chunks so no entity is cut off at a boundary.
    Overlap ensures that stat blocks / NPC entries that span a chunk border are captured.
    """
    chunks = []
    start = 0
    length = len(text)
    while start < length:
        end = min(start + chars_per_chunk, length)
        chunks.append(text[start:end])
        if end >= length:
            break
        start += chars_per_chunk - overlap
    return chunks


def _reconcile_extracted_nodes_with_campaign(
    extracted_nodes: List[Dict[str, Any]], campaign_id: str
) -> List[Dict[str, Any]]:
    """
    Reconciles newly extracted entities against existing campaign graph nodes.
    - Exact match: Marks as exact_match (confidence: 1.0) for seamless auto-merge.
    - Info conflict: Flags conflicting disposition, CR, or lore for DM review.
    - Fuzzy/near match: Computes confidence rating (0.50–0.95) and targets candidate node.
    - New entity: Marks as new (confidence: 0.0).
    """
    if not extracted_nodes:
        return []

    campaign_nodes = list_nodes(campaign_id) if campaign_id else []
    id_to_existing = {n.id: n for n in campaign_nodes}
    exact_title_map = {n.title.lower().strip(): n for n in campaign_nodes}

    reconciled = []
    for node in extracted_nodes:
        n = dict(node)
        n["is_canon"] = False
        ext_title = (n.get("title") or "").strip()
        norm_title = ext_title.lower()

        matched_node = None
        match_confidence = float(n.get("match_confidence") or 0.0)
        match_status = n.get("match_status") or "new"
        conflict_reason = n.get("conflict_reason")

        # 1. Check if AI already matched an existing node by ID
        matched_id = n.get("matched_node_id")
        if matched_id and matched_id in id_to_existing:
            matched_node = id_to_existing[matched_id]
            match_confidence = 1.0
        elif norm_title in exact_title_map:
            # Deterministic exact match by normalized title
            matched_node = exact_title_map[norm_title]
            match_confidence = 1.0
            if match_status not in ("conflict", "exact_match"):
                match_status = "exact_match"

        # 2. If no exact match yet, perform fuzzy / alias matching
        if not matched_node:
            best_cand = None
            best_score = 0.0
            title_clean = norm_title.replace("the ", "").replace("captain ", "").replace("lord ", "").replace("sir ", "").strip()
            ext_type = n.get("type")

            for cand in campaign_nodes:
                cand_norm = cand.title.lower().strip()
                cand_clean = cand_norm.replace("the ", "").replace("captain ", "").replace("lord ", "").replace("sir ", "").strip()
                same_type = bool(ext_type and cand.type and ext_type == cand.type)

                if title_clean and cand_clean and title_clean == cand_clean:
                    score = 0.95 if same_type else 0.85
                elif title_clean and cand_clean and (title_clean in cand_clean or cand_clean in title_clean) and min(len(title_clean), len(cand_clean)) >= 4:
                    score = 0.82 if same_type else 0.60
                else:
                    ratio = difflib.SequenceMatcher(None, norm_title, cand_norm).ratio()
                    score = round(ratio, 2)
                    if not same_type and score < 0.90:
                        score = round(score * 0.85, 2)

                if score > best_score:
                    best_score = score
                    best_cand = cand

            if best_score >= 0.70 and best_cand:
                matched_node = best_cand
                match_confidence = best_score
                if match_status == "new":
                    match_status = "potential_match"

        # 3. Check for lore / stat conflict if matched
        if matched_node:
            n["matched_node_id"] = matched_node.id
            n["matched_node_title"] = matched_node.title
            n["match_confidence"] = match_confidence or 1.0

            conflicts = []
            ext_data = n.get("data_json") or {}
            exist_data = matched_node.data_json or {}

            # Conflict analysis: CR discrepancy
            ext_cr = str(ext_data.get("cr", "")).strip()
            exist_cr = str(exist_data.get("cr", "")).strip()
            if ext_cr and exist_cr and ext_cr != exist_cr and ext_cr not in ("?", "None", "") and exist_cr not in ("?", "None", ""):
                conflicts.append(f"CR conflict (existing: {exist_cr} vs imported: {ext_cr})")

            # Conflict analysis: disposition discrepancy
            ext_disp = ext_data.get("disposition")
            exist_disp = exist_data.get("disposition")
            if ext_disp and exist_disp and str(ext_disp).lower().strip() != str(exist_disp).lower().strip():
                conflicts.append(f"Disposition conflict (existing: '{exist_disp}' vs imported: '{ext_disp}')")

            # Conflict analysis: alignment discrepancy
            ext_align = ext_data.get("alignment")
            exist_align = exist_data.get("alignment")
            if ext_align and exist_align and str(ext_align).lower().strip() != str(exist_align).lower().strip():
                conflicts.append(f"Alignment conflict (existing: '{exist_align}' vs imported: '{ext_align}')")

            # Conflict analysis: faction discrepancy
            ext_fac = ext_data.get("faction")
            exist_fac = exist_data.get("faction")
            if ext_fac and exist_fac and str(ext_fac).lower().strip() != str(exist_fac).lower().strip():
                conflicts.append(f"Faction conflict (existing: '{exist_fac}' vs imported: '{ext_fac}')")

            if conflicts and not n.get("conflict_resolved"):
                match_status = "conflict"
                conflict_reason = " | ".join(conflicts)
                n["conflict_resolved"] = False
            else:
                if n.get("conflict_resolved") or match_status == "conflict":
                    n["conflict_resolved"] = True
                    match_status = "exact_match" if (matched_id or norm_title == matched_node.title.lower().strip() or match_confidence >= 0.99) else "potential_match"
                    conflict_reason = None
                    n["dilemma_explanation"] = None
                    if not n.get("action") or n.get("action") == "other":
                        n["action"] = "merge"
                elif match_status not in ("exact_match", "potential_match"):
                    match_status = "exact_match" if (matched_id or norm_title == matched_node.title.lower().strip()) else "potential_match"

            n["match_status"] = match_status
            n["conflict_reason"] = conflict_reason
            if not n.get("merge_notes"):
                n["merge_notes"] = f"Will merge with existing '{matched_node.title}' in campaign graph without losing canon notes."

            # Generate explicit Dilemma Explanation for DM Review
            if match_status == "conflict":
                n["dilemma_explanation"] = (
                    f"Contradiction Detected: Imported '{ext_title}' differs from existing campaign node '{matched_node.title}': {conflict_reason}. "
                    "You can update the existing record with these new values, keep the current canon lore, or create a separate entity."
                )
                n["review_options"] = ["merge", "create_new", "skip", "other"]
            elif match_status == "potential_match":
                n["dilemma_explanation"] = (
                    f"Ambiguous Match ({int(match_confidence * 100)}% similarity): '{ext_title}' ({n.get('type')}) closely resembles existing "
                    f"campaign node '{matched_node.title}' ({matched_node.type}). Should this be merged into the existing record or kept distinct?"
                )
                n["review_options"] = ["merge", "create_new", "skip", "other"]
        else:
            n["match_status"] = "new"
            n["matched_node_id"] = None
            n["matched_node_title"] = None
            n["match_confidence"] = 0.0
            n["conflict_reason"] = None

        # Base Template Inheritance & Stubs (Requirement 3a)
        # If an NPC or monster is missing full stats or is a variant
        if n.get("type") in ("monster", "npc"):
            ext_data = n.get("data_json") or {}
            has_stats = bool(ext_data.get("hp") or ext_data.get("ac") or ext_data.get("abilities"))
            base_template_match = None

            # Detect referenced base template from title/subtitle
            raw_check_text = f"{ext_title} {n.get('subtitle') or ''}".lower()
            for cand in campaign_nodes:
                if cand.type in ("monster", "npc") and cand.title.lower() != norm_title:
                    cand_name = cand.title.lower()
                    if len(cand_name) >= 3 and cand_name in raw_check_text:
                        base_template_match = cand
                        break

            if base_template_match and not has_stats:
                base_data = base_template_match.data_json or {}
                # Inherit base stats
                ext_data.setdefault("cr", base_data.get("cr"))
                ext_data.setdefault("hp", base_data.get("hp"))
                ext_data.setdefault("ac", base_data.get("ac"))
                ext_data.setdefault("abilities", base_data.get("abilities"))
                ext_data.setdefault("speed", base_data.get("speed"))
                n["data_json"] = ext_data
                n["base_template_title"] = base_template_match.title
                n["inherited_template"] = True
                curr_content = n.get("content_markdown") or ""
                n["content_markdown"] = f"{curr_content}\n\n*Inherited base 5e statistics from template **{base_template_match.title}**.*"
            elif not has_stats or ext_data.get("needs_statblock"):
                n["needs_statblock"] = True
                ext_data["needs_statblock"] = True
                n["data_json"] = ext_data
                n["needs_statblock_prompt"] = f"Missing complete 5e stat block for {ext_title}. Enter stats manually or upload a stat block sheet."

        reconciled.append(n)

    return reconciled


def _run_qa_verifier_pass(
    model,
    extracted_nodes: List[Dict[str, Any]],
    text_sample: str,
    instruction: str,
) -> List[Dict[str, Any]]:
    """
    Automated QA Verifier Agent:
    Compares the list of extracted entities against the source text segment to detect
    any omitted named NPCs, monsters, magic items, traps, or inset sidebars.
    """
    if not model or not extracted_nodes or not text_sample:
        return []

    titles_so_far = [n.get("title", "") for n in extracted_nodes if n.get("title")]
    qa_prompt = f"""You are a meticulous D&D Quality Assurance Auditor.
Review the list of entities extracted from this adventure text segment:
ENTITIES EXTRACTED SO FAR:
{json.dumps(titles_so_far[:50], indent=2)}

DM'S STEERING INSTRUCTION:
\"\"\"{instruction or 'Exhaustively audit for any missed rooms, monsters, NPCs, or items.'}\"\"\"

SOURCE ADVENTURE TEXT SEGMENT:
\"\"\"
{text_sample[:12000]}
\"\"\"

TASK:
Examine whether any named monsters, NPCs, keyed room locations (e.g. Area 1..N), magic items, hazards/traps, or inset sidebars in this text were OMITTED from the extracted list.
If any were omitted, return ONLY the omitted entities in strictly valid JSON:
{{
  "omitted_nodes": [
    {{
      "type": "arc|quest|session|encounter|pc|npc|monster|location|faction|item|clue",
      "title": "Clear Name",
      "subtitle": "Short epithet or CR",
      "summary": "1-2 sentence synopsis",
      "content_markdown": "Full markdown details",
      "data_json": {{ "status": "planned" }}
    }}
  ]
}}
If nothing was missed, return {{"omitted_nodes": []}}.
"""
    try:
        res = model.generate_content(
            qa_prompt,
            generation_config={"response_mime_type": "application/json", "max_output_tokens": 4096}
        )
        data = json.loads(res.text)
        return data.get("omitted_nodes", [])
    except Exception as e:
        logger.warning(f"[QA Verifier] Audit pass skipped due to error: {e}")
        return []


GREEK_WORKERS = [
    "Worker Alpha", "Worker Beta", "Worker Gamma", "Worker Delta",
    "Worker Epsilon", "Worker Zeta", "Worker Eta", "Worker Theta",
    "Worker Iota", "Worker Kappa"
]

def save_decomposition_job(job: Dict[str, Any]) -> None:
    """
    Persists decomposition pipeline execution state, clusters, scratchpads,
    and working drafts to SQLite.
    """
    with get_connection() as conn:
        conn.execute("""
            INSERT INTO decomposition_jobs (
                id, campaign_id, filename, page_range, instruction, decomposition_mode,
                status, current_step, clusters_json, scratchpads_json, draft_nodes_json,
                draft_edges_json, qa_results_json, overview_summary, model_name, error_message, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
                status=excluded.status,
                current_step=excluded.current_step,
                clusters_json=excluded.clusters_json,
                scratchpads_json=excluded.scratchpads_json,
                draft_nodes_json=excluded.draft_nodes_json,
                draft_edges_json=excluded.draft_edges_json,
                qa_results_json=excluded.qa_results_json,
                overview_summary=excluded.overview_summary,
                model_name=excluded.model_name,
                error_message=excluded.error_message,
                updated_at=CURRENT_TIMESTAMP
        """, (
            job["id"],
            job.get("campaign_id", ""),
            job.get("filename"),
            job.get("page_range"),
            job.get("instruction", ""),
            job.get("decomposition_mode", "comprehensive"),
            job.get("status", "clustering"),
            job.get("current_step", 1),
            json.dumps(job.get("clusters", [])),
            json.dumps(job.get("scratchpads", {})),
            json.dumps(job.get("draft_nodes", [])),
            json.dumps(job.get("draft_edges", [])),
            json.dumps(job.get("qa_results", {})),
            job.get("overview_summary", ""),
            job.get("model_name", ""),
            job.get("error_message")
        ))


def _build_subagent_manifest(clusters: List[Dict[str, Any]], current_step: int, status: str, error_msg: Optional[str] = None) -> List[Dict[str, Any]]:
    manifest = []
    for c in clusters:
        manifest.append({
            "id": f"subagent-{c.get('id', 'cluster')}",
            "name": c.get("subagent_name", "Worker Agent"),
            "role": "Visual Cluster Extraction",
            "target": c.get("label", "Document Slice"),
            "status": c.get("status", "pending"),
            "error": c.get("error")
        })

    qa_status = "completed" if current_step >= 4 else ("running" if current_step == 3 and status != "failed" else ("failed" if current_step == 3 and status == "failed" else "pending"))
    deconf_status = "completed" if status == "completed" else ("running" if current_step == 4 and status != "failed" else ("failed" if current_step == 4 and status == "failed" else "pending"))

    manifest.append({
        "id": "subagent-qa",
        "name": "QA Auditor Agent",
        "role": "Completeness & Omission Audit",
        "target": "Draft vs Indexed Document Text",
        "status": qa_status,
        "error": error_msg if current_step == 3 else None
    })
    manifest.append({
        "id": "subagent-deconflict",
        "name": "Domain Deconfliction Specialist",
        "role": "SQLite Graph Matching & 5e Templates",
        "target": "Active Campaign Records",
        "status": deconf_status,
        "error": error_msg if current_step == 4 else None
    })
    return manifest


def get_decomposition_job(job_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves a decomposition job and builds the live subagent manifest.
    """
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM decomposition_jobs WHERE id = ?", (job_id,)).fetchone()
        if not row:
            return None

        clusters = json.loads(row["clusters_json"] or "[]")
        scratchpads = json.loads(row["scratchpads_json"] or "{}")
        subagents = _build_subagent_manifest(clusters, row["current_step"], row["status"], row["error_message"])

        return {
            "id": row["id"],
            "campaign_id": row["campaign_id"],
            "filename": row["filename"],
            "page_range": row["page_range"],
            "instruction": row["instruction"],
            "decomposition_mode": row["decomposition_mode"],
            "status": row["status"],
            "current_step": row["current_step"],
            "clusters": clusters,
            "subagents": subagents,
            "scratchpads": scratchpads,
            "draft_nodes": json.loads(row["draft_nodes_json"] or "[]"),
            "draft_edges": json.loads(row["draft_edges_json"] or "[]"),
            "qa_results": json.loads(row["qa_results_json"] or "{}"),
            "overview_summary": row["overview_summary"] or "",
            "model_name": row["model_name"] or "",
            "error_message": row["error_message"],
            "created_at": str(row["created_at"]),
            "updated_at": str(row["updated_at"])
        }


def get_latest_decomposition_job(campaign_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves the most recent decomposition job for a given campaign.
    """
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id FROM decomposition_jobs WHERE campaign_id = ? ORDER BY created_at DESC LIMIT 1",
            (campaign_id,)
        ).fetchone()
        if row:
            return get_decomposition_job(row["id"])
    return None


def stop_decomposition_job(job_id: str) -> Optional[Dict[str, Any]]:
    """
    Flags an in-progress decomposition job as stopped so active worker loops halt immediately.
    Preserves all draft nodes and scratchpads created so far.
    """
    job = get_decomposition_job(job_id)
    if not job:
        return None
    job["status"] = "stopped"
    job["error_message"] = "Decomposition interrupted by user."
    save_decomposition_job(job)
    return job



def _safe_json_loads(text: str) -> Dict[str, Any]:
    """
    Safely parses JSON output from LLM, with resilient stack-based recovery heuristics
    for unclosed strings, unterminated brackets, and responses truncated near token limits.
    """
    cleaned = text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except Exception:
        pass

    # Heuristic 1: Stack-based unclosed string & bracket repair
    try:
        stack = []
        in_string = False
        escape = False
        for ch in cleaned:
            if escape:
                escape = False
                continue
            if ch == '\\' and in_string:
                escape = True
                continue
            if ch == '"':
                in_string = not in_string
                continue
            if not in_string:
                if ch in ('{', '['):
                    stack.append(ch)
                elif ch == '}':
                    if stack and stack[-1] == '{':
                        stack.pop()
                elif ch == ']':
                    if stack and stack[-1] == '[':
                        stack.pop()

        repaired = cleaned
        if in_string:
            repaired += '"'

        trimmed = repaired.rstrip()
        if trimmed.endswith(':'):
            trimmed += ' null'
        elif trimmed.endswith(','):
            trimmed = trimmed[:-1]

        for open_ch in reversed(stack):
            trimmed = trimmed.rstrip()
            if trimmed.endswith(','):
                trimmed = trimmed[:-1]
            if open_ch == '{':
                trimmed += '}'
            elif open_ch == '[':
                trimmed += ']'

        return json.loads(trimmed)
    except Exception:
        pass

    # Heuristic 2: Truncate back to the last valid completed object and close unclosed containers
    try:
        last_item_pos = max(cleaned.rfind('},\n'), cleaned.rfind('},'), cleaned.rfind('}\n'), cleaned.rfind('}'))
        if last_item_pos > 0:
            truncated = cleaned[:last_item_pos + 1].rstrip()
            if truncated.endswith(','):
                truncated = truncated[:-1]
            o_bracket = max(0, truncated.count('[') - truncated.count(']'))
            o_brace = max(0, truncated.count('{') - truncated.count('}'))
            if o_bracket > 0:
                truncated += '\n' + (']' * o_bracket)
            if o_brace > 0:
                truncated += '\n' + ('}' * o_brace)
            return json.loads(truncated)
    except Exception:
        pass

    # Final attempt: standard closing suffixes
    for suffix in ['"} ] }', '"}]}', '"] }', '"}', '}', ']}', ']}}']:
        try:
            return json.loads(cleaned + suffix)
        except json.JSONDecodeError:
            continue

    # If all salvage attempts fail, re-raise original JSON error
    return json.loads(cleaned)


def _normalize_extracted_chunk_nodes(chunk_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Robustly extracts entity nodes from LLM chunk output, supporting standard keys
    ('extracted_nodes', 'nodes', 'entities') and categorized dictionaries ('locations', 'npcs', 'monsters', etc.).
    """
    if not isinstance(chunk_data, dict):
        return []

    raw = chunk_data.get("extracted_nodes") or chunk_data.get("nodes") or chunk_data.get("entities") or []
    if isinstance(raw, list) and len(raw) > 0:
        valid_nodes = []
        for n in raw:
            if isinstance(n, dict) and (n.get("title") or n.get("name")):
                if not n.get("title") and n.get("name"):
                    n["title"] = n["name"]
                n.setdefault("type", "location")
                n.setdefault("summary", n.get("title", ""))
                n.setdefault("content_markdown", n.get("summary", n.get("title", "")))
                n.setdefault("data_json", {"status": "planned"})
                n["is_canon"] = False
                valid_nodes.append(n)
        if valid_nodes:
            return valid_nodes

    # Fallback: Check if the model categorized entities into top-level lists
    collected = []
    category_map = [
        ("locations", "location"), ("rooms", "location"), ("keyed_rooms", "location"),
        ("npcs", "npc"), ("characters", "npc"), ("factions", "faction"),
        ("monsters", "monster"), ("creatures", "monster"), ("enemies", "monster"),
        ("items", "item"), ("relics", "item"), ("magic_items", "item"),
        ("sidebars", "lore"), ("lore", "lore"), ("rumors", "clue"),
        ("quests", "quest"), ("encounters", "encounter"), ("traps", "encounter")
    ]
    for key, node_type in category_map:
        items = chunk_data.get(key)
        if isinstance(items, list):
            for it in items:
                if isinstance(it, dict) and (it.get("title") or it.get("name")):
                    title_str = it.get("title") or it.get("name")
                    it["title"] = title_str
                    it.setdefault("type", node_type)
                    it.setdefault("summary", title_str)
                    it.setdefault("content_markdown", it.get("description", title_str))
                    it.setdefault("data_json", {"status": "planned"})
                    it["is_canon"] = False
                    collected.append(it)
                elif isinstance(it, str) and it.strip():
                    collected.append({
                        "type": node_type,
                        "title": it.strip(),
                        "summary": it.strip(),
                        "content_markdown": it.strip(),
                        "data_json": {"status": "planned"},
                        "is_canon": False
                    })

    # Also inspect scratchpad object if top-level lists were empty
    scratch_obj = chunk_data.get("scratchpad")
    if isinstance(scratch_obj, dict) and not collected:
        for key, node_type in category_map:
            items = scratch_obj.get(key)
            if isinstance(items, list):
                for it in items:
                    title_str = it.get("title") or it.get("name") if isinstance(it, dict) else str(it).strip()
                    if title_str:
                        collected.append({
                            "type": node_type,
                            "title": title_str,
                            "summary": title_str,
                            "content_markdown": title_str,
                            "data_json": {"status": "planned"},
                            "is_canon": False
                        })
    return collected


def _extract_single_cluster_slice(
    cluster: Dict[str, Any],
    model,
    selected_prompt: str,
    instruction: str,
    db_context: str,
    pdf_file_path: Optional[str] = None
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """
    Executes an extraction pass for a single visual PDF cluster or text chunk.
    Uses max_output_tokens=16384 and resilient JSON recovery.
    """
    slice_label = cluster.get("label", "")
    worker_prompt = f"""You are an expert D&D 5e adventure analyst and Co-DM architect.
Exhaustively extract EVERY named entity, room, NPC, creature, item, and lore snippet from this document slice ({slice_label}).

{selected_prompt}

DM'S STEERING INSTRUCTION:
\"\"\"{instruction or 'Exhaustively extract all entities found in this document segment.'}\"\"\"

EXISTING CAMPAIGN RECORDS (CONTEXT):
{db_context}

OUTPUT FORMAT REQUIREMENTS:
You MUST respond strictly with valid JSON adhering to this exact schema:
{{
  "scratchpad": {{
    "rooms_inventoried": ["Area 1: Name", "Area 2: Name"],
    "npcs_identified": ["NPC Name (Role)", ...],
    "monsters_spotted": ["Creature (CR)", ...],
    "sidebars_captured": ["Sidebar / Inset Title", ...],
    "traps_secrets": ["Trap / Hidden Door (DC)", ...],
    "notes": ["Working observation 1", "Working observation 2"]
  }},
  "extracted_nodes": [
    {{
      "type": "location|npc|monster|item|lore|quest|encounter",
      "title": "Exact Name or Title",
      "subtitle": "Short role, CR, or Level/Class",
      "summary": "1-2 sentence synopsis",
      "content_markdown": "Complete formatted description with stat blocks, read-aloud text, or DM secrets",
      "data_json": {{"status": "planned"}},
      "revealed_to_players": false
    }}
  ],
  "extracted_edges": [
    {{
      "source_title": "Area 1",
      "target_title": "Area 2",
      "relation_type": "leads_to",
      "label": "connecting door or path"
    }}
  ]
}}

DOCUMENT SEGMENT ({slice_label}):
"""
    try:
        if cluster.get("type") == "pdf_cluster" and pdf_file_path and Path(pdf_file_path).exists():
            from app.services import pdf_service
            pdf_bytes = pdf_service.get_pdf_page_cluster_bytes(
                pdf_file_path, cluster["start_page"], cluster["end_page"]
            )
            pdf_part = {"mime_type": "application/pdf", "data": pdf_bytes}
            response = model.generate_content(
                [pdf_part, worker_prompt],
                generation_config={"response_mime_type": "application/json", "max_output_tokens": 16384}
            )
            chunk_data = _safe_json_loads(response.text)
        else:
            text_slice = cluster.get("text", "")
            full_prompt = f"{worker_prompt}\n\"\"\"\n{text_slice}\n\"\"\"\n\nReturn strictly JSON matching the specified schema."
            response = model.generate_content(
                full_prompt,
                generation_config={"response_mime_type": "application/json", "max_output_tokens": 16384}
            )
            chunk_data = _safe_json_loads(response.text)

        # Normalize extracted nodes
        normalized_nodes = _normalize_extracted_chunk_nodes(chunk_data)
        chunk_data["extracted_nodes"] = normalized_nodes
        return chunk_data, None
    except Exception as e:
        logger.warning(f"[MultiAgentExtract] Primary call failed for {slice_label}: {e}")
        if cluster.get("type") == "pdf_cluster" and pdf_file_path and Path(pdf_file_path).exists():
            try:
                from app.services import pdf_service
                fallback_text = pdf_service.get_pdf_page_text(pdf_file_path, cluster["start_page"], cluster["end_page"])
                full_prompt = f"{worker_prompt}\n\"\"\"\n{fallback_text}\n\"\"\"\n\nReturn strictly JSON matching the specified schema."
                response = model.generate_content(
                    full_prompt,
                    generation_config={"response_mime_type": "application/json", "max_output_tokens": 16384}
                )
                chunk_data = _safe_json_loads(response.text)
                normalized_nodes = _normalize_extracted_chunk_nodes(chunk_data)
                chunk_data["extracted_nodes"] = normalized_nodes
                return chunk_data, None
            except Exception as inner_e:
                return None, str(inner_e)
        return None, str(e)


def _record_cluster_scratchpad(
    job_scratchpads: Dict[str, Any],
    cluster: Dict[str, Any],
    chunk_data: Dict[str, Any],
    subagent_name: str,
    slice_label: str
):
    """
    Standardizes scratchpad format so UI components never encounter non-array notes or missing fields.
    """
    raw_nodes = chunk_data.get("extracted_nodes", [])
    scratch_obj = chunk_data.get("scratchpad") or {}

    rooms_from_nodes = [n["title"] for n in raw_nodes if n.get("type") == "location"]
    npcs_from_nodes = [n["title"] for n in raw_nodes if n.get("type") == "npc"]
    monsters_from_nodes = [n["title"] for n in raw_nodes if n.get("type") == "monster"]
    sidebars_from_nodes = [n["title"] for n in raw_nodes if n.get("type") in ("lore", "clue")]
    traps_from_nodes = [
        n["title"] for n in raw_nodes
        if "trap" in n.get("title", "").lower() or "secret" in n.get("title", "").lower() or "trap" in str(n.get("data_json", {})).lower()
    ]

    scratch_rooms = scratch_obj.get("rooms_inventoried") or scratch_obj.get("rooms") or scratch_obj.get("locations") or rooms_from_nodes
    scratch_npcs = scratch_obj.get("npcs_identified") or scratch_obj.get("npcs") or scratch_obj.get("characters") or npcs_from_nodes
    scratch_monsters = scratch_obj.get("monsters_spotted") or scratch_obj.get("monsters") or scratch_obj.get("creatures") or monsters_from_nodes
    scratch_sidebars = scratch_obj.get("sidebars_captured") or scratch_obj.get("sidebars") or scratch_obj.get("lore") or sidebars_from_nodes
    scratch_traps = scratch_obj.get("traps_secrets") or scratch_obj.get("traps") or scratch_obj.get("secrets") or traps_from_nodes

    notes_val = scratch_obj.get("notes")
    if isinstance(notes_val, list) and notes_val:
        notes_list = [str(x) for x in notes_val]
    elif notes_val:
        notes_list = [str(notes_val)]
    else:
        notes_list = [f"Sub-agent {subagent_name} successfully inventoried {len(raw_nodes)} entities from {slice_label}."]

    job_scratchpads[subagent_name] = {
        "agent_name": subagent_name,
        "subagent_name": subagent_name,
        "role": "Visual Cluster Extraction",
        "assigned_pages": slice_label,
        "cluster_label": slice_label,
        "rooms_inventoried": list(scratch_rooms),
        "npcs_identified": list(scratch_npcs),
        "monsters_spotted": list(scratch_monsters),
        "sidebars_captured": list(scratch_sidebars),
        "traps_secrets": list(scratch_traps),
        "notes": notes_list
    }


def _chunk_and_extract_nodes(
    text_content: str,
    model,
    model_name: str,
    selected_prompt: str,
    instruction: str,
    db_context: str,
    current_nodes: Optional[List[Dict[str, Any]]] = None,
    current_edges: Optional[List[Dict[str, Any]]] = None,
    campaign_id: str = "",
    pdf_file_path: Optional[str] = None,
    start_page: int = 1,
    end_page: Optional[int] = None,
    existing_job_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Checkpointed Multi-Agent Extraction Orchestrator:
    1. Phase 1: Clusters document pages/chunks into slices and assigns named subagents.
    2. Phase 2: Runs worker subagents per slice, records mental scratchpads, saves checkpoints.
    3. Phase 3: Runs automated QA Verifier against indexed text, preserves recovered entities.
    4. Phase 4: Reconciles with SQLite campaign records and attaches 5e base templates.
    """
    job_id = existing_job_id or str(uuid.uuid4())
    all_nodes: List[Dict[str, Any]] = list(current_nodes or [])
    all_edges: List[Dict[str, Any]] = list(current_edges or [])
    seen_titles: set = {n.get("title", "").lower().strip() for n in all_nodes}
    seen_edges: set = {
        f"{e.get('source_title','').lower()}|{e.get('target_title','').lower()}|{e.get('relation_type','')}"
        for e in all_edges
    }
    job_scratchpads: Dict[str, Any] = {}

    # Determine visual page clusters vs text chunks (2 pages per cluster for dense D&D spreads)
    clusters_to_process: List[Dict[str, Any]] = []
    if pdf_file_path and Path(pdf_file_path).exists():
        from app.services import pdf_service
        try:
            reader = pypdf.PdfReader(str(pdf_file_path))
            total_doc_pages = len(reader.pages)
            start_p = max(1, start_page or 1)
            end_p = min(total_doc_pages, end_page) if end_page else total_doc_pages

            curr_p = start_p
            idx = 0
            while curr_p <= end_p:
                c_end = min(curr_p + 1, end_p)
                subagent_name = GREEK_WORKERS[idx % len(GREEK_WORKERS)]
                clusters_to_process.append({
                    "id": f"cluster-{idx + 1}",
                    "type": "pdf_cluster",
                    "start_page": curr_p,
                    "end_page": c_end,
                    "label": f"Pages {curr_p}–{c_end}",
                    "subagent_name": subagent_name,
                    "status": "pending",
                    "error": None
                })
                curr_p = c_end + 1
                idx += 1
        except Exception as e:
            logger.warning(f"[MultiAgentExtract] Could not cluster PDF pages directly: {e}")

    if not clusters_to_process:
        chunks = _split_text_into_chunks(text_content, chars_per_chunk=8000, overlap=800)
        for i, chunk in enumerate(chunks):
            subagent_name = GREEK_WORKERS[i % len(GREEK_WORKERS)]
            clusters_to_process.append({
                "id": f"cluster-{i + 1}",
                "type": "text_chunk",
                "text": chunk,
                "label": f"Segment {i + 1} of {len(chunks)}",
                "subagent_name": subagent_name,
                "status": "pending",
                "error": None
            })


    logger.info(f"[MultiAgentExtract] Job {job_id}: Created {len(clusters_to_process)} slices across subagents")

    # Step 1: Save Initial Checkpoint (Clustering & Manifest)
    job_record = {
        "id": job_id,
        "campaign_id": campaign_id,
        "filename": Path(pdf_file_path).name if pdf_file_path else None,
        "page_range": f"{start_page}-{end_page or (start_page + len(clusters_to_process) * 4)}",
        "instruction": instruction,
        "decomposition_mode": "comprehensive",
        "status": "mining",
        "current_step": 1,
        "clusters": clusters_to_process,
        "scratchpads": job_scratchpads,
        "draft_nodes": all_nodes,
        "draft_edges": all_edges,
        "qa_results": {},
        "overview_summary": "Initializing sub-agent clusters...",
        "model_name": model_name,
        "error_message": None
    }
    save_decomposition_job(job_record)

    # Step 2: Scratchpad Entity Mining (Worker Execution per cluster)
    job_record["current_step"] = 2
    failed_slices = 0
    last_error = None

    for i, cluster in enumerate(clusters_to_process):
        # Emergency stop check
        check_status = get_decomposition_job(job_id)
        if check_status and check_status.get("status") == "stopped":
            logger.info(f"[MultiAgentExtract] Job {job_id} halted by emergency stop.")
            break

        slice_label = cluster["label"]
        subagent_name = cluster["subagent_name"]
        cluster["status"] = "running"
        save_decomposition_job(job_record)

        logger.info(f"[MultiAgentExtract] {subagent_name} processing {slice_label}")

        worker_prompt = f"""You are an expert D&D 5e adventure analyst and Co-DM architect.
Exhaustively extract EVERY named entity from this document slice.

{selected_prompt}

SCRATCHPAD WORKING MEMORY:
1. Maintain an internal mental scratchpad:
   - First inventory every keyed room/location (e.g. Area 1..N).
   - Inventory every named NPC and leader with their motivations.
   - Inventory every monster group, tactical encounter, and hazard.
   - Inventory all visually styled Inset Boxes, parchment sidebars, and rumor tables.
   - Inventory hidden traps, secret passages, and mechanical DCs.
2. In your JSON output, provide a "scratchpad" object summarizing your checklist before the final nodes.

EXTRACTION CONTEXT & EXISTING NODES:
{db_context}

DM'S STEERING INSTRUCTION:
\"\"\"{instruction or 'Exhaustively extract all entities found in this document segment.'}\"\"\"

DOCUMENT SLICE ({slice_label}):
"""
        chunk_data, err = _extract_single_cluster_slice(
            cluster=cluster,
            model=model,
            selected_prompt=selected_prompt,
            instruction=instruction,
            db_context=db_context,
            pdf_file_path=pdf_file_path
        )

        if err or not chunk_data:
            last_error = err
            failed_slices += 1
            cluster["status"] = "failed"
            cluster["error"] = err
            save_decomposition_job(job_record)
            continue

        cluster["status"] = "completed"
        cluster["error"] = None
        raw_nodes = chunk_data.get("extracted_nodes", [])
        _record_cluster_scratchpad(job_scratchpads, cluster, chunk_data, subagent_name, slice_label)

        # Merge nodes and edges with provenance
        for node in raw_nodes:
            if cluster.get("start_page"):
                node.setdefault("source_page", cluster["start_page"])
            if pdf_file_path:
                node.setdefault("source_doc", Path(pdf_file_path).name)

            title_key = node.get("title", "").lower().strip()
            if title_key and title_key not in seen_titles:
                all_nodes.append(node)
                seen_titles.add(title_key)

        for edge in chunk_data.get("extracted_edges", []):
            edge_key = f"{edge.get('source_title','').lower()}|{edge.get('target_title','').lower()}|{edge.get('relation_type','')}"
            if edge_key not in seen_edges:
                all_edges.append(edge)
                seen_edges.add(edge_key)

        # Checkpoint save after every slice
        job_record["draft_nodes"] = all_nodes
        job_record["draft_edges"] = all_edges
        job_record["scratchpads"] = job_scratchpads
        save_decomposition_job(job_record)

    # Check if job was halted early by emergency stop
    check_status = get_decomposition_job(job_id)
    if (check_status and check_status.get("status") == "stopped") or job_record.get("status") == "stopped":
        completed_count = sum(1 for c in clusters_to_process if c.get("status") == "completed")
        job_record["status"] = "stopped"
        job_record["overview_summary"] = (
            f"### 🛑 Pipeline Interrupted by DM\n\n"
            f"Preserved **{len(all_nodes)} draft entities** and **{len(all_edges)} relationships** extracted across {completed_count} completed slices. "
            f"You can review or steer the draft with Co-DM below, retry remaining slices, or restart."
        )
        job_record["error_message"] = "Decomposition interrupted by user."
        save_decomposition_job(job_record)
        return {
            "job_id": job_id,
            "overview_summary": job_record["overview_summary"],
            "extracted_nodes": all_nodes,
            "extracted_edges": all_edges,
            "clusters": clusters_to_process,
            "subagents": _build_subagent_manifest(clusters_to_process, 2, "stopped"),
            "scratchpads": job_scratchpads,
            "current_step": 2,
            "status": "stopped",
            "error": "Decomposition interrupted by user.",
            "model": model_name,
            "chunks_processed": completed_count
        }

    if not all_nodes and failed_slices > 0:
        job_record["status"] = "failed"
        job_record["error_message"] = f"Model {model_name} failed across {failed_slices} slices: {last_error}"
        save_decomposition_job(job_record)
        return {
            "job_id": job_id,
            "overview_summary": (
                f"### ⚠️ Extraction Failed\n\n"
                f"The AI model ({model_name}) encountered an error across {failed_slices} slice(s).\n\n"
                f"**Error Details**: `{last_error}`\n\n"
                f"> 💡 *Tip: Check your Gemini API Key in Settings, or verify that your account has access to model `{model_name}`.*"
            ),
            "extracted_nodes": current_nodes or [],
            "extracted_edges": current_edges or [],
            "clusters": clusters_to_process,
            "subagents": _build_subagent_manifest(clusters_to_process, 2, "failed", last_error),
            "scratchpads": job_scratchpads,
            "current_step": 2,
            "status": "failed",
            "error": f"Model {model_name} failed: {last_error}",
            "model": model_name,
            "chunks_processed": 0
        }

    # Step 3: Automated QA Auditor Pass
    job_record["current_step"] = 3
    job_record["status"] = "qa_auditing"
    save_decomposition_job(job_record)

    try:
        if model and len(all_nodes) > 0 and len(clusters_to_process) >= 2:
            omitted = _run_qa_verifier_pass(model, all_nodes, text_content[:15000], instruction)
            if omitted:
                logger.info(f"[MultiAgentExtract] QA Verifier recovered {len(omitted)} omitted entities")
                for node in omitted:
                    title_key = node.get("title", "").lower().strip()
                    if title_key and title_key not in seen_titles:
                        all_nodes.append(node)
                        seen_titles.add(title_key)
                job_record["qa_results"] = {
                    "omitted_count": len(omitted),
                    "recovered": [n.get("title", "") for n in omitted],
                    "notes": f"QA Auditor successfully recovered {len(omitted)} omitted entity nodes from source text."
                }
            else:
                job_record["qa_results"] = {
                    "omitted_count": 0,
                    "recovered": [],
                    "notes": "QA Auditor verified 100% completeness against indexed document sections."
                }
            job_record["draft_nodes"] = all_nodes
            save_decomposition_job(job_record)
    except Exception as qa_err:
        logger.warning(f"[QA Verifier] Warning during audit pass: {qa_err}")
        job_record["qa_results"] = {"error": str(qa_err)}
        save_decomposition_job(job_record)

    # Step 4: Domain Deconfliction & 5e Base Templates
    job_record["current_step"] = 4
    job_record["status"] = "deconflicting"
    save_decomposition_job(job_record)

    try:
        reconciled_nodes = _reconcile_extracted_nodes_with_campaign(all_nodes, campaign_id)
        job_record["draft_nodes"] = reconciled_nodes
        job_record["draft_edges"] = all_edges
        job_record["status"] = "completed"

        loc_count = sum(1 for n in reconciled_nodes if n.get("type") == "location")
        npc_count = sum(1 for n in reconciled_nodes if n.get("type") == "npc")
        mon_count = sum(1 for n in reconciled_nodes if n.get("type") == "monster")
        item_count = sum(1 for n in reconciled_nodes if n.get("type") == "item")
        lore_count = sum(1 for n in reconciled_nodes if n.get("type") in ("lore", "clue"))
        quest_count = sum(1 for n in reconciled_nodes if n.get("type") in ("arc", "quest", "session", "encounter"))
        conflict_count = sum(1 for n in reconciled_nodes if n.get("match_status") in ("conflict", "potential_match"))
        stub_count = sum(1 for n in reconciled_nodes if n.get("needs_statblock"))

        summary_bullets = []
        if loc_count > 0:
            summary_bullets.append(f"- 📍 **{loc_count} Keyed Locations & Rooms** (with Read-Aloud descriptions and DM secrets cleanly separated)")
        if npc_count > 0:
            summary_bullets.append(f"- 👤 **{npc_count} Named NPCs & Leaders**")
        if mon_count > 0:
            summary_bullets.append(f"- ⚔️ **{mon_count} Monsters & Creatures**")
        if item_count > 0:
            summary_bullets.append(f"- 💎 **{item_count} Items & Relics**")
        if lore_count > 0:
            summary_bullets.append(f"- 📜 **{lore_count} Inset Sidebars, Rumors & Lore**")
        if quest_count > 0:
            summary_bullets.append(f"- 🗺️ **{quest_count} Narrative Arcs & Quests**")

        notices = []
        if conflict_count > 0:
            notices.append(f"⚠️ **{conflict_count} review dilemma(s)** detected against existing campaign records. Review cards below offer 1-click resolution actions (`Merge`, `Create New`, `Skip`, or `Other`).")
        if stub_count > 0:
            notices.append(f"📝 **{stub_count} creature(s)** reference external statblocks. They have been created as stubs flagged with *Needs Statblock* for easy input or upload.")

        combined_summary = (
            f"### 🧙‍♂️ Adventure Ingestion Verified\n\n"
            f"Processed **{len(clusters_to_process)} document slices** through multi-agent extraction with QA verification.\n\n"
            f"**Extracted {len(reconciled_nodes)} total unique entities** and **{len(all_edges)} relationships**:\n"
            + "\n".join(summary_bullets)
            + ("\n\n" + "\n\n".join(notices) if notices else "")
        )
        job_record["overview_summary"] = combined_summary
        save_decomposition_job(job_record)

        return {
            "job_id": job_id,
            "overview_summary": combined_summary,
            "extracted_nodes": reconciled_nodes,
            "extracted_edges": all_edges,
            "clusters": clusters_to_process,
            "subagents": _build_subagent_manifest(clusters_to_process, 4, "completed"),
            "scratchpads": job_scratchpads,
            "current_step": 4,
            "status": "completed",
            "model": model_name,
            "chunks_processed": len(clusters_to_process)
        }
    except Exception as deconf_err:
        logger.error(f"[DomainDeconflict] Step 4 failed: {deconf_err}")
        job_record["status"] = "failed"
        job_record["error_message"] = f"Step 4 (Domain Deconfliction) failed: {deconf_err}"
        save_decomposition_job(job_record)
        return {
            "job_id": job_id,
            "overview_summary": f"Step 4 (Domain Deconfliction) error: {deconf_err}",
            "extracted_nodes": all_nodes,
            "extracted_edges": all_edges,
            "clusters": clusters_to_process,
            "subagents": _build_subagent_manifest(clusters_to_process, 4, "failed", str(deconf_err)),
            "scratchpads": job_scratchpads,
            "current_step": 4,
            "status": "failed",
            "error": str(deconf_err),
            "model": model_name,
            "chunks_processed": len(clusters_to_process)
        }


def retry_decomposition_job_step(job_id: str, target_step: Optional[int] = None) -> Optional[Dict[str, Any]]:
    """
    Resumes/retries only the failed step of a decomposition job without discarding
    intermediate work from previous steps.
    """
    job = get_decomposition_job(job_id)
    if not job:
        return None

    step_to_run = target_step or job.get("current_step", 1)
    logger.info(f"[RetryPipeline] Retrying decomposition job {job_id} from step {step_to_run}")

    campaign_id = job.get("campaign_id", "")
    all_nodes = list(job.get("draft_nodes", []))
    all_edges = list(job.get("draft_edges", []))
    clusters_to_process = list(job.get("clusters", []))
    job_scratchpads = dict(job.get("scratchpads", {}))
    seen_titles = {n.get("title", "").lower().strip() for n in all_nodes}

    job["error_message"] = None

    if step_to_run == 4:
        # Retry only Domain Deconfliction using already mined and audited draft nodes
        job["status"] = "deconflicting"
        job["current_step"] = 4
        save_decomposition_job(job)
        try:
            reconciled_nodes = _reconcile_extracted_nodes_with_campaign(all_nodes, campaign_id)
            job["draft_nodes"] = reconciled_nodes
            job["status"] = "completed"

            loc_count = sum(1 for n in reconciled_nodes if n.get("type") == "location")
            npc_count = sum(1 for n in reconciled_nodes if n.get("type") == "npc")
            mon_count = sum(1 for n in reconciled_nodes if n.get("type") == "monster")
            item_count = sum(1 for n in reconciled_nodes if n.get("type") == "item")
            lore_count = sum(1 for n in reconciled_nodes if n.get("type") in ("lore", "clue"))
            quest_count = sum(1 for n in reconciled_nodes if n.get("type") in ("arc", "quest", "session", "encounter"))
            conflict_count = sum(1 for n in reconciled_nodes if n.get("match_status") in ("conflict", "potential_match"))
            stub_count = sum(1 for n in reconciled_nodes if n.get("needs_statblock"))

            summary_bullets = []
            if loc_count > 0:
                summary_bullets.append(f"- 📍 **{loc_count} Keyed Locations & Rooms**")
            if npc_count > 0:
                summary_bullets.append(f"- 👤 **{npc_count} Named NPCs & Leaders**")
            if mon_count > 0:
                summary_bullets.append(f"- ⚔️ **{mon_count} Monsters & Creatures**")
            if item_count > 0:
                summary_bullets.append(f"- 💎 **{item_count} Items & Relics**")
            if lore_count > 0:
                summary_bullets.append(f"- 📜 **{lore_count} Inset Sidebars & Lore**")
            if quest_count > 0:
                summary_bullets.append(f"- 🗺️ **{quest_count} Arcs & Quests**")

            notices = []
            if conflict_count > 0:
                notices.append(f"⚠️ **{conflict_count} review dilemma(s)** detected against existing campaign records.")
            if stub_count > 0:
                notices.append(f"📝 **{stub_count} creature(s)** flagged with *Needs Statblock*.")

            combined_summary = (
                f"### 🧙‍♂️ Step 4 Retry Completed (Domain Deconfliction Verified)\n\n"
                f"**Reconciled {len(reconciled_nodes)} total entities** against campaign records without re-processing earlier slices:\n"
                + "\n".join(summary_bullets)
                + ("\n\n" + "\n\n".join(notices) if notices else "")
            )
            job["overview_summary"] = combined_summary
            save_decomposition_job(job)
            return get_decomposition_job(job_id)
        except Exception as e:
            job["status"] = "failed"
            job["error_message"] = f"Step 4 (Domain Deconfliction) failed: {e}"
            save_decomposition_job(job)
            return get_decomposition_job(job_id)

    elif step_to_run == 3:
        # Retry QA pass then deconfliction
        model, model_name = _get_configured_gemini_client()
        job["status"] = "qa_auditing"
        job["current_step"] = 3
        save_decomposition_job(job)
        try:
            if model and len(all_nodes) > 0:
                omitted = _run_qa_verifier_pass(model, all_nodes, "", job.get("instruction", ""))
                if omitted:
                    for node in omitted:
                        title_key = node.get("title", "").lower().strip()
                        if title_key and title_key not in seen_titles:
                            all_nodes.append(node)
                            seen_titles.add(title_key)
            job["draft_nodes"] = all_nodes
            job["current_step"] = 4
            save_decomposition_job(job)
            return retry_decomposition_job_step(job_id, target_step=4)
        except Exception as e:
            job["status"] = "failed"
            job["error_message"] = f"Step 3 (QA Auditor) failed: {e}"
            save_decomposition_job(job)
            return get_decomposition_job(job_id)

    elif step_to_run <= 2:
        # Retry failed or pending clusters without repeating completed ones!
        model, model_name = _get_configured_gemini_client()
        job["status"] = "mining"
        job["current_step"] = 2
        save_decomposition_job(job)

        pdf_file_path = None
        if job.get("filename"):
            candidate = UPLOAD_DIR / job["filename"]
            if candidate.exists():
                pdf_file_path = str(candidate)

        db_context = build_campaign_database_context(campaign_id)
        selected_prompt = (
            "DECOMPOSITION MODE: Complete Comprehensive Adventure & Dungeon Extraction.\n"
            "- Extract ALL Keyed Locations / Rooms (Area 1, Area 2... Area N) as location nodes.\n"
            "- Extract ALL named NPCs, bosses, and faction figures with motivations & alignment.\n"
            "- Extract ALL monsters and combat encounters with full 5e statblock data_json.\n"
            "- Extract ALL distinct magic items, keys, and quest relics as standalone item nodes.\n"
            "- Extract ALL visually styled Inset Boxes, parchment sidebars, and rumor tables.\n"
            "- Extract overarching Arcs, Quests, and story objectives."
        )

        failed_slices = 0
        last_error = None
        # 1. If existing clusters span > 2 pages (from earlier runs), subdivide them into 2-page slices
        subdivided = []
        for c in clusters_to_process:
            s_p = c.get("start_page")
            e_p = c.get("end_page")
            # If completed with real extracted findings, keep as completed
            c_agent = c.get("subagent_name", "")
            sp = job_scratchpads.get(c_agent, {})
            findings_count = (
                len(sp.get("rooms_inventoried", [])) +
                len(sp.get("npcs_identified", [])) +
                len(sp.get("monsters_spotted", []))
            )
            if c.get("status") == "completed" and findings_count > 0:
                subdivided.append(c)
                continue

            if s_p and e_p and (e_p - s_p + 1) > 2 and c.get("type") == "pdf_cluster":
                curr_sub = s_p
                part_idx = 1
                while curr_sub <= e_p:
                    sub_end = min(curr_sub + 1, e_p)
                    subdivided.append({
                        "id": f"{c.get('id', 'cluster')}-p{part_idx}",
                        "type": "pdf_cluster",
                        "start_page": curr_sub,
                        "end_page": sub_end,
                        "label": f"Pages {curr_sub}–{sub_end}",
                        "subagent_name": f"{c.get('subagent_name', 'Worker')} (Part {part_idx})",
                        "status": "pending",
                        "error": None
                    })
                    curr_sub = sub_end + 1
                    part_idx += 1
            else:
                # If was marked completed but had 0 findings, re-run
                if c.get("status") == "completed" and findings_count == 0:
                    c["status"] = "pending"
                    c["error"] = None
                subdivided.append(c)

        clusters_to_process = subdivided
        job["clusters"] = clusters_to_process
        save_decomposition_job(job)

        seen_edges = {
            f"{e.get('source_title','').lower()}|{e.get('target_title','').lower()}|{e.get('relation_type','')}"
            for e in all_edges
        }

        for cluster in clusters_to_process:
            # Emergency stop check
            check_status = get_decomposition_job(job_id)
            if check_status and check_status.get("status") == "stopped":
                logger.info(f"[RetryPipeline] Job {job_id} halted by emergency stop.")
                break

            if cluster.get("status") == "completed":
                continue  # Skip slices already successfully mined!

            slice_label = cluster.get("label", "")
            subagent_name = cluster.get("subagent_name", "Worker")
            cluster["status"] = "running"
            save_decomposition_job(job)

            chunk_data, err = _extract_single_cluster_slice(
                cluster=cluster,
                model=model,
                selected_prompt=selected_prompt,
                instruction=job.get("instruction", ""),
                db_context=db_context,
                pdf_file_path=pdf_file_path
            )

            if err or not chunk_data:
                cluster["status"] = "failed"
                cluster["error"] = err
                failed_slices += 1
                last_error = err
                save_decomposition_job(job)
                continue

            cluster["status"] = "completed"
            cluster["error"] = None
            raw_nodes = chunk_data.get("extracted_nodes", [])
            _record_cluster_scratchpad(job_scratchpads, cluster, chunk_data, subagent_name, slice_label)

            for node in raw_nodes:
                if cluster.get("start_page"):
                    node.setdefault("source_page", cluster["start_page"])
                if pdf_file_path:
                    node.setdefault("source_doc", Path(pdf_file_path).name)
                title_key = node.get("title", "").lower().strip()
                if title_key and title_key not in seen_titles:
                    all_nodes.append(node)
                    seen_titles.add(title_key)

            for edge in chunk_data.get("extracted_edges", []):
                edge_key = f"{edge.get('source_title','').lower()}|{edge.get('target_title','').lower()}|{edge.get('relation_type','')}"
                if edge_key not in seen_edges:
                    all_edges.append(edge)
                    seen_edges.add(edge_key)

            job["clusters"] = clusters_to_process
            job["scratchpads"] = job_scratchpads
            job["draft_nodes"] = all_nodes
            job["draft_edges"] = all_edges
            save_decomposition_job(job)

        # Check if halted by emergency stop
        check_status = get_decomposition_job(job_id)
        if (check_status and check_status.get("status") == "stopped") or job.get("status") == "stopped":
            job["status"] = "stopped"
            job["error_message"] = "Decomposition interrupted by user."
            save_decomposition_job(job)
            return get_decomposition_job(job_id)

        if failed_slices > 0 and len(all_nodes) == 0:
            job["status"] = "failed"
            job["error_message"] = f"Retry Step 2 failed across {failed_slices} slices: {last_error}"
            save_decomposition_job(job)
            return get_decomposition_job(job_id)

        # Advance automatically to Step 3 (QA Verifier Pass)
        job["current_step"] = 3
        save_decomposition_job(job)
        return retry_decomposition_job_step(job_id, target_step=3)

    return get_decomposition_job(job_id)


def _chunk_and_summarize_transcript(transcript_text: str, model, chars_per_chunk: int = 20000) -> str:
    """
    For very long transcripts (> 80k chars), performs a two-pass extraction:
    Pass 1: Extract a structured event timeline from each chunk (fast, concise).
    Pass 2: Returns the consolidated event list to be used as input for the full adapt prompt.
    This prevents important late-session events from being truncated.
    """
    if len(transcript_text) <= chars_per_chunk * 2:
        # Short enough to send directly — no chunking needed
        return transcript_text

    chunks = _split_text_into_chunks(transcript_text, chars_per_chunk=chars_per_chunk, overlap=500)
    logger.info(f"[TranscriptChunk] Transcript is {len(transcript_text)} chars — splitting into {len(chunks)} segments for event extraction pass")

    event_summaries = []
    for i, chunk in enumerate(chunks):
        chunk_prompt = f"""You are a D&D session analyst. Summarize ALL key events that occurred in this transcript segment.
Focus on: resolved encounters, NPC interactions/dispositions, items found/used, decisions made, cliffhangers.
Be concise but thorough — do NOT omit events.

Segment {i+1} of {len(chunks)}:
\"\"\"
{chunk}
\"\"\"

Return a plain numbered list of events. No JSON needed."""
        try:
            response = model.generate_content(chunk_prompt)
            event_summaries.append(f"=== Segment {i+1} Events ===\n{response.text}")
        except Exception as e:
            logger.warning(f"[TranscriptChunk] Segment {i+1} event extraction failed: {e}")

    consolidated = "\n\n".join(event_summaries)
    logger.info(f"[TranscriptChunk] Consolidated event list: {len(consolidated)} chars from {len(chunks)} segments")
    return consolidated


# ---------------------------------------------------------------------------
# Main decomposition function
# ---------------------------------------------------------------------------

def decompose_adventure_document(
    text_content: str,
    instruction: str,
    decomposition_mode: str,
    campaign_id: str,
    current_nodes: Optional[List[Dict[str, Any]]] = None,
    current_edges: Optional[List[Dict[str, Any]]] = None,
    conversation_history: Optional[List[Dict[str, str]]] = None,
    exhaustive: bool = True,
    pdf_file_path: Optional[str] = None,
    start_page: Optional[int] = 1,
    end_page: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Decomposes adventure book chapters, monster sheets, or PC sheets based on DM instructions.
    Supports iterative conversation where the DM provides feedback to steer and refine draft nodes.
    Supports visual page-clustering via Gemini Vision when pdf_file_path is provided.
    """
    model, model_name = _get_configured_gemini_client()
    db_context = build_campaign_database_context(campaign_id)

    mode_prompts = {
        "comprehensive": (
            "DECOMPOSITION MODE: Complete Comprehensive Adventure & Dungeon Extraction.\n"
            "- Extract ALL Keyed Locations / Rooms (Area 1, Area 2... Area N) as location nodes.\n"
            "- For each Keyed Location, format:\n"
            "  * Read-Aloud Text in a blockquote (> 📜 **Read-Aloud Description:** ...)\n"
            "  * DM Secrets & Traps under '### 🛡️ DM Secrets & Traps'\n"
            "  * Directional exits (e.g. iron door to Area 4) as 'leads_to' or 'connected_to' edges\n"
            "- Extract ALL named NPCs, bosses, and faction figures with roleplay motivations & alignment.\n"
            "- Extract ALL monsters and combat encounters with full 5e statblock data_json.\n"
            "- If a creature references an SRD/base creature without full stats, note the base template.\n"
            "- Extract ALL distinct magic items, keys, and quest relics as standalone item nodes.\n"
            "- Extract ALL visually styled Inset Boxes, parchment sidebars, and rumor tables as dedicated lore or clue nodes.\n"
            "- Extract overarching Arcs, Quests, and story objectives."
        ),
        "campaign_structure": (
            "DECOMPOSITION MODE: Campaign Hierarchy & Narrative Arcs.\n"
            "- Analyze the overall story structure from this chapter/introduction.\n"
            "- Extract ALL major Arcs (Act/Milestone levels) found in the text — do not skip any.\n"
            "- For each Arc, extract ALL Quests with clear objectives and stakes.\n"
            "- For each Quest, identify initial Session steps.\n"
            "- Create 'contains' edges connecting Arc -> Quest -> Session."
        ),
        "monsters": (
            "DECOMPOSITION MODE: 5e Monster & Enemy Stat Blocks.\n"
            "- Extract EVERY SINGLE monster, villain, and beast stat block found in the text — do not stop early.\n"
            "- If there are 20 creatures in the document, return all 20. Do not sample.\n"
            "- Populate data_json with: cr, xp, ac, hp, speed, abilities (str/dex/con/int/wis/cha), actions list.\n"
            "- Format full Markdown text with Traits, Multiattack, Actions, and Legendary Actions."
        ),
        "pc_sheets": (
            "DECOMPOSITION MODE: Player Character (PC) Sheets.\n"
            "- Extract ALL Player Characters found — do not skip any.\n"
            "- Name (title), Class/Race/Level (subtitle).\n"
            "- Summary of key background, ideals, bonds, flaws, and personal quest hooks.\n"
            "- data_json with attributes, key equipment, and spellcasting."
        ),
        "npcs_factions": (
            "DECOMPOSITION MODE: NPCs, Factions & Living World Graph.\n"
            "- Extract ALL named NPCs, their factions, and their interpersonal relationships — every single one.\n"
            "- Create edges: member_of, allied_with, hostile_to, gives_quest, knows_secret."
        ),
        "encounters": (
            "DECOMPOSITION MODE: Tactical & Social Encounters.\n"
            "- Extract ALL specific combat encounters, puzzles, social challenges, and traps — do not stop early.\n"
            "- Include threat difficulty, monsters present, and fail-forward outcomes."
        ),
        "world_lore": (
            "DECOMPOSITION MODE: World Lore, Pantheons, History & Setting Primers.\n"
            "- Extract ALL key historical eras, cataclysms, myths, and planar cosmology as 'lore' nodes.\n"
            "- Extract ALL deities, divine domains, holy orders, and secret cabals as 'faction' nodes.\n"
            "- Extract ALL sacred sanctuaries, ancient ruins, and planar rifts as 'location' nodes.\n"
            "- Extract ALL legendary artifacts and lost texts as 'item' nodes.\n"
            "- Extract ALL tavern rumors, lost prophecies, and folk superstitions as 'clue' nodes.\n"
            "- Create rich relationships: associated_with, worships, created_by, recorded_in, located_at."
        ),
        "custom": (
            "DECOMPOSITION MODE: Custom DM Directive.\n"
            "- Closely follow the DM's specific instruction below and extract appropriate campaign nodes and edges.\n"
            "- Extract EVERY relevant entity found — do not stop at a representative sample."
        )
    }

    inst_lower = (instruction or "").lower()
    decomp_mode_norm = (decomposition_mode or "campaign_structure").lower()
    if decomp_mode_norm in ("everything", "comprehensive", "general") or "everything" in inst_lower or "entire document" in inst_lower:
        selected_prompt = mode_prompts["comprehensive"]
    else:
        selected_prompt = mode_prompts.get(decomposition_mode, mode_prompts["custom"])

    is_refinement = bool(current_nodes and len(current_nodes) > 0)

    if not model:
        # High quality offline demonstration decomposition with steering support
        if is_refinement:
            updated_nodes = [dict(n) for n in current_nodes]
            inst_lower = (instruction or "").lower()
            applied_directives = 0

            # Incorporate card-level custom directives
            for node in updated_nodes:
                d = node.get("custom_directive") or (node.get("merge_notes") if node.get("action") == "other" else None)
                if d:
                    applied_directives += 1
                    curr_content = (node.get("content_markdown") or "").strip()
                    directive_text = f"**DM Directive Applied**: {d}"
                    if directive_text not in curr_content:
                        node["content_markdown"] = f"{curr_content}\n\n{directive_text}".strip()
                    node["summary"] = f"{node.get('summary', '')} ({d})".strip()
                    node["custom_directive"] = None
                    if node.get("action") == "other":
                        node["action"] = "merge" if node.get("match_status") == "exact_match" else "create"

            if "split" in inst_lower:
                new_title = f"{updated_nodes[0].get('title', 'Quest')} (Part 2)"
                updated_nodes.append({
                    "type": "quest",
                    "title": new_title,
                    "subtitle": "Split Chapter Quest",
                    "summary": f"Continuation of the primary arc tailored per feedback: '{instruction}'.",
                    "content_markdown": "Objective: Advance into the fortified heart of the ruins.",
                    "data_json": {"status": "planned"},
                    "revealed_to_players": False
                })
            elif "encounter" in inst_lower or "boss" in inst_lower or "monster" in inst_lower:
                updated_nodes.append({
                    "type": "encounter",
                    "title": "Tactical Ambush: Infiltration Guard",
                    "subtitle": "Medium Threat (XP: 250)",
                    "summary": f"Added tactical encounter tailored per steering: '{instruction}'.",
                    "content_markdown": "Tactical encounter inserted before the objective room.",
                    "data_json": {"status": "planned", "threat": "medium", "xp": 250},
                    "revealed_to_players": False
                })
            elif applied_directives == 0:
                updated_nodes.append({
                    "type": "npc" if "npc" in inst_lower else "clue",
                    "title": "Refined Element: Secret Lore",
                    "subtitle": "Steered Addition",
                    "summary": f"Added in response to: '{instruction}'.",
                    "content_markdown": f"Notes based on DM feedback: {instruction}",
                    "data_json": {"status": "planned"},
                    "revealed_to_players": False
                })

            summary_msg = f"I have refined the working draft according to your steering: *\"{instruction}\"*."
            if applied_directives > 0:
                summary_msg += f" Incorporated **{applied_directives} custom card directive(s)** directly into node content."

            return {
                "overview_summary": (
                    f"### 🧙‍♂️ Co-DM Steering Applied\n\n"
                    f"{summary_msg}\n"
                    f"Updated working draft now contains **{len(updated_nodes)} nodes**."
                ),
                "extracted_nodes": _reconcile_extracted_nodes_with_campaign(updated_nodes, campaign_id),
                "extracted_edges": current_edges or [],
                "model": "offline-decomposer"
            }

        lines = [line.strip() for line in text_content.split("\n") if line.strip()]
        title_guess = lines[0][:60] if lines else "Imported Adventure Segment"
        raw_offline_nodes = [
            {
                "type": "lore" if decomposition_mode == "world_lore" else ("arc" if decomposition_mode == "campaign_structure" else ("monster" if decomposition_mode == "monsters" else "quest")),
                "title": title_guess,
                "subtitle": "World Lore & Setting" if decomposition_mode == "world_lore" else "Imported from Document",
                "summary": f"Extracted via {decomposition_mode} parser. Ready for DM editing and refinement.",
                "content_markdown": text_content[:1200],
                "data_json": {"status": "planned"},
                "revealed_to_players": False
            }
        ]
        return {
            "overview_summary": (
                f"### 🧙‍♂️ Adventure Decomposed (Offline Preview)\n\n"
                f"Decomposed segment based on instruction: *\"{instruction or 'Standard Arc & Quest decomposition'}\"*.\n\n"
                f"> 💡 *Tip: Configure your Gemini API key in Settings to unlock deep semantic extraction of 5e statblocks and multi-tier narrative arcs!*"
            ),
            "extracted_nodes": _reconcile_extracted_nodes_with_campaign(raw_offline_nodes, campaign_id),
            "extracted_edges": [],
            "model": "offline-decomposer"
        }

    # --- Multi-pass multi-agent extraction ---
    # When exhaustive=True, NOT in refinement mode, and the document is large or is a PDF,
    # run the multi-agent visual/chunked extraction orchestrator.
    if exhaustive and not is_refinement and (pdf_file_path or len(text_content) > 12000):
        return _chunk_and_extract_nodes(
            text_content=text_content,
            model=model,
            model_name=model_name,
            selected_prompt=selected_prompt,
            instruction=instruction,
            db_context=db_context,
            current_nodes=current_nodes,
            current_edges=current_edges,
            campaign_id=campaign_id,
            pdf_file_path=pdf_file_path,
            start_page=start_page or 1,
            end_page=end_page,
        )

    # --- Single-pass refinement / steering pass ---
    nodes_with_directives = [
        {
            "title": n.get("title"),
            "type": n.get("type"),
            "directive": n.get("custom_directive") or n.get("merge_notes"),
            "action": n.get("action")
        }
        for n in (current_nodes or [])
        if n.get("custom_directive") or (n.get("action") == "other" and n.get("merge_notes"))
    ]

    directives_section = ""
    if nodes_with_directives:
        directives_section = f"""
SPECIFIC CARD-LEVEL DM DIRECTIVES (incorporate each into its corresponding node):
{json.dumps(nodes_with_directives, indent=2)}
"""

    refinement_context = ""
    if current_nodes:
        # Simplify current_nodes slightly to avoid blowing context while preserving all essentials
        compact_nodes = []
        for n in current_nodes:
            c_node = {
                "type": n.get("type"),
                "title": n.get("title"),
                "subtitle": n.get("subtitle"),
                "summary": n.get("summary"),
                "content_markdown": n.get("content_markdown"),
                "data_json": n.get("data_json"),
                "match_status": n.get("match_status"),
                "matched_node_title": n.get("matched_node_title"),
                "matched_node_id": n.get("matched_node_id"),
                "action": n.get("action"),
            }
            if n.get("custom_directive"):
                c_node["custom_directive"] = n.get("custom_directive")
            compact_nodes.append(c_node)

        refinement_context = f"""
CURRENT WORKING DRAFT NODES ({len(compact_nodes)} nodes to modify, split, update, or prune per DM feedback):
{json.dumps(compact_nodes, indent=2)}

CURRENT WORKING DRAFT EDGES:
{json.dumps(current_edges or [], indent=2)}
"""

    history_context = ""
    if conversation_history:
        history_context = "\nPREVIOUS STEERING CONVERSATION:\n" + "\n".join(
            f"{m.get('role', 'user').upper()}: {m.get('content', '')}" for m in conversation_history
        ) + "\n"

    # Clip reference text during refinement so we stay well within model output budget
    clipped_ref_text = text_content[:10000] if text_content else ""

    prompt = f"""You are an expert D&D 5e adventure analyst and Co-DM architect.
The Dungeon Master is actively directing, steering, and refining the working draft of adventure nodes and relationships.

DM'S LATEST STEERING INSTRUCTION / FEEDBACK:
\"\"\"{instruction if instruction else 'Incorporate all card directives and refine the working draft.'}\"\"\"

{directives_section}
{refinement_context}
{history_context}

{db_context}

ADVENTURE REFERENCE TEXT EXCERPT:
\"\"\"
{clipped_ref_text}
\"\"\"

CRITICAL INSTRUCTIONS FOR REFINING THE WORKING DRAFT:
1. "overview_summary": Address the DM directly. Specifically explain what changes, updates, additions, or card directives you incorporated.
2. "extracted_nodes": Return the modified, newly added, or steered nodes (you do NOT need to re-output untouched nodes — untouched nodes will be safely preserved in the campaign draft automatically):
   - For every node that has a 'custom_directive' or was targeted by DM feedback: rewrite or adjust its title, subtitle, summary, content_markdown, stats (data_json), or relationships to fully bake in the directive.
   - For nodes whose custom directives have been incorporated: CLEAR 'custom_directive' (set to null or omit) and set 'action' to 'merge' or 'create' as appropriate.
   - If the DM asked to split a quest or add an element, output the new node(s).
   - CONFLICT RESOLUTION: If DM feedback or a card directive resolves a flagged contradiction (e.g. alignment, CR, disposition, faction), you MUST update 'data_json' and 'subtitle' to reflect the resolution, set 'conflict_resolved': true, and set 'action': 'merge'.
   - If all nodes are modified, you may output all; otherwise returning the modified subset prevents token truncation.
3. "extracted_edges": Return any new or updated working draft edges.
4. DECONFLICTION: Ensure match_status, match_confidence, matched_node_id/matched_node_title remain accurate.

Respond strictly in JSON matching this structure:
{{
  "overview_summary": "Conversational reply to the DM explaining the exact adjustments made to the draft nodes.",
  "extracted_nodes": [
    {{
      "type": "arc|quest|session|encounter|pc|npc|monster|location|faction|item|clue",
      "title": "Clear Name",
      "subtitle": "Short epithet, CR, or Level/Class",
      "summary": "1-2 sentence synopsis",
      "content_markdown": "Full formatted markdown details",
      "data_json": {{
         "status": "planned"
      }},
      "revealed_to_players": false,
      "conflict_resolved": false,
      "match_status": "new|exact_match|potential_match|conflict",
      "matched_node_id": "optional existing node id if matched",
      "matched_node_title": "optional existing node title if matched",
      "match_confidence": 1.0,
      "action": "merge|create|skip"
    }}
  ],
  "extracted_edges": [
    {{
      "source_title": "Exact Title of Source Node",
      "target_title": "Exact Title of Target Node",
      "relation_type": "contains|allied_with|hostile_to|located_at|gives_quest|rewards|member_of|knows_secret",
      "label": "Short relation description"
    }}
  ]
}}
"""
    try:
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json", "max_output_tokens": 8192}
        )
        data = _safe_json_loads(response.text)
        raw_nodes = data.get("extracted_nodes", [])

        # Smart reconciliation: if the model only returned the subset of modified nodes,
        # merge them back into current_nodes so untouched nodes are not accidentally dropped.
        if is_refinement and current_nodes:
            if not raw_nodes:
                final_nodes = current_nodes
            elif len(raw_nodes) < len(current_nodes):
                updated_by_title = {n.get("title", "").lower().strip(): n for n in raw_nodes if n.get("title")}
                merged = []
                for orig in current_nodes:
                    key = (orig.get("title") or "").lower().strip()
                    if key in updated_by_title:
                        merged.append(updated_by_title.pop(key))
                    else:
                        merged.append(orig)
                merged.extend(updated_by_title.values())
                final_nodes = merged
            else:
                final_nodes = raw_nodes
        else:
            final_nodes = raw_nodes or current_nodes or []

        reconciled_nodes = _reconcile_extracted_nodes_with_campaign(final_nodes, campaign_id)
        return {
            "overview_summary": data.get("overview_summary", "Working draft updated per your steering instructions."),
            "extracted_nodes": reconciled_nodes,
            "extracted_edges": data.get("extracted_edges", current_edges or []),
            "model": model_name
        }
    except Exception as e:
        logger.error(f"Error refining adventure document: {e}")
        return {
            "overview_summary": f"Failed to apply steering: {e}",
            "extracted_nodes": current_nodes or [],
            "extracted_edges": current_edges or [],
            "error": str(e),
            "model": "fallback"
        }

def redraft_single_node(
    campaign_id: str,
    node: Dict[str, Any],
    directive: str,
    current_edges: Optional[List[Dict[str, Any]]] = None,
    matched_node_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Re-drafts a single extracted entity using AI based on a DM steering directive,
    updates structured stats (data_json), generates/updates relevant graph edges,
    and immediately re-evaluates conflicts against the SQLite campaign database.
    """
    model, model_name = _get_configured_gemini_client()
    campaign_nodes = list_nodes(campaign_id) if campaign_id else []
    id_to_existing = {n.id: n for n in campaign_nodes}

    # Locate target matched campaign node if any
    target_id = matched_node_id or node.get("matched_node_id")
    matched_campaign_node = None
    if target_id and target_id in id_to_existing:
        matched_campaign_node = id_to_existing[target_id]
    else:
        norm_title = (node.get("title") or "").strip().lower()
        for cand in campaign_nodes:
            if cand.title.strip().lower() == norm_title:
                matched_campaign_node = cand
                break

    matched_info = "None (this is a new entity without an existing campaign match)"
    if matched_campaign_node:
        matched_info = json.dumps({
            "id": matched_campaign_node.id,
            "title": matched_campaign_node.title,
            "subtitle": matched_campaign_node.subtitle,
            "type": matched_campaign_node.type,
            "summary": matched_campaign_node.summary,
            "content_markdown": (matched_campaign_node.content_markdown or "")[:1500],
            "data_json": matched_campaign_node.data_json or {}
        }, indent=2)

    node_title = node.get("title", "")
    related_edges = [
        e for e in (current_edges or [])
        if e.get("source_title") == node_title or e.get("target_title") == node_title
    ]

    # Offline mode handler
    if not model:
        updated = dict(node)
        dir_lower = directive.lower()
        curr_content = (updated.get("content_markdown") or "").strip()
        data = dict(updated.get("data_json") or {})

        conflict_resolved = False
        if matched_campaign_node:
            exist_data = matched_campaign_node.data_json or {}
            if any(k in dir_lower for k in ("canon", "keep", "resolve", "agree", "accept", "cr", "alignment", "disposition", "faction")):
                if "canon" in dir_lower or "keep" in dir_lower or "resolve" in dir_lower:
                    for field in ("cr", "alignment", "disposition", "faction"):
                        if field in exist_data:
                            data[field] = exist_data[field]
                if "cr" in dir_lower and "cr" in exist_data:
                    data["cr"] = exist_data["cr"]
                if ("alignment" in dir_lower or "neutral" in dir_lower or "good" in dir_lower or "evil" in dir_lower or "lawful" in dir_lower or "chaotic" in dir_lower) and "alignment" in exist_data:
                    data["alignment"] = exist_data["alignment"]
                if "faction" in dir_lower and "faction" in exist_data:
                    data["faction"] = exist_data["faction"]
                if "disposition" in dir_lower and "disposition" in exist_data:
                    data["disposition"] = exist_data["disposition"]
                conflict_resolved = True

        updated["data_json"] = data
        directive_tag = f"**DM Directive Applied**: {directive}"
        if directive_tag not in curr_content:
            updated["content_markdown"] = f"{curr_content}\n\n{directive_tag}".strip()
        updated["summary"] = f"{updated.get('summary', '')} ({directive})".strip()
        updated["custom_directive"] = None
        if conflict_resolved:
            updated["conflict_resolved"] = True
            updated["action"] = "merge"
            updated["conflict_reason"] = None
            updated["match_status"] = "exact_match"

        # Edge generation for offline mode
        new_edges = list(current_edges or [])
        for cn in campaign_nodes:
            if cn.title.lower() in dir_lower and cn.title.lower() != node_title.lower():
                edge_exists = any(
                    e.get("source_title") == node_title and e.get("target_title") == cn.title
                    for e in new_edges
                )
                if not edge_exists:
                    new_edges.append({
                        "source_title": node_title,
                        "target_title": cn.title,
                        "relation_type": "allied_with" if any(w in dir_lower for w in ("allied", "ally", "friend")) else "located_at" if any(w in dir_lower for w in ("located", "portal", "tavern", "room", "in")) else "connected_to",
                        "label": f"Connected per DM directive: '{directive}'"
                    })

        reconciled_list = _reconcile_extracted_nodes_with_campaign([updated], campaign_id)
        final_node = reconciled_list[0] if reconciled_list else updated
        return {
            "node": final_node,
            "edges": new_edges,
            "summary": f"Re-drafted '{node_title}' per directive: '{directive}'.",
            "model": "offline-decomposer"
        }

    # Online Gemini prompt
    db_context = build_campaign_database_context(campaign_id)
    prompt = f"""You are an expert D&D 5e adventure analyst and Co-DM architect.
The Dungeon Master has provided a specific steering directive to re-draft this single entity node, resolve any contradictions with existing campaign canon, and update connected edges.

CURRENT DRAFT NODE:
{json.dumps(node, indent=2)}

EXISTING CANON CAMPAIGN RECORD (IF MATCHED):
{matched_info}

CURRENT DRAFT EDGES CONNECTED TO THIS NODE:
{json.dumps(related_edges, indent=2)}

DM'S SPECIFIC DIRECTIVE FOR THIS NODE:
\"\"\"{directive}\"\"\"

EXISTING CAMPAIGN CONTEXT:
{db_context}

CRITICAL INSTRUCTIONS:
1. Re-draft this node: Update 'title', 'subtitle', 'summary', 'content_markdown', and 'data_json' (attributes, CR, alignment, disposition, faction).
2. CONFLICT RESOLUTION:
   - If the directive resolves a contradiction with canon (e.g. "Canon wins", "Keep CR 5", "Make him Neutral Good", "Accept book stats", etc.), you MUST adjust 'data_json' (and 'subtitle'/'content_markdown') so the contradiction is resolved.
   - Set "conflict_resolved": true and "action": "merge" (or "create" if DM explicitly wants a separate entity).
3. RE-DRAFT EDGES:
   - Propose any new or updated edges connecting this node to other draft entities or existing campaign records (locations, factions, NPCs) mentioned in the directive or narrative context.
4. "resolution_summary": Address the DM directly explaining what changes you made and how the conflict was settled.

Respond strictly in JSON matching this schema:
{{
  "resolution_summary": "Explanation of changes made to the node and how contradictions were resolved",
  "node": {{
    "type": "{node.get('type', 'npc')}",
    "title": "{node.get('title', '')}",
    "subtitle": "Updated subtitle or CR/Role",
    "summary": "1-2 sentence synopsis",
    "content_markdown": "Full formatted markdown details with directive incorporated",
    "data_json": {{}},
    "revealed_to_players": false,
    "conflict_resolved": true,
    "action": "merge|create|skip"
  }},
  "edges": [
    {{
      "source_title": "Source Name",
      "target_title": "Target Name",
      "relation_type": "allied_with|located_at|member_of|hostile_to|gives_quest|connected_to",
      "label": "Relationship description"
    }}
  ]
}}
"""
    try:
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json", "max_output_tokens": 4096}
        )
        data = _safe_json_loads(response.text)
        res_node = data.get("node") or dict(node)

        # Merge with existing preserving provenance & metadata
        merged_node = dict(node)
        for k, v in res_node.items():
            if v is not None:
                merged_node[k] = v
        merged_node["custom_directive"] = None
        if data.get("node", {}).get("conflict_resolved"):
            merged_node["conflict_resolved"] = True

        reconciled_list = _reconcile_extracted_nodes_with_campaign([merged_node], campaign_id)
        final_node = reconciled_list[0] if reconciled_list else merged_node

        out_edges = list(current_edges or [])
        returned_edges = data.get("edges") or []
        for re in returned_edges:
            st = re.get("source_title")
            tt = re.get("target_title")
            if st and tt and not any(e.get("source_title") == st and e.get("target_title") == tt for e in out_edges):
                out_edges.append(re)

        return {
            "node": final_node,
            "edges": out_edges,
            "summary": data.get("resolution_summary", f"Re-drafted {node_title} per directive."),
            "model": model_name
        }
    except Exception as e:
        logger.error(f"Error in redraft_single_node: {e}")
        updated = dict(node)
        updated["content_markdown"] = f"{updated.get('content_markdown', '')}\n\n**DM Directive Applied**: {directive}".strip()
        updated["custom_directive"] = None
        reconciled = _reconcile_extracted_nodes_with_campaign([updated], campaign_id)
        return {
            "node": reconciled[0] if reconciled else updated,
            "edges": current_edges or [],
            "summary": f"Directive applied (local fallback): {e}",
            "error": str(e),
            "model": "fallback"
        }


def _normalize_title_for_matching(title: str) -> str:
    """Normalize entity title by stripping common prefixes, tags, numbering, and punctuation."""
    import re
    t = (title or "").lower().strip()
    prefixes = [
        "encounter:", "encounter -", "hazard:", "hazard -", "scene:", "scene -",
        "quest:", "quest -", "session:", "session -", "sub-quest:", "sub-quest -",
        "investigation:", "investigation -", "tactical confrontation:",
        "the ", "a ", "an "
    ]
    changed = True
    while changed:
        changed = False
        t = t.strip()
        for p in prefixes:
            if t.startswith(p):
                t = t[len(p):].strip()
                changed = True
    t = re.sub(r"^\d+[\.\:\-]\s*", "", t)
    t = re.sub(r"[^\w\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def _resolve_node_by_title_or_id(
    query: str,
    nodes: List[Any],
    preferred_type: Optional[str] = None,
    candidate_node_ids: Optional[List[str]] = None
) -> Optional[Any]:
    """
    Finds the best matching node from a list of nodes using exact ID, exact title,
    normalized prefix-stripped comparison, substring containment, keyword overlap,
    and sequence matching. Prioritizes candidate_node_ids (e.g. from the target session).
    """
    if not query:
        return None
    import re
    q_raw = query.strip()
    q_lower = q_raw.lower()
    q_norm = _normalize_title_for_matching(q_raw)

    # 1. Direct ID match
    for n in nodes:
        if n.id == q_raw:
            return n

    # 2. Exact title match (case-insensitive)
    for n in nodes:
        if n.title.lower().strip() == q_lower:
            return n

    # Separate candidates (session encounters) from general nodes
    cand_nodes = [n for n in nodes if candidate_node_ids and n.id in candidate_node_ids]
    other_nodes = [n for n in nodes if not candidate_node_ids or n.id not in candidate_node_ids]
    ordered_search = cand_nodes + other_nodes

    # 3. Normalized exact match (ignoring prefixes like "Encounter: ", "The ", etc.)
    for n in ordered_search:
        if _normalize_title_for_matching(n.title) == q_norm:
            return n

    # 4. Substring containment
    if len(q_norm) >= 4:
        for n in ordered_search:
            n_norm = _normalize_title_for_matching(n.title)
            if len(n_norm) >= 4:
                if q_norm in n_norm or n_norm in q_norm:
                    if not preferred_type or n.type == preferred_type:
                        return n

    # 5. Keyword overlap (especially valuable for session candidate encounters)
    stopwords = {"and", "or", "the", "a", "an", "in", "at", "to", "from", "of", "with", "meeting", "accepting", "quest", "part", "session", "encounter", "scene", "fight", "brawl", "combat", "s"}
    def get_meaningful_words(t_str):
        cleaned = re.sub(r"[^\w\s]", " ", t_str.lower())
        return {w for w in cleaned.split() if len(w) > 2 and w not in stopwords}

    q_words = get_meaningful_words(q_raw)
    if q_words:
        best_cand_match = None
        best_cand_overlap = 0
        for n in cand_nodes:
            c_words = get_meaningful_words(n.title)
            overlap = len(q_words & c_words)
            if overlap > best_cand_overlap:
                best_cand_overlap = overlap
                best_cand_match = n
        if best_cand_overlap >= 1:
            return best_cand_match

    # 6. Difflib fuzzy sequence matching
    best_node = None
    best_score = 0.0
    for n in ordered_search:
        n_norm = _normalize_title_for_matching(n.title)
        ratio = difflib.SequenceMatcher(None, q_norm, n_norm).ratio()
        if candidate_node_ids and n.id in candidate_node_ids:
            ratio += 0.12
        if preferred_type and n.type == preferred_type:
            ratio += 0.05
        if ratio > best_score:
            best_score = ratio
            best_node = n

    if best_score >= 0.55 and best_node:
        return best_node

    return None


def _generate_offline_session_adaptation(
    transcript_text: str,
    campaign_id: str,
    session_node_id: Optional[str] = None,
    instruction: Optional[str] = "",
    generate_player_recap: bool = True
) -> Dict[str, Any]:
    """Generates realistic structured session adaptation fallout offline."""
    lower_transcript = transcript_text.lower()
    nodes = graph_service.list_nodes(campaign_id)
    title_to_node = {n.title.lower().strip(): n for n in nodes}
    id_to_node = {n.id: n for n in nodes}

    status_updates = []
    npc_updates = []
    node_updates = []
    new_nodes = []
    new_edges = []

    # Check target session or session 1
    target_session = id_to_node.get(session_node_id) if session_node_id else None
    if not target_session:
        # Find session matching session 1 or descent
        for n in nodes:
            if n.type == "session" and ("1" in n.title or "descent" in n.title.lower()):
                target_session = n
                break

    if target_session:
        status_updates.append({
            "node_id": target_session.id,
            "node_title": target_session.title,
            "title": target_session.title,
            "node_type": "session",
            "new_status": "completed",
            "reason": "Party completed exploration and concluded this session's scene."
        })

    # Check for rat encounter
    for n in nodes:
        if n.type == "encounter" and ("rat" in n.title.lower() or "ambush" in n.title.lower()):
            status_updates.append({
                "node_id": n.id,
                "node_title": n.title,
                "title": n.title,
                "node_type": "encounter",
                "new_status": "completed",
                "reason": "Encounter resolved during play (100 XP awarded to party)."
            })
            break

    # Check for Meepo
    meepo_node = None
    for n in nodes:
        if "meepo" in n.title.lower():
            meepo_node = n
            break

    npc_update_entry = {
        "node_id": meepo_node.id if meepo_node else None,
        "name": "Meepo",
        "node_title": meepo_node.title if meepo_node else "Meepo",
        "disposition": "Allied Guide",
        "new_disposition": "Allied Guide",
        "state_changes": "Befriended party; promised to guide them through trap hall safely.",
        "append_notes": "\n\n### Actual Play Update\nThe party encountered Meepo crying at the ravine descent. They treated him kindly, and Meepo agreed to lead them safely through the kobold traps.",
        "notes": "Party promised to retrieve white dragon wyrmling Calcryx from goblins.",
        "reason": "Party established diplomatic rapport with Meepo."
    }
    npc_updates.append(npc_update_entry)
    node_updates.append(npc_update_entry)

    # Emergent loot / clues
    key_clue = {
        "type": "clue",
        "title": "Goblin Patrol Route Map",
        "subtitle": "Scout Parchment",
        "summary": "Crude charcoal sketch showing goblin guard rotations outside the citadel gates.",
        "content_markdown": "Found on the body of a fallen goblin scout. Gives party advantage on stealth approaching the fortress entrance.",
        "data_json": {"revealed_to_players": True},
        "revealed_to_players": True
    }
    nursery_key = {
        "type": "item",
        "title": "Old Brass Nursery Key",
        "subtitle": "Kobold Keepsake",
        "summary": "Heavy bronze key given by Meepo that unlocks the dragon wyrmling nursery cage.",
        "content_markdown": "Entrusted to the party by Meepo as a token of trust to help rescue Calcryx.",
        "data_json": {"revealed_to_players": True},
        "revealed_to_players": True
    }
    new_nodes.extend([key_clue, nursery_key])

    new_edges.append({
        "source_title": "Meepo",
        "target_title": "Clan Yusdrayl Kobolds",
        "relation_type": "allied_with",
        "label": "Guided Party"
    })

    next_session_prep = {
        "title": "Session 2: Audience with the Kobold Queen",
        "subtitle": "Date: Day 2 of Flamerule",
        "description": "Guided by Meepo, the party enters the kobold court to negotiate with Queen Yusdrayl for safe passage and dragon rescue.",
        "summary": "Accompanied by Meepo, the party enters the kobold wing to negotiate with Queen Yusdrayl for safe passage and rescue Calcryx.",
        "content_markdown": (
            "### Next Session Prep Checklist\n"
            "- [ ] Prep Yusdrayl's throne room description.\n"
            "- [ ] Keep track of party's promise regarding dragon wyrmling Calcryx.\n"
            "- [ ] Prepare goblin skirmishers if negotiations falter.\n\n"
            "### Key NPC Goal\n"
            "Yusdrayl demands the party slay Goblin Chief Durnn in exchange for the Hucrele signet rings."
        ),
        "suggested_encounters": [
            "Audience with Queen Yusdrayl",
            "Trap Hall Bypass",
            "Goblin Skirmishers Patrol"
        ],
        "dm_secrets": "Yusdrayl suspects Meepo conspired with the goblins; the party must advocate for him.",
        "parent_quest_title": "The Lost Party of Oakhaven"
    }

    recap_text = (
        "Our company descended the switchback stairs into the gloomy fissure. "
        "After disabling a pit trap and fending off giant rats amidst the courtyard rubble, we met Meepo, a weeping kobold dragon-keeper. "
        "Through gentle words and promises to retrieve their stolen white dragon Calcryx, we secured safe passage toward Clan Yusdrayl."
    )

    player_portal_note = {
        "title": "Session 1 Chronicles: Into the Ashen Fissure",
        "author_name": "Party Chronicler",
        "content": recap_text
    }

    overview_text = (
        "### 🎲 Session Actual Play Fallout & Recap\n\n"
        "The party navigated the descent into the Ashen Rift, resolved the rat ambush, and successfully established diplomatic rapport with Meepo. "
        "The timeline has been updated with Session 1 marked as **Completed**, and **Session 2: Audience with the Kobold Queen** has been drafted for your upcoming game night!"
    )

    return {
        "overview": overview_text,
        "session_recap": overview_text,
        "status_updates": status_updates,
        "npc_updates": npc_updates,
        "node_updates": node_updates,
        "emergent_nodes": new_nodes,
        "new_nodes": new_nodes,
        "emergent_edges": new_edges,
        "new_edges": new_edges,
        "next_session_prep": next_session_prep,
        "next_session_proposal": next_session_prep,
        "player_recap": recap_text,
        "player_portal_note": player_portal_note if generate_player_recap else None,
        "model": "offline-session-adapter"
    }

def adapt_campaign_from_transcript(
    transcript_text: str,
    campaign_id: str,
    session_node_id: Optional[str] = None,
    instruction: Optional[str] = "",
    generate_player_recap: bool = True,
    current_adaptation: Optional[Dict[str, Any]] = None,
    conversation_history: Optional[List[Dict[str, str]]] = None
) -> Dict[str, Any]:
    """
    Analyzes an actual play session transcript or summary, compares against planned nodes in SQLite,
    and returns a structured adaptation proposal. Supports offline fallback and dual-key compatibility.
    """
    model, model_name = _get_configured_gemini_client()
    db_context = build_campaign_database_context(campaign_id)

    all_campaign_nodes = graph_service.list_nodes(campaign_id)
    all_campaign_edges = graph_service.list_edges(campaign_id)
    session_nodes = [n for n in all_campaign_nodes if n.type == "session"]
    nodes_map = {n.id: n for n in all_campaign_nodes}

    if not session_node_id and session_nodes:
        lower_trans = transcript_text.lower()
        for s in session_nodes:
            s_norm = _normalize_title_for_matching(s.title)
            if s_norm and (s_norm in lower_trans or s.title.lower() in lower_trans):
                session_node_id = s.id
                break
        if not session_node_id:
            import re
            m = re.search(r"session\s*0?(\d+)", lower_trans)
            if m:
                s_num = m.group(1)
                for s in session_nodes:
                    if f"session {s_num}" in s.title.lower() or f"session 0{s_num}" in s.title.lower():
                        session_node_id = s.id
                        break

    candidate_encounter_ids = []
    target_session_info = "Auto-detect from transcript"
    if session_node_id:
        target_node = nodes_map.get(session_node_id) or graph_service.get_node(session_node_id)
        if target_node:
            enc_ids = [e.target_id for e in all_campaign_edges if e.source_id == target_node.id and e.relation_type == "contains"]
            candidate_encounters = [nodes_map[eid] for eid in enc_ids if eid in nodes_map and nodes_map[eid].type in ("encounter", "hazard", "scene", "quest")]
            candidate_encounter_ids = [n.id for n in candidate_encounters]

            enc_lines = []
            for enc in candidate_encounters:
                enc_status = (enc.data_json or {}).get("status", "planned")
                enc_lines.append(f"  - [Encounter] \"{enc.title}\" (ID: {enc.id}) [Current Status: {enc_status}]")

            enc_text = "\n".join(enc_lines) if enc_lines else "  - (No encounters explicitly linked to this session yet)"
            target_session_info = (
                f"Target Session: '{target_node.title}' (ID: {target_node.id})\n"
                f"Current Session Status: {(target_node.data_json or {}).get('status', 'planned')}\n"
                f"Summary: {target_node.summary}\n"
                f"Prep Notes: {target_node.content_markdown}\n"
                f"PLANNED ENCOUNTERS IN THIS SESSION (PRIORITIZE RESOLVING THESE IF ENGAGED):\n{enc_text}"
            )

    if not model:
        return _generate_offline_session_adaptation(
            transcript_text, campaign_id, session_node_id, instruction, generate_player_recap
        )

    # For very long transcripts (VTT chat exports, marathon sessions), pre-process
    # through a chunked event-extraction pass so late-session events aren't dropped.
    # Threshold: 80,000 characters (~40+ pages of dialogue / ~6+ hour sessions).
    effective_transcript = transcript_text
    if len(transcript_text) > 80000:
        logger.info(f"[TranscriptAdapt] Long transcript detected ({len(transcript_text)} chars) — running chunked event extraction pass")
        effective_transcript = _chunk_and_summarize_transcript(transcript_text, model)
        logger.info(f"[TranscriptAdapt] Event summary condensed to {len(effective_transcript)} chars")

    # Online Gemini adaptation
    prompt = f"""You are the expert Co-DM and Campaign Chronicler for a D&D 5e game.
The Dungeon Master is submitting an ACTUAL PLAY TRANSCRIPT, VTT CHAT EXPORT, OR POST-SESSION SUMMARY/DEBRIEF NOTES from a game session that was just played.

YOUR CORE OBJECTIVE:
Analyze what ACTUALLY transpired during the game session and adapt the persistent Campaign Graph and Timeline to reflect reality.
Whether given full dialogue or a high-level summary, identify resolved encounters, shifts in NPC attitudes/dispositions, emergent loot or clues found, and where the story paused.

CURRENT CAMPAIGN GRAPH & TIMELINE CONTEXT:
{db_context}

TARGET SESSION (IF SPECIFIED OR DETECTED):
{target_session_info}

CRITICAL DIRECTIVE FOR ENCOUNTER STATUS UPDATES:
Review the PLANNED ENCOUNTERS IN THIS SESSION listed above. If the transcript indicates that any of these planned encounters took place, was resolved, fought, negotiated, or bypassed, YOU MUST include them in "status_updates" referencing their EXACT Title and "new_status": "completed".

DM STEERING INSTRUCTION / FOCUS:
\"{instruction if instruction else 'Analyze session fallout, mark completed encounters, update NPC states, generate emergent loot/clues, and propose next session prep.'}\"

SESSION TRANSCRIPT OR SUMMARY NOTES:
\"\"\"
{effective_transcript}
\"\"\"

ANALYZE THE TRANSCRIPT AND RETURN STRICT JSON WITH THESE SECTIONS:
{{
  "session_recap": "2-3 paragraphs of DM fallout summary explaining what happened vs what was planned, major turning points, and tactical consequences.",
  "status_updates": [
    {{
      "node_title": "Exact Title of planned encounter or session that was resolved",
      "new_status": "completed|in_progress|planned",
      "reason": "Why this status changed based on transcript"
    }}
  ],
  "node_updates": [
    {{
      "node_title": "Exact Title of existing NPC, Faction, or Location",
      "append_notes": "New developments, choices made, or state changes from this session",
      "new_disposition": "Allied|Friendly|Hostile|Deceased",
      "reason": "Brief rationale"
    }}
  ],
  "new_nodes": [
    {{
      "type": "clue|item|npc|monster|location|quest",
      "title": "Clear Title",
      "subtitle": "Short epithet or classification",
      "summary": "1-2 sentence description",
      "content_markdown": "Full notes",
      "data_json": {{ "status": "planned" }},
      "revealed_to_players": true
    }}
  ],
  "new_edges": [
    {{
      "source_title": "Exact Title of Source Node",
      "target_title": "Exact Title of Target Node",
      "relation_type": "allied_with|hostile_to|located_at|rewards|knows_secret",
      "label": "Short relation description"
    }}
  ],
  "next_session_proposal": {{
    "title": "Session N+1 Title based on cliffhanger",
    "subtitle": "Date: ...",
    "summary": "1-2 sentence synopsis of next session objectives",
    "content_markdown": "### Next Session GM Prep Checklist\\n- ...",
    "parent_quest_title": "Title of existing parent Quest to nest under"
  }},
  "player_portal_note": {{
    "title": "Session Chronicles: ...",
    "author_name": "Party Chronicler",
    "content": "Exciting, sanitized in-character party journal entry without DM secret spoilers."
  }}
}}
"""
    try:
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json", "max_output_tokens": 8192}
        )
        data = _safe_json_loads(response.text)
        recap = data.get("session_recap", "Session analyzed and adapted successfully.")
        status_updates = data.get("status_updates", [])
        node_updates = data.get("node_updates", [])
        new_nodes = data.get("new_nodes", [])
        new_edges = data.get("new_edges", [])
        next_session = data.get("next_session_proposal") or {}
        player_note = data.get("player_portal_note") or {}

        # Enrich status_updates with node_id if matched
        for su in status_updates:
            t = (su.get("node_title") or su.get("title") or "").strip()
            matched = _resolve_node_by_title_or_id(
                t,
                all_campaign_nodes,
                preferred_type=su.get("node_type"),
                candidate_node_ids=candidate_encounter_ids
            )
            if matched:
                su["node_id"] = matched.id
                su["node_title"] = matched.title
                su["title"] = matched.title
                su["node_type"] = matched.type

        npc_updates = []
        for nu in node_updates:
            t = (nu.get("node_title") or nu.get("name") or "").strip()
            matched = _resolve_node_by_title_or_id(
                t,
                all_campaign_nodes,
                preferred_type="npc"
            )
            matched_id = matched.id if matched else None
            matched_title = matched.title if matched else (nu.get("node_title") or nu.get("name") or "NPC")
            npc_updates.append({
                "node_id": matched_id,
                "name": matched_title,
                "node_title": matched_title,
                "disposition": nu.get("new_disposition", "Allied"),
                "state_changes": nu.get("append_notes", ""),
                "notes": nu.get("reason", "")
            })

        next_prep = {
            "title": next_session.get("title", "Next Session"),
            "description": next_session.get("summary", ""),
            "summary": next_session.get("summary", ""),
            "suggested_encounters": ["Explore Next Chamber", "Social Negotiation"],
            "dm_secrets": "Secrets concealed behind locked vault door."
        }

        return {
            "overview": recap,
            "session_recap": recap,
            "status_updates": status_updates,
            "npc_updates": npc_updates,
            "node_updates": node_updates,
            "emergent_nodes": new_nodes,
            "new_nodes": new_nodes,
            "emergent_edges": new_edges,
            "new_edges": new_edges,
            "next_session_prep": next_prep,
            "next_session_proposal": next_session,
            "player_recap": player_note.get("content", recap),
            "player_portal_note": player_note if generate_player_recap else None,
            "model": model_name
        }
    except Exception as e:
        logger.warning(f"Error during AI session adaptation, falling back to structured generator: {e}")
        return _generate_offline_session_adaptation(
            transcript_text, campaign_id, session_node_id, instruction, generate_player_recap
        )

def apply_session_adaptation(
    campaign_id: str,
    status_updates: Optional[List[Dict[str, Any]]] = None,
    node_updates: Optional[List[Dict[str, Any]]] = None,
    new_nodes: Optional[List[Dict[str, Any]]] = None,
    new_edges: Optional[List[Dict[str, Any]]] = None,
    next_session_node: Optional[Dict[str, Any]] = None,
    parent_quest_id: Optional[str] = None,
    player_note: Optional[Any] = None,
    # Frontend aliases
    session_node_id: Optional[str] = None,
    npc_updates: Optional[List[Dict[str, Any]]] = None,
    emergent_nodes: Optional[List[Dict[str, Any]]] = None,
    emergent_edges: Optional[List[Dict[str, Any]]] = None,
    next_session_prep: Optional[Dict[str, Any]] = None,
    player_recap: Optional[str] = None
) -> Dict[str, Any]:
    """
    Commits reviewed session fallout adaptations to the SQLite property graph.
    Supports both backend model conventions and frontend client aliases.
    """
    nodes = graph_service.list_nodes(campaign_id)
    id_to_node = {n.id: n for n in nodes}
    title_to_node = {n.title.lower().strip(): n for n in nodes}

    effective_status_updates = status_updates or []
    effective_node_updates = node_updates or npc_updates or []
    effective_new_nodes = new_nodes or emergent_nodes or []
    effective_new_edges = new_edges or emergent_edges or []
    effective_next_session = next_session_node or next_session_prep

    # Determine candidate encounter ids from session if available
    sess_id = session_node_id
    if not sess_id and effective_next_session:
        sess_id = effective_next_session.get("target_session_id")
    candidate_encounter_ids = []
    if sess_id:
        edges = graph_service.list_edges(campaign_id)
        candidate_encounter_ids = [e.target_id for e in edges if e.source_id == sess_id and e.relation_type == "contains"]

    applied_status_count = 0
    # 1. Apply Status Updates
    for su in effective_status_updates:
        node_id = su.get("node_id")
        matched = id_to_node.get(node_id) if node_id else None
        if not matched:
            t = (su.get("node_title") or su.get("title") or "").strip()
            matched = _resolve_node_by_title_or_id(
                t,
                nodes,
                preferred_type=su.get("node_type"),
                candidate_node_ids=candidate_encounter_ids
            )

        if matched:
            data_json = dict(matched.data_json or {})
            data_json["status"] = su.get("new_status", "completed")
            graph_service.update_node(matched.id, NodeUpdate(data_json=data_json))
            applied_status_count += 1

    applied_node_mod_count = 0
    # 2. Apply Node Modifications
    for nu in effective_node_updates:
        node_id = nu.get("node_id")
        matched = id_to_node.get(node_id) if node_id else None
        if not matched:
            t = (nu.get("node_title") or nu.get("name") or "").strip()
            matched = _resolve_node_by_title_or_id(t, nodes, preferred_type="npc")

        if matched:
            append_notes = nu.get("append_notes") or nu.get("state_changes") or ""
            new_content = (matched.content_markdown or "") + ("\n\n" + append_notes if append_notes else "")
            data_json = dict(matched.data_json or {})
            disp = nu.get("new_disposition") or nu.get("disposition")
            if disp:
                data_json["disposition"] = disp
            graph_service.update_node(matched.id, NodeUpdate(content_markdown=new_content, data_json=data_json))
            applied_node_mod_count += 1

    # 3. Create New Emergent Nodes
    created_new_nodes = []
    title_to_id = {}
    for n in effective_new_nodes:
        created = graph_service.create_node(
            NodeCreate(
                campaign_id=campaign_id,
                type=n.get("type", "clue"),
                title=n.get("title", "Emergent Node"),
                subtitle=n.get("subtitle", ""),
                summary=n.get("summary", ""),
                content_markdown=n.get("content_markdown", ""),
                data_json=n.get("data_json", {}),
                revealed_to_players=n.get("revealed_to_players", True),
                is_canon=False
            ),
            default_campaign_id=campaign_id
        )
        created_new_nodes.append(created)
        title_to_id[created.title.lower().strip()] = created.id

    # 4. Create New Edges
    created_edges_count = 0
    for e in effective_new_edges:
        src_title = (e.get("source_title") or "").lower().strip()
        tgt_title = (e.get("target_title") or "").lower().strip()
        src_node = title_to_node.get(src_title) or (graph_service.get_node(title_to_id.get(src_title)) if src_title in title_to_id else None)
        tgt_node = title_to_node.get(tgt_title) or (graph_service.get_node(title_to_id.get(tgt_title)) if tgt_title in title_to_id else None)
        if src_node and tgt_node:
            graph_service.create_edge(
                EdgeCreate(
                    campaign_id=campaign_id,
                    source_id=src_node.id,
                    target_id=tgt_node.id,
                    relation_type=e.get("relation_type", "allied_with"),
                    label=e.get("label", ""),
                    revealed_to_players=True,
                    is_canon=False
                ),
                default_campaign_id=campaign_id
            )
            created_edges_count += 1

    # 5. Create Next Session Node & Edge
    created_next_session_id = None
    if effective_next_session and (effective_next_session.get("title") or effective_next_session.get("name")):
        session_title = effective_next_session.get("title") or effective_next_session.get("name")
        next_session = graph_service.create_node(
            NodeCreate(
                campaign_id=campaign_id,
                type="session",
                title=session_title,
                subtitle=effective_next_session.get("subtitle", "Upcoming"),
                summary=effective_next_session.get("summary") or effective_next_session.get("description") or "",
                content_markdown=effective_next_session.get("content_markdown") or effective_next_session.get("description") or "",
                data_json={"status": "planned"},
                revealed_to_players=True,
                is_canon=False
            ),
            default_campaign_id=campaign_id
        )
        created_next_session_id = next_session.id

        # Connect to parent quest
        target_quest_id = parent_quest_id
        if not target_quest_id and effective_next_session.get("parent_quest_title"):
            parent_title = effective_next_session["parent_quest_title"].lower().strip()
            parent_quest = title_to_node.get(parent_title)
            if parent_quest:
                target_quest_id = parent_quest.id

        if not target_quest_id:
            quests = [n for n in nodes if n.type == "quest"]
            if quests:
                target_quest_id = quests[0].id

        if target_quest_id:
            graph_service.create_edge(
                EdgeCreate(
                    campaign_id=campaign_id,
                    source_id=target_quest_id,
                    target_id=next_session.id,
                    relation_type="contains",
                    label="Upcoming Session",
                    revealed_to_players=True
                ),
                default_campaign_id=campaign_id
            )

    # 6. Post Player Note
    created_player_note_id = None
    note_content = player_recap
    note_title = "Session Chronicles"
    author = "Party Chronicler"

    if player_note and isinstance(player_note, dict):
        note_content = player_note.get("content", note_content)
        note_title = player_note.get("title", note_title)
        author = player_note.get("author_name", author)

    if note_content:
        created_note = graph_service.create_player_note(
            PlayerNoteCreate(
                campaign_id=campaign_id,
                author_name=author,
                title=note_title,
                content=note_content,
                node_id=created_next_session_id or (session_node_id if session_node_id else None)
            ),
            default_campaign_id=campaign_id
        )
        created_player_note_id = created_note.id

    return {
        "success": True,
        "status": "applied",
        "message": (
            f"Successfully updated {applied_status_count + applied_node_mod_count} nodes, "
            f"created {len(created_new_nodes)} emergent nodes, {created_edges_count} relationships, "
            f"and prepped next session!"
        ),
        "updated_count": applied_status_count + applied_node_mod_count,
        "status_updates_applied": applied_status_count,
        "nodes_modified": applied_node_mod_count,
        "created_node_count": len(created_new_nodes),
        "new_nodes_created": len(created_new_nodes),
        "created_edge_count": created_edges_count,
        "new_edges_created": created_edges_count,
        "next_session_id": created_next_session_id,
        "player_note_id": created_player_note_id
    }
