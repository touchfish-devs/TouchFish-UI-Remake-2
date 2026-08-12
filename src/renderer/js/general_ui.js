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
     * @param {string} msg - 提示信息
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
            overlay.remove();
        }
    },

    /**
     * 确定弹窗
     * @param {string} title - 标题
     * @param {string} message - 内容
     * @returns {Promise} - 用户点击后 resolve
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
                overlay.remove();
                resolve();
            };
        });
    },

    /**
     * 带确定和取消按钮的弹窗
     * @param {string} title 
     * @param {string} message 
     * @returns {Promise}
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
     * @param {boolean} disabled - 是否禁用
     */
    setBusy(disabled) {
        const inputs = document.querySelectorAll('input, button');
        inputs.forEach(el => {
            el.style.opacity = disabled ? "0.6" : "1";
            el.style.pointerEvents = disabled ? "none" : "auto";
        });
    },

    /**
     * 渲染链接
     * @param {string} Uri - 链接 URI
     */
    async aalert(Uri) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'tfur-dialog-overlay';
            overlay.innerHTML = `
                <div class="tfur-dialog">
                    <div class="tfur-dialog-title">请在浏览器中打开链接</div>
                    <div class="tfur-dialog-content-link" style="margin: 10px 0; padding: 10px;">${Uri}</div>
                    <div class="tfur-dialog-buttons">
                        <button class="tfur-button btn-copy">复制链接</button>
                        <button class="tfur-button primary tfur-dialog-btn btn-ok">确定</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            overlay.querySelector('.btn-copy').onclick = () => {
                try {
                    navigator.clipboard.writeText(Uri);
                    this.uialert("提示", "链接已复制到剪贴板");
                } catch (err) {
                    console.error("复制链接失败:", err);
                    this.uialert("错误", "复制链接失败");
                }
            };

            overlay.querySelector('.btn-ok').onclick = () => {
                overlay.remove();
                resolve();
            };
        });
    },

    /**
     * 加载 Fluent SVG
     * @param {string} name - 图标文件名
     * @returns {Promise<string>} - 返回 SVG 字符串
     */
    async getIcon(name, size = 24, mode = "regular") {
        try {
            const response = await fetch(`../../node_modules/@fluentui/svg-icons/icons/${name}_${size}_${mode}.svg`);
            const svgText = await response.text();
            return svgText;
        } catch (e) {
            console.error("加载图标失败:", name);
            return "";
        }
    },
};