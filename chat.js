document.addEventListener('DOMContentLoaded', async () => {
    const chatToggle = document.getElementById('chat-toggle');
    const chatWidget = document.getElementById('chat-widget-container');
    const closeChat = document.getElementById('close-chat');
    const chatInput = document.getElementById('chat-input');
    const sendChat = document.getElementById('send-chat');
    const chatMessages = document.getElementById('chat-messages');

    // 1. Setup Identity
    let visitorId = localStorage.getItem('07gold_visitor_id');
    if (!visitorId) {
        visitorId = 'USER_' + Math.random().toString(36).substring(2, 9).toUpperCase();
        localStorage.setItem('07gold_visitor_id', visitorId);
    }

    // 2. Determine Role
    const { data: { session } } = await window._supabase.auth.getSession();
    const isAdmin = !!session;
    const role = isAdmin ? 'ADMIN' : 'USER';
    
    window.activeChatPartner = isAdmin ? null : visitorId;
    
    // Load local history from localStorage if it exists
    const savedHistory = localStorage.getItem('07gold_chat_history');
    const localHistory = savedHistory ? JSON.parse(savedHistory) : [];

    // Load chat open state
    const isChatOpen = localStorage.getItem('07gold_chat_open') === 'true';
    if (isChatOpen && chatWidget && chatToggle) {
        chatWidget.classList.add('active');
        chatToggle.classList.add('hidden');
    }

    // Restore messages from history on load
    if (localHistory.length > 0) {
        chatMessages.innerHTML = ''; // Clear default greeting if we have history
        localHistory.forEach(msg => {
            renderMessage(msg.sender, msg.text, msg.timestamp, msg.senderRole, false);
        });
    }

    // 3. Initialize Supabase Realtime Channel
    let chatChannel;

    function subscribeToRoom(roomId) {
        if (chatChannel) chatChannel.unsubscribe();
        
        chatChannel = window._supabase.channel(`room:${roomId}`, {
            config: { broadcast: { self: true } }
        });

        chatChannel
            .on('broadcast', { event: 'message' }, (payload) => {
                const { sender, text, timestamp, senderRole } = payload.payload;
                renderMessage(sender, text, timestamp, senderRole);
            })
            .on('broadcast', { event: 'history_request' }, (payload) => {
                if (!isAdmin && role === 'USER') {
                    chatChannel.send({
                        type: 'broadcast',
                        event: 'history_response',
                        payload: { history: localHistory }
                    });
                }
            })
            .on('broadcast', { event: 'history_response' }, (payload) => {
                if (isAdmin) {
                    const history = payload.payload.history;
                    chatMessages.innerHTML = `<div class="message system">UPLINK_TO_${roomId}_SYNC_COMPLETE</div>`;
                    history.forEach(msg => {
                        renderMessage(msg.sender, msg.text, msg.timestamp, msg.senderRole, false);
                    });
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    if (isAdmin) {
                        setTimeout(() => {
                            chatChannel.send({
                                type: 'broadcast',
                                event: 'history_request',
                                payload: {}
                            });
                        }, 500);
                    }
                }
            });
    }

    // Initial subscription
    if (!isAdmin) {
        subscribeToRoom(visitorId);
        const monitorChannel = window._supabase.channel('admin-monitor');
        monitorChannel.subscribe(() => {
            monitorChannel.send({
                type: 'broadcast',
                event: 'presence',
                payload: { visitorId, status: 'ONLINE' }
            });
        });
    }

    // 4. Message Rendering
    function renderMessage(sender, text, timestamp, senderRole, saveToHistory = true) {
        if (saveToHistory) {
            localHistory.push({ sender, text, timestamp, senderRole });
            if (localHistory.length > 50) localHistory.shift(); 
            localStorage.setItem('07gold_chat_history', JSON.stringify(localHistory));
        }

        const msgDiv = document.createElement('div');
        const isMe = senderRole === role;
        msgDiv.className = `message ${isMe ? 'user' : 'agent'}`;
        if (senderRole === 'SYSTEM') msgDiv.className = 'message system';

        msgDiv.innerHTML = `
            <span class="msg-time">${timestamp}</span>
            <span class="msg-sender">${sender}:</span> ${text}
        `;
        
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        if (!isMe && saveToHistory) {
            const ping = new Audio('pingsound.mp3');
            ping.play().catch(e => {});
        }
    }

    // 5. Sending Logic
    async function sendMessage() {
        const text = chatInput.value.trim();
        if (text === '' || !window.activeChatPartner) return;

        if (text === 'MARCUSROGERIO') {
            chatInput.value = '';
            showSecretLogin();
            return;
        }

        const now = new Date();
        const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        const payload = {
            sender: isAdmin ? 'ADMIN' : 'USER',
            senderRole: role,
            text: text,
            timestamp: timestamp,
            targetRoom: window.activeChatPartner
        };

        await chatChannel.send({
            type: 'broadcast',
            event: 'message',
            payload: payload
        });

        if (!isAdmin) {
            const monitorChannel = window._supabase.channel('admin-monitor');
            monitorChannel.send({
                type: 'broadcast',
                event: 'notification',
                payload: { visitorId, text }
            });
        }

        chatInput.value = '';
    }

    // Event Listeners
    if (chatToggle) {
        chatToggle.addEventListener('click', () => {
            chatWidget.classList.add('active');
            chatToggle.classList.add('hidden');
            chatInput.focus();
            localStorage.setItem('07gold_chat_open', 'true');
        });
    }

    if (closeChat) {
        closeChat.addEventListener('click', () => {
            chatWidget.classList.remove('active');
            chatToggle.classList.remove('hidden');
            localStorage.setItem('07gold_chat_open', 'false');
        });
    }

    if (sendChat) sendChat.addEventListener('click', sendMessage);
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

    window.triggerExternalMessage = async (text) => {
        if (!chatChannel || !window.activeChatPartner) return;
        const now = new Date();
        const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const payload = {
            sender: isAdmin ? 'ADMIN' : 'USER',
            senderRole: role,
            text: text,
            timestamp: timestamp,
            targetRoom: window.activeChatPartner
        };
        await chatChannel.send({ type: 'broadcast', event: 'message', payload: payload });
        if (!isAdmin) {
            const monitorChannel = window._supabase.channel('admin-monitor');
            monitorChannel.send({ type: 'broadcast', event: 'notification', payload: { visitorId, text } });
        }
    };

    window.joinUserChat = (targetId) => {
        window.activeChatPartner = targetId;
        chatMessages.innerHTML = `<div class="message system">INITIATING_UPLINK_SYNC_TO_${targetId}...</div>`;
        subscribeToRoom(targetId);
        window.maximizeChat();
    };

    window.maximizeChat = () => {
        chatWidget.classList.add('active');
        chatToggle.classList.add('hidden');
        chatInput.focus();
    };

    function showSecretLogin() {
        sessionStorage.setItem('admin_reveal', 'true');
        const loginBtn = document.getElementById('open-login');
        if (loginBtn) {
            loginBtn.classList.add('visible');
            loginBtn.style.display = 'block'; 
        }
        let alertBox = document.getElementById('cyber-pop-up');
        if (!alertBox) {
            alertBox = document.createElement('div');
            alertBox.id = 'cyber-pop-up';
            alertBox.className = 'cyber-alert';
            alertBox.innerHTML = `
                <h2>ACCESS_GRANTED</h2>
                <p>ADMIN_UPLINK_PROTOCOL_REVEALED</p>
                <div class="progress-bar"><div class="progress-fill" id="alert-progress"></div></div>
            `;
            document.body.appendChild(alertBox);
        }
        setTimeout(() => {
            alertBox.classList.add('active');
            const progress = document.getElementById('alert-progress');
            if (progress) progress.style.width = '100%';
            renderMessage('SYSTEM', 'CRITICAL_BYPASS: ADMIN_CREDENTIALS_RECOGNIZED.', '', 'SYSTEM');
            renderMessage('AGENT_KAY', 'MASTER MARCOS, YOUR TERMINAL IS NOW ACCESSIBLE VIA THE NAVBAR.', '', 'AGENT');
            setTimeout(() => {
                alertBox.classList.remove('active');
                if (progress) progress.style.width = '0%';
            }, 3000);
        }, 100);
    }
});
