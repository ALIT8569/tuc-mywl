const CryptoJS = require("crypto-js");
// 修复Buffer在非Node环境的兼容性（若在浏览器环境需替换为对应Base64处理方法）
const ku9 = {
    // 模拟异步请求，实际环境需替换为真实HTTP请求（如axios/fetch）
    request: async (url, method, headers) => {
        return { body: '{"response":"eyJkYXRhIjp7ImxpdmVfcm9vbSI6eyJsaXZlQ2FtZXJhTGlzdCI6W119fX0="}' };
    },
    md5: (str) => CryptoJS.MD5(str).toString(),
    encodeBase64: (str) => {
        // 适配Node.js和浏览器环境
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(str).toString('base64');
        } else {
            return btoa(unescape(encodeURIComponent(str)));
        }
    },
    decodeBase64: (str) => {
        // 适配Node.js和浏览器环境
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(str, 'base64').toString();
        } else {
            return decodeURIComponent(escape(atob(str)));
        }
    }
};

// 关键修复：main函数添加async关键字，支持内部await调用
async function main(item) {
    const id = item?.id || 'cctv4k'; // 用可选链避免item为undefined时报错
    // 频道ID映射表（保持原配置，确保键值对应正确）
    const channelMap = {
        'cctv1': '11200132825562653886',       // 综合频道
        'cctv2': '12030532124776958103',       // 财经频道
        'cctv3': '15876245320857169583',       // 综艺频道
        'cctv4': '10620168294224708952',       // 中文国际频道
        'cctv5': '16552256789012345671',       // 体育频道
        'cctv5plus': '17890345671234567892',   // 体育赛事频道
        'cctv6': '18765432109876543213',       // 电影频道
        'cctv7': '8516529981177953694',        // 国防军事频道
        'cctv8': '19876543210123456784',       // 电视剧频道
        'cctv9': '7252237247689203957',        // 纪录频道
        'cctv10': '14589146016461298119',      // 科教频道
        'cctv11': '11234567890987654325',      // 戏曲频道
        'cctv12': '13180385922471124325',      // 社会与法频道
        'cctv13': '16265686808730585221',      // 新闻频道（已修正参数）
        'cctv14': '12345678901234567896',      // 少儿频道
        'cctv15': '13456789012345678907',      // 音乐频道
        'cctv16': '14567890123456789018',      // 奥林匹克频道
        'cctv17': '4496917190172866934',       // 农业农村频道
        'cctv4k': '2127841942201075403'        // 4K超高清频道
    }; 

    const articleId = channelMap[id];
    // 若指定频道不存在，直接返回空URL
    if (!articleId) {
        return { url: '' };
    }

    // 修复：await需在async函数内使用，且接收异步函数返回值
    const playUrl = await getCCTVNEWSPlayUrl(articleId);
    if (playUrl && playUrl.startsWith('http')) { // 用startsWith更简洁，修复语法
        return { url: playUrl };
    }
    return { url: '' };
}

// Java风格String哈希函数（无语法错误，保持不变）
function javaStringHashCode(str) {
    let h = 0;
    const len = str.length;
    for (let i = 0; i < len; i++) {
        h = (31 * h + str.charCodeAt(i)) | 0;
    }
    return h;
}

// 生成符合规则的随机IMEI（无语法错误，保持不变）
function generateRandomIMEI(length = 15) { // 用默认参数简化代码
    let imei = '';
    for (let i = 0; i < length; i++) {
        imei += Math.floor(Math.random() * 10).toString();
    }
    // 生成IMEI校验位（符合GSM标准）
    if (length === 15) {
        let sum = 0;
        for (let i = 0; i < 14; i++) {
            let num = parseInt(imei[i]);
            if (i % 2 === 1) {
                num *= 2;
                sum += num > 9 ? num - 9 : num;
            } else {
                sum += num;
            }
        }
        const checkDigit = (10 - (sum % 10)) % 10;
        imei = imei.substring(0, 14) + checkDigit;
    }
    return imei;
}

// 生成UTDID（无语法错误，保持不变）
function generateUTDID() {
    const timestamp = Math.floor(Date.now() / 1000);
    const randomInt = Math.floor(Math.random() * 4294967296) - 2147483648;
    const version = 0x0300;
    const imei = generateRandomIMEI();
    const imeiHash = javaStringHashCode(imei);
    const timestampHex = toHex32(timestamp);
    const randomHex = toHex32(randomInt);
    const versionHex = toHex16(version);
    const imeiHashHex = toHex32(imeiHash);
    const dataToSign = timestampHex + randomHex + versionHex + imeiHashHex;
    const hmacKey = 'd6fc3a4a06adbde89223bvefedc24fecde188aaa9161';

    const hmacResult = CryptoJS.HmacSHA1(dataToSign, hmacKey);
    const hmacBase64 = hmacResult.toString(CryptoJS.enc.Base64);
    const signatureHash = javaStringHashCode(hmacBase64);
    const signatureHashHex = toHex32(signatureHash);
    const rawUtdid = dataToSign + signatureHashHex;

    const rawBytes = hexToBytes(rawUtdid);
    const binary = String.fromCharCode.apply(null, rawBytes);
    return ku9.encodeBase64(binary);
}

// 32位十六进制转换（无语法错误，保持不变）
function toHex32(num) {
    const hex = (num >>> 0).toString(16);
    return ('00000000' + hex).slice(-8);
}

// 16位十六进制转换（无语法错误，保持不变）
function toHex16(num) {
    const hex = (num & 0xFFFF).toString(16);
    return ('0000' + hex).slice(-4);
}

// 十六进制转字节数组（无语法错误，保持不变）
function hexToBytes(hex) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        const val = hex.substr(i, 2);
        bytes.push(parseInt(val, 16) || 0); // 避免空值导致NaN
    }
    return bytes;
}

// 获取央视新闻播放地址（异步函数，无语法错误）
async function getCCTVNEWSPlayUrl(articleId) {
    const APP_KEY = '20000008';
    const APP_VER = '10.9.0';
    const FEATURES = '27';
    const HMAC_KEY = '3df8017cb9367f5997ab9e4b19c1e028';
    const UTDID = generateUTDID();
    const TTID = '702006@CCNews_Android_10.9.0';
    const t = Math.floor(Date.now() / 1000).toString();
    const urlpath = `articleId=${articleId}&channelId=1212&scene_type=6`; // 用模板字符串简化
    const md5Content = ku9.md5(urlpath);
    // 用模板字符串修复字符串拼接可能的语法问题
    const msg = `${UTDID}&&&${APP_KEY}&${md5Content}&${t}&emas.feed.article.live.detail&1.0.0&&${TTID}&&&${FEATURES}`;
    const sign = CryptoJS.HmacSHA256(msg, HMAC_KEY).toString();
    const url = `https://emas-api.cctvnews.cctv.com/gw/emas.feed.article.live.detail/1.0.0/?${urlpath}`;
    const headers = {
        'appVersion': APP_VER,
        'x-emas-gw-utdid': encodeURIComponent(UTDID),
        'utdid': UTDID,
        'x-emas-gw-ttid': encodeURIComponent(TTID),
        'x-emas-gw-sign': sign,
        'x-emas-gw-t': t,
        'ua': `Android/13 (HUAWEI cn.cntvnews;zh_CN) App/4.5.15 AliApp() HONOR-400/11358758 Channel/702006 language/zh-CN Device/CCNews CCNews/${APP_VER}`,
        'x-emas-gw-features': FEATURES,
        'x-emas-gw-auth-ticket': '20000008',
        'x-emas-gw-appkey': APP_KEY,
        'x-emas-gw-pv': '6.1',
        'timezone': '28800',
        'osVersion': '13',
        'User-Agent': 'MTOPSDK%2F3.0.6+%28Android%3B13%3BHUAWEI%3BHONOR-400%29',
        'Connection': 'keep-alive',
        'Host': 'emas-api.cctvnews.cctv.com'
    };

    try {
        const res = await ku9.request(url, 'GET', headers);
        const outer = JSON.parse(res.body);
        const decoded = ku9.decodeBase64(outer.response);
        const inner = JSON.parse(decoded);
        const liveRoom = inner.data?.live_room;
        if (!liveRoom) return '';

        // 用for...of循环简化遍历，避免索引错误
        for (const cam of liveRoom.liveCameraList || []) {
            for (const item of cam.pullUrlList || []) {
                if (item.format === 'HLS' && item.drm === 0) {
                    for (const authItem of item.authResultUrl || []) {
                        if (authItem.authUrl) {
                            return authItem.authUrl;
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.error('获取播放地址失败:', e);
    }
    return '';
}

// 示例调用：需用async/await或.then()处理main的异步返回
// (async () => {
//     const result = await main({ id: 'cctv13' });
//     console.log('播放地址:', result.url);
// })();