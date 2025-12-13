// EPG代理纯JS文件（上传即用）
// 保存为epg-proxy.js，直接上传到服务器根目录，通过HTML调用或作为接口访问

// 全局函数：处理请求（前端/后端通用）
async function epgProxy(requestUrl) {
    const url = new URL(requestUrl);
    
    // 拼接源站URL
    let originalUrl = 'http://epg.112114.xyz';
    const queryString = url.search.slice(1);
    if (!queryString) {
        originalUrl += `?ch=CCTV1&date=${getShanghaiDate()}`;
    } else {
        originalUrl += `?${queryString}`;
    }

    // 发起请求
    try {
        const response = await fetch(originalUrl, {
            headers: { 'User-Agent': 'EPG-Proxy/1.0' },
            redirect: 'follow'
        });
        const data = url.pathname.includes('.xml') ? await response.text() : await response.json();
        
        // 模拟响应头（前端环境）
        console.log('响应状态:', response.status);
        console.log('EPG数据:', data);
        return data;
    } catch (err) {
        console.error('请求失败:', err);
        return { error: err.message, url: originalUrl };
    }
}

// 工具函数：上海时区日期
function getShanghaiDate() {
    const d = new Date();
    const sh = new Date(d.getTime() + (8 * 3600 * 1000) - (d.getTimezoneOffset() * 60 * 1000));
    return `${sh.getFullYear()}-${String(sh.getMonth()+1).padStart(2,0)}-${String(sh.getDate()).padStart(2,0)}`;
}

// 自动执行（访问时直接触发）
(async () => {
    // 拦截favicon.ico
    if (window.location.pathname === '/favicon.ico') {
        document.write('');
        return;
    }
    // 执行代理并输出结果
    const result = await epgProxy(window.location.href);
    // 按类型输出（XML/JSON）
    if (window.location.pathname.includes('.xml')) {
        document.contentType = 'text/xml';
        document.write(result);
    } else {
        document.contentType = 'application/json';
        document.write(JSON.stringify(result, null, 2));
    }
})();