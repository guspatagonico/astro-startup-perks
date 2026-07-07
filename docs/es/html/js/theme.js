(function () {
  const STORAGE_KEY = "docs-theme";

  function getStoredTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function setStoredTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* storage full or unavailable */
    }
  }

  function applyTheme(theme) {
    if (theme === "light" || theme === "dark") {
      document.documentElement.setAttribute("data-theme", theme);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    updateToggleLabel(theme);
  }

  function updateToggleLabel(theme) {
    var btn = document.getElementById("theme-toggle");
    if (!btn) return;
    if (theme === "light") {
      btn.textContent = "☀️ Claro";
    } else if (theme === "dark") {
      btn.textContent = "🌙 Oscuro";
    } else {
      btn.textContent = "💻 Sistema";
    }
  }

  function cycleTheme(current) {
    var map = { light: "dark", dark: "auto", auto: "light" };
    var next = map[current] || "auto";
    setStoredTheme(next);
    applyTheme(next);
  }

  var stored = getStoredTheme() || "auto";
  applyTheme(stored);

  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.getElementById("theme-toggle");
    if (btn) {
      btn.addEventListener("click", function () {
        var current =
          document.documentElement.getAttribute("data-theme") ||
          "auto";
        cycleTheme(current);
      });
    }
  });
})();
