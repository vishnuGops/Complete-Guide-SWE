import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';
import { applyTheme, cachedTheme } from './theme.js';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

/**
 * The theme, before anything renders (ROADMAP P4-2).
 *
 * From the local cache rather than from settings, because settings are a fetch
 * away and a page that paints light and then flips to dark is worse than one
 * that guesses. `useAppTheme` reconciles it the moment the server answers.
 */
applyTheme(cachedTheme());

/**
 * One query client for the app (ROADMAP P4-1).
 *
 * Retries are off. The server is on this machine: a request either reaches it or
 * the server is not running, and retrying three times only delays the message
 * that says so. A judge run in particular must never be retried silently - it
 * executes code and records a submission.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
