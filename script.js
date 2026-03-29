document.addEventListener('DOMContentLoaded', () => {
    // Calculator Logic
    const goldInput = document.getElementById('gold-amount');
    const priceDisplay = document.getElementById('total-price');
    const buyBtn = document.getElementById('buy-btn');
    const sellBtn = document.getElementById('sell-btn');

    let currentMode = 'buy';
    
    // Default Rates
    let rates = { buy: 0.35, sell: 0.31 };

    async function loadGlobalRates() {
        // 1. Try fetching from Supabase (Persistent Global Rates)
        if (window._supabase) {
            try {
                const { data, error } = await window._supabase
                    .from('market_rates')
                    .select('buy_rate, sell_rate')
                    .eq('id', 1)
                    .single();
                
                if (data && !error) {
                    rates = { buy: data.buy_rate, sell: data.sell_rate };
                    localStorage.setItem('07gold_rates', JSON.stringify(rates));
                    updatePrice();
                    console.log("MARKET_INDEX_SYNCED_WITH_CLOUD");
                    return;
                }
            } catch (e) {
                console.warn("CLOUD_SYNC_FAILED, FALLING_BACK_TO_LOCAL");
            }
        }

        // 2. Fallback to localStorage or defaults
        const savedRates = JSON.parse(localStorage.getItem('07gold_rates'));
        if (savedRates) {
            rates = savedRates;
            updatePrice();
        }
    }

    function updatePrice() {
        if (!goldInput) return;
        const amount = parseFloat(goldInput.value) || 0;
        const rate = rates[currentMode];
        const total = parseFloat((amount * rate).toFixed(2));
        priceDisplay.textContent = total;
        
        // Update the "Market Index" card on the UI if it exists
        const bentoRateDisplay = document.querySelector('.price-card .rate');
        if (bentoRateDisplay) bentoRateDisplay.textContent = `$${parseFloat(rates.buy.toFixed(3))}`;
    }

    if (buyBtn && sellBtn) {
        buyBtn.addEventListener('click', () => {
            currentMode = 'buy';
            buyBtn.classList.add('active');
            sellBtn.classList.remove('active');
            updatePrice();
        });

        sellBtn.addEventListener('click', () => {
            currentMode = 'sell';
            sellBtn.classList.add('active');
            buyBtn.classList.remove('active');
            updatePrice();
        });
    }

    if (goldInput) {
        goldInput.addEventListener('input', updatePrice);
    }

    // Quick Select Logic
    const selectButtons = document.querySelectorAll('.select-btn');
    selectButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            goldInput.value = btn.dataset.amount;
            updatePrice();
        });
    });

    // Payment selection logic
    const paymentItems = document.querySelectorAll('.payment-item');
    const selectedPaymentInput = document.getElementById('selected-payment');

    paymentItems.forEach(item => {
        item.addEventListener('click', () => {
            paymentItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            if (selectedPaymentInput) {
                selectedPaymentInput.value = item.dataset.method;
            }
        });
    });

    // Get Started / Transfer Button Logic
    const getStartedBtn = document.querySelector('.primary-cta');

    if (getStartedBtn) {
        getStartedBtn.addEventListener('click', () => {
            const amount = goldInput.value;
            const price = priceDisplay.textContent;
            const type = currentMode.toUpperCase();
            const method = selectedPaymentInput ? selectedPaymentInput.value : 'UNDEFINED';
            
            if (window.maximizeChat) {
                window.maximizeChat();
                
                const chatMessages = document.getElementById('chat-messages');
                if (chatMessages) {
                    // 1. Add a system log
                    const sysDiv = document.createElement('div');
                    sysDiv.className = 'message system';
                    sysDiv.innerHTML = `<span class="msg-sender">SYSTEM:</span> ENCRYPTING_TRADE_DATA...`;
                    chatMessages.appendChild(sysDiv);

                    // 2. Format the message text
                    const msgText = `I WOULD LIKE TO ${type} ${amount}M GOLD FOR $${price} VIA ${method}.`;

                    // 3. Trigger the broadcast using the shared function in chat.js
                    // This function will both SEND the broadcast and RENDER the message locally.
                    if (window.triggerExternalMessage) {
                        window.triggerExternalMessage(msgText);
                    }
                }
            } else {
                alert(`UPLINK_OFFLINE: Please manually request ${type} ${amount}M via ${method}.`);
            }
        });
    }
    // Navbar Navigation Logic for BUY/SELL
    const navBuyLinks = document.querySelectorAll('a[href="#buy"], a[href="index.html#buy"]');
    const navSellLinks = document.querySelectorAll('a[href="#sell"], a[href="index.html#sell"]');
    const calculatorCard = document.querySelector('.calculator-card');

    function handleNavTrade(mode) {
        if (calculatorCard) {
            calculatorCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (mode === 'buy' && buyBtn) buyBtn.click();
            if (mode === 'sell' && sellBtn) sellBtn.click();
            if (goldInput) setTimeout(() => goldInput.focus(), 800);
        }
    }

    navBuyLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            if (window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/')) {
                e.preventDefault();
                handleNavTrade('buy');
            }
        });
    });

    navSellLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            if (window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/')) {
                e.preventDefault();
                handleNavTrade('sell');
            }
        });
    });

    // Check for hash on page load
    if (window.location.hash === '#buy') handleNavTrade('buy');
    if (window.location.hash === '#sell') handleNavTrade('sell');

    // Initial price and global sync
    loadGlobalRates();
    updatePrice();
});
