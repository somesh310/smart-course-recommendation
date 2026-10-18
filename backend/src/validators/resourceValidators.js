import { z } from 'zod';

const youtube = z.string().trim().url().max(2048).refine((value) => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtu.be') return /^[A-Za-z0-9_-]{11}$/.test(url.pathname.slice(1));
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') return /^[A-Za-z0-9_-]{11}$/.test(url.searchParams.get('v') || '');
      if (/^\/(embed|shorts)\/[A-Za-z0-9_-]{11}$/.test(url.pathname)) return true;
      if (url.pathname === '/playlist') return /^[A-Za-z0-9_-]+$/.test(url.searchParams.get('list') || '');
    }
  } catch { return false; }
  return false;
}, 'Enter a valid YouTube video or playlist URL.');

const strings = z.array(z.string().trim().min(1).max(120)).max(30).default([]);
export const resourceSchema = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2000).default(''),
  subject: z.string().trim().min(2).max(100),
  courseId: z.string().regex(/^[a-f\d]{24}$/i).nullable().optional().default(null),
  courseTitle: z.string().trim().max(180).default(''),
  skills: strings,
  difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']).default('Beginner'),
  careerGoal: z.string().trim().max(160).default(''),
  youtubeUrl: youtube,
  channelName: z.string().trim().max(160).default(''),
  durationSeconds: z.number().int().min(1).max(86400).nullable().optional().default(null),
  order: z.number().int().min(0).max(10000).default(0),
  active: z.boolean().default(true),
}).strict();
export const resourceIdSchema = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) });
export const resourceQuerySchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(30), subject: z.string().trim().max(100).optional(), courseId: z.string().regex(/^[a-f\d]{24}$/i).optional(), skill: z.string().trim().max(120).optional(), difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']).optional() });
export const learningRequestSchema = z.object({ courseName: z.string().trim().min(2).max(180), skill: z.string().trim().max(120).default(''), message: z.string().trim().max(1000).default('') }).strict();
export const requestUpdateSchema = z.object({ status: z.enum(['resolved', 'declined']), adminNote: z.string().trim().max(1000).default(''), resourceId: z.string().regex(/^[a-f\d]{24}$/i).nullable().optional().default(null) }).strict();
export const requestQuerySchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(30), status: z.enum(['pending', 'resolved', 'declined']).optional() });
export const playbackSchema = z.object({ resourceId: z.string().regex(/^[a-f\d]{24}$/i), positionSeconds: z.number().min(0).max(86400), playing: z.boolean() }).strict();
export const playbackParamSchema = z.object({ resourceId: z.string().regex(/^[a-f\d]{24}$/i) });

export function parseYouTubeUrl(value) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  let videoId = '';
  let playlistId = '';
  if (host === 'youtu.be') videoId = url.pathname.slice(1);
  else if (url.pathname === '/watch') { videoId = url.searchParams.get('v') || ''; playlistId = url.searchParams.get('list') || ''; }
  else if (url.pathname === '/playlist') playlistId = url.searchParams.get('list') || '';
  else if (/^\/(embed|shorts)\//.test(url.pathname)) videoId = url.pathname.split('/')[2] || '';
  return { kind: playlistId && !videoId ? 'playlist' : 'video', youtubeId: playlistId && !videoId ? playlistId : videoId };
}
