// 酷9播放器JS代理，移植自 ysws.js node版本
// 配置区
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

// 工具函数
function str_starts_with(haystack, needle) {
    return haystack.substring(0, needle.length) === needle;
}
function str_contains(haystack, needle) {
    return needle !== '' && haystack.indexOf(needle) !== -1;
}

// 解析url字符串返回对象 {protocol,host,hostname,pathname,href}
function parseUrl(urlStr) {
    return utils.parseUrl(urlStr);
}

// m3u8内容替换，把片段地址全部替换为本代理地址
function replaceM3u8Url(bodyStr, originUrlObj, selfUrl) {
    const base_root = `${originUrlObj.protocol}//${originUrlObj.host}`;
    let pathParts = originUrlObj.pathname.split('/');
    pathParts.pop();
    const base_dir = `${base_root}${pathParts.join('/')}/`;

    const reg = /(?<url>(https?:\/\/[^\s"']+)|((\/|\.\.?\/)?[^\s"']+))/gi;
    const output = bodyStr.replace(reg, (match, p1) => {
        let url = p1.trim();
        if(str_starts_with(url, '#')) return url;
        if(str_starts_with(url, 'data:')) return url;
        if(str_contains(url, '?url=')) return url;

        if(/^https?:\/\//i.test(url)){
            return `${selfUrl}?url=${utils.urlEncode(url)}`;
        }
        if(str_starts_with(url, '/')){
            return `${selfUrl}?url=${utils.urlEncode(base_root + url)}`;
        }
        return `${selfUrl}?url=${utils.urlEncode(base_dir + url)}`;
    });
    return output;
}

// 入口函数：酷9固定入口 function main(request,response)
async function main(request, response) {
    try {
        // 获取参数 url
        const targetRaw = request.getParam("url");
        if (!targetRaw) {
            response.setCode(400);
            response.setText("缺少 url 参数");
            return;
        }
        const targetUrlObj = parseUrl(targetRaw);
        if (!targetUrlObj || !targetUrlObj.href) {
            response.setCode(400);
            response.setText("url解析失败");
            return;
        }

        // 域名白名单校验
        if (enable_domain_check) {
            const host = targetUrlObj.hostname;
            if (!allowed_domains.includes(host)) {
                response.setCode(403);
                response.setText("非法请求的域名");
                return;
            }
        }

        // 组装请求头
        let headers = {};
        // 复制原请求头，剔除host
        const reqHeaders = request.getHeaders();
        for(let k in reqHeaders){
            const kl = k.toLowerCase();
            if(kl !== 'host'){
                headers[k] = reqHeaders[k];
            }
        }
        headers['Host'] = targetUrlObj.host;
        headers['User-Agent'] = "AppleCoreMedia/1.0.0.7B367 (iPad; U; CPU OS 4_3_3 like Mac OS X)";
        headers['Referer'] = `${targetUrlObj.protocol}//${targetUrlObj.host}/`;
        headers['Accept-Encoding'] = "gzip, deflate";

        // http请求
        const httpOpt = {
            url: targetUrlObj.href,
            method: request.getMethod(),
            headers: headers,
            followRedirect: false, // 关闭自动重定向，手动处理3xx
            body: request.getBody()
        };

        const fetchResp = await http.request(httpOpt);
        const httpCode = fetchResp.code;

        // 处理3xx重定向
        if ([301,302,303,307,308].includes(httpCode)) {
            let location = fetchResp.headers["location"] || fetchResp.headers["Location"];
            if(Array.isArray(location)) location = location[0];
            // 补全相对路径
            const fullLoc = utils.joinUrl(targetUrlObj.href, location);
            // 获取当前代理自身访问地址
            const selfProxyUrl = request.getSelfUrl();
            const newLoc = `${selfProxyUrl}?url=${utils.urlEncode(fullLoc)}`;
            response.setCode(httpCode);
            response.setHeader("Location", newLoc);
            return;
        }

        // 获取返回二进制 & contentType
        const respBuffer = fetchResp.raw();
        const contentType = fetchResp.getHeader("content-type") || "";

        // 设置响应头回传给播放器
        response.setCode(httpCode);
        response.setHeader("Content-Type", contentType);

        // 判断是否m3u8
        let isM3u8 = false;
        const respText = respBuffer.toString("utf-8");
        if(
            targetRaw.endsWith(".m3u8") ||
            contentType.toLowerCase().indexOf("mpegurl") !== -1 ||
            respText.trim().startsWith("#EXTM3U")
        ){
            isM3u8 = true;
        }

        if(isM3u8){
            const selfProxyUrl = request.getSelfUrl();
            const newM3u8 = replaceM3u8Url(respText, targetUrlObj, selfProxyUrl);
            response.setHeader("Content-Disposition","inline; filename=index.m3u8");
            response.setText(newM3u8);
        }else{
            // 非m3u8直接返回二进制流
            response.setRaw(respBuffer);
        }

    } catch (e) {
        response.setCode(500);
        response.setText("PROXY ERROR:" + e.message);
    }
}
