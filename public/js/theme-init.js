(function() {
  var theme;
  try { theme = localStorage.getItem('theme'); } catch (e) { theme = null; }
  if (theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }
})();