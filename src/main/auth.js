import axios from 'axios';
import { TFCrypto } from './crypto.js';

/** @type {boolean} 调试模式开关 */
const DEBUG = process.env.TOUCHFISHUR2_DEBUG === '1';

if (DEBUG) console.log(`DEBUG: ${DEBUG}`);

export const AuthService = {
    /**
     * 获取并验证服务端公钥
     * @param {string} apiBase - API 基础地址
     * @param {string} [expectedHash] - 预期的公钥 SHA256 指纹，传入时进行校验
     * @returns {Promise<string>} PEM 格式的公钥字符串
     * @throws {Error} 网络失败或指纹不匹配时抛出
     */
    async prepareSecureRequest(apiBase, expectedHash) {
        const keyRes = await axios.get(`${apiBase}/get_rsa_pub`, { timeout: 10000 });
        const publicKey = keyRes.data;

        if (expectedHash) {
            const isSafe = TFCrypto.verifyPublicKey(publicKey, expectedHash);
            if (!isSafe) throw new Error("SECURITY_HASH_MISMATCH");
        }

        return publicKey;
    },

    /**
     * 获取公钥
     * @param {string} apiBase - API 基础地址
     * @returns {Promise<string>} PEM 格式的公钥字符串
     * @throws {Error} 网络请求失败时抛出原始错误
     */
    async getServerPublicKey(apiBase) {
        try {
            const resp = await axios.get(`${apiBase}/get_rsa_pub`, { timeout: 10000 });
            return resp.data;
        } catch (error) {
            console.error(`[AuthService] getServerPublicKey failed: ${error.message}`);
            throw error;
        }
    },

    /**
     * 查询服务器配置信息
     * @param {string} apiBase - API 基础地址
     * @returns {Promise<Object>} 服务器配置对象
     * @throws {Error} 请求失败或返回空数据时抛出
     */
    async getServerInfo(apiBase) {
        try {
            const res = await axios.get(`${apiBase}/info`, { timeout: 5000 });
            if (!res.data) throw new Error("无法获取服务器配置信息");
            return res.data;
        } catch (error) {
            console.error(`[AuthService] getServerInfo failed: ${error.message}`);
            throw new Error("无法获取服务器配置信息");
        }
    },

    /**
     * 用户登录
     * @param {string} apiBase - API 基础地址
     * @param {string} hash - 服务端公钥指纹
     * @param {string} username - 用户名
     * @param {string} password - 密码哈希
     * @returns {Promise<Object>} 解密后的登录响应数据
     * @throws {Error} 网络超时、加密失败或服务端拒绝时抛出
     */
    async login(apiBase, hash, username, password) {
        return this.executeSecurePost(apiBase, hash, '/auth/login', {
            uid: username,
            password: password
        }, { uname: username, pwd: password });
    },

    /**
     * 根据用户名查询 UID
     * @param {string} apiBase - API 基础地址
     * @param {string} username - 用户名
     * @returns {Promise<Object|null>} 用户信息对象，查询失败返回 null
     */
    async getUserInfoByUsername(apiBase, username) {
        try {
            const res = await axios.get(
                `${apiBase}/auth/username/${encodeURIComponent(username)}`,
                { timeout: 5000 }
            );
            return res.data;
        } catch (error) {
            console.error(`[AuthService] getUserInfoByUsername failed: ${error.message}`);
            return null;
        }
    },

    /**
     * 获取注册验证码
     * @param {string} apiBase - API 基础地址
     * @returns {Promise<Object>} 验证码数据（含 stamp 和 image/base64）
     * @throws {Error} 网络超时或服务端错误时抛出
     */
    async getCaptcha(apiBase) {
        return this.executeSecureGet(apiBase, '/auth/captcha');
    },

    /**
     * 用户注册
     * @param {string} apiBase - API 基础地址
     * @param {string} hash - 服务端公钥指纹
     * @param {Object} params - 注册参数
     * @param {string} params.username - 用户名
     * @param {string} params.password - 密码哈希
     * @param {string} [params.email] - 邮箱
     * @param {string} [params.captcha_stamp] - 验证码时间戳
     * @param {string} [params.captcha_code] - 验证码
     * @returns {Promise<Object>} 解密后的注册响应数据
     * @throws {Error} 网络超时、加密失败或服务端拒绝时抛出
     */
    async register(apiBase, hash, { username, password, email, captcha_stamp, captcha_code }) {
        const regData = {
            username,
            password,
            ...(email && { email }),
            ...(captcha_stamp && { captcha_stamp }),
            ...(captcha_code && { captcha_code })
        };

        return this.executeSecurePost(apiBase, hash, '/auth/register', regData, {
            uname: username, pwd: password, email, captcha_code
        });
    },

    /**
     * 激活账号（邮箱验证后）
     * @param {string} apiBase - API 基础地址
     * @param {string} hash - 服务端公钥指纹
     * @param {string} uid - 用户 ID
     * @param {string} activateCode - 邮箱收到的激活码
     * @returns {Promise<Object>} 解密后的激活响应数据
     * @throws {Error} 网络超时、加密失败或激活码无效时抛出
     */
    async activateAccount(apiBase, hash, uid, activateCode) {
        return this.executeSecurePost(apiBase, hash, '/auth/activate', {
            uid,
            activate_code: activateCode
        }, { uid, activateCode });
    },

    /**
     * 统一错误处理
     * @param {Error} error - 原始错误对象
     * @throws {Error} 始终抛出（可能是转换后的或原始的）
     */
    handleError(error) {
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            throw new Error("连接服务器超时，请检查网络或地址是否正确。");
        }
        throw error;
    },



    /**
     * 执行加密 POST 请求的通用流程
     * @private
     * @param {string} apiBase - API 基础地址
     * @param {string} hash - 公钥指纹
     * @param {string} endpoint - API 路径
     * @param {Object} payload - 待加密的请求体
     * @param {Object} debugInfo - 调试日志中显示的字段
     * @returns {Promise<Object>} 解密后的响应数据
     */
    async executeSecurePost(apiBase, hash, endpoint, payload, debugInfo = {}) {
        try {
            const publicKey = await this.prepareSecureRequest(apiBase, hash);
            const secret = TFCrypto.encryptRequest(payload, publicKey);

            if (DEBUG) {
                console.log(`============${endpoint.toUpperCase()}=============`);
                console.log(`==API Base: ${apiBase}`);
                Object.entries(debugInfo).forEach(([k, v]) => {
                    console.log(`==${k}: ${v}`);
                });
                console.log(`==secret: |- iv:${secret.iv},\n |- key:${secret.key},\n |- content:${secret.content}`);
                console.log(`==============================`);
                console.log(`${endpoint} JSON: ${JSON.stringify(payload)}`);
            }

            const response = await axios.post(`${apiBase}${endpoint}`, {
                iv: secret.iv,
                key: secret.key,
                content: secret.content
            }, { timeout: 10000 });

            return TFCrypto.decryptResponse(response.data.content, secret.rawKey, response.data.iv);
        } catch (error) {
            this.handleError(error);
        }
    },

    /**
     * 执行普通 GET 请求（带统一错误处理）
     * @private
     * @param {string} apiBase - API 基础地址
     * @param {string} endpoint - API 路径
     * @returns {Promise<Object>} 响应数据
     */
    async executeSecureGet(apiBase, endpoint) {
        try {
            const resp = await axios.get(`${apiBase}${endpoint}`, { timeout: 10000 });
            return resp.data;
        } catch (error) {
            this.handleError(error);
        }
    }
};