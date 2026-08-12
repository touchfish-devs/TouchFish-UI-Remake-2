// /crypto.js
import crypto from 'crypto';

export class TFCrypto {
    /**
     * 加密
     * @param {string} data 
     * @param {string} rsaPublicKey 
     * @returns 加密后数据
     */
    static encryptRequest(data, rsaPublicKey) {
        const ivBuffer = crypto.randomBytes(16);
        const aesKeyBuffer = crypto.randomBytes(32);

        const encryptedKey = crypto.publicEncrypt(
            {
                key: rsaPublicKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: "sha256",
            },
            aesKeyBuffer
        );

        const cipher = crypto.createCipheriv('aes-256-cbc', aesKeyBuffer, ivBuffer);
        const jsonStr = JSON.stringify(data);
        let encryptedContent = cipher.update(jsonStr, 'utf8', 'base64');
        encryptedContent += cipher.final('base64');

        return {
            iv: ivBuffer.toString('base64'),
            key: encryptedKey.toString('base64'),
            content: encryptedContent,
            rawKey: aesKeyBuffer
        };
    }

    /**
     * 解密
     * @param {string} encryptedContent 
     * @param {string} aesKey 
     * @param {string}} ivBase64
     * @returns 解密后数据
     */
    static decryptResponse(encryptedContent, aesKey, ivBase64) {
        try {
            const iv = Buffer.from(ivBase64, 'base64');
            const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);

            let decrypted = decipher.update(encryptedContent, 'base64', 'utf8');
            decrypted += decipher.final('utf8');

            try {
                return JSON.parse(decrypted);
            } catch {
                return decrypted;
            }
        } catch (error) {
            console.error("Decrypt ERROR:", error.message);
            return null;
        }
    }

    static verifyPublicKey(pemKey, expectedHash) {
        if (!expectedHash) return true;
        const hash = crypto.createHash('sha256').update(pemKey).digest('hex');
        return hash.toLowerCase() === expectedHash.toLowerCase();
    }
}