# -*- coding: utf-8 -*-
# 规则名：栖光影视 (ysz.wsmywlkj.top) drpy 版
# 作者：Grok 生成模板
# 适用：OK影视 / FongMi / CatVod 等支持 drpy 的壳子
# 注意：这个站本身是标准 vod 接口，建议优先用 type=0 接口方式

import re
import json
from base64 import b64decode

def init(ext):
    # 可选：在这里定义扩展参数，比如过滤器
    pass

def homeContent(filter):
    # 首页分类列表
    url = 'https://ysz.wsmywlkj.top/api.php/provide/vod/?ac=list'
    html = spider(url, 'get')
    jo = json.loads(html)
    
    classes = []
    for c in jo.get('class', []):
        classes.append({
            'type_id': str(c['type_id']),
            'type_name': c['type_name']
        })
    
    return {
        'class': classes,
        'filters': {}   # 如果有筛选条件可以在这里加，目前这个站没有复杂筛选
    }

def homeVideoContent():
    # 首页推荐视频（可返回空，或直接取第一页）
    return categoryContent('1', '1', '10', '')

def categoryContent(tid, pg, filter, extend):
    # 分类页 / 筛选
    url = f'https://ysz.wsmywlkj.top/api.php/provide/vod/?ac=videolist&t={tid}&pg={pg}&pagesize=20'
    html = spider(url, 'get')
    jo = json.loads(html)
    
    videos = []
    for v in jo.get('list', []):
        videos.append({
            'vod_id': str(v['vod_id']),
            'vod_name': v['vod_name'],
            'vod_pic': v.get('vod_pic', ''),
            'vod_remarks': v.get('vod_remarks', '')
        })
    
    return {
        'page': jo.get('page'),
        'pagecount': jo.get('pagecount'),
        'limit': 20,
        'total': jo.get('total'),
        'list': videos
    }

def detailContent(ids):
    # 详情页
    url = f'https://ysz.wsmywlkj.top/api.php/provide/vod/?ac=detail&ids={ids}'
    html = spider(url, 'get')
    jo = json.loads(html)
    if not jo.get('list'):
        return {'list': []}
    
    v = jo['list'][0]
    
    play_from = v.get('vod_play_from', '').split('$$$')
    play_url = v.get('vod_play_url', '').split('$$$')
    
    playList = []
    for i in range(len(play_from)):
        from_name = play_from[i]
        urls = play_url[i].split('#')
        playurls = []
        for u in urls:
            if '$' in u:
                name, link = u.split('$', 1)
                playurls.append(f'{name}${link}')
            else:
                playurls.append(u)
        playList.append(f"{from_name}${'#'.join(playurls)}")
    
    return {
        'list': [{
            'vod_id': str(v['vod_id']),
            'vod_name': v['vod_name'],
            'vod_pic': v.get('vod_pic', ''),
            'type_name': v.get('type_name', ''),
            'vod_year': v.get('vod_year', ''),
            'vod_area': v.get('vod_area', ''),
            'vod_remarks': v.get('vod_remarks', ''),
            'vod_actor': v.get('vod_actor', ''),
            'vod_director': v.get('vod_director', ''),
            'vod_content': v.get('vod_content', v.get('vod_blurb', '')),
            'vod_play_from': '$$$'.join(play_from),
            'vod_play_url': '$$$'.join(play_url)   # 或直接用上面格式化的
        }]
    }

def searchContent(key, pg, quick):
    # 搜索
    url = f'https://ysz.wsmywlkj.top/api.php/provide/vod/?wd={key}'
    html = spider(url, 'get')
    jo = json.loads(html)
    
    videos = []
    for v in jo.get('list', []):
        videos.append({
            'vod_id': str(v['vod_id']),
            'vod_name': v['vod_name'],
            'vod_pic': v.get('vod_pic', ''),
            'vod_remarks': v.get('vod_remarks', '')
        })
    
    return {
        'page': 1,
        'pagecount': 1,
        'limit': len(videos),
        'total': len(videos),
        'list': videos
    }

def playerContent(flag, id, vipFlags):
    # 播放页（直接返回链接）
    return {
        'parse': '0',
        'playUrl': '',
        'url': id   # id 就是播放链接本身
    }

# 通用请求函数（drpy 标准写法）
def spider(url, method='get', **kwargs):
    # 这里可以加 headers、proxy 等
    if method == 'get':
        return requests.get(url, timeout=10).text
    # 可扩展 post 等
    return ''

# drpy 必须有的空函数
def localDetailContent(tid):
    return detailContent(tid)

def localPlayerContent(flag, id):
    return playerContent(flag, id, '')