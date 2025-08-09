    // === 工具函數 ===
function getSessionIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('session_id');
}

function setSessionIdToUrl(sessionId) {
    const url = new URL(window.location.href);
    url.searchParams.set('session_id', sessionId);
    window.location.replace(url.toString());
    return url.toString();
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

function saveMainTextToLocalStorage(mainText) {
    localStorage.setItem('mainText', mainText);
}

function getMainTextFromLocalStorage() {
    return localStorage.getItem('mainText') || '';
}

// 新增：localStorage管理session
function saveSessionToLocalStorage(sessionId, summary) {
    const sessions = JSON.parse(localStorage.getItem('sessions') || '[]');
    const existingIndex = sessions.findIndex(session => session.sessionId === sessionId);
    
    if (existingIndex >= 0) {
        // 更新現有session
        sessions[existingIndex].summary = summary;
        sessions[existingIndex].lastAccessed = new Date().toISOString();
    } else {
        // 新增session
        sessions.push({ 
            sessionId, 
            summary, 
            createdAt: new Date().toISOString(),
            lastAccessed: new Date().toISOString()
        });
    }
    
    // 只保留最近的20個session
    sessions.sort((a, b) => new Date(b.lastAccessed) - new Date(a.lastAccessed));
    const limitedSessions = sessions.slice(0, 20);
    
    localStorage.setItem('sessions', JSON.stringify(limitedSessions));
    loadSessions();
}

function getSessionsFromLocalStorage() {
    return JSON.parse(localStorage.getItem('sessions') || '[]');
}

function removeSessionFromLocalStorage(sessionId) {
    const sessions = getSessionsFromLocalStorage();
    const filteredSessions = sessions.filter(session => session.sessionId !== sessionId);
    localStorage.setItem('sessions', JSON.stringify(filteredSessions));
    loadSessions();
}

function cleanTextForApi(text) {
    // Remove all HTML tags and exclude deleted text
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = text;

    const spans = tempDiv.querySelectorAll('span');
    spans.forEach(span => {
        if (span.style.backgroundColor === 'rgb(254, 226, 226)') { // Match deletion color
            span.remove();
        }
    });

    return tempDiv.textContent || tempDiv.innerText || '';
}

function updateScoreDisplay(scoreBox, score) {
    scoreBox.className = 'score-badge';
    if (typeof score === 'number') {
        scoreBox.textContent = score + '%';
        if (score < 30) {
            scoreBox.classList.add('score-low');
        } else if (score < 60) {
            scoreBox.classList.add('score-medium');
        } else {
            scoreBox.classList.add('score-high');
        }
    } else {
        scoreBox.textContent = '-';
    }
}

// 新增：統一的fetch函數，帶有錯誤處理和重試
async function safeFetch(url, options = {}, retries = 3) {
    const defaultOptions = {
        mode: 'cors',
        credentials: 'same-origin',
        headers: {
            'Accept': 'application/json',
            ...options.headers
        }
    };
    
    const fetchOptions = { ...defaultOptions, ...options };
    
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, fetchOptions);
            
            // 特別處理502錯誤
            if (response.status === 502) {
                throw new Error(`伺服器暫時無法回應 (502)，正在重試... (${i + 1}/${retries})`);
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            // 檢查響應是否為JSON
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                return await response.text();
            }
        } catch (error) {
            console.warn(`Fetch attempt ${i + 1} failed:`, error);
            
            if (i === retries - 1) {
                // 最後一次重試失敗
                if (error.message.includes('502')) {
                    throw new Error('伺服器連線問題，請稍後再試或聯繫系統管理員');
                }
                if (error.name === 'TypeError' && error.message.includes('fetch')) {
                    throw new Error('網路連線問題，請檢查網路狀態');
                }
                throw error;
            }
            
            // 對於502錯誤，增加重試間隔
            const waitTime = error.message.includes('502') ? 
                3000 * (i + 1) : 1000 * (i + 1);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
}

// 新增：顯示錯誤訊息的函數
function showErrorMessage(message, type = 'error') {
    // 移除舊的錯誤訊息
    const oldError = document.querySelector('.error-message');
    if (oldError) {
        oldError.remove();
    }
    
    const errorDiv = document.createElement('div');
    errorDiv.className = `alert alert-${type === 'error' ? 'danger' : 'warning'} error-message`;
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '80px';
    errorDiv.style.right = '20px';
    errorDiv.style.zIndex = '9999';
    errorDiv.style.maxWidth = '400px';
    errorDiv.innerHTML = `
        <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'exclamation-triangle'}"></i>
        ${message}
        <button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>
    `;
    
    document.body.appendChild(errorDiv);
    
    // 5秒後自動移除
    setTimeout(() => {
        if (errorDiv.parentElement) {
            errorDiv.remove();
        }
    }, 5000);
}

// === 文本處理功能 ===
function highlightTextDiff(oldText, newText) {
    const dmp = new diff_match_patch();
    const diffs = dmp.diff_main(oldText, newText);
    dmp.diff_cleanupSemantic(diffs);

    let highlightedText = '';
    diffs.forEach(([op, text]) => {
        if (op === 0) { // Equal
            highlightedText += text;
        } else if (op === -1) { // Deletion
            highlightedText += `<span style='background-color: #fee2e2; color: #dc2626;'>${text}</span>`;
        } else if (op === 1) { // Insertion
            highlightedText += `<span style='background-color: #dcfce7; color: #16a34a;'>${text}</span>`;
        }
    });

    return highlightedText;
}

function compareAndHighlightText() {
    const oldText = getMainTextFromLocalStorage();
    const newText = document.getElementById('mainText').innerHTML;

    if (oldText && oldText !== newText) {
        const diffHtml = highlightTextDiff(oldText, newText);
        document.getElementById('mainText').innerHTML = diffHtml;

        // Save cleaned text to localStorage
        const cleanedText = cleanTextForApi(diffHtml);
        saveMainTextToLocalStorage(cleanedText);
    }
}

function checkTextLength() {
    const mainText = document.getElementById('mainText');
    const warning = document.getElementById('textWarning');
    const computeButton = document.querySelector('.analyze-btn');

    if (mainText.innerText.length > 1000) {
        warning.style.display = 'block';
        computeButton.disabled = true;
    } else {
        warning.style.display = 'none';
        computeButton.disabled = false;
    }
}

// === 會話管理功能 ===
function loadSessions() {
    const sessions = getSessionsFromLocalStorage();
    const sessionList = document.getElementById('sessionList');
    const currentSessionId = getSessionIdFromUrl();
    
    sessionList.innerHTML = '';
    
    sessions.forEach(session => {
        const sessionDiv = document.createElement('div');
        sessionDiv.style.display = 'flex';
        sessionDiv.style.alignItems = 'center';
        sessionDiv.style.gap = '8px';
        
        const button = document.createElement('button');
        button.className = 'session-item';
        button.style.flex = '1';
        button.style.borderRight = 'none';
        button.style.borderTopRightRadius = '0';
        button.style.borderBottomRightRadius = '0';
        
        if (session.sessionId === currentSessionId) {
            button.classList.add('active');
        }
        
        // 顯示摘要和時間
        const timeAgo = getTimeAgo(session.lastAccessed);
        button.innerHTML = `
            <div style="text-align: left;">
                <div style="font-weight: 500;">${session.summary}</div>
                <div style="font-size: 12px; opacity: 0.7; margin-top: 2px;">${timeAgo}</div>
            </div>
        `;
        
        button.onclick = () => {
            const url = new URL(window.location.href);
            url.searchParams.set('session_id', session.sessionId);
            window.location.href = url.toString();
        };
        
        // 刪除按鈕
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-sm btn-outline-danger';
        deleteBtn.style.minWidth = '32px';
        deleteBtn.style.height = '32px';
        deleteBtn.style.padding = '0';
        deleteBtn.style.borderTopLeftRadius = '0';
        deleteBtn.style.borderBottomLeftRadius = '0';
        deleteBtn.innerHTML = '<i class="fas fa-trash" style="font-size: 12px;"></i>';
        deleteBtn.title = '刪除會話';
        
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm('確定要刪除這個會話嗎？')) {
                removeSessionFromLocalStorage(session.sessionId);
                // 如果刪除的是當前會話，創建新會話
                if (session.sessionId === currentSessionId) {
                    createNewSession();
                }
            }
        };
        
        sessionDiv.appendChild(button);
        sessionDiv.appendChild(deleteBtn);
        sessionList.appendChild(sessionDiv);
    });
    
    // 如果沒有會話，顯示提示
    if (sessions.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'text-center text-muted p-3';
        emptyDiv.style.fontSize = '14px';
        emptyDiv.innerHTML = '<i class="fas fa-history"></i><br>尚無歷史會話';
        sessionList.appendChild(emptyDiv);
    }
}

// 新增：計算時間差
function getTimeAgo(dateString) {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return '剛剛';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} 分鐘前`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} 小時前`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} 天前`;
    return date.toLocaleDateString('zh-TW');
}

async function initializeSession() {
    const sessionId = getSessionIdFromUrl();
    let isNewSession = false;
    
    if (!sessionId) {
        // 創建新會話
        try {
            const data = await safeFetch('/api/get_session_id/', { 
                method: 'POST',
                mode: 'cors',
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (data.session_id) {
                isNewSession = true;
                setSessionIdToUrl(data.session_id);
            }
        } catch (error) {
            console.error('Error creating session:', error);
            showErrorMessage(`無法創建新會話: ${error.message}`);
        }
    } else {
        // 載入現有會話數據
        try {
            const data = await safeFetch(`/api/get_session_data/?session_id=${sessionId}`, {
                method: 'GET',
                mode: 'cors',
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (data && data.data) {
                // 載入主文本
                document.getElementById('mainText').innerHTML = data.data.main_text || '';
                
                // 載入查詢
                if (Array.isArray(data.data.queries)) {
                    for (let i = 1; i <= 5; i++) {
                        document.getElementById('input' + i).value = data.data.queries[i-1] || '';
                    }
                }
                
                // 載入分數
                if (Array.isArray(data.data.scores)) {
                    for (let i = 1; i <= 5; i++) {
                        const score = data.data.scores[i-1];
                        const scoreBox = document.getElementById('score' + i);
                        updateScoreDisplay(scoreBox, score);
                    }
                }
                
                // 更新標題
                if (data.summary) {
                    document.title = data.summary;
                }
            } else {
                // 如果沒有會話數據，可能是新會話
                isNewSession = true;
            }
        } catch (error) {
            console.error('Error loading session data:', error);
            showErrorMessage(`無法載入會話數據: ${error.message}`, 'warning');
            isNewSession = true;
        }
    }
    
    // 只有在非新會話且mainText為空時，才從localStorage載入
    if (!isNewSession) {
        const mainText = getMainTextFromLocalStorage();
        if (mainText && !document.getElementById('mainText').innerHTML) {
            document.getElementById('mainText').innerHTML = mainText;
        }
    } else {
        // 新會話時清空localStorage中的舊數據
        localStorage.removeItem('mainText');
    }
    
    // 保存會話到localStorage（如果有摘要）
    if (sessionId && !isNewSession) {
        try {
            const data = await safeFetch(`/api/get_session_data/?session_id=${sessionId}`, {
                method: 'GET',
                mode: 'cors',
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (data && data.summary) {
                saveSessionToLocalStorage(sessionId, data.summary);
            }
        } catch (error) {
            console.error('Error saving session to localStorage:', error);
        }
    }
}

function createNewSession() {
    fetch('/api/get_session_id/', { 
        method: 'POST',
        mode: 'cors',
        credentials: 'same-origin',
        headers: {
            'Accept': 'application/json'
        }
    })
        .then(response => response.json())
        .then(data => {
            if (data.session_id) {
                const newUrl = setSessionIdToUrl(data.session_id);
                window.location.assign(newUrl);
            } else {
                alert('無法開啟新的 Session');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('發生錯誤，請稍後再試');
        });
}

// === API相關功能 ===
function getSimilarityScores() {
    compareAndHighlightText();
    const btn = document.querySelector('.analyze-btn');
    const suggestionBox = document.getElementById('suggestionBox');
    
    btn.disabled = true;
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<div class="loading"></div> 計算中...';
    
    let completed = 0;
    let scores = [null, null, null, null, null];
    let lowScoreExists = false;

    const saveSessionData = () => {
        const mainText = cleanTextForApi(document.getElementById('mainText').innerHTML);
        const queries = [];
        for (let i = 1; i <= 5; i++) {
            queries.push(document.getElementById('input' + i).value);
        }
        const sessionId = getSessionIdFromUrl();
        const data = {
            main_text: mainText,
            queries: queries,
            scores: scores
        };
        
        fetch('/api/save_session/', {
            method: 'POST',
            mode: 'cors',
            credentials: 'same-origin',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ session_id: sessionId, data: data })
        })
        .then(response => response.json())
        .then(responseData => {
            if (responseData && responseData.summary) {
                saveSessionToLocalStorage(sessionId, responseData.summary);
            }
        })
        .catch(error => {
            console.error('Error saving session:', error);
        });
        
        saveMainTextToLocalStorage(mainText);
    };

    const processComplete = () => {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
        saveSessionData();
        suggestionBox.style.display = lowScoreExists ? 'block' : 'none';
    };

    for (let i = 1; i <= 5; i++) {
        const text1 = document.getElementById('input' + i).value;
        const text2 = cleanTextForApi(document.getElementById('mainText').innerHTML);
        const scoreBox = document.getElementById('score' + i);

        if (text1 && text2) {
            fetch(`/api/get_similarity/?session_id=${getSessionIdFromUrl()}`, {
                method: 'POST',
                mode: 'cors',
                credentials: 'same-origin',
                headers: { 
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: `text1=${encodeURIComponent(text1)}&text2=${encodeURIComponent(text2)}`
            })
            .then(response => response.json())
            .then(data => {
                if (typeof data.similarity_score === 'number') {
                    scores[i-1] = data.similarity_score;
                    updateScoreDisplay(scoreBox, data.similarity_score);
                    if (data.similarity_score < 60) {
                        lowScoreExists = true;
                    }
                } else {
                    scoreBox.textContent = '錯誤';
                    scoreBox.className = 'score-badge score-low';
                    scores[i-1] = null;
                }
                completed++;
                if (completed === 5) processComplete();
            })
            .catch(() => {
                scoreBox.textContent = '錯誤';
                scoreBox.className = 'score-badge score-low';
                scores[i-1] = null;
                completed++;
                if (completed === 5) processComplete();
            });
        } else {
            updateScoreDisplay(scoreBox, null);
            scores[i-1] = null;
            completed++;
            if (completed === 5) processComplete();
        }
    }
}

function generateQueries() {
    const mainText = document.getElementById('mainText').innerHTML;
    const generateButton = document.querySelector('.btn-secondary');

    if (!mainText.trim()) {
        alert('請先輸入主要文本！');
        return;
    }

    // Disable the button and show loading text
    generateButton.disabled = true;
    const originalText = generateButton.innerHTML;
    generateButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 產生中...';

    fetch('/api/generate_search_intents/', {
        method: 'POST',
        mode: 'cors',
        credentials: 'same-origin',
        headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({ text: mainText })
    })
    .then(response => response.json())
    .then(data => {
        if (data.intents && Array.isArray(data.intents)) {
            for (let i = 0; i < 5; i++) {
                const input = document.getElementById('input' + (i + 1));
                input.value = data.intents[i] || '';
            }
        } else {
            alert('無法產生用戶提問，請稍後再試。');
        }
    })
    .catch(error => {
        console.error('Error generating queries:', error);
        alert('發生錯誤，請稍後再試。');
    })
    .finally(() => {
        generateButton.disabled = false;
        generateButton.innerHTML = originalText;
    });
}

// === 初始化 ===
document.addEventListener('DOMContentLoaded', function() {
    // 載入會話列表
    loadSessions();
    
    // 初始化會話
    initializeSession();
});
