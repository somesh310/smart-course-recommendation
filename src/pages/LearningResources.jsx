import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, CirclePlay, Plus, Send, ShieldCheck, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getCourses } from '../services/courseService';
import { createLearningRequest, deactivateLearningResource, getAdminRequests, getAdminResources, getLearningResources, getMyLearningRequests, getVideoProgress, saveLearningResource, saveVideoPlayback, updateLearningRequest } from '../services/learningResourceService';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';

const blank = { title: '', description: '', subject: '', courseId: null, courseTitle: '', skills: [], difficulty: 'Beginner', careerGoal: '', youtubeUrl: '', channelName: '', durationSeconds: null, order: 0, active: true };
const field = { width: '100%', padding: '11px 12px', border: '1px solid #dfe2ea', borderRadius: 9, background: '#fff', font: 'inherit', marginTop: 6 };

function YouTubeLessonPlayer({ resource, authenticated }) {
  const mountRef = useRef(null), playerRef = useRef(null), intervalRef = useRef(null), [progress, setProgress] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    const enabled = resource.kind === 'video' && authenticated;
    if (enabled) getVideoProgress(resource._id).then((result) => { if (!disposed) setProgress(result.data); }).catch((e) => { if (!disposed) setError(e.message); });
    const initialize = () => {
      if (disposed || !mountRef.current || !window.YT?.Player) return;
      const playlist = resource.kind === 'playlist';
      playerRef.current = new window.YT.Player(mountRef.current, {
        width: '100%', height: '100%', videoId: playlist ? undefined : resource.youtubeId,
        playerVars: playlist ? { listType: 'playlist', list: resource.youtubeId, enablejsapi: 1, origin: window.location.origin } : { enablejsapi: 1, origin: window.location.origin },
        events: {
          onReady: async (event) => { if (enabled) { try { const saved = await getVideoProgress(resource._id); if (saved.data.lastPositionSeconds > 0) event.target.seekTo(saved.data.lastPositionSeconds, true); } catch { /* Playback remains available if saved progress cannot be read. */ } } },
          onStateChange: async (event) => {
            if (!enabled) return;
            const playing = event.data === window.YT.PlayerState.PLAYING;
            if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
            try { const saved = await saveVideoPlayback(resource._id, event.target.getCurrentTime(), playing); if (!disposed) setProgress((prior) => ({ ...prior, ...saved.data, durationSeconds: resource.durationSeconds, supported: true })); }
            catch (e) { if (!disposed) setError(e.message); }
            if (playing) intervalRef.current = setInterval(async () => {
              const current = playerRef.current;
              if (!current || current.getPlayerState() !== window.YT.PlayerState.PLAYING) return;
              try { const saved = await saveVideoPlayback(resource._id, current.getCurrentTime(), true); if (!disposed) setProgress((prior) => ({ ...prior, ...saved.data, durationSeconds: resource.durationSeconds, supported: true })); }
              catch (e) { if (!disposed) setError(e.message); }
            }, 10000);
          },
          onError: () => { if (!disposed) setError('This YouTube video cannot be embedded or is unavailable.'); },
        },
      });
    };
    if (window.YT?.Player) initialize();
    else { const existing = document.getElementById('youtube-iframe-api'); const previous = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { previous?.(); initialize(); }; if (!existing) { const script = document.createElement('script'); script.id = 'youtube-iframe-api'; script.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(script); } }
    return () => {
      disposed = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      const player = playerRef.current;
      if (enabled && player) {
        try { void saveVideoPlayback(resource._id, player.getCurrentTime(), false); } catch { /* Keep closing the player if the final checkpoint is unavailable. */ }
      }
      player?.destroy?.();
      playerRef.current = null;
    };
  }, [resource._id, authenticated]);
  return <><div ref={mountRef} style={{ width: '100%', aspectRatio: '16 / 9', background: '#151522', borderRadius: 8, overflow: 'hidden' }} />
    {resource.kind === 'playlist' ? <p className="muted" style={{ fontSize: 12, margin: '10px 4px 3px' }}>Playlist progress is unavailable because individual video durations are not configured.</p> : !authenticated ? <p className="muted" style={{ fontSize: 12, margin: '10px 4px 3px' }}>Sign in to save playback position and count study time automatically.</p> : resource.durationSeconds ? <p className="muted" style={{ fontSize: 12, margin: '10px 4px 3px' }}>Watched coverage: {progress?.coveragePercent ?? 0}% · {progress?.status?.replace('_', ' ') || 'not started'}{progress?.status === 'completed' ? ' ✓' : ''}. Completion requires at least 90% of configured duration.</p> : <p className="muted" style={{ fontSize: 12, margin: '10px 4px 3px' }}>Playback position and study time are saved automatically; completion tracking needs a configured duration.</p>}
    {error && <p role="alert" style={{ color: '#a33', fontSize: 12 }}>{error}</p>}</>;
}

export default function LearningResources() {
  const [searchParams] = useSearchParams();
  const { profile, authenticated } = useApp();
  const admin = authenticated && profile.role === 'admin';
  const [resources, setResources] = useState([]), [requests, setRequests] = useState([]), [courses, setCourses] = useState([]);
  const [selected, setSelected] = useState(null), [form, setForm] = useState(blank), [requestForm, setRequestForm] = useState({ courseName: '', skill: '', message: '' });
  const [filterText, setFilterText] = useState(searchParams.get('search') || searchParams.get('subject') || ''), [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [myRequests, setMyRequests] = useState([]);
  const [autoFilledCourseName, setAutoFilledCourseName] = useState('');

  useEffect(() => { setFilterText(searchParams.get('search') || searchParams.get('subject') || ''); }, [searchParams]);

  async function load() {
    setLoading(true); setError('');
    try {
      if (admin) {
        const [r, q, c] = await Promise.all([getAdminResources({ limit: 100 }), getAdminRequests({ status: 'pending', limit: 100 }), getCourses({ limit: 100 })]);
        setResources(r.data.filter((item) => item.active)); setRequests(q.data); setCourses(c);
      } else {
        const [r, q] = await Promise.all([getLearningResources({ limit: 100 }), authenticated ? getMyLearningRequests() : Promise.resolve({ data: [] })]);
        setResources(r.data); setMyRequests(q.data);
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [admin, authenticated]);

  const visibleResources = useMemo(() => {
    const term = filterText.trim().toLowerCase();
    if (!term) return resources;
    return resources.filter((item) => `${item.title} ${item.courseTitle} ${item.subject} ${(item.skills || []).join(' ')}`.toLowerCase().includes(term));
  }, [resources, filterText]);

  useEffect(() => {
    const suggestedCourse = !admin && !loading && visibleResources.length === 0 ? filterText.trim() : '';
    if (!suggestedCourse) return;
    if (requestForm.courseName && requestForm.courseName !== autoFilledCourseName) return;
    setRequestForm((current) => ({ ...current, courseName: suggestedCourse }));
    setAutoFilledCourseName(suggestedCourse);
  }, [admin, loading, visibleResources.length, filterText, requestForm.courseName, autoFilledCourseName]);

  const setCourse = (id) => {
    const course = courses.find((item) => item.id === id);
    setForm((current) => ({ ...current, courseId: id || null, courseTitle: course?.title || '', subject: course?.category || current.subject }));
  };
  async function submitResource(event) {
    event.preventDefault(); setError(''); setNotice('');
    try {
      const body = { ...form, courseId: form.courseId || null, skills: typeof form.skills === 'string' ? form.skills.split(',').map((x) => x.trim()).filter(Boolean) : form.skills, durationSeconds: form.durationSeconds ? Number(form.durationSeconds) : null, order: Number(form.order) };
      const result = await saveLearningResource(body, selected?._id);
      const savedResource = result.data;
      setResources((current) => selected
        ? current.map((item) => item._id === savedResource._id ? savedResource : item)
        : [savedResource, ...current]);
      setForm(blank); setSelected(null); setNotice(selected ? 'Video updated successfully.' : 'Video added successfully.');
    } catch (e) { setError(e.message); }
  }
  async function submitRequest(event) {
    event.preventDefault(); setError(''); setNotice('');
    try { await createLearningRequest(requestForm); setRequestForm({ courseName: '', skill: '', message: '' }); setNotice('Request sent. You can follow its status below.'); await load(); }
    catch (e) { setError(e.message); }
  }
  async function resolveRequest(request) {
    const resource = resources.find((item) => item.active && (item.courseTitle.toLowerCase() === request._id.courseName.toLowerCase() || item.skills.some((s) => s.toLowerCase() === request._id.skill.toLowerCase())));
    try { await updateLearningRequest(request.requestId, { status: 'resolved', adminNote: resource ? 'A matching learning resource is now available.' : 'Reviewed by an administrator.', resourceId: resource?._id || null }); setNotice('Request marked resolved. The student can see the update in their notifications.'); await load(); }
    catch (e) { setError(e.message); }
  }
  async function deactivate(resource) {
    try { await deactivateLearningResource(resource._id); setResources((current) => current.filter((item) => item._id !== resource._id)); setNotice('Video deleted from the active library.'); }
    catch (e) { setError(e.message); }
  }

  return <div>
    <div style={{ marginBottom: 24 }}><div className="eyebrow">Free learning library</div><h1 className="page-title">Learn with YouTube</h1><p className="muted">Watch admin-reviewed videos and playlists here. Playback is provided by YouTube; videos are not downloaded or rehosted.</p></div>
    {error && <p role="alert" className="card" style={{ padding: 13, color: '#a33' }}>{error}</p>}{notice && <p role="status" className="card" style={{ padding: 13, color: '#28734c' }}>{notice}</p>}
    {admin ? <div className="two-col" style={{ alignItems: 'start' }}>
      <section className="card" style={{ padding: 20 }}><h2 style={{ marginTop: 0, fontSize: 19 }}><ShieldCheck size={18} /> Manage learning resources</h2>
        <form onSubmit={submitResource} style={{ display: 'grid', gap: 11 }}>
          <label>Title<input required maxLength="180" style={field} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label>YouTube video or playlist URL<input required type="url" placeholder="https://www.youtube.com/watch?v=..." style={field} value={form.youtubeUrl} onChange={(e) => setForm({ ...form, youtubeUrl: e.target.value })} /></label>
          <label>Assign to course<select style={field} value={form.courseId || ''} onChange={(e) => setCourse(e.target.value)}><option value="">Subject resource (no course)</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
          <div className="two-col"><label>Subject<input required style={field} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></label><label>Difficulty<select style={field} value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>{['Beginner', 'Intermediate', 'Advanced'].map((x) => <option key={x}>{x}</option>)}</select></label></div>
          <label>Skills (comma separated)<input style={field} value={Array.isArray(form.skills) ? form.skills.join(', ') : form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} /></label>
          <div className="two-col"><label>Channel / instructor<input style={field} value={form.channelName} onChange={(e) => setForm({ ...form, channelName: e.target.value })} /></label><label>Duration (seconds, optional)<input type="number" min="1" style={field} value={form.durationSeconds || ''} onChange={(e) => setForm({ ...form, durationSeconds: e.target.value })} /></label></div>
          <div className="two-col"><label>Career goal (optional)<input style={field} value={form.careerGoal} onChange={(e) => setForm({ ...form, careerGoal: e.target.value })} /></label><label>Learning order<input type="number" min="0" style={field} value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} /></label></div>
          <label>Description<textarea rows="3" style={field} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <div style={{ display: 'flex', gap: 8 }}><button className="btn btn-primary" type="submit"><Plus size={15} />{selected ? 'Update resource' : 'Add resource'}</button>{selected && <button type="button" className="btn btn-outline" onClick={() => { setSelected(null); setForm(blank); }}>Cancel edit</button>}</div>
        </form>
      </section>
      <div style={{ display: 'grid', gap: 18 }}>
        <section className="card" style={{ padding: 20 }}><h2 style={{ marginTop: 0, fontSize: 19 }}>Pending student requests</h2>{requests.length ? requests.map((r) => <article key={r._id.courseName + r._id.skill + r._id.status} style={{ borderTop: '1px solid #eceef3', padding: '13px 0' }}><b>{r._id.courseName}</b> <span className="badge">{r.demand} request{r.demand === 1 ? '' : 's'}</span><p className="muted" style={{ fontSize: 13, margin: '5px 0 10px' }}>Skill: {r._id.skill || 'Not specified'}{r.sampleMessage ? ` · ${r.sampleMessage}` : ''}</p><button className="btn btn-outline" onClick={() => resolveRequest(r)}><CheckCircle2 size={15} />Mark resolved</button></article>) : <p className="muted">No pending requests.</p>}</section>
        <section className="card" style={{ padding: 20 }}><h2 style={{ marginTop: 0, fontSize: 19 }}>Resource library</h2>{resources.length ? resources.map((r) => <article key={r._id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderTop: '1px solid #eceef3', padding: '12px 0' }}><div><b>{r.title}</b><div className="muted" style={{ fontSize: 12 }}>{r.subject} · {r.kind} · Active</div></div><div style={{ display: 'flex', gap: 7, alignItems: 'center' }}><button className="btn btn-outline" onClick={() => { setSelected(r); setForm({ ...r, skills: r.skills.join(', ') }); }}>Edit</button><button className="btn btn-outline" aria-label={`Delete ${r.title}`} title="Delete video from active library" onClick={() => deactivate(r)}><Trash2 size={15} /></button></div></article>) : <p className="muted">No active videos yet.</p>}</section>
      </div>
    </div> : <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}><input aria-label="Search lessons by course or subject" placeholder="Search by course or subject…" style={{ ...field, width: 360, marginTop: 0 }} value={filterText} onChange={(e) => setFilterText(e.target.value)} /></div>
      {loading ? <LoadingSpinner /> : visibleResources.length ? <div className="grid-courses">{visibleResources.map((r) => <article className="card" key={r._id} style={{ padding: 14 }}><button onClick={() => setSelected(r)} style={{ border: 0, padding: 0, background: 'transparent', width: '100%', textAlign: 'left', cursor: 'pointer' }} aria-label={`Play ${r.title}`}><div style={{ aspectRatio: '16 / 9', background: '#151522', borderRadius: 10, display: 'grid', placeItems: 'center', color: 'white' }}><CirclePlay size={45} /></div></button><div style={{ padding: '13px 3px 3px' }}><span className="badge">{r.subject}</span><h3 style={{ margin: '9px 0 5px', fontSize: 17 }}>{r.title}</h3><p className="muted" style={{ fontSize: 12 }}>{r.courseTitle || r.difficulty}{r.channelName ? ` · ${r.channelName}` : ''}{r.durationSeconds ? ` · ${Math.round(r.durationSeconds / 60)} min` : ''}</p>{r.description && <p className="muted" style={{ fontSize: 13 }}>{r.description}</p>}<button className="btn btn-primary" onClick={() => setSelected(r)}>Watch here <CirclePlay size={15} /></button></div></article>)}</div> : <EmptyState title="No videos for this course yet" text="You can request a learning resource and check back when it has been reviewed." />}
      {authenticated && <section className="two-col" style={{ marginTop: 22, alignItems: 'start' }}><form className="card" onSubmit={submitRequest} style={{ padding: 20 }}><h2 style={{ marginTop: 0, fontSize: 19 }}>Request a learning video</h2><label>Course or subject<input required style={field} value={requestForm.courseName} onChange={(e) => setRequestForm({ ...requestForm, courseName: e.target.value })} /></label><label>Skill (optional)<input style={field} value={requestForm.skill} onChange={(e) => setRequestForm({ ...requestForm, skill: e.target.value })} /></label><label>Message (optional)<textarea rows="3" style={field} value={requestForm.message} onChange={(e) => setRequestForm({ ...requestForm, message: e.target.value })} /></label><button className="btn btn-primary" style={{ marginTop: 12 }}><Send size={15} />Send request</button></form><section className="card" style={{ padding: 20 }}><h2 style={{ marginTop: 0, fontSize: 19 }}>Request updates</h2>{myRequests.length ? myRequests.map((r) => <div key={r._id} style={{ padding: '12px 0', borderTop: '1px solid #eceef3' }}><b>{r.courseName}</b><span className="badge" style={{ marginLeft: 8 }}>{r.status}</span>{r.status !== 'pending' && <p className="muted" style={{ fontSize: 13 }}>{r.adminNote || 'An administrator reviewed your request.'}</p>}</div>) : <p className="muted">Requests and resource updates will appear here.</p>}</section></section>}
    </>}
    {selected && !admin && <div role="dialog" aria-modal="true" aria-label={selected.title} onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: '#111827d9', zIndex: 30, display: 'grid', placeItems: 'center', padding: 18 }}><div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 'min(900px, 100%)', padding: 14 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 4px 12px' }}><div><b>{selected.title}</b><div className="muted" style={{ fontSize: 12 }}>{selected.subject}{selected.channelName ? ` · ${selected.channelName}` : ''}</div></div><button className="btn btn-outline" onClick={() => setSelected(null)} aria-label="Close player">Close</button></div><YouTubeLessonPlayer resource={selected} authenticated={authenticated} /></div></div>}
    {notice && admin && <div role="dialog" aria-modal="true" aria-labelledby="resource-success-title" onClick={() => setNotice('')} style={{ position: 'fixed', inset: 0, background: '#11182780', zIndex: 40, display: 'grid', placeItems: 'center', padding: 18 }}><section className="card" onClick={(event) => event.stopPropagation()} style={{ width: 'min(420px, 100%)', padding: 24, textAlign: 'center' }}><div style={{ width: 48, height: 48, borderRadius: '50%', margin: '0 auto 12px', display: 'grid', placeItems: 'center', color: '#28734c', background: '#e7f7ee' }}><CheckCircle2 size={25} /></div><h2 id="resource-success-title" style={{ margin: '0 0 8px', fontSize: 20 }}>Success</h2><p role="status" className="muted">{notice}</p><button autoFocus className="btn btn-primary" onClick={() => setNotice('')}>Done</button></section></div>}
  </div>;
}
