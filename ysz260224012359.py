# 文件名: ysz_spider.py

import json
import re
from urllib.parse import urljoin, quote, unquote

from base.spider import Spider


class Spider(Spider):
    """YSW影视爬虫 - 适配 https://ysz.wsmywlkj.top
    修复版本 - 基于实际网站结构重写
    """
    
    def __init__(self):
        self.host = "https://ysz.wsmywlkj.top"
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": self.host,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
        }
        self.home_data = None
        # 分类映射
        self.type_mapping = {
            "1": "电影",
            "2": "连续剧", 
            "3": "综艺",
            "4": "动漫"
        }
    
    def init(self, cfg):
        """初始化配置"""
        print("YSW影视爬虫初始化成功")
        return True
    
    def homeContent(self):
        """获取首页分类和推荐内容"""
        html = self.fetch(self.host, headers=self.headers)
        
        # 构建分类列表
        categories = []
        for type_id, type_name in self.type_mapping.items():
            categories.append({
                "type_id": type_id,
                "type_name": type_name
            })
        
        # 解析首页推荐视频
        videos = self._parse_home_videos(html)
        
        return {
            "class": categories,
            "list": videos
        }
    
    def categoryContent(self, tid, pg, filter, ext):
        """获取分类页内容
        
        Args:
            tid: 分类ID (1:电影, 2:连续剧, 3:综艺, 4:动漫)
            pg: 页码
            filter: 筛选参数
            ext: 扩展参数
        """
        # 根据实际网站的分类URL格式构建
        # 从网站观察，分类URL格式为 /show/1---2.html 之类的
        if pg == 1:
            url = f"{self.host}/show/{tid}-----------.html"
        else:
            url = f"{self.host}/show/{tid}-----------{pg}.html"
        
        html = self.fetch(url, headers=self.headers)
        
        # 解析视频列表
        videos = self._parse_video_list_new(html)
        
        # 获取总页数
        total_pages = self._parse_total_pages_new(html, tid)
        
        return {
            "page": pg,
            "pagecount": total_pages,
            "limit": len(videos),
            "total": total_pages * 20,  # 每页约20条
            "list": videos
        }
    
    def detailContent(self, ids):
        """获取详情页内容
        
        Args:
            ids: 视频ID列表
        """
        vid = ids[0]
        # 根据实际网站，详情页可能是 /detail/41835.html 或直接 /41835.html
        url = f"{self.host}/detail/{vid}.html"
        
        html = self.fetch(url, headers=self.headers)
        
        # 解析详情
        detail = self._parse_detail_new(html, vid)
        
        return [detail]
    
    def searchContent(self, key, quick):
        """搜索内容
        
        Args:
            key: 搜索关键词
            quick: 是否快速搜索
        """
        # 搜索URL格式
        url = f"{self.host}/search/{quote(key)}----------.html"
        
        html = self.fetch(url, headers=self.headers)
        
        # 解析搜索结果
        videos = self._parse_video_list_new(html)
        
        return videos
    
    def playerContent(self, ids, flag, video):
        """获取播放地址
        
        Args:
            ids: 播放ID (格式: 视频ID-播放源序号-剧集序号)
            flag: 播放源标识
            video: 视频信息
        """
        parts = ids.split("-")
        if len(parts) >= 3:
            vid, play_source, episode = parts[0], parts[1], parts[2]
        else:
            # 兼容旧格式
            vid = parts[0]
            play_source = "1"
            episode = "1"
        
        # 根据实际网站的播放页URL格式
        # 从网站看到的是 /play/41835-3-1.html 这样的格式
        url = f"{self.host}/play/{vid}-{play_source}-{episode}.html"
        
        html = self.fetch(url, headers=self.headers)
        
        # 提取真实视频地址
        video_url = self._parse_video_url_new(html)
        
        # 如果没有提取到，尝试从接口获取
        if not video_url or video_url.startswith("http") is False:
            video_url = self._get_video_url_from_api(vid, play_source, episode)
        
        return {
            "url": video_url,
            "parse": 0,  # 0表示直链，无需解析
            "header": json.dumps(self.headers),
            "ext": {
                "Referer": self.host
            }
        }
    
    # ==================== 重写的解析方法 ====================
    
    def _parse_home_videos(self, html):
        """解析首页推荐视频"""
        videos = []
        
        # 匹配首页正在热播区域的视频
        # 模式: <a href="/detail/41835.html" title="标题"> <img src="图片地址"> 等等
        pattern = r'<a[^>]*href="/(?:play|detail)/(\d+)(?:[^"]*)"[^>]*>\s*<div[^>]*class="[^"]*play-img[^"]*"[^>]*>\s*<img[^"]*src="([^"]+)"[^>]*alt="([^"]*)"'
        matches = re.findall(pattern, html, re.DOTALL)
        
        for vid, img, title in matches:
            # 获取备注信息（更新状态）
            remark = self._extract_remark(html, vid)
            
            videos.append({
                "vod_id": vid,
                "vod_name": title.strip(),
                "vod_pic": urljoin(self.host, img.strip()),
                "vod_remarks": remark
            })
        
        # 如果没有匹配到，尝试另一种模式
        if not videos:
            pattern2 = r'<a[^>]*href="/(?:play|detail)/(\d+)(?:[^"]*)"[^>]*>\s*<img[^"]*src="([^"]+)"[^>]*alt="([^"]*)"'
            matches = re.findall(pattern2, html, re.DOTALL)
            
            for vid, img, title in matches:
                videos.append({
                    "vod_id": vid,
                    "vod_name": title.strip(),
                    "vod_pic": urljoin(self.host, img.strip()),
                    "vod_remarks": ""
                })
        
        return videos
    
    def _parse_video_list_new(self, html):
        """解析视频列表页面（新版）"""
        videos = []
        
        # 根据网站实际结构，视频条目通常在带有play-list类的元素中
        # 先提取所有视频条目块
        items_pattern = r'<div[^>]*class="[^"]*play-item[^"]*"[^>]*>(.*?)</div>\s*</div>'
        items = re.findall(items_pattern, html, re.DOTALL)
        
        for item in items:
            # 提取视频ID和标题
            link_pattern = r'<a[^>]*href="/(?:play|detail)/(\d+)(?:[^"]*)"[^>]*>([^<]+)</a>'
            link_match = re.search(link_pattern, item)
            
            if not link_match:
                # 尝试另一种链接格式
                link_pattern2 = r'<a[^>]*href="([^"]+)"[^>]*>([^<]+)</a>'
                link_match2 = re.search(link_pattern2, item)
                if link_match2:
                    href = link_match2.group(1)
                    title = link_match2.group(2).strip()
                    # 从href中提取ID
                    vid_match = re.search(r'/(\d+)\.', href)
                    if vid_match:
                        vid = vid_match.group(1)
                    else:
                        continue
                else:
                    continue
            else:
                vid = link_match.group(1)
                title = link_match.group(2).strip()
            
            # 提取图片
            img_pattern = r'<img[^>]*src="([^"]+)"[^>]*>'
            img_match = re.search(img_pattern, item)
            img = img_match.group(1) if img_match else ""
            
            # 提取备注（更新集数等）
            remark_pattern = r'<div[^>]*class="[^"]*play-hover[^"]*"[^>]*>([^<]+)</div>'
            remark_match = re.search(remark_pattern, item)
            remark = remark_match.group(1).strip() if remark_match else ""
            
            videos.append({
                "vod_id": vid,
                "vod_name": title,
                "vod_pic": urljoin(self.host, img),
                "vod_remarks": remark
            })
        
        # 如果上面的方法没匹配到，回退到简单的链接匹配
        if not videos:
            pattern = r'<a[^>]*href="/(?:play|detail)/(\d+)(?:[^"]*)"[^>]*>\s*<img[^"]*src="([^"]+)"[^>]*alt="([^"]*)"'
            matches = re.findall(pattern, html, re.DOTALL)
            
            for vid, img, title in matches:
                videos.append({
                    "vod_id": vid,
                    "vod_name": title.strip(),
                    "vod_pic": urljoin(self.host, img.strip()),
                    "vod_remarks": ""
                })
        
        return videos
    
    def _parse_total_pages_new(self, html, tid):
        """解析总页数（新版）"""
        # 查找分页信息
        # 常见的分页格式: <a href="/show/1-----------2.html">2</a>
        pattern = r'<a[^>]*href="[^"]*/show/{}\.-+(\d+)\.html"[^>]*>(\d+)</a>'.format(tid)
        matches = re.findall(pattern, html)
        
        if matches:
            # 获取最大页码
            pages = [int(m[1]) for m in matches]
            return max(pages) if pages else 1
        
        # 另一种分页格式
        pattern2 = r'<a[^>]*href="[^"]*{}---(\d+)---\.html"[^>]*>(\d+)</a>'.format(tid)
        matches2 = re.findall(pattern2, html)
        
        if matches2:
            pages = [int(m[1]) for m in matches2]
            return max(pages) if pages else 1
        
        # 如果找不到分页，但有"下一页"链接，说明有多页
        if re.search(r'下一页|下页|>下一页<|>下页<', html):
            # 尝试从当前URL或其它地方获取最大页数，这里返回一个默认值
            return 10
        
        return 1
    
    def _parse_detail_new(self, html, vid):
        """解析详情页（新版）"""
        detail = {
            "vod_id": vid,
            "vod_name": "",
            "vod_pic": "",
            "vod_content": "",
            "vod_actor": "",
            "vod_director": "",
            "vod_year": "",
            "vod_area": "",
            "vod_remarks": "",
            "vod_play_from": "",
            "vod_play_url": ""
        }
        
        # 提取标题 - 通常在h1或h2标签中
        title_pattern = r'<h1[^>]*>([^<]+)</h1>'
        title_match = re.search(title_pattern, html)
        if title_match:
            detail["vod_name"] = title_match.group(1).strip()
        else:
            # 尝试从title标签提取
            title_match2 = re.search(r'<title>([^<]+)-', html)
            if title_match2:
                detail["vod_name"] = title_match2.group(1).strip()
        
        # 提取封面图
        img_pattern = r'<img[^>]*src="([^"]+)"[^>]*class="[^"]*lazyload[^"]*"[^>]*>'
        img_match = re.search(img_pattern, html)
        if not img_match:
            img_pattern = r'<div[^>]*class="[^"]*detail-pic[^"]*"[^>]*>\s*<img[^>]*src="([^"]+)"'
            img_match = re.search(img_pattern, html)
        if not img_match:
            img_pattern = r'<img[^>]*src="([^"]+)"[^>]*alt="' + re.escape(detail["vod_name"]) + '"'
            img_match = re.search(img_pattern, html)
        
        if img_match:
            detail["vod_pic"] = urljoin(self.host, img_match.group(1).strip())
        
        # 提取简介
        desc_pattern = r'<div[^>]*class="[^"]*detail-desc[^"]*"[^>]*>([\s\S]*?)</div>'
        desc_match = re.search(desc_pattern, html)
        if not desc_match:
            desc_pattern = r'<div[^>]*class="[^"]*synopsis[^"]*"[^>]*>([\s\S]*?)</div>'
            desc_match = re.search(desc_pattern, html)
        if not desc_match:
            desc_pattern = r'<p[^>]*class="[^"]*desc[^"]*"[^>]*>([\s\S]*?)</p>'
            desc_match = re.search(desc_pattern, html)
        
        if desc_match:
            detail["vod_content"] = re.sub(r'<[^>]+>', '', desc_match.group(1)).strip()
        
        # 提取元数据（演员、导演、年份等）- 通常在列表形式的dl或ul中
        # 演员
        actor_pattern = r'导演[：:]([^<]+)'
        actor_match = re.search(actor_pattern, html)
        if actor_match:
            detail["vod_actor"] = actor_match.group(1).strip()
        else:
            # 尝试另一种格式
            actor_pattern2 = r'<span[^>]*>导演[：:]</span>\s*<[^>]*>([^<]+)</'
            actor_match2 = re.search(actor_pattern2, html)
            if actor_match2:
                detail["vod_actor"] = actor_match2.group(1).strip()
        
        # 导演
        director_pattern = r'导演[：:]([^<]+)'
        director_match = re.search(director_pattern, html)
        if director_match:
            detail["vod_director"] = director_match.group(1).strip()
        else:
            director_pattern2 = r'<span[^>]*>导演[：:]</span>\s*<[^>]*>([^<]+)</'
            director_match2 = re.search(director_pattern2, html)
            if director_match2:
                detail["vod_director"] = director_match2.group(1).strip()
        
        # 年份
        year_pattern = r'年份[：:]([^<]+)'
        year_match = re.search(year_pattern, html)
        if year_match:
            detail["vod_year"] = year_match.group(1).strip()
        else:
            year_pattern2 = r'<span[^>]*>年份[：:]</span>\s*<[^>]*>([^<]+)</'
            year_match2 = re.search(year_pattern2, html)
            if year_match2:
                detail["vod_year"] = year_match2.group(1).strip()
        
        # 地区
        area_pattern = r'地区[：:]([^<]+)'
        area_match = re.search(area_pattern, html)
        if area_match:
            detail["vod_area"] = area_match.group(1).strip()
        else:
            area_pattern2 = r'<span[^>]*>地区[：:]</span>\s*<[^>]*>([^<]+)</'
            area_match2 = re.search(area_pattern2, html)
            if area_match2:
                detail["vod_area"] = area_match2.group(1).strip()
        
        # 备注（更新状态等）
        remarks_pattern = r'更新[：:]([^<]+)'
        remarks_match = re.search(remarks_pattern, html)
        if remarks_match:
            detail["vod_remarks"] = remarks_match.group(1).strip()
        else:
            # 从页面中找"更新至XX集"这样的文本
            remarks_pattern2 = r'更新至\s*(\d+)'
            remarks_match2 = re.search(remarks_pattern2, html)
            if remarks_match2:
                detail["vod_remarks"] = f"更新至{remarks_match2.group(1)}集"
        
        # 提取播放列表
        play_from, play_url = self._parse_playlist_new(html, vid)
        detail["vod_play_from"] = play_from
        detail["vod_play_url"] = play_url
        
        return detail
    
    def _parse_playlist_new(self, html, vid):
        """解析播放列表（新版）"""
        play_from = []
        play_url = {}
        
        # 查找播放源区域
        # 通常播放源在带有swiper-wrapper或play-source类的元素中
        
        # 提取播放源名称
        source_pattern = r'<div[^>]*class="[^"]*play-source[^"]*"[^>]*>\s*<span[^>]*>([^<]+)</span>'
        sources = re.findall(source_pattern, html)
        
        if not sources:
            # 尝试另一种格式
            source_pattern2 = r'<h3[^>]*>([^<]+)</h3>'
            sources = re.findall(source_pattern2, html)
        
        # 如果没有找到播放源名称，使用默认名称
        if not sources:
            sources = ["线路一"]
        
        # 提取剧集列表
        # 剧集通常在带有play-list或episode类的元素中
        episodes_pattern = r'<a[^>]*href="/(?:play|detail)/([^"]+)"[^>]*class="[^"]*episode-item[^"]*"[^>]*>([^<]+)</a>'
        episodes = re.findall(episodes_pattern, html)
        
        # 如果没有匹配到，尝试更通用的匹配
        if not episodes:
            episodes_pattern2 = r'<a[^>]*href="/(?:play|detail)/([^"]+)"[^>]*>([^<]+)</a>'
            all_links = re.findall(episodes_pattern2, html)
            # 过滤出看起来像剧集链接的（包含数字）
            episodes = []
            for link_id, link_text in all_links:
                if re.search(r'\d+', link_text) and len(link_text) < 20:
                    episodes.append((link_id, link_text))
        
        # 构建播放URL字符串
        if episodes:
            # 为每个播放源构建剧集列表
            for idx, source in enumerate(sources):
                source_key = f"ysw_{idx+1}" if idx > 0 else "ysw"
                play_from.append(source_key)
                
                episode_list = []
                for ep_id, ep_name in episodes:
                    # 确保ep_id包含完整信息
                    if vid in ep_id:
                        episode_list.append(f"{ep_name}${ep_id}")
                    else:
                        episode_list.append(f"{ep_name}${vid}-{idx+1}-{ep_name}")
                
                if episode_list:
                    play_url[source_key] = "#".join(episode_list)
        else:
            # 如果没有找到剧集，添加一个默认
            play_from.append("ysw")
            play_url["ysw"] = f"第1集${vid}-1-1"
        
        return "$".join(play_from), json.dumps(play_url, ensure_ascii=False)
    
    def _parse_video_url_new(self, html):
        """解析真实的视频地址（新版）"""
        # 尝试多种模式提取视频URL
        
        # 模式1: 在script标签中的player_aaaa变量
        pattern1 = r'player_aaaa[^=]*=\s*["\']([^"\']+)["\']'
        match = re.search(pattern1, html)
        if match:
            return match.group(1)
        
        # 模式2: 在script标签中的url变量
        pattern2 = r'url[^=]*=\s*["\']([^"\']+)["\']'
        match = re.search(pattern2, html)
        if match:
            return match.group(1)
        
        # 模式3: 视频标签的src属性
        pattern3 = r'<video[^>]*src="([^"]+)"'
        match = re.search(pattern3, html)
        if match:
            return match.group(1)
        
        # 模式4: iframe嵌套
        pattern4 = r'<iframe[^>]*src="([^"]+)"'
        match = re.search(pattern4, html)
        if match:
            return match.group(1)
        
        # 模式5: 在script标签中的video_url变量
        pattern5 = r'video_url[^=]*=\s*["\']([^"\']+)["\']'
        match = re.search(pattern5, html)
        if match:
            return match.group(1)
        
        # 模式6: 在script标签中的play_url变量
        pattern6 = r'play_url[^=]*=\s*["\']([^"\']+)["\']'
        match = re.search(pattern6, html)
        if match:
            return match.group(1)
        
        return ""
    
    def _get_video_url_from_api(self, vid, play_source, episode):
        """从API接口获取视频地址"""
        # 尝试多种可能的API接口
        api_urls = [
            f"{self.host}/api/play/{vid}",
            f"{self.host}/api/video/{vid}",
            f"{self.host}/api/url/{vid}",
            f"{self.host}/index.php/api/play/{vid}"
        ]
        
        for api_url in api_urls:
            try:
                # 尝试GET请求
                json_str = self.fetch(api_url, headers=self.headers)
                data = json.loads(json_str)
                
                # 尝试多种可能的字段名
                for field in ['url', 'video_url', 'play_url', 'link', 'src']:
                    if field in data and data[field]:
                        return data[field]
                
                # 如果返回的是列表
                if isinstance(data, list) and len(data) > 0:
                    if 'url' in data[0]:
                        return data[0]['url']
            except:
                continue
        
        return ""
    
    def _extract_remark(self, html, vid):
        """从HTML中提取视频备注信息"""
        # 查找包含vid的附近文本中的更新信息
        pattern = r'<a[^>]*href="[^"]*{}[^"]*"[^>]*>.*?更新至\s*(\d+)[^<]*'.format(vid)
        match = re.search(pattern, html, re.DOTALL)
        if match:
            return f"更新至{match.group(1)}集"
        
        # 更通用的匹配
        pattern2 = r'更新至\s*(\d+)[^<]*</a>'
        match2 = re.search(pattern2, html)
        if match2:
            return f"更新至{match2.group(1)}集"
        
        return ""
    
    # ==================== 辅助方法 ====================
    
    def isVideoFormat(self, url):
        """判断是否为视频格式"""
        video_exts = ['.mp4', '.m3u8', '.flv', '.mkv', '.avi', '.mov', '.wmv', '.rmvb']
        url_lower = url.lower()
        return any(url_lower.endswith(ext) for ext in video_exts)
    
    def manualVideoCheck(self):
        """手动视频检查"""
        return False
    
    def localProxy(self, param):
        """本地代理"""
        return None
    
    def destroy(self):
        """销毁时清理"""
        pass