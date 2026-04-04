"""LangGraph supervisor graph for mission orchestration."""

from __future__ import annotations

from functools import partial
from typing import Any, Final

from api.agents.manager_agent import ManagerAgent, ManagerInput
from api.graphs.nodes import (
    OrchestrationAgents,
    analyst_node,
    bookkeeper_node,
    pattern_node,
    reporter_node,
    researcher_node,
    watchdog_node,
)
from api.graphs.state import GraphState

END_NODE: Final[str] = "__end__"

PIPELINE_SEQUENCES: Final[dict[str, list[str]]] = {
    "investigation": ["researcher", "analyst", "technician", "bookkeeper", "reporter"],
    "daily_brief": ["researcher", "analyst", "reporter"],
    "screener_scan": ["researcher", "watchdog"],
}


def _next_step(state: GraphState) -> str:
    pipeline_type = state.get("pipeline_type", "unknown")
    completed = state.get("completed_nodes", [])
    sequence = PIPELINE_SEQUENCES.get(pipeline_type, [])
    if len(completed) >= len(sequence):
        return END_NODE
    return sequence[len(completed)]


def build_supervisor_graph(
    *,
    checkpointer: Any,
    manager: ManagerAgent,
    agents: OrchestrationAgents,
) -> Any:
    from langgraph.graph import END, StateGraph

    async def supervisor_node(state: GraphState) -> dict[str, Any]:
        existing_pipeline = state.get("pipeline_type", "unknown")
        if existing_pipeline in PIPELINE_SEQUENCES and existing_pipeline != "unknown":
            return {
                "pipeline_type": existing_pipeline,
                "ticker": state.get("ticker"),
            }

        classification = await manager.run(
            ManagerInput(query=state["query"]),
            state["mission_id"],
        )
        if classification.pipeline_type == "unknown":
            return {"pipeline_type": "investigation", "ticker": classification.ticker}
        return {
            "pipeline_type": classification.pipeline_type,
            "ticker": classification.ticker,
        }

    graph = StateGraph(GraphState)
    graph.add_node("supervisor", supervisor_node)
    graph.add_node("researcher", partial(researcher_node, agents=agents))
    graph.add_node("analyst", partial(analyst_node, agents=agents))
    graph.add_node("technician", partial(pattern_node, agents=agents))
    graph.add_node("bookkeeper", partial(bookkeeper_node, agents=agents))
    graph.add_node("reporter", partial(reporter_node, agents=agents))
    graph.add_node("watchdog", partial(watchdog_node, agents=agents))

    graph.set_entry_point("supervisor")
    graph.add_conditional_edges(
        "supervisor",
        _next_step,
        {
            "researcher": "researcher",
            "analyst": "analyst",
            "technician": "technician",
            "bookkeeper": "bookkeeper",
            "reporter": "reporter",
            "watchdog": "watchdog",
            END_NODE: END,
        },
    )

    graph.add_edge("researcher", "supervisor")
    graph.add_edge("analyst", "supervisor")
    graph.add_edge("technician", "supervisor")
    graph.add_edge("bookkeeper", "supervisor")
    graph.add_edge("reporter", "supervisor")
    graph.add_edge("watchdog", "supervisor")

    return graph.compile(checkpointer=checkpointer)
