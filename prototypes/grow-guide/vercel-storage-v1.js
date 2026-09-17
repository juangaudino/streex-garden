(() => {
  if (!location.hostname.endsWith('.vercel.app')) return;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const raw = typeof input === 'string' ? input : input?.url;
    let replacement = null;
    if (raw === '/api/seed-state' || raw?.endsWith('/api/seed-state')) replacement = '/api/lab-storage?kind=seeds';
    if (raw === '/api/machine-state' || raw?.endsWith('/api/machine-state')) replacement = '/api/lab-storage?kind=machines';
    if (!replacement) return originalFetch(input, init);
    return originalFetch(replacement, init);
  };
})();
