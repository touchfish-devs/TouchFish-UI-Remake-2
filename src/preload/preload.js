const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    /**
     * 发送鉴权相关请求（登录/注册/激活）
     * @param {Object} payload - 鉴权请求参数
     * @param {'login'|'register'|'activate'} payload.type - 操作类型
     * @param {string} payload.apiBase - API 基础地址
     * @param {string} [payload.username] - 用户名
     * @param {string} [payload.password] - 密码哈希
     * @param {string} [payload.email] - 邮箱
     * @param {string} [payload.hash] - 服务端盐值哈希
     * @param {string} [payload.captcha_stamp] - 验证码时间戳
     * @param {string} [payload.captcha_code] - 验证码
     * @param {string} [payload.uid] - 用户ID
     * @param {string} [payload.activateCode] - 激活码
     * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
     */
    authRequest: (payload) => ipcRenderer.invoke('auth-request', payload),

    /**
     * 打开系统文件选择对话框
     * @returns {Promise<string|null>} 选中文件的绝对路径，取消返回 null
     */
    selectFile: () => ipcRenderer.invoke('select-file'),

    /**
     * TFv5 加解密服务
     * @param {Object} payload - 加解密参数
     * @param {'encrypt'|'decrypt'} payload.type - 操作类型
     * @param {string|Buffer} payload.data - 待处理的数据
     * @returns {Promise<{success: boolean, data?: string, error?: string}>}
     */
    cryptoService: (payload) => ipcRenderer.invoke('crypto-service', payload),

    /**
     * 验证服务端公钥指纹是否可信
     * @param {Object} payload - 验证参数
     * @param {string} payload.pemKey - PEM 格式的公钥字符串
     * @param {string} payload.expectedHash - 期待的哈希
     * @returns {Promise<{valid: boolean}>}
     */
    verifyPublicKey: (payload) => ipcRenderer.invoke('verify-public-key', payload),

    /**
     * 获取当前应用版本号
     * @returns {Promise<string>} 语义化版本号
     */
    getAppVer: () => ipcRenderer.invoke('get-app-ver'),
});