# Smart Course Recommendation System

React + Vite frontend, Express + MongoDB API, and a FastAPI content based recommendation service. The recommender loads the saved Coursera TF-IDF vectorizer and sparse course matrix; it does not train a model on requests.

## Requirements

- Node.js 20 or later and npm
- Python 3.9 or later (Python 3.9.6 was used to validate the checked-in artifacts)
- MongoDB Community locally or a MongoDB Atlas connection string

## Install and run

Install dependencies separately:

```bash
npm install
npm install --prefix backend
cp .env.example .env
cp backend/.env.example backend/.env
cp ml-service/.env.example ml-service/.env
```

Edit `backend/.env` and set `MONGODB_URI` and a random `JWT_SECRET` of at least 32 characters. For Atlas, create a cluster and database user with least-privilege access, add your development IP to the Atlas Network Access allowlist, and copy the connection URI to `MONGODB_URI`. Never commit `.env` files.

To provision an admin account, set `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` (at least 8 characters), and optionally `SEED_ADMIN_NAME` in `backend/.env`, then run the dedicated account command. Public registration creates student accounts.

```bash
npm run backend:admin
```

To seed or refresh the course catalog separately, run `npm run backend:seed`.

Run the ML service, API, and frontend in separate terminals:

```bash
npm run backend:dev
npm run dev
```

Start the Python service from a third terminal:

```bash
cd ml-service
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

The service loads artifacts from `ml/1 Smart Course Recommendation Engine /smart_course_model/` at startup. That directory must contain `tfidf_vectorizer.joblib`, `courses.csv`, and `course_vectors.npz`. The default path resolves from the project root; `ARTIFACT_DIR` can point to a different trusted artifact directory. Startup fails with a specific error when files, columns, or vector dimensions do not match. Restart Uvicorn after changing Python code, and restart it after replacing artifacts. Restart Express after changing its source or `backend/.env`; Vite reloads frontend source changes automatically.

The API defaults to `http://localhost:5001`; Vite defaults to `http://localhost:5173`. Build and preview the production frontend with `npm run build` and `npm run preview`.

If the API reports that port 5001 is already in use, stop the other backend process (press `Ctrl+C` in its terminal). On macOS, find a process using the port with `lsof -iTCP:5001 -sTCP:LISTEN -n -P`. You can also change `PORT` in `backend/.env`; if you do, update `VITE_API_BASE_URL` in the root `.env` to use the same port.

## Environment variables

Frontend `.env.example`:

- `VITE_API_BASE_URL=http://localhost:5001/api`

Backend `backend/.env.example`:

- `PORT`: API port, default 5001
- `MONGODB_URI`: local MongoDB or Atlas URI
- `JWT_SECRET`: long random signing secret, required
- `JWT_EXPIRES_IN`: token lifetime, default `7d`
- `FRONTEND_URL`: exact allowed browser origin for CORS
- `NODE_ENV`: `development`, `test`, or `production`
- `ML_SERVICE_URL`: FastAPI base URL, default in the example is `http://127.0.0.1:8000`
- `ML_SERVICE_TIMEOUT_MS`: request timeout in milliseconds, default 5000
- `GMAIL_USER`: Gmail address used by the backend to send verification and reset emails
- `GMAIL_APP_PASSWORD`: Google App Password for that Gmail account (not the account's normal password)

Vite variables are public build-time configuration. Never put database credentials, JWT secrets, or model credentials in frontend variables.

Registration sends a 6-digit email verification code through Gmail SMTP. Codes expire after 10 minutes, have a five-attempt limit, and can be resent with rate limits. Pending signup passwords are bcrypt-hashed; OTPs are stored as keyed hashes. Password recovery also uses Gmail. Turn on 2-Step Verification for the sending Google Account, create an App Password, then add `GMAIL_USER` and `GMAIL_APP_PASSWORD` to `backend/.env`. Google only offers App Passwords on eligible accounts with 2-Step Verification enabled. The reset UI is available at **Log in → Forgot password?** for students and admins. Without these server-side settings, email signup and password recovery report that email delivery is not configured; no verification codes or reset tokens are returned to the browser. Admin recovery without email can be performed by setting a new `SEED_ADMIN_PASSWORD` and running `npm run backend:admin`.

## Main folders

- `src/`: the React application and UI. API calls live in `src/services`; shared user/session state lives in `src/context`.
- `backend/src/models/`: Mongoose schemas and indexes.
- `backend/src/controllers/`: REST endpoint behavior.
- `backend/src/routes/`: route declarations and authorization.
- `backend/src/middleware/`: JWT authentication, Zod validation, errors, and 404 handling.
- `backend/src/services/`: recommendation orchestration and the private FastAPI client.
- `ml-service/`: FastAPI app and trusted artifact loader.
- `backend/src/scripts/`: idempotent course seed and optional first-admin provisioning.
- `backend/tests/`: API integration tests using an isolated in-memory MongoDB.

## Authentication and authorization

The API uses Bearer JWTs. The frontend stores the access token in browser localStorage and sends it in the `Authorization` header. Logout increments a server-side token version to revoke existing tokens. Public registration creates student accounts. Admin accounts are provisioned from backend-only seed environment variables. Admin course writes require a separately provisioned admin account. Student profile updates are allowlisted and cannot modify roles. Passwords are bcrypt hashed; password hashes and token versions are never returned. Forgot-password links are random, single-use, expire after 15 minutes, and invalidate existing sessions when used.

## API reference

All endpoints return JSON. Success responses use `{ "success": true, "message": "...", "data": ... }`; paginated responses also include `pagination`. Errors use `{ "success": false, "message": "...", "errors": [] }`.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | API health |
| POST | `/api/auth/register` | Public, rate limited | Start signup and email a verification code |
| POST | `/api/auth/verify-registration` | Public, rate limited | Verify the email code and create the account |
| POST | `/api/auth/resend-registration-otp` | Public, rate limited | Send a replacement signup code |
| POST | `/api/auth/forgot-password` | Public, rate limited | Email a single-use password reset link |
| POST | `/api/auth/reset-password` | Public, rate limited | Change password with a valid reset token |
| POST | `/api/auth/login` | Public, rate limited | Authenticate and return a token |
| POST | `/api/auth/logout` | Bearer | Revoke current tokens |
| GET | `/api/auth/me` | Bearer | Current account |
| GET | `/api/users/me` | Bearer | Student profile |
| PUT | `/api/users/me` | Bearer | Update allowlisted profile fields |
| PATCH | `/api/users/me/preferences` | Bearer | Update learning preferences |
| GET | `/api/courses` | Public | Search, filter, sort, and paginate published courses |
| GET | `/api/courses/:id` | Public | Published course by Mongo ID or slug |
| POST | `/api/courses` | Admin | Create course |
| PUT | `/api/courses/:id` | Admin | Update course and publish status |
| DELETE | `/api/courses/:id` | Admin | Delete course |
| GET | `/api/learning` | Bearer | Current user's enrollments |
| POST | `/api/learning/enroll` | Bearer | Enroll in a published course |
| GET | `/api/learning/:courseId` | Bearer | Read own enrollment |
| PATCH | `/api/learning/:courseId/progress` | Bearer | Legacy route; manual progress claims are rejected and course completion is playback-derived |
| PATCH | `/api/learning/:courseId/study-time` | Bearer | Add a logged study session in minutes (1–1440) |
| DELETE | `/api/learning/:courseId` | Bearer | Remove own enrollment |
| GET | `/api/recommendations` | Bearer | Personalized recommendations and source metadata |
| GET | `/api/recommendations/careers` | Bearer | List careers supported by the skill-gap analyzer |
| POST | `/api/recommendations/skill-gap` | Bearer | Compare saved skills with a career profile |
| POST | `/api/recommendations/learning-path` | Bearer | Sequence missing skills and prerequisites for a selected career |
| POST | `/api/recommendations/feedback` | Bearer | Record feedback on a course |
| GET | `/api/dashboard` | Bearer | Account stats, activity, progress, recommendations |
| GET | `/api/learning-content/resources` | Public | Paginated active YouTube videos/playlists; optional `subject`, `courseId`, `skill`, and `difficulty` filters |
| GET | `/api/learning-content/progress/:resourceId` | Bearer | Read the current user's saved video progress |
| POST | `/api/learning-content/progress` | Bearer | Save a short playback heartbeat for an active YouTube video |
| POST | `/api/learning-content/requests` | Bearer | Request a missing course or skill resource |
| GET | `/api/learning-content/requests/mine` | Bearer | Read request status and admin updates |
| GET | `/api/learning-content/notifications` | Bearer | List reviewed resource requests and unread count |
| PATCH | `/api/learning-content/notifications/read` | Bearer | Mark reviewed request notifications as read |
| GET | `/api/learning-content/admin/resources` | Admin | Paginated resource management list |
| POST/PUT/DELETE | `/api/learning-content/admin/resources[/:id]` | Admin | Add, edit, or deactivate a YouTube resource |
| GET | `/api/learning-content/admin/requests` | Admin | Review pending student demand |
| PATCH | `/api/learning-content/admin/requests/:id` | Admin | Resolve or decline matching requests and notify request owners in-app |

Example registration:

```bash
curl -X POST http://localhost:5001/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Sam Student","email":"sam@example.com","password":"replace-this-password"}'
```

Example authenticated request (replace the placeholder with the returned token):

```bash
curl http://localhost:5001/api/learning \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

Course list filters: `page`, `limit`, `search`, `category`, `level`, `duration=short|long`, and `sort=title|-title|createdAt|-createdAt|duration|-duration`. Public catalog listing and detail routes return free courses only.

## Integrated YouTube learning library

Authenticated students can open **YouTube learning** from the workspace sidebar. Admins see the resource editor and request queue on the same route; resource writes and request review are enforced by backend `requireRole('admin')` checks. Admins may assign resources to a course and set the learning order, subject, skill tags, difficulty, career goal, channel, and optional duration. Accepted URLs are standard YouTube video, Shorts, embed, `youtu.be`, and playlist URLs. The app embeds YouTube's official IFrame Player API and does not download or host videos. The public course catalog now lists only free courses; legacy paid records remain in the database but are not exposed by catalog listing.

For video resources with an administrator-configured duration, the IFrame player sends authenticated playback heartbeats every 10 seconds. The API credits only continuous, plausible forward playback segments, merges watched timeline ranges, resumes from the last saved position, and marks a video complete at 90% unique timeline coverage. Pauses, long gaps, direct seeking, or unknown duration do not create completion credit. Course completion is calculated from every active resource assigned to that course; only individual videos with configured durations can earn completion credit. Playlist-level progress is not currently calculated because playlist item durations are not maintained separately, so playlists and duration-unknown resources remain incomplete in the course total. YouTube may disable embedding for some videos; those errors are shown in the player and administrators can deactivate or replace the link.

Students can request missing learning resources and see pending, resolved, or declined status in the library. When an administrator resolves or declines a request, students receive an in-app notification: the authenticated workspace bell shows the unread count, and **Notifications** lists the admin note and links resolved requests to the library. Opening the notification page marks reviewed updates as read. Unread counts refresh on page focus and every 30 seconds while the workspace is open. This is in-app delivery; email and browser push are not configured.

## Recommendation integration

`GET /api/recommendations?top_n=5&level=Beginner&min_rating=4` is authenticated. Express reads the signed-in student's saved skills, interests, career goal, and experience level, then calls FastAPI at `POST {ML_SERVICE_URL}/recommend`. The browser never calls FastAPI directly. The Python service uses the saved TF-IDF artifacts, applies profile weights (skills 2, interests 2, career goal 3), filters by difficulty/rating, and returns cosine similarity scores. Similarity measures text similarity; it is not a probability or accuracy metric. If the service is unavailable or its response is invalid, the API returns HTTP 503 instead of fabricated fallback courses.

Study time is recorded by the signed-in student from **My Learning**. Each logged minute is stored on that student's enrollment; the dashboard sums those entries and charts logged hours by course alongside completion progress. This is self-reported study time, separate from the catalog's course duration. Recommendations show course duration only when an exact course URL match has duration metadata in the Mongo catalog; otherwise the UI says the source does not list it.

FastAPI endpoints: `GET /health`, `GET /courses?page=1&limit=20`, `GET /careers`, `POST /recommend`, `POST /skill-gap`, and `POST /learning-path`. OpenAPI docs are available at `/docs` when the Python service is running. Example recommendation body: `{"skills":["Python","Pandas"],"interests":["Machine Learning"],"career_goal":"AI/ML Engineer","level":"Beginner","top_n":5,"min_rating":4}`.

## Model 2: career skill-gap analysis

The second capability is the weighted career skill-gap engine in `ml-service/services/skill_gap_engine.py`. It compares the student's saved skills with a selected career profile and returns matched skills, missing skills, and weighted coverage. It does not need a separate trained binary model. The app exposes it through authenticated `POST /api/recommendations/skill-gap`; the student's `currentSkills` are read from their profile on the server.

To add or change a career profile safely:

1. Add each skill once in `ml-service/data/skills.json`, using a stable skill ID, a display name, and optional aliases.
2. Add the career to `ml-service/data/careers.json`. Every `skill_id` must exist in `skills.json`, and every weight must be a positive number.
3. Add the career ID to `skillGapSchema` in `backend/src/validators/learningValidators.js`; this keeps invalid IDs from reaching the model service.
4. Restart FastAPI. Startup validates the skill and career files and reports invalid references or weights before accepting requests.
5. Check `GET http://127.0.0.1:8000/careers`, then call the authenticated API with a valid career ID. FastAPI's direct `POST /skill-gap` endpoint is also available for local debugging.

Example authenticated request:

```bash
curl -X POST http://localhost:5001/api/recommendations/skill-gap \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"career_id":"ai-ml-engineer"}'
```

All ML capabilities use `ML_SERVICE_URL` and `ML_SERVICE_TIMEOUT_MS`. The backend validates each ML response and returns HTTP 503 if FastAPI is unavailable or returns malformed data.

## Model 3: personalized learning path

Model 3 sequences missing career skills and their unmet prerequisites. Unlike Model 1, it does not rank courses; unlike Model 2, it does not calculate coverage. It is a configurable graph algorithm, not a trained model or a prediction of student success.

The graph lives in `ml-service/data/prerequisites.json`, where each key is a skill ID and its list contains the skills required first. Every ID must exist in `skills.json`; cycles, malformed lists, and unknown references stop FastAPI startup. Career requirements and their positive importance weights remain in `careers.json`. To add a skill, define its stable ID, display name, and aliases in `skills.json`, then optionally assign prerequisites. To add a career, reference defined skill IDs with positive weights in `careers.json`. Restart FastAPI after configuration changes; startup validates the graph and career references.

Authenticated `POST /api/recommendations/learning-path` accepts `{"career_id":"ai-ml-engineer"}`. Express uses the signed-in account's saved `currentSkills`; the request cannot override them. The response contains ordered steps, career requirements, prerequisite explanations, recognized and unrecognized profile skills, exact-tagged admin-approved videos with saved playback status, and available course recommendations. If the graph is invalid, a career is unknown, or FastAPI is unavailable, the endpoint returns an error rather than a fabricated path. Course recommendations are Model 1 text matches for each skill and do not guarantee relevance. Video status comes from existing playback records; opening a video does not complete a learning step.

The sequence uses a deterministic topological sort. When multiple skills are eligible, direct career requirements are ordered by configured career weight, then skill ID; additional prerequisites use a neutral weight. This provides a prerequisite-correct order, but does not account for student pace, course quality, or an empirically optimized curriculum. Run `.venv/bin/python -m unittest discover -s tests -v` from `ml-service/` to validate Model 3 and existing Model 1/2 behavior.

## Tests

```bash
npm run backend:test
```

Backend tests use `mongodb-memory-server`, not a local or Atlas database. Python service tests include isolated fixtures and validate the real artifacts. Run `python -m unittest discover -s tests` from `ml-service/`. The artifact dimension test requires the ML Python dependencies. The API process still requires a reachable MongoDB and valid JWT secret; the frontend production build does not require either service.
