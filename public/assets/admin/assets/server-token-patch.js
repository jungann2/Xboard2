/**
 * Server Token Security Patch for Xboard2 Admin Panel
 * 替换节点配置页面中 server_token 的不安全前端生成逻辑（Math.random）
 * 改为调用后端 CSPRNG API，支持自定义前缀/后缀
 */
(function () {
  'use strict';

  // 获取 admin API 前缀（与编译后前端一致：/api/v2/{secure_path}）
  function getApiPrefix() {
    const base = window.settings?.base_url || '/';
    const baseUrl = base.endsWith('/') ? base + 'api/v2' : base + '/api/v2';
    const securePath = window.settings?.secure_path || 'admin';
    return baseUrl + '/' + securePath;
  }

  // 从 localStorage 读取 admin auth token（与编译后前端一致）
  function getAuthToken() {
    var key = 'XBOARD_ACCESS_TOKEN';
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      // Xboard2 的 storage wrapper 存储格式: { value, time, expire }
      if (parsed && parsed.expire && parsed.expire < Date.now()) return null;
      return parsed?.value || null;
    } catch (e) {
      return null;
    }
  }

  // 调用后端 CSPRNG 生成安全 token
  async function generateSecureToken(prefix, suffix, length) {
    var authToken = getAuthToken();
    var headers = { 'Content-Type': 'application/json' };
    if (authToken) {
      headers['Authorization'] = authToken;
    }
    const resp = await fetch(getApiPrefix() + '/config/generateServerToken', {
      method: 'POST',
      headers: headers,
      credentials: 'same-origin',
      body: JSON.stringify({
        prefix: prefix || null,
        suffix: suffix || null,
        length: length || 48,
      }),
    });
    if (resp.status === 401 || resp.status === 403) {
      throw new Error('登录已过期，请刷新页面重新登录');
    }
    if (!resp.ok) {
      throw new Error('请求失败 (HTTP ' + resp.status + ')');
    }
    const data = await resp.json();
    if (data.data?.token) return data.data.token;
    throw new Error(data.message || '生成失败');
  }

  // ========== 弹窗 UI ==========
  let generatedToken = null;

  function createTokenModal() {
    const container = document.createElement('div');
    container.id = 'xb-token-generator';
    container.innerHTML = `
      <style>
        #xb-token-overlay {
          position: fixed; inset: 0; z-index: 99998;
          background: rgba(0,0,0,0.5);
        }
        #xb-token-generator {
          position: fixed; top: 50%; left: 50%;
          transform: translate(-50%, -50%); z-index: 99999;
          background: var(--background, #fff);
          border: 1px solid var(--border, #e2e8f0);
          border-radius: 12px; padding: 24px;
          width: 500px; max-width: 90vw;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: var(--foreground, #0f172a);
        }
        .xbt-title {
          font-size: 18px; font-weight: 600; margin-bottom: 16px;
          display: flex; align-items: center; gap: 8px;
        }
        .xbt-field { margin-bottom: 12px; }
        .xbt-field label {
          display: block; font-size: 13px; font-weight: 500;
          margin-bottom: 4px; color: var(--muted-foreground, #64748b);
        }
        .xbt-field input, .xbt-field select {
          width: 100%; padding: 8px 12px;
          border: 1px solid var(--border, #e2e8f0);
          border-radius: 6px; font-size: 14px;
          background: var(--input, #fff);
          color: var(--foreground, #0f172a);
          box-sizing: border-box; outline: none;
        }
        .xbt-field input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
        .xbt-hint { font-size: 12px; color: var(--muted-foreground, #94a3b8); margin-top: 2px; }
        .xbt-row { display: flex; gap: 8px; }
        .xbt-row .xbt-field { flex: 1; }
        .xbt-result {
          margin: 16px 0 12px; padding: 10px 12px;
          background: var(--muted, #f1f5f9); border-radius: 6px;
          font-family: 'SF Mono', 'Fira Code', monospace; font-size: 13px;
          word-break: break-all; min-height: 20px;
          border: 1px solid var(--border, #e2e8f0);
        }
        .xbt-result.xbt-empty {
          color: var(--muted-foreground, #94a3b8); font-style: italic; font-family: inherit;
        }
        .xbt-actions { display: flex; gap: 8px; justify-content: flex-end; }
        .xbt-btn {
          padding: 8px 16px; border-radius: 6px; font-size: 14px;
          font-weight: 500; cursor: pointer;
          border: 1px solid var(--border, #e2e8f0);
          background: var(--background, #fff);
          color: var(--foreground, #0f172a); transition: all 0.15s;
        }
        .xbt-btn:hover { background: var(--accent, #f1f5f9); }
        .xbt-btn.xbt-primary { background: #3b82f6; color: #fff; border-color: #3b82f6; }
        .xbt-btn.xbt-primary:hover { background: #2563eb; }
        .xbt-btn.xbt-success { background: #10b981; color: #fff; border-color: #10b981; }
        .xbt-btn.xbt-success:hover { background: #059669; }
        .xbt-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .xbt-close {
          position: absolute; top: 12px; right: 12px;
          background: none; border: none; cursor: pointer; padding: 4px;
          color: var(--muted-foreground, #94a3b8); border-radius: 4px;
        }
        .xbt-close:hover { background: var(--accent, #f1f5f9); }
        .xbt-security-note {
          font-size: 12px; color: #10b981; margin-top: 8px;
          display: flex; align-items: center; gap: 4px;
        }
      </style>
      <button class="xbt-close" onclick="window.__xbtClose()" aria-label="关闭">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <div class="xbt-title">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        安全通讯密钥生成器
      </div>
      <div class="xbt-row">
        <div class="xbt-field">
          <label>前缀 (可选)</label>
          <input type="text" id="xbt-prefix" placeholder="例如: node01" maxlength="16">
          <div class="xbt-hint">字母、数字、连字符，最长16位</div>
        </div>
        <div class="xbt-field">
          <label>后缀 (可选)</label>
          <input type="text" id="xbt-suffix" placeholder="例如: hk" maxlength="16">
          <div class="xbt-hint">字母、数字、连字符，最长16位</div>
        </div>
      </div>
      <div class="xbt-field">
        <label>密钥长度</label>
        <select id="xbt-length">
          <option value="32">32 位</option>
          <option value="48" selected>48 位 (推荐)</option>
          <option value="64">64 位</option>
        </select>
        <div class="xbt-hint">不含前缀/后缀的核心密钥长度</div>
      </div>
      <div class="xbt-result xbt-empty" id="xbt-result">点击"生成"按钮生成安全通讯密钥</div>
      <div class="xbt-security-note">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>
        使用后端 CSPRNG (openssl_random_pseudo_bytes) 密码学安全生成
      </div>
      <div class="xbt-actions">
        <button class="xbt-btn" onclick="window.__xbtClose()">取消</button>
        <button class="xbt-btn" id="xbt-copy-btn" onclick="window.__xbtCopy()" disabled>复制</button>
        <button class="xbt-btn xbt-primary" id="xbt-gen-btn" onclick="window.__xbtGen()">🔐 生成密钥</button>
        <button class="xbt-btn xbt-success" id="xbt-apply-btn" onclick="window.__xbtApply()" disabled>应用到配置</button>
      </div>
    `;
    return container;
  }

  window.__xbtClose = function () {
    document.getElementById('xb-token-overlay')?.remove();
    document.getElementById('xb-token-generator')?.remove();
    generatedToken = null;
  };

  window.__xbtGen = async function () {
    const btn = document.getElementById('xbt-gen-btn');
    const result = document.getElementById('xbt-result');
    if (!btn || !result) return;

    const prefix = document.getElementById('xbt-prefix')?.value?.trim() || '';
    const suffix = document.getElementById('xbt-suffix')?.value?.trim() || '';
    const length = parseInt(document.getElementById('xbt-length')?.value || '48');

    btn.disabled = true;
    btn.textContent = '生成中...';
    try {
      generatedToken = await generateSecureToken(prefix, suffix, length);
      result.textContent = generatedToken;
      result.classList.remove('xbt-empty');
      const copyBtn = document.getElementById('xbt-copy-btn');
      const applyBtn = document.getElementById('xbt-apply-btn');
      if (copyBtn) copyBtn.disabled = false;
      if (applyBtn) applyBtn.disabled = false;
    } catch (e) {
      result.textContent = '生成失败: ' + e.message;
      result.classList.add('xbt-empty');
    } finally {
      btn.disabled = false;
      btn.textContent = '🔐 生成密钥';
    }
  };

  window.__xbtCopy = function () {
    if (!generatedToken) return;
    navigator.clipboard.writeText(generatedToken).then(function () {
      const btn = document.getElementById('xbt-copy-btn');
      if (btn) { btn.textContent = '已复制 ✓'; setTimeout(function () { btn.textContent = '复制'; }, 1500); }
    });
  };

  window.__xbtApply = function () {
    if (!generatedToken) return;
    // 找到 server_token 输入框并设置值，触发 React 的 onChange
    const input = document.querySelector('input[name="server_token"]');
    if (input) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      ).set;
      nativeInputValueSetter.call(input, generatedToken);
      // React 18 需要同时触发 input 和 change 事件，使用 InputEvent 确保兼容
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      // 聚焦再失焦，确保 react-hook-form 的 watch 能捕获到变更
      input.focus();
      input.blur();
    }
    const applyBtn = document.getElementById('xbt-apply-btn');
    if (applyBtn) { applyBtn.textContent = '已应用 ✓'; }
    setTimeout(function () { window.__xbtClose(); }, 800);
  };

  // 打开弹窗
  window.__xbtOpenGenerator = function () {
    window.__xbtClose();
    generatedToken = null;
    const overlay = document.createElement('div');
    overlay.id = 'xb-token-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,0.5)';
    overlay.onclick = window.__xbtClose;
    document.body.appendChild(overlay);
    document.body.appendChild(createTokenModal());
  };

  // ========== 拦截原有不安全的生成按钮 ==========
  // 原始编译后的 JS 中，server_token 旁的生成按钮使用 Math.random()
  // 我们通过 MutationObserver 监听 DOM，找到该按钮并替换其行为
  function patchGenerateButton() {
    const observer = new MutationObserver(function () {
      // 查找 server_token 输入框
      const tokenInput = document.querySelector('input[name="server_token"]');
      if (!tokenInput) return;

      // 找到输入框旁边的按钮（generate tooltip 按钮）
      const wrapper = tokenInput.closest('.relative');
      if (!wrapper) return;
      const btn = wrapper.querySelector('button[type="button"]');
      if (!btn || btn.dataset.xbtPatched) return;

      // 标记已 patch，防止重复
      btn.dataset.xbtPatched = 'true';

      // 替换点击事件：打开安全生成器弹窗
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        window.__xbtOpenGenerator();
      }, true); // capture phase，优先于原有事件
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchGenerateButton);
  } else {
    patchGenerateButton();
  }

  console.log('[Xboard2] Server Token Security Patch loaded');
})();
