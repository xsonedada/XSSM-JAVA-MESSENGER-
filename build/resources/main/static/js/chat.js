let currentUser = null;
let currentChatId = null;
let currentChatName = '';
let searchMode = 'chats';
let searchTimeout = null;
let isSending = false;
let socket = null;
let pinnedChats = JSON.parse(localStorage.getItem('xssm-pinned') || '[]');
let activeReplyTo = null;
let selectedMessageId = null;
let mediaRecorder = null;
let recordedChunks = [];

document.addEventListener('DOMContentLoaded', async () => {
    console.log('XSSM started');
    await loadCurrentUser();
    if (!currentUser) { window.location.href = '/login'; return; }
    applyTheme();
    document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme);
    document.getElementById('sidebarName').textContent = currentUser.displayName || currentUser.username;
    const av = document.getElementById('sidebarAvatar');
    if (av) av.textContent = (currentUser.displayName || currentUser.username).charAt(0).toUpperCase();

    await loadChats();
    setupSearch();
    setupSearchModeToggle();
    setupMenuToggle();
    setupMessageInput();
    connectWebSocket();
    setupMentionDetection();
    setupStickerPanel();
    setupPollModal();
    setupGlobalKeys();
    requestNotificationPermission();
    setupContextMenu();
    setupScrollToBottomButton();
    setupQuickProfile();

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
    // РЎРѕСЂС‚РёСЂРѕРІРєР°: Р·Р°РєСЂРµРїР»С‘РЅРЅС‹Рµ СЃРІРµСЂС…Сѓ
    chats.sort((a, b) => {
        const aPinned = pinnedChats.includes(a.id.toString()) ? 0 : 1;
        const bPinned = pinnedChats.includes(b.id.toString()) ? 0 : 1;
        return aPinned - bPinned;
    });
    const list = document.getElementById('chatList');
    if (!list) return;
    list.innerHTML = chats.map(c => {
        const isPinned = pinnedChats.includes(c.id.toString());
        const avatarHtml = c.avatar?.type === 'letter'
            ? `<div class="avatar">${c.avatar.letter}</div>`
            : `<div class="avatar"><i class="fas fa-users"></i></div>`;
        return `<div class="chat-item" data-chat-id="${c.id}" data-chat-name="${escapeHtml(c.name)}">
            ${avatarHtml}
            <div class="chat-info"><div class="chat-name">${escapeHtml(c.name)}</div></div>
            <button class="icon-btn pin-btn" title="${isPinned ? 'РћС‚РєСЂРµРїРёС‚СЊ' : 'Р—Р°РєСЂРµРїРёС‚СЊ'}" onclick="event.stopPropagation(); togglePinChat('${c.id}')">
                <i class="fas fa-thumbtack" style="color:${isPinned ? 'var(--primary)' : 'var(--text-secondary)'}"></i>
            </button>
        </div>`;
    }).join('');

    document.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', () => {
            openChat(item.dataset.chatId, item.dataset.chatName);
        });
    });

    if (currentChatId) {
        const active = document.querySelector(`.chat-item[data-chat-id="${currentChatId}"]`);
        if (active) active.classList.add('active');
    }
}

function togglePinChat(chatId) {
    if (pinnedChats.includes(chatId)) {
        pinnedChats = pinnedChats.filter(id => id !== chatId);
    } else {
        pinnedChats.push(chatId);
    }
    localStorage.setItem('xssm-pinned', JSON.stringify(pinnedChats));
    loadChats();
}

async function openChat(chatId, chatName, isGroup) {
    currentChatId = chatId;
    currentChatName = chatName;
    document.getElementById('activeChatName').textContent = chatName;
    document.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
    const active = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
    if (active) active.classList.add('active');
    localStorage.setItem('xssm-last-chat', chatId + '|' + chatName);

    const headerAvatar = document.getElementById('activeChatAvatar');
    if (headerAvatar) {
        headerAvatar.innerHTML = isGroup ? '<i class="fas fa-users"></i>' : chatName.charAt(0).toUpperCase();
    }

    await loadMessages();
    document.getElementById('messageInput').focus();
    closeSidebarOnMobile();
}

async function loadMessages() {
    if (!currentChatId) return;
    const r = await fetch(`/api/messages/${currentChatId}`);
    if (!r.ok) return;
    const msgs = await r.json();
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    container.innerHTML = '';
    msgs.forEach(m => addMessageToDOM(m, false));
    container.scrollTop = container.scrollHeight;
    updateScrollButton();
}

function addMessageToDOM(m, animate) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    const isMine = m.sender === currentUser.username;
    const time = new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const div = document.createElement('div');
    div.className = 'message ' + (isMine ? 'sent' : 'received') + (animate ? ' fade-in' : '');
    div.setAttribute('data-id', m.id);
    let readIndicator = '';
    if (isMine) {
        readIndicator = m.read ? '<span class="read-check" title="РџСЂРѕС‡РёС‚Р°РЅРѕ"><i class="fas fa-check-double"></i></span>'
                              : '<span class="read-check" title="Р”РѕСЃС‚Р°РІР»РµРЅРѕ"><i class="fas fa-check"></i></span>';
    }
    let replyHtml = '';
    if (m.replyToId) {
        const repliedMessage = document.querySelector(`.message[data-id="${m.replyToId}"]`);
        if (repliedMessage) {
            const preview = repliedMessage.querySelector('.msg-text')?.textContent.substring(0, 50) || '';
            replyHtml = `<div class="reply-preview" onclick="scrollToMessage(${m.replyToId})"><i class="fas fa-reply"></i> ${preview}</div>`;
        }
    }
    div.innerHTML = `
        ${replyHtml}
        <div class="message-sender">${isMine ? 'Р’С‹' : escapeHtml(m.sender)}</div>
        <div class="message-content">
            ${m.attachmentUrl ? `<img src="${m.attachmentUrl}" class="attachment">` : ''}
            <div class="msg-text">${renderMarkdown(escapeHtml(m.content))}</div>
            <div class="message-time">${time}${m.edited ? ' (СЂРµРґ.)' : ''} ${readIndicator}</div>
        </div>
    `;

    div.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        selectedMessageId = m.id;
        showContextMenu(e.clientX, e.clientY);
    });

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    updateScrollButton();
}

async function sendMessage() {
    if (isSending) return;
    const input = document.getElementById('messageInput');
    if (!input) return;
    const text = input.value.trim();
    const file = document.getElementById('fileInput')?.files[0];
    const expireSelect = document.getElementById('expireSelect');
    const expireSeconds = expireSelect ? parseInt(expireSelect.value) || null : null;
    if (!text && !file) return;
    if (!currentChatId) { alert('Р’С‹Р±РµСЂРёС‚Рµ С‡Р°С‚'); return; }

    isSending = true;
    const formData = new FormData();
    formData.append('chatId', currentChatId);
    if (text) formData.append('content', text);
    if (file) formData.append('file', file);
    if (expireSeconds) formData.append('expireInSeconds', expireSeconds);
    if (activeReplyTo) formData.append('replyToId', activeReplyTo.id);

    try {
        const r = await fetch('/api/messages', { method: 'POST', body: formData });
        if (!r.ok) {
            const err = await r.json();
            alert(err.error || 'РћС€РёР±РєР° РѕС‚РїСЂР°РІРєРё');
            return;
        }
        const newMsg = await r.json();
        input.value = '';
        document.getElementById('fileInput').value = '';
        cancelReply();
        addMessageToDOM(newMsg, true);
    } catch (e) {
        alert('РЎРµС‚РµРІР°СЏ РѕС€РёР±РєР°');
    } finally {
        isSending = false;
    }
}

function replyToMessage(messageId) {
    const msgEl = document.querySelector(`.message[data-id="${messageId}"]`);
    if (!msgEl) return;
    const sender = msgEl.querySelector('.message-sender')?.textContent || '';
    const preview = msgEl.querySelector('.msg-text')?.textContent.substring(0, 50) || '';
    activeReplyTo = { id: messageId, sender, preview };
    const input = document.getElementById('messageInput');
    input.placeholder = `Р’ РѕС‚РІРµС‚ ${sender}: ${preview}`;
    input.focus();
    let replyIndicator = document.getElementById('replyIndicator');
    if (!replyIndicator) {
        replyIndicator = document.createElement('div');
        replyIndicator.id = 'replyIndicator';
        replyIndicator.className = 'reply-indicator';
        document.querySelector('.compose-bar').before(replyIndicator);
    }
    replyIndicator.innerHTML = `<span>РћС‚РІРµС‚ РЅР°: ${preview}</span><button onclick="cancelReply()"><i class="fas fa-times"></i></button>`;
    replyIndicator.style.display = 'flex';
}

function cancelReply() {
    activeReplyTo = null;
    document.getElementById('messageInput').placeholder = 'РЎРѕРѕР±С‰РµРЅРёРµ...';
    const indicator = document.getElementById('replyIndicator');
    if (indicator) indicator.style.display = 'none';
}

async function editMessage(msgId) {
    const newText = prompt('РР·РјРµРЅРёС‚СЊ СЃРѕРѕР±С‰РµРЅРёРµ:');
    if (newText && newText.trim()) {
        await fetch(`/api/messages/${msgId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: newText.trim() })
        });
        await loadMessages();
    }
}

async function deleteMessage(msgId, forAll) {
    if (!confirm(forAll ? 'РЈРґР°Р»РёС‚СЊ РґР»СЏ РІСЃРµС…?' : 'РЈРґР°Р»РёС‚СЊ Сѓ СЃРµР±СЏ?')) return;
    await fetch(`/api/messages/${msgId}?forAll=${forAll}`, { method: 'DELETE' });
    await loadMessages();
}

// ---------- РџРѕРёСЃРє Рё РїРѕР»СЊР·РѕРІР°С‚РµР»Рё ----------
function setupSearch() {
    const input = document.getElementById('searchInput');
    if (!input) return;
    input.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const query = input.value.trim();
        if (searchMode === 'chats') {
            filterChats(query);
        } else {
            if (query.length === 0) {
                document.getElementById('userSearchResultsInline').innerHTML = '';
                return;
            }
            searchTimeout = setTimeout(() => searchUsers(query), 300);
        }
    });
}

function filterChats(query) {
    const q = query.toLowerCase();
    document.querySelectorAll('.chat-item').forEach(item => {
        const name = item.dataset.chatName?.toLowerCase() || '';
        item.style.display = name.includes(q) ? 'flex' : 'none';
    });
}

async function searchUsers(query) {
    if (query.length < 1) return;
    const r = await fetch(`/api/user/search?q=${encodeURIComponent(query)}`);
    if (!r.ok) return;
    const users = await r.json();
    const container = document.getElementById('userSearchResultsInline');
    if (!container) return;
    container.innerHTML = users.map(u => `
        <div class="user-result-item">
            <div class="avatar"><i class="fas fa-user"></i></div>
            <div class="user-info">
                <div class="user-name">${escapeHtml(u.displayName || u.username)}</div>
                <div class="user-username">@${escapeHtml(u.username)}</div>
            </div>
            <button class="icon-btn" onclick="startPrivateChat('${escapeHtml(u.username)}')"><i class="fas fa-comment-dots"></i></button>
        </div>
    `).join('');
}

async function startPrivateChat(username) {
    const r = await fetch(`/api/chats/private/${username}`);
    if (r.ok) {
        const chat = await r.json();
        searchMode = 'chats';
        const modeBtn = document.getElementById('searchModeBtn');
        if (modeBtn) modeBtn.querySelector('i').className = 'fas fa-comments';
        document.getElementById('chatList').style.display = 'block';
        document.getElementById('userSearchResultsInline').style.display = 'none';
        document.getElementById('searchInput').placeholder = 'РџРѕРёСЃРє С‡Р°С‚РѕРІ...';
        document.getElementById('searchInput').value = '';
        await loadChats();
        openChat(chat.id, chat.name);
    } else {
        const err = await r.json();
        alert(err.error || 'РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ С‡Р°С‚');
    }
}

function setupSearchModeToggle() {
    const btn = document.getElementById('searchModeBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
        searchMode = searchMode === 'chats' ? 'users' : 'chats';
        const icon = btn.querySelector('i');
        if (searchMode === 'users') {
            if (icon) icon.className = 'fas fa-user-friends';
            document.getElementById('chatList').style.display = 'none';
            document.getElementById('userSearchResultsInline').style.display = 'block';
            document.getElementById('searchInput').placeholder = 'РџРѕРёСЃРє РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ (@name)...';
        } else {
            if (icon) icon.className = 'fas fa-comments';
            document.getElementById('chatList').style.display = 'block';
            document.getElementById('userSearchResultsInline').style.display = 'none';
            document.getElementById('searchInput').placeholder = 'РџРѕРёСЃРє С‡Р°С‚РѕРІ...';
        }
        document.getElementById('searchInput').value = '';
        document.getElementById('userSearchResultsInline').innerHTML = '';
    });
}

// ---------- Р­РјРѕРґР·Рё ----------
function setupEmojiPicker() {
    const picker = document.getElementById('emojiPicker');
    const btn = document.getElementById('emojiBtn');
    if (!picker || !btn) return;
    btn.addEventListener('click', e => {
        e.stopPropagation();
        picker.style.display = picker.style.display === 'flex' ? 'none' : 'flex';
    });
    picker.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
        document.getElementById('messageInput').value += b.textContent;
        picker.style.display = 'none';
    }));
    document.addEventListener('click', () => {
        if (picker) picker.style.display = 'none';
    });
}

// ---------- РњРµРЅСЋ ----------
function setupMenuToggle() {
    document.getElementById('menuBtn')?.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.toggle('open');
    });
}

function closeSidebarOnMobile() {
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar')?.classList.remove('open');
    }
}

function setupMessageInput() {
    const input = document.getElementById('messageInput');
    if (!input) return;
    input.addEventListener('keypress', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

// ---------- РџСЂРѕС„РёР»СЊ ----------
function openProfile() {
    const modal = document.getElementById('profileModal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.getElementById('profileUsername').textContent = currentUser.username;
    document.getElementById('profileEmail').textContent = currentUser.email;
    const img = document.getElementById('profileAvatarImg');
    if (img) img.src = currentUser.avatarUrl || '';
}

async function uploadAvatar() {
    const file = document.getElementById('avatarUpload')?.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    const r = await fetch('/api/user/avatar', { method: 'POST', body: formData });
    if (r.ok) {
        const data = await r.json();
        currentUser.avatarUrl = data.avatarUrl;
        const img = document.getElementById('profileAvatarImg');
        if (img) img.src = currentUser.avatarUrl;
    }
}

// ---------- РЎРѕР·РґР°РЅРёРµ С‡Р°С‚Р° ----------
async function createChat() {
    const name = document.getElementById('chatNameInput').value.trim();
    const membersRaw = document.getElementById('chatMembersInput').value;
    const isGroup = document.getElementById('isGroupCheckbox').checked;
    const members = membersRaw.split(',').map(s => s.trim()).filter(s => s);
    if (!name || members.length === 0) return alert('РЈРєР°Р¶РёС‚Рµ РЅР°Р·РІР°РЅРёРµ Рё СѓС‡Р°СЃС‚РЅРёРєРѕРІ');
    const r = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, isGroup, members })
    });
    if (r.ok) {
        closeModal();
        await loadChats();
    } else {
        const err = await r.json();
        alert(err.error || 'РћС€РёР±РєР° СЃРѕР·РґР°РЅРёСЏ С‡Р°С‚Р°');
    }
}

function closeModal() {
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
}

function openModal(id) {
    document.getElementById(id).style.display = 'flex';
}

// ---------- РџРѕРёСЃРє РІРЅСѓС‚СЂРё С‡Р°С‚Р° ----------
function openChatSearch() {
    document.getElementById('chatSearchBar').style.display = 'flex';
    document.getElementById('chatSearchInput').focus();
}

function closeChatSearch() {
    document.getElementById('chatSearchBar').style.display = 'none';
    document.querySelectorAll('.message').forEach(m => m.style.display = '');
    document.getElementById('chatSearchInput').value = '';
}
document.getElementById('chatSearchInput')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.message').forEach(msg => {
        const text = msg.querySelector('.msg-text')?.textContent.toLowerCase() || '';
        msg.style.display = text.includes(q) ? '' : 'none';
    });
});

// ---------- РЎС‚РёРєРµСЂС‹ ----------
function toggleStickerPanel() {
    const panel = document.getElementById('stickerPanel');
    if (panel) panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
}
function setupStickerPanel() {
    document.querySelectorAll('.sticker').forEach(s => s.addEventListener('click', e => {
        document.getElementById('messageInput').value += e.target.textContent;
        toggleStickerPanel();
    }));
}

// ---------- Р“РѕР»РѕСЃРѕРІРѕРµ СЃРѕРѕР±С‰РµРЅРёРµ ----------
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.start();
        document.getElementById('voiceRecorder').style.display = 'flex';
        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
        mediaRecorder.onstop = async () => {
            const blob = new Blob(recordedChunks, { type: 'audio/webm' });
            recordedChunks = [];
            const formData = new FormData();
            formData.append('file', blob, 'voice.webm');
            formData.append('chatId', currentChatId);
            formData.append('content', 'рџЋ¤ Р“РѕР»РѕСЃРѕРІРѕРµ СЃРѕРѕР±С‰РµРЅРёРµ');
            const r = await fetch('/api/messages', { method: 'POST', body: formData });
            if (r.ok) {
                const msg = await r.json();
                addMessageToDOM(msg, true);
            }
            document.getElementById('voiceRecorder').style.display = 'none';
            stream.getTracks().forEach(t => t.stop());
        };
    } catch (err) {
        alert('РќРµС‚ РґРѕСЃС‚СѓРїР° Рє РјРёРєСЂРѕС„РѕРЅСѓ');
    }
}
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
}

// ---------- РћРїСЂРѕСЃС‹ ----------
function openPollModal() { openModal('pollModal'); }
function addPollOption() {
    const container = document.getElementById('pollOptions');
    const input = document.createElement('input');
    input.type = 'text'; input.placeholder = 'Р’Р°СЂРёР°РЅС‚ ' + (container.children.length+1);
    container.appendChild(input);
}
async function createPoll() {
    const question = document.getElementById('pollQuestion').value.trim();
    const options = Array.from(document.querySelectorAll('#pollOptions input')).map(i => i.value.trim()).filter(v => v);
    if (!question || options.length < 2) return alert('Р’РІРµРґРёС‚Рµ РІРѕРїСЂРѕСЃ Рё РјРёРЅРёРјСѓРј 2 РІР°СЂРёР°РЅС‚Р°');
    const pollText = `рџ“Љ ${question}\n${options.map((o,i) => `${i+1}. ${o}`).join('\n')}`;
    document.getElementById('messageInput').value = pollText;
    await sendMessage();
    closeModal();
}

// ---------- РЈРїРѕРјРёРЅР°РЅРёСЏ ----------
function setupMentionDetection() {
    const input = document.getElementById('messageInput');
    if (!input) return;
    input.addEventListener('input', () => {
        const val = input.value;
        const cursor = input.selectionStart;
        const before = val.substring(0, cursor);
        const match = before.match(/@(\w*)$/);
        if (match) {
            fetch(`/api/user/search?q=${match[1]}`).then(r => r.json()).then(users => {
                const sug = document.getElementById('mentionSuggestions');
                sug.innerHTML = users.map(u => `<div class="mention-item" onclick="insertMention('${u.username}')">@${u.username}</div>`).join('');
                sug.style.display = 'block';
            });
        } else {
            document.getElementById('mentionSuggestions').style.display = 'none';
        }
    });
}
function insertMention(username) {
    const input = document.getElementById('messageInput');
    const val = input.value;
    const cursor = input.selectionStart;
    const before = val.substring(0, cursor).replace(/@\w*$/, '@' + username + ' ');
    const after = val.substring(cursor);
    input.value = before + after;
    input.focus();
    document.getElementById('mentionSuggestions').style.display = 'none';
}

// ---------- WebSocket ----------
function connectWebSocket() {
    if (!currentUser || !currentUser.id) return;
    socket = new WebSocket(`ws://${window.location.host}/ws/chat?userId=${currentUser.id}`);
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'new_message' && data.chatId == currentChatId) {
            addMessageToDOM(data.message, true);
            if (document.hidden) showBrowserNotification(data.message.sender, data.message.content);
        } else if (data.type === 'message_read' && data.messageId) {
            const msgEl = document.querySelector(`.message[data-id="${data.messageId}"]`);
            if (msgEl) {
                const check = msgEl.querySelector('.read-check');
                if (check) { check.innerHTML = '<i class="fas fa-check-double"></i>'; check.title = 'РџСЂРѕС‡РёС‚Р°РЅРѕ'; }
            }
        } else if (data.type === 'typing') {
            showTypingIndicator(data.sender);
        }
    };
    socket.onclose = () => setTimeout(connectWebSocket, 3000);
}

function showTypingIndicator(sender) {
    let indicator = document.getElementById('typingIndicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'typingIndicator';
        indicator.className = 'typing-indicator';
        document.querySelector('.compose-bar')?.parentNode.insertBefore(indicator, document.querySelector('.compose-bar'));
    }
    indicator.textContent = `${sender} РїРµС‡Р°С‚Р°РµС‚...`;
    indicator.style.display = 'block';
    clearTimeout(window.typingTimeout);
    window.typingTimeout = setTimeout(() => { if (indicator) indicator.style.display = 'none'; }, 2000);
}

// ---------- РЈРІРµРґРѕРјР»РµРЅРёСЏ Р±СЂР°СѓР·РµСЂР° ----------
function requestNotificationPermission() {
    if (Notification.permission === 'default') Notification.requestPermission();
}
function showBrowserNotification(title, body) {
    if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico' });
    }
}

// ---------- РљРѕРЅС‚РµРєСЃС‚РЅРѕРµ РјРµРЅСЋ ----------
function setupContextMenu() {
    document.addEventListener('click', () => {
        document.getElementById('contextMenu').style.display = 'none';
    });
}
function showContextMenu(x, y) {
    const menu = document.getElementById('contextMenu');
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.display = 'flex';
}
function contextReply() {
    replyToMessage(selectedMessageId);
    document.getElementById('contextMenu').style.display = 'none';
}
function contextCopy() {
    const text = document.querySelector(`.message[data-id="${selectedMessageId}"] .msg-text`)?.textContent;
    if (text) navigator.clipboard.writeText(text);
    document.getElementById('contextMenu').style.display = 'none';
}
function contextForward() {
    // Р—Р°РіР»СѓС€РєР°: РѕС‚РєСЂС‹РІР°РµРј РѕРєРЅРѕ РґР»СЏ РІС‹Р±РѕСЂР° С‡Р°С‚Р°
    alert('РџРµСЂРµСЃС‹Р»РєР° РІ СЂР°Р·СЂР°Р±РѕС‚РєРµ');
    document.getElementById('contextMenu').style.display = 'none';
}
function contextDelete() {
    deleteMessage(selectedMessageId, false);
    document.getElementById('contextMenu').style.display = 'none';
}

// ---------- Р‘С‹СЃС‚СЂС‹Р№ РїСЂРѕС„РёР»СЊ ----------
function setupQuickProfile() {
    document.getElementById('activeChatAvatar')?.addEventListener('click', showQuickProfile);
}
function showQuickProfile() {
    if (!currentChatId) return;
    const profile = document.getElementById('quickProfile');
    document.getElementById('quickName').textContent = currentChatName;
    document.getElementById('quickAvatar').src = ''; // РїРѕР·Р¶Рµ Р·Р°РіСЂСѓР·РёС‚СЊ Р°РІР°С‚Р°СЂ СЃРѕР±РµСЃРµРґРЅРёРєР°
    profile.style.display = 'flex';
    setTimeout(() => profile.style.display = 'none', 5000); // Р°РІС‚РѕСЃРєСЂС‹С‚РёРµ
}

// ---------- РџР°РЅРµР»СЊ РІР»РѕР¶РµРЅРёР№ ----------
function toggleMediaPanel() {
    const mediaGrid = document.getElementById('mediaGrid');
    mediaGrid.innerHTML = '';
    document.querySelectorAll('.attachment').forEach(img => {
        const clone = img.cloneNode();
        clone.style.width = '80px';
        clone.style.height = '80px';
        clone.style.objectFit = 'cover';
        clone.style.borderRadius = '8px';
        mediaGrid.appendChild(clone);
    });
    openModal('mediaModal');
}

// ---------- РљРЅРѕРїРєР° РїСЂРѕРєСЂСѓС‚РєРё РІРЅРёР· ----------
function setupScrollToBottomButton() {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    let btn = document.getElementById('scrollBottomBtn');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'scrollBottomBtn';
        btn.className = 'icon-btn scroll-bottom-btn';
        btn.innerHTML = '<i class="fas fa-arrow-down"></i>';
        btn.style.display = 'none';
        btn.addEventListener('click', () => {
            container.scrollTop = container.scrollHeight;
            btn.style.display = 'none';
        });
        container.parentElement.appendChild(btn);
    }
    container.addEventListener('scroll', updateScrollButton);
}
function updateScrollButton() {
    const container = document.getElementById('messagesContainer');
    const btn = document.getElementById('scrollBottomBtn');
    if (!container || !btn) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    btn.style.display = isNearBottom ? 'none' : 'flex';
}

function scrollToMessage(msgId) {
    const msgEl = document.querySelector(`.message[data-id="${msgId}"]`);
    if (msgEl) msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ---------- Р“Р»РѕР±Р°Р»СЊРЅС‹Рµ РєР»Р°РІРёС€Рё ----------
function setupGlobalKeys() {
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closeModal();
            closeChatSearch();
            cancelReply();
            document.getElementById('quickProfile').style.display = 'none';
        }
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
        }
    });
}

// ---------- Markdown ----------
function renderMarkdown(text) {
    return text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/~(.+?)~/g, '<del>$1</del>');
}

// ---------- РўРµРјС‹ ----------
function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('xssm-theme', next);
}
function applyTheme() {
    const saved = localStorage.getItem('xssm-theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
}

// ---------- РЈС‚РёР»РёС‚С‹ ----------
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    for (let i = 0; i < 30; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = Math.random() * 100 + '%';
        p.style.top = Math.random() * 100 + '%';
        p.style.width = p.style.height = (Math.random() * 4 + 2) + 'px';
        p.style.animationDelay = Math.random() * 8 + 's';
        container.appendChild(p);
    }
}
async function sendFile() {
    const files = document.getElementById('fileInput').files;
    for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('chatId', currentChatId);
        formData.append('content', ''); // можно добавить описание
        const r = await fetch('/api/messages', { method: 'POST', body: formData });
        if (r.ok) {
            const msg = await r.json();
            addMessageToDOM(msg, true);
        }
    }
    document.getElementById('fileInput').value = '';
}