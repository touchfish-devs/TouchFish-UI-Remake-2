// src/renderer/i18n.js
const DEFAULT_LOCALE = 'zh-CN';
const LOCALE_STORAGE_KEY = 'TFUR_locale';
// 相对路径：应用通过 loadFile(file://) 加载页面，绝对路径会解析到盘符根目录
const LOCALES_PATH = './locales';

let currentLocale = null;
let messages = {};
let loadingPromise = null;
const localeListeners = [];

function normalizeLocale(l) {
    if (!l) return null;
    l = l.replace('_', '-');
    const base = l.split('-')[0];
    if (base === 'zh') return 'zh-CN';
    return base;
}

export async function loadLocale(locale, tried = new Set()) {
    locale = normalizeLocale(locale) || DEFAULT_LOCALE;

    if (tried.has(locale)) {
        console.warn(`[i18n] circular fallback detected for ${locale}`);
        messages[locale] = messages[locale] || {};
        currentLocale = locale;
        return messages[locale];
    }
    tried.add(locale);

    if (messages[locale]) {
        currentLocale = locale;
        return messages[locale];
    }

    try {
        const resp = await fetch(`${LOCALES_PATH}/${locale}.json`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        messages[locale] = json;
        currentLocale = locale;
        return json;
    } catch (err) {
        const base = locale.split('-')[0];
        if (base !== locale && base.length === 2) {
            return loadLocale(base, tried);
        }
        if (locale !== DEFAULT_LOCALE) {
            return loadLocale(DEFAULT_LOCALE, tried);
        }
        console.error('[i18n] failed to load locale', locale, err);
        messages[DEFAULT_LOCALE] = messages[DEFAULT_LOCALE] || {};
        currentLocale = DEFAULT_LOCALE;
        return messages[DEFAULT_LOCALE];
    }
}

export function t(key, vars = {}) {
    if (!currentLocale) {
        console.warn('[i18n] locale not loaded, call loadLocale first');
        return `??${key}??`;
    }

    const dict = messages[currentLocale] || {};

    let str = dict[key];
    if (str === undefined && key.includes('.')) {
        str = key.split('.').reduce((obj, k) => {
            if (obj && typeof obj === 'object') return obj[k];
            return undefined;
        }, dict);
    }

    if (str === undefined) {
        const defaultDict = messages[DEFAULT_LOCALE] || {};
        str = defaultDict[key];
        if (str === undefined && key.includes('.')) {
            str = key.split('.').reduce((obj, k) => {
                if (obj && typeof obj === 'object') return obj[k];
                return undefined;
            }, defaultDict);
        }
    }

    if (str === undefined) {
        console.warn(`[i18n] missing key: ${key}`);
        return key;
    }

    return String(str).replace(/\{([^}]+)\}/g, (_, k) => {
        const v = vars[k.trim()];
        return v === undefined ? `{${k}}` : v;
    });
}

export function translatePage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const text = t(key, parseVarsAttr(el.getAttribute('data-i18n-vars')));
        if (text !== undefined) el.textContent = text;
    });

    // 含 <br> / 嵌套 <span> 等 HTML 的元素用 innerHTML 翻译
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        const text = t(key, parseVarsAttr(el.getAttribute('data-i18n-vars')));
        if (text !== undefined) el.innerHTML = text;
    });

    document.querySelectorAll('[data-i18n-attr]').forEach(el => {
        const raw = el.getAttribute('data-i18n-attr');
        if (!raw) return;
        raw.split(';').forEach(pair => {
            const [attr, k] = pair.split(':').map(s => s && s.trim());
            if (!attr || !k) return;
            const value = t(k);
            if (value) el.setAttribute(attr, value);
        });
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const value = t(key);
        if (value) el.placeholder = value;
    });

    if (document.documentElement) {
        document.documentElement.lang = currentLocale || DEFAULT_LOCALE;
    }

    if (document.documentElement) {
        document.documentElement.lang = currentLocale || DEFAULT_LOCALE;

        try { document.documentElement.classList.remove('lang-zh-CN', 'lang-en'); } catch (err) { console.warn(err); }
        document.documentElement.classList.add(`lang-${currentLocale || DEFAULT_LOCALE}`);
    }

    document.dispatchEvent(new CustomEvent('localeChanged', {
        detail: { locale: currentLocale }
    }));
}

function parseVarsAttr(raw) {
    if (!raw) return {};
    try {
        return JSON.parse(raw);
    } catch (_) {
        const out = {};
        raw.split(',').forEach(p => {
            const [k, v] = p.split(':').map(s => s && s.trim());
            if (k) out[k] = v;
        });
        return out;
    }
}

export function getCurrentLocale() {
    return currentLocale;
}

export function onLocaleChange(fn) {
    localeListeners.push(fn);
    return () => {
        const idx = localeListeners.indexOf(fn);
        if (idx > -1) localeListeners.splice(idx, 1);
    };
}

export async function setLocaleAndPersist(locale) {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    await loadLocale(locale);
    translatePage();
    localeListeners.forEach(fn => fn(currentLocale));
}

export function detectInitialLocale() {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored) return stored;
    if (typeof navigator !== 'undefined' && navigator.language) {
        return navigator.language;
    }
    return DEFAULT_LOCALE;
}

export async function ensureLocale() {
    if (currentLocale) return currentLocale;
    if (!loadingPromise) {
        loadingPromise = loadLocale(detectInitialLocale());
    }
    return loadingPromise;
}

/**
 * 初始化
 * @returns {string} 当前语言
 */
export async function initI18n() {
    const locale = detectInitialLocale();
    await loadLocale(locale);
    translatePage();
    return currentLocale;
}

/**
 * 在页面右上角创建语言切换按钮，以后删去
 */
export function createLangSwitcher() {
    if (document.getElementById('tfur-lang-switcher')) return;

    const style = document.createElement('style');
    style.id = 'tfur-lang-switcher-style';
    style.textContent = `
        #tfur-lang-switcher {
            position: fixed;
            top: 12px;
            right: 12px;
            z-index: 10000;
            padding: 5px 14px;
            font-size: 12px;
            font-family: LXGWWenKaiMono, sans-serif;
            color: #fff;
            background: rgba(0, 0, 0, 0.35);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 4px;
            cursor: pointer;
            backdrop-filter: blur(6px);
            transition: background 0.2s;
        }
        #tfur-lang-switcher:hover {
            background: rgba(0, 0, 0, 0.5);
        }
    `;
    document.head.appendChild(style);

    const btn = document.createElement('button');
    btn.id = 'tfur-lang-switcher';
    btn.type = 'button';
    btn.onclick = async () => {
        const cur = getCurrentLocale() || DEFAULT_LOCALE;
        await setLocaleAndPersist(cur === 'zh-CN' ? 'en' : 'zh-CN');
    };

    const render = () => {
        const cur = getCurrentLocale() || DEFAULT_LOCALE;
        const name = t(`lang.name.${cur}`);
        btn.textContent = name && !name.startsWith('??') ? name : cur;
        btn.title = t('lang.tooltip');
    };
    onLocaleChange(render);
    render();
    document.body.appendChild(btn);
}
