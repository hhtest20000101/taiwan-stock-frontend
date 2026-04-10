/**
 * 系統層：全域環境配置助手 (相容 Vite 與 Node.js)
 */

export const getEnv = (key: string): string | undefined => {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
        return process.env[key];
    }
    // @ts-ignore
    if (typeof import.meta.env !== 'undefined' && import.meta.env[key]) {
        return import.meta.env[key];
    }
    return undefined;
};

export const getBaseUrl = (type: 'finmind' | 'twse' | 'tpex' | 'taifex'): string => {
    const isBrowser = typeof window !== 'undefined';
    
    if (isBrowser) {
        return `/api/${type}`;
    }
    
    // Node.js (終端機) 環境使用直連正式網址 (Domain Only)
    const targets = {
        finmind: 'https://api.finmindtrade.com',
        twse: 'https://openapi.twse.com.tw',
        tpex: 'https://www.tpex.org.tw',
        taifex: 'https://openapi.taifex.com.tw'
    };
    
    return targets[type];
};
