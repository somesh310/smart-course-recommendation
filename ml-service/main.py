"""Content based course recommendations backed by the saved TF-IDF artifacts."""
from __future__ import annotations

import hashlib
import json
import logging
import os
from urllib.parse import urlparse
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Optional, Union

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, model_validator
from scipy import sparse
from sklearn.metrics.pairwise import cosine_similarity
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("course-recommendations")
REQUIRED_COLUMNS = {
    "Course Name", "University", "Difficulty Level", "Course Rating",
    "Course URL", "Course Description", "Skills", "course_text",
}
DEFAULT_ARTIFACT_DIR = Path(__file__).resolve().parent.parent / "ml" / "1 Smart Course Recommendation Engine " / "smart_course_model"


def _safe(value: Any) -> Any:
    if value is None or pd.isna(value):
        return None
    if isinstance(value, np.generic):
        value = value.item()
    if isinstance(value, float) and not np.isfinite(value):
        return None
    return value


def _course_id(row: dict[str, Any]) -> str:
    stable_fields = "\x1f".join(str(row.get(key) or "").strip() for key in ("Course URL", "Course Name", "University"))
    return hashlib.sha256(stable_fields.encode("utf-8")).hexdigest()[:24]


def _safe_url(value: Any) -> Optional[str]:
    value = _safe(value)
    if not isinstance(value, str):
        return None
    parsed = urlparse(value.strip())
    return value.strip() if parsed.scheme in {"http", "https"} and parsed.netloc else None


def _course_record(row: dict[str, Any], score: Optional[float] = None) -> dict[str, Any]:
    result = {
        "course_id": _course_id(row),
        "course_name": _safe(row.get("Course Name")),
        "university": _safe(row.get("University")),
        "difficulty_level": _safe(row.get("Difficulty Level")),
        "course_rating": _safe(row.get("Course Rating")),
        "course_url": _safe_url(row.get("Course URL")),
        "course_description": _safe(row.get("Course Description")),
        "skills": _safe(row.get("Skills")),
    }
    if score is not None:
        result["similarity_score"] = round(float(score), 6)
    return result


def load_artifacts(artifact_dir: Optional[Union[Path, str]] = None) -> dict[str, Any]:
    directory = Path(artifact_dir or os.getenv("ARTIFACT_DIR") or DEFAULT_ARTIFACT_DIR).expanduser().resolve()
    expected = [directory / "tfidf_vectorizer.joblib", directory / "courses.csv", directory / "course_vectors.npz"]
    missing = [path.name for path in expected if not path.is_file()]
    if missing:
        raise RuntimeError(f"Required ML artifacts are missing from ARTIFACT_DIR: {', '.join(missing)}")
    try:
        vectorizer = joblib.load(expected[0])  # Only load the trusted project artifacts.
        courses = pd.read_csv(expected[1])
        matrix = sparse.load_npz(expected[2]).tocsr()
    except Exception as exc:
        raise RuntimeError("Could not load the TF-IDF vectorizer, courses.csv, or course_vectors.npz. Verify the trusted artifacts and their Python package versions.") from exc
    absent_columns = sorted(REQUIRED_COLUMNS - set(courses.columns))
    if absent_columns:
        raise RuntimeError(f"courses.csv is missing required columns: {', '.join(absent_columns)}")
    if len(courses) != matrix.shape[0]:
        raise RuntimeError(f"Course row count ({len(courses)}) does not match course vector rows ({matrix.shape[0]}).")
    if getattr(vectorizer, "vocabulary_", None) is None or len(vectorizer.vocabulary_) != matrix.shape[1]:
        raise RuntimeError(f"Vectorizer feature count does not match course vector columns ({matrix.shape[1]}).")
    courses = courses.replace({np.nan: None})
    courses["Course Rating"] = pd.to_numeric(courses["Course Rating"], errors="coerce")
    return {"vectorizer": vectorizer, "courses": courses, "matrix": matrix}


def load_skill_data() -> dict[str, Any]:
    data_dir = Path(__file__).resolve().parent / "data"
    try:
        skills_data = json.loads((data_dir / "skills.json").read_text(encoding="utf-8"))
        careers_data = json.loads((data_dir / "careers.json").read_text(encoding="utf-8"))
        prerequisites_data = json.loads((data_dir / "prerequisites.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError("Could not load data/skills.json or data/careers.json.") from exc

    if not isinstance(skills_data, dict) or not isinstance(careers_data, dict):
        raise RuntimeError("Skill and career data files must each contain a JSON object at the root.")
    if not isinstance(skills_data.get("skills"), dict) or not isinstance(careers_data.get("careers"), dict):
        raise RuntimeError("Skill data must contain a skills object and a careers object.")

    skills = skills_data["skills"]
    careers = careers_data["careers"]
    if not skills or not careers:
        raise RuntimeError("Skill data and career profiles must not be empty.")
    for skill_id, skill in skills.items():
        if not isinstance(skill, dict) or not isinstance(skill.get("name"), str) or not skill["name"].strip():
            raise RuntimeError(f"Skill '{skill_id}' must have a non-empty name.")
        if not isinstance(skill.get("aliases", []), list):
            raise RuntimeError(f"Aliases for skill '{skill_id}' must be a list.")
    for career_id, career in careers.items():
        requirements = career.get("skills") if isinstance(career, dict) else None
        if not isinstance(career, dict) or not isinstance(career.get("name"), str) or not career["name"].strip() or not isinstance(requirements, list) or not requirements:
            raise RuntimeError(f"Career '{career_id}' must have a name and at least one skill requirement.")
        for requirement in requirements:
            skill_id = requirement.get("skill_id") if isinstance(requirement, dict) else None
            weight = requirement.get("weight") if isinstance(requirement, dict) else None
            if skill_id not in skills:
                raise RuntimeError(f"Career '{career_id}' references unknown skill '{skill_id}'.")
            if isinstance(weight, bool) or not isinstance(weight, (int, float)) or not np.isfinite(weight) or weight <= 0:
                raise RuntimeError(f"Career '{career_id}' has an invalid weight for skill '{skill_id}'.")

    alias_map = build_alias_map(skills_data)
    try:
        validate_prerequisites(skills_data, prerequisites_data)
    except LearningPathConfigError as exc:
        raise RuntimeError("Prerequisite configuration is invalid.") from exc
    return {"skills": skills_data, "careers": careers_data, "prerequisites": prerequisites_data, "alias_map": alias_map}


from services.skill_normalizer import build_alias_map, resolve_skills
from services.skill_gap_engine import analyze_skill_gap
from services.learning_path_engine import LearningPathConfigError, build_learning_path, validate_prerequisites


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.artifacts = load_artifacts()
    app.state.skill_data = load_skill_data()
    logger.info("Loaded recommendation artifacts for %d courses", len(app.state.artifacts["courses"]))
    logger.info("Loaded %d career profiles for skill-gap analysis", len(app.state.skill_data["careers"]["careers"]))
    yield


app = FastAPI(title="Smart Course Recommendation ML Service", version="1.0.0", lifespan=lifespan)


class RecommendationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    skills: Union[str, list[str]] = Field(default_factory=list, max_length=5000)
    interests: Union[str, list[str]] = Field(default_factory=list, max_length=5000)
    career_goal: str = Field(default="", max_length=500)
    level: Optional[str] = Field(default=None, max_length=40)
    top_n: int = Field(default=5, ge=1, le=20)
    min_rating: Optional[float] = Field(default=None, ge=0, le=5)

    @model_validator(mode="after")
    def validate_profile(self):
        if not any(_text(getattr(self, field)) for field in ("skills", "interests", "career_goal")):
            raise ValueError("Provide at least one non-empty skill, interest, or career_goal.")
        if self.level and self.level.lower() not in {"beginner", "intermediate", "advanced", "mixed"}:
            raise ValueError("level must be Beginner, Intermediate, Advanced, or Mixed.")
        return self


class SkillGapRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    career_id: str = Field(min_length=1, max_length=80)
    skills: Union[str, list[str]] = Field(default_factory=list, max_length=5000)

    @model_validator(mode="after")
    def validate_skills(self):
        if not _text(self.skills):
            raise ValueError("Provide at least one current skill.")
        return self


class LearningPathRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    career_id: str = Field(min_length=1, max_length=80)
    skills: Union[str, list[str]] = Field(default_factory=list, max_length=5000)


def _text(value: Optional[Union[str, list[str]]]) -> str:
    if isinstance(value, list):
        return " ".join(item.strip() for item in value if isinstance(item, str) and item.strip())
    return value.strip() if isinstance(value, str) else ""


@app.get("/health")
def health():
    loaded = hasattr(app.state, "artifacts")
    return {"status": "ok" if loaded else "not_ready", "artifacts_loaded": loaded}


@app.get("/courses")
def courses(page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100)):
    data = app.state.artifacts["courses"]
    start = (page - 1) * limit
    records = [_course_record(row) for row in data.iloc[start:start + limit].to_dict(orient="records")]
    return {"count": len(records), "total": len(data), "page": page, "limit": limit, "courses": records}


@app.get("/careers")
def list_careers():
    career_data = app.state.skill_data["careers"]["careers"]
    skills_data = app.state.skill_data["skills"]["skills"]
    careers = []
    for career_id, career in sorted(career_data.items()):
        required_skills = [
            {
                "skill_id": item["skill_id"],
                "name": skills_data[item["skill_id"]]["name"],
                "weight": item["weight"],
            }
            for item in career.get("skills", [])
        ]
        careers.append({
            "career_id": career_id,
            "name": career["name"],
            "description": career.get("description", ""),
            "required_skills": required_skills,
        })
    return {"count": len(careers), "careers": careers}


@app.post("/skill-gap")
def skill_gap(request: SkillGapRequest):
    skill_data = app.state.skill_data
    careers = skill_data["careers"]["careers"]
    career = careers.get(request.career_id)
    if career is None:
        raise HTTPException(status_code=404, detail="Unknown career_id. Use GET /careers to see available careers.")

    raw_skills = request.skills if isinstance(request.skills, list) else [request.skills]
    current_skill_ids, unknown_skills = resolve_skills(raw_skills, skill_data["alias_map"])
    result = analyze_skill_gap(current_skill_ids, career, skill_data["skills"])
    return {
        "career": {"career_id": request.career_id, "name": career["name"]},
        **result,
        "unknown_skills": unknown_skills,
    }


@app.post("/learning-path")
def learning_path(request: LearningPathRequest):
    skill_data = app.state.skill_data
    career = skill_data["careers"]["careers"].get(request.career_id)
    if career is None:
        raise HTTPException(status_code=404, detail="Unknown career_id. Use GET /careers to see available careers.")
    raw_skills = request.skills if isinstance(request.skills, list) else [request.skills]
    current_skill_ids, unknown_skills = resolve_skills(raw_skills, skill_data["alias_map"])
    gap = analyze_skill_gap(current_skill_ids, career, skill_data["skills"])
    try:
        missing_skill_ids = {item["skill_id"] for item in gap["missing_skills"]}
        result = build_learning_path(current_skill_ids, career, skill_data["skills"], skill_data["prerequisites"], missing_skill_ids)
    except LearningPathConfigError as exc:
        logger.error("Learning path configuration error: %s", exc)
        raise HTTPException(status_code=500, detail="Learning path configuration is invalid.") from exc
    return {"career": {"career_id": request.career_id, "name": career["name"]}, **result, "unknown_skills": unknown_skills}


@app.post("/recommend")
def recommend(request: RecommendationRequest):
    artifacts = app.state.artifacts
    vectorizer, data, matrix = artifacts["vectorizer"], artifacts["courses"], artifacts["matrix"]
    skills = _text(request.skills)
    interests = _text(request.interests)
    goal = _text(request.career_goal)
    # Weighted profile: skills ×2, interests ×2, career goal ×3. Each field is
    # transformed independently so weights remain explicit with normalized TF-IDF.
    weights = [float(os.getenv("PROFILE_SKILLS_WEIGHT", "2")), float(os.getenv("PROFILE_INTERESTS_WEIGHT", "2")), float(os.getenv("PROFILE_CAREER_GOAL_WEIGHT", "3"))]
    fields = [skills, interests, goal]
    parts = [vectorizer.transform([value]) if value else sparse.csr_matrix((1, matrix.shape[1])) for value in fields]
    profile_vector = parts[0] * weights[0] + parts[1] * weights[1] + parts[2] * weights[2]
    if profile_vector.nnz == 0:
        return {"count": 0, "message": "The profile terms do not match the saved course vocabulary.", "recommendations": []}
    scores = cosine_similarity(profile_vector, matrix).ravel()
    eligible = np.ones(len(data), dtype=bool)
    if request.level and request.level.lower() != "mixed":
        eligible &= data["Difficulty Level"].fillna("").str.strip().str.lower().eq(request.level.lower()).to_numpy()
    if request.min_rating is not None:
        eligible &= data["Course Rating"].fillna(-1).to_numpy() >= request.min_rating
    eligible &= scores > 0
    indices = np.flatnonzero(eligible)
    indices = sorted(indices, key=lambda index: (-scores[index], _course_id(data.iloc[index].to_dict())))[:request.top_n]
    recommendations = [_course_record(data.iloc[index].to_dict(), scores[index]) for index in indices]
    return {"count": len(recommendations), "message": "Recommendations ranked by TF-IDF cosine similarity." if recommendations else "No courses matched this profile and its filters.", "recommendations": recommendations}

