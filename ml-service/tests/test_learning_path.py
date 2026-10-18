import json
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

import main
from services.learning_path_engine import LearningPathConfigError, build_learning_path


class LearningPathTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        root = Path(__file__).resolve().parents[1] / "data"
        cls.skills = json.loads((root / "skills.json").read_text())
        cls.careers = json.loads((root / "careers.json").read_text())["careers"]
        cls.prerequisites = json.loads((root / "prerequisites.json").read_text())

    def path(self, known=(), career="ai-ml-engineer"):
        return build_learning_path(set(known), self.careers[career], self.skills, self.prerequisites)

    def test_empty_profile_returns_prerequisite_ordered_path(self):
        result = self.path()
        ids = [step["skill_id"] for step in result["steps"]]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertLess(ids.index("numpy"), ids.index("pandas"))
        self.assertLess(ids.index("pandas"), ids.index("machine-learning"))
        self.assertLess(ids.index("machine-learning"), ids.index("deep-learning"))

    def test_known_skills_and_prerequisites_are_excluded(self):
        ids = [step["skill_id"] for step in self.path({"python", "numpy", "pandas"})["steps"]]
        self.assertNotIn("python", ids)
        self.assertNotIn("numpy", ids)
        self.assertNotIn("pandas", ids)

    def test_duplicate_requirements_and_weighted_eligible_order(self):
        career = {"name": "Test", "skills": [{"skill_id": "python", "weight": 1}, {"skill_id": "git", "weight": 5}, {"skill_id": "python", "weight": 2}]}
        result = build_learning_path(set(), career, self.skills, self.prerequisites)
        self.assertEqual([step["skill_id"] for step in result["steps"]], ["git", "python"])

    def test_unknown_skill_and_circular_configuration_rejected(self):
        career = {"name": "Bad", "skills": [{"skill_id": "missing", "weight": 1}]}
        with self.assertRaises(LearningPathConfigError):
            build_learning_path(set(), career, self.skills, self.prerequisites)
        cycle = {"prerequisites": {"python": ["numpy"], "numpy": ["python"]}}
        with self.assertRaisesRegex(LearningPathConfigError, "Circular"):
            build_learning_path(set(), self.careers["ai-ml-engineer"], self.skills, cycle)
        unknown_prerequisite = {"prerequisites": {"numpy": ["not-a-skill"]}}
        with self.assertRaisesRegex(LearningPathConfigError, "unknown"):
            build_learning_path(set(), self.careers["ai-ml-engineer"], self.skills, unknown_prerequisite)
        malformed = {"prerequisites": {"numpy": "python"}}
        with self.assertRaisesRegex(LearningPathConfigError, "list"):
            build_learning_path(set(), self.careers["ai-ml-engineer"], self.skills, malformed)

    def test_order_is_deterministic(self):
        self.assertEqual(self.path()["steps"], self.path()["steps"])

    def test_configurable_career_and_empty_career(self):
        career = {"name": "Custom", "skills": [{"skill_id": "sql", "weight": 4}]}
        self.assertEqual(build_learning_path(set(), career, self.skills, self.prerequisites)["steps"][0]["skill_id"], "sql")
        with self.assertRaisesRegex(LearningPathConfigError, "no configured"):
            build_learning_path(set(), {"name": "Empty", "skills": []}, self.skills, self.prerequisites)

    def test_endpoint_normalizes_skills_and_rejects_unknown_career(self):
        previous = getattr(main.app.state, "skill_data", None)
        main.app.state.skill_data = main.load_skill_data()
        try:
            with TestClient(main.app) as client:
                response = client.post("/learning-path", json={"career_id": "ai-ml-engineer", "skills": ["Python", "NumPy"]})
                self.assertEqual(response.status_code, 200)
                result = response.json()
                self.assertEqual(result["career"]["career_id"], "ai-ml-engineer")
                ids = [step["skill_id"] for step in result["steps"]]
                self.assertNotIn("python", ids)
                self.assertNotIn("numpy", ids)
                self.assertEqual(client.post("/learning-path", json={"career_id": "unknown", "skills": []}).status_code, 404)
                self.assertEqual(client.post("/learning-path", json={"career_id": "ai-ml-engineer", "skills": [], "extra": 1}).status_code, 422)
        finally:
            if previous is None:
                delattr(main.app.state, "skill_data")
            else:
                main.app.state.skill_data = previous


if __name__ == "__main__":
    unittest.main()
