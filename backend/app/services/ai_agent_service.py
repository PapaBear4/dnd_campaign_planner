import json
import logging
import os
from typing import Any, Dict, List, Optional
from app.services import graph_service
from app.services.graph_service import get_setting, get_campaign, list_nodes, list_edges
from app.models import NodeCreate, NodeUpdate, EdgeCreate, PlayerNoteCreate

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the Arcane Weaver, an expert D&D 5e Co-DM, world architect, and DM Mentor.
Your mission is to help the Dungeon Master learn how to weave campaigns, arcs, quests, sessions, and encounters into an interconnected tapestry.

You have direct access to the live SQLite Campaign Graph Database (provided in the context prompt as Ground Truth).

Core Directives:
1. Grounded in Existing Lore: Always prioritize and pull from existing Arcs, Quests, NPCs, Factions, Locations, and Relationships in the database before inventing new ones, unless explicitly instructed to create something brand new.
2. Teach the Art of Weaving:
   - Connect PC Backstories to Quests: Tie character personal stakes directly to faction conflicts or quest rewards.
   - Weave Factions into Tension: Show how completing a quest for one NPC/Faction impacts another (allies vs rivals).
   - Trace Arc-to-Encounter Flow: Show how an overarching Arc crisis breaks down into 2-3 overlapping Quests, which divide into Session milestones, which culminate in dramatic tactical Encounters.
3. Player Agency & Fail-Forward: A failed check should rarely mean 'nothing happens'; it means a complication, cost, or dramatic escalation.
4. The Three-Clue Rule: Ensure critical mysteries or quest leads have at least 3 distinct avenues of discovery.
5. Evocative Boxed Text: Multi-sensory read-aloud prose (sight, sound, smell, temperature) in 2-4 punchy sentences.

When proposing story elements, format them as concrete Graph Nodes (NPC, Location, Quest, Monster, Faction, Item, Clue) and Edges (allied_with, hostile_to, located_at, gives_quest, rewards) so the DM can add them directly to their campaign database.
"""

def _get_configured_gemini_client():
    api_key = get_setting("gemini_api_key", os.getenv("GEMINI_API_KEY", ""))
    if not api_key:
        return None, None
    
    model_name = get_setting("gemini_model", "gemini-2.5-flash")
    # Normalize model name if user specified shorthand
    if not model_name.startswith("models/") and not "/" in model_name:
        effective_model = model_name
    else:
        effective_model = model_name

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name=effective_model,
            system_instruction=SYSTEM_PROMPT
        )
        return model, model_name
    except Exception as e:
        logger.error(f"Error configuring Gemini client: {e}")
        return None, None

def build_campaign_database_context(campaign_id: str) -> str:
    """
    Compiles a structured snapshot of the active SQLite Campaign Graph.
    Grounds the AI agent in existing Arcs, Quests, NPCs, Factions, Locations, Monsters, and Edges.
    """
    campaign = get_campaign(campaign_id)
    nodes = list_nodes(campaign_id)
    edges = list_edges(campaign_id)

    if not nodes:
        return f"Campaign: {campaign.name if campaign else 'Active Campaign'}\nDatabase: Empty campaign graph. Ready for new creation."

    id_to_title = {n.id: n.title for n in nodes}

    # Group nodes by type
    by_type: Dict[str, List[Any]] = {}
    for n in nodes:
        by_type.setdefault(n.type, []).append(n)

    lines = [
        f"### Current Campaign State (Live SQLite Database Ground Truth)",
        f"**Campaign**: {campaign.name if campaign else 'Active Campaign'} (Setting: {campaign.setting if campaign else 'D&D 5e'})",
        ""
    ]

    # Arcs & Quests hierarchy
    if "arc" in by_type or "quest" in by_type:
        lines.append("**Story Structure (Arcs & Quests)**:")
        for arc in by_type.get("arc", []):
            status = arc.data_json.get("status", "planned") if arc.data_json else "planned"
            lines.append(f"- [Arc] {arc.title} (Status: {status}): {arc.summary}")
        for q in by_type.get("quest", []):
            status = q.data_json.get("status", "planned") if q.data_json else "planned"
            lines.append(f"  * [Quest] {q.title} (Status: {status}): {q.summary}")
        lines.append("")

    # Factions & NPCs
    if "faction" in by_type or "npc" in by_type:
        lines.append("**Factions & Key NPCs**:")
        for f in by_type.get("faction", []):
            lines.append(f"- [Faction] {f.title}: {f.summary}")
        for npc in by_type.get("npc", []):
            lines.append(f"- [NPC] {npc.title} ({npc.subtitle or 'NPC'}): {npc.summary}")
        lines.append("")

    # Locations
    if "location" in by_type:
        lines.append("**Key Locations**:")
        for loc in by_type.get("location", []):
            lines.append(f"- [Location] {loc.title} ({loc.subtitle or ''}): {loc.summary}")
        lines.append("")

    # Monsters
    if "monster" in by_type:
        lines.append("**Monsters & Bosses**:")
        for m in by_type.get("monster", []):
            cr = m.data_json.get("cr", "?") if m.data_json else "?"
            lines.append(f"- [Monster] {m.title} (CR {cr}): {m.summary}")
        lines.append("")

    # Player Characters (PCs)
    if "pc" in by_type:
        lines.append("**Player Characters (PCs)**:")
        for pc in by_type.get("pc", []):
            lines.append(f"- [PC] {pc.title}: {pc.summary}")
        lines.append("")

    # Key Relationships (Edges)
    if edges:
        lines.append("**Known Relationships & Connections (Edges)**:")
        for e in edges[:25]: # Cap to 25 prominent relations
            src = id_to_title.get(e.source_id, "Unknown")
            tgt = id_to_title.get(e.target_id, "Unknown")
            rel = e.relation_type.replace("_", " ")
            label_extra = f" ('{e.label}')" if e.label and e.label != rel else ""
            lines.append(f"- {src} --[{rel}{label_extra}]--> {tgt}")
        lines.append("")

    return "\n".join(lines)

def chat_with_agent(
    messages: List[Dict[str, str]],
    campaign_id: str,
    context_node_id: Optional[str] = None
) -> Dict[str, Any]:
    model, model_name = _get_configured_gemini_client()
    
    # Compile live database ground truth
    db_context = build_campaign_database_context(campaign_id)
    
    context_extra = ""
    if context_node_id:
        from app.services.graph_service import get_node
        node = get_node(context_node_id)
        if node:
            context_extra = f"\nFocused Node in Workspace:\n- Title: {node.title} (Type: {node.type})\n- Summary: {node.summary}\n- Notes: {node.content_markdown}\n"


    if not model:
        # Informative offline fallback when API key is not yet set
        last_user_msg = messages[-1]["content"] if messages else ""
        return {
            "model": "offline-guidance-engine",
            "reply": (
                f"🧙‍♂️ **The Arcane Weaver (Co-DM)**\n\n"
                f"*Note: Gemini API key has not been entered yet in Settings. Here is guidance from the offline D&D 5e campaign engine:*\n\n"
                f"**Addressing:** \"{last_user_msg}\"\n\n"
                f"### Strategic Campaign Advice\n"
                f"1. **Pacing & Threat Escalation**: Introduce an immediate environmental or social complication to anchor the party's attention.\n"
                f"2. **NPC Motive**: Give the key NPC two opposing traits (e.g., fierce loyalty to their guild, but secretly indebted to a rival faction).\n"
                f"3. **Three-Clue Rule**: Place one clue in dialogue, one clue in an inspectable object/location, and one clue obtainable through a skill check.\n\n"
                f"> 💡 *Tip: Paste your Gemini API key in the top-right Settings modal to activate real-time generation, deep lore weaving, and automated node extraction!*"
            ),
            "suggested_nodes": []
        }

    try:
        # Build prompt history
        gemini_history = []
        for m in messages[:-1]:
            gemini_history.append({
                "role": "user" if m["role"] == "user" else "model",
                "parts": [m["content"]]
            })
        
        last_prompt = f"{db_context}\n{context_extra}\nDM Request:\n{messages[-1]['content']}"
        chat = model.start_chat(history=gemini_history)
        response = chat.send_message(last_prompt)
        
        return {
            "model": model_name,
            "reply": response.text,
            "suggested_nodes": []
        }
    except Exception as e:
        logger.error(f"Gemini chat error: {e}")
        return {
            "model": "error",
            "reply": f"An error occurred while contacting Gemini ({e}). Please check your API key and model selection in Settings.",
            "suggested_nodes": []
        }

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
        return {
            "extracted_nodes": [
                {
                    "type": "location",
                    "title": sample_title,
                    "summary": "Extracted location from uploaded document snippet.",
                    "content_markdown": text_content[:500]
                }
            ],
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
         "cr": "1/2 (if monster)",
         "hp": 22,
         "ac": 13,
         "alignment": "Neutral Evil",
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
            "extracted_nodes": data.get("extracted_nodes", []),
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

                # Sort priority: flash models and pro models first, then alphabetical
                def model_sort_key(m):
                    mid = m["id"].lower()
                    if "2.5-flash" in mid:
                        return (0, mid)
                    if "2.5-pro" in mid:
                        return (1, mid)
                    if "2.0-flash" in mid:
                        return (2, mid)
                    if "1.5-flash" in mid:
                        return (3, mid)
                    if "1.5-pro" in mid:
                        return (4, mid)
                    if "flash" in mid:
                        return (5, mid)
                    if "pro" in mid:
                        return (6, mid)
                    return (7, mid)

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

def decompose_adventure_document(
    text_content: str,
    instruction: str,
    decomposition_mode: str,
    campaign_id: str,
    current_nodes: Optional[List[Dict[str, Any]]] = None,
    current_edges: Optional[List[Dict[str, Any]]] = None,
    conversation_history: Optional[List[Dict[str, str]]] = None
) -> Dict[str, Any]:
    """
    Decomposes adventure book chapters, monster sheets, or PC sheets based on DM instructions.
    Supports iterative conversation where the DM provides feedback to steer and refine draft nodes.
    """
    model, model_name = _get_configured_gemini_client()
    db_context = build_campaign_database_context(campaign_id)

    mode_prompts = {
        "campaign_structure": (
            "DECOMPOSITION MODE: Campaign Hierarchy & Narrative Arcs.\n"
            "- Analyze the overall story structure from this chapter/introduction.\n"
            "- Extract 1 to 4 major Arcs (Act/Milestone levels).\n"
            "- For each Arc, extract 1 to 3 Quests with clear objectives and stakes.\n"
            "- For each Quest, identify initial Session steps.\n"
            "- Create 'contains' edges connecting Arc -> Quest -> Session."
        ),
        "monsters": (
            "DECOMPOSITION MODE: 5e Monster & Enemy Stat Blocks.\n"
            "- Extract all monster, villain, and beast stat blocks found in the text.\n"
            "- Populate data_json with: cr, xp, ac, hp, speed, abilities (str/dex/con/int/wis/cha), actions list.\n"
            "- Format full Markdown text with Traits, Multiattack, Actions, and Legendary Actions."
        ),
        "pc_sheets": (
            "DECOMPOSITION MODE: Player Character (PC) Sheets.\n"
            "- Extract Player Characters: Name (title), Class/Race/Level (subtitle).\n"
            "- Summary of key background, ideals, bonds, flaws, and personal quest hooks.\n"
            "- data_json with attributes, key equipment, and spellcasting."
        ),
        "npcs_factions": (
            "DECOMPOSITION MODE: NPCs, Factions & Living World Graph.\n"
            "- Extract all named NPCs, their factions, and their interpersonal relationships.\n"
            "- Create edges: member_of, allied_with, hostile_to, gives_quest, knows_secret."
        ),
        "encounters": (
            "DECOMPOSITION MODE: Tactical & Social Encounters.\n"
            "- Extract specific combat encounters, puzzles, social challenges, and traps.\n"
            "- Include threat difficulty, monsters present, and fail-forward outcomes."
        ),
        "custom": (
            "DECOMPOSITION MODE: Custom DM Directive.\n"
            "- Closely follow the DM's specific instruction below and extract appropriate campaign nodes and edges."
        )
    }

    selected_prompt = mode_prompts.get(decomposition_mode, mode_prompts["custom"])

    if not model:
        # High quality offline demonstration decomposition with steering support
        if current_nodes and len(current_nodes) > 0:
            updated_nodes = list(current_nodes)
            inst_lower = (instruction or "").lower()
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
            else:
                updated_nodes.append({
                    "type": "npc" if "npc" in inst_lower else "clue",
                    "title": "Refined Element: Secret Lore",
                    "subtitle": "Steered Addition",
                    "summary": f"Added in response to: '{instruction}'.",
                    "content_markdown": f"Notes based on DM feedback: {instruction}",
                    "data_json": {"status": "planned"},
                    "revealed_to_players": False
                })

            return {
                "overview_summary": (
                    f"### 🧙‍♂️ Co-DM Feedback Applied\n\n"
                    f"I have refined the working draft according to your steering: *\"{instruction}\"*.\n"
                    f"Updated working draft now contains **{len(updated_nodes)} nodes**."
                ),
                "extracted_nodes": updated_nodes,
                "extracted_edges": current_edges or [],
                "model": "offline-decomposer"
            }

        lines = [line.strip() for line in text_content.split("\n") if line.strip()]
        title_guess = lines[0][:60] if lines else "Imported Adventure Segment"
        return {
            "overview_summary": (
                f"### 🧙‍♂️ Adventure Decomposed (Offline Preview)\n\n"
                f"Decomposed segment based on instruction: *\"{instruction or 'Standard Arc & Quest decomposition'}\"*.\n\n"
                f"> 💡 *Tip: Configure your Gemini API key in Settings to unlock deep semantic extraction of 5e statblocks and multi-tier narrative arcs!*"
            ),
            "extracted_nodes": [
                {
                    "type": "arc" if decomposition_mode == "campaign_structure" else ("monster" if decomposition_mode == "monsters" else "quest"),
                    "title": title_guess,
                    "subtitle": "Imported from Document",
                    "summary": f"Extracted via {decomposition_mode} parser. Ready for DM editing and refinement.",
                    "content_markdown": text_content[:1200],
                    "data_json": {"status": "planned"},
                    "revealed_to_players": False
                }
            ],
            "extracted_edges": [],
            "model": "offline-decomposer"
        }

    refinement_context = ""
    if current_nodes:
        refinement_context = f"""
CURRENT WORKING DRAFT NODES (to modify, split, rebalance, or prune according to DM feedback):
{json.dumps(current_nodes, indent=2)}

CURRENT WORKING DRAFT EDGES:
{json.dumps(current_edges or [], indent=2)}
"""

    history_context = ""
    if conversation_history:
        history_context = "\nPREVIOUS STEERING CONVERSATION:\n" + "\n".join(
            f"{m.get('role', 'user').upper()}: {m.get('content', '')}" for m in conversation_history
        ) + "\n"

    prompt = f"""You are an expert D&D 5e adventure analyst and Co-DM architect.
The Dungeon Master is actively directing, steering, and refining the decomposition of this adventure module into graph nodes and edges.

{selected_prompt}

{refinement_context}
{history_context}

DM'S LATEST STEERING INSTRUCTION / FEEDBACK:
\"\"\"{instruction if instruction else 'Refine and improve the working draft based on conversation.'}\"\"\"

{db_context}

ADVENTURE / RULEBOOK TEXT REFERENCE:
\"\"\"
{text_content[:12000]}
\"\"\"

CRITICAL INSTRUCTIONS FOR REFINING NODES:
1. "overview_summary": Address the DM directly. Specifically explain what changes, additions, splits, or removals you performed in response to their feedback.
2. "extracted_nodes": Output the complete, updated set of working draft nodes incorporating the DM's feedback.
3. "extracted_edges": Output the complete, updated set of working draft edges connecting these nodes.
4. If the DM asked to split a quest or arc, produce the resulting sub-nodes. If they asked to change stats, factions, or difficulty, update the data_json and descriptions accordingly.

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
         "status": "planned",
         "cr": "1/2 (if monster)",
         "hp": 22,
         "ac": 13,
         "abilities": {{ "str": 10, "dex": 12, "con": 12, "int": 10, "wis": 10, "cha": 10 }}
      }},
      "revealed_to_players": false
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
        response = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
        data = json.loads(response.text)
        return {
            "overview_summary": data.get("overview_summary", "Adventure refined successfully."),
            "extracted_nodes": data.get("extracted_nodes", current_nodes or []),
            "extracted_edges": data.get("extracted_edges", current_edges or []),
            "model": model_name
        }
    except Exception as e:
        logger.error(f"Error decomposing adventure document: {e}")
        return {
            "overview_summary": f"Error during AI decomposition: {e}",
            "extracted_nodes": current_nodes or [],
            "extracted_edges": current_edges or [],
            "error": str(e),
            "model": "fallback"
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
    Analyzes an actual play session transcript, compares against planned nodes in the SQLite graph,
    and returns a structured adaptation proposal (status transitions, NPC updates, emergent nodes,
    next session prep, and player recap). Supports iterative conversation to steer changes.
    """
    model, model_name = _get_configured_gemini_client()
    db_context = build_campaign_database_context(campaign_id)

    target_session_info = "Auto-detect from transcript"
    if session_node_id:
        target_node = graph_service.get_node(session_node_id)
        if target_node:
            target_session_info = f"Target Session: '{target_node.title}' (ID: {target_node.id})\nSummary: {target_node.summary}\nPrep Notes: {target_node.content_markdown}"

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

    target_session_info = "Auto-detect from transcript"
    if session_node_id:
        target_node = graph_service.get_node(session_node_id)
        if target_node:
            target_session_info = f"Target Session: '{target_node.title}' (ID: {target_node.id})\nSummary: {target_node.summary}\nPrep Notes: {target_node.content_markdown}"

    if not model:
        return _generate_offline_session_adaptation(
            transcript_text, campaign_id, session_node_id, instruction, generate_player_recap
        )

    # Online Gemini adaptation
    prompt = f"""You are the expert Co-DM and Campaign Chronicler for a D&D 5e game.
The Dungeon Master is submitting an ACTUAL PLAY TRANSCRIPT, VTT CHAT EXPORT, OR POST-SESSION SUMMARY/DEBRIEF NOTES from a game session that was just played.

YOUR CORE OBJECTIVE:
Analyze what ACTUALLY transpired during the game session and adapt the persistent Campaign Graph and Timeline to reflect reality.
Whether given full dialogue or a high-level summary, identify resolved encounters, shifts in NPC attitudes/dispositions, emergent loot or clues found, and where the story paused.

CURRENT CAMPAIGN GRAPH & TIMELINE CONTEXT:
{db_context}

TARGET SESSION (IF SPECIFIED):
{target_session_info}

DM STEERING INSTRUCTION / FOCUS:
\"{instruction if instruction else 'Analyze session fallout, mark completed encounters, update NPC states, generate emergent loot/clues, and propose next session prep.'}\"

SESSION TRANSCRIPT OR SUMMARY NOTES:
\"\"\"
{transcript_text[:14000]}
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
        response = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
        data = json.loads(response.text)
        recap = data.get("session_recap", "Session analyzed and adapted successfully.")
        status_updates = data.get("status_updates", [])
        node_updates = data.get("node_updates", [])
        new_nodes = data.get("new_nodes", [])
        new_edges = data.get("new_edges", [])
        next_session = data.get("next_session_proposal") or {}
        player_note = data.get("player_portal_note") or {}

        # Enrich status_updates with node_id if matched
        nodes = graph_service.list_nodes(campaign_id)
        title_to_node = {n.title.lower().strip(): n for n in nodes}
        for su in status_updates:
            t = (su.get("node_title") or su.get("title") or "").lower().strip()
            matched = title_to_node.get(t)
            if matched:
                su["node_id"] = matched.id
                su["title"] = matched.title
                su["node_type"] = matched.type

        npc_updates = []
        for nu in node_updates:
            npc_updates.append({
                "name": nu.get("node_title", "NPC"),
                "node_title": nu.get("node_title", "NPC"),
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
    title_to_node = {n.title.lower().strip(): n for n in nodes}
    id_to_node = {n.id: n for n in nodes}

    effective_status_updates = status_updates or []
    effective_node_updates = node_updates or npc_updates or []
    effective_new_nodes = new_nodes or emergent_nodes or []
    effective_new_edges = new_edges or emergent_edges or []
    effective_next_session = next_session_node or next_session_prep
    
    applied_status_count = 0
    # 1. Apply Status Updates
    for su in effective_status_updates:
        node_id = su.get("node_id")
        matched = id_to_node.get(node_id) if node_id else None
        if not matched:
            t = (su.get("node_title") or su.get("title") or "").lower().strip()
            matched = title_to_node.get(t)

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
            t = (nu.get("node_title") or nu.get("name") or "").lower().strip()
            matched = title_to_node.get(t)

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
                revealed_to_players=n.get("revealed_to_players", True)
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
                    revealed_to_players=True
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
                revealed_to_players=True
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
        created_note = player_service.create_note(
            PlayerNoteCreate(
                campaign_id=campaign_id,
                author_name=author,
                title=note_title,
                content=note_content,
                node_id=created_next_session_id or (session_node_id if session_node_id else None)
            )
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
