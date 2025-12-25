// ==UserScript==
// @name         NodeSeek 增强助手
// @namespace    https://github.com/weiruankeji2025/weiruan-nodeseek-Sign.in
// @version      2.3.0
// @description  NodeSeek论坛增强：自动签到 + 交易监控 + 抽奖追踪 + 关键字监控 + 自动翻页
// @author       weiruankeji2025
// @match        https://www.nodeseek.com/*
// @icon         https://www.nodeseek.com/favicon.ico
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @grant        GM_addStyle
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // ==================== 配置 ====================
    const CONFIG = {
        API_URL: 'https://www.nodeseek.com/api/attendance',
        TRADE_URL: 'https://www.nodeseek.com/categories/trade',
        SCAM_URL: 'https://www.nodeseek.com/categories/scam',
        HOME_URL: 'https://www.nodeseek.com/',
        STORAGE_KEY: 'ns_last_checkin',
        VISITED_KEY: 'ns_visited_posts',
        WIN_CHECK_KEY: 'ns_win_check',
        KEYWORD_KEY: 'ns_keywords',
        KEYWORD_NOTIFIED_KEY: 'ns_keyword_notified',
        RANDOM_MODE: true,
        TRADE_COUNT: 5,
        LOTTERY_COUNT: 5,
        SCAM_COUNT: 5,
        WIN_CHECK_INTERVAL: 10 * 60 * 1000,

        // ========== 关键字监控配置 ==========
        // 精准匹配关键字（完全匹配标题中的词）
        KEYWORDS_EXACT: ['VPS', 'CN2', 'GIA'],
        // 模糊匹配关键字（标题包含即匹配）
        KEYWORDS_FUZZY: ['优惠', '特价', '免费', '白嫖', '羊毛'],
        // 监控间隔（毫秒）
        KEYWORD_MONITOR_INTERVAL: 30 * 1000,
        // 是否启用关键字监控
        KEYWORD_MONITOR_ENABLED: true,

        // ========== 自动翻页配置 ==========
        // 是否启用自动翻页
        AUTO_PAGE_ENABLED: false,
        // 翻页间隔（秒）
        AUTO_PAGE_INTERVAL: 60
    };

    // ==================== 样式注入 ====================
    GM_addStyle(`
        /* 全站已浏览帖子标记 */
        .post-list a.ns-visited-post,
        .post-item a.ns-visited-post,
        [class*="post"] a.ns-visited-post,
        a.post-title.ns-visited-post {
            color: #e74c3c !important;
            position: relative;
        }
        .post-list a.ns-visited-post::after,
        .post-item a.ns-visited-post::after,
        [class*="post"] a.ns-visited-post::after,
        a.post-title.ns-visited-post::after {
            content: ' [已浏览]';
            font-size: 10px;
            color: #e74c3c;
            font-weight: normal;
        }

        /* 侧边栏 */
        .ns-sidebar {
            position: fixed;
            right: 10px;
            top: 70px;
            width: 220px;
            max-height: calc(100vh - 90px);
            overflow-y: auto;
            z-index: 9998;
            display: flex;
            flex-direction: column;
            gap: 6px;
            scrollbar-width: thin;
        }
        .ns-sidebar::-webkit-scrollbar { width: 4px; }
        .ns-sidebar::-webkit-scrollbar-thumb { background: #ccc; border-radius: 2px; }

        .ns-card {
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 1px 6px rgba(0,0,0,0.1);
            overflow: hidden;
            font-size: 12px;
        }
        .ns-card-header {
            padding: 6px 10px;
            font-weight: 600;
            font-size: 11px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            user-select: none;
        }
        .ns-card-toggle { opacity: 0.7; font-size: 10px; }
        .ns-card.collapsed .ns-card-body { display: none; }

        .ns-card.trade .ns-card-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; }
        .ns-card.lottery .ns-card-header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: #fff; }
        .ns-card.scam .ns-card-header { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: #fff; }
        .ns-card.keyword .ns-card-header { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: #fff; }
        .ns-card.autopage .ns-card-header { background: linear-gradient(135deg, #4776E6 0%, #8E54E9 100%); color: #fff; }

        .ns-item {
            padding: 5px 10px;
            border-bottom: 1px solid #f0f0f0;
            transition: background 0.15s;
        }
        .ns-item:last-child { border-bottom: none; }
        .ns-item:hover { background: #f8f9fa; }
        .ns-item a {
            color: #333;
            text-decoration: none;
            display: flex;
            flex-direction: column;
            gap: 2px;
            line-height: 1.3;
            font-size: 11px;
        }
        .ns-item a:hover { color: #1890ff; }

        .ns-item.visited { background: #fff5f5; }
        .ns-item.visited a { color: #e74c3c; }
        .ns-item.visited .ns-tag { opacity: 0.7; }
        .ns-visited-mark { font-size: 9px; color: #e74c3c; margin-left: 4px; }

        .ns-item-row {
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .ns-tag {
            flex-shrink: 0;
            padding: 1px 4px;
            font-size: 9px;
            border-radius: 2px;
            color: #fff;
            font-weight: 500;
        }
        .ns-tag.sell { background: #ff7875; }
        .ns-tag.buy { background: #40a9ff; }
        .ns-tag.lottery { background: #73d13d; }
        .ns-tag.scam { background: #ff4d4f; }
        .ns-tag.exact { background: #52c41a; }
        .ns-tag.fuzzy { background: #13c2c2; }

        .ns-title {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .ns-lottery-time {
            font-size: 9px;
            color: #fa8c16;
            padding-left: 24px;
        }

        .ns-empty { text-align: center; padding: 10px; color: #999; font-size: 11px; }
        .ns-loading { color: #1890ff; }

        /* 自动翻页控制面板 */
        .ns-autopage-panel {
            padding: 8px 10px;
        }
        .ns-autopage-status {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 6px;
        }
        .ns-autopage-timer {
            font-size: 14px;
            font-weight: 600;
            color: #1890ff;
        }
        .ns-autopage-btn {
            padding: 3px 8px;
            font-size: 10px;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            color: #fff;
            transition: opacity 0.2s;
        }
        .ns-autopage-btn:hover { opacity: 0.8; }
        .ns-autopage-btn.start { background: #52c41a; }
        .ns-autopage-btn.stop { background: #ff4d4f; }
        .ns-autopage-btn.next { background: #1890ff; }
        .ns-autopage-info {
            font-size: 10px;
            color: #999;
        }

        /* 关键字匹配高亮 */
        .ns-keyword-match {
            background: linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%);
            border-left: 3px solid #52c41a;
        }
        .ns-keyword-match a { font-weight: 500; }

        @media (prefers-color-scheme: dark) {
            .ns-card { background: #242424; box-shadow: 0 1px 6px rgba(0,0,0,0.3); }
            .ns-item { border-color: #333; }
            .ns-item:hover { background: #2d2d2d; }
            .ns-item a { color: #e0e0e0; }
            .ns-item.visited { background: #2d1a1a; }
            .ns-item.visited a { color: #ff6b6b; }
            .ns-empty { color: #666; }
            .post-list a.ns-visited-post,
            a.post-title.ns-visited-post { color: #ff6b6b !important; }
        }

        @media (max-width: 1400px) { .ns-sidebar { display: none; } }
    `);

    // ==================== 工具函数 ====================
    const getToday = () => new Date().toISOString().slice(0, 10);
    const hasCheckedIn = () => GM_getValue(CONFIG.STORAGE_KEY) === getToday();
    const notify = (title, text, onclick) => {
        GM_notification({ title, text, timeout: 5000, onclick });
        console.log(`[NS助手] ${title}: ${text}`);
    };
    const extractPostId = (url) => url?.match(/\/post-(\d+)/)?.[1];
    const truncate = (str, len) => {
        if (!str) return '';
        str = str.trim();
        return str.length > len ? str.slice(0, len) + '…' : str;
    };
    const escapeHtml = (str) => {
        if (!str) return '';
        return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    };

    // ==================== 已浏览帖子管理 ====================
    const getVisitedPosts = () => {
        try {
            return GM_getValue(CONFIG.VISITED_KEY) || {};
        } catch {
            return {};
        }
    };

    const markAsVisited = (postId) => {
        if (!postId) return;
        const visited = getVisitedPosts();
        visited[postId] = Date.now();
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        for (const id in visited) {
            if (visited[id] < cutoff) delete visited[id];
        }
        GM_setValue(CONFIG.VISITED_KEY, visited);
    };

    const isVisited = (postId) => {
        const visited = getVisitedPosts();
        return !!visited[postId];
    };

    // ==================== 全站已浏览帖子标红 ====================
    const markVisitedPostsOnPage = () => {
        const visited = getVisitedPosts();
        document.querySelectorAll('a[href*="/post-"]').forEach(link => {
            const postId = extractPostId(link.getAttribute('href'));
            if (postId && visited[postId] && !link.classList.contains('ns-visited-post')) {
                link.classList.add('ns-visited-post');
            }
        });
    };

    // 监控当前浏览的帖子
    const trackCurrentPost = () => {
        const postId = extractPostId(location.href);
        if (postId) {
            markAsVisited(postId);
        }
    };

    // ==================== 签到功能 ====================
    const doCheckin = async () => {
        if (hasCheckedIn()) return null;
        try {
            const res = await fetch(CONFIG.API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                credentials: 'include',
                body: `random=${CONFIG.RANDOM_MODE}`
            });
            const data = await res.json();
            if (data.success) {
                GM_setValue(CONFIG.STORAGE_KEY, getToday());
                notify('签到成功', data.message || '获得鸡腿奖励！');
                // 提取签到获得的鸡腿数
                const match = data.message?.match(/(\d+)/);
                return match ? parseInt(match[1]) : 0;
            } else if (data.message?.includes('已完成') || data.message?.includes('已签到')) {
                GM_setValue(CONFIG.STORAGE_KEY, getToday());
            }
        } catch (e) {
            console.error('[NS助手] 签到异常:', e);
        }
        return null;
    };

    // ==================== 数据获取 ====================
    const fetchPageTitles = async (url) => {
        try {
            const res = await fetch(url, { credentials: 'include' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const html = await res.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');

            const posts = [];
            const seen = new Set();
            doc.querySelectorAll('a[href*="/post-"]').forEach(link => {
                const href = link.getAttribute('href');
                const postId = extractPostId(href);
                const title = link.textContent?.trim();
                if (!postId || !title || title.length < 3 || seen.has(postId)) return;
                if (link.closest('.pagination, [class*="page"]')) return;
                seen.add(postId);
                posts.push({
                    id: postId,
                    title,
                    url: href.startsWith('http') ? href : `https://www.nodeseek.com${href}`
                });
            });
            return posts;
        } catch (e) {
            console.error('[NS助手] 获取页面失败:', e);
            return [];
        }
    };

    // ==================== 交易帖获取 ====================
    const fetchActiveTrades = async () => {
        const posts = await fetchPageTitles(CONFIG.TRADE_URL);
        const results = [];
        for (const post of posts) {
            if (results.length >= CONFIG.TRADE_COUNT) break;
            if (/版块规定|中介索引|防骗提示|骗子索引/i.test(post.title)) continue;
            if (/已出|已收|已售|sold|closed/i.test(post.title)) continue;
            const isBuy = /收|求|buy|购/i.test(post.title);
            results.push({
                id: post.id,
                title: post.title,
                url: post.url,
                type: isBuy ? 'buy' : 'sell',
                tag: isBuy ? '求购' : '出售',
                visited: isVisited(post.id)
            });
        }
        return results;
    };

    // ==================== 骗子曝光帖获取（全站索引） ====================
    const fetchScamPosts = async () => {
        const results = [];
        const seen = new Set();

        // 从骗子曝光版块获取
        const scamPosts = await fetchPageTitles(CONFIG.SCAM_URL);
        for (const post of scamPosts) {
            if (results.length >= CONFIG.SCAM_COUNT) break;
            if (/版块规定|公告|置顶/i.test(post.title)) continue;
            if (seen.has(post.id)) continue;
            seen.add(post.id);
            results.push({
                id: post.id,
                title: post.title,
                url: post.url,
                tag: '曝光',
                visited: isVisited(post.id)
            });
        }

        // 从全站首页索引骗子相关帖子
        if (results.length < CONFIG.SCAM_COUNT) {
            const homePosts = await fetchPageTitles(CONFIG.HOME_URL);
            for (const post of homePosts) {
                if (results.length >= CONFIG.SCAM_COUNT) break;
                if (seen.has(post.id)) continue;
                // 匹配骗子相关关键词
                if (!/骗子|骗局|诈骗|曝光|跑路|维权|被骗|警惕|小心|避坑|黑名单/i.test(post.title)) continue;
                if (/版块规定|公告|置顶/i.test(post.title)) continue;
                seen.add(post.id);
                results.push({
                    id: post.id,
                    title: post.title,
                    url: post.url,
                    tag: '曝光',
                    visited: isVisited(post.id)
                });
            }
        }

        return results;
    };

    // ==================== 抽奖帖获取 ====================
    const extractLotteryTime = (title) => {
        const now = new Date();
        let month = null, day = null, hour = null, minute = '00';

        const isValidDate = (m, d) => {
            const mi = parseInt(m), di = parseInt(d);
            return mi >= 1 && mi <= 12 && di >= 1 && di <= 31;
        };

        let match = title.match(/(\d{1,2})月(\d{1,2})[日号]\s*(\d{1,2})[时点:：](\d{2})?/);
        if (match && isValidDate(match[1], match[2])) {
            month = match[1]; day = match[2]; hour = match[3]; minute = match[4] || '00';
        }

        if (!month) {
            match = title.match(/(\d{1,2})[\/\-.](\d{1,2})\s*(\d{1,2}):(\d{2})/);
            if (match && isValidDate(match[1], match[2])) {
                month = match[1]; day = match[2]; hour = match[3]; minute = match[4];
            }
        }

        if (!month) {
            match = title.match(/(\d{1,2})月(\d{1,2})[日号]/);
            if (match && isValidDate(match[1], match[2])) {
                month = match[1]; day = match[2];
                const timeMatch = title.match(/(\d{1,2})[时点]|(\d{1,2}):(\d{2})/);
                if (timeMatch) { hour = timeMatch[1] || timeMatch[2]; minute = timeMatch[3] || '00'; }
            }
        }

        if (!month) {
            const todayMatch = title.match(/今[天晚日].*?(\d{1,2})[时点:：](\d{2})?/);
            if (todayMatch) {
                month = now.getMonth() + 1; day = now.getDate();
                hour = todayMatch[1]; minute = todayMatch[2] || '00';
            }
        }

        if (!month) {
            const tomorrowMatch = title.match(/明[天日晚].*?(\d{1,2})[时点:：](\d{2})?/);
            if (tomorrowMatch) {
                const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                month = tomorrow.getMonth() + 1; day = tomorrow.getDate();
                hour = tomorrowMatch[1]; minute = tomorrowMatch[2] || '00';
            }
        }

        if (!month) {
            const hoursMatch = title.match(/(\d+)\s*[小时hH]+后?/);
            if (hoursMatch) {
                const hours = parseInt(hoursMatch[1]);
                if (hours >= 1 && hours <= 168) {
                    const future = new Date(now.getTime() + hours * 60 * 60 * 1000);
                    month = future.getMonth() + 1; day = future.getDate();
                    hour = future.getHours(); minute = String(future.getMinutes()).padStart(2, '0');
                }
            }
        }

        if (month && day && hour) return `${month}月${day}日${hour}:${minute}开奖`;
        if (month && day) return `${month}月${day}日开奖`;

        const floorMatch = title.match(/(\d+)\s*[楼层](?:\s*(?:开奖|抽奖))?|满\s*(\d+)\s*[楼层]/);
        if (floorMatch) {
            const num = floorMatch[1] || floorMatch[2];
            if (parseInt(num) >= 20) return `${num}楼开奖`;
        }

        return null;
    };

    const fetchActiveLotteries = async () => {
        const posts = await fetchPageTitles(CONFIG.HOME_URL);
        const results = [], seen = new Set();

        for (const post of posts) {
            if (results.length >= CONFIG.LOTTERY_COUNT || seen.has(post.id)) continue;

            const title = post.title;
            const isRealLottery = /抽奖|开奖|\b抽\s*\d+|送.{0,5}名|随机抽/.test(title);
            if (!isRealLottery) continue;
            if (/已开奖|已结束|已完成|开奖结果|中奖名单/i.test(title)) continue;
            if (/招聘|求职|教程|问题|讨论|分享经验/i.test(title)) continue;

            const lotteryTime = extractLotteryTime(title);

            seen.add(post.id);
            const cleanTitle = title
                .replace(/[\[【(（]?\s*(抽奖|开奖)\s*[\]】)）]?/gi, '')
                .replace(/^\s*[:：]\s*/, '')
                .trim();

            results.push({
                id: post.id,
                title: cleanTitle || title,
                url: post.url,
                tag: '抽奖',
                lotteryTime,
                visited: isVisited(post.id)
            });
        }
        return results;
    };

    // ==================== 中奖检测 ====================
    const getParticipatedLotteries = () => {
        try { return GM_getValue(CONFIG.WIN_CHECK_KEY) || {}; } catch { return {}; }
    };

    const addParticipatedLottery = (postId, title) => {
        const participated = getParticipatedLotteries();
        if (!participated[postId]) {
            participated[postId] = { title, addedAt: Date.now(), checked: false };
            GM_setValue(CONFIG.WIN_CHECK_KEY, participated);
        }
    };

    const checkWinStatus = async () => {
        const participated = getParticipatedLotteries();
        const postIds = Object.keys(participated).filter(id => !participated[id].won);
        if (postIds.length === 0) return;

        for (const postId of postIds.slice(0, 3)) {
            try {
                const res = await fetch(`https://www.nodeseek.com/post-${postId}.html`, { credentials: 'include' });
                if (!res.ok) continue;

                const html = await res.text();
                const usernameMatch = html.match(/data-username="([^"]+)"/);
                if (!usernameMatch) continue;
                const currentUser = usernameMatch[1];

                const isEnded = /已开奖|开奖结果|中奖名单|恭喜.*中奖/i.test(html);
                if (isEnded) {
                    const winPattern = new RegExp(`@${currentUser}|恭喜\\s*${currentUser}|中奖.*${currentUser}|${currentUser}.*中奖`, 'i');
                    const isWinner = winPattern.test(html);

                    participated[postId].checked = true;
                    participated[postId].ended = true;

                    if (isWinner) {
                        participated[postId].won = true;
                        notify('🎉 恭喜中奖！', `您在「${truncate(participated[postId].title, 20)}」中奖了！`);
                    }
                }
                GM_setValue(CONFIG.WIN_CHECK_KEY, participated);
                await new Promise(r => setTimeout(r, 1000));
            } catch (e) {}
        }
    };

    const monitorLotteryParticipation = () => {
        const postId = extractPostId(location.href);
        if (!postId) return;

        const pageTitle = document.title || '';
        if (!/抽奖|开奖/i.test(pageTitle)) return;

        setTimeout(() => {
            const currentUser = document.querySelector('[data-username]')?.getAttribute('data-username');
            if (currentUser) {
                const comments = document.querySelectorAll('.comment-item, [class*="reply"]');
                comments.forEach(comment => {
                    if (comment.querySelector(`[href*="${currentUser}"]`)) {
                        addParticipatedLottery(postId, pageTitle.replace(/ - NodeSeek$/, ''));
                    }
                });
            }
        }, 2000);
    };

    // ==================== 关键字监控 ====================
    const getNotifiedPosts = () => {
        try {
            const data = GM_getValue(CONFIG.KEYWORD_NOTIFIED_KEY);
            if (data && data.date === getToday()) return data.posts || {};
            return {};
        } catch { return {}; }
    };

    const markPostNotified = (postId) => {
        const notified = getNotifiedPosts();
        notified[postId] = Date.now();
        GM_setValue(CONFIG.KEYWORD_NOTIFIED_KEY, { date: getToday(), posts: notified });
    };

    const isPostNotified = (postId) => {
        return !!getNotifiedPosts()[postId];
    };

    // 精准匹配：标题中包含完整的关键词（作为独立词或中文词）
    const matchExact = (title, keywords) => {
        const titleLower = title.toLowerCase();
        for (const kw of keywords) {
            const kwLower = kw.toLowerCase();
            // 对于英文，检查单词边界；对于中文，直接匹配
            const regex = new RegExp(`(^|[\\s,.!?;:'"()\\[\\]{}])${kwLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[\\s,.!?;:'"()\\[\\]{}])`, 'i');
            if (regex.test(titleLower) || titleLower.includes(kwLower)) {
                return kw;
            }
        }
        return null;
    };

    // 模糊匹配：标题包含关键词即可
    const matchFuzzy = (title, keywords) => {
        const titleLower = title.toLowerCase();
        for (const kw of keywords) {
            if (titleLower.includes(kw.toLowerCase())) {
                return kw;
            }
        }
        return null;
    };

    const fetchKeywordMatches = async () => {
        if (!CONFIG.KEYWORD_MONITOR_ENABLED) return [];

        const posts = await fetchPageTitles(CONFIG.HOME_URL);
        const results = [];
        const seen = new Set();

        for (const post of posts) {
            if (seen.has(post.id)) continue;

            // 检查精准匹配
            const exactMatch = matchExact(post.title, CONFIG.KEYWORDS_EXACT);
            if (exactMatch) {
                seen.add(post.id);
                results.push({
                    id: post.id,
                    title: post.title,
                    url: post.url,
                    matchType: 'exact',
                    keyword: exactMatch,
                    tag: `精准:${exactMatch}`,
                    visited: isVisited(post.id),
                    notified: isPostNotified(post.id)
                });
                continue;
            }

            // 检查模糊匹配
            const fuzzyMatch = matchFuzzy(post.title, CONFIG.KEYWORDS_FUZZY);
            if (fuzzyMatch) {
                seen.add(post.id);
                results.push({
                    id: post.id,
                    title: post.title,
                    url: post.url,
                    matchType: 'fuzzy',
                    keyword: fuzzyMatch,
                    tag: `模糊:${fuzzyMatch}`,
                    visited: isVisited(post.id),
                    notified: isPostNotified(post.id)
                });
            }
        }

        return results;
    };

    // 关键字监控定时任务
    let keywordMonitorTimer = null;
    const startKeywordMonitor = () => {
        if (!CONFIG.KEYWORD_MONITOR_ENABLED || keywordMonitorTimer) return;

        const checkKeywords = async () => {
            try {
                const matches = await fetchKeywordMatches();
                const newMatches = matches.filter(m => !m.notified);

                if (newMatches.length > 0) {
                    // 发送通知
                    for (const match of newMatches.slice(0, 3)) {
                        notify(
                            `🔍 关键字匹配: ${match.keyword}`,
                            truncate(match.title, 30),
                            () => window.open(match.url, '_blank')
                        );
                        markPostNotified(match.id);
                    }

                    // 更新侧边栏
                    if (sidebarInstance) {
                        const keywordCard = sidebarInstance.querySelector('.ns-card.keyword');
                        if (keywordCard) {
                            const allMatches = await fetchKeywordMatches();
                            renderKeywordCard(keywordCard, allMatches);
                        }
                    }
                }
            } catch (e) {
                console.log('[NS助手] 关键字监控异常:', e.message);
            }
        };

        // 首次检查
        setTimeout(checkKeywords, 3000);
        // 定时检查
        keywordMonitorTimer = setInterval(checkKeywords, CONFIG.KEYWORD_MONITOR_INTERVAL);
    };

    // ==================== 自动翻页 ====================
    let autoPageTimer = null;
    let autoPageCountdown = 0;
    let autoPageRunning = false;

    const getNextPageUrl = () => {
        // 查找下一页按钮
        const nextBtn = document.querySelector('a.next, a[rel="next"], .pagination a:last-child, [class*="next"]');
        if (nextBtn && nextBtn.href) return nextBtn.href;

        // 尝试解析当前页码并构建下一页URL
        const currentUrl = location.href;
        const pageMatch = currentUrl.match(/[?&]page=(\d+)/);
        if (pageMatch) {
            const currentPage = parseInt(pageMatch[1]);
            return currentUrl.replace(/([?&]page=)\d+/, `$1${currentPage + 1}`);
        }

        // 如果URL中没有page参数，尝试添加
        if (currentUrl.includes('?')) {
            return currentUrl + '&page=2';
        } else {
            return currentUrl + '?page=2';
        }
    };

    const goToNextPage = () => {
        const nextUrl = getNextPageUrl();
        if (nextUrl) {
            location.href = nextUrl;
        }
    };

    const updateAutoPageUI = () => {
        const timerEl = document.querySelector('.ns-autopage-timer');
        const startBtn = document.querySelector('.ns-autopage-btn.start');
        const stopBtn = document.querySelector('.ns-autopage-btn.stop');

        if (timerEl) {
            timerEl.textContent = autoPageRunning ? `${autoPageCountdown}s` : '已停止';
            timerEl.style.color = autoPageRunning ? '#1890ff' : '#999';
        }
        if (startBtn) startBtn.style.display = autoPageRunning ? 'none' : 'inline-block';
        if (stopBtn) stopBtn.style.display = autoPageRunning ? 'inline-block' : 'none';
    };

    const startAutoPage = () => {
        if (autoPageRunning) return;
        autoPageRunning = true;
        autoPageCountdown = CONFIG.AUTO_PAGE_INTERVAL;

        autoPageTimer = setInterval(() => {
            autoPageCountdown--;
            updateAutoPageUI();

            if (autoPageCountdown <= 0) {
                goToNextPage();
            }
        }, 1000);

        updateAutoPageUI();
        console.log('[NS助手] 自动翻页已启动');
    };

    const stopAutoPage = () => {
        autoPageRunning = false;
        if (autoPageTimer) {
            clearInterval(autoPageTimer);
            autoPageTimer = null;
        }
        updateAutoPageUI();
        console.log('[NS助手] 自动翻页已停止');
    };

    // ==================== 侧边栏UI ====================
    let sidebarInstance = null;

    const createSidebar = () => {
        document.querySelector('.ns-sidebar')?.remove();

        const sidebar = document.createElement('div');
        sidebar.className = 'ns-sidebar';
        sidebar.innerHTML = `
            <div class="ns-card autopage">
                <div class="ns-card-header">
                    <span>📄 自动翻页</span>
                    <span class="ns-card-toggle">−</span>
                </div>
                <div class="ns-card-body">
                    <div class="ns-autopage-panel">
                        <div class="ns-autopage-status">
                            <span class="ns-autopage-timer">已停止</span>
                            <div>
                                <button class="ns-autopage-btn start">启动</button>
                                <button class="ns-autopage-btn stop" style="display:none">停止</button>
                                <button class="ns-autopage-btn next">下一页</button>
                            </div>
                        </div>
                        <div class="ns-autopage-info">间隔: ${CONFIG.AUTO_PAGE_INTERVAL}秒</div>
                    </div>
                </div>
            </div>
            <div class="ns-card keyword">
                <div class="ns-card-header">
                    <span>🔍 关键字监控</span>
                    <span class="ns-card-toggle">−</span>
                </div>
                <div class="ns-card-body"><div class="ns-empty ns-loading">监控中...</div></div>
            </div>
            <div class="ns-card trade">
                <div class="ns-card-header">
                    <span>💰 最新交易</span>
                    <span class="ns-card-toggle">−</span>
                </div>
                <div class="ns-card-body"><div class="ns-empty ns-loading">加载中...</div></div>
            </div>
            <div class="ns-card lottery">
                <div class="ns-card-header">
                    <span>🎁 最新抽奖</span>
                    <span class="ns-card-toggle">−</span>
                </div>
                <div class="ns-card-body"><div class="ns-empty ns-loading">加载中...</div></div>
            </div>
            <div class="ns-card scam">
                <div class="ns-card-header">
                    <span>⚠️ 骗子曝光</span>
                    <span class="ns-card-toggle">−</span>
                </div>
                <div class="ns-card-body"><div class="ns-empty ns-loading">加载中...</div></div>
            </div>
        `;

        document.body.appendChild(sidebar);

        sidebar.querySelectorAll('.ns-card-header').forEach(header => {
            header.addEventListener('click', () => {
                const card = header.closest('.ns-card');
                const toggle = header.querySelector('.ns-card-toggle');
                card.classList.toggle('collapsed');
                toggle.textContent = card.classList.contains('collapsed') ? '+' : '−';
            });
        });

        // 自动翻页按钮事件
        sidebar.querySelector('.ns-autopage-btn.start')?.addEventListener('click', (e) => {
            e.stopPropagation();
            startAutoPage();
        });
        sidebar.querySelector('.ns-autopage-btn.stop')?.addEventListener('click', (e) => {
            e.stopPropagation();
            stopAutoPage();
        });
        sidebar.querySelector('.ns-autopage-btn.next')?.addEventListener('click', (e) => {
            e.stopPropagation();
            goToNextPage();
        });

        sidebarInstance = sidebar;
        return sidebar;
    };

    // 渲染关键字监控卡片
    const renderKeywordCard = (card, items) => {
        const body = card.querySelector('.ns-card-body');
        if (!items?.length) {
            const keywords = [...CONFIG.KEYWORDS_EXACT, ...CONFIG.KEYWORDS_FUZZY].join(', ');
            body.innerHTML = `<div class="ns-empty">暂无匹配<br><span style="font-size:9px;color:#bbb">监控: ${truncate(keywords, 20)}</span></div>`;
            return;
        }
        body.innerHTML = items.slice(0, 8).map(item => `
            <div class="ns-item ns-keyword-match ${item.visited ? 'visited' : ''}" data-post-id="${item.id}">
                <a href="${escapeHtml(item.url)}" target="_blank" title="${escapeHtml(item.title)}">
                    <div class="ns-item-row">
                        <span class="ns-tag ${item.matchType}">${item.tag}</span>
                        <span class="ns-title">${escapeHtml(truncate(item.title, 14))}</span>
                        ${item.visited ? '<span class="ns-visited-mark">[已浏览]</span>' : ''}
                    </div>
                </a>
            </div>
        `).join('');

        body.querySelectorAll('.ns-item').forEach(el => {
            el.addEventListener('click', () => {
                const postId = el.getAttribute('data-post-id');
                if (postId) {
                    markAsVisited(postId);
                    el.classList.add('visited');
                }
            });
        });
    };

    const renderItemCard = (card, items, emptyText) => {
        const body = card.querySelector('.ns-card-body');
        if (!items?.length) {
            body.innerHTML = `<div class="ns-empty">${emptyText}</div>`;
            return;
        }
        body.innerHTML = items.map(item => `
            <div class="ns-item ${item.visited ? 'visited' : ''}" data-post-id="${item.id}">
                <a href="${escapeHtml(item.url)}" target="_blank" title="${escapeHtml(item.title)}">
                    <div class="ns-item-row">
                        <span class="ns-tag ${item.type || item.tag?.toLowerCase()}">${item.tag}</span>
                        <span class="ns-title">${escapeHtml(truncate(item.title, 16))}</span>
                        ${item.visited ? '<span class="ns-visited-mark">[已浏览]</span>' : ''}
                    </div>
                    ${item.lotteryTime ? `<div class="ns-lottery-time">⏰ ${escapeHtml(item.lotteryTime)}</div>` : ''}
                </a>
            </div>
        `).join('');

        body.querySelectorAll('.ns-item').forEach(el => {
            el.addEventListener('click', () => {
                const postId = el.getAttribute('data-post-id');
                if (postId) {
                    markAsVisited(postId);
                    el.classList.add('visited');
                    if (!el.querySelector('.ns-visited-mark')) {
                        el.querySelector('.ns-item-row')?.insertAdjacentHTML('beforeend', '<span class="ns-visited-mark">[已浏览]</span>');
                    }
                }
            });
        });
    };

    const loadSidebarData = async (sidebar) => {
        const [trades, lotteries, scams, keywordMatches] = await Promise.all([
            fetchActiveTrades(),
            fetchActiveLotteries(),
            fetchScamPosts(),
            fetchKeywordMatches()
        ]);

        renderKeywordCard(sidebar.querySelector('.ns-card.keyword'), keywordMatches);
        renderItemCard(sidebar.querySelector('.ns-card.trade'), trades, '暂无交易');
        renderItemCard(sidebar.querySelector('.ns-card.lottery'), lotteries, '暂无抽奖');
        renderItemCard(sidebar.querySelector('.ns-card.scam'), scams, '暂无曝光');
    };

    // ==================== 初始化 ====================
    const init = async () => {
        console.log('[NS助手] v2.3.0 初始化');

        // 记录当前浏览的帖子
        trackCurrentPost();

        // 标记页面上已浏览的帖子
        markVisitedPostsOnPage();

        // 监听DOM变化，持续标记新加载的帖子
        const observer = new MutationObserver(() => markVisitedPostsOnPage());
        observer.observe(document.body, { childList: true, subtree: true });

        // 自动签到
        await doCheckin();

        // 监控抽奖参与
        monitorLotteryParticipation();

        // 定期检查中奖
        setTimeout(checkWinStatus, 5000);
        setInterval(checkWinStatus, CONFIG.WIN_CHECK_INTERVAL);

        // 启动关键字监控
        startKeywordMonitor();

        // 列表页显示侧边栏
        const isListPage = location.pathname === '/' ||
            location.pathname.startsWith('/board') ||
            location.pathname.startsWith('/categor');

        if (isListPage) {
            setTimeout(async () => {
                const sidebar = createSidebar();
                await loadSidebarData(sidebar);

                // 如果配置了自动翻页，则启动
                if (CONFIG.AUTO_PAGE_ENABLED) {
                    startAutoPage();
                }
            }, 500);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
