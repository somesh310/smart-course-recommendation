import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createServer } from 'node:http';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-with-more-than-thirty-two-characters';
process.env.JWT_EXPIRES_IN = '1h';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.ML_SERVICE_URL = '';

let mongo;
let app;
let Course;
let User;
let api;
let course;
let studentToken;
let studentId;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  ({ default: app } = await import('../src/app.js'));
  ({ default: Course } = await import('../src/models/Course.js'));
  ({ default: User } = await import('../src/models/User.js'));
  const passwordHash = await bcrypt.hash('strong-pass-123', 4);
  const student = await User.create({ name: 'Test Student', email: 'student@example.com', passwordHash, emailVerified: true });
  studentId = student.id;
  const { generateToken } = await import('../src/utils/generateToken.js');
  studentToken = generateToken(student);
  api = request(app);
  course = await Course.create({
    title: 'Test Python Foundations', slug: 'test-python-foundations',
    description: 'A practical introduction to Python programming fundamentals.',
    category: 'Python', level: 'Beginner', duration: 8, durationUnit: 'weeks',
    priceType: 'Free', price: 0, currency: 'USD', skills: ['Python'],
    prerequisites: [], learningOutcomes: ['Practice Python'], provider: 'Test Provider',
    externalUrl: 'https://example.org/course', published: true,
  });
});

after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

test('registration validates input and requires configured email delivery', async () => {
  const invalid = await api.post('/api/auth/register').send({ name: 'A', email: 'bad', password: 'short' });
  assert.equal(invalid.status, 400);
  const response = await api.post('/api/auth/register').send({ name: 'Pending Student', email: 'pending@example.com', password: 'strong-pass-123' });
  assert.equal(response.status, 503);
  assert.match(response.body.message, /email is not configured/);
  const stored = await User.findById(studentId).select('+passwordHash');
  assert.notEqual(stored.passwordHash, 'strong-pass-123');
  assert.ok(stored.passwordHash.startsWith('$2'));
});

test('login rejects incorrect credentials and authenticated user routes are private', async () => {
  const invalidLogin = await api.post('/api/auth/login').send({ email: 'student@example.com', password: 'wrong-password' });
  assert.equal(invalidLogin.status, 401);
  const profile = await api.get('/api/users/me').set('Authorization', `Bearer ${studentToken}`);
  assert.equal(profile.status, 200);
  assert.equal(profile.body.data.user.email, 'student@example.com');
  assert.equal((await api.get('/api/users/me')).status, 401);
});

test('student profile updates are validated and cannot elevate role', async () => {
  const response = await api.put('/api/users/me').set('Authorization', `Bearer ${studentToken}`).send({ careerGoal: 'Backend Engineer', role: 'admin' });
  assert.equal(response.status, 400);
  const update = await api.put('/api/users/me').set('Authorization', `Bearer ${studentToken}`).send({ careerGoal: 'Backend Engineer', weeklyLearningHours: 8 });
  assert.equal(update.status, 200);
  assert.equal(update.body.data.user.role, 'student');
  assert.equal((await api.patch('/api/users/me/preferences').set('Authorization', `Bearer ${studentToken}`).send({ weeklyLearningHours: 100 })).status, 400);
});

test('published courses are public, filtered and paginated; course writes require admin', async () => {
  const listing = await api.get('/api/courses?category=Python&page=1&limit=1');
  assert.equal(listing.status, 200);
  assert.equal(listing.body.data.length, 1);
  assert.equal(listing.body.pagination.total, 1);
  assert.equal((await api.get(`/api/courses/${course.id}`)).status, 200);
  assert.equal((await api.post('/api/courses').set('Authorization', `Bearer ${studentToken}`).send({})).status, 403);
  await User.updateOne({ _id: studentId }, { $set: { role: 'admin' } });
  const adminToken = (await api.post('/api/auth/login').send({ email: 'student@example.com', password: 'strong-pass-123' })).body.data.token;
  const created = await api.post('/api/courses').set('Authorization', `Bearer ${adminToken}`).send({
    title: 'Admin Added Course', slug: 'admin-added-course', description: 'A sufficiently long description for a validated course.',
    category: 'Python', level: 'Beginner', duration: 2, durationUnit: 'weeks', priceType: 'Free', provider: 'Test Provider',
  });
  assert.equal(created.status, 201);
});

test('enrollment prevents duplicates and manual completion cannot be claimed', async () => {
  const student = await User.findById(studentId);
  student.role = 'student';
  await student.save();
  const token = (await api.post('/api/auth/login').send({ email: 'student@example.com', password: 'strong-pass-123' })).body.data.token;
  const enrollment = await api.post('/api/learning/enroll').set('Authorization', `Bearer ${token}`).send({ courseId: course.id });
  assert.equal(enrollment.status, 201);
  assert.equal(enrollment.body.data.progress, 0);
  assert.equal((await api.patch(`/api/learning/${course.id}/study-time`).set('Authorization', `Bearer ${token}`).send({ minutes: 90 })).status, 200);
  assert.equal((await api.patch(`/api/learning/${course.id}/study-time`).set('Authorization', `Bearer ${token}`).send({ minutes: 30 })).body.data.studyMinutes, 120);
  assert.equal((await api.patch(`/api/learning/${course.id}/study-time`).set('Authorization', `Bearer ${token}`).send({ minutes: 0 })).status, 400);
  assert.equal((await api.post('/api/learning/enroll').set('Authorization', `Bearer ${token}`).send({ courseId: course.id })).status, 409);
  assert.equal((await api.patch(`/api/learning/${course.id}/progress`).set('Authorization', `Bearer ${token}`).send({ progress: 101 })).status, 400);
  const complete = await api.patch(`/api/learning/${course.id}/progress`).set('Authorization', `Bearer ${token}`).send({ progress: 100 });
  assert.equal(complete.status, 409);
  const other = await User.create({ name: 'Other Student', email: 'other@example.com', passwordHash: await bcrypt.hash('strong-pass-456', 4), emailVerified: true });
  const { generateToken } = await import('../src/utils/generateToken.js');
  assert.equal((await api.patch(`/api/learning/${course.id}/progress`).set('Authorization', `Bearer ${generateToken(other)}`).send({ progress: 50 })).status, 404);
  const dashboard = await api.get('/api/dashboard').set('Authorization', `Bearer ${token}`);
  assert.equal(dashboard.body.data.stats.completedCourses, 0);
  assert.equal(dashboard.body.data.stats.learningHours, 2);
});

test('recommendations require the configured ML service and never return fallback data', async () => {
  const token = (await api.post('/api/auth/login').send({ email: 'student@example.com', password: 'strong-pass-123' })).body.data.token;
  assert.equal((await api.get('/api/recommendations?top_n=21').set('Authorization', `Bearer ${token}`)).status, 400);
  const response = await api.get('/api/recommendations').set('Authorization', `Bearer ${token}`);
  assert.equal(response.status, 503);
  assert.match(response.body.message, /temporarily unavailable/);
  assert.deepEqual(response.body.data, undefined);
  assert.equal((await api.get('/api/recommendations/careers').set('Authorization', `Bearer ${token}`)).status, 503);
  assert.equal((await api.post('/api/recommendations/learning-path').send({ career_id: 'ai-ml-engineer' })).status, 401);
  assert.equal((await api.post('/api/recommendations/learning-path').set('Authorization', `Bearer ${token}`).send({ career_id: 'bad id' })).status, 400);
  assert.equal((await api.post('/api/recommendations/learning-path').set('Authorization', `Bearer ${token}`).send({ career_id: 'ai-ml-engineer' })).status, 503);
});

test('missing MongoDB configuration and unavailable ML service return explicit states', async () => {
  const { connectDatabase } = await import('../src/config/database.js');
  await assert.rejects(() => connectDatabase(''), /MONGODB_URI is required/);
  process.env.ML_SERVICE_URL = 'http://127.0.0.1:1';
  const { requestModelRecommendations } = await import('../src/services/mlServiceClient.js');
  const result = await requestModelRecommendations({ interests: [], careerGoal: '', currentSkills: [] });
  assert.equal(result.status, 'unavailable');
  assert.equal(result.data, null);
  delete process.env.ML_SERVICE_URL;
});

test('YouTube resources validate embeds, enforce admin access, and let students request missing content', async () => {
  const token = (await api.post('/api/auth/login').send({ email: 'student@example.com', password: 'strong-pass-123' })).body.data.token;
  assert.equal((await api.post('/api/learning-content/admin/resources').set('Authorization', `Bearer ${token}`).send({})).status, 403);
  assert.equal((await api.post('/api/learning-content/requests').set('Authorization', `Bearer ${token}`).send({ courseName: 'SQL fundamentals', skill: 'SQL' })).status, 201);
  assert.equal((await api.post('/api/learning-content/requests').set('Authorization', `Bearer ${token}`).send({ courseName: 'SQL fundamentals', skill: 'SQL' })).status, 409);
  await User.updateOne({ _id: studentId }, { $set: { role: 'admin' } });
  const adminToken = (await api.post('/api/auth/login').send({ email: 'student@example.com', password: 'strong-pass-123' })).body.data.token;
  const invalidUrl = await api.post('/api/learning-content/admin/resources').set('Authorization', `Bearer ${adminToken}`).send({ title: 'Invalid resource', subject: 'SQL', youtubeUrl: 'https://example.com/watch', difficulty: 'Beginner' });
  assert.equal(invalidUrl.status, 400);
  const created = await api.post('/api/learning-content/admin/resources').set('Authorization', `Bearer ${adminToken}`).send({ title: 'SQL basics', subject: 'SQL', courseId: course.id, courseTitle: course.title, skills: ['SQL'], difficulty: 'Beginner', youtubeUrl: 'https://youtu.be/abcdefghijk', channelName: 'Learning Channel', durationSeconds: 100, order: 0 });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.youtubeId, 'abcdefghijk');
  assert.equal(created.body.data.kind, 'video');
  const visible = await api.get('/api/learning-content/resources?subject=SQL');
  assert.equal(visible.status, 200);
  assert.equal(visible.body.data.length, 1);
  await User.updateOne({ _id: studentId }, { $set: { role: 'student' } });
  const studentAgain = (await api.post('/api/auth/login').send({ email: 'student@example.com', password: 'strong-pass-123' })).body.data.token;
  const seekToEnd = await api.post('/api/learning-content/progress').set('Authorization', `Bearer ${studentAgain}`).send({ resourceId: created.body.data._id, positionSeconds: 100, playing: true });
  assert.equal(seekToEnd.status, 200);
  assert.equal(seekToEnd.body.data.status, 'not_started');
  const VideoProgress = (await import('../src/models/VideoProgress.js')).default;
  await VideoProgress.updateOne({ userId: studentId, resourceId: created.body.data._id }, { $set: { lastPositionSeconds: 0, lastHeartbeatAt: new Date(Date.now() - 10000) } });
  const playedSegment = await api.post('/api/learning-content/progress').set('Authorization', `Bearer ${studentAgain}`).send({ resourceId: created.body.data._id, positionSeconds: 10, playing: true });
  assert.equal(playedSegment.status, 200);
  assert.equal(playedSegment.body.data.coveragePercent, 10);
  await User.updateOne({ _id: studentId }, { $set: { role: 'admin' } });
  const adminRequests = await api.get('/api/learning-content/admin/requests?status=pending').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(adminRequests.status, 200);
  assert.equal(adminRequests.body.data[0].demand, 1);
  const resolved = await api.patch(`/api/learning-content/admin/requests/${adminRequests.body.data[0].requestId}`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'resolved', adminNote: 'A free lesson was added.', resourceId: created.body.data._id });
  assert.equal(resolved.status, 200);
  await User.updateOne({ _id: studentId }, { $set: { role: 'student' } });
});

test('public catalog does not expose paid course listings', async () => {
  await Course.create({ title: 'Paid Test Course', slug: 'paid-test-course', description: 'A paid course that is not part of the free learning catalog.', category: 'SQL', level: 'Beginner', duration: 2, durationUnit: 'weeks', priceType: 'Paid', price: 10, provider: 'Example', published: true });
  const response = await api.get('/api/courses?category=SQL');
  assert.equal(response.status, 200);
  assert.equal(response.body.data.some((row) => row.slug === 'paid-test-course'), false);
  assert.equal((await api.get('/api/courses/paid-test-course')).status, 404);
});

test('Express ML client forwards the saved profile and parses FastAPI recommendations', async () => {
  const server = createServer(async (req, res) => {
    if (req.url === '/careers') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ count: 1, careers: [{ career_id: 'ai-ml-engineer', name: 'AI/ML Engineer', description: 'Build ML systems.', required_skills: [{ skill_id: 'python', name: 'Python', weight: 3 }] }] }));
      return;
    }
    let body = '';
    for await (const chunk of req) body += chunk;
    const parsed = JSON.parse(body);
    if (req.url === '/skill-gap') {
      assert.equal(parsed.career_id, 'ai-ml-engineer');
      assert.deepEqual(parsed.skills, ['Python']);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        career: { career_id: 'ai-ml-engineer', name: 'AI/ML Engineer' },
        matched_skills: [{ skill_id: 'python', name: 'Python', weight: 3 }],
        missing_skills: [], matched_weight: 3, total_weight: 3,
        skill_coverage_percent: 100, scoring_method: 'importance_weighted_v1', unknown_skills: [],
      }));
      return;
    }
    if (req.url === '/learning-path') {
      assert.equal(parsed.career_id, 'ai-ml-engineer');
      assert.deepEqual(parsed.skills, ['Python']);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ career: { career_id: 'ai-ml-engineer', name: 'AI/ML Engineer' }, career_name: 'AI/ML Engineer', total_steps: 1, known_skills: ['python'], unknown_skills: [], sequencing_method: 'prerequisite_topological_sort_v1', steps: [{ step: 1, skill_id: 'statistics', skill_name: 'Statistics', importance_weight: 2, prerequisites: [], is_career_requirement: true, reason: 'Required for the selected career', status: 'not_started' }] }));
      return;
    }
    assert.equal(req.url, '/recommend');
    assert.deepEqual(parsed.skills, ['Python']);
    assert.equal(parsed.career_goal, 'Data Scientist');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ count: 1, message: 'ranked', recommendations: [{
      course_id: 'stable-id', course_name: 'Python Course', university: 'Example University',
      difficulty_level: 'Beginner', course_rating: 4.7, course_url: 'https://example.org/course',
      course_description: 'Course description', skills: 'Python  Data Science', similarity_score: 0.42,
    }] }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const previousUrl = process.env.ML_SERVICE_URL;
  process.env.ML_SERVICE_URL = `http://127.0.0.1:${server.address().port}`;
  try {
    const { requestModelRecommendations } = await import('../src/services/mlServiceClient.js');
    const result = await requestModelRecommendations({ currentSkills: ['Python'], interests: ['Data'], careerGoal: 'Data Scientist', experienceLevel: 'Beginner' }, { top_n: 5 });
    assert.equal(result.status, 'available');
    assert.equal(result.data.recommendations[0].similarity_score, 0.42);
    const careers = await (await import('../src/services/mlServiceClient.js')).requestModelCareers();
    assert.equal(careers.status, 'available');
    assert.equal(careers.data[0].career_id, 'ai-ml-engineer');
    const gap = await (await import('../src/services/mlServiceClient.js')).requestModelSkillGap('ai-ml-engineer', ['Python']);
    assert.equal(gap.status, 'available');
    assert.equal(gap.data.skill_coverage_percent, 100);
    const path = await (await import('../src/services/mlServiceClient.js')).requestModelLearningPath('ai-ml-engineer', ['Python']);
    assert.equal(path.status, 'available');
    assert.equal(path.data.steps[0].skill_id, 'statistics');
  } finally {
    if (previousUrl === undefined) delete process.env.ML_SERVICE_URL;
    else process.env.ML_SERVICE_URL = previousUrl;
    await new Promise((resolve) => server.close(resolve));
  }
});

test('logout revokes the current bearer token', async () => {
  const token = (await api.post('/api/auth/login').send({ email: 'student@example.com', password: 'strong-pass-123' })).body.data.token;
  assert.equal((await api.post('/api/auth/logout').set('Authorization', `Bearer ${token}`)).status, 200);
  assert.equal((await api.get('/api/auth/me').set('Authorization', `Bearer ${token}`)).status, 401);
});
