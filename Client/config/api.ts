// API Configuration - automatically uses local or production URL based on environment
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8082';

export const API_URL = `${API_BASE_URL}/api`;

export default API_URL;
