// === 工具函數 ===
function getSessionIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('session_id');
}

function setSessionIdToUrl(sessionId) {
    const url = new URL(window.location.href);
    url.searchParams.set('session_id', sessionId);
    // 使用 replace 避免建立歷史返回紀錄
    window.location.replace(url.toString());
    return url.toString();
}

function getCookie(name) {
    // 正確解析 cookie
    const cookies = document.cookie ? document.cookie.split('; ') : [];
    for (const c of cookies) {
        const [k, ...v] = c.split('=');
        if (k === name) return decodeURIComponent(v.join('='));
    }
    return null;
}

function saveMainTextToLocalStorage(mainText) {
    localStorage.setItem('qbo_mainText', mainText);
}
function getMainTextFromLocalStorage() {
    return localStorage.getItem('qbo_mainText') || '';
}

function saveSessionToLocalStorage(sessionId, summary) {
    const key = 'qbo_sessions';
    const sessions = JSON.parse(localStorage.getItem(key) || '[]');
    const idx = sessions.findIndex(s => s.sessionId === sessionId);

    const now = new Date().toISOString();
    if (idx >= 0) {
        sessions[idx].summary = summary;
        sessions[idx].lastAccessed = now;
    } else {
        sessions.push({ sessionId, summary, createdAt: now, lastAccessed: now });
    }

    sessions.sort((a, b) => new Date(b.lastAccessed) - new Date(a.lastAccessed));
    localStorage.setItem(key, JSON.stringify(sessions.slice(0, 20)));
    loadSessions();
}
function getSessionsFromLocalStorage() {
    return JSON.parse(localStorage.getItem('qbo_sessions') || '[]');
}
function removeSessionFromLocalStorage(sessionId) {
    const list = getSessionsFromLocalStorage().filter(s => s.sessionId !== sessionId);
    localStorage.setItem('qbo_sessions', JSON.stringify(list));
    loadSessions();
}

function cleanTextForApi(html) {
    // 移除 HTML 與被標記為刪除的紅色片段
    const temp = document.createElement('div');
    temp.innerHTML = html;

    const spans = temp.querySelectorAll('span');
    spans.forEach(span => {
        const bg = (span.style.backgroundColor || '').replace(/\s/g, '').toLowerCase();
        if (bg === 'rgb(254,226,226)' || bg === '#fee2e2') {
            span.remove();
        }
    });

    return temp.textContent || temp.innerText || '';
}

function updateScoreBadge(el, score) {
    el.className = 'score-badge';
    if (typeof score === 'number' && !Number.isNaN(score)) {
        const pct = Math.round(score);
        el.textContent = pct + '%';
        if (pct < 60) el.classList.add('score-low');
        else if (pct < 80) el.classList.add('score-medium');
        else el.classList.add('score-high');
    } else {
        el.textContent = '-';
    }
}

async function safeFetch(url, options = {}, retries = 3) {
    const merged = {
        credentials: 'same-origin',
        headers: { 'Accept': 'application/json', ...(options.headers || {}) },
        ...options
    };
    for (let i = 0; i < retries; i++) {
        try {
            const resp = await fetch(url, merged);
            if (resp.status === 502) throw new Error(`伺服器暫時無法回應 (502)，正在重試... (${i + 1}/${retries})`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
            const ct = resp.headers.get('content-type') || '';
            return ct.includes('application/json') ? resp.json() : resp.text();
        } catch (err) {
            console.warn(`Fetch attempt ${i + 1} failed:`, err);
            if (i === retries - 1) {
                if (String(err.message).includes('502')) throw new Error('伺服器連線問題，請稍後再試或聯繫系統管理員');
                if (err.name === 'TypeError' && String(err.message).includes('fetch')) {
                    throw new Error('網路連線問題，請檢查網路狀態');
                }
                throw err;
            }
            const wait = String(err.message).includes('502') ? 3000 * (i + 1) : 1000 * (i + 1);
            await new Promise(r => setTimeout(r, wait));
        }
    }
}

function showToast(message, type = 'danger') {
    // type: 'danger' | 'warning' | 'success' | 'info'
    const old = document.querySelector('.error-message');
    if (old) old.remove();

    const div = document.createElement('div');
    div.className = `alert alert-${type} error-message`;
    div.style.position = 'fixed';
    div.style.top = '80px';
    div.style.right = '20px';
    div.style.zIndex = '9999';
    div.style.maxWidth = '420px';
    div.innerHTML = `
        <i class="fas ${type === 'danger' ? 'fa-exclamation-circle' : 'fa-exclamation-triangle'}"></i>
        <span style="margin-left:8px;">${message}</span>
        <button type="button" class="btn-close" style="float:right;" onclick="this.parentElement.remove()"></button>
    `;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 5000);
}

// === Diff 標記 ===
function highlightTextDiff(oldText, newText) {
    const dmp = new diff_match_patch();
    const diffs = dmp.diff_main(oldText, newText);
    dmp.diff_cleanupSemantic(diffs);
    let html = '';
    for (const [op, text] of diffs) {
        if (op === 0) html += text;
        else if (op === -1) html += `<span style="background-color:#fee2e2;color:#dc2626;">${text}</span>`;
        else if (op === 1) html += `<span style="background-color:#dcfce7;color:#16a34a;">${text}</span>`;
    }
    return html;
}

function compareAndHighlightText() {
    const stored = getMainTextFromLocalStorage();
    const current = document.getElementById('mainText').innerHTML;
    if (stored && stored !== current) {
        const diffHtml = highlightTextDiff(stored, current);
        document.getElementById('mainText').innerHTML = diffHtml;
        saveMainTextToLocalStorage(cleanTextForApi(diffHtml));
    }
}

// === 字數/輸入控制 ===
function handleMainTextInput() {
    const textEl = document.getElementById('mainText');
    const warn = document.getElementById('textWarning');
    const computeBtn = document.getElementById('computeBtn');
    const len = textEl.innerText.length;

    if (len > 3000) {
        warn.style.display = 'block';
        computeBtn.disabled = true;
    } else {
        warn.style.display = 'none';
        computeBtn.disabled = false;
    }

    // 即時計算
    const auto = document.getElementById('autoComputeSwitch').checked;
    if (auto) debounceCompute();
}

// === 會話清單 ===
function getTimeAgo(s) {
    const now = new Date();
    const d = new Date(s);
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return '剛剛';
    if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`;
    return d.toLocaleDateString('zh-TW');
}

function loadSessions() {
    const sessions = getSessionsFromLocalStorage();
    const list = document.getElementById('sessionList');
    const current = getSessionIdFromUrl();
    list.innerHTML = '';

    if (sessions.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'text-center text-muted p-3';
        empty.style.fontSize = '14px';
        empty.innerHTML = '<i class="fas fa-history"></i><br>尚無歷史會話';
        list.appendChild(empty);
        return;
    }

    sessions.forEach(s => {
        const wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '8px';

        const btn = document.createElement('button');
        btn.className = 'session-item';
        btn.style.flex = '1';
        btn.style.borderRight = 'none';
        btn.style.borderTopRightRadius = '0';
        btn.style.borderBottomRightRadius = '0';
        if (s.sessionId === current) btn.classList.add('active');
        btn.innerHTML = `
            <div style="text-align:left;">
                <div style="font-weight:500;">${s.summary || '未命名會話'}</div>
                <div style="font-size:12px;opacity:0.7;margin-top:2px;">${getTimeAgo(s.lastAccessed)}</div>
            </div>
        `;
        btn.onclick = () => {
            const url = new URL(window.location.href);
            url.searchParams.set('session_id', s.sessionId);
            window.location.href = url.toString();
        };

        const del = document.createElement('button');
        del.className = 'btn btn-sm btn-outline-danger';
        del.style.minWidth = '32px';
        del.style.height = '32px';
        del.style.padding = '0';
        del.style.borderTopLeftRadius = '0';
        del.style.borderBottomLeftRadius = '0';
        del.innerHTML = '<i class="fas fa-trash" style="font-size:12px;"></i>';
        del.title = '刪除會話';
        del.onclick = (e) => {
            e.stopPropagation();
            if (confirm('確定要刪除這個會話嗎？')) {
                removeSessionFromLocalStorage(s.sessionId);
                if (s.sessionId === current) createNewSession();
            }
        };

        wrap.appendChild(btn);
        wrap.appendChild(del);
        list.appendChild(wrap);
    });
}

// === 初始化與 Session ===
async function initializeSession() {
    const sessionId = getSessionIdFromUrl();
    let isNew = false;

    if (!sessionId) {
        try {
            const data = await safeFetch('/api/get_session_id/', { method: 'POST' });
            if (data.session_id) {
                isNew = true;
                setSessionIdToUrl(data.session_id);
            }
        } catch (e) {
            console.error('Error creating session:', e);
            showToast(`無法創建新會話：${e.message}`, 'warning');
        }
    } else {
        try {
            const data = await safeFetch(`/api/get_session_data/?session_id=${encodeURIComponent(sessionId)}`, { method: 'GET' });
            if (data && data.data) {
                document.getElementById('mainText').innerHTML = data.data.main_text || '';
                document.getElementById('queryInput').value = data.data.query || '';
                if (typeof data.data.score === 'number') {
                    updateScoreBadge(document.getElementById('simScore'), data.data.score);
                    const dist = Math.max(0, 100 - Math.round(data.data.score));
                    updateScoreBadge(document.getElementById('cosDist'), dist);
                }
                if (data.summary) document.title = data.summary;
            } else {
                isNew = true;
            }
        } catch (e) {
            console.error('Error loading session data:', e);
            showToast(`無法載入會話數據：${e.message}`, 'warning');
            isNew = true;
        }
    }

    // 非新會話但 mainText 為空 → 用 localStorage 補
    if (!isNew) {
        const local = getMainTextFromLocalStorage();
        if (local && !document.getElementById('mainText').innerHTML) {
            document.getElementById('mainText').innerHTML = local;
        }
    } else {
        localStorage.removeItem('qbo_mainText');
    }

    // 把當前（若有）摘要寫回 localStorage
    const sid = getSessionIdFromUrl();
    if (sid) {
        try {
            const data = await safeFetch(`/api/get_session_data/?session_id=${encodeURIComponent(sid)}`, { method: 'GET' });
            if (data && data.summary) saveSessionToLocalStorage(sid, data.summary);
        } catch {}
    }
}

function createNewSession() {
    fetch('/api/get_session_id/', { method: 'POST', credentials: 'same-origin' })
        .then(r => r.json())
        .then(d => {
            if (d.session_id) {
                const newUrl = setSessionIdToUrl(d.session_id);
                window.location.assign(newUrl);
            } else {
                alert('無法開啟新的 Session');
            }
        })
        .catch(e => {
            console.error('Error:', e);
            alert('發生錯誤，請稍後再試');
        });
}

// === 儲存 ===
function persistSession(query, score) {
    const sessionId = getSessionIdFromUrl();
    if (!sessionId) return;

    const mainText = cleanTextForApi(document.getElementById('mainText').innerHTML);
    const data = { query, main_text: mainText, score };

    fetch('/api/save_session/', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, data })
    })
        .then(r => r.json())
        .then(d => {
            if (d && d.summary) saveSessionToLocalStorage(sessionId, d.summary);
        })
        .catch(e => console.error('Error saving session:', e));

    saveMainTextToLocalStorage(mainText);
}

// === 相似度計算 ===
let _debounceTimer = null;
function debounceCompute() {
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => computeDistance(), 500);
}

function setBusy(btn, busyText) {
    btn.disabled = true;
    btn.dataset.oldText = btn.innerHTML;
    btn.innerHTML = `<div class="loading"></div> ${busyText}`;
}
function clearBusy(btn) {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.oldText || btn.innerHTML;
}

function basicKeywordGaps(query, text) {
    // 超簡化中文/英文 token 拆解，比對缺少關鍵詞
    const norm = s => (s || '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const q = norm(query).split(' ').filter(Boolean);
    const tset = new Set(norm(text).split(' ').filter(Boolean));

    const missing = [];
    for (const token of q) {
        if (token.length <= 1) continue;
        if (!tset.has(token)) missing.push(token);
    }
    return [...new Set(missing)];
}

async function computeDistance() {
    compareAndHighlightText();

    const query = (document.getElementById('queryInput').value || '').trim();
    const text = cleanTextForApi(document.getElementById('mainText').innerHTML);

    if (!query) {
        showToast('請先輸入「用戶問句」', 'warning');
        return;
    }
    if (!text) {
        showToast('請在「主要文本」輸入內容', 'warning');
        return;
    }

    const btn = document.getElementById('computeBtn');
    setBusy(btn, '計算中...');

    try {
        const sessionId = getSessionIdFromUrl() || '';
        const body = `text1=${encodeURIComponent(query)}&text2=${encodeURIComponent(text)}`;
        const resp = await safeFetch(`/api/get_similarity/?session_id=${encodeURIComponent(sessionId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
            body
        });

        let score = null;
        if (resp && typeof resp.similarity_score === 'number') {
            // 假設後端回傳 0-100（維持與舊頁一致）
            score = resp.similarity_score;
            updateScoreBadge(document.getElementById('simScore'), score);
            const dist = Math.max(0, 100 - Math.round(score));
            updateScoreBadge(document.getElementById('cosDist'), dist);

            // 低分提示
            document.getElementById('suggestionBox').style.display = score < 60 ? 'block' : 'none';

            // 關鍵詞缺口
            const gaps = basicKeywordGaps(query, text);
            const gapBox = document.getElementById('gapHints');
            const gapList = document.getElementById('gapList');
            if (gaps.length) {
                gapBox.style.display = 'block';
                gapList.innerHTML = gaps.map(g => `<span class="badge bg-secondary" style="margin:2px;">${g}</span>`).join('');
            } else {
                gapBox.style.display = 'none';
                gapList.innerHTML = '';
            }
        } else {
            updateScoreBadge(document.getElementById('simScore'), null);
            updateScoreBadge(document.getElementById('cosDist'), null);
            showToast('計算失敗，請稍後再試', 'danger');
        }

        persistSession(query, score);
    } catch (e) {
        console.error(e);
        showToast(`計算失敗：${e.message}`, 'danger');
    } finally {
        clearBusy(btn);
    }
}

// === 文案優化建議（前端純規則版，無需後端） ===
function suggestImprovements() {
    const query = (document.getElementById('queryInput').value || '').trim();
    const text = cleanTextForApi(document.getElementById('mainText').innerHTML);
    if (!query || !text) {
        showToast('請先輸入問句與主文本', 'warning');
        return;
    }

    const gaps = basicKeywordGaps(query, text);
    const tips = [];

    if (gaps.length) {
        tips.push(`將關鍵詞自然置入：${gaps.slice(0, 8).join('、')}`);
    }
    // 結構化建議
    tips.push('在首段前兩句回應問句的核心意圖，並用一個小標重申關鍵詞。');
    tips.push('在結尾段給出明確結論或下一步指引（FAQ / CTA / 延伸閱讀）。');
    tips.push('避免關鍵詞堆疊；維持可讀性與自然語氣。');

    const box = document.getElementById('gapHints');
    const list = document.getElementById('gapList');
    box.style.display = 'block';
    list.innerHTML = tips.map(t => `<div>• ${t}</div>`).join('');
}

// === UI 綁定 ===
document.addEventListener('DOMContentLoaded', function () {
    // 會話
    loadSessions();
    initializeSession();

    // 清空問句
    document.getElementById('clearQueryBtn').addEventListener('click', () => {
        document.getElementById('queryInput').value = '';
        updateScoreBadge(document.getElementById('simScore'), null);
        updateScoreBadge(document.getElementById('cosDist'), null);
        document.getElementById('gapHints').style.display = 'none';
        document.getElementById('gapList').innerHTML = '';
    });

    // 問句輸入即時計算
    document.getElementById('queryInput').addEventListener('input', () => {
        if (document.getElementById('autoComputeSwitch').checked) debounceCompute();
    });
});