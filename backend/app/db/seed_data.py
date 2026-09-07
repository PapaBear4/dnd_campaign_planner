"""
Seed script to populate a sample D&D 5e Campaign demonstrating:
- Hierarchical arcs, quests, sessions, and encounters
- Entity knowledge graph: NPCs, Monsters with 5e statblocks, Locations, Factions, Clues, Items
- Progressive revelation (some nodes revealed, some secret for DM)
"""
from app.db.database import get_db
from app.models import CampaignCreate, EdgeCreate, NodeCreate
from app.services import graph_service

def seed_sample_campaign():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as count FROM nodes")
        if cursor.fetchone()["count"] > 0:
            return  # Already seeded or has data

    cid = "default-campaign"

    # 1. Hierarchical Planning Nodes
    arc_1 = graph_service.create_node(
        NodeCreate(
            campaign_id=cid,
            type="arc",
            title="Act I: Secrets of the Ravine",
            subtitle="Levels 1-3 • Ashen Plains & Sunken Ruins",
            summary="The adventurers discover an ancient fortress sunken into a deep earth fissure, now home to warring goblin and kobold factions.",
            content_markdown="### Campaign Hook\nWord arrives in Oakhaven that two scions of a prominent noble merchant family vanished near the ravine. The matriarch offers 250 gp per signet ring returned.",
            revealed_to_players=True,
            sort_order=1
        ),
        default_campaign_id=cid
    )

    quest_1 = graph_service.create_node(
        NodeCreate(
            campaign_id=cid,
            type="quest",
            title="The Lost Party of Oakhaven",
            subtitle="Rescue / Retrieval Quest",
            summary="Locate Talgen and Sharwyn Hucrele, or bring proof of their fate back to Oakhaven.",
            content_markdown="### Objectives\n1. Descend the ancient switchback stairs into the ravine.\n2. Infiltrate the fortress ruins.\n3. Discover why the children haven't returned.",
            revealed_to_players=True,
            sort_order=1
        ),
        default_campaign_id=cid
    )

    quest_2 = graph_service.create_node(
        NodeCreate(
            campaign_id=cid,
            type="quest",
            title="The Twilight Grove Mystery",
            subtitle="Investigation & Corruption",
            summary="A mysterious tree deep within the lower level produces magical fruit that bestows vigor—and dark corruption.",
            content_markdown="### DM Secret\nBelak the Outcast has been grafting human captives to the Gulthias Tree to create thralls.",
            revealed_to_players=False,
            sort_order=2
        ),
        default_campaign_id=cid
    )

    session_1 = graph_service.create_node(
        NodeCreate(
            campaign_id=cid,
            type="session",
            title="Session 1: Descent into the Rift",
            subtitle="Date: Day 1 of Flamerule",
            summary="Party descends the stairs, avoids the pit trap, and makes first contact with the weeping kobold keeper Meepo.",
            content_markdown="### GM Prep Checklist\n- [x] Read aloud boxed text for Ravine Descent.\n- [x] Prep Meepo's voice: high pitched, desperate, sniveling.\n- [ ] Keep track of torch durations.\n\n### Fail-Forward Notes\nIf the rogue fails the rope check on the descent, they don't plunge to their death; their pack tears open, spilling rations into the chasm and attracting hungry giant rats.",
            revealed_to_players=True,
            sort_order=1
        ),
        default_campaign_id=cid
    )

    encounter_1 = graph_service.create_node(
        NodeCreate(
            campaign_id=cid,
            type="encounter",
            title="Ravine Rat Ambush",
            subtitle="Low Threat (XP: 100)",
            summary="3 Giant Rats scurry from the rubble as the party reaches the citadel landing.",
            content_markdown="Tactics: The rats prioritize anyone carrying fresh rations or meat. Morale: If 2 rats die, the third flees into a crack.",
            data_json={
                "difficulty": "Easy",
                "cr_total": 0.375,
                "monsters": [{"name": "Giant Rat", "count": 3, "cr": "1/8", "hp": 7, "ac": 12}],
                "status": "planned"
            },
            revealed_to_players=False,
            sort_order=1
        ),
        default_campaign_id=cid
    )

    # 2. Locations
    loc_ravine = graph_service.create_node(
        NodeCreate(
            campaign_id=cid,
            type="location",
            title="The Ashen Rift",
            subtitle="Surface Landmark",
            summary="A jagged mile-long tear in the earth exposing the basalt upper towers of a sunken fortress.",
            content_markdown="The wind howls as it sweeps through the ravine. Crude switchback stairs are cut into the cliff face, leading down into perpetual shadow.",
            revealed_to_players=True
        ),
        default_campaign_id=cid
    )

    loc_fortress_gate = graph_service.create_node(
        NodeCreate(
            campaign_id=cid,
            type="location",
            title="Citadel Bastion Gate",
            subtitle="Citadel Level 1",
            summary="A heavy stone archway inscribed with worn draconic glyphs leading into the fortress interior.",
            content_markdown="Boxed Text: 'Cracked flagstones slope inward beneath a vaulted ceiling blackened by ancient soot. The air is stagnant, smelling of moisture, bat guano, and dried blood.'",
            revealed_to_players=True
        ),
        default_campaign_id=cid
    )

    loc_dragon_shrine = graph_service.create_node(
        NodeCreate(
            campaign_id=cid,
            type="location",
            title="Shrine of the White Wyrmling",
            subtitle="Citadel Level 1 - Kobold Wing",
            summary="A ruined shrine dedicated to dragon worship, where the kobolds kept Calcryx before the goblins stole her.",
            content_markdown="Broken chains, gnawed bones, and icy frost coating the pillars indicate a captive white dragon wyrmling was held here.",
            revealed_to_players=False
        ),
        default_campaign_id=cid
    )

    # 3. NPCs
    npc_meepo = graph_service.create_node(
        NodeCreate(
            campaign_id=cid,
            type="npc",
            title="Meepo",
            subtitle="Keeper of Dragons • Kobold",
            summary="A wretched, tearful kobold who lost his tribe's sacred pet dragon wyrmling to goblin raiders.",
            content_markdown="### Roleplay Trait\nDesperate, cowardly, but fiercely devoted to dragons. If the party promises to return Calcryx, Meepo guides them safely past kobold pit traps.\n\n**Quote:** 'Meepo make you friends with Clan Yusdrayl! You get dragon back, Yusdrayl give shiny dragon treasures!'",
            revealed_to_players=False
        ),
        default_campaign_id=cid
    )

    npc_yusdrayl = graph_service.create_node(
        NodeCreate(
            campaign_id=cid,
            type="npc",
            title="Yusdrayl",
            subtitle="Kobold Sorceress Queen",
            summary="Leader of the Sunken Citadel kobolds. Proud, calculating, and armed with dragon-magic.",
            content_markdown="Possesses a dragon-shaped key that opens the treasury. Willing to negotiate truce if party eliminates goblin chieftain Durnn.",
            revealed_to_players=False
        ),
        default_campaign_id=cid
    )

    # 4. 5e Monster Statblocks
    monster_calcryx = graph_service.create_node(
        NodeCreate(
            campaign_id=cid,
            type="monster",
            title="Calcryx",
            subtitle="White Dragon Wyrmling (CR 2)",
            summary="A violent, spoiled white dragon wyrmling currently locked in the goblin trophy room.",
            content_markdown="### 5e Stat Block\n- **AC**: 16 (Natural Armor)\n- **HP**: 32 (5d8 + 10)\n- **Speed**: 30 ft., burrow 15 ft., fly 60 ft., swim 30 ft.\n- **STR**: 14 (+2) | **DEX**: 10 (+0) | **CON**: 14 (+2) | **INT**: 5 (-3) | **WIS**: 10 (+0) | **CHA**: 11 (+0)\n- **Damage Immunities**: Cold\n- **Senses**: Blindsight 10 ft., Darkvision 60 ft., Passive Perception 14\n\n### Actions\n- **Bite**: Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (1d10 + 2) piercing damage plus 2 (1d4) cold damage.\n- **Cold Breath (Recharge 5-6)**: 15-foot cone, DC 12 Con save, 22 (5d8) cold damage on failure, half on success.",
            data_json={
                "cr": "2",
                "xp": 450,
                "ac": 16,
                "hp": 32,
                "speed": "30 ft., fly 60 ft.",
                "abilities": {"str": 14, "dex": 10, "con": 14, "int": 5, "wis": 10, "cha": 11},
                "actions": [
                    {"name": "Bite", "desc": "+4 to hit, reach 5 ft. Hit: 1d10+2 piercing + 1d4 cold."},
                    {"name": "Cold Breath (Recharge 5-6)", "desc": "15-ft cone. DC 12 CON save, 5d8 cold damage."}
                ]
            },
            revealed_to_players=False
        ),
        default_campaign_id=cid
    )

    monster_twig_blight = graph_service.create_node(
        NodeCreate(
            campaign_id=cid,
            type="monster",
            title="Twig Blight",
            subtitle="Small Plant (CR 1/8)",
            summary="A dry, animated bundle of thorny twigs that mimics normal brush until prey draws near.",
            content_markdown="### 5e Stat Block\n- **AC**: 13 (Natural)\n- **HP**: 4 (1d6 + 1)\n- **Speed**: 20 ft.\n- **Damage Vulnerabilities**: Fire\n- **Actions**: Claws (+3 to hit, 1d4+1 piercing).",
            data_json={
                "cr": "1/8",
                "xp": 25,
                "ac": 13,
                "hp": 4,
                "speed": "20 ft.",
                "abilities": {"str": 6, "dex": 13, "con": 12, "int": 4, "wis": 8, "cha": 3}
            },
            revealed_to_players=False
        ),
        default_campaign_id=cid
    )

    # 5. Factions
    faction_kobolds = graph_service.create_node(
        NodeCreate(
            campaign_id=cid,
            type="faction",
            title="Clan Yusdrayl Kobolds",
            subtitle="Citadel Faction",
            summary="Desperate dragon-cultist kobolds fighting to reclaim their sacred territory from goblins.",
            content_markdown="Currently holed up in the northeastern rooms. Desperate for allies against Durnn's goblins.",
            revealed_to_players=False
        ),
        default_campaign_id=cid
    )

    faction_goblins = graph_service.create_node(
        NodeCreate(
            campaign_id=cid,
            type="faction",
            title="Durbuluk Goblin Tribe",
            subtitle="Citadel Faction",
            summary="Brutal goblin raiders allied with the mysterious Druid Belak in the lower level.",
            content_markdown="They capture travelers and take them down to the Twilight Grove.",
            revealed_to_players=False
        ),
        default_campaign_id=cid
    )

    # 6. Items & Clues
    item_ring = graph_service.create_node(
        NodeCreate(
            campaign_id=cid,
            type="item",
            title="Hucrele Signet Ring",
            subtitle="Family Heirloom",
            summary="A heavy gold signet ring bearing a stylized feather and scroll, proof of the noble family.",
            content_markdown="Reward: 250 gp upon return to Kerowyn Hucrele in Oakhaven.",
            revealed_to_players=True
        ),
        default_campaign_id=cid
    )

    # 7. Maps
    map_citadel = graph_service.create_node(
        NodeCreate(
            campaign_id=cid,
            type="map",
            title="Citadel Underground Fortress Level 1",
            subtitle="Tactical Dungeon Battle Map",
            summary="Fortress ruins sunken into the fissure. Contains the kobold wing and goblin bastion.",
            content_markdown="Tactical dungeon map of the upper level of the Sunken Citadel.",
            revealed_to_players=True,
            data_json={
                "map_url": "/api/uploads/a3f7b6daad12_map-02.02-xanathar-hideout.png",
                "pins": [
                    {"id": "pin-gate", "nodeId": loc_fortress_gate.id, "x": 28.5, "y": 74.2, "label": "Citadel Bastion Gate", "revealed": True},
                    {"id": "pin-shrine", "nodeId": loc_dragon_shrine.id, "x": 62.1, "y": 38.6, "label": "Shrine of the White Wyrmling", "revealed": False},
                    {"id": "pin-rift", "nodeId": loc_ravine.id, "x": 18.2, "y": 88.0, "label": "The Ashen Rift", "revealed": True}
                ]
            }
        ),
        default_campaign_id=cid
    )

    # 7. Connect Edges (Relationships & Hierarchy)
    # Hierarchy Edges: Arc contains Quests
    graph_service.create_edge(EdgeCreate(campaign_id=cid, source_id=arc_1.id, target_id=quest_1.id, relation_type="contains", label="Arc Quest"), default_campaign_id=cid)
    graph_service.create_edge(EdgeCreate(campaign_id=cid, source_id=arc_1.id, target_id=quest_2.id, relation_type="contains", label="Arc Quest"), default_campaign_id=cid)
    graph_service.create_edge(EdgeCreate(campaign_id=cid, source_id=quest_1.id, target_id=session_1.id, relation_type="contains", label="Session Step"), default_campaign_id=cid)
    graph_service.create_edge(EdgeCreate(campaign_id=cid, source_id=session_1.id, target_id=encounter_1.id, relation_type="contains", label="Session Encounter"), default_campaign_id=cid)

    # Entity Relationships
    graph_service.create_edge(EdgeCreate(campaign_id=cid, source_id=npc_meepo.id, target_id=faction_kobolds.id, relation_type="member_of", label="Dragon Keeper"), default_campaign_id=cid)
    graph_service.create_edge(EdgeCreate(campaign_id=cid, source_id=npc_yusdrayl.id, target_id=faction_kobolds.id, relation_type="member_of", label="Queen"), default_campaign_id=cid)
    graph_service.create_edge(EdgeCreate(campaign_id=cid, source_id=faction_kobolds.id, target_id=faction_goblins.id, relation_type="hostile_to", label="Territorial War"), default_campaign_id=cid)
    graph_service.create_edge(EdgeCreate(campaign_id=cid, source_id=npc_meepo.id, target_id=monster_calcryx.id, relation_type="allied_with", label="Worships & Protects"), default_campaign_id=cid)
    graph_service.create_edge(EdgeCreate(campaign_id=cid, source_id=monster_calcryx.id, target_id=loc_dragon_shrine.id, relation_type="located_at", label="Former Lair"), default_campaign_id=cid)
    graph_service.create_edge(EdgeCreate(campaign_id=cid, source_id=loc_fortress_gate.id, target_id=loc_ravine.id, relation_type="located_at", label="Inside Ravine"), default_campaign_id=cid)
    graph_service.create_edge(EdgeCreate(campaign_id=cid, source_id=quest_1.id, target_id=item_ring.id, relation_type="rewards", label="Target Proof"), default_campaign_id=cid)
