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

    const template = [
        {
            label: '程序',
            submenu: [
                { role: 'minimize', label: '最小化' },
                { role: 'quit', label: '退出' }
            ]
        },
        {
            label: '编辑',
            submenu: [
                { role: 'undo', label: '撤销' },
                { role: 'redo', label: '重做' },
                { type: 'separator' },
                { role: 'cut', label: '剪切' },
                { role: 'copy', label: '复制' },
                { role: 'paste', label: '粘贴' },
                { role: 'selectAll', label: '全选' }
            ]
        },
        {
            label: '视图',
            submenu: [
                { role: 'togglefullscreen', label: '全屏' },
                { role: 'toggleDevTools', label: '开发者工具' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
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

ipcMain.handle('get-app-ver', async(event) => {
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
