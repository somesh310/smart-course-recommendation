import MatchScore from './MatchScore';
import { Link } from 'react-router-dom';

export default function RecommendationCard({ item }) {
  const course = item.course;
  return <article className="card" style={{ padding: 18 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
      <span className="badge">{course.level}</span><MatchScore score={item.score}/>
    </div>
    <h3 style={{ margin: '15px 0 5px', lineHeight: 1.35 }}>{course.title}</h3>
    <div className="muted" style={{ fontSize: 13 }}>Suggested learning topic</div>
    {course.description && <p className="muted" style={{ fontSize: 13, lineHeight: 1.55 }}>{course.description}</p>}
    {course.skills.length > 0 && <p style={{ fontSize: 12, lineHeight: 1.6 }}><b>Skills:</b> {course.skills.join(', ')}</p>}
    <Link className="btn btn-outline" to={`/resources?search=${encodeURIComponent(course.title)}`}>Find free YouTube lessons</Link>
  </article>;
}
