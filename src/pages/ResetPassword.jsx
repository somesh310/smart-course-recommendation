import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, KeyRound } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { resetPassword } from '../services/authService';

export default function ResetPassword() {
  const navigate = useNavigate();
  const credentials = useMemo(() => new URLSearchParams(window.location.hash.slice(1)), []);
  const token = credentials.get('token') || '';
  const email = credentials.get('email') || '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (password.length < 12) return setError('Choose a password with at least 12 characters.');
    if (password !== confirmation) return setError('The passwords do not match.');
    setBusy(true);
    try {
      await resetPassword({ email, token, password });
      window.history.replaceState(null, '', window.location.pathname);
      navigate('/login', { replace: true, state: { message: 'Password updated. Sign in with your new password.' } });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  const invalidLink = !token || !email;
  return <><Navbar/><main className="container" style={{padding:'78px 0',maxWidth:520,minHeight:'65vh'}}><section className="card" style={{padding:30}}>
    <div style={{width:46,height:46,display:'grid',placeItems:'center',borderRadius:14,background:'#efedff',color:'#6256d9'}}><KeyRound size={22}/></div>
    <div className="eyebrow" style={{marginTop:20}}>Secure password reset</div><h1 style={{fontSize:28,margin:'7px 0 10px'}}>Choose a new password</h1>
    {invalidLink ? <><p className="muted" role="alert">This reset link is incomplete or expired. Request a new one to continue.</p><Link className="btn btn-primary" to="/forgot-password">Request a new link <ArrowRight size={15}/></Link></> : <><p className="muted">Set a new password for <strong>{email}</strong>. Use at least 12 characters.</p><form onSubmit={submit}><label className="label" htmlFor="new-password">New password</label><input id="new-password" className="field" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={event=>setPassword(event.target.value)}/><label className="label" htmlFor="confirm-password" style={{marginTop:14}}>Confirm new password</label><input id="confirm-password" className="field" type="password" autoComplete="new-password" minLength={12} required value={confirmation} onChange={event=>setConfirmation(event.target.value)}/>{error&&<p role="alert" style={{color:'#b43c3c',fontSize:13}}>{error}</p>}<button className="btn btn-primary" style={{width:'100%',marginTop:18}} disabled={busy}>{busy?'Updating…':'Update password'} <ArrowRight size={15}/></button></form></>}
    <div style={{marginTop:20,fontSize:13}}><Link to="/login" style={{color:'#6256d9',fontWeight:700}}><ArrowLeft size={14}/> Back to sign in</Link></div>
  </section></main><Footer/></>;
}
