import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, MailCheck, ShieldCheck } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { useApp } from '../context/AppContext';
import { registerAccount, resendRegistrationOtp, verifyRegistration } from '../services/authService';

export default function Register() {
  const navigate = useNavigate();
  const { acceptSession } = useApp();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [code, setCode] = useState('');
  const [verificationStep, setVerificationStep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const change = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const startSignup = async (event) => {
    event.preventDefault();
    setError(''); setNotice(''); setBusy(true);
    try {
      await registerAccount(form);
      setVerificationStep(true);
      setNotice('We sent a 6-digit verification code. Check your inbox and spam folder.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (event) => {
    event.preventDefault();
    setError(''); setNotice(''); setBusy(true);
    try {
      const session = await verifyRegistration({ email: form.email.trim(), code });
      await acceptSession(session.user);
      navigate('/profile');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const resendCode = async () => {
    setError(''); setNotice(''); setBusy(true);
    try {
      await resendRegistrationOtp(form.email.trim());
      setCode('');
      setNotice('If signup is pending for this email, a fresh code has been sent. The previous code is no longer valid.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return <><Navbar/><main className="container" style={{padding:'58px 0',maxWidth:540,minHeight:'68vh'}}><section className="card" style={{padding:30}}>
    <div style={{width:46,height:46,display:'grid',placeItems:'center',borderRadius:14,background:'#efedff',color:'#6256d9'}}>{verificationStep?<MailCheck size={22}/>:<ShieldCheck size={22}/>}</div>
    <div className="eyebrow" style={{marginTop:20}}>{verificationStep?'Verify your email':'Get started'}</div>
    <h1 style={{fontSize:28,margin:'7px 0 10px'}}>{verificationStep?'Check your inbox':'Create your Pathwise account'}</h1>
    <p className="muted" style={{fontSize:14,lineHeight:1.65}}>{verificationStep?<>Enter the 6-digit code sent to <strong>{form.email}</strong>. It expires in 10 minutes.</>:'Sign up with your email to save your learning profile and recommendations.'}</p>
    {!verificationStep ? <form onSubmit={startSignup}>
      <label className="label" htmlFor="signup-name">Full name</label><input id="signup-name" className="field" autoComplete="name" minLength={2} maxLength={100} required value={form.name} onChange={change('name')} placeholder="Your name"/>
      <label className="label" htmlFor="signup-email" style={{marginTop:15}}>Email</label><input id="signup-email" className="field" type="email" autoComplete="email" required value={form.email} onChange={change('email')} placeholder="you@example.com"/>
      <label className="label" htmlFor="signup-password" style={{marginTop:15}}>Password</label><input id="signup-password" className="field" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={form.password} onChange={change('password')} placeholder="At least 8 characters"/>
      <button className="btn btn-primary" style={{width:'100%',marginTop:20}} disabled={busy}>{busy?'Sending code…':'Continue with email'} <ArrowRight size={15}/></button>
    </form> : <form onSubmit={verifyCode}>
      <label className="label" htmlFor="signup-code">Email verification code</label><input id="signup-code" className="field" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event)=>setCode(event.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000000" style={{fontSize:22,letterSpacing:'.35em',fontWeight:800,textAlign:'center'}}/>
      <button className="btn btn-primary" style={{width:'100%',marginTop:18}} disabled={busy||code.length!==6}>{busy?'Verifying…':'Verify email and create account'} <ArrowRight size={15}/></button>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:16,fontSize:13}}><button type="button" className="btn btn-outline" disabled={busy} onClick={()=>{setVerificationStep(false);setCode('');setError('');setNotice('')}}><ArrowLeft size={14}/> Change details</button><button type="button" disabled={busy} onClick={resendCode} className="btn btn-light">Resend code</button></div>
    </form>}
    {notice&&<p role="status" className="muted" style={{fontSize:13,marginTop:14}}>{notice}</p>}
    {error&&<p role="alert" style={{color:'#b43c3c',fontSize:13,marginTop:12}}>{error}</p>}
    <div style={{textAlign:'center',fontSize:13,marginTop:20}}>Already have an account? <Link to="/login" style={{color:'#6256d9',fontWeight:700}}>Log in</Link></div>
  </section></main><Footer/></>;
}
