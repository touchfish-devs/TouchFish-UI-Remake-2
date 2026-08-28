// renderer.js
import { UI, escapeHtml } from './js/general_ui.js';
import { initI18n, t, onLocaleChange, createLangSwitcher } from './i18n.js';

/** 服务器配置键名映射 */
const SERVER_KEYS = {
    ip: 'last_server_ip',
    apiPort: 'last_server_api_port',
    tcpPort: 'last_server_tcp_port',
};

/** 默认端口配置 */
const DEFAULT_PORTS = {
    api: '7001',
    tcp: '7002',
    tcpReg: '24174',
};

/**
 * 获取当前 APP 版本
 * @returns {string} version - 版本
 */
async function getAppVer() {
    try {
        return await window.electronAPI.getAppVer();

    } catch (err) {
        console.error(`获取版本错误: ${err}`);
    }
    return null;
}

/**
 * 从 localStorage 恢复服务器配置到指定输入框
 * @param {{ ip: HTMLElement, apiPort: HTMLElement, tcpPort: HTMLElement }} inputs - 输入框 ID
 */
function restoreServerConfig(inputs) {
    const saved = {
        ip: localStorage.getItem(SERVER_KEYS.ip),
        apiPort: localStorage.getItem(SERVER_KEYS.apiPort),
        tcpPort: localStorage.getItem(SERVER_KEYS.tcpPort),
    };
    if (saved.ip && inputs.ip) inputs.ip.value = saved.ip;
    if (saved.apiPort && inputs.apiPort) inputs.apiPort.value = saved.apiPort;
    if (saved.tcpPort && inputs.tcpPort) inputs.tcpPort.value = saved.tcpPort;
}

/**
 * 保存服务器配置到 localStorage
 * @param {{ ip: string, apiPort: string, tcpPort: string }} serverConfig - 连接参数
 */
function saveServerConfig(ip, apiPort, tcpPort) {
    localStorage.setItem(SERVER_KEYS.ip, ip);
    localStorage.setItem(SERVER_KEYS.apiPort, apiPort);
    localStorage.setItem(SERVER_KEYS.tcpPort, tcpPort);
}

/**
 * 从输入框读取并校验服务器配置
 * @param {Object} inputs - { ip: HTMLElement, apiPort: HTMLElement, tcpPort: HTMLElement }
 * @param {string} defaultTcpPort - TCP 默认端口
 * @returns {{ ip: string, apiPort: string, tcpPort: string, apiBase: string }}
 */
function getServerConfig(inputs, defaultTcpPort = DEFAULT_PORTS.tcp) {
    const ip = inputs.ip?.value?.trim();
    const apiPort = (inputs.apiPort?.value || DEFAULT_PORTS.api).trim();
    const tcpPort = (inputs.tcpPort?.value || defaultTcpPort).trim();

    if (!ip) throw new Error(t('server.ipRequired'));

    return { ip, apiPort, tcpPort, apiBase: `http://${ip}:${apiPort}` };
}

/**
 * 判断服务端响应是否成功
 * @param {string} data - 服务端响应数据
 * @returns {Boolean} 是否成功
 */
function isSuccessResponse(data) {
    if (data === true) return true;
    if (typeof data === 'string') return data.toLowerCase().includes('true');
    return Boolean(data);
}

/**
 * IPC authRequest，自动处理 loading / busy / 错误弹窗
 * @param {Object} params - 传给 electronAPI.authRequest 的参数
 * @param {Object} [options] - { showLoading: string, suppressError: boolean }
 * @returns {Promise<Object>} 原始响应对象
 */
async function safeAuthRequest(params, options = {}) {
    const { showLoading, suppressError = false } = options;

    try {
        UI.setBusy(true);
        if (showLoading) UI.showLoading(showLoading);

        const response = await window.electronAPI.authRequest(params);

        if (!suppressError && (!response || !response.success)) {
            throw new Error(response?.error || t('error.comm'));
        }

        return response;
    } catch (err) {
        if (!suppressError) {
            await UI.uialert(t('common.error'), t('error.commFailed', {
                detail: escapeHtml(err.message || err),
            }));
        }
        throw err;
    } finally {
        UI.hideLoading();
        UI.setBusy(false);
    }
}

/**
 * 通过用户名获取 UID
 */
async function getUidByUsername(apiBase, username) {
    try {
        const resp = await window.electronAPI.authRequest({
            type: 'getUID', apiBase, username,
        });
        if (resp?.success && resp.data?.uid != null) return resp.data.uid;
    } catch (err) {
        console.error('UID 查询失败:', err);
    }
    return null;
}

/**
 * 绑定点击事件
 */
function bindClick(id, handler) {
    const el = document.getElementById(id);
    if (el) el.onclick = handler;
    else console.warn(`renderer.js: 未找到元素 #${id}`);
}

/**
 * index.html
 */
function initIndex() {
    const date = new Date();
    const year = date.getFullYear(), month = date.getMonth() + 1, day = date.getDate();
    console.log(`今天是 ${year} 年, ${month} 月, ${day} 日`);

    const guideModal = document.getElementById('guide-modal');
    const loginCard = document.getElementById('login-card');
    const idonotknow = document.getElementById('yrj');

    const serverInputs = {
        ip: document.getElementById('server-ip'),
        apiPort: document.getElementById('server-api-port'),
        tcpPort: document.getElementById('server-tcp-port'),
    };

    const openFullscreen = () => document.documentElement.requestFullscreen();
    const showLoginDirectly = () => { loginCard.style.display = 'block'; };

    // --- 引导弹窗正文（含动态使用次数）与愚人节彩蛋日期：随语言切换重渲染 ---
    let useCount = 0;
    const renderGuideBody = () => {
        const el = document.getElementById('guide-body');
        if (el) el.innerHTML = t('index.guide.intro', { count: useCount });
    };
    const renderYrjDate = () => {
        const el = document.getElementById('yrj-date');
        if (el) el.innerHTML = t('index.yrj.date', { year });
    };
    onLocaleChange(renderGuideBody);
    onLocaleChange(renderYrjDate);

    // --- 记住密码 ---
    const rememberBtn = document.getElementById('remember-password-btn');
    if (rememberBtn) {
        const renderRememberBtn = () => {
            rememberBtn.textContent = localStorage.getItem('rememberedPassword')
                ? t('login.forgotPassword')
                : t('login.rememberPassword');
        };
        renderRememberBtn();
        onLocaleChange(renderRememberBtn);

        rememberBtn.addEventListener('click', () => {
            if (localStorage.getItem('rememberedPassword')) {
                localStorage.removeItem('rememberedPassword');
            } else {
                localStorage.setItem('rememberedPassword', document.getElementById('password').value.trim());
                UI.uialert(t('common.notice'), t('login.passwordSaved'));
            }
            renderRememberBtn();
        });
    }

    // --- 愚人节彩蛋 ---
    bindClick('yrj-exit', () => { idonotknow.style.display = 'none'; showLoginDirectly(); });
    bindClick('yrj-clickme', async () => {
        await alert(t('index.yrj.tricked'));
        openFullscreen();
        location.href = 'https://www.bilibili.com/video/BV1GJ411x7h7';
        openFullscreen();
    });

    // --- 引导弹窗 ---
    const skipAndShowLogin = (mode = 'true') => {
        localStorage.setItem('TFUR_skip_guide', mode);
        guideModal.style.display = 'none';
        showLoginDirectly();
    };
    bindClick('guide-skip-once', () => skipAndShowLogin('false'));
    bindClick('guide-skip-forever', () => skipAndShowLogin());
    bindClick('guide-view-intro-btn', () => { location.href = 'welcome.html'; });
    bindClick('login-back-btn', () => {
        try {
            document.getElementById('login-step-2').classList.remove('active');
        } catch (err) {
            console.error(`Clsslist remove error: ${err}`);
        }
        document.getElementById('login-step-1').classList.add('active');
    });

    // --- 登录步骤切换 ---
    bindClick('login-next-btn', async () => {
        try {
            const { ip, apiPort, tcpPort } = getServerConfig(serverInputs);
            saveServerConfig(ip, apiPort, tcpPort);
            document.getElementById('login-display-server').innerText = `${ip}:${apiPort}`;
            document.getElementById('login-step-1').classList.remove('active');
            document.getElementById('login-step-2').classList.add('active');

            const usrField = document.getElementById('username');
            if (localStorage.getItem('last_username')) usrField.value = localStorage.getItem('last_username');
            if (localStorage.getItem('rememberedPassword')) {
                document.getElementById('password').value = localStorage.getItem('rememberedPassword');
            }
        } catch (err) {
            await UI.uialert(t('error.missingParams'), escapeHtml(err.message));
        }
    });

    // --- 登录提交 ---
    bindClick('login-btn', async () => {
        const username = document.getElementById('username').value.trim();
        const pass = document.getElementById('password').value;

        if (!username || !pass) {
            await UI.uialert(t('error.missingInfo'), t('login.missingCredentials'));
            return;
        }

        try {
            const { apiBase } = getServerConfig(serverInputs);
            let uid = username;

            if (isNaN(username)) {
                const userInfo = await safeAuthRequest(
                    { type: 'getUID', apiBase, username },
                    { showLoading: t('login.communicating'), suppressError: true }
                );
                if (userInfo?.data?.uid != null) {
                    uid = userInfo.data.uid;
                } else {
                    throw new Error(t('login.userNotFound'));
                }
            }

            const response = await safeAuthRequest(
                { type: 'login', apiBase, username: uid, password: pass },
                { showLoading: t('login.communicating'), suppressError: true }
            );

            if (response.success && isSuccessResponse(response.data)) {
                const serverinfo = await safeAuthRequest(
                    { type: 'getInfo', apiBase },
                    { suppressError: true }
                );
                if (serverinfo?.success) {
                    localStorage.setItem('last_username', uid);
                    location.href = 'chat.html';
                    return;
                }
                await UI.uialert(t('login.connectionFailed'), t('login.cannotReadInfo'));
            } else {
                console.error('LOGIN:', response.data);
                await UI.uialert(t('login.loginFailed'), escapeHtml(response.error) || t('login.wrongPassword'));
            }
        } catch (err) {
            await UI.uialert(t('common.error'), t('error.commFailed', {
                detail: escapeHtml(err.message || err),
            }));
        }
    });

    bindClick('go-reg-btn', () => {
        localStorage.setItem('TFUR_guide_read', true);
        location.href = 'reg.html';
    });

    // --- 初始化加载 ---
    const runOnLoad = async () => {
        if (month === 4 && day === 1) {
            renderYrjDate();
            guideModal.style.display = 'none';
            loginCard.style.display = 'none';
            idonotknow.style.display = 'block';
        } else {
            UI.showLoading(t('login.loadingConfig'));
            let count = parseInt(localStorage.getItem('TFUR_use_count') || '0', 10);
            const hasSkipped = localStorage.getItem('TFUR_skip_guide') === 'true';
            const readGuide = localStorage.getItem('TFUR_guide_read') === 'true';
            localStorage.setItem('TFUR_guide_read', 'false');
            count++;
            localStorage.setItem('TFUR_use_count', String(count));
            useCount = count;
            renderGuideBody();
            UI.hideLoading();

            if (count <= 1 && !readGuide) {
                await UI.uialert(t('login.firstUseTitle'), t('login.firstUseMsg'));
            }
            if (count > 5 || hasSkipped || readGuide) {
                showLoginDirectly();
            } else {
                guideModal.style.display = 'block';
            }
        }
    };

    restoreServerConfig(serverInputs);
    createLangSwitcher();
    runOnLoad();
}


/**
 * reg.html
 */
function initReg() {
    const serverInputs = {
        ip: document.getElementById('reg-server-ip'),
        apiPort: document.getElementById('reg-api-port'),
        tcpPort: document.getElementById('reg-tcp-port'),
    };
    const loader = document.getElementById('reg-loader');
    const step1 = document.getElementById('reg-step-1');
    const step2 = document.getElementById('reg-step-2');
    const step3 = document.getElementById('reg-step-3');
    const emailInput = document.getElementById('reg-email');
    const captchaArea = document.getElementById('reg-captcha-area');
    const captchaCodeInput = document.getElementById('reg-captcha-code');
    const captchaImg = document.getElementById('reg-captcha-img');

    let serverConfig = null;
    let captchaStamp = null;
    let activateUid = null;
    let currentUsername = '';

    // 邮箱占位符随服务器是否要求激活而变化，并随语言切换重渲染
    const renderEmailPlaceholder = () => {
        if (!emailInput) return;
        emailInput.placeholder = serverConfig?.email_activate
            ? t('reg.emailRequired')
            : t('reg.emailOptional');
    };
    onLocaleChange(renderEmailPlaceholder);

    const loadCaptcha = async (apiBase) => {
        try {
            const resp = await window.electronAPI.authRequest({ type: 'getCaptcha', apiBase });
            if (resp?.success && resp.data?.stamp && resp.data?.pic) {
                captchaStamp = resp.data.stamp;
                captchaImg.src = `data:image/png;base64,${resp.data.pic}`;
                captchaCodeInput.value = '';
                return true;
            }
        } catch (err) {
            console.error('验证码加载失败:', err);
        }
        captchaStamp = null;
        return false;
    };

    if (captchaImg) captchaImg.onclick = () => loadCaptcha(getServerConfig(serverInputs, DEFAULT_PORTS.tcpReg).apiBase);

    bindClick('reg-return-login-btn', () => { location.href = 'index.html'; });
    bindClick('reg-back-btn', () => {
        try {
            step2.classList.remove('active');
        } catch (err) {
            console.error(`Classlist remove error: ${err}`);
        }
        step1.classList.add('active');
    });

    // 恢复上次配置
    restoreServerConfig(serverInputs);

    // --- 检查服务器 ---
    bindClick('btn-check-server', async () => {
        const { ip, apiPort, apiBase } = getServerConfig(serverInputs, DEFAULT_PORTS.tcpReg);
        try {
            step1.classList.remove('active');
        } catch (err) {
            console.error(`Classlist remove error: ${err}`);
        }
        loader.style.display = 'flex';
        document.getElementById('reg-display-server').innerText = `${ip}:${apiPort}`;

        try {
            const resp = await safeAuthRequest({ type: 'getInfo', apiBase }, { suppressError: true });
            if (!resp?.success) throw new Error(resp?.error || t('error.comm'));

            serverConfig = {
                captcha: Boolean(resp.data?.captcha),
                email_activate: Boolean(resp.data?.email_activate),
            };
            renderEmailPlaceholder();

            step2.classList.add('active');
            if (serverConfig.captcha) {
                captchaArea.style.display = 'block';
                if (!(await loadCaptcha(apiBase))) {
                    await UI.uialert(t('common.notice'), t('reg.captchaFailed'));
                }
            } else {
                captchaArea.style.display = 'none';
            }
        } catch (err) {
            await UI.uialert(t('common.error'), t('error.serverCommLost', {
                detail: escapeHtml(err.message),
            }));
            step1.classList.add('active');
        } finally {
            loader.style.display = 'none';
        }
    });

    // --- 提交注册 ---
    bindClick('reg-submit-btn', async () => {
        const user = document.getElementById('reg-username').value.trim();
        const email = emailInput.value.trim();
        const pass = document.getElementById('reg-password').value;
        const confirm = document.getElementById('reg-confirm').value;

        if (user.length < 4 || !pass) { await UI.uialert(t('error.missingInfo'), t('reg.usernameMin')); return; }
        if (pass !== confirm) { await UI.uialert(t('error.validation'), t('reg.passwordMismatch')); return; }
        if (serverConfig?.email_activate && !email) { await UI.uialert(t('error.missingInfo'), t('reg.emailRequiredByServer')); return; }
        if (serverConfig?.email_activate && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { await UI.uialert(t('error.validation'), t('reg.emailInvalid')); return; }
        if (serverConfig?.captcha && !captchaStamp) { await UI.uialert(t('common.notice'), t('reg.captchaNotLoaded')); return; }
        if (serverConfig?.captcha && !captchaCodeInput.value.trim()) { await UI.uialert(t('error.missingInfo'), t('reg.captchaEmpty')); return; }

        try {
            const { ip, apiPort, tcpPort, apiBase } = getServerConfig(serverInputs, DEFAULT_PORTS.tcpReg);
            saveServerConfig(ip, apiPort, tcpPort);

            const result = await safeAuthRequest({
                type: 'register', apiBase, username: user, password: pass,
                email: email || undefined,
                captcha_stamp: serverConfig?.captcha ? captchaStamp : '',
                captcha_code: serverConfig?.captcha ? captchaCodeInput.value.trim() : '',
            }, { showLoading: t('reg.creating'), suppressError: true });

            if (!result?.success) throw new Error(result?.error || t('error.comm'));

            if (!isSuccessResponse(result.data)) {
                if (serverConfig?.captcha) await loadCaptcha(apiBase);
                await UI.uialert(t('reg.registerFailed'), escapeHtml(result.data) || t('reg.serverRejected'));
                return;
            }

            if (serverConfig?.email_activate) {
                currentUsername = user;
                activateUid = await getUidByUsername(apiBase, user);
                try {
                    step2.classList.remove('active');
                } catch (err) {
                    console.error(`Classlist remove error: ${err}`);
                }
                step3.classList.add('active');
            } else {
                await UI.uialert(t('reg.registerSuccess'), t('reg.readyToLogin'));
                location.href = 'index.html';
            }
        } catch (err) {
            await UI.uialert(t('reg.registerError'), t('error.detail', {
                detail: escapeHtml(err.message),
            }));
        }
    });

    // --- 激活账号 ---
    bindClick('reg-activate-btn', async () => {
        const codeText = document.getElementById('reg-activate-code').value.trim();
        const code = parseInt(codeText, 10);
        if (!codeText || isNaN(code)) { await UI.uialert(t('error.missingInfo'), t('reg.activateCodeRequired')); return; }

        try {
            const { apiBase } = getServerConfig(serverInputs, DEFAULT_PORTS.tcpReg);
            if (!activateUid) activateUid = await getUidByUsername(apiBase, currentUsername);
            if (!activateUid) throw new Error(t('reg.cannotGetUid'));

            const result = await safeAuthRequest({
                type: 'activate', apiBase, uid: activateUid, activateCode: code,
            }, { showLoading: t('reg.activating'), suppressError: true });

            if (result?.success && isSuccessResponse(result.data)) {
                await UI.uialert(t('reg.activateSuccess'), t('reg.activatedLogin'));
                location.href = 'index.html';
            } else {
                await UI.uialert(t('reg.activateFailed'), escapeHtml(result?.error) || t('reg.activateCodeInvalid'));
            }
        } catch (err) {
            await UI.uialert(t('reg.activateError'), t('error.detail', {
                detail: escapeHtml(err.message),
            }));
        }
    });

    createLangSwitcher();
}


/**
 * welcome.html
 */
function initWelcome() {
    const infoCard = document.getElementById('info-card');
    if (infoCard) {
        infoCard.addEventListener('click', (e) => {
            const link = e.target.closest('.welcome-link');
            if (!link) return;
            if (link.id === 'TFUR1') UI.aalert('https://github.com/pztsdy/touchfish_ui_remake');
            else if (link.id === 'TFV5') UI.aalert('https://github.com/2044-space-elevator/TouchFish');
        });
    }

    const loadIcons = async () => {
        const icons = [
            ['icon-security', 'shield_lock'],
            ['icon-globe-off', 'globe_off'],
            ['icon-ui', 'calendar_person'],
            ['icon-more', 'grid'],
        ];
        for (const [id, name] of icons) {
            const el = document.getElementById(id);
            if (el) el.innerHTML = await UI.getIcon(name, 24, 'filled');
        }
    };

    let welcomeStep = 1;
    const renderStepText = (stepNum) => {
        const title = document.getElementById('welcome-title');
        const subtitle = document.getElementById('welcome-subtitle');
        if (stepNum === 2) {
            title.innerText = t('welcome.titleAbout');
            subtitle.innerText = t('welcome.subtitleAbout');
        } else {
            title.innerText = t('welcome.title');
            subtitle.innerText = t('welcome.subtitle');
        }
    };
    const nextStep = async (stepNum) => {
        document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
        document.getElementById(`step-${stepNum}`).classList.add('active');
        welcomeStep = stepNum;
        renderStepText(stepNum);
        try { document.getElementById('nowVer').innerHTML = await window.electronAPI.getAppVer(); } catch (err) {
            console.warn(err);
        }
    };
    onLocaleChange(() => renderStepText(welcomeStep));

    bindClick('welcome-next-btn', () => nextStep(2));
    bindClick('welcome-prev-btn', () => nextStep(1));
    bindClick('welcome-finish-btn', () => {
        localStorage.setItem('TFUR_guide_read', 'true');
        location.href = 'index.html';
    });

    loadIcons();
    createLangSwitcher();
}

// chat.html

/**
 * chat.html 导航栏图标
 */
const NAV_ITEMS = [
    {
        id: 'nav-chat',
        icon: 'chat',
        sidebar: 'chat-sidebar'
    },
    {
        id: 'nav-contacts',
        icon: 'people',
        sidebar: 'contacts-sidebar'
    },
    {
        id: 'nav-alert',
        icon: 'alert',
        sidebar: 'alert-sidebar'
    },
    {
        id: 'nav-forums',
        icon: 'chat_bubbles_question',
        sidebar: 'forums-sidebar'
    },
    {
        id: 'nav-info',
        icon: 'info',
        sidebar: 'info-sidebar'
    },
];
/** 是否移除未选择那一行字 */
let masterBgRemoved = false;

/**
 * 关于侧栏列表
 */
const SIDEBAR_ABOUT = [
    'info-side-ver', 'info-side-license', 'info-side-credits',
];

/**
 * 切换导航栏激活状态
 * @param {string} activeId - 当前被点击的元素ID
 */
async function setActiveNav(activeId) {
    const updates = NAV_ITEMS.map(async (item) => {
        const el = document.getElementById(item.id);
        const sidebarEl = document.getElementById(item.sidebar);
        if (!el) return;

        const isActive = item.id === activeId;

        const style = isActive ? "filled" : "regular";
        el.innerHTML = await UI.getIcon(item.icon, 24, style);
        el.classList.toggle('active', isActive);
        sidebarEl.classList.toggle('active', isActive);
        sidebarEl.classList.toggle('unshown', !isActive);
        if (!masterBgRemoved) {
            masterBgRemoved = true;
            try {
                document.getElementById('background').classList.remove('active');
                document.getElementById('background').classList.add('unshown');
            } catch (err) { console.log('严肃移除未选择背景'); }
        }
    });

    await Promise.all(updates);
}

/**
 * 切换通用无图标栏激活状态
 * @param {string} activeId - 当前被点击的元素ID
 * @param {string []} allIds - 所有元素ID
 */
function setActiveSidebar(activeId, allIds) {
    const allSidebars = allIds;
    allSidebars.forEach((sidebar) => {
        const el = document.getElementById(sidebar);
        if (!el) return;
        const isActive = el.id === activeId;
        el.classList.toggle('active', isActive);
    });
}

/**
 * chat.html
 */
async function initChat() {
    // TODO: 发版前删除
    await UI.uialert(t('chat.notDoneTitle'), t('chat.notDoneMsg'));
    document.getElementById("nav-settings").innerHTML = await UI.getIcon("settings", 24);

    const initPromises = NAV_ITEMS.map(async (item) => {
        const el = document.getElementById(item.id);
        if (!el) return;
        el.innerHTML = await UI.getIcon(item.icon, 24, "regular");

        bindClick(item.id, () => setActiveNav(item.id));
    });

    // About Sidebar
    const aboutPromises = SIDEBAR_ABOUT.map(async (id) => {
        const el = document.getElementById(id);
        if (!el) return;

        bindClick(id, () => setActiveSidebar(id, SIDEBAR_ABOUT));
    });

    await Promise.all(initPromises);
    await Promise.all(aboutPromises);
    //createLangSwitcher();
}


/**
 * debug.html
 */
function initDebug() {
    const attit = document.getElementById('alerttit');
    const atext = document.getElementById('alerttext');

    bindClick('uialertbtn', () => UI.uialert(attit.value, atext.value));
    bindClick('aalertbtn', () => UI.aalert(attit.value, atext.value));
    bindClick('loadingbtn', () => {
        UI.showLoading(atext.value);
        setTimeout(() => UI.hideLoading(), document.getElementById('loadingTi').value * 1000);
    });
}


// ============================================================
// ============================================================
// 搜索我：滚动到底部

const pageInits = {
    index: initIndex,
    reg: initReg,
    welcome: initWelcome,
    chat: initChat,
    debug: initDebug,
};

const page = document.body.dataset.page;

await initI18n();

if (pageInits[page]) {
    pageInits[page]();
} else {
    console.warn(`renderer.js: 未识别的页面 data-page="${page}"`);
}

console.log(
    "%c%s%c%s%c%s%c%s%c%s",
    "color: #0078d7; font-size: 24px; font-style: italic;",
    `欢迎使用 `,
    "color: #0078d7; font-size: 14px; font-style: italic; font-family: \"Times New Roman\", \"Times\", serif;",
    `Welcome to \n`,
    "color: blue; font-weight: bold; font-size: 16px; font-family: Tahoma, \"Segoe UI\", sans-serif;",
    `TouchFish UI Remake 2\n`,
    "font-family: \"Fira Code\", \"Courier New\", monospace; color: #666;",
    `
▄▄▄▄▄▄·▄▄▄  ▄• ▄▌▪    ▄▄▄  ▄▄▄ .• ▌ ▄ ·.  ▄▄▄· ▄ •▄ ▄▄▄ .  22222
▀•██ ▀█  ·  █▪██▌██   ▀▄ █·▀▄.▀··██ ▐███▪▐█ ▀█ █▌▄▌▪▀▄.▀·       2
  ▐█.▪█▀▀▪  █▌▐█▌▐█·  ▐▀▀▄ ▐▀▀▪▄▐█ ▌▐▌▐█·▄█▀▀█ ▐▀▀▄·▐▀▀▪▄   2222
  ▐█▌·██ .  ▐█▄█▌▐█▌  ▐█•█▌▐█▄▄▌██ ██▌▐█▌▐█▪ ▐▌▐█.█▌▐█▄▄▌  2
  ▀▀▀ ▀▀▀    ▀▀▀ ▀▀▀  .▀  ▀ ▀▀▀ ▀▀  █▪▀▀▀ ▀  ▀ ·▀  ▀ ▀▀▀   222222  Now Version: ${await getAppVer() || 'unknown'}

GitHub: https://github.com/touchfish-devs/TouchFish-UI-Remake-2
TFV5S:  https://github.com/2044-space-elevator/TouchFishServer
TFV5C:  https://github.com/ilovescratch2/TouchFish-Client
JOIN US:`, "font-family: \"Fira Code\", \"Courier New\", monospace; color: #78e8bf;", `      QQ: 1056812860  TFV5C: 4 (Group ID)`
);
console.log(
    "%c%s%c%s%c%s%c%s%c%s%c%s",
    "font-size: 28px; background-color: red; color: white;", `好孩子`,
    "font-size: 28px; background-color: yellow; color: red; font-style: italic;", `不要`,
    "font-size: 28px; background-color: red; color: white;", `随便在这里粘贴东西哦~\n`,
    "font-size: 28px; background-color: yellow; color: red; font-style: italic;", `NEVER PASTE`,
    "font-size: 28px; background-color: red; color: white;", ` or your account will be `,
    "font-size: 28px; background-color: yellow; color: red;", `STOLEN!`
);