// ==UserScript==
// @name         NodeSeek 增强助手
// @namespace    https://github.com/weiruankeji2025/weiruan-nodeseek-Sign.in
// @version      2.2.0
// @description  NodeSeek论坛增强：自动签到 + 交易监控 + 抽奖追踪 + 全站骗子曝光
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
        RANDOM_MODE: true,
        TRADE_COUNT: 5,
        LOTTERY_COUNT: 5,
        SCAM_COUNT: 5,
        WIN_CHECK_INTERVAL: 10 * 60 * 1000
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

    // ==================== 侧边栏UI ====================
    let sidebarInstance = null;

    const createSidebar = () => {
        document.querySelector('.ns-sidebar')?.remove();

        const sidebar = document.createElement('div');
        sidebar.className = 'ns-sidebar';
        sidebar.innerHTML = `
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

        sidebarInstance = sidebar;
        return sidebar;
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
        const [trades, lotteries, scams] = await Promise.all([
            fetchActiveTrades(),
            fetchActiveLotteries(),
            fetchScamPosts()
        ]);

        renderItemCard(sidebar.querySelector('.ns-card.trade'), trades, '暂无交易');
        renderItemCard(sidebar.querySelector('.ns-card.lottery'), lotteries, '暂无抽奖');
        renderItemCard(sidebar.querySelector('.ns-card.scam'), scams, '暂无曝光');
    };

    // ==================== 初始化 ====================
    const init = async () => {
        console.log('[NS助手] v2.2.0 初始化');

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

        // 列表页显示侧边栏
        const isListPage = location.pathname === '/' ||
            location.pathname.startsWith('/board') ||
            location.pathname.startsWith('/categor');

        if (isListPage) {
            setTimeout(async () => {
                const sidebar = createSidebar();
                await loadSidebarData(sidebar);
            }, 500);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
