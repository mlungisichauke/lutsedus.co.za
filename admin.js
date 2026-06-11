(function () {
  var STORAGE_KEY = 'lutsedusSiteOverridesV1';
  var API_FILE = 'admin-api.php';
  var backendAvailable = false;
  var localSessionActive = false;
  var csrfToken = '';

  var loginScreen = document.getElementById('login-screen');
  var consoleScreen = document.getElementById('console-screen');
  var loginForm = document.getElementById('login-form');
  var loginMessage = document.getElementById('login-message');
  var logoutBtn = document.getElementById('logout-btn');

  var pageSelect = document.getElementById('page-select');
  var selectorInput = document.getElementById('selector-input');
  var typeSelect = document.getElementById('type-select');
  var valueInput = document.getElementById('value-input');
  var imageFolderSelect = document.getElementById('image-folder-select');
  var refreshImagesBtn = document.getElementById('refresh-images-btn');
  var useImageBtn = document.getElementById('use-image-btn');
  var currentPasswordInput = document.getElementById('current-password-input');
  var newPasswordInput = document.getElementById('new-password-input');
  var confirmPasswordInput = document.getElementById('confirm-password-input');
  var changePasswordBtn = document.getElementById('change-password-btn');
  var applyBtn = document.getElementById('apply-btn');
  var saveBtn = document.getElementById('save-btn');
  var deleteBtn = document.getElementById('delete-btn');
  var resetBtn = document.getElementById('reset-btn');
  var consoleMessage = document.getElementById('console-message');
  var overrideList = document.getElementById('override-list');
  var auditList = document.getElementById('audit-list');
  var previewFrame = document.getElementById('preview-frame');

  var selectedElement = null;

  function apiCall(action, method, body) {
    var options = {
      method: method || 'GET',
      credentials: 'same-origin',
      headers: {
        'Accept': 'application/json'
      }
    };

    if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    if ((method || 'GET').toUpperCase() === 'POST' && csrfToken) {
      options.headers['X-CSRF-Token'] = csrfToken;
    }

    return fetch(API_FILE + '?action=' + encodeURIComponent(action), options).then(function (response) {
      return response.json().catch(function () {
        return { ok: false, message: 'Invalid server response.' };
      }).then(function (data) {
        if (!response.ok || !data.ok) {
          throw new Error(data.message || 'Request failed.');
        }
        return data;
      });
    });
  }

  function showConsole() {
    loginScreen.classList.add('hidden');
    consoleScreen.classList.remove('hidden');
    loadPreviewPage(pageSelect.value || 'index.html');
    renderOverrideList();
    renderAuditList();
  }

  function showLogin() {
    consoleScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
  }

  function readLocalOverrides() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch (error) {
      return [];
    }
  }

  function writeLocalOverrides(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function readOverrides() {
    if (backendAvailable) {
      return apiCall('get_overrides').then(function (data) {
        return Array.isArray(data.items) ? data.items : [];
      });
    }

    return Promise.resolve(readLocalOverrides());
  }

  function keyOf(page, selector, type) {
    return page + '|' + selector + '|' + type;
  }

  function saveOverrideRecord(record) {
    if (backendAvailable) {
      return apiCall('save_override', 'POST', record).then(function () {
        return true;
      });
    }

    var data = readLocalOverrides();
    var index = data.findIndex(function (item) {
      return item.id === record.id;
    });

    if (index >= 0) {
      data[index] = record;
    } else {
      data.push(record);
    }

    writeLocalOverrides(data);
    return Promise.resolve(true);
  }

  function deleteOverrideRecord(page, selector, type) {
    if (backendAvailable) {
      return apiCall('delete_override', 'POST', {
        page: page,
        selector: selector,
        type: type
      }).then(function () {
        return true;
      });
    }

    var id = keyOf(page, selector, type);
    var data = readLocalOverrides();
    var next = data.filter(function (item) {
      return item.id !== id;
    });

    if (next.length === data.length) {
      return Promise.reject(new Error('No saved override found for this element/type.'));
    }

    writeLocalOverrides(next);
    return Promise.resolve(true);
  }

  function resetAllOverrides() {
    if (backendAvailable) {
      return apiCall('reset_overrides', 'POST', {}).then(function () {
        return true;
      });
    }

    localStorage.removeItem(STORAGE_KEY);
    return Promise.resolve(true);
  }

  function escapeSelectorId(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(value);
    }
    return value.replace(/([ #;?%&,.+*~':"!^$\[\]()=>|/@])/g, '\\$1');
  }

  function uniqueSelector(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return '#' + escapeSelectorId(el.id);

    var parts = [];
    var current = el;

    while (current && current.nodeType === 1 && current.tagName.toLowerCase() !== 'html') {
      var name = current.tagName.toLowerCase();

      if (current.classList && current.classList.length) {
        var classes = Array.from(current.classList)
          .filter(function (cls) { return cls && cls.indexOf('cms-hover') === -1; })
          .slice(0, 2)
          .map(function (cls) { return '.' + escapeSelectorId(cls); })
          .join('');
        name += classes;
      }

      var parent = current.parentElement;
      if (parent) {
        var siblings = Array.from(parent.children).filter(function (s) {
          return s.tagName === current.tagName;
        });
        if (siblings.length > 1) {
          name += ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')';
        }
      }

      parts.unshift(name);
      var selector = parts.join(' > ');
      try {
        var all = previewFrame.contentDocument.querySelectorAll(selector);
        if (all.length === 1) {
          return selector;
        }
      } catch (error) {
      }

      current = current.parentElement;
    }

    return parts.join(' > ');
  }

  function inferType(el) {
    if (!el) return 'text';

    if (el.tagName === 'IMG') {
      return 'image-src';
    }

    var bg = (el.style && el.style.backgroundImage) || '';
    if (!bg || bg === 'none') {
      try {
        bg = previewFrame.contentWindow.getComputedStyle(el).backgroundImage || '';
      } catch (error) {
        bg = '';
      }
    }

    if (bg && bg !== 'none') {
      return 'background-image';
    }

    return 'text';
  }

  function parseBackgroundImage(value) {
    if (!value || value === 'none') return '';
    var match = value.match(/^url\(["']?(.*?)["']?\)$/i);
    return match ? match[1] : value;
  }

  function getElementValue(el, type) {
    if (!el) return '';

    if (type === 'html') {
      return el.innerHTML || '';
    }

    if (type === 'image-src') {
      return el.getAttribute('src') || '';
    }

    if (type === 'background-image') {
      var bg = (el.style && el.style.backgroundImage) || '';
      if (!bg || bg === 'none') {
        try {
          bg = previewFrame.contentWindow.getComputedStyle(el).backgroundImage || '';
        } catch (error) {
          bg = '';
        }
      }
      return parseBackgroundImage(bg);
    }

    return (el.textContent || '').trim();
  }

  function applyToElement(el, type, value) {
    if (!el) return;

    if (type === 'text') {
      el.textContent = value;
      return;
    }

    if (type === 'html') {
      el.innerHTML = value;
      return;
    }

    if (type === 'image-src') {
      if (el.tagName === 'IMG') {
        el.setAttribute('src', value);
      }
      return;
    }

    if (type === 'background-image') {
      el.style.backgroundImage = value ? "url('" + value + "')" : '';
    }
  }

  function setConsoleMessage(text, tone) {
    consoleMessage.textContent = text;
    if (tone === 'error') {
      consoleMessage.style.color = '#b23b3b';
    } else if (tone === 'ok') {
      consoleMessage.style.color = '#1f6a3f';
    } else {
      consoleMessage.style.color = '#1d3557';
    }
  }

  function renderOverrideList() {
    return readOverrides().then(function (data) {
      overrideList.innerHTML = '';

      if (!data.length) {
        var li = document.createElement('li');
        li.textContent = 'No overrides saved yet.';
        overrideList.appendChild(li);
        return;
      }

      data.slice().reverse().forEach(function (item) {
        var li = document.createElement('li');
        li.textContent = item.page + ' | ' + item.type + ' | ' + item.selector;
        overrideList.appendChild(li);
      });
    }).catch(function (error) {
      setConsoleMessage(error.message || 'Failed to load overrides list.', 'error');
    });
  }

  function formatAuditLabel(entry) {
    var eventName = String(entry.event || 'event').replace(/_/g, ' ');
    var when = entry.time || '';
    var ip = entry.ip || 'unknown-ip';
    var page = entry.page ? ' | ' + entry.page : '';
    return eventName + page + ' | ' + ip + (when ? ' | ' + when : '');
  }

  function renderAuditList() {
    if (!auditList) {
      return Promise.resolve();
    }

    if (!backendAvailable) {
      auditList.innerHTML = '';
      var li = document.createElement('li');
      li.textContent = 'Audit log requires PHP backend mode.';
      auditList.appendChild(li);
      return Promise.resolve();
    }

    return apiCall('get_audit').then(function (data) {
      var items = Array.isArray(data.items) ? data.items : [];
      auditList.innerHTML = '';

      if (!items.length) {
        var emptyLi = document.createElement('li');
        emptyLi.textContent = 'No activity yet.';
        auditList.appendChild(emptyLi);
        return;
      }

      items.slice().reverse().slice(0, 25).forEach(function (entry) {
        var row = document.createElement('li');
        row.textContent = formatAuditLabel(entry);
        auditList.appendChild(row);
      });
    }).catch(function () {
      auditList.innerHTML = '';
      var li = document.createElement('li');
      li.textContent = 'Unable to load audit activity.';
      auditList.appendChild(li);
    });
  }

  function loadImagesList() {
    if (!imageFolderSelect) {
      return Promise.resolve();
    }

    if (!backendAvailable) {
      imageFolderSelect.innerHTML = '';
      var fallback = document.createElement('option');
      fallback.value = '';
      fallback.textContent = 'Images list requires PHP backend mode';
      imageFolderSelect.appendChild(fallback);
      return Promise.resolve();
    }

    return apiCall('list_images').then(function (data) {
      var items = Array.isArray(data.items) ? data.items : [];
      imageFolderSelect.innerHTML = '';

      var head = document.createElement('option');
      head.value = '';
      head.textContent = 'Select an image from images/...';
      imageFolderSelect.appendChild(head);

      items.forEach(function (path) {
        var opt = document.createElement('option');
        opt.value = path;
        opt.textContent = path;
        imageFolderSelect.appendChild(opt);
      });
    }).catch(function (error) {
      setConsoleMessage(error.message || 'Unable to load images list.', 'error');
    });
  }

  function resolveEditableTarget(target, doc) {
    if (!target || target.tagName === 'HTML' || target.tagName === 'BODY') {
      return null;
    }

    if (target.tagName === 'IMG') {
      return target;
    }

    var current = target;
    while (current && current !== doc.body) {
      if (current.tagName === 'IMG') {
        return current;
      }

      var imgChildren = current.querySelectorAll('img');
      if (imgChildren.length === 1) {
        return imgChildren[0];
      }

      var bg = '';
      try {
        bg = previewFrame.contentWindow.getComputedStyle(current).backgroundImage || '';
      } catch (error) {
        bg = '';
      }

      if (bg && bg !== 'none') {
        return current;
      }

      current = current.parentElement;
    }

    return target;
  }

  function loadPreviewPage(page) {
    previewFrame.src = page + '?cmsPreview=1';
  }

  function clearHover() {
    if (!previewFrame.contentDocument) return;
    var prev = previewFrame.contentDocument.querySelector('.cms-hover-outline');
    if (prev) prev.classList.remove('cms-hover-outline');
  }

  function clearSelected() {
    if (!previewFrame.contentDocument) return;
    var prev = previewFrame.contentDocument.querySelector('.cms-selected-outline');
    if (prev) prev.classList.remove('cms-selected-outline');
  }

  function injectSelectionStyles(doc) {
    var style = doc.createElement('style');
    style.textContent = '.cms-hover-outline{outline:2px dashed #d4a726 !important;outline-offset:2px !important;cursor:pointer !important;} .cms-selected-outline{outline:3px solid #1c7f46 !important;outline-offset:2px !important;cursor:pointer !important;}';
    doc.head.appendChild(style);
  }

  function bindPreviewSelection() {
    var doc = previewFrame.contentDocument;
    if (!doc) return;

    injectSelectionStyles(doc);

    doc.addEventListener('mouseover', function (event) {
      clearHover();
      var target = event.target;
      if (!target || target.tagName === 'HTML' || target.tagName === 'BODY') return;
      target.classList.add('cms-hover-outline');
    });

    doc.addEventListener('mouseout', function (event) {
      var target = event.target;
      if (target && target.classList) {
        target.classList.remove('cms-hover-outline');
      }
    });

    doc.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();

      var target = event.target;
      var resolvedTarget = resolveEditableTarget(target, doc);
      if (!resolvedTarget || resolvedTarget.tagName === 'HTML' || resolvedTarget.tagName === 'BODY') return;

      clearSelected();
      selectedElement = resolvedTarget;
      resolvedTarget.classList.add('cms-selected-outline');

      var selector = uniqueSelector(resolvedTarget);
      var type = inferType(resolvedTarget);

      selectorInput.value = selector;
      typeSelect.value = type;
      valueInput.value = getElementValue(resolvedTarget, type);
      setConsoleMessage('Element selected. Edit value and save.', 'ok');
    }, true);
  }

  function applyPreview() {
    var selector = selectorInput.value.trim();
    var type = typeSelect.value;
    var value = valueInput.value;
    var doc = previewFrame.contentDocument;

    if (!selector) {
      setConsoleMessage('Select an element first.', 'error');
      return;
    }

    var el = doc.querySelector(selector);
    if (!el) {
      setConsoleMessage('Element not found for selector.', 'error');
      return;
    }

    applyToElement(el, type, value);
    setConsoleMessage('Preview updated. Click Save Change to persist.', 'ok');
  }

  function saveChange() {
    var page = pageSelect.value;
    var selector = selectorInput.value.trim();
    var type = typeSelect.value;
    var value = valueInput.value;

    if (!selector) {
      setConsoleMessage('Select an element before saving.', 'error');
      return;
    }

    var record = {
      id: keyOf(page, selector, type),
      page: page,
      selector: selector,
      type: type,
      value: value
    };

    saveOverrideRecord(record)
      .then(function () {
        return renderOverrideList();
      })
      .then(function () {
        return renderAuditList();
      })
      .then(function () {
        setConsoleMessage('Saved. This change is now live on ' + page + '.', 'ok');
      })
      .catch(function (error) {
        setConsoleMessage(error.message || 'Failed to save override.', 'error');
      });
  }

  function removeSelectedOverride() {
    var page = pageSelect.value;
    var selector = selectorInput.value.trim();
    var type = typeSelect.value;

    if (!selector) {
      setConsoleMessage('Select an element first.', 'error');
      return;
    }

    deleteOverrideRecord(page, selector, type)
      .then(function () {
        return renderOverrideList();
      })
      .then(function () {
        return renderAuditList();
      })
      .then(function () {
        setConsoleMessage('Saved override removed.', 'ok');
        loadPreviewPage(page);
      })
      .catch(function (error) {
        setConsoleMessage(error.message || 'Failed to remove override.', 'error');
      });
  }

  function resetAll() {
    var ok = window.confirm('This will remove all saved content and photo changes across all pages. Continue?');
    if (!ok) return;

    resetAllOverrides()
      .then(function () {
        return renderOverrideList();
      })
      .then(function () {
        return renderAuditList();
      })
      .then(function () {
        setConsoleMessage('All overrides cleared.', 'ok');
        loadPreviewPage(pageSelect.value);
      })
      .catch(function (error) {
        setConsoleMessage(error.message || 'Failed to reset overrides.', 'error');
      });
  }

  function useSelectedImageFromFolder() {
    if (!imageFolderSelect) {
      setConsoleMessage('Images folder picker is not available.', 'error');
      return;
    }

    var selectedPath = (imageFolderSelect.value || '').trim();
    if (!selectedPath) {
      setConsoleMessage('Select an image from images/ first.', 'error');
      return;
    }

    valueInput.value = selectedPath;

    if (selectedElement && selectedElement.tagName === 'IMG') {
      typeSelect.value = 'image-src';
    } else if (typeSelect.value !== 'image-src' && typeSelect.value !== 'background-image') {
      typeSelect.value = 'background-image';
    }

    setConsoleMessage('Image selected from folder. Click Apply Preview or Save Change.', 'ok');
  }

  function changePassword() {
    if (!backendAvailable) {
      setConsoleMessage('Password changes require PHP backend mode.', 'error');
      return;
    }

    if (!currentPasswordInput || !newPasswordInput || !confirmPasswordInput) {
      setConsoleMessage('Password form is not available.', 'error');
      return;
    }

    var currentPassword = currentPasswordInput.value || '';
    var newPassword = newPasswordInput.value || '';
    var confirmPassword = confirmPasswordInput.value || '';

    if (!currentPassword || !newPassword || !confirmPassword) {
      setConsoleMessage('Fill in all password fields.', 'error');
      return;
    }

    if (newPassword.length < 10) {
      setConsoleMessage('New password must be at least 10 characters.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      setConsoleMessage('New password and confirmation do not match.', 'error');
      return;
    }

    changePasswordBtn.disabled = true;
    changePasswordBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

    apiCall('change_password', 'POST', {
      currentPassword: currentPassword,
      newPassword: newPassword
    }).then(function (data) {
      currentPasswordInput.value = '';
      newPasswordInput.value = '';
      confirmPasswordInput.value = '';

      if (data && data.requiresLogin) {
        csrfToken = '';
        setConsoleMessage('Password updated. You have been logged out. Please login again.', 'ok');
        showLogin();
        return;
      }

      setConsoleMessage('Password updated successfully.', 'ok');
      renderAuditList();
    }).catch(function (error) {
      setConsoleMessage(error.message || 'Failed to update password.', 'error');
    }).finally(function () {
      changePasswordBtn.disabled = false;
      changePasswordBtn.innerHTML = '<i class="fas fa-key"></i> Update Password';
    });
  }

  loginForm.addEventListener('submit', function (event) {
    event.preventDefault();

    var username = (document.getElementById('username').value || '').trim();
    var password = document.getElementById('password').value || '';

    if (!backendAvailable) {
      if (username === 'admin' && password === 'Lutsedus@2026!') {
        localSessionActive = true;
        loginMessage.textContent = '';
        showConsole();
      } else {
        loginMessage.textContent = 'Invalid credentials.';
        loginMessage.style.color = '#b23b3b';
      }
      return;
    }

    apiCall('login', 'POST', {
      username: username,
      password: password
    }).then(function () {
      return apiCall('session');
    }).then(function (sessionData) {
      csrfToken = sessionData.csrfToken || csrfToken;
      loginMessage.textContent = '';
      showConsole();
    }).catch(function (error) {
      loginMessage.textContent = error.message || 'Login failed.';
      loginMessage.style.color = '#b23b3b';
    });
  });

  logoutBtn.addEventListener('click', function () {
    if (!backendAvailable) {
      localSessionActive = false;
      showLogin();
      return;
    }

    apiCall('logout', 'POST', {}).finally(function () {
      showLogin();
    });
  });

  pageSelect.addEventListener('change', function () {
    loadPreviewPage(this.value);
  });

  previewFrame.addEventListener('load', function () {
    bindPreviewSelection();
    setConsoleMessage('Preview loaded. Click any element to edit.', '');
  });

  applyBtn.addEventListener('click', applyPreview);
  saveBtn.addEventListener('click', saveChange);
  deleteBtn.addEventListener('click', removeSelectedOverride);
  resetBtn.addEventListener('click', resetAll);
  if (useImageBtn) {
    useImageBtn.addEventListener('click', useSelectedImageFromFolder);
  }
  if (refreshImagesBtn) {
    refreshImagesBtn.addEventListener('click', function () {
      loadImagesList();
    });
  }
  if (changePasswordBtn) {
    changePasswordBtn.addEventListener('click', changePassword);
  }

  typeSelect.addEventListener('change', function () {
    if (!selectedElement) return;
    valueInput.value = getElementValue(selectedElement, typeSelect.value);
  });

  apiCall('health')
    .then(function (healthData) {
      backendAvailable = true;
      csrfToken = healthData.csrfToken || '';
      return apiCall('session');
    })
    .then(function (data) {
      csrfToken = data.csrfToken || csrfToken;
      if (data.authenticated) {
        loadImagesList();
        showConsole();
      } else {
        showLogin();
      }
    })
    .catch(function () {
      backendAvailable = false;
      csrfToken = '';
      showLogin();
      loginMessage.textContent = 'Server API not available. Using local browser mode.';
      loginMessage.style.color = '#1d3557';
    });
})();
