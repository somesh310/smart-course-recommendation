import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

function shortTitle(title = '') {
  return title.length > 18 ? `${title.slice(0, 16)}…` : title;
}

export default function ProgressChart({ items = [] }) {
  const data = items.filter((item) => item.course).slice(0, 6).map((item) => ({
    course: shortTitle(item.course.title),
    progress: item.progress || 0,
    hours: Number(((item.studyMinutes || 0) / 60).toFixed(2)),
  }));
  if (!data.length) return <div className="muted" style={{ padding: 38, textAlign: 'center' }}>Enroll in a catalog course to see your progress and study-time charts.</div>;

  return <div>
    <h4 style={{ fontSize: 13, margin: '12px 0 0' }}>Course completion</h4>
    <div style={{ height: 190 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ left: -20, right: 8, top: 10 }}><XAxis dataKey="course" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => [`${value}%`, 'Complete']} /><Bar dataKey="progress" name="Complete" fill="#6256d9" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
    <h4 style={{ fontSize: 13, margin: '8px 0 0' }}>Study time logged (hours)</h4>
    {data.some((item) => item.hours > 0)
      ? <div style={{ height: 170 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ left: -20, right: 8, top: 10 }}><XAxis dataKey="course" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} /><YAxis allowDecimals axisLine={false} tickLine={false} /><Tooltip formatter={(value) => [`${value}h`, 'Study time']} /><Bar dataKey="hours" name="Study time" fill="#37a67a" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
      : <p className="muted" style={{ fontSize: 12 }}>Log minutes from My Learning to fill in this chart.</p>}
  </div>;
}
