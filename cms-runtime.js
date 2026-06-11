(function () {
  var STORAGE_KEY = 'lutsedusSiteOverridesV1';
  var API_FILE = 'admin-api.php';

  function currentPage() {
    var path = window.location.pathname || '';
    var file = path.split('/').pop();
    return file || 'index.html';
  }

  function toArray(raw) {
    if (!raw) return [];
    try {
      var data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      return [];
    }
  }

  function applyOverride(override) {
    if (!override || !override.selector || !override.type) return;

    var el = document.querySelector(override.selector);
    if (!el) return;

    if (override.type === 'text') {
      el.textContent = override.value || '';
      return;
    }

    if (override.type === 'html') {
      el.innerHTML = override.value || '';
      return;
    }

    if (override.type === 'image-src') {
      if (el.tagName === 'IMG') {
        el.src = override.value || '';
      }
      return;
    }

    if (override.type === 'background-image') {
      if (!override.value) {
        el.style.backgroundImage = '';
      } else {
        el.style.backgroundImage = "url('" + override.value + "')";
      }
    }
  }

  function applyFromList(overrides) {
    var page = currentPage();
    overrides.forEach(function (override) {
      if (override.page === page || override.page === '*') {
        applyOverride(override);
      }
    });
  }

  function fetchPublicOverrides() {
    return fetch(API_FILE + '?action=public_overrides', {
      method: 'GET',
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' }
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('API unavailable');
      }
      return response.json();
    }).then(function (data) {
      if (!data || !data.ok || !Array.isArray(data.items)) {
        throw new Error('Invalid API payload');
      }
      return data.items;
    });
  }

  function applyAll() {
    fetchPublicOverrides().then(function (items) {
      applyFromList(items);
    }).catch(function () {
      var localOverrides = toArray(localStorage.getItem(STORAGE_KEY));
      applyFromList(localOverrides);
    });
  }

  document.addEventListener('DOMContentLoaded', applyAll);

  window.LutsedusCMS = {
    storageKey: STORAGE_KEY,
    applyAll: applyAll
  };
})();
