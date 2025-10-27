// 解混淆并修复核心功能
const ku9 = {
    // 补全必要的网络请求和加密方法
    getQuery: function (obj, key) {
        return obj && obj[key] ? obj[key] : null;
    },
    request: async function (url, method = 'GET', headers = {}, data = {}) {
        try {
            const options = {
                method: method.toUpperCase(),
                headers: { ...headers }
            };
            if (options.method === 'POST') {
                options.body = typeof data === 'string' ? data : JSON.stringify(data);
            } else {
                const params = new URLSearchParams(data);
                url += (url.includes('?') ? '&' : '?') + params.toString();
            }
            const response = await fetch(url, options);
            return await response.text();
        } catch (e) {
            console.error('请求失败:', e);
            return '';
        }
    },
    sha1: function (str) {
        // SHA1加密实现
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        return crypto.subtle.digest('SHA-1', data)
            .then(hash => {
                return Array.from(new Uint8Array(hash))
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('');
            });
    }
};

// 修复httpBuildQuery函数（处理URL参数拼接）
function httpBuildQuery(params) {
    const parts = [];
    for (const key in params) {
        if (Object.prototype.hasOwnProperty.call(params, key)) {
            parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
        }
    }
    return parts.join('&');
}

// 主函数修复：明确逻辑，处理CCTV6和1905电影频道
async function main(item) {
    try {
        // 获取频道ID，默认使用1905电影频道
        const channelId = ku9.getQuery(item, 'id') || '1905a';
        const channelMap = {
            'cctv6': 'cctv6',       // CCTV6电影频道
            '1905a': '1905a'       // 1905电影频道
        };

        // 处理1905电影频道逻辑
        if (channelMap[channelId] === '1905a') {
            const url = 'https://m.1905.com/m/xl/live/?fr=1905app';
            const response = await ku9.request(url);
            // 提取视频播放地址（修复正则匹配逻辑）
            const videoMatch = response.match(/video:'(.*?)'/);
            const playUrl = videoMatch && videoMatch[1] ? videoMatch[1] : '';
            return JSON.stringify({ url: playUrl });
        }

        // 处理CCTV6频道逻辑（修复加密和请求参数）
        const appKey = '689d471d9240010534b531f8409c9ac31e0e6521';
        const apiUrl = 'https://profile.m1905.com/mvod/liveinfo.php';
        const timestamp = Date.now();
        const nonce = Math.floor(Math.random() * 1000000);
        
        // 构建请求参数
        const params = {
            cid: 1000063,          // 修正频道ID
            expiretime: 3600,      // 有效期1小时
            nonce: nonce,
            page: 'https://www.1905.com',
            playerid: 'player_' + timestamp.toString().slice(-4),
            streamname: 'cctv6',
            uuid: 1
        };

        // 生成签名（修复SHA1加密逻辑）
        const signStr = httpBuildQuery(params) + '.' + appKey;
        const sign = await ku9.sha1(signStr);
        params.sign = sign;

        // 发送请求获取播放地址
        const headers = {
            'Authorization': sign,
            'Content-Type': 'application/json',
            'Origin': 'https://www.1905.com'
        };
        const response = await ku9.request(apiUrl, 'GET', headers, params);
        const result = JSON.parse(response);

        // 提取高清播放地址
        if (result.data && result.data.hd) {
            const playUrl = result.data.hd.url + result.data.hd.uri + result.data.hd.hashuri;
            return JSON.stringify({
                url: playUrl,
                headers: JSON.stringify({ referer: 'https://www.1905.com' })
            });
        }

        return JSON.stringify({ url: '' });
    } catch (e) {
        console.error('主函数错误:', e);
        return JSON.stringify({ url: '' });
    }
}

// 示例调用
// (async () => {
//     console.log(await main({ id: 'cctv6' }));
// })();