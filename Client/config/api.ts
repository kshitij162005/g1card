// API Configuration
// - Prefer explicit VITE_API_URL when provided.
// - In browser production builds, default to same-origin to avoid localhost leakage.
// - In local dev, fallback to backend default port.
const API_BASE_URL = import.meta.env.VITE_API_URL
	|| (typeof window !== 'undefined' && import.meta.env.PROD ? window.location.origin : 'http://localhost:8082');

export const API_URL = `${API_BASE_URL}/api`;

export default API_URL;
