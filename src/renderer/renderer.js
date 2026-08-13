// renderer.js —— 所有页面的统一入口脚本
// 通过 <body data-page="..."> 识别当前页面并执行对应的初始化逻辑。
import { UI } from './js/general_ui.js';

/* ==================================================
 * index.html（登录 / 引导）
 * ================================================== */
function initIndex() {
    const date = new Date();
    const year = date.getFullYear(), month = date.getMonth() + 1, day = date.getDate();
    console.log(`今天是 ${year} 年, ${month} 月, ${day} 日`);

    const guideModal = document.getElementById('guide-modal');
    const loginCard = document.getElementById('login-card');
    const idonotknow = document.getElementById('yrj');

    const openFullscreen = () => {
        const elem = document.documentElement;
        elem.requestFullscreen();
    };

    const showLoginDirectly = () => {
        loginCard.style.display = 'block';
    };

    // --- 记住密码按钮 ---
    const rememberBtn = document.getElementById('remember-password-btn');
    if (localStorage.getItem('rememberedPassword')) {
        rememberBtn.innerHTML = '忘记密码';
    }
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

    // --- 愚人节彩蛋 ---
    document.getElementById('yrj-exit').onclick = () => {
        idonotknow.style.display = 'none';
        showLoginDirectly();
    };
    document.getElementById('yrj-clickme').onclick = async () => {
        await alert('你被骗了');
        openFullscreen();
        location.href = 'https://www.bilibili.com/video/BV1GJ411x7h7';
        openFullscreen();
    };

    // --- 工具函数 ---
    const getLoginServerConfig = () => {
        const ip = document.getElementById('server-ip').value.trim();
        const apiPort = (document.getElementById('server-api-port').value || '7001').trim();
        const tcpPort = (document.getElementById('server-tcp-port').value || '7002').trim();
        if (!ip) {
            throw new Error('请输入服务器 IP。');
        }
        return { ip, apiPort, tcpPort, apiBase: `http://${ip}:${apiPort}` };
    };

    const isSuccessfulResponse = (payload) => {
        if (payload === true) return true;
        if (typeof payload === 'string') return payload.toLowerCase().includes('true');
        return Boolean(payload);
    };

    const restoreLoginServerConfig = () => {
        const savedIp = localStorage.getItem('last_server_ip');
        const savedApiPort = localStorage.getItem('last_server_api_port');
        const savedTcpPort = localStorage.getItem('last_server_tcp_port');
        if (savedIp) document.getElementById('server-ip').value = savedIp;
        if (savedApiPort) document.getElementById('server-api-port').value = savedApiPort;
        if (savedTcpPort) document.getElementById('server-tcp-port').value = savedTcpPort;
    };

    const backToLoginStep1 = () => {
        document.getElementById('login-step-2').classList.remove('active');
        document.getElementById('login-step-1').classList.add('active');
    };

    const skipAndShowLogin = (mode = 'true') => {
        localStorage.setItem('TFUR_skip_guide', mode);
        guideModal.style.display = 'none';
        showLoginDirectly();
    };

    // --- 引导弹窗按钮（原内联 onclick）---
    document.getElementById('guide-skip-once').onclick = () => skipAndShowLogin('false');
    document.getElementById('guide-skip-forever').onclick = () => skipAndShowLogin();
    document.getElementById('guide-view-intro-btn').onclick = () => { location.href = 'welcome.html'; };
    document.getElementById('login-back-btn').onclick = backToLoginStep1;

    // --- 登录交互 ---
    document.getElementById('login-next-btn').onclick = async () => {
        try {
            const { ip, apiPort, tcpPort, apiBase } = getLoginServerConfig();
            localStorage.setItem('last_server_ip', ip);
            localStorage.setItem('last_server_api_port', apiPort);
            localStorage.setItem('last_server_tcp_port', tcpPort);
            document.getElementById('login-display-server').innerText = `${ip}:${apiPort}`;
            document.getElementById('login-step-1').classList.remove('active');
            document.getElementById('login-step-2').classList.add('active');
            const usrnameField = document.getElementById('username');
            if (localStorage.getItem('last_username')) {
                usrnameField.value = localStorage.getItem('last_username');
            }
            if (localStorage.getItem('rememberedPassword')) {
                document.getElementById('password').value = localStorage.getItem('rememberedPassword');
            }
        } catch (err) {
            await UI.uialert('参数缺失', err.message || '请输入服务器连接信息。');
        }
    };

    document.getElementById('login-btn').onclick = async () => {
        const username = document.getElementById('username').value.trim();
        let uid = null;
        const pass = document.getElementById('password').value;

        if (!username || !pass) {
            await UI.uialert('信息缺失', '请输入用户名和密码。');
            return;
        }

        UI.setBusy(true);
        UI.showLoading('正在与服务器通信...');

        try {
            const { apiBase } = getLoginServerConfig();

            if (isNaN(username)) {
                const userInfo = await window.electronAPI.authRequest({
                    type: 'getUID',
                    apiBase,
                    username
                });
                console.log('UserInfo:', userInfo);
                if (userInfo && (userInfo.data.uid || userInfo.data.uid === 0)) {
                    uid = userInfo.data.uid;
                } else {
                    throw new Error('该用户名不存在');
                }
            } else {
                uid = username;
            }

            const response = await window.electronAPI.authRequest({
                type: 'login',
                apiBase,
                username: uid,
                password: pass
            });

            if (response.success && isSuccessfulResponse(response.data)) {
                const serverinfo = await window.electronAPI.authRequest({
                    type: 'getInfo',
                    apiBase
                });
                UI.hideLoading();
                UI.setBusy(false);
                if (serverinfo.success) {
                    localStorage.setItem('last_username', uid);
                    location.href = 'chat.html';
                    return;
                }
                await UI.uialert('连接失败', '服务器已响应，但无法读取服务器信息。');
            } else {
                console.error('LOGIN' + response.data);
                await UI.uialert('登录失败', response.error || '账号或密码不正确。');
            }
        } catch (err) {
            await UI.uialert('错误', `无法发起通信请求或者其他错误。<br>详细信息：${err}`);
        }

        UI.hideLoading();
        UI.setBusy(false);
    };

    document.getElementById('go-reg-btn').onclick = () => {
        localStorage.setItem('TFUR_guide_read', true);
        location.href = 'reg.html';
    };

    // --- 引导 / 登录显示逻辑（原 window.onload）---
    const runOnLoad = async () => {
        document.getElementById('yrj-year').textContent = year;

        if (month == 4 && day == 1) {
            guideModal.style.display = 'none';
            loginCard.style.display = 'none';
            idonotknow.style.display = 'block';
        } else {
            UI.showLoading('正在加载配置...');
            let count = parseInt(localStorage.getItem('TFUR_use_count') || '0');
            const hasSkipped = localStorage.getItem('TFUR_skip_guide') === 'true';
            const readGuide = localStorage.getItem('TFUR_guide_read') === 'true';
            localStorage.setItem('TFUR_guide_read', 'false');
            count++;
            localStorage.setItem('TFUR_use_count', count);
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

    restoreLoginServerConfig();
    runOnLoad();
}

/* ==================================================
 * reg.html（注册 / 激活）
 * ================================================== */
function initReg() {
    const regServerIpInput = document.getElementById('reg-server-ip');
    const regApiPortInput = document.getElementById('reg-api-port');
    const regTcpPortInput = document.getElementById('reg-tcp-port');
    const loader = document.getElementById('reg-loader');
    const step1 = document.getElementById('reg-step-1');
    const step2 = document.getElementById('reg-step-2');
    const step3 = document.getElementById('reg-step-3');
    const emailInput = document.getElementById('reg-email');
    const captchaArea = document.getElementById('reg-captcha-area');
    const captchaCodeInput = document.getElementById('reg-captcha-code');
    const captchaImg = document.getElementById('reg-captcha-img');

    let serverConfig = null; // { captcha, email_activate }
    let captchaStamp = null;
    let activateUid = null;
    let currentUsername = '';

    const getRegServerConfig = () => {
        const ip = regServerIpInput.value.trim();
        const apiPort = (regApiPortInput.value || '7001').trim();
        const tcpPort = (regTcpPortInput.value || '24174').trim();
        if (!ip) {
            throw new Error('请输入服务器 IP。');
        }
        return { ip, apiPort, tcpPort, apiBase: `http://${ip}:${apiPort}` };
    };

    const isSuccessResponse = (data) => {
        if (typeof data === 'string') return data.toLowerCase().includes('true');
        return Boolean(data);
    };

    const getUidByUsername = async (apiBase, username) => {
        try {
            const resp = await window.electronAPI.authRequest({ type: 'getUID', apiBase, username });
            if (resp && resp.success && resp.data && resp.data.uid) {
                return resp.data.uid;
            }
        } catch (err) {
            console.error('UID 查询失败:', err);
        }
        return null;
    };

    const loadCaptcha = async (apiBase) => {
        try {
            const resp = await window.electronAPI.authRequest({ type: 'getCaptcha', apiBase });
            if (resp && resp.success && resp.data && resp.data.stamp && resp.data.pic) {
                captchaStamp = resp.data.stamp;
                captchaImg.src = `data:image/png;base64,${resp.data.pic}`;
                captchaCodeInput.value = '';
                return true;
            }
            captchaStamp = null;
            return false;
        } catch (err) {
            console.error('验证码加载失败:', err);
            captchaStamp = null;
            return false;
        }
    };

    captchaImg.onclick = async () => {
        await loadCaptcha(getRegServerConfig().apiBase);
    };

    // --- 顶部返回 / 底部返回登录（原内联 onclick）---
    document.getElementById('reg-return-login-btn').onclick = () => { location.href = 'index.html'; };
    const backToStep1 = () => {
        step2.classList.remove('active');
        step1.classList.add('active');
    };
    document.getElementById('reg-back-btn').onclick = backToStep1;

    // --- 恢复上次的服务器配置（原 window.onload）---
    const savedIp = localStorage.getItem('last_server_ip');
    const savedApiPort = localStorage.getItem('last_server_api_port');
    const savedTcpPort = localStorage.getItem('last_server_tcp_port');
    if (savedIp) regServerIpInput.value = savedIp;
    if (savedApiPort) regApiPortInput.value = savedApiPort;
    if (savedTcpPort) regTcpPortInput.value = savedTcpPort;

    document.getElementById('btn-check-server').onclick = async () => {
        const { ip, apiPort, apiBase } = getRegServerConfig();

        step1.classList.remove('active');
        loader.style.display = 'flex';

        document.getElementById('reg-display-server').innerText = `${ip}:${apiPort}`;

        try {
            UI.setBusy(true);
            const resp = await window.electronAPI.authRequest({
                type: 'getInfo',
                apiBase
            });

            if (!resp || !resp.success) {
                throw new Error((resp && resp.error) || '无法获取服务器信息');
            }

            serverConfig = {
                captcha: Boolean(resp.data && resp.data.captcha),
                email_activate: Boolean(resp.data && resp.data.email_activate)
            };

            if (serverConfig.email_activate) {
                emailInput.placeholder = '邮箱地址（用于激活账号，必填）';
            } else {
                emailInput.placeholder = '邮箱地址（选填）';
            }

            step2.classList.add('active');

            if (serverConfig.captcha) {
                captchaArea.style.display = 'block';
                const ok = await loadCaptcha(apiBase);
                if (!ok) {
                    await UI.uialert('提示', '验证码加载失败，请点击验证码图片重试。');
                }
            } else {
                captchaArea.style.display = 'none';
            }

            loader.style.display = 'none';
        } catch (err) {
            console.error(err.message);
            await UI.uialert('错误', `无法建立与服务器的通信，具体错误：${err.message}`);
            loader.style.display = 'none';
            step1.classList.add('active');
        } finally {
            UI.setBusy(false);
        }
    };

    document.getElementById('reg-submit-btn').onclick = async () => {
        const user = document.getElementById('reg-username').value.trim();
        const email = emailInput.value.trim();
        const pass = document.getElementById('reg-password').value;
        const confirm = document.getElementById('reg-confirm').value;

        if (user.length < 4 || !pass) {
            await UI.uialert('信息缺失', '请确保填写了用户名(须超过四位)和密码。');
            return;
        }
        if (pass !== confirm) {
            await UI.uialert('校验错误', '两次输入的密码不一致。');
            return;
        }

        if (serverConfig && serverConfig.email_activate) {
            if (!email) {
                await UI.uialert('信息缺失', '该服务器要求提供邮箱，用于激活账号。');
                return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                await UI.uialert('校验错误', '请输入正确的邮箱地址。');
                return;
            }
        }

        if (serverConfig && serverConfig.captcha) {
            if (!captchaStamp) {
                await UI.uialert('提示', '验证码尚未加载，请点击验证码图片重试。');
                return;
            }
            if (!captchaCodeInput.value.trim()) {
                await UI.uialert('信息缺失', '请输入图片中的验证码。');
                return;
            }
        }

        UI.setBusy(true);
        UI.showLoading('正在创建账户...');

        try {
            const { ip, apiPort, tcpPort, apiBase } = getRegServerConfig();
            localStorage.setItem('last_server_ip', ip);
            localStorage.setItem('last_server_api_port', apiPort);
            localStorage.setItem('last_server_tcp_port', tcpPort);

            const result = await window.electronAPI.authRequest({
                type: 'register',
                apiBase,
                username: user,
                password: pass,
                email: email || undefined,
                captcha_stamp: (serverConfig && serverConfig.captcha) ? captchaStamp : '',
                captcha_code: (serverConfig && serverConfig.captcha) ? captchaCodeInput.value.trim() : ''
            });

            UI.hideLoading();
            UI.setBusy(false);

            if (!result || !result.success) {
                throw new Error((result && result.error) || '通信异常');
            }

            if (!isSuccessResponse(result.data)) {
                if (serverConfig && serverConfig.captcha) {
                    await loadCaptcha(apiBase);
                }
                await UI.uialert('注册失败', result.data || '服务器拒绝了请求。');
                return;
            }

            if (serverConfig && serverConfig.email_activate) {
                currentUsername = user;
                activateUid = await getUidByUsername(apiBase, user);
                step2.classList.remove('active');
                step3.classList.add('active');
            } else {
                await UI.uialert('注册成功', '账户已就绪，快去登录吧！');
                location.href = 'index.html';
            }
        } catch (error) {
            UI.hideLoading();
            UI.setBusy(false);
            await UI.uialert('注册异常', `详细信息：${error.message}`);
        }
    };

    document.getElementById('reg-activate-btn').onclick = async () => {
        const codeText = document.getElementById('reg-activate-code').value.trim();
        const code = parseInt(codeText, 10);

        if (!codeText || isNaN(code)) {
            await UI.uialert('信息缺失', '请输入邮箱中收到的激活码。');
            return;
        }

        UI.setBusy(true);
        UI.showLoading('正在激活账号...');

        try {
            const { apiBase } = getRegServerConfig();

            if (!activateUid) {
                activateUid = await getUidByUsername(apiBase, currentUsername);
            }
            if (!activateUid) {
                throw new Error('无法获取账号信息，请稍后重试。');
            }

            const result = await window.electronAPI.authRequest({
                type: 'activate',
                apiBase,
                uid: activateUid,
                activateCode: code
            });

            UI.hideLoading();
            UI.setBusy(false);

            if (result && result.success && isSuccessResponse(result.data)) {
                await UI.uialert('激活成功', '账号已激活，快去登录吧！');
                location.href = 'index.html';
            } else {
                await UI.uialert('激活失败', (result && result.error) || '激活码错误或已失效，请核对后重试。');
            }
        } catch (error) {
            UI.hideLoading();
            UI.setBusy(false);
            await UI.uialert('激活异常', `详细信息：${error.message}`);
        }
    };
}

/* ==================================================
 * welcome.html（使用介绍）
 * ================================================== */
function initWelcome() {
    // 版权 / 致谢链接
    document.getElementById('TFUR1').onclick = async () => {
        await UI.aalert('https://github.com/pztsdy/touchfish_ui_remake');
    };
    document.getElementById('TFV5').onclick = async () => {
        await UI.aalert('https://github.com/2044-space-elevator/TouchFish');
    };

    // 加载磁贴图标
    const loadIcons = async () => {
        document.getElementById('icon-security').innerHTML = await UI.getIcon('shield_lock', 24, 'filled');
        document.getElementById('icon-globe-off').innerHTML = await UI.getIcon('globe_off', 24, 'filled');
        document.getElementById('icon-ui').innerHTML = await UI.getIcon('calendar_person', 24, 'filled');
        document.getElementById('icon-more').innerHTML = await UI.getIcon('grid', 24, 'filled');
    };

    const nextStep = (stepNum) => {
        document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
        document.getElementById('step-' + stepNum).classList.add('active');

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

    const finishWelcome = () => {
        localStorage.setItem('TFUR_guide_read', 'true');
        location.href = 'index.html';
    };

    // 分步按钮（原内联 onclick）
    document.getElementById('welcome-next-btn').onclick = () => nextStep(2);
    document.getElementById('welcome-prev-btn').onclick = () => nextStep(1);
    document.getElementById('welcome-finish-btn').onclick = finishWelcome;

    loadIcons();
}

/* ==================================================
 * chat.html（主界面骨架）
 * ================================================== */
async function initChat() {
    UI.uialert('注意', '本页面尚未完成，目前全部功能都无法使用'); // TODO: 发版删掉

    document.getElementById('nav-chat').innerHTML = await UI.getIcon('chat', 24, 'regular');
    document.getElementById('nav-contacts').innerHTML = await UI.getIcon('people', 24, 'regular');
    document.getElementById('nav-alert').innerHTML = await UI.getIcon('alert', 24, 'regular');
    document.getElementById('nav-forums').innerHTML = await UI.getIcon('chat_bubbles_question', 24, 'regular');
    document.getElementById('nav-info').innerHTML = await UI.getIcon('info', 24, 'regular');
    document.getElementById('nav-settings').innerHTML = await UI.getIcon('settings', 24, 'regular');
}

/* ==================================================
 * debug.html（UI 组件测试台）
 * ================================================== */
function initDebug() {
    const attit = document.getElementById('alerttit');
    const atext = document.getElementById('alerttext');

    document.getElementById('uialertbtn').onclick = async () => {
        UI.uialert(attit.value, atext.value);
    };
    document.getElementById('aalertbtn').onclick = async () => {
        UI.aalert(attit.value, atext.value);
    };
    document.getElementById('loadingbtn').onclick = async () => {
        UI.showLoading(atext.value);
        setTimeout(async () => {
            UI.hideLoading();
        }, document.getElementById('loadingTi').value * 1000);
    };
}

/* ==================================================
 * 页面分发
 * ================================================== */
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
