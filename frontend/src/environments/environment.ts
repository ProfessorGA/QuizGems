const isDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const defaultApiUrl = isDev ? 'http://localhost:5237/api' : '/api';
const defaultHubUrl = isDev ? 'http://localhost:5237/hubs/quiz' : '/hubs/quiz';

export const environment = {
  production: !isDev,
  apiUrl: (typeof window !== 'undefined' && (window as any).__API_URL__) || defaultApiUrl,
  hubUrl: (typeof window !== 'undefined' && (window as any).__HUB_URL__) || defaultHubUrl
};
