import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CirclePlay } from 'lucide-react';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { getMyNotifications, markMyNotificationsRead } from '../services/notificationService';

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let data = await getMyNotifications();
      if (data.unreadCount > 0) {
        await markMyNotificationsRead();
        data = await getMyNotifications();
      }
      setItems(data.notifications || []);
    } catch (requestError) {
      setError(requestError.message || 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  return <>
    <div style={{ marginBottom: 24 }}>
      <div className="eyebrow">Account updates</div>
      <h1 className="page-title">Notifications</h1>
      <p className="muted">Updates from administrators about learning resources you requested.</p>
    </div>
    {loading ? <LoadingSpinner /> : error ? <div className="card" role="alert" style={{ padding: 18, color: '#a33' }}>{error}<button className="btn btn-outline" style={{ marginLeft: 12 }} onClick={load}>Retry</button></div> : items.length ? <section aria-label="Learning request notifications" style={{ display: 'grid', gap: 12 }}>
      {items.map((item) => <article className="card" key={item._id} style={{ padding: 18, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <span style={{ width: 36, height: 36, flex: '0 0 36px', display: 'grid', placeItems: 'center', borderRadius: 11, background: item.status === 'resolved' ? '#e8f8ef' : '#fff2e6', color: item.status === 'resolved' ? '#28734c' : '#a45b13' }}><Bell size={17} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}><strong>{item.courseName}</strong><span className="badge">{item.status}</span></div>
          {item.skill && <div className="muted" style={{ fontSize: 13, marginTop: 5 }}>Skill: {item.skill}</div>}
          <p style={{ margin: '8px 0', fontSize: 14 }}>{item.adminNote || (item.status === 'resolved' ? 'An administrator reviewed your request.' : 'An administrator could not fulfill this request yet.')}</p>
          <div className="muted" style={{ fontSize: 12 }}>{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : ''}</div>
          {item.status === 'resolved' && <Link className="btn btn-light" style={{ marginTop: 10 }} to={`/resources?search=${encodeURIComponent(item.courseName)}`}><CirclePlay size={15} />Check learning library</Link>}
        </div>
      </article>)}
    </section> : <EmptyState title="You’re all caught up" text="Updates will appear here when an administrator reviews one of your learning resource requests." />}
  </>;
}
