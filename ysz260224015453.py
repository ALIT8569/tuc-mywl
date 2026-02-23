# -*- coding: utf-8 -*-
# drpy 规则：栖光影视 (ysz.wsmywlkj.top)
# 目标：在OK影视显示分类 + 年份 + 地区 + 语言筛选栏
# 注意：这个站是标准vod接口，写 drpy 只是为了满足“用py文件加载”的需求

rule = {
    "author": "自动生成",
    "title": "栖光影视",
    "host": "https://ysz.wsmywlkj.top",
    "header": {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
    "timeout": 15,
    "cateManual": {},           # 先空着，后面 homeContent 动态填充
    "homeUrl": "/api.php/provide/vod/?ac=list",
    "dcVipFlag": "true",        # 是否有付费内容（可选）
    "pCfgJs": "",
    "pSize": "",
    "class_url": "",            # 不需要，因为用API
}

# 常见筛选选项（从实际站点采样 + API 支持的参数）
# 你可以后期手动扩展更多年份
筛选 = {
    "年份": ["全部", "2026", "2025", "2024", "2023", "2022", "2021", "2020", "2019", "更早"],
    "地区": ["全部", "大陆", "香港", "台湾", "美国", "韩国", "日本", "泰国", "印度", "其他"],
    "语言": ["全部", "国语", "粤语", "英语", "韩语", "日语", "中字", "原声"],
    "类型": ["全部"]  # 类型其实就是分类，这里留空或动态
}

def init(ext):
    # ext 如果传入字符串，可以解析成筛选，但这里我们硬编码
    pass

def homeContent(filter):
    # 获取分类
    url = f'{rule["host"]}/api.php/provide/vod/?ac=list'
    html = spider(url)
    jo = json.loads(html)
    
    classes = []
    for c in jo.get("class", []):
        type_id = str(c["type_id"])
        classes.append({
            "type_id": type_id,
            "type_name": c["type_name"]
        })
    
    # 返回分类 + 筛选（ext）
    return {
        "class": classes,
        "filters": {str(c["type_id"]): 筛选 for c in classes}   # 每个分类都应用相同的筛选
    }

def homeVideoContent():
    # 首页推荐（取第一页热门或最新）
    return categoryContent("1", "1", "", {})   # 默认用电影分类

def categoryContent(tid, pg, filter, extend):
    # 分类列表 + 筛选参数
    params = {
        "ac": "videolist",
        "t": tid,
        "pg": pg,
        "pagesize": "20"
    }
    
    # 应用筛选（extend 是用户选择的筛选）
    if "年份" in extend and extend["年份"] != "全部":
        params["y"] = extend["年份"]   # 注意：API 参数可能是 year 或 y，根据实际测试
    if "地区" in extend and extend["地区"] != "全部":
        params["area"] = extend["地区"]
    if "语言" in extend and extend["语言"] != "全部":
        params["lang"] = extend["语言"]
    
    url = f'{rule["host"]}/api.php/provide/vod/'
    html = spider(url, params=params)
    jo = json.loads(html)
    
    videos = []
    for v in jo.get("list", []):
        videos.append({
            "vod_id": str(v["vod_id"]),
            "vod_name": v["vod_name"],
            "vod_pic": v.get("vod_pic", ""),
            "vod_remarks": v.get("vod_remarks", "")
        })
    
    return {
        "page": jo.get("page", 1),
        "pagecount": jo.get("pagecount", 1),
        "limit": 20,
        "total": jo.get("total", 0),
        "list": videos
    }

def detailContent(ids):
    url = f'{rule["host"]}/api.php/provide/vod/?ac=detail&ids={ids}'
    html = spider(url)
    jo = json.loads(html)
    if not jo.get("list"):
        return {"list": []}
    
    v = jo["list"][0]
    play_from = v.get("vod_play_from", "").split("$$$")
    play_url = v.get("vod_play_url", "").split("$$$")
    
    vod_play_from = "$$$".join(play_from)
    vod_play_url = "$$$".join(play_url)
    
    return {
        "list": [{
            "vod_id": v["vod_id"],
            "vod_name": v["vod_name"],
            "vod_pic": v.get("vod_pic", ""),
            "type_name": v.get("type_name", ""),
            "vod_year": v.get("vod_year", ""),
            "vod_area": v.get("vod_area", ""),
            "vod_remarks": v.get("vod_remarks", ""),
            "vod_actor": v.get("vod_actor", ""),
            "vod_director": v.get("vod_director", ""),
            "vod_content": v.get("vod_content", ""),
            "vod_play_from": vod_play_from,
            "vod_play_url": vod_play_url
        }]
    }

def searchContent(key, pg, quick):
    url = f'{rule["host"]}/api.php/provide/vod/?wd={key}'
    html = spider(url)
    jo = json.loads(html)
    
    videos = []
    for v in jo.get("list", []):
        videos.append({
            "vod_id": str(v["vod_id"]),
            "vod_name": v["vod_name"],
            "vod_pic": v.get("vod_pic", ""),
            "vod_remarks": v.get("vod_remarks", "")
        })
    
    return {
        "list": videos
    }

def playerContent(flag, id, vipFlags):
    # 直接返回链接（因为API给的就是播放地址）
    return {
        "parse": "0",
        "playUrl": "",
        "url": id
    }

# 通用请求（drpy 标准）
def spider(url, params=None):
    if params is None:
        params = {}
    try:
        import requests
        r = requests.get(url, params=params, headers=rule["header"], timeout=rule["timeout"])
        r.encoding = "utf-8"
        return r.text
    except:
        return ""