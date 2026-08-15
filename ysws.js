const express = require('express');
const axios = require('axios');
const { URL } = require('url');
const https = require('https');
const app = express();

app.use(express.raw({ type: '*/*', limit: '100mb' }));

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

// 路由： /ysws.js
app.all('/ysws.js', async (req, res) => {
    try {
        const request_url = decodeURIComponent(req.query.url || '');
        if (!request_url) {
            return res.status(400).send('缺少 url 参数');
        }

        const parsedUrl = new URL(request_url);
        const host = parsedUrl.hostname;

        if (enable_domain_check && !allowed_domains.includes(host)) {
            return res.status(403).send('非法请求的域名');
        }

        const headers = { ...req.headers };
        delete headers.host;
        headers['Host'] = parsedUrl.host;
        headers['User-Agent'] = 'AppleCoreMedia/1.0.0.7B367 (iPad; U; CPU OS 4_3_3 like Mac OS X)';
        headers['Referer'] = `https://${host}/`;
        headers['Accept-Encoding'] = 'gzip, deflate';

        const method = req.method;
        const postData = req.body;

        const axiosOpt = {
            method,
            url: request_url,
            headers,
            data: method === 'POST' ? postData : undefined,
            maxRedirects: 0,
            validateStatus: () => true,
            responseType: 'arraybuffer',
            httpsAgent: new https.Agent({ rejectUnauthorized: false })
        };

        const response = await axios(axiosOpt);
        const http_code = response.status;
        const respHeaders = response.headers;
        let bodyBuf = response.data;

        // 3xx重定向，跳转给自己 /ysws.js
        if ([301, 302, 303, 307, 308].includes(http_code) && respHeaders.location) {
            let location = respHeaders.location;
            try {
                location = new URL(location, request_url).href;
            } catch (e) { }
            return res.redirect(http_code, `/ysws.js?url=${encodeURIComponent(location)}`);
        }

        let is_m3u8 = false;
        const contentType = (respHeaders['content-type'] || '').toLowerCase();
        const bodyStr = bodyBuf.toString('utf8');

        if (
            request_url.includes('.m3u8') ||
            contentType.includes('mpegurl') ||
            contentType.includes('application/x-mpegurl') ||
            bodyStr.trimStart().startsWith('#EXTM3U')
        ) {
            is_m3u8 = true;
        }

        if (is_m3u8) {
            const base_root = `${parsedUrl.protocol}//${parsedUrl.host}`;
            const base_dir = new URL('.', request_url).href;

            // m3u8内部资源全部替换为 ysws.js?url=xxx
            const newBody = bodyStr.replace(
                /(?<url>(https?:\/\/[^\s"\']+)|((\/|\.\.?\/)?[^\s"\']+))/gi,
                (...args) => {
                    const groups = args[args.length - 1];
                    let url = groups.url.trim();

                    if (url.startsWith('#')) return url;
                    if (url.startsWith('data:')) return url;
                    if (url.includes('ysws.js?url=')) return url;

                    if (/^https?:\/\//i.test(url)) {
                        return `ysws.js?url=${encodeURIComponent(url)}`;
                    }
                    if (url.startsWith('/')) {
                        return `ysws.js?url=${encodeURIComponent(base_root + url)}`;
                    }
                    return `ysws.js?url=${encodeURIComponent(base_dir + url)}`;
                }
            );
            bodyBuf = Buffer.from(newBody, 'utf8');
            res.setHeader('Content-Disposition', 'inline; filename=index.m3u8');
        }

        if (respHeaders['content-type']) {
            res.setHeader('Content-Type', respHeaders['content-type']);
        }
        res.status(http_code);
        res.end(bodyBuf);

    } catch (err) {
        console.error(err);
        res.status(500).send(`CURL ERROR: ${err.message}`);
    }
});

const port = 9000;
app.listen(port, () => {
    console.log(`运行：http://127.0.0.1:${port}/ysws.js?url=你的m3u8地址`);
});
