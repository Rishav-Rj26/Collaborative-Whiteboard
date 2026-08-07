// Centralized API configuration — never hardcode URLs again.
// In production, set VITE_API_URL to your deployed backend origin.

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';
const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export { API_URL, SOCKET_URL };
