// general_ui.js
export const UI = {
    /**
     * 页面跳转
     * @param {string} pageName - 页面URL
     */
    navigate(pageName) {
        window.location.href = `${pageName}.html`;
    },

    /**
     * 显示加载遮罩
     * @param {string} [text="加载中"] - 提示文字
     */
    showLoading(text = "加载中") {
        this.hideLoading();

        const loader = document.createElement('div');
        loader.id = 'loader-overlay';
        loader.style = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(255,255,255,0.9); display: flex; flex-direction: column;
            justify-content: center; align-items: center; z-index: 10000;
        `;
        loader.innerHTML = `
            <div style="width: 200px; height: 3px; background: #eee; overflow: hidden;">
                <div class="loader-bar" style="width: 40%; height: 100%; background: #0078d7;"></div>
            </div>
            <p style="margin-top: 15px; font-family: LXGWWenKaiMono; font-size: 12px; text-align: center; width: 100%;">${text}</p>
        `;
        document.body.appendChild(loader);

        const bar = loader.querySelector('.loader-bar');
        let pos = -40;
        loader.dataset.intervalId = setInterval(() => {
            pos += 2; if (pos > 100) pos = -40;
            bar.style.marginLeft = pos + '%';
        }, 20);
    },

    /**
     * 隐藏加载遮罩
     */
    hideLoading() {
        const overlay = document.getElementById('loader-overlay');
        if (overlay) {
            if (overlay.dataset.intervalId) {
                clearInterval(parseInt(overlay.dataset.intervalId));
            }
            try {
                overlay.remove();
            } catch (err) {
                console.error(`Remove loading overlay error: ${err}`);
            }
        }
    },

    /**
     * 确定弹窗
     * @param {string} title - 弹窗标题
     * @param {string} message - 弹窗内容
     * @returns {Promise<void>} 用户点击确定后 resolve
     */
    uialert(title, message) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'tfur-dialog-overlay';
            overlay.innerHTML = `
                <div class="tfur-dialog">
                    <div class="tfur-dialog-title">${title}</div>
                    <div class="tfur-dialog-content">${message}</div>
                    <div class="tfur-dialog-buttons">
                        <button class="tfur-button primary tfur-dialog-btn btn-ok">确定</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            overlay.querySelector('.btn-ok').onclick = () => {
                try { overlay.remove(); } catch (err) { console.error(`Remove uialert overlay error: ${err}`); }
                resolve();
            };
        });
    },

    /**
     * 显示确定/取消弹窗
     * @param {string} title - 弹窗标题
     * @param {string} message - 弹窗内容
     * @returns {Promise<boolean>} 确定返回 true，取消返回 false
     */
    confirm(title, message) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'tfur-dialog-overlay';
            overlay.innerHTML = `
                <div class="tfur-dialog">
                    <div class="tfur-dialog-title">${title}</div>
                    <div class="tfur-dialog-content">${message}</div>
                    <div class="tfur-dialog-buttons">
                        <button class="tfur-button primary tfur-dialog-btn btn-yes">确定</button>
                        <button class="tfur-button tfur-dialog-btn btn-no">取消</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            overlay.querySelector('.btn-yes').onclick = () => { overlay.remove(); resolve(true); };
            overlay.querySelector('.btn-no').onclick = () => { overlay.remove(); resolve(false); };
        });
    },

    /**
     * 切换页面所有交互元素的禁用状态
     * @param {boolean} disabled - true 为禁用, false 为启用
     */
    setBusy(disabled) {
        const inputs = document.querySelectorAll('input, button');
        inputs.forEach(el => {
            el.style.opacity = disabled ? "0.6" : "1";
            el.style.pointerEvents = disabled ? "none" : "auto";
        });
    },

    /**
     * 显示外链提示弹窗
     * @param {string} uri - 需要展示的外部链接
     * @returns {Promise<void>} 用户点击确定后 resolve
     */
    async aalert(uri) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'tfur-dialog-overlay';
            overlay.innerHTML = `
                <div class="tfur-dialog">
                    <div class="tfur-dialog-title">请在浏览器中打开链接</div>
                    <div class="tfur-dialog-content-link" style="margin: 10px 0; padding: 10px;">${uri}</div>
                    <div class="tfur-dialog-buttons">
                        <button class="tfur-button btn-copy">复制链接</button>
                        <button class="tfur-button primary tfur-dialog-btn btn-ok">确定</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            overlay.querySelector('.btn-copy').onclick = () => {
                try {
                    navigator.clipboard.writeText(uri);
                    this.uialert("提示", "链接已复制到剪贴板");
                } catch (err) {
                    console.error("复制链接失败:", err);
                    this.uialert("错误", "复制链接失败");
                }
            };

            overlay.querySelector('.btn-ok').onclick = () => {
                try { overlay.remove(); } catch (err) { console.error(`Remove aalert overlay error: ${err}`); }
                resolve();
            };
        });
    },

    /**
     * 加载 Fluent UI SVG 图标
     * @param {string} name - 图标名称（如 "add_circle"）
     * @param {number} [size=24] - 图标尺寸
     * @param {"regular"|"filled"} [mode="regular"] - 图标样式
     * @returns {Promise<string>} SVG 字符串，加载失败返回空字符串
     */
    async getIcon(name, size = 24, mode = "regular") {
        try {
            const response = await fetch(`../../node_modules/@fluentui/svg-icons/icons/${name}_${size}_${mode}.svg`);
            return await response.text();
        } catch (e) {
            console.error("加载图标失败:", name);
            return "";
        }
    },
};