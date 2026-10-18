"""Configurable prerequisite-aware learning path sequencing."""
from __future__ import annotations

import heapq
from typing import Any


class LearningPathConfigError(ValueError):
    """Raised when career or prerequisite configuration is inconsistent."""


def validate_prerequisites(skills_data: dict[str, Any], prerequisites_data: dict[str, Any]) -> dict[str, list[str]]:
    skills = skills_data.get("skills", {})
    if not isinstance(skills, dict):
        raise LearningPathConfigError("Skills configuration must contain a skills object.")
    raw = prerequisites_data.get("prerequisites") if isinstance(prerequisites_data, dict) else None
    if not isinstance(raw, dict):
        raise LearningPathConfigError("Prerequisites configuration must contain a prerequisites object.")
    graph: dict[str, list[str]] = {}
    for skill_id, required in raw.items():
        if skill_id not in skills:
            raise LearningPathConfigError("Prerequisites reference an unknown skill.")
        if not isinstance(required, list) or any(not isinstance(item, str) for item in required):
            raise LearningPathConfigError("Each prerequisite entry must be a list of skill IDs.")
        if len(set(required)) != len(required):
            raise LearningPathConfigError("Prerequisite lists must not contain duplicate skill IDs.")
        if any(item not in skills for item in required):
            raise LearningPathConfigError("Prerequisites reference an unknown skill.")
        graph[skill_id] = list(required)

    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(node: str) -> None:
        if node in visiting:
            raise LearningPathConfigError("Circular prerequisite dependencies are not allowed.")
        if node in visited:
            return
        visiting.add(node)
        for parent in graph.get(node, []):
            visit(parent)
        visiting.remove(node)
        visited.add(node)

    for skill_id in sorted(skills):
        visit(skill_id)
    return graph


def build_learning_path(current_skill_ids: set[str], career: dict[str, Any], skills_data: dict[str, Any], prerequisites_data: dict[str, Any], missing_skill_ids: set[str] | None = None) -> dict[str, Any]:
    skills = skills_data.get("skills", {})
    if not isinstance(career, dict) or not isinstance(career.get("name"), str):
        raise LearningPathConfigError("Career configuration is invalid.")
    requirements = career.get("skills")
    if not isinstance(requirements, list):
        raise LearningPathConfigError("Career requirements must be a list.")
    graph = validate_prerequisites(skills_data, prerequisites_data)
    if not requirements:
        raise LearningPathConfigError("This career has no configured skill requirements.")

    direct_weights: dict[str, float] = {}
    for item in requirements:
        skill_id = item.get("skill_id") if isinstance(item, dict) else None
        weight = item.get("weight") if isinstance(item, dict) else None
        if skill_id not in skills:
            raise LearningPathConfigError("Career configuration references an unknown skill.")
        if isinstance(weight, bool) or not isinstance(weight, (int, float)) or weight <= 0:
            raise LearningPathConfigError("Career configuration contains an invalid skill weight.")
        direct_weights[skill_id] = max(float(weight), direct_weights.get(skill_id, 0.0))

    unknown_known = current_skill_ids - set(skills)
    if unknown_known:
        raise LearningPathConfigError("Current skills contain unknown skill IDs.")
    direct = set(direct_weights) - current_skill_ids if missing_skill_ids is None else set(missing_skill_ids)
    if not direct.issubset(direct_weights) or direct.intersection(current_skill_ids):
        raise LearningPathConfigError("Skill-gap results do not match the selected career or current skills.")
    needed: set[str] = set()

    def include(skill_id: str) -> None:
        if skill_id in current_skill_ids or skill_id in needed:
            return
        needed.add(skill_id)
        for prerequisite in graph.get(skill_id, []):
            include(prerequisite)

    for skill_id in direct:
        include(skill_id)

    indegree = {skill_id: 0 for skill_id in needed}
    dependents = {skill_id: [] for skill_id in needed}
    for skill_id in needed:
        for prerequisite in graph.get(skill_id, []):
            if prerequisite in needed:
                indegree[skill_id] += 1
                dependents[prerequisite].append(skill_id)

    def priority(skill_id: str) -> tuple[float, str]:
        # Career weight is explicit; additional foundations receive a neutral weight.
        return (-direct_weights.get(skill_id, 1.0), skill_id)

    ready = [(priority(skill_id), skill_id) for skill_id, count in indegree.items() if count == 0]
    heapq.heapify(ready)
    ordered: list[str] = []
    while ready:
        _, skill_id = heapq.heappop(ready)
        ordered.append(skill_id)
        for dependent in dependents[skill_id]:
            indegree[dependent] -= 1
            if indegree[dependent] == 0:
                heapq.heappush(ready, (priority(dependent), dependent))
    if len(ordered) != len(needed):
        raise LearningPathConfigError("Circular prerequisite dependencies are not allowed.")

    steps = []
    for index, skill_id in enumerate(ordered, start=1):
        relevant = [item for item in graph.get(skill_id, []) if item in current_skill_ids or item in needed]
        is_direct = skill_id in direct
        steps.append({
            "step": index,
            "skill_id": skill_id,
            "skill_name": skills[skill_id]["name"],
            "importance_weight": direct_weights.get(skill_id),
            "prerequisites": relevant,
            "is_career_requirement": is_direct,
            "reason": "Required for the selected career" if is_direct else "Needed as a prerequisite for a required skill",
            "status": "not_started",
        })
    return {
        "career_name": career["name"],
        "total_steps": len(steps),
        "steps": steps,
        "known_skills": sorted(current_skill_ids),
        "sequencing_method": "prerequisite_topological_sort_v1",
    }
