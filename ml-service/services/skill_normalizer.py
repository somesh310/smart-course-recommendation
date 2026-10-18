import re
import unicodedata


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value)
    value = value.strip().casefold()
    return re.sub(r"\s+", " ", value)


def build_alias_map(skills_data: dict) -> dict[str, str]:
    aliases = {}

    for skill_id, skill in skills_data["skills"].items():
        names = [
            skill_id,
            skill["name"],
            *skill.get("aliases", [])
        ]

        for name in names:
            key = normalize_text(name)
            previous = aliases.get(key)

            if previous is not None and previous != skill_id:
                raise ValueError(
                    f"Skill alias '{name}' maps to multiple skill IDs."
                )

            aliases[key] = skill_id

    return aliases


def resolve_skills(raw_skills, alias_map: dict):
    resolved = set()
    unknown = []

    for raw in raw_skills:
        if not isinstance(raw, str) or not raw.strip():
            continue

        skill_id = alias_map.get(normalize_text(raw))

        if skill_id:
            resolved.add(skill_id)
        else:
            unknown.append(raw.strip())

    unknown = sorted(set(unknown), key=str.casefold)
    return resolved, unknown
