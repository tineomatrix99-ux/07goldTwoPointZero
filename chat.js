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
    const localHistory = [];

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
                // If I am the user and an admin asks for history, send it back
                if (!isAdmin && role === 'USER') {
                    chatChannel.send({
                        type: 'broadcast',
                        event: 'history_response',
                        payload: { history: localHistory }
                    });
                }
            })
            .on('broadcast', { event: 'history_response' }, (payload) => {
                // If I am the admin, receive the history
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
                    console.log(`UPLINK_ESTABLISHED: ${roomId}`);
                    // If Admin, request history immediately after sub
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

    // Initial subscription for users
    if (!isAdmin) {
        subscribeToRoom(visitorId);
        // Admin monitor presence
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
        // Save to local history if it's a new message
        if (saveToHistory) {
            localHistory.push({ sender, text, timestamp, senderRole });
            if (localHistory.length > 50) localHistory.shift(); // Keep last 50
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
        });
    }

    if (closeChat) {
        closeChat.addEventListener('click', () => {
            chatWidget.classList.remove('active');
            chatToggle.classList.remove('hidden');
        });
    }

    if (sendChat) sendChat.addEventListener('click', sendMessage);
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

    // Expose for External Scripts (like script.js)
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
    };

    // Expose for Admin Terminal
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
});
