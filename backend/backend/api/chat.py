"""
Chat & GraphRAG QA Endpoints
============================
Grounded conversational question answering with multi-layer domain guardrails,
conversational memory, instant Cypher lookups, and SSE token streaming.
"""

import re
import json
import time
from typing import Optional, List, Dict, Any, Tuple
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from backend.config import settings
from backend.models.chat import (
    ChatRequest,
    ChatResponse,
    GuardrailStatus,
    SpatialContext,
    SpatialProjectPoint,
)
from backend.services.guardrail_service import (
    check_guardrail,
    clean_location,
    clean_description,
    CEBU_MUNICIPALITIES,
    STOP_WORDS,
)
from backend.services.neo4j_service import neo4j_service, format_currency
from backend.services.llm_service import llm_service
from pipeline.geocoding import CEBU_MUNICIPALITIES_GEO, geocode_location

router = APIRouter(prefix="/chat", tags=["Chat & GraphRAG"])


def resolve_project_context(
    question: str,
    history: List[Any]
) -> Tuple[Optional[Dict[str, Any]], List[Dict[str, Any]], str, Optional[SpatialContext]]:
    """Identify target project ID or location matches from question and conversation history."""
    terms = [w for w in re.findall(r'[A-Za-z0-9_]+', question) if w.lower() not in STOP_WORDS and len(w) > 2]
    followup_cues = ["it", "that", "this", "more", "contractor", "budget", "status", "timeline", "who", "cost", "when", "details"]
    is_followup = bool(history) and (len(terms) == 0 or any(w in question.lower().split() for w in followup_cues))

    targeted_project = None
    matched_projects = []
    graph_context = ""
    spatial_context = None
    remembered_location = None  # last location topic recovered from history (follow-ups)

    # 1. Direct Project ID match in current query
    pid_match = re.search(r'\b\d{2}[A-Za-z]{1,2}\d{4,5}\b', question, re.IGNORECASE)
    if pid_match:
        targeted_project = neo4j_service.get_project_by_id(pid_match.group(0).upper())

    # 2. Check conversation history for follow-ups
    if not targeted_project and is_followup and history:
        history_text = " ".join([h.content if hasattr(h, "content") else h.get("content", "") for h in history[-6:]])
        prev_pids = re.findall(r'\b\d{2}[A-Za-z]{1,2}\d{4,5}\b', history_text, re.IGNORECASE)
        if prev_pids:
            target_pid = prev_pids[-1].upper()
            targeted_project = neo4j_service.get_project_by_id(target_pid)

        # If no project ID was discussed, recover the last LOCATION topic so cues
        # like "tell me more about it" after "projects in Cordova" keep context.
        if not targeted_project:
            history_lower = history_text.lower()
            last_pos = -1
            for muni_key, geo_data in CEBU_MUNICIPALITIES_GEO.items():
                for m in re.finditer(r'\b' + re.escape(muni_key) + r'\b', history_lower):
                    if m.start() > last_pos:
                        last_pos = m.start()
                        remembered_location = geo_data["name"]

    # 3. If single project resolved, build single project context & spatial pin
    if targeted_project:
        graph_context = (
            f"Project: DPWH Project {targeted_project['id']}\n"
            f"Category: {targeted_project.get('category', 'Infrastructure')}\n"
            f"Location: {clean_location(targeted_project.get('location'))}\n"
            f"Scope Description: {clean_description(targeted_project.get('description'))}\n"
            f"Contractor: {targeted_project.get('contractor', 'N/A')}\n"
            f"Budget: {targeted_project.get('budget', 'N/A')}\n"
            f"Status: {targeted_project.get('status', 'Completed')}"
        )
        if targeted_project.get("latitude") and targeted_project.get("longitude"):
            lat = float(targeted_project["latitude"])
            lng = float(targeted_project["longitude"])
            spatial_context = SpatialContext(
                target_location=targeted_project.get("municipality") or clean_location(targeted_project.get("location")),
                center=[lat, lng],
                zoom=15,
                total_count=1,
                projects=[
                    SpatialProjectPoint(
                        id=targeted_project["id"],
                        description=clean_description(targeted_project.get("description")),
                        budget=targeted_project.get("budget"),
                        budget_numeric=targeted_project.get("budget_num"),
                        status=targeted_project.get("status"),
                        contractor=targeted_project.get("contractor"),
                        category=targeted_project.get("category"),
                        latitude=lat,
                        longitude=lng,
                        municipality=targeted_project.get("municipality"),
                        barangay=targeted_project.get("barangay"),
                        formatted_address=targeted_project.get("formatted_address") or targeted_project.get("location")
                    )
                ]
            )
        return targeted_project, [], graph_context, spatial_context

    # 4. Search by location or fallback to FTS
    # Check if query matches a known Cebu municipality / city
    detected_muni = None
    q_lower = question.lower()
    for muni_key, geo_data in CEBU_MUNICIPALITIES_GEO.items():
        if re.search(r'\b' + re.escape(muni_key) + r'\b', q_lower):
            detected_muni = geo_data["name"]
            break

    # Follow-up without an explicit location in the current message: fall back to
    # the location topic remembered from earlier turns (e.g. Cordova).
    if not detected_muni and remembered_location:
        detected_muni = remembered_location

    search_query = detected_muni or (" ".join(terms) if terms else question)
    loc_projects, total_cnt, total_budget = neo4j_service.search_projects_by_location(search_query)

    if loc_projects or detected_muni:
        matched_projects = loc_projects
        lines = []
        for p in matched_projects[:5]:
            pid = p['entity'].replace('DPWH Project ', '')
            desc = clean_description(p.get('description'))
            b_str = p.get('budget') or format_currency(p.get('budget_num'))
            lines.append(f"- Project {pid}: {desc} | Budget: {b_str}")
        graph_context = (
            f"Location: {search_query.title()}\n"
            f"Total Projects in Graph: {total_cnt}\n"
            f"Total Allocated Budget: {format_currency(total_budget)}\n"
            f"Sample Projects:\n" + "\n".join(lines)
        )

        # Build spatial dots context (top 50 with coordinates)
        geo = geocode_location(detected_muni or search_query)
        center_coords = None
        if geo.get("latitude") and geo.get("longitude"):
            center_coords = [float(geo["latitude"]), float(geo["longitude"])]

        map_pts = neo4j_service.get_map_projects(municipality=detected_muni or search_query, limit=50)
        dots_source = map_pts if map_pts else loc_projects
        spatial_points = []
        for pt in dots_source:
            if pt.get("latitude") and pt.get("longitude"):
                spatial_points.append(
                    SpatialProjectPoint(
                        id=pt.get("id") or pt.get("entity", "").replace("DPWH Project ", ""),
                        description=clean_description(pt.get("description")),
                        budget=pt.get("budget"),
                        budget_numeric=pt.get("budget_num"),
                        status=pt.get("status"),
                        contractor=pt.get("contractor"),
                        category=pt.get("category"),
                        latitude=float(pt["latitude"]),
                        longitude=float(pt["longitude"]),
                        municipality=pt.get("municipality"),
                        barangay=pt.get("barangay"),
                        formatted_address=pt.get("formatted_address") or pt.get("municipality")
                    )
                )

        if not center_coords and spatial_points:
            center_coords = [spatial_points[0].latitude, spatial_points[0].longitude]

        if center_coords:
            spatial_context = SpatialContext(
                target_location=detected_muni or search_query.title(),
                center=center_coords,
                zoom=13,
                total_count=total_cnt if total_cnt > 0 else len(spatial_points),
                projects=spatial_points
            )

    else:
        fts_records = neo4j_service.search_fts(search_query, limit=15)
        matched_projects = [
            r for r in fts_records
            if "Project" in r.get("labels", []) or str(r.get("entity", "")).startswith("DPWH Project")
        ]
        if matched_projects:
            lines = []
            spatial_points = []
            for p in matched_projects[:5]:
                pid = p['entity'].replace('DPWH Project ', '')
                desc = clean_description(p.get('description'))
                b_str = p.get('budget') or format_currency(p.get('budget_num'))
                lines.append(f"- Project {pid}: {desc} | Budget: {b_str}")
            for p in matched_projects:
                if p.get("latitude") and p.get("longitude"):
                    spatial_points.append(
                        SpatialProjectPoint(
                            id=p['entity'].replace('DPWH Project ', ''),
                            description=clean_description(p.get('description')),
                            budget=p.get('budget'),
                            budget_numeric=p.get('budget_num'),
                            status=p.get('status'),
                            contractor=p.get('contractor'),
                            category=p.get('category'),
                            latitude=float(p['latitude']),
                            longitude=float(p['longitude']),
                            formatted_address=p.get('formatted_address')
                        )
                    )
            graph_context = f"Matched DPWH Projects:\n" + "\n".join(lines)
            if spatial_points:
                spatial_context = SpatialContext(
                    target_location=search_query.title(),
                    center=[spatial_points[0].latitude, spatial_points[0].longitude],
                    zoom=13,
                    total_count=len(spatial_points),
                    projects=spatial_points
                )

    return None, matched_projects, graph_context, spatial_context


@router.post("", response_model=ChatResponse, summary="Grounded GraphRAG QA")
async def chat_endpoint(request: ChatRequest):
    """
    Submit natural language question to DPWH Knowledge Graph.
    - Enforces 5-layer domain guardrail in <0.1ms
    - Retrieves subgraph facts in <20ms
    - Returns instant Cypher lookup or grounded Ollama synthesis
    """
    start_time = time.perf_counter()

    # Step 1: Pre-retrieval Intent Gate
    is_off_topic, reason, rule = check_guardrail(request.message)
    if is_off_topic:
        duration = (time.perf_counter() - start_time) * 1000
        return ChatResponse(
            answer=(
                f"Out of Scope: {reason}\n"
                "This assistant is strictly restricted to DPWH Cebu infrastructure projects, "
                "contractors, budgets, and locations.\n\n"
                "Example queries:\n"
                "• 'Any projects in Bogo?'\n"
                "• 'Who is the top contractor in Cebu?'\n"
                "• 'Tell me about project 24HH0043'"
            ),
            graph_context="",
            project_card=None,
            matched_projects_count=0,
            guardrail=GuardrailStatus(is_off_topic=True, reason=reason, matched_rule=rule),
            mode=request.mode,
            duration_ms=round(duration, 2),
            model=None
        )

    # Step 2: Knowledge Graph Retrieval
    targeted_project, matched_projects, graph_context, spatial_context = resolve_project_context(
        question=request.message,
        history=request.history
    )

    # Step 3: Handle Instant Mode (Zero LLM latency)
    if request.mode == "instant":
        duration = (time.perf_counter() - start_time) * 1000
        if targeted_project:
            summary = (
                f"Project {targeted_project['id']}: {targeted_project.get('description')}\n"
                f"Contractor: {targeted_project.get('contractor', 'N/A')}\n"
                f"Budget: {targeted_project.get('budget', 'N/A')}\n"
                f"Location: {targeted_project.get('location', 'Cebu Province')}"
            )
            return ChatResponse(
                answer=summary,
                graph_context=graph_context,
                project_card=targeted_project,
                matched_projects_count=1,
                guardrail=GuardrailStatus(is_off_topic=False),
                spatial=spatial_context,
                mode="instant",
                duration_ms=round(duration, 2),
                model=None
            )
        elif matched_projects:
            count = len(matched_projects)
            return ChatResponse(
                answer=f"Found {count} DPWH projects matching your query directly in the knowledge graph.",
                graph_context=graph_context,
                project_card=None,
                matched_projects_count=count,
                guardrail=GuardrailStatus(is_off_topic=False),
                spatial=spatial_context,
                mode="instant",
                duration_ms=round(duration, 2),
                model=None
            )
        else:
            return ChatResponse(
                answer="No matching DPWH projects or locations found in the Cebu knowledge graph.",
                graph_context="",
                project_card=None,
                matched_projects_count=0,
                guardrail=GuardrailStatus(is_off_topic=False),
                spatial=spatial_context,
                mode="instant",
                duration_ms=round(duration, 2),
                model=None
            )

    # Step 4: AI Mode (Grounded Generation)
    if not graph_context:
        duration = (time.perf_counter() - start_time) * 1000
        return ChatResponse(
            answer="No relevant DPWH Cebu infrastructure projects found matching your query.",
            graph_context="",
            project_card=None,
            matched_projects_count=0,
            guardrail=GuardrailStatus(is_off_topic=False),
            spatial=spatial_context,
            mode="ai",
            duration_ms=round(duration, 2),
            model=settings.LLM_MODEL
        )

    history_payload = [{"role": h.role, "content": h.content} for h in request.history]
    messages = llm_service.construct_messages(
        question=request.message,
        graph_context=graph_context,
        history=history_payload,
        is_single_project=bool(targeted_project)
    )

    answer = await llm_service.generate_response(messages=messages, max_tokens=150)
    duration = (time.perf_counter() - start_time) * 1000

    return ChatResponse(
        answer=answer,
        graph_context=graph_context,
        project_card=targeted_project,
        matched_projects_count=1 if targeted_project else len(matched_projects),
        guardrail=GuardrailStatus(is_off_topic=False),
        spatial=spatial_context,
        mode="ai",
        duration_ms=round(duration, 2),
        model=settings.LLM_MODEL
    )


@router.post("/stream", summary="Real-Time Streaming GraphRAG QA (SSE)")
async def chat_stream_endpoint(request: ChatRequest):
    """
    Stream tokens in real-time using Server-Sent Events (SSE).
    Frontend can subscribe with EventSource or fetch stream.
    """
    async def event_generator():
        start_time = time.perf_counter()

        # Step 1: Pre-retrieval Intent Gate
        is_off_topic, reason, rule = check_guardrail(request.message)
        if is_off_topic:
            payload = {
                "event": "guardrail_blocked",
                "reason": reason,
                "message": (
                    f"Out of Scope: {reason}\n"
                    "This assistant is strictly restricted to DPWH Cebu infrastructure projects."
                )
            }
            yield f"event: guardrail\ndata: {json.dumps(payload)}\n\n"
            yield f"event: done\ndata: {json.dumps({'status': 'blocked'})}\n\n"
            return

        # Step 2: Knowledge Graph Retrieval & Spatial Targeting
        targeted_project, matched_projects, graph_context, spatial_context = resolve_project_context(
            question=request.message,
            history=request.history
        )

        spatial_dict = (
            spatial_context.model_dump()
            if hasattr(spatial_context, "model_dump")
            else spatial_context.dict()
        ) if spatial_context else None

        # Notify frontend of retrieved graph context and spatial coordinates immediately
        context_payload = {
            "has_targeted_project": bool(targeted_project),
            "project_card": targeted_project,
            "matched_projects_count": 1 if targeted_project else len(matched_projects),
            "graph_context": graph_context,
            "spatial": spatial_dict
        }
        yield f"event: context\ndata: {json.dumps(context_payload)}\n\n"

        if not graph_context:
            yield f"event: token\ndata: {json.dumps({'token': 'No matching DPWH Cebu infrastructure projects found.'})}\n\n"
            yield f"event: done\ndata: {json.dumps({'status': 'not_found'})}\n\n"
            return

        if request.mode == "instant":
            instant_text = f"Project {targeted_project['id']}: {targeted_project.get('description')}" if targeted_project else f"Found {len(matched_projects)} matching projects in graph."
            yield f"event: token\ndata: {json.dumps({'token': instant_text})}\n\n"
            yield f"event: done\ndata: {json.dumps({'status': 'completed', 'mode': 'instant'})}\n\n"
            return

        # Step 3: Stream tokens from LLM
        history_payload = [{"role": h.role, "content": h.content} for h in request.history]
        messages = llm_service.construct_messages(
            question=request.message,
            graph_context=graph_context,
            history=history_payload,
            is_single_project=bool(targeted_project)
        )

        async for chunk in llm_service.stream_tokens(messages=messages, max_tokens=150):
            yield f"event: token\ndata: {json.dumps({'token': chunk})}\n\n"

        duration = (time.perf_counter() - start_time) * 1000
        yield f"event: done\ndata: {json.dumps({'status': 'completed', 'duration_ms': round(duration, 2)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
