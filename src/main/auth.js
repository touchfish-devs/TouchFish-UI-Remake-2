import axios from 'axios';
import { TFCrypto } from './crypto.js';

export const AuthService = {
    async _prepareSecureRequest(apiBase, expectedHash) {
        const keyRes = await axios.get(`${apiBase}/get_rsa_pub`, {
            timeout: 10000
        });
        const publicKey = keyRes.data;

        if (expectedHash) {
            const isSafe = TFCrypto.verifyPublicKey(publicKey, expectedHash);
            if (!isSafe) throw new Error("SECURITY_HASH_MISMATCH");
        }

        return publicKey;
    },

    /**
     * 获取公钥
     */
    async getServerPublicKey(apiBase) {
        try {
            const resp = await axios.get(`${apiBase}/get_rsa_pub`, { timeout: 10000 });
            return resp.data;
        } catch (error) {
            console.error("Error:" + error.message + '\n');
            throw error;
        }
    },

    /**
     * 查询服务器配置信息
     */
    async getServerInfo(apiBase) {
        try {
            const res = await axios.get(`${apiBase}/info`, { timeout: 5000 });
            if (!res.data) {
                throw new Error("无法获取服务器配置信息");
            }
            console.log(res.data);
            return res.data;
        } catch (error) {
            console.error("无法获取服务器配置信息");
            throw new Error("无法获取服务器配置信息");
        }
    },

    /**
     * 登录
     */
    async login(apiBase, hash, username, password) {
        try {
            const publicKey = await this._prepareSecureRequest(apiBase, hash);

            const loginData = {
                uid: username,
                password: password
            };

            const secret = TFCrypto.encryptRequest(loginData, publicKey);

            ///*//调试 TODO: 发版注释掉
            console.log("============LOGIN=============");
            console.log(`==API Base: ${apiBase};`);
            console.log(`==uname: ${username};`);
            console.log(`==pwd: ${password};`);
            console.log(`==secert: |- iv:${secret.iv},\n |- key:${secret.key},\n |- content:${secret.content};`);
            console.log(`==============================`);
            console.log(`login JSON: ${JSON.stringify(loginData)}`)
            // 调试结束 */
            

            const response = await axios.post(`${apiBase}/auth/login`, {
                iv: secret.iv,
                key: secret.key,
                content: secret.content
            }, { timeout: 10000 });

            return TFCrypto.decryptResponse(
                response.data.content,
                secret.rawKey,
                response.data.iv
            );
        } catch (error) {
            this._handleError(error);
        }
    },

    /**
     * 获取 UID
     */
    async getUserInfoByUsername(apiBase, username) {
        try {
            const res = await axios.get(`${apiBase}/auth/username/${encodeURIComponent(username)}`, {
                timeout: 5000
            });
            return res.data;
        } catch (error) {
            console.error("UID 查询失败", error);
            return null;
        }
    },

    /**
     * 获取注册验证码（public 类型 API）
     */
    async getCaptcha(apiBase) {
        try {
            const resp = await axios.get(`${apiBase}/auth/captcha`, { timeout: 10000 });
            return resp.data;
        } catch (error) {
            this._handleError(error);
        }
    },

    /**
     * 注册
     */
    async register(apiBase, hash, { username, password, email, captcha_stamp, captcha_code }) {
        try {
            const publicKey = await this._prepareSecureRequest(apiBase, hash);

            const regData = {
                username: username,
                password: password,
                ...(email ? { email } : {}),
                ...(captcha_stamp ? { captcha_stamp } : {}),
                ...(captcha_code ? { captcha_code } : {})
            };

            const secret = TFCrypto.encryptRequest(regData, publicKey);

            // 调试
            console.log("============REGISTER=============");
            console.log(`==API Base: ${apiBase};`);
            console.log(`==uname: ${username};`);
            console.log(`==pwd: ${password};`);
            console.log(`==email: ${email}`);
            console.log(`==captcha_code: ${captcha_code}`);
            console.log(`==secert: |- iv:${secret.iv},\n |- key:${secret.key},\n |- content:${secret.content};`);
            console.log(`==============================`);
            console.log(`regJs: ${JSON.stringify(regData)}`)
            // 调试结束

            const response = await axios.post(`${apiBase}/auth/register`, {
                iv: secret.iv,
                key: secret.key,
                content: secret.content
            }, { timeout: 10000 });

            return TFCrypto.decryptResponse(response.data.content, secret.rawKey, response.data.iv);
        } catch (error) {
            this._handleError(error);
        }
    },

    /**
     * 激活账号（要求邮箱验证的服务器在注册后需要激活）
     */
    async activateAccount(apiBase, hash, uid, activateCode) {
        try {
            const publicKey = await this._prepareSecureRequest(apiBase, hash);

            const activateData = {
                uid: uid,
                activate_code: activateCode
            };

            const secret = TFCrypto.encryptRequest(activateData, publicKey);

            const response = await axios.post(`${apiBase}/auth/activate`, {
                iv: secret.iv,
                key: secret.key,
                content: secret.content
            }, { timeout: 10000 });

            return TFCrypto.decryptResponse(response.data.content, secret.rawKey, response.data.iv);
        } catch (error) {
            this._handleError(error);
        }
    },

    /**
     * 错误统一处理
     */
    _handleError(error) {
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            throw new Error("连接服务器超时，请检查网络或地址是否正确。");
        }
        throw error;
    }
};