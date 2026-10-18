import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { analyzeSkillGap, getSkillGapCareers } from '../../services/recommendationService';
import LoadingSpinner from '../common/LoadingSpinner';

export default function SkillGapAnalyzer() {
  const [careers, setCareers] = useState([]);
  const [careerId, setCareerId] = useState('');
  const [result, setResult] = useState(null);
  const [loadingCareers, setLoadingCareers] = useState(true);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getSkillGapCareers()
      .then((items) => { if (active) { setCareers(items); setCareerId(items[0]?.career_id || ''); } })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoadingCareers(false); });
    return () => { active = false; };
  }, []);

  const runAnalysis = async () => {
    if (!careerId) return;
    setLoadingAnalysis(true);
    setError('');
    try { setResult(await analyzeSkillGap(careerId)); }
    catch (requestError) { setError(requestError.message); setResult(null); }
    finally { setLoadingAnalysis(false); }
  };

  return <section className="card" style={{ padding: 22, marginTop: 20 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'end', flexWrap: 'wrap' }}>
      <div><div className="eyebrow">Career readiness</div><h2 style={{ fontSize: 20, margin: '5px 0' }}>Skill gap analyzer</h2><p className="muted" style={{ fontSize: 13, margin: 0 }}>Compare your saved skills with weighted requirements for a career.</p></div>
      <div style={{ display: 'flex', gap: 8 }}>
        <select className="field" aria-label="Career to analyze" value={careerId} disabled={loadingCareers || !careers.length} onChange={(event) => { setCareerId(event.target.value); setResult(null); }}>
          {loadingCareers ? <option value="">Loading careers…</option> : careers.map((career) => <option key={career.career_id} value={career.career_id}>{career.name}</option>)}
        </select>
        <button className="btn btn-primary" disabled={!careerId || loadingAnalysis} onClick={runAnalysis}>{loadingAnalysis ? 'Analyzing…' : 'Analyze'}</button>
      </div>
    </div>
    {error && <p role="alert" style={{ color: '#a33', fontSize: 13, marginBottom: 0 }}>{error}</p>}
    {loadingCareers && <LoadingSpinner/>}
    {!loadingCareers && !error && !result && <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>Add current skills to your profile, choose a career, then select Analyze.</p>}
    {result && <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><b>{result.career.name} skill coverage</b><b style={{ color: '#574cc5' }}>{result.skill_coverage_percent}%</b></div>
      <div role="progressbar" aria-label="Career skill coverage" aria-valuenow={result.skill_coverage_percent} aria-valuemin="0" aria-valuemax="100" style={{ height: 9, background: '#ececf4', borderRadius: 8, marginTop: 9 }}><div style={{ width: `${result.skill_coverage_percent}%`, height: '100%', background: '#6256d9', borderRadius: 8 }}/></div>
      <div className="two-col" style={{ marginTop: 18 }}>
        <div><h3 style={{ fontSize: 14 }}>Matched skills ({result.matched_skills.length})</h3>{result.matched_skills.length ? result.matched_skills.map((skill) => <div key={skill.skill_id} style={{ fontSize: 13, padding: '6px 0' }}>✓ {skill.name}</div>) : <p className="muted" style={{ fontSize: 13 }}>No required skills matched yet.</p>}</div>
        <div><h3 style={{ fontSize: 14 }}>Skills to build ({result.missing_skills.length})</h3>{result.missing_skills.length ? result.missing_skills.map((skill) => <div key={skill.skill_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 13, padding: '6px 0' }}><span>{skill.name}</span><Link className="muted" to={`/resources?search=${encodeURIComponent(skill.name)}`}>Find lessons</Link></div>) : <p className="muted" style={{ fontSize: 13 }}>All listed requirements matched.</p>}</div>
      </div>
      {result.unknown_skills.length > 0 && <p className="muted" style={{ fontSize: 12 }}>These profile skills weren’t recognized in the analyzer: {result.unknown_skills.join(', ')}</p>}
      <p className="muted" style={{ fontSize: 11, marginBottom: 0 }}>Coverage uses the career profile’s weighted skill requirements; it is a planning aid, not a hiring prediction.</p>
    </div>}
  </section>;
}
