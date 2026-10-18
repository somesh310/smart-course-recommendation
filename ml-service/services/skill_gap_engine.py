def analyze_skill_gap(
    current_skill_ids: set[str],
    career: dict,
    skills_data: dict
) -> dict:
    requirements = career.get("skills", [])

    if not requirements:
        raise ValueError("This career has no configured skill requirements.")

    total_weight = 0
    matched_weight = 0
    matched = []
    missing = []

    for item in requirements:
        skill_id = item["skill_id"]
        weight = item["weight"]

        if skill_id not in skills_data["skills"]:
            raise ValueError(f"Unknown configured skill ID: {skill_id}")

        if not isinstance(weight, (int, float)) or weight <= 0:
            raise ValueError(f"Invalid weight for skill: {skill_id}")

        total_weight += weight
        skill_name = skills_data["skills"][skill_id]["name"]

        result_item = {
            "skill_id": skill_id,
            "name": skill_name,
            "weight": weight
        }

        if skill_id in current_skill_ids:
            matched.append(result_item)
            matched_weight += weight
        else:
            missing.append(result_item)

    if total_weight <= 0:
        raise ValueError("Total skill weight must be greater than zero.")

    missing.sort(key=lambda item: (-item["weight"], item["name"].casefold()))

    return {
        "matched_skills": matched,
        "missing_skills": missing,
        "matched_weight": matched_weight,
        "total_weight": total_weight,
        "skill_coverage_percent": round(
            100 * matched_weight / total_weight, 2
        ),
        "scoring_method": "importance_weighted_v1"
    }
