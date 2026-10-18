import { apiRequest, TOKEN_KEY } from './apiClient';
import { mapUser } from './userService';
const USER_KEY = 'pathwise-auth-user';
function saveSession(data) { localStorage.setItem(TOKEN_KEY, data.token); const user = mapUser(data.user); localStorage.setItem(USER_KEY, JSON.stringify(user)); return { user, token: data.token }; }
export async function registerAccount({ name, email, password }) { return apiRequest('/auth/register', { method: 'POST', auth: false, body: JSON.stringify({ name, email, password }) }); }
export async function verifyRegistration({ email, code }) { const response = await apiRequest('/auth/verify-registration', { method: 'POST', auth: false, body: JSON.stringify({ email, code }) }); return saveSession(response.data); }
export async function resendRegistrationOtp(email) { return apiRequest('/auth/resend-registration-otp', { method: 'POST', auth: false, body: JSON.stringify({ email }) }); }
export async function requestPasswordReset(email) { return apiRequest('/auth/forgot-password', { method: 'POST', auth: false, body: JSON.stringify({ email }) }); }
export async function resetPassword({ email, token, password }) { return apiRequest('/auth/reset-password', { method: 'POST', auth: false, body: JSON.stringify({ email, token, password }) }); }
export async function loginAccount({ email, password }) { const response = await apiRequest('/auth/login', { method: 'POST', auth: false, body: JSON.stringify({ email, password }) }); return saveSession(response.data); }
export async function getCurrentAccount() { const response = await apiRequest('/auth/me'); const user = mapUser(response.data.user); localStorage.setItem(USER_KEY, JSON.stringify(user)); return user; }
export function readAccessToken() { return localStorage.getItem(TOKEN_KEY); }
export function clearSession() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); localStorage.removeItem('pathwise-profile'); localStorage.removeItem('pathwise-learning'); }
export async function logoutAccount() { try { await apiRequest('/auth/logout', { method: 'POST' }); } finally { clearSession(); } }
