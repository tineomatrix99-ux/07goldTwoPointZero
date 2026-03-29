// Initialize Supabase Globals
const SUPABASE_URL = 'https://qrfnnulhpbujrijuybnl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_tDOul2OgFCLYYLa1jq54Mg_-uLId5ud';

// Attach to window so other scripts (chat.js, admin.html) can always find it
window._supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: window.sessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

document.addEventListener('DOMContentLoaded', async () => {
    const loginBtn = document.getElementById('open-login');
    const terminal = document.getElementById('auth-terminal');
    const statusBar = document.getElementById('auth-status-bar');
    
    const stepLogin = document.getElementById('auth-step-login');
    const stepMfa = document.getElementById('auth-step-mfa');
    const stepSetup = document.getElementById('auth-step-setup');

    const loginSubmit = document.getElementById('auth-login-submit');
    const mfaSubmit = document.getElementById('auth-mfa-submit');
    const setupSubmit = document.getElementById('auth-setup-submit');

    // Check for existing session
    const { data: { session } } = await window._supabase.auth.getSession();
    
    // PERSISTENCE: Show login button if session exists or secret was revealed in this tab
    if (session || sessionStorage.getItem('admin_reveal') === 'true') {
        if (loginBtn) {
            loginBtn.style.display = 'block';
            loginBtn.classList.add('visible');
            if (session) {
                loginBtn.textContent = 'DASHBOARD';
            }
        }
    }

    if (loginBtn) {
        loginBtn.onclick = () => {
            if (session) {
                window.location.href = 'admin.html';
            } else {
                terminal.style.display = 'flex';
                showStep('login');
                if(statusBar) statusBar.textContent = "STATUS: AWAITING_IDENTIFIER...";
            }
        };
    }

    if (loginSubmit) {
        loginSubmit.onclick = async () => {
            const email = document.getElementById('auth-email').value;
            const password = document.getElementById('auth-password').value;
            if(statusBar) statusBar.textContent = "STATUS: INITIATING_HANDSHAKE...";
            
            const { data, error } = await window._supabase.auth.signInWithPassword({ email, password });
            if (error) {
                if(statusBar) {
                    statusBar.textContent = "STATUS: ACCESS_DENIED // " + error.message.toUpperCase();
                    statusBar.style.color = "var(--cyber-magenta)";
                }
                return;
            }
            checkMFA();
        };
    }

    async function checkMFA() {
        const { data: factors } = await window._supabase.auth.mfa.listFactors();
        const totpFactor = factors.all.find(f => f.factor_type === 'totp' && f.status === 'verified');

        if (!totpFactor) {
            showStep('setup');
            startMFAEnrollment();
        } else {
            showStep('mfa');
            if(statusBar) statusBar.textContent = "STATUS: MFA_CHALLENGE_READY";
        }
    }

    if (mfaSubmit) {
        mfaSubmit.onclick = async () => {
            const code = document.getElementById('auth-mfa-code').value;
            const { data: factors } = await window._supabase.auth.mfa.listFactors();
            const totpFactor = factors.all.find(f => f.factor_type === 'totp' && f.status === 'verified');

            if(statusBar) statusBar.textContent = "STATUS: VERIFYING_TOKEN...";

            const { data: challengeData } = await window._supabase.auth.mfa.challenge({ factorId: totpFactor.id });
            const { error: verifyError } = await window._supabase.auth.mfa.verify({
                factorId: totpFactor.id,
                challengeId: challengeData.id,
                code: code
            });

            if (verifyError) {
                if(statusBar) {
                    statusBar.textContent = "STATUS: TOKEN_INVALID";
                    statusBar.style.color = "var(--cyber-magenta)";
                }
            } else {
                if(statusBar) statusBar.textContent = "STATUS: UPLINK_ESTABLISHED // REDIRECTING...";
                setTimeout(() => window.location.href = 'admin.html', 1000);
            }
        };
    }

    async function startMFAEnrollment() {
        if(statusBar) statusBar.textContent = "STATUS: GENERATING_NEW_MFA_FACTOR...";
        const { data, error } = await window._supabase.auth.mfa.enroll({
            factorType: 'totp',
            issuer: '07GOLD',
            friendlyName: 'Admin'
        });
        if (error) return alert(error.message);

        const qrCont = document.getElementById('terminal-qr-container');
        const secText = document.getElementById('terminal-secret-text');
        if(qrCont) qrCont.innerHTML = data.totp.qr_code;
        if(secText) secText.value = data.totp.secret;
        if(statusBar) statusBar.textContent = "STATUS: MFA_SETUP_READY // SCAN_QR_OR_INPUT_SECRET";
        
        window._currentFactorId = data.id;
    }

    if (setupSubmit) {
        setupSubmit.onclick = async () => {
            const code = document.getElementById('terminal-setup-code').value;
            const { data: challengeData } = await window._supabase.auth.mfa.challenge({ factorId: window._currentFactorId });
            const { error: verifyError } = await window._supabase.auth.mfa.verify({
                factorId: window._currentFactorId,
                challengeId: challengeData.id,
                code: code
            });

            if (verifyError) {
                if(statusBar) statusBar.textContent = "STATUS: SETUP_TOKEN_INVALID";
            } else window.location.href = 'admin.html';
        };
    }

    function showStep(step) {
        if(stepLogin) stepLogin.style.display = step === 'login' ? 'block' : 'none';
        if(stepMfa) stepMfa.style.display = step === 'mfa' ? 'block' : 'none';
        if(stepSetup) stepSetup.style.display = step === 'setup' ? 'block' : 'none';
    }
});

function closeAuthTerminal() {
    const term = document.getElementById('auth-terminal');
    if(term) term.style.display = 'none';
}

async function handleLogout() {
    await window._supabase.auth.signOut();
    window.location.href = 'index.html';
}
