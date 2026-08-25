import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { TFCrypto } from './crypto.js';
import { AuthService } from './auth.js'
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

/** 主浏览器窗口 */
let mainWind = null;

/**
 * 按系统语言构建菜单模板
 * @returns {Electron.MenuItemConstructorOptions[]}
 */
function buildMenuTemplate() {
    const isZh = (app.getLocale() || '').toLowerCase().startsWith('zh');
    const L = isZh ? {
        program: '程序', minimize: '最小化', quit: '退出',
        edit: '编辑', undo: '撤销', redo: '重做',
        cut: '剪切', copy: '复制', paste: '粘贴', selectAll: '全选',
        view: '视图', fullscreen: '全屏', devTools: '开发者工具',
    } : {
        program: 'Program', minimize: 'Minimize', quit: 'Quit',
        edit: 'Edit', undo: 'Undo', redo: 'Redo',
        cut: 'Cut', copy: 'Copy', paste: 'Paste', selectAll: 'Select All',
        view: 'View', fullscreen: 'Toggle Full Screen', devTools: 'Developer Tools',
    };

    return [
        {
            label: L.program,
            submenu: [
                { role: 'minimize', label: L.minimize },
                { role: 'quit', label: L.quit }
            ]
        },
        {
            label: L.edit,
            submenu: [
                { role: 'undo', label: L.undo },
                { role: 'redo', label: L.redo },
                { type: 'separator' },
                { role: 'cut', label: L.cut },
                { role: 'copy', label: L.copy },
                { role: 'paste', label: L.paste },
                { role: 'selectAll', label: L.selectAll }
            ]
        },
        {
            label: L.view,
            submenu: [
                { role: 'togglefullscreen', label: L.fullscreen },
                { role: 'toggleDevTools', label: L.devTools }
            ]
        }
    ];
}

function createWindow() {
    const iconPath = path.join(__dirname, "../renderer/assets/images/TouchFishUR.ico");

    mainWind = new BrowserWindow({
        width: 1200,
        height: 800,
        autoHideMenuBar: false,
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
        },
        title: "TouchFish UI Remake 2",
        icon: iconPath,
    });

    mainWind.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'F5' || (input.shift && input.key === 'F5')) {
            event.preventDefault();
        }

        if ((input.control || input.meta) && input.key.toLowerCase() === 'r') {
            event.preventDefault();
        }

        if (input.key === 'F12') {
            // 是这样的，你还可以用 Ctrl+Shift+I 打开开发者工具
            event.preventDefault();
        }
    });

    mainWind.loadFile(path.join(__dirname, '../renderer/index.html'));

    return mainWind;
}

app.whenReady().then(async () => {
    createWindow();

    const menu = Menu.buildFromTemplate(buildMenuTemplate());
    Menu.setApplicationMenu(menu);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

/*
==================================================
ipcMain 函数
==================================================
*/

ipcMain.handle('auth-request', async (event, payload) => {
    const { type, apiBase, username, password, email, hash, captcha_stamp, captcha_code, uid, activateCode } = payload;

    try {
        let result;
        if (type === 'login') {
            result = await AuthService.login(apiBase, hash, username, password);
        } else if (type === 'register') {
            result = await AuthService.register(apiBase, hash, { username, password, email, captcha_stamp, captcha_code });
        } else if (type === 'getInfo') {
            result = await AuthService.getServerInfo(apiBase);
        } else if (type === 'getUID') {
            result = await AuthService.getUserInfoByUsername(apiBase, username);
        } else if (type === 'getCaptcha') {
            result = await AuthService.getCaptcha(apiBase);
        } else if (type === 'activate') {
            result = await AuthService.activateAccount(apiBase, hash, uid, activateCode);
        }
        return { success: true, data: result };
    } catch (error) {
        console.error("Auth Error:", error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('crypto-service', async (event, payload) => {
    const { type, data } = payload;

    try {
        let result;
        if (type === 'encrypt') {
            const { rsaPublicKey } = data;
            result = TFCrypto.encryptRequest(data, rsaPublicKey);
        } else if (type === 'decrypt') {
            const { rsaPrivateKey } = data;
            result = TFCrypto.decryptResponse(data, rsaPrivateKey);
        }
        return { success: true, data: result };
    } catch (error) {
        console.error("Crypto Error:", error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('select-file', async () => {
    const parentWindow = BrowserWindow.getFocusedWindow() || mainWind;

    const result = await dialog.showOpenDialog(parentWindow, {
        properties: ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }

    return result.filePaths[0];
});

ipcMain.handle('get-app-ver', async (event) => {
    return app.getVersion();
})

ipcMain.handle('verify-public-key', async (event, payload) => {
    const { pemKey, expectedHash } = payload;
    try {
        const isValid = TFCrypto.verifyPublicKey(pemKey, expectedHash);
        return { success: true, isValid };
    } catch (error) {
        console.error("Verify Public Key Error:", error);
        return { success: false, error: error.message };
    }
});
