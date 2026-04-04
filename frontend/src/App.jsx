import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import {
  Plane, Users, Plus, Search, X, ChevronRight, ChevronLeft,

  AlertCircle, Compass, Bell, CheckCircle, CheckSquare, Square,
  Lock, LogOut, Trash2, MapPin, Calendar, MessageCircle, Send,
  ArrowRight, Shield, Eye, EyeOff, Sun, Moon
} from 'lucide-react';

import './App.css';

const API = 'http://localhost:5000';
const token = () => localStorage.getItem('token');
const authHeader = () => ({ Authorization: `Bearer ${token()}` });

// ─── Toast Component ──────────────────────────────────────────────────────

const Toast = ({ toast, onClose }) => {

  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -60 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -60 }}
      className={`toast toast-${toast.type}`}
    >
      {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
      <span>{toast.message}</span>
    </motion.div>
  );
};

// ─── Input with validation ────────────────────────────────────────────────
const Field = ({ label, error, children }) => (
  <div className="field">
    {label && <label className="field-label">{label}</label>}
    {children}
    {error && <span className="field-error"><AlertCircle size={12} /> {error}</span>}
  </div>
);

// ─── Auth Modal ───────────────────────────────────────────────────────────
const AuthModal = ({ mode: initialMode, initialToken, onClose, onSuccess }) => {
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [resetToken, setResetToken] = useState(initialToken || null);


  const validate = () => {
    const e = {};
    if (mode === 'signup' && (!form.name || form.name.trim().length < 2)) e.name = 'At least 2 characters';
    if ((mode === 'signup' || mode === 'login') && (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))) e.email = 'Valid email required';
    if ((mode === 'signup' || mode === 'login') && (!form.password || form.password.length < 6)) e.password = 'At least 6 characters';
    return e;
  };

  const submit = async (e) => {
    e.preventDefault();
    setApiError('');
    setSuccessMsg('');
    
    if (mode === 'forgot') {
      if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setErrors({ email: 'Valid email required' }); return; }
      setLoading(true);
      try {
        const res = await axios.post(`${API}/api/auth/forgot-password`, { email: form.email });
        setSuccessMsg(`An email has been sent to ${form.email} with instructions to reset your password.`);
        // Note: intentionally keeping modal open so user can read message
      } catch (err) {
        setApiError(err.response?.data?.error || 'Failed to process request');
      } finally { setLoading(false); }
      return;
    }

    if (mode === 'reset') {
      if (!form.password || form.password.length < 6) { setErrors({ password: 'At least 6 characters' }); return; }
      if (form.password !== form.confirmPassword) { setErrors({ confirmPassword: 'Passwords do not match' }); return; }
      setLoading(true);
      try {
        await axios.post(`${API}/api/auth/reset-password`, { token: resetToken, newPassword: form.password });
        setSuccessMsg('Password reset successfully! You can now log in.');
        setTimeout(() => {
          setMode('login');
          setForm({ ...form, password: '', confirmPassword: '' });
          setResetToken(null);
          setSuccessMsg('');
        }, 3000);
      } catch (err) {
        setApiError(err.response?.data?.error || 'Reset failed');
      } finally { setLoading(false); }
      return;
    }

    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      const url = mode === 'login' ? `${API}/api/auth/login` : `${API}/api/auth/register`;
      const res = await axios.post(url, form);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      onSuccess(res.data.user);
      onClose();
    } catch (err) {
      setApiError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

    const googleLogin = useGoogleLogin({
      onSuccess: async (res) => {
        setLoading(true);
        try {
          const { data } = await axios.post(`${API}/api/auth/google`, { token: res.access_token });
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          onSuccess(data.user);
          onClose();
        } catch (err) {
          setApiError(err.response?.data?.error || 'Google login failed');
        } finally {
          setLoading(false);
        }
      },
      onError: () => setApiError('Google Login failed, please try again.')
    });

    return (
      <div className="modal-overlay" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          className="modal auth-modal"
          onClick={e => e.stopPropagation()}
        >
          <button className="modal-close" onClick={onClose}><X size={22} /></button>
          <div className="auth-header">
            <div className="auth-icon"><Plane size={28} /></div>
            <h2>
              {mode === 'login' ? 'Welcome back' : 
               mode === 'signup' ? 'Join TravelConnect' : 
               mode === 'forgot' ? 'Reset Password' : 
               'Set New Password'}
            </h2>
            <p className="auth-sub">
              {mode === 'login' ? 'Sign in to your account' : 
               mode === 'signup' ? 'Create your explorer profile' : 
               mode === 'forgot' ? 'Enter your email to receive a reset link' : 
               'Enter your new strong password'}
            </p>
          </div>

          {apiError && (
            <div className="alert-error">
              <AlertCircle size={16} /> {apiError}
            </div>
          )}

          {successMsg && (
            <div className="alert-success" style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: 'rgba(52, 168, 83, 0.15)', color: '#34A853', border: '1px solid rgba(52, 168, 83, 0.3)', display: 'flex', gap: '8px', alignItems: 'flex-start', margin: '0 1.5rem 1rem', fontSize: '0.85rem' }}>
              <CheckCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{successMsg}</span>
            </div>
          )}

          {(mode === 'login' || mode === 'signup') && (
            <>
              <button type="button" className="btn btn-google btn-full" onClick={() => googleLogin()} disabled={loading}>
                <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"></path><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"></path><path fill="#FBBC05" d="M3.964 10.711a5.41 5.41 0 0 1 0-3.422V4.957H.957a8.996 8.996 0 0 0 0 8.086l3.007-2.332z"></path><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.443 2.057.957 4.957L3.964 7.29c.708-2.127 2.692-3.71 5.036-3.71z"></path></svg>
                {loading ? 'Authenticating...' : 'Continue with Google'}
              </button>
              <div className="auth-divider">OR</div>
            </>
          )}

          <form onSubmit={submit} noValidate>
            {mode === 'signup' && (
              <Field label="Full Name" error={errors.name}>
                <input
                  type="text"
                  placeholder="Your name"
                  value={form.name}
                  onChange={e => { setForm({ ...form, name: e.target.value }); setErrors({ ...errors, name: '' }); }}
                  className={errors.name ? 'inp inp-error' : 'inp'}
                />
              </Field>
            )}
            
            {(mode === 'signup' || mode === 'login' || mode === 'forgot') && (
              <Field label="Email" error={errors.email}>
                <input
                  type="email"
                  placeholder="you@email.com"
                  value={form.email}
                  onChange={e => { setForm({ ...form, email: e.target.value }); setErrors({ ...errors, email: '' }); }}
                  className={errors.email ? 'inp inp-error' : 'inp'}
                />
              </Field>
            )}

            {(mode === 'signup' || mode === 'login' || mode === 'reset') && (
              <Field label={mode === 'reset' ? "New Password" : "Password"} error={errors.password}>
                <div className="inp-suffix">
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="Min. 6 characters"
                    value={form.password}
                    onChange={e => { setForm({ ...form, password: e.target.value }); setErrors({ ...errors, password: '' }); }}
                    className={errors.password ? 'inp inp-error' : 'inp'}
                  />
                  <button type="button" className="eye-btn" onClick={() => setShowPass(!showPass)}>
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {mode === 'login' && (
                  <div style={{ textAlign: 'right', marginTop: '0.4rem' }}>
                    <button type="button" className="link-btn" style={{ fontSize: '0.8rem', fontWeight: 500 }} onClick={() => { setMode('forgot'); setErrors({}); setApiError(''); }}>
                      Forgot password?
                    </button>
                  </div>
                )}
              </Field>
            )}

            {mode === 'reset' && (
              <Field label="Confirm Password" error={errors.confirmPassword}>
                <div className="inp-suffix">
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="Confirm new password"
                    value={form.confirmPassword}
                    onChange={e => { setForm({ ...form, confirmPassword: e.target.value }); setErrors({ ...errors, confirmPassword: '' }); }}
                    className={errors.confirmPassword ? 'inp inp-error' : 'inp'}
                  />
                </div>
              </Field>
            )}

            <button type="submit" className="btn btn-primary btn-full" disabled={loading} style={{ marginTop: '0.5rem' }}>
              {loading ? 'Please wait…' : 
               mode === 'login' ? 'Sign In' : 
               mode === 'signup' ? 'Create Account' : 
               mode === 'forgot' ? 'Send Link' : 'Reset Password'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

        <p className="auth-switch">
          {mode === 'login' ? "Don't have an account?" : 
           mode === 'signup' ? 'Already have an account?' : 
           'Remember your password?'}
          {' '}
          <button type="button" className="link-btn" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setErrors({}); setApiError(''); setSuccessMsg(''); }}>
            {mode === 'login' ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </motion.div>
    </div>
  );
};

// ─── Create Trip Modal ────────────────────────────────────────────────────
const CreateTripModal = ({ onClose, onCreated }) => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ title: '', destination: '', date: '', endDate: '', description: '', image: '', maxPeople: 10, budget: '' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateStep = () => {
    const e = {};
    if (step === 1) {
      if (!form.title || form.title.trim().length < 3) e.title = 'Title needs at least 3 characters';
      if (!form.destination || form.destination.trim().length < 2) e.destination = 'Destination required';
    }
    if (step === 2) {
      if (!form.date) e.date = 'Start date required';
      else if (new Date(form.date) < new Date().setHours(0,0,0,0)) e.date = 'Date cannot be in the past';
      if (form.endDate && form.endDate < form.date) e.endDate = 'End date must be after start date';
    }
    if (step === 3) {
      if (!form.description || form.description.trim().length < 10) e.description = 'Description needs at least 10 characters';
    }
    return e;
  };

  const next = () => {
    const e = validateStep();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setStep(s => s + 1);
  };

  const submit = async () => {
    const e = validateStep();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    setApiError('');
    try {
      const res = await axios.post(`${API}/api/trips`, form, { headers: authHeader() });
      onCreated(res.data);
      onClose();
    } catch (err) {
      setApiError(err.response?.data?.error || 'Could not create trip');
    } finally {
      setLoading(false);
    }
  };

  const steps = ['Basics', 'Schedule', 'Details'];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="modal create-modal"
        onClick={e => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}><X size={22} /></button>
        <h2 className="modal-title">Plan New Adventure</h2>

        <div className="step-bar">
          {steps.map((s, i) => (
            <React.Fragment key={s}>
              <div className={`step-node ${step > i + 1 ? 'done' : step === i + 1 ? 'active' : ''}`}>
                {step > i + 1 ? <CheckCircle size={16} /> : <span>{i + 1}</span>}
              </div>
              {i < steps.length - 1 && <div className={`step-line ${step > i + 1 ? 'done' : ''}`} />}
            </React.Fragment>
          ))}
        </div>
        <p className="step-label">{steps[step - 1]}</p>

        {apiError && <div className="alert-error"><AlertCircle size={16} /> {apiError}</div>}

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            {step === 1 && (
              <div className="form-fields">
                <Field label="Trip Title *" error={errors.title}>
                  <input className={errors.title ? 'inp inp-error' : 'inp'} type="text" placeholder="e.g. Magical Bali Getaway" value={form.title} onChange={e => { setForm({ ...form, title: e.target.value }); setErrors({ ...errors, title: '' }); }} />
                </Field>
                <Field label="Destination *" error={errors.destination}>
                  <input className={errors.destination ? 'inp inp-error' : 'inp'} type="text" placeholder="e.g. Bali, Indonesia" value={form.destination} onChange={e => { setForm({ ...form, destination: e.target.value }); setErrors({ ...errors, destination: '' }); }} />
                </Field>
                <Field label="Cover Image URL (optional)">
                  <input className="inp" type="url" placeholder="https://..." value={form.image} onChange={e => setForm({ ...form, image: e.target.value })} />
                </Field>
              </div>
            )}
            {step === 2 && (
              <div className="form-fields">
                <Field label="Start Date *" error={errors.date}>
                  <input className={errors.date ? 'inp inp-error' : 'inp'} type="date" value={form.date} onChange={e => { setForm({ ...form, date: e.target.value }); setErrors({ ...errors, date: '' }); }} />
                </Field>
                <Field label="End Date" error={errors.endDate}>
                  <input className={errors.endDate ? 'inp inp-error' : 'inp'} type="date" value={form.endDate} onChange={e => { setForm({ ...form, endDate: e.target.value }); setErrors({ ...errors, endDate: '' }); }} />
                </Field>
                <div className="form-row">
                  <Field label="Max Participants">
                    <input className="inp" type="number" min={2} max={50} value={form.maxPeople} onChange={e => setForm({ ...form, maxPeople: e.target.value })} />
                  </Field>
                  <Field label="Est. Budget">
                    <input className="inp" type="text" placeholder="e.g. $2,000/person" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} />
                  </Field>
                </div>
              </div>
            )}
            {step === 3 && (
              <div className="form-fields">
                <Field label="Trip Description *" error={errors.description}>
                  <textarea
                    className={errors.description ? 'inp inp-error textarea' : 'inp textarea'}
                    placeholder="Describe what makes this trip special, what activities are planned, what to expect..."
                    value={form.description}
                    onChange={e => { setForm({ ...form, description: e.target.value }); setErrors({ ...errors, description: '' }); }}
                  />
                </Field>
                <div className="preview-card">
                  <div className="preview-label">Preview</div>
                  <p><strong>{form.title || 'Your Trip'}</strong> · {form.destination || 'Destination'}</p>
                  <p className="muted">{form.date} {form.endDate ? `→ ${form.endDate}` : ''} · Up to {form.maxPeople} people</p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="modal-actions">
          {step > 1 && <button className="btn btn-outline" onClick={() => setStep(s => s - 1)}><ChevronLeft size={18} /> Back</button>}
          {step < 3
            ? <button className="btn btn-primary" onClick={next}>Next <ChevronRight size={18} /></button>
            : <button className="btn btn-primary" onClick={submit} disabled={loading}>{loading ? 'Creating…' : 'Launch Adventure'} {!loading && <Plane size={18} />}</button>
          }
        </div>
      </motion.div>
    </div>
  );
};

// ─── Trip Detail Modal ─────────────────────────────────────────────────────
const TripDetailModal = ({ trip, user, onClose, onJoin, onLeave, onDelete, onRefresh }) => {
  const [tab, setTab] = useState('brief');
  const [msg, setMsg] = useState('');
  const [messages, setMessages] = useState([]);
  const [checkInput, setCheckInput] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [msgError, setMsgError] = useState('');
  const chatEnd = useRef(null);

  const isMember = user && trip.friends.includes(user.name);
  const isOrganizer = user && trip.organizer === user.name;

  useEffect(() => {
    if (isMember && tab === 'chat') fetchMessages();
  }, [tab, isMember]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const res = await axios.get(`${API}/api/trips/${trip.id}/messages`, { headers: authHeader() });
      setMessages(res.data);
    } catch {}
  };

  const sendMsg = async (e) => {
    e.preventDefault();
    if (!msg.trim()) { setMsgError('Cannot send an empty message'); return; }
    setMsgError('');
    try {
      await axios.post(`${API}/api/trips/${trip.id}/messages`, { text: msg }, { headers: authHeader() });
      setMsg('');
      fetchMessages();
    } catch (err) {
      setMsgError(err.response?.data?.error || 'Failed to send');
    }
  };

  const addCheck = async (e) => {
    e.preventDefault();
    if (!checkInput.trim()) return;
    try {
      await axios.post(`${API}/api/trips/${trip.id}/checklist`, { item: checkInput }, { headers: authHeader() });
      setCheckInput('');
      onRefresh();
    } catch {}
  };

  const toggleCheck = async (itemId) => {
    try {
      await axios.patch(`${API}/api/trips/${trip.id}/checklist/${itemId}`, {}, { headers: authHeader() });
      onRefresh();
    } catch {}
  };

  const handleJoin = async () => {
    setActionLoading('join');
    await onJoin(trip.id, trip.title);
    setActionLoading('');
  };

  const handleLeave = async () => {
    setActionLoading('leave');
    await onLeave(trip.id);
    setConfirmLeave(false);
    setActionLoading('');
    onClose();
  };

  const handleDelete = async () => {
    setActionLoading('delete');
    await onDelete(trip.id);
    setActionLoading('');
    onClose();
  };

  const spots = trip.maxPeople - trip.friends.length;
  const tripDate = new Date(trip.date);
  const tooLateToDelete = (tripDate - new Date()) / (1000 * 60 * 60) < 24;

  return (

    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        className="modal trip-detail-modal"
        onClick={e => e.stopPropagation()}
      >
        {/* Left: Visual Panel */}
        <div className="detail-visual">
          <img src={trip.image} alt={trip.title} className="detail-img" />
          <div className="detail-img-overlay">
            <div className="det-location"><Compass size={14} /> {trip.destination}</div>
            <h2 className="det-title">{trip.title}</h2>
            <div className="det-meta-pills">
              <span className="pill">{trip.friends.length}/{trip.maxPeople} people</span>
              <span className="pill">{trip.status}</span>
              {trip.budget && <span className="pill">{trip.budget}</span>}
            </div>
          </div>
          <button className="modal-close det-close" onClick={onClose}><X size={22} /></button>
        </div>

        {/* Right: Interactive Panel */}
        <div className="detail-panel">
          <div className="tabs">
            {['brief', 'chat', 'essentials'].map(t => (
              <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => { setTab(t); if (t === 'chat' && isMember) fetchMessages(); }}>
                {t === 'brief' ? 'Overview' : t === 'chat' ? 'Chat' : 'Essentials'}
                {t === 'chat' && !isMember && <Lock size={12} style={{ marginLeft: 6 }} />}
              </button>
            ))}
          </div>

          <div className="detail-content">
            {/* Overview Tab */}
            {tab === 'brief' && (
              <div className="brief-tab">
                <div className="brief-dates">
                  <Calendar size={16} />
                  <span>{trip.date}{trip.endDate && trip.endDate !== trip.date ? ` → ${trip.endDate}` : ''}</span>
                </div>
                <p className="brief-desc">{trip.description}</p>
                <div className="brief-people">
                  <p className="section-label">Expedition Members ({trip.friends.length})</p>
                  <div className="people-list">
                    {trip.friends.map((f, i) => (
                      <div key={i} className="person-chip">
                        <div className="avatar">{f.charAt(0).toUpperCase()}</div>
                        <span>{f}</span>
                        {f === trip.organizer && <span className="organizer-tag">Organizer</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="detail-actions">
                  {!user ? (
                    <p className="muted" style={{ textAlign: 'center' }}>Sign in to join this expedition</p>
                  ) : isMember ? (
                    <>
                      {isOrganizer ? (
                        tooLateToDelete ? (
                          <div className="status-banner info">
                            <Lock size={14} /> Deletion locked (trip starts in &lt; 24h)
                          </div>
                        ) : confirmDelete ? (
                          <div className="confirm-box">
                            <p>Delete this trip permanently?</p>
                            <div className="confirm-btns">
                              <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={actionLoading === 'delete'}>Yes, Delete</button>
                              <button className="btn btn-outline btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button className="btn btn-danger btn-full" onClick={() => setConfirmDelete(true)}><Trash2 size={16} /> Delete Trip</button>
                        )
                      ) : (

                        confirmLeave ? (
                          <div className="confirm-box">
                            <p>Are you sure you want to leave this trip?</p>
                            <div className="confirm-btns">
                              <button className="btn btn-danger btn-sm" onClick={handleLeave} disabled={actionLoading === 'leave'}>Yes, Leave</button>
                              <button className="btn btn-outline btn-sm" onClick={() => setConfirmLeave(false)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button className="btn btn-outline btn-full" onClick={() => setConfirmLeave(true)}><LogOut size={16} /> Leave Trip</button>
                        )
                      )}
                    </>
                  ) : spots > 0 ? (
                    <button className="btn btn-primary btn-full" onClick={handleJoin} disabled={actionLoading === 'join'}>
                      {actionLoading === 'join' ? 'Joining…' : `Join Expedition (${spots} spot${spots !== 1 ? 's' : ''} left)`}
                      {actionLoading !== 'join' && <ArrowRight size={18} />}
                    </button>
                  ) : (
                    <button className="btn btn-disabled btn-full" disabled>Trip is Full</button>
                  )}
                </div>
              </div>
            )}

            {/* Chat Tab */}
            {tab === 'chat' && (
              !isMember ? (
                <div className="locked-gate">
                  <Lock size={40} className="lock-icon" />
                  <p>Join the expedition to access the coordination chat.</p>
                  {user ? (
                    <button className="btn btn-primary" onClick={handleJoin} disabled={actionLoading === 'join'}>
                      {actionLoading === 'join' ? 'Joining…' : 'Join to Chat'}
                    </button>
                  ) : (
                    <p className="muted">Sign in first</p>
                  )}
                </div>
              ) : (
                <div className="chat-area">
                  <div className="chat-msgs">
                    {messages.map((m, i) => (
                      <div key={i} className={`bubble ${m.sender === 'System' ? 'system' : m.sender === user.name ? 'own' : 'other'}`}>
                        {m.sender !== 'System' && m.sender !== user.name && <span className="bubble-sender">{m.sender}</span>}
                        <p className="bubble-text">{m.text}</p>
                        <span className="bubble-time">{m.time}</span>
                      </div>
                    ))}
                    <div ref={chatEnd} />
                  </div>
                  {msgError && <div className="chat-error"><AlertCircle size={14} /> {msgError}</div>}
                  <form className="chat-form" onSubmit={sendMsg}>
                    <input className="inp chat-inp" value={msg} onChange={e => { setMsg(e.target.value); setMsgError(''); }} placeholder="Message the crew..." />
                    <button type="submit" className="chat-send"><Send size={18} /></button>
                  </form>
                </div>
              )
            )}

            {/* Essentials Tab */}
            {tab === 'essentials' && (
              !isMember ? (
                <div className="locked-gate">
                  <Lock size={40} className="lock-icon" />
                  <p>Join the expedition to see and manage the preparation checklist.</p>
                </div>
              ) : (
                <div className="essentials-area">
                  {trip.checklist.length === 0 && <p className="muted" style={{ textAlign: 'center', padding: '1rem' }}>No items yet. Add the first one!</p>}
                  <div className="check-list">
                    {trip.checklist.map(item => (
                      <div key={item.id} className={`check-item ${item.completed ? 'checked' : ''}`} onClick={() => toggleCheck(item.id)}>
                        {item.completed ? <CheckSquare size={20} className="check-icon-done" /> : <Square size={20} className="check-icon" />}
                        <span>{item.item}</span>
                      </div>
                    ))}
                  </div>
                  <form className="chat-form" onSubmit={addCheck}>
                    <input className="inp chat-inp" value={checkInput} onChange={e => setCheckInput(e.target.value)} placeholder="Add a preparation item..." />
                    <button type="submit" className="chat-send"><Plus size={18} /></button>
                  </form>
                </div>
              )
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Notifications Panel ──────────────────────────────────────────────────
const NotifPanel = ({ notes, onClose, onRead }) => (
  <motion.div
    initial={{ opacity: 0, y: 10, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 10, scale: 0.95 }}
    className="notif-panel glass-panel"
    onClick={e => e.stopPropagation()}
  >

    <div className="notif-header">
      <span>Notifications</span>
      {notes.some(n => !n.read) && <button className="link-btn" onClick={onRead}>Mark all read</button>}
    </div>
    {notes.length === 0
      ? <p className="notif-empty">No notifications yet</p>
      : notes.map(n => (
          n.type === 'TRIP_CANCELLED' ? (
            // ── Cancellation notification ─────────────────────────────────
            <div key={n.id} className={`notif-item notif-cancelled ${!n.read ? 'unread' : ''}`}>
              <AlertCircle size={16} className="notif-cancel-icon" />
              <div>
                <p><strong>Trip Cancelled</strong></p>
                <p className="notif-cancel-msg">{n.message || `"${n.tripTitle}" has been cancelled by the organizer. This trip no longer exists.`}</p>
                <p className="muted">{n.time}</p>
              </div>
            </div>
          ) : (
            // ── Join notification ─────────────────────────────────────────
            <div key={n.id} className={`notif-item ${!n.read ? 'unread' : ''}`}>
              <div className="notif-dot" />
              <div>
                <p><strong>{n.from}</strong> joined your trip</p>
                <p className="muted">{n.tripTitle} · {n.time}</p>
              </div>
            </div>
          )
        ))
    }
  </motion.div>
);


// ─── Main App ─────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [authModal, setAuthModal] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rToken = params.get('resetToken');
    if (rToken) {
      setAuthModal({ mode: 'reset', token: rToken });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Apply theme to body
  useEffect(() => {
    document.documentElement.className = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const [createModal, setCreateModal] = useState(false);
  const [detailTrip, setDetailTrip] = useState(null);
  const [toast, setToast] = useState(null);

  const [notes, setNotes] = useState([]);
  const [showNotes, setShowNotes] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchTrips = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/trips`);
      setTrips(res.data);
      // Sync open trip detail
      setDetailTrip(prev => prev ? (res.data.find(t => t.id === prev.id) || prev) : null);
    } catch {
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchNotes = useCallback(async () => {
    if (!user) return;
    try {
      const res = await axios.get(`${API}/api/notifications`, { headers: authHeader() });
      setNotes(res.data);
    } catch {}
  }, [user]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  useEffect(() => {
    fetchNotes();
    const interval = setInterval(fetchNotes, 10000);
    return () => clearInterval(interval);
  }, [fetchNotes]);

  const handleLogin = (userData) => {
    setUser(userData);
    showToast(`Welcome back, ${userData.name.split(' ')[0]}! 👋`);
  };

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    showToast('Signed out successfully', 'info');
  };

  const handleJoin = async (id, title) => {
    try {
      await axios.post(`${API}/api/trips/${id}/join`, {}, { headers: authHeader() });
      await fetchTrips();
      showToast(`You've joined "${title}"! Check the chat. 🎉`);
    } catch (err) {
      const msg = err.response?.data?.error || 'Could not join trip';
      showToast(msg, 'error');
      throw err;
    }
  };

  const handleLeave = async (id) => {
    try {
      await axios.post(`${API}/api/trips/${id}/leave`, {}, { headers: authHeader() });
      await fetchTrips();
      showToast('You have left the trip.');
    } catch (err) {
      showToast(err.response?.data?.error || 'Could not leave trip', 'error');
      throw err;
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await axios.delete(`${API}/api/trips/${id}`, { headers: authHeader() });
      setDetailTrip(null); // Close detail modal immediately
      await fetchTrips();
      const count = res.data?.notified || 0;
      showToast(
        count > 0
          ? `Trip deleted. ${count} member${count !== 1 ? 's' : ''} notified.`
          : 'Trip deleted successfully.'
      );
    } catch (err) {
      showToast(err.response?.data?.error || 'Could not delete trip', 'error');
      throw err;
    }
  };

  const markRead = async () => {
    try {
      await axios.post(`${API}/api/notifications/read`, {}, { headers: authHeader() });
      fetchNotes();
    } catch {}
  };

  const unread = notes.filter(n => !n.read).length;
  const filtered = trips.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.destination.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app" onClick={() => setShowNotes(false)}>
      <AnimatePresence>
        {toast && <Toast key="toast" toast={toast} onClose={() => setToast(null)} />}
      </AnimatePresence>

      {/* NAVBAR */}
      <nav className="navbar glass">
        <div className="brand">
          <Plane size={26} className="brand-icon" />
          <span>TravelConnect</span>
        </div>

        <div className="nav-right">
          <button className="nav-icon-btn" onClick={toggleTheme} title="Toggle Theme" style={{ background: 'transparent', border: 'none', color: 'var(--text)', display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '8px' }}>
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          
          {user && (
            <div className="notif-wrap"
 onClick={e => { e.stopPropagation(); setShowNotes(!showNotes); }}>
              <Bell size={22} className={unread > 0 ? 'bell-active' : 'bell'} />
              {unread > 0 && <span className="badge">{unread}</span>}
              <AnimatePresence>
                {showNotes && <NotifPanel notes={notes} onClose={() => setShowNotes(false)} onRead={markRead} />}
              </AnimatePresence>
            </div>
          )}

          {user ? (
            <>
              <div className="user-chip">
                <div className="avatar-sm">{user.name.charAt(0).toUpperCase()}</div>
                <span>{user.name.split(' ')[0]}</span>
              </div>
              <button className="btn btn-ghost" onClick={handleLogout}><LogOut size={18} /></button>
            </>
          ) : (
            <>
              <button className="btn btn-outline" onClick={() => setAuthModal('login')}>Sign In</button>
              <button className="btn btn-primary" onClick={() => setAuthModal('signup')}>Join Free</button>
            </>
          )}

          {user && (
            <button className="btn btn-primary" onClick={() => setCreateModal(true)}>
              <Plus size={18} /> New Trip
            </button>
          )}
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="hero-content">
          <div className="hero-badge"><Shield size={14} /> Trusted by 10,000+ explorers</div>
          <h1 className="hero-title">
            Plan Adventures.<br />
            <span className="gradient-text">Connect Friends.</span>
          </h1>
          <p className="hero-sub">Discover, plan, and embark on unforgettable group trips with the people who matter most.</p>

          <div className="search-wrap glass">
            <Search size={20} className="search-icon" />
            <input
              className="search-inp"
              type="text"
              placeholder="Search destinations or trip names…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button className="search-clear" onClick={() => setSearch('')}><X size={16} /></button>}
          </div>

          {!user && (
            <div className="hero-cta">
              <button className="btn btn-primary btn-lg" onClick={() => setAuthModal('signup')}>
                Start Exploring <ArrowRight size={20} />
              </button>
              <button className="btn btn-ghost btn-lg" onClick={() => setAuthModal('login')}>Sign In</button>
            </div>
          )}
        </motion.div>
      </section>

      {/* TRIPS GRID */}
      <section className="trips-section">
        <div className="section-header">
          <h2>Community Expeditions</h2>
          <p className="muted">{filtered.length} adventure{filtered.length !== 1 ? 's' : ''} available</p>
        </div>

        {loading ? (
          <div className="loading-state">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}><Plane size={40} className="brand-icon" /></motion.div>
            <p>Loading expeditions…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Compass size={48} className="muted" />
            <p>No matching trips found.</p>
            {search && <button className="btn btn-outline" onClick={() => setSearch('')}>Clear Search</button>}
          </div>
        ) : (
          <div className="trips-grid">
            {filtered.map((trip, i) => {
              const isMember = user && trip.friends.includes(user.name);
              const isFull = trip.friends.length >= trip.maxPeople;
              const spots = trip.maxPeople - trip.friends.length;
              return (
                <motion.div
                  key={trip.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  whileHover={{ y: -6 }}
                  className="trip-card"
                  onClick={() => setDetailTrip(trip)}
                >
                  <div className="card-img-wrap">
                    <img src={trip.image} alt={trip.title} className="card-img" />
                    <div className="card-img-overlay" />
                    <div className="card-badges">
                      {isMember && <span className="badge-joined">Joined</span>}
                      {isFull && !isMember && <span className="badge-full">Full</span>}
                    </div>
                    <div className="card-spots">{spots > 0 ? `${spots} spot${spots !== 1 ? 's' : ''} left` : 'Full'}</div>
                  </div>
                  <div className="card-body">
                    <div className="card-location"><Compass size={13} /> {trip.destination}</div>
                    <h3 className="card-title">{trip.title}</h3>
                    <p className="card-desc">{trip.description.slice(0, 90)}{trip.description.length > 90 ? '…' : ''}</p>
                    <div className="card-footer">
                      <div className="card-date"><Calendar size={13} /> {trip.date}</div>
                      <div className="card-people"><Users size={13} /> {trip.friends.length}/{trip.maxPeople}</div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* MODALS */}
      <AnimatePresence>
        {authModal && (
          <AuthModal
            key="auth"
            mode={typeof authModal === 'object' ? authModal.mode : authModal}
            initialToken={typeof authModal === 'object' ? authModal.token : null}
            onClose={() => setAuthModal(null)}
            onSuccess={handleLogin}
          />
        )}
        {createModal && (
          <CreateTripModal
            key="create"
            onClose={() => setCreateModal(false)}
            onCreated={(trip) => {
              fetchTrips();
              showToast(`"${trip.title}" is live!`);
            }}
          />
        )}
        {detailTrip && (
          <TripDetailModal
            key={`trip-${detailTrip.id}`}
            trip={detailTrip}
            user={user}
            onClose={() => setDetailTrip(null)}
            onJoin={handleJoin}
            onLeave={handleLeave}
            onDelete={handleDelete}
            onRefresh={fetchTrips}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
