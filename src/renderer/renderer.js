// renderer.js
import { UI } from './js/general_ui.js';

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
 * 从 localStorage 恢复服务器配置到指定输入框
 * @param {Object} inputs - { ip: HTMLElement, apiPort: HTMLElement, tcpPort: HTMLElement }
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
 */
function saveServerConfig(ip, apiPort, tcpPort) {
    localStorage.setItem(SERVER_KEYS.ip, ip);
    localStorage.setItem(SERVER_KEYS.apiPort, apiPort);
    localStorage.setItem(SERVER_KEYS.tcpPort, tcpPort);
}

/**
 * 从输入框读取并校验服务器配置
 * @param {Object} inputs - { ip: HTMLElement, apiPort: HTMLElement, tcpPort: HTMLElement }
 * @param {string} defaultTcpPort - TCP 默认端口（登录和注册不同）
 * @returns {{ ip: string, apiPort: string, tcpPort: string, apiBase: string }}
 */
function getServerConfig(inputs, defaultTcpPort = DEFAULT_PORTS.tcp) {
    const ip = inputs.ip?.value?.trim();
    const apiPort = (inputs.apiPort?.value || DEFAULT_PORTS.api).trim();
    const tcpPort = (inputs.tcpPort?.value || defaultTcpPort).trim();

    if (!ip) throw new Error('请输入服务器 IP。');

    return { ip, apiPort, tcpPort, apiBase: `http://${ip}:${apiPort}` };
}

/**
 * 判断服务端响应是否成功
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
            throw new Error(response?.error || '通信异常');
        }

        return response;
    } catch (err) {
        if (!suppressError) {
            await UI.uialert('错误', `无法发起通信请求或者其他错误。<br>详细信息：${err.message || err}`);
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

/* ============================================================
 *  index.html
 * ============================================================ */
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

    // --- 记住密码 ---
    const rememberBtn = document.getElementById('remember-password-btn');
    if (rememberBtn) {
        if (localStorage.getItem('rememberedPassword')) rememberBtn.innerHTML = '忘记密码';
        rememberBtn.addEventListener('click', () => {
            if (rememberBtn.innerHTML === '记住密码') {
                localStorage.setItem('rememberedPassword', document.getElementById('password').value.trim());
                UI.uialert('提示', '密码已保存，下次登录将自动填充。');
                rememberBtn.innerHTML = '忘记密码';
            } else {
                localStorage.removeItem('rememberedPassword');
                rememberBtn.innerHTML = '记住密码';
            }
        });
    }

    // --- 愚人节彩蛋 ---
    bindClick('yrj-exit', () => { idonotknow.style.display = 'none'; showLoginDirectly(); });
    bindClick('yrj-clickme', async () => {
        await alert('你被骗了');
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
        document.getElementById('login-step-2').classList.remove('active');
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
            await UI.uialert('参数缺失', err.message);
        }
    });

    // --- 登录提交 ---
    bindClick('login-btn', async () => {
        const username = document.getElementById('username').value.trim();
        const pass = document.getElementById('password').value;

        if (!username || !pass) {
            await UI.uialert('信息缺失', '请输入用户名和密码。');
            return;
        }

        try {
            const { apiBase } = getServerConfig(serverInputs);
            let uid = username;

            if (isNaN(username)) {
                const userInfo = await safeAuthRequest(
                    { type: 'getUID', apiBase, username },
                    { showLoading: '正在与服务器通信...', suppressError: true }
                );
                if (userInfo?.data?.uid != null) {
                    uid = userInfo.data.uid;
                } else {
                    throw new Error('该用户名不存在');
                }
            }

            const response = await safeAuthRequest(
                { type: 'login', apiBase, username: uid, password: pass },
                { showLoading: '正在与服务器通信...', suppressError: true }
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
                await UI.uialert('连接失败', '服务器已响应，但无法读取服务器信息。');
            } else {
                console.error('LOGIN:', response.data);
                await UI.uialert('登录失败', response.error || '账号或密码不正确。');
            }
        } catch (err) {
            await UI.uialert('错误', `无法发起通信请求或者其他错误。<br>详细信息：${err}`);
        }
    });

    bindClick('go-reg-btn', () => {
        localStorage.setItem('TFUR_guide_read', true);
        location.href = 'reg.html';
    });

    // --- 初始化加载 ---
    const runOnLoad = async () => {
        document.getElementById('yrj-year').textContent = year;

        if (month === 4 && day === 1) {
            guideModal.style.display = 'none';
            loginCard.style.display = 'none';
            idonotknow.style.display = 'block';
        } else {
            UI.showLoading('正在加载配置...');
            let count = parseInt(localStorage.getItem('TFUR_use_count') || '0', 10);
            const hasSkipped = localStorage.getItem('TFUR_skip_guide') === 'true';
            const readGuide = localStorage.getItem('TFUR_guide_read') === 'true';
            localStorage.setItem('TFUR_guide_read', 'false');
            count++;
            localStorage.setItem('TFUR_use_count', String(count));
            document.getElementById('use-count').innerText = count;
            UI.hideLoading();

            if (count <= 1 && !readGuide) {
                await UI.uialert('感谢您使用 TouchFish UI Remake 2', '稍后你可以查看使用方法，了解 TouchFish v5 的全新特性。');
            }
            if (count > 5 || hasSkipped || readGuide) {
                showLoginDirectly();
            } else {
                guideModal.style.display = 'block';
            }
        }
    };

    restoreServerConfig(serverInputs);
    runOnLoad();
}


/* ============================================================
 *  reg.html
 * ============================================================ */
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
        step2.classList.remove('active');
        step1.classList.add('active');
    });

    // 恢复上次配置
    restoreServerConfig(serverInputs);

    // --- 检查服务器 ---
    bindClick('btn-check-server', async () => {
        const { ip, apiPort, apiBase } = getServerConfig(serverInputs, DEFAULT_PORTS.tcpReg);
        step1.classList.remove('active');
        loader.style.display = 'flex';
        document.getElementById('reg-display-server').innerText = `${ip}:${apiPort}`;

        try {
            const resp = await safeAuthRequest({ type: 'getInfo', apiBase }, { suppressError: true });
            if (!resp?.success) throw new Error(resp?.error || '无法获取服务器信息');

            serverConfig = {
                captcha: Boolean(resp.data?.captcha),
                email_activate: Boolean(resp.data?.email_activate),
            };
            emailInput.placeholder = serverConfig.email_activate
                ? '邮箱地址（用于激活账号，必填）'
                : '邮箱地址（选填）';

            step2.classList.add('active');
            if (serverConfig.captcha) {
                captchaArea.style.display = 'block';
                if (!(await loadCaptcha(apiBase))) {
                    await UI.uialert('提示', '验证码加载失败，请点击验证码图片重试。');
                }
            } else {
                captchaArea.style.display = 'none';
            }
        } catch (err) {
            await UI.uialert('错误', `无法建立与服务器的通信，具体错误：${err.message}`);
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

        if (user.length < 4 || !pass) { await UI.uialert('信息缺失', '请确保填写了用户名(须超过四位)和密码。'); return; }
        if (pass !== confirm) { await UI.uialert('校验错误', '两次输入的密码不一致。'); return; }
        if (serverConfig?.email_activate && !email) { await UI.uialert('信息缺失', '该服务器要求提供邮箱，用于激活账号。'); return; }
        if (serverConfig?.email_activate && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { await UI.uialert('校验错误', '请输入正确的邮箱地址。'); return; }
        if (serverConfig?.captcha && !captchaStamp) { await UI.uialert('提示', '验证码尚未加载，请点击验证码图片重试。'); return; }
        if (serverConfig?.captcha && !captchaCodeInput.value.trim()) { await UI.uialert('信息缺失', '请输入图片中的验证码。'); return; }

        try {
            const { ip, apiPort, tcpPort, apiBase } = getServerConfig(serverInputs, DEFAULT_PORTS.tcpReg);
            saveServerConfig(ip, apiPort, tcpPort);

            const result = await safeAuthRequest({
                type: 'register', apiBase, username: user, password: pass,
                email: email || undefined,
                captcha_stamp: serverConfig?.captcha ? captchaStamp : '',
                captcha_code: serverConfig?.captcha ? captchaCodeInput.value.trim() : '',
            }, { showLoading: '正在创建账户...', suppressError: true });

            if (!result?.success) throw new Error(result?.error || '通信异常');

            if (!isSuccessResponse(result.data)) {
                if (serverConfig?.captcha) await loadCaptcha(apiBase);
                await UI.uialert('注册失败', result.data || '服务器拒绝了请求。');
                return;
            }

            if (serverConfig?.email_activate) {
                currentUsername = user;
                activateUid = await getUidByUsername(apiBase, user);
                step2.classList.remove('active');
                step3.classList.add('active');
            } else {
                await UI.uialert('注册成功', '账户已就绪，快去登录吧！');
                location.href = 'index.html';
            }
        } catch (err) {
            await UI.uialert('注册异常', `详细信息：${err.message}`);
        }
    });

    // --- 激活账号 ---
    bindClick('reg-activate-btn', async () => {
        const codeText = document.getElementById('reg-activate-code').value.trim();
        const code = parseInt(codeText, 10);
        if (!codeText || isNaN(code)) { await UI.uialert('信息缺失', '请输入邮箱中收到的激活码。'); return; }

        try {
            const { apiBase } = getServerConfig(serverInputs, DEFAULT_PORTS.tcpReg);
            if (!activateUid) activateUid = await getUidByUsername(apiBase, currentUsername);
            if (!activateUid) throw new Error('无法获取账号信息，请稍后重试。');

            const result = await safeAuthRequest({
                type: 'activate', apiBase, uid: activateUid, activateCode: code,
            }, { showLoading: '正在激活账号...', suppressError: true });

            if (result?.success && isSuccessResponse(result.data)) {
                await UI.uialert('激活成功', '账号已激活，快去登录吧！');
                location.href = 'index.html';
            } else {
                await UI.uialert('激活失败', result?.error || '激活码错误或已失效，请核对后重试。');
            }
        } catch (err) {
            await UI.uialert('激活异常', `详细信息：${err.message}`);
        }
    });
}


/* ============================================================
 *  welcome.html
 * ============================================================ */
function initWelcome() {
    bindClick('TFUR1', () => UI.aalert('https://github.com/pztsdy/touchfish_ui_remake'));
    bindClick('TFV5', () => UI.aalert('https://github.com/2044-space-elevator/TouchFish'));

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

    const nextStep = (stepNum) => {
        document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
        document.getElementById(`step-${stepNum}`).classList.add('active');
        const title = document.getElementById('welcome-title');
        const subtitle = document.getElementById('welcome-subtitle');
        if (stepNum === 2) {
            title.innerText = '关于 TouchFish';
            subtitle.innerText = '了解更多...';
        } else {
            title.innerText = '开始摸鱼';
            subtitle.innerText = '了解 TouchFish v5 与 TouchFish UI Remake 2 的全新特性';
        }
    };

    bindClick('welcome-next-btn', () => nextStep(2));
    bindClick('welcome-prev-btn', () => nextStep(1));
    bindClick('welcome-finish-btn', () => {
        localStorage.setItem('TFUR_guide_read', 'true');
        location.href = 'index.html';
    });

    loadIcons();
}


/* ============================================================
 *  chat.html
 * ============================================================ */
const NAV_ITEMS = [
    { id: 'nav-chat', icon: 'chat' },
    { id: 'nav-contacts', icon: 'people' },
    { id: 'nav-alert', icon: 'alert' },
    { id: 'nav-forums', icon: 'chat_bubbles_question' },
    { id: 'nav-info', icon: 'info' },
    { id: 'nav-settings', icon: 'settings' },
];

/**
 * 切换导航栏激活状态
 * @param {string} activeId - 当前被点击的元素ID
 */
async function setActiveNav(activeId) {
    const updates = NAV_ITEMS.map(async (item) => {
        const el = document.getElementById(item.id);
        if (!el) return;

        const isActive = item.id === activeId;

        const style = isActive ? "filled" : "regular";
        el.innerHTML = await UI.getIcon(item.icon, 24, style);
        el.classList.toggle('active', isActive);
    });

    await Promise.all(updates);
}

async function initChat() {
    // TODO: 发版前删除
    await UI.uialert('注意', '本页面尚未完成，目前全部功能都无法使用');

    const initPromises = NAV_ITEMS.map(async (item) => {
        const el = document.getElementById(item.id);
        if (!el) return;
        el.innerHTML = await UI.getIcon(item.icon, 24, "regular");

        bindClick(item.id, () => setActiveNav(item.id));
    });

    await Promise.all(initPromises);
}


/* ============================================================
 *  debug.html
 * ============================================================ */
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

if (pageInits[page]) {
    pageInits[page]();
} else {
    console.warn(`renderer.js: 未识别的页面 data-page="${page}"`);
}
