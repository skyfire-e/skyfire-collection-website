(function() {
  var theme;
  try { theme = localStorage.getItem('theme'); } catch (e) { theme = null; }
  document.documentElement.setAttribute('data-theme', theme || 'dark');
})();