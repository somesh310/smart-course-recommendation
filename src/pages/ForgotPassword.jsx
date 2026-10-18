import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, MailCheck } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { requestPasswordReset } from '../services/authService';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return <><Navbar/><main className="container" style={{padding:'78px 0',maxWidth:520,minHeight:'65vh'}}><section className="card" style={{padding:30}}>
    <div style={{width:46,height:46,display:'grid',placeItems:'center',borderRadius:14,background:'#efedff',color:'#6256d9'}}><MailCheck size={22}/></div>
    <div className="eyebrow" style={{marginTop:20}}>Account recovery</div><h1 style={{fontSize:28,margin:'7px 0 10px'}}>Forgot your password?</h1>
    {sent ? <><p className="muted" role="status" style={{lineHeight:1.65}}>If an account exists for <strong>{email}</strong>, we sent a secure reset link. Check your inbox and spam folder. The link expires in 15 minutes.</p><Link className="btn btn-outline" to="/login"><ArrowLeft size={15}/>Back to login</Link></> : <><p className="muted" style={{lineHeight:1.65}}>Enter your account email and we’ll send a private, one-time reset link. This works for student and admin accounts.</p><form onSubmit={submit}><label className="label" htmlFor="reset-email">Email address</label><input id="reset-email" className="field" type="email" autoComplete="email" required value={email} onChange={event=>setEmail(event.target.value)} placeholder="you@example.com"/>{error&&<p role="alert" style={{color:'#b43c3c',fontSize:13}}>{error}</p>}<button className="btn btn-primary" style={{width:'100%',marginTop:18}} disabled={busy}>{busy?'Sending…':'Send reset link'} <ArrowRight size={15}/></button></form></>}
    <div style={{marginTop:20,fontSize:13}}><Link to="/login" style={{color:'#6256d9',fontWeight:700}}>Return to sign in</Link></div>
  </section></main><Footer/></>;
}
