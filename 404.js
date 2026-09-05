'use strict';
(() => {
  const parts = location.pathname.split('/').filter(Boolean);
  const onGitHubPages = /\.github\.io$/i.test(location.hostname);
  const basePath = onGitHubPages && parts.length ? `/${parts[0]}/` : '/';
  const target = new URL(basePath, location.origin).href;
  const link = document.getElementById('homeLink');
  if (link) link.href = target;
  setTimeout(() => location.replace(target), 700);
})();
