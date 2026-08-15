const express = require('express');
const fetch = require('node-fetch');
const { URL } = require('url');
const app = express();
const port = 3000;

// 读取原始body，必须关闭express默认json解析
app.use(express.raw({ type: '*/*' }));

// ========= 配置区，对应PHP变量 =========
const allowed_domains = [
    'aktv.top',
    'php.jdshipin.com',
    'cdn12.jdshipin.com',
    'v2h.jdshipin.com',
    'v2hcdn.jdshipin.com',
    'cdn.163189.xyz',
    'cdn2.163189.xyz',
    'cdn3.163189.xyz',
    'cdn5.163189.xyz',
    'cdn6.163189.xyz',
    'cdn9.163189.xyz'
];
const enable_domain_check = false;
const PROXY_SELF_NAME = "ysws.js"; // 对应原 ysws.php

// 工具函数 模拟php str_starts_with
function str_starts_with(haystack, needle) {
    return haystack.substring(0, needle.length) === needle;
}
// 模拟php str_contains
function str_contains(haystack, needle) {
    return needle !== '' && haystack.indexOf(needle) !== -1;
}

// m3u8内容替换回调逻辑
function replaceM3u8Url(bodyStr, originUrlObj) {
    const base_root = `${originUrlObj.protocol}//${originUrlObj.host}`;
    // dirname实现，模拟php dirname(path)
    let pathParts = originUrlObj.pathname.split('/');
    pathParts.pop();
    const base_dir = `${base_root}${pathParts.join('/')}/`;

    const reg = /(?<url>(https?:\/\/[^\s"']+)|((\/|\.\.?\/)?[^\s"']+))/gi;
    const output = bodyStr.replace(reg, (match, p1) => {
        let url = p1.trim();
        if(str_starts_with(url, '#')) return url;
        if(str_starts_with(url, 'data:')) return url;
        if(str_contains(url, `${PROXY_SELF_NAME}?url=`)) return url;

        if(/^https?:\/\//i.test(url)){
            return `${PROXY_SELF_NAME}?url=${encodeURIComponent(url)}`;
        }
        if(str_starts_with(url, '/')){
            return `${PROXY_SELF_NAME}?url=${encodeURIComponent(base_root + url)}`;
        }
        return `${PROXY_SELF_NAME}?url=${encodeURIComponent(base_dir + url)}`;
    });
    return output;
}

// 主代理接口
app.all('/', async (req, res) => {
    try {
        const request_url_raw = req.query.url ? decodeURIComponent(req.query.url) : '';
        if(!request_url_raw){
            return res.status(400).send("缺少 url 参数");
        }
        const targetUrl = new URL(request_url_raw);

        // 域名白名单校验
        if(enable_domain_check){
            const host = targetUrl.hostname;
            if(!allowed_domains.includes(host)){
                return res.status(403).send("非法请求的域名");
            }
        }

        // 组装请求头，剔除host，重新设置目标host
        const headers = {};
        for(let h in req.headers){
            if(h.toLowerCase() !== 'host'){
                headers[h] = req.headers[h];
            }
        }
        headers['Host'] = targetUrl.host;
        headers['User-Agent'] = "AppleCoreMedia/1.0.0.7B367 (iPad; U; CPU OS 4_3_3 like Mac OS X)";
        headers['Referer'] = `${targetUrl.protocol}//${targetUrl.host}/`;
        headers['Accept-Encoding'] = "gzip, deflate";

        // 请求body，post原始输入
        let fetchOpt = {
            method: req.method,
            headers: headers,
            redirect: 'manual', // 关闭自动跟随重定向，手动处理3xx
            compress: true
        };
        if(req.method === 'POST'){
            fetchOpt.body = req.body;
        }

        const fetchResp = await fetch(targetUrl, fetchOpt);
        const http_code = fetchResp.status;

        // 处理301/302/303/307/308重定向
        if([301,302,303,307,308].includes(http_code)){
            let location = fetchResp.headers.get('location');
            // location可能是相对路径，补全
            const locUrl = new URL(location, targetUrl);
            const newProxyUrl = `${PROXY_SELF_NAME}?url=${encodeURIComponent(locUrl.toString())}`;
            return res.redirect(http_code, newProxyUrl);
        }

        // 读取原始二进制buffer（防止m3u8编码乱码）
        const respBuffer = await fetchResp.buffer();
        const contentType = fetchResp.headers.get('content-type') || '';

        // 设置响应头回传给客户端
        if(contentType){
            res.setHeader('Content-Type', contentType);
        }
        res.status(http_code);

        // 判断是否m3u8
        let is_m3u8 = false;
        if(
            request_url_raw.endsWith('.m3u8') ||
            contentType.toLowerCase().indexOf('mpegurl') !== -1 ||
            respBuffer.toString('utf8').trim().startsWith('#EXTM3U')
        ){
            is_m3u8 = true;
        }

        if(is_m3u8){
            let m3u8Text = respBuffer.toString('utf8');
            const newBody = replaceM3u8Url(m3u8Text, targetUrl);
            res.setHeader('Content-Disposition','inline; filename=index.m3u8');
            return res.send(newBody);
        }else{
            // 非m3u8直接透传二进制
            return res.end(respBuffer);
        }

    }catch(err){
        console.error(err);
        return res.status(500).send(`FETCH ERROR: ${err.message}`);
    }
});

app.listen(port, ()=>{
    console.log(`代理运行 http://127.0.0.1:${port}/ysws.js`);
});
