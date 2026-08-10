const isBrowser = typeof window !== 'undefined';
const isDev = isBrowser && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// Auto-connect to Render backend when deployed to production/Vercel, or localhost in development
const productionApiUrl = (isBrowser && (window as any).__API_URL__) || 'https://quizmaster-api-bdtt.onrender.com/api';
const productionHubUrl = (isBrowser && (window as any).__HUB_URL__) || 'https://quizmaster-api-bdtt.onrender.com/hubs/quiz';

const defaultApiUrl = isDev ? 'http://localhost:5237/api' : productionApiUrl;
const defaultHubUrl = isDev ? 'http://localhost:5237/hubs/quiz' : productionHubUrl;

export const environment = {
  production: !isDev,
  apiUrl: defaultApiUrl,
  hubUrl: defaultHubUrl
};
