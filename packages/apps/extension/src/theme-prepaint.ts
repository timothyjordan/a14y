// Pre-paint theme sync. Loaded as a synchronous classic-script (not a
// module) before any stylesheet so we can flip data-theme on the
// document element ahead of first paint and avoid a flash of the wrong
// theme. Lives in its own file because MV3 disallows inline scripts.
(function () {
  try {
    var t = localStorage.getItem('a14y-theme');
    if (t === 'light' || t === 'dark') {
      document.documentElement.setAttribute('data-theme', t);
    }
  } catch (e) {
    /* private mode etc — fall through to system preference */
  }
})();
