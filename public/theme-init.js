(function() {
  try {
    var isDark = localStorage.getItem('tuneteaser-theme') === 'dark';
    if (isDark) {
      document.body.classList.add('dark-theme');
    }
  } catch (e) {}
})();
