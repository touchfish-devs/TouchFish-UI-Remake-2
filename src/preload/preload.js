const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    authRequest: (payload) => ipcRenderer.invoke('auth-request', payload),
    selectFile: () => ipcRenderer.invoke('select-file'),
    cryptoService: (payload) => ipcRenderer.invoke('crypto-service', payload),
    verifyPublicKey: (payload) => ipcRenderer.invoke('verify-public-key', payload),
    getAppVer: () => ipcRenderer.invoke('get-app-ver'),
});