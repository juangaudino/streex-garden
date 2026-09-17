(() => {
  if (!location.hostname.endsWith('.vercel.app') || window.__GARDEN_LABS_VERCEL_GATEWAY__) return;
  window.__GARDEN_LABS_VERCEL_GATEWAY__=true;
  const f=window.fetch.bind(window);
  window.fetch=(input,init={})=>{const u=typeof input==='string'?input:input?.url;if(u==='/api/seed-state'||u?.endsWith('/api/seed-state'))return f('/api/lab-storage?kind=seeds',init);if(u==='/api/machine-state'||u?.endsWith('/api/machine-state'))return f('/api/lab-storage?kind=machines',init);return f(input,init)};
})();
