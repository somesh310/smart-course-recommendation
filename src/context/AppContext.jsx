import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { initialProfile } from '../data/mockUser';
import { enrollInCourse, logStudyTime as saveStudyTime, getMyLearning, clearMyLearning } from '../services/learningService';
import { updateUserProfile } from '../services/userService';
import { clearSession, getCurrentAccount, readAccessToken, logoutAccount } from '../services/authService';

const Context = createContext(null);

export function AppProvider({ children }) {
  const [profile, setProfile] = useLocalStorage('pathwise-profile', initialProfile);
  const [learning, setLearning] = useLocalStorage('pathwise-learning', []);
  const [activities, setActivities] = useLocalStorage('pathwise-activity', []);
  const [authenticated, setAuthenticated] = useState(Boolean(readAccessToken()));
  const [authReady, setAuthReady] = useState(!readAccessToken());
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (!readAccessToken()) return;
    Promise.all([getCurrentAccount(), getMyLearning()])
      .then(([user, items]) => { setProfile(user); setLearning(items); setAuthenticated(true); })
      .catch((error) => { clearSession(); setAuthenticated(false); setAuthError(error.message); })
      .finally(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    const onUnauthorized = () => { clearSession(); setAuthenticated(false); setProfile(initialProfile); setLearning([]); };
    window.addEventListener('pathwise:unauthorized', onUnauthorized);
    return () => window.removeEventListener('pathwise:unauthorized', onUnauthorized);
  }, [setProfile, setLearning]);

  const acceptSession = useCallback(async (user) => {
    setProfile(user);
    setAuthenticated(true);
    setAuthError('');
    setLearning([]);
    getMyLearning().then(setLearning).catch((error) => setAuthError(error.message));
  }, [setProfile, setLearning]);

  const saveProfile = useCallback(async (next) => {
    const updated = await updateUserProfile(next);
    setProfile(updated);
    return updated;
  }, [setProfile]);

  const enroll = useCallback(async (id) => { setLearning(await enrollInCourse(id)); }, [setLearning]);
  const logStudyTime = useCallback(async (id, minutes) => { setLearning(await saveStudyTime(id, minutes)); }, [setLearning]);
  const logout = useCallback(async () => {
    try { await logoutAccount(); } catch (error) { setAuthError(error.message); } finally { clearSession(); setAuthenticated(false); setProfile(initialProfile); setLearning([]); setActivities([]); }
  }, [setProfile, setLearning, setActivities]);
  const reset = useCallback(async () => {
    const defaults = { ...initialProfile };
    const updated = await updateUserProfile(defaults);
    const items = await clearMyLearning();
    setProfile(updated); setLearning(items); setActivities([]);
  }, [setProfile, setLearning, setActivities]);

  const value = useMemo(() => ({ profile, setProfile, saveProfile, learning, setLearning, enroll, logStudyTime, activities, setActivities, authenticated, authReady, authError, acceptSession, logout, reset }), [profile, setProfile, saveProfile, learning, setLearning, enroll, logStudyTime, activities, setActivities, authenticated, authReady, authError, acceptSession, logout, reset]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useApp() { return useContext(Context); }
