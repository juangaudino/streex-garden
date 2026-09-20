(() => {
  if (!location.hostname.endsWith('.vercel.app')) return;
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const raw = typeof input === 'string' ? input : input?.url;
    if (raw === '/api/seed-state' || raw?.endsWith('/api/seed-state')) return originalFetch('/api/lab-storage?kind=seeds', init);
    if (raw === '/api/machine-state' || raw?.endsWith('/api/machine-state')) return originalFetch('/api/lab-storage?kind=machines', init);
    return originalFetch(input, init);
  };
})();
