// 酷9 JS代理 ysws 修复版
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

function str_starts_with(haystack, needle) {
    return haystack.substring(0, needle.length) === needle;
}
function str_contains(haystack, needle) {
    return needle !== '' && haystack.indexOf(needle) !== -1;
}

function parseUrl(urlStr) {
    return utils.parseUrl(urlStr);
}

// m3u8地址替换，修复正则，只处理媒体行，跳过#注释行
function replaceM3u8Url(bodyStr, originUrlObj, selfUrl) {
    const base_root = `${originUrlObj.protocol}//${originUrlObj.host}`;
    let pathParts = originUrlObj.pathname.split('/');
    pathParts.pop();
    const base_dir = `${base_root}${pathParts.join('/')}/`;

    // 按行处理m3u8，跳过#开头注释行，只替换资源行，比全局正则更可靠
    const lines = bodyStr.split(/\r?\n/);
    const outputLines = [];
    for(let line of lines){
        const trimLine = line.trim();
        if(str_starts_with(trimLine,'#')){
            outputLines.push(line);
            continue;
        }
        if(trimLine === ''){
            outputLines.push(line);
            continue;
        }
        let url = trimLine;
        if(str_contains(url, '?url=')){
            outputLines.push(line);
            continue;
        }
        let newUrl;
        if(/^https?:\/\//i.test(url)){
            newUrl = `${selfUrl}?url=${utils.urlEncode(url)}`;
        }else if(str_starts_with(url, '/')){
            newUrl = `${selfUrl}?url=${utils.urlEncode(base_root + url)}`;
        }else{
            newUrl = `${selfUrl}?url=${utils.urlEncode(base_dir + url)}`;
        }
        outputLines.push(line.replace(url, newUrl));
    }
    return outputLines.join('\n');
}

async function main(request, response) {
    try {
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

        if (enable_domain_check) {
            const host = targetUrlObj.hostname;
            if (!allowed_domains.includes(host)) {
                response.setCode(403);
                response.setText("非法请求的域名");
                return;
            }
        }

        let headers = {};
        const reqHeaders = request.getHeaders();
        for(let k in reqHeaders){
            const kl = k.toLowerCase();
            if(kl !== 'host'){
                headers[k] = reqHeaders[k];
            }
        }
        headers['Host'] = targetUrlObj.host;
        headers['User‑Agent'] = "AppleCoreMedia/1.0.0.7B367 (iPad; U; CPU OS 4_3_3 like Mac OS X)";
        headers['Referer'] = `${targetUrlObj.protocol}//${targetUrlObj.host}/`;
        headers['Accept‑Encoding'] = "gzip, deflate";

        const httpOpt = {
            url: targetUrlObj.href,
            method: request.getMethod(),
            headers: headers,
            followRedirect: false,
            body: request.getBody()
        };

        const fetchResp = await http.request(httpOpt);
        const httpCode = fetchResp.code;

        // 处理3xx重定向
        if ([301,302,303,307,308].includes(httpCode)) {
            let location = fetchResp.headers["location"] || fetchResp.headers["Location"];
            if(Array.isArray(location)) location = location[0];
            const fullLoc = utils.joinUrl(targetUrlObj.href, location);
            // 如果重定向目标是m3u8，不返回302，直接内部请求，让脚本解析m3u8
            if(fullLoc.toLowerCase().endsWith('.m3u8')){
                // 内部重新请求真实m3u8地址
                httpOpt.url = fullLoc;
                const realResp = await http.request(httpOpt);
                fetchResp.code = realResp.code;
                fetchResp.headers = realResp.headers;
                fetchResp._raw = realResp.raw();
            }else{
                const selfProxyUrl = request.getSelfUrl();
                const newLoc = `${selfProxyUrl}?url=${utils.urlEncode(fullLoc)}`;
                response.setCode(httpCode);
                response.setHeader("Location", newLoc);
                return;
            }
        }

        const respBuffer = fetchResp.raw();
        const contentType = fetchResp.getHeader("content‑type") || "";

        response.setCode(fetchResp.code);
        response.setHeader("Content‑Type", contentType);

        // 尝试utf8解码，如果不是EXTM3U，再尝试gbk解码
        let respText = respBuffer.toString("utf‑8");
        let isM3u8 = false;
        if(
            targetRaw.toLowerCase().endsWith(".m3u8") ||
            contentType.toLowerCase().indexOf("mpegurl") !== -1 ||
            respText.trim().startsWith("#EXTM3U")
        ){
            isM3u8 = true;
        }else{
            // 尝试gbk编码
            try{
                respText = utils.decodeGbk(respBuffer);
                if(respText.trim().startsWith("#EXTM3U")){
                    isM3u8 = true;
                }
            }catch(e){
                // gbk解码失败，忽略
            }
        }

        // 调试日志，打开脚本日志窗口可以看到内容
        utils.log("isM3u8="+isM3u8+" target="+targetRaw);
        if(isM3u8){
            utils.log("原始m3u8内容:\n"+respText.substring(0,800));
            const selfProxyUrl = request.getSelfUrl();
            const newM3u8 = replaceM3u8Url(respText, targetUrlObj, selfProxyUrl);
            utils.log("处理后m3u8:\n"+newM3u8.substring(0,800));
            response.setHeader("Content‑Disposition","inline; filename=index.m3u8");
            response.setText(newM3u8);
        }else{
            utils.log("不是m3u8，直接透传二进制");
            response.setRaw(respBuffer);
        }

    } catch (e) {
        utils.log("异常:"+e.message+"\n"+e.stack);
        response.setCode(500);
        response.setText("PROXY ERROR:" + e.message);
    }
}
