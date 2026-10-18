import unittest
from pathlib import Path
from types import SimpleNamespace

import pandas as pd
from fastapi.testclient import TestClient
from pydantic import ValidationError
from scipy import sparse
from sklearn.feature_extraction.text import TfidfVectorizer

import main


class RecommendationTests(unittest.TestCase):
    def setUp(self):
        self.previous = getattr(main.app.state, "artifacts", None)
        vectorizer = TfidfVectorizer()
        texts = ["python data science", "python machine learning", "creative writing"]
        matrix = vectorizer.fit_transform(texts).tocsr()
        main.app.state.artifacts = {
            "vectorizer": vectorizer,
            "matrix": matrix,
            "courses": pd.DataFrame([
                {"Course Name": "Python Data", "University": "A", "Difficulty Level": "Beginner", "Course Rating": 4.8, "Course URL": "https://example.org/a", "Course Description": "Data", "Skills": "python  data", "course_text": texts[0]},
                {"Course Name": "Python ML", "University": "B", "Difficulty Level": "Intermediate", "Course Rating": 4.1, "Course URL": "https://example.org/b", "Course Description": "ML", "Skills": "python  ML", "course_text": texts[1]},
                {"Course Name": "Writing", "University": "C", "Difficulty Level": "Beginner", "Course Rating": 4.9, "Course URL": "https://example.org/c", "Course Description": "Writing", "Skills": "writing", "course_text": texts[2]},
            ]),
        }

    def tearDown(self):
        if self.previous is None:
            delattr(main.app.state, "artifacts")
        else:
            main.app.state.artifacts = self.previous

    def test_request_rejects_empty_profile_and_invalid_parameters(self):
        with self.assertRaises(ValidationError):
            main.RecommendationRequest()
        with self.assertRaises(ValidationError):
            main.RecommendationRequest(skills="python", level="Expert")
        with self.assertRaises(ValidationError):
            main.RecommendationRequest(skills="python", top_n=21)
        with self.assertRaises(ValidationError):
            main.RecommendationRequest(skills="python", min_rating=6)

    def test_profile_ranking_and_stable_course_identifier(self):
        result = main.recommend(main.RecommendationRequest(skills=["python", "data"], top_n=3))
        self.assertEqual(result["recommendations"][0]["course_name"], "Python Data")
        self.assertGreater(result["recommendations"][0]["similarity_score"], result["recommendations"][1]["similarity_score"])
        again = main.recommend(main.RecommendationRequest(skills=["python", "data"], top_n=3))
        self.assertEqual(result["recommendations"][0]["course_id"], again["recommendations"][0]["course_id"])

    def test_level_and_rating_filters(self):
        result = main.recommend(main.RecommendationRequest(skills="python", level="Beginner", min_rating=4.5, top_n=10))
        self.assertEqual([row["course_name"] for row in result["recommendations"]], ["Python Data"])

    def test_no_match_returns_empty_list(self):
        result = main.recommend(main.RecommendationRequest(skills="unseen-token-zz", top_n=5))
        self.assertEqual(result["recommendations"], [])
        self.assertIn("do not match", result["message"])

    def test_real_artifact_dimensions(self):
        artifact_dir = Path(__file__).resolve().parents[2] / "ml" / "1 Smart Course Recommendation Engine " / "smart_course_model"
        artifacts = main.load_artifacts(artifact_dir)
        self.assertEqual(len(artifacts["courses"]), artifacts["matrix"].shape[0])
        self.assertEqual(len(artifacts["vectorizer"].vocabulary_), artifacts["matrix"].shape[1])

    def test_http_endpoints_load_and_recommend_from_real_artifacts(self):
        with TestClient(main.app) as client:
            self.assertEqual(client.get("/health").json()["artifacts_loaded"], True)
            page = client.get("/courses?page=1&limit=2")
            self.assertEqual(page.status_code, 200)
            self.assertEqual(len(page.json()["courses"]), 2)
            result = client.post("/recommend", json={"skills": ["Python", "Pandas"], "interests": ["Machine Learning"], "career_goal": "AI/ML Engineer", "top_n": 5})
            self.assertEqual(result.status_code, 200)
            payload = result.json()
            self.assertEqual(payload["count"], len(payload["recommendations"]))
            self.assertTrue(payload["recommendations"])
            self.assertIn("similarity_score", payload["recommendations"][0])
            self.assertTrue(payload["recommendations"][0]["course_url"].startswith("https://"))
            self.assertEqual(client.post("/recommend", json={"skills": [], "interests": [], "career_goal": ""}).status_code, 422)
            careers = client.get("/careers")
            self.assertEqual(careers.status_code, 200)
            self.assertGreater(careers.json()["count"], 0)
            gap = client.post("/skill-gap", json={"career_id": "ai-ml-engineer", "skills": ["Python", "Pandas"]})
            self.assertEqual(gap.status_code, 200)
            self.assertEqual(gap.json()["career"]["name"], "AI/ML Engineer")
            self.assertIn("python", [skill["skill_id"] for skill in gap.json()["matched_skills"]])
            self.assertTrue(gap.json()["missing_skills"])


if __name__ == "__main__":
    unittest.main()
