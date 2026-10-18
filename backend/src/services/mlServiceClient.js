import { z } from 'zod';

const courseSchema = z.object({
  course_id: z.string().min(1), course_name: z.string().nullable(),
  university: z.string().nullable(), difficulty_level: z.string().nullable(),
  course_rating: z.number().nullable(), course_url: z.string().nullable(),
  course_description: z.string().nullable(), skills: z.string().nullable(),
  course_duration: z.string().nullable().optional(),
  similarity_score: z.number().min(0).max(1),
}).strict();
const responseSchema = z.object({ count: z.number().int().nonnegative(), message: z.string(), recommendations: z.array(courseSchema).max(20) }).strict();
const skillSchema = z.object({ skill_id: z.string().min(1), name: z.string().min(1), weight: z.number().positive() }).strict();
const skillGapResponseSchema = z.object({
  career: z.object({ career_id: z.string().min(1), name: z.string().min(1) }).strict(),
  matched_skills: z.array(skillSchema), missing_skills: z.array(skillSchema),
  matched_weight: z.number().nonnegative(), total_weight: z.number().positive(),
  skill_coverage_percent: z.number().min(0).max(100), scoring_method: z.string().min(1),
  unknown_skills: z.array(z.string()),
}).strict();
const careersResponseSchema = z.object({
  count: z.number().int().nonnegative(),
  careers: z.array(z.object({
    career_id: z.string().min(1), name: z.string().min(1), description: z.string(),
    required_skills: z.array(skillSchema),
  }).strict()),
}).strict();
const learningPathResponseSchema = z.object({
  career: z.object({ career_id: z.string().min(1), name: z.string().min(1) }).strict(),
  career_name: z.string().min(1), total_steps: z.number().int().nonnegative(),
  known_skills: z.array(z.string()), unknown_skills: z.array(z.string()),
  sequencing_method: z.string().min(1),
  steps: z.array(z.object({ step: z.number().int().positive(), skill_id: z.string().min(1), skill_name: z.string().min(1), importance_weight: z.number().positive().nullable(), prerequisites: z.array(z.string()), is_career_requirement: z.boolean(), reason: z.string().min(1), status: z.literal('not_started') }).strict()),
}).strict();

async function requestModel(path, body, schema) {
  const url = process.env.ML_SERVICE_URL;
  if (!url) return { status: 'disabled', data: null };
  const timeout = Number(process.env.ML_SERVICE_TIMEOUT_MS) || 5000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      signal: controller.signal, body: JSON.stringify(body),
    });
    if (!response.ok) return { status: 'unavailable', data: null };
    const parsed = schema.safeParse(await response.json());
    return parsed.success ? { status: 'available', data: parsed.data } : { status: 'unavailable', data: null };
  } catch {
    return { status: 'unavailable', data: null };
  } finally {
    clearTimeout(timer);
  }
}

export async function requestModelRecommendations(profile, options = {}) {
  return requestModel('/recommend', {
    skills: profile.currentSkills || [], interests: profile.interests || [],
    career_goal: profile.careerGoal || '', level: options.level || profile.experienceLevel || undefined,
    top_n: options.top_n || 5, min_rating: options.min_rating,
  }, responseSchema);
}

export async function requestModelSkillGap(careerId, skills) {
  return requestModel('/skill-gap', { career_id: careerId, skills }, skillGapResponseSchema);
}

export async function requestModelLearningPath(careerId, skills) {
  return requestModel('/learning-path', { career_id: careerId, skills }, learningPathResponseSchema);
}

export async function requestModelCareers() {
  const url = process.env.ML_SERVICE_URL;
  if (!url) return { status: 'disabled', data: null };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.ML_SERVICE_TIMEOUT_MS) || 5000);
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/careers`, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) return { status: 'unavailable', data: null };
    const parsed = careersResponseSchema.safeParse(await response.json());
    return parsed.success ? { status: 'available', data: parsed.data.careers } : { status: 'unavailable', data: null };
  } catch {
    return { status: 'unavailable', data: null };
  } finally {
    clearTimeout(timer);
  }
}
