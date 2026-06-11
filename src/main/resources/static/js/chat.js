let currentUser = null;
let currentChatId = null;
let currentChatName = '';
let searchMode = 'chats';
let pinnedChats = JSON.parse(localStorage.getItem('xssm-pinned') || '[]');
let activeReplyTo = null;
let selectedMessageId = null;
let mediaRecorder = null;
let recordedChunks = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadCurrentUser();
    if (!currentUser) { window.location.href = '/login'; return; }
    applyTheme();
    document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme);
    document.getElementById('sidebarName').textContent = currentUser.displayName || currentUser.username;
    document.getElementById('sidebarAvatar').textContent = (currentUser.displayName || currentUser.username).charAt(0).toUpperCase();

    await loadChats();
    setupSearch();
    setupSearchModeToggle();
    setupMenuToggle();
    setupMessageInput();
    setupGlobalKeys();
    setupContextMenu();
    setupReactionPicker();
    setupScrollToBottomButton();

    const lastChat = localStorage.getItem('xssm-last-chat');
    if (lastChat) {
        const [id, name] = lastChat.split('|');
        if (id) openChat(id, name);
    }
    createParticles();
});

async function loadCurrentUser() {
    try {
        const r = await fetch('/api/user/me');
        if (!r.ok) throw new Error('Not authenticated');
        currentUser = await r.json();
    } catch (e) { window.location.href = '/login'; }
}

async function loadChats() {
    const r = await fetch('/api/chats');
    if (!r.ok) return;
    let chats = await r.json();
    chats.sort((a, b) => pinnedChats.includes(a.id) ? -1 : 1);
    document.getElementById('chatList').innerHTML = chats.map(c => {
        const letter = c.name.charAt(0).toUpperCase();
        return `<div class="chat-item" data-chat-id="${c.id}" data-chat-name="${c.name}">
            <div class="avatar">${letter}</div>
            <div class="chat-info"><div class="chat-name">${c.name}</div></div>
            <button class="icon-btn pin-btn" onclick="event.stopPropagation();togglePinChat('${c.id}')"><i class="fas fa-thumbtack" style="color:${pinnedChats.includes(c.id) ? 'var(--primary)' : 'var(--text-secondary)'}"></i></button>
        </div>`;
    }).join('');
    document.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', () => openChat(item.dataset.chatId, item.dataset.chatName));
    });
}

async function openChat(chatId, chatName) {
    currentChatId = chatId; currentChatName = chatName;
    document.getElementById('activeChatName').textContent = chatName;
    document.getElementById('activeChatAvatar').textContent = chatName.charAt(0).toUpperCase();
    closeSidebarOnMobile();
    await loadMessages();
    document.getElementById('messageInput').focus();
}

async function loadMessages() {
    if (!currentChatId) return;
    const container = document.getElementById('messagesContainer');
    container.innerHTML = '<div class="empty-state"><i class="fas fa-comment-dots"></i><p>Нет сообщений</p></div>';
    const r = await fetch(`/api/messages/${currentChatId}`);
    if (!r.ok) return;
    const msgs = await r.json();
    if (msgs.length === 0) return;
    container.innerHTML = '';
    msgs.forEach(m => addMessageToDOM(m, false));
    container.scrollTop = container.scrollHeight;
}

function addMessageToDOM(m, animate) {
    const container = document.getElementById('messagesContainer');
    const isMine = m.sender === currentUser.username;
    const time = new Date(m.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const div = document.createElement('div');
    div.className = 'message ' + (isMine ? 'sent' : 'received') + (animate ? ' fade-in' : '');
    div.setAttribute('data-id', m.id);
    div.innerHTML = `<div class="message-content">
        ${m.attachmentUrl ? `<img src="${m.attachmentUrl}" class="attachment">` : ''}
        <div class="msg-text">${m.content}</div>
        <div class="message-time">${time} ${isMine ? (m.read ? '✓✓' : '✓') : ''}</div>
    </div>`;
    div.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        selectedMessageId = m.id;
        showContextMenu(e.clientX, e.clientY);
    });
    div.addEventListener('dblclick', () => {
        document.getElementById('reactionPicker').style.display = 'flex';
        document.getElementById('reactionPicker').setAttribute('data-msg-id', m.id);
    });
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    const expire = document.getElementById('expireSelect').value;
    if (!text) return;
    if (!currentChatId) return alert('Выберите чат');
    const formData = new FormData();
    formData.append('chatId', currentChatId);
    formData.append('content', text);
    if (expire) formData.append('expireInSeconds', expire);
    const r = await fetch('/api/messages', { method:'POST', body:formData });
    if (r.ok) {
        const msg = await r.json();
        input.value = '';
        addMessageToDOM(msg, true);
    } else {
        alert('Ошибка отправки');
    }
}

async function sendFiles() {
    const files = document.getElementById('multiFileInput').files;
    for (const file of files) {
        const formData = new FormData();
        formData.append('chatId', currentChatId);
        formData.append('file', file);
        formData.append('content', '📎 ' + file.name);
        const r = await fetch('/api/messages', { method:'POST', body:formData });
        if (r.ok) {
            const msg = await r.json();
            addMessageToDOM(msg, true);
        }
    }
}

function addReaction(emoji) {
    const msgId = document.getElementById('reactionPicker').getAttribute('data-msg-id');
    // Здесь можно отправить реакцию через WebSocket
    document.getElementById('reactionPicker').style.display = 'none';
}

async function openChatInfo() {
    const r = await fetch(`/api/messages/${currentChatId}`);
    const msgs = await r.json();
    const participants = [...new Set(msgs.map(m => m.sender))];
    document.getElementById('chatInfoContent').innerHTML = `<p>Участники: ${participants.join(', ')}</p><p>Сообщений: ${msgs.length}</p>`;
    openModal('chatInfoModal');
}

function setupReactionPicker() {
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.reaction-picker') && !e.target.closest('.message')) {
            document.getElementById('reactionPicker').style.display = 'none';
        }
    });
}

// Остальные функции (setupSearch, setupMenuToggle, createParticles, ...) остаются без изменений
// ... (скопируйте их из предыдущей полной версии chat.js)