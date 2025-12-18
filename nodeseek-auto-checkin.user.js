// ==UserScript==
// @name         NodeSeek 增强助手
// @namespace    https://github.com/weiruankeji2025/weiruan-nodeseek-Sign.in
// @version      2.0.5
// @description  NodeSeek论坛增强：自动签到 + 交易监控 + 抽奖追踪 + 中奖提醒
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
        HOME_URL: 'https://www.nodeseek.com/',
        STORAGE_KEY: 'ns_last_checkin',
        VISITED_KEY: 'ns_visited_posts',
        WIN_CHECK_KEY: 'ns_win_check',
        RANDOM_MODE: true,
        TRADE_COUNT: 5,
        LOTTERY_COUNT: 5,
        WIN_CHECK_INTERVAL: 10 * 60 * 1000  // 10分钟检查一次中奖
    };

    // ==================== 样式注入 ====================
    GM_addStyle(`
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
            gap: 8px;
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
            padding: 8px 10px;
            font-weight: 600;
            font-size: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            user-select: none;
        }
        .ns-card-toggle { opacity: 0.7; font-size: 11px; }
        .ns-card.collapsed .ns-card-body { display: none; }

        .ns-card.trade .ns-card-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; }
        .ns-card.lottery .ns-card-header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: #fff; }

        .ns-item {
            padding: 6px 10px;
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
            gap: 3px;
            line-height: 1.3;
            font-size: 11px;
        }
        .ns-item a:hover { color: #1890ff; }

        /* 已浏览样式 */
        .ns-item.visited { background: #f5f5f5; opacity: 0.7; }
        .ns-item.visited a { color: #999; }
        .ns-item.visited .ns-tag { opacity: 0.6; }
        .ns-visited-mark { font-size: 9px; color: #52c41a; margin-left: 4px; }

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

        .ns-title {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        /* 开奖时间样式 */
        .ns-lottery-time {
            font-size: 9px;
            color: #fa8c16;
            padding-left: 24px;
        }

        .ns-empty { text-align: center; padding: 15px 10px; color: #999; font-size: 11px; }
        .ns-loading { color: #1890ff; }

        @media (prefers-color-scheme: dark) {
            .ns-card { background: #242424; box-shadow: 0 1px 6px rgba(0,0,0,0.3); }
            .ns-item { border-color: #333; }
            .ns-item:hover { background: #2d2d2d; }
            .ns-item a { color: #e0e0e0; }
            .ns-item.visited { background: #1a1a1a; }
            .ns-item.visited a { color: #666; }
            .ns-empty { color: #666; }
            .ns-lottery-time { color: #d48806; }
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
        const visited = getVisitedPosts();
        visited[postId] = Date.now();
        // 只保留最近30天的记录
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

    // ==================== 签到功能 ====================
    const doCheckin = async () => {
        if (hasCheckedIn()) return;
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
            } else if (data.message?.includes('已完成') || data.message?.includes('已签到')) {
                GM_setValue(CONFIG.STORAGE_KEY, getToday());
            }
        } catch (e) {
            console.error('[NS助手] 签到异常:', e);
        }
    };

    // ==================== 数据获取（仅标题） ====================
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
            // 排除版块公告和置顶帖
            if (/版块规定|中介索引|防骗提示|骗子索引/i.test(post.title)) continue;
            // 排除已完成交易
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

    // ==================== 抽奖帖获取（含开奖时间） ====================
    const extractLotteryTime = (title) => {
        const now = new Date();
        let month = null, day = null, hour = null, minute = '00';

        // 验证日期是否合理
        const isValidDate = (m, d) => {
            const mi = parseInt(m), di = parseInt(d);
            return mi >= 1 && mi <= 12 && di >= 1 && di <= 31;
        };

        // 匹配具体日期时间: 12月20日 20:00 或 12月20日20点
        let match = title.match(/(\d{1,2})月(\d{1,2})[日号]\s*(\d{1,2})[时点:：](\d{2})?/);
        if (match && isValidDate(match[1], match[2])) {
            month = match[1];
            day = match[2];
            hour = match[3];
            minute = match[4] || '00';
        }

        // 匹配 12/20 20:00 或 12.20 20:00 格式
        if (!month) {
            match = title.match(/(\d{1,2})[\/\-.](\d{1,2})\s*(\d{1,2}):(\d{2})/);
            if (match && isValidDate(match[1], match[2])) {
                month = match[1];
                day = match[2];
                hour = match[3];
                minute = match[4];
            }
        }

        // 匹配仅日期: 12月20日（必须有"月"和"日"）
        if (!month) {
            match = title.match(/(\d{1,2})月(\d{1,2})[日号]/);
            if (match && isValidDate(match[1], match[2])) {
                month = match[1];
                day = match[2];
                // 尝试找时间
                const timeMatch = title.match(/(\d{1,2})[时点]|(\d{1,2}):(\d{2})/);
                if (timeMatch) {
                    hour = timeMatch[1] || timeMatch[2];
                    minute = timeMatch[3] || '00';
                }
            }
        }

        // 匹配今天/今晚 + 时间
        if (!month) {
            const todayMatch = title.match(/今[天晚日].*?(\d{1,2})[时点:：](\d{2})?/);
            if (todayMatch) {
                month = now.getMonth() + 1;
                day = now.getDate();
                hour = todayMatch[1];
                minute = todayMatch[2] || '00';
            }
        }

        // 匹配明天 + 时间
        if (!month) {
            const tomorrowMatch = title.match(/明[天日晚].*?(\d{1,2})[时点:：](\d{2})?/);
            if (tomorrowMatch) {
                const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                month = tomorrow.getMonth() + 1;
                day = tomorrow.getDate();
                hour = tomorrowMatch[1];
                minute = tomorrowMatch[2] || '00';
            }
        }

        // 匹配后天 + 时间
        if (!month) {
            const afterMatch = title.match(/后天.*?(\d{1,2})[时点:：](\d{2})?/);
            if (afterMatch) {
                const afterTomorrow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
                month = afterTomorrow.getMonth() + 1;
                day = afterTomorrow.getDate();
                hour = afterMatch[1];
                minute = afterMatch[2] || '00';
            }
        }

        // 匹配X小时后 (不强制要求"开奖"关键词)
        if (!month) {
            const hoursMatch = title.match(/(\d+)\s*[小时hH]+后?/);
            if (hoursMatch) {
                const hours = parseInt(hoursMatch[1]);
                if (hours >= 1 && hours <= 168) {  // 1小时到7天
                    const future = new Date(now.getTime() + hours * 60 * 60 * 1000);
                    month = future.getMonth() + 1;
                    day = future.getDate();
                    hour = future.getHours();
                    minute = String(future.getMinutes()).padStart(2, '0');
                }
            }
        }

        // 匹配X天后
        if (!month) {
            const daysMatch = title.match(/(\d+)\s*天后/);
            if (daysMatch) {
                const days = parseInt(daysMatch[1]);
                if (days >= 1 && days <= 30) {
                    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
                    month = future.getMonth() + 1;
                    day = future.getDate();
                }
            }
        }

        // 格式化输出（必须有完整日期）
        if (month && day && hour) {
            return `${month}月${day}日${hour}:${minute}开奖`;
        } else if (month && day) {
            return `${month}月${day}日开奖`;
        }

        // 楼层开奖
        const floorMatch = title.match(/(\d+)\s*[楼层](?:\s*(?:开奖|抽奖))?|满\s*(\d+)\s*[楼层]/);
        if (floorMatch) {
            const num = floorMatch[1] || floorMatch[2];
            if (parseInt(num) >= 20) {  // 楼层数至少20才算
                return `${num}楼开奖`;
            }
        }

        return null;
    };

    const fetchActiveLotteries = async () => {
        const posts = await fetchPageTitles(CONFIG.HOME_URL);
        const results = [], seen = new Set();

        for (const post of posts) {
            if (results.length >= CONFIG.LOTTERY_COUNT || seen.has(post.id)) continue;
            // 只根据标题判断是否是抽奖帖
            if (!/抽奖|开奖|福利|免费送|白嫖|🎁|🎉/i.test(post.title)) continue;
            if (/已开奖|已结束|已完成|结束|开奖结果/i.test(post.title)) continue;

            // 提取开奖时间
            const lotteryTime = extractLotteryTime(post.title);

            seen.add(post.id);
            const cleanTitle = post.title
                .replace(/[\[【(（]?\s*(抽奖|开奖|福利)\s*[\]】)）]?/gi, '')
                .replace(/^\s*[:：]\s*/, '')
                .trim();

            results.push({
                id: post.id,
                title: cleanTitle || post.title,
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
        try {
            return GM_getValue(CONFIG.WIN_CHECK_KEY) || {};
        } catch {
            return {};
        }
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

        console.log(`[NS助手] 检查 ${postIds.length} 个抽奖帖的中奖状态...`);

        for (const postId of postIds.slice(0, 5)) {  // 每次最多检查5个
            try {
                const res = await fetch(`https://www.nodeseek.com/post-${postId}.html`, {
                    credentials: 'include'
                });
                if (!res.ok) continue;

                const html = await res.text();

                // 获取当前用户名
                const usernameMatch = html.match(/data-username="([^"]+)"/);
                if (!usernameMatch) continue;
                const currentUser = usernameMatch[1];

                // 检查是否中奖（在开奖结果中出现用户名）
                const isEnded = /已开奖|开奖结果|中奖名单|恭喜.*中奖/i.test(html);
                if (isEnded) {
                    const winPattern = new RegExp(`@${currentUser}|恭喜\\s*${currentUser}|中奖.*${currentUser}|${currentUser}.*中奖`, 'i');
                    const isWinner = winPattern.test(html);

                    participated[postId].checked = true;
                    participated[postId].ended = true;

                    if (isWinner) {
                        participated[postId].won = true;
                        const title = participated[postId].title || '未知抽奖';
                        notify('🎉 恭喜中奖！', `您在「${truncate(title, 20)}」中奖了！`, () => {
                            window.open(`https://www.nodeseek.com/post-${postId}.html`, '_blank');
                        });
                    }
                }

                GM_setValue(CONFIG.WIN_CHECK_KEY, participated);

                // 延迟避免请求过快
                await new Promise(r => setTimeout(r, 1000));
            } catch (e) {
                console.log(`[NS助手] 检查帖子 ${postId} 失败:`, e.message);
            }
        }
    };

    // 监控当前页面是否参与抽奖
    const monitorLotteryParticipation = () => {
        const postId = extractPostId(location.href);
        if (!postId) return;

        // 检查页面是否是抽奖帖
        const pageTitle = document.title || '';
        if (!/抽奖|开奖|福利|免费送/i.test(pageTitle)) return;

        // 监控评论提交
        const observer = new MutationObserver(() => {
            const hasCommented = document.querySelector('.comment-list .comment-item');
            if (hasCommented) {
                addParticipatedLottery(postId, pageTitle.replace(/ - NodeSeek$/, ''));
                console.log(`[NS助手] 已记录参与抽奖: ${postId}`);
            }
        });

        const commentList = document.querySelector('.comment-list, .post-comments, [class*="comment"]');
        if (commentList) {
            observer.observe(commentList, { childList: true, subtree: true });
        }

        // 同时检查是否已经评论过
        setTimeout(() => {
            const currentUser = document.querySelector('[data-username]')?.getAttribute('data-username');
            if (currentUser) {
                const comments = document.querySelectorAll('.comment-item, [class*="comment"]');
                comments.forEach(comment => {
                    if (comment.textContent?.includes(currentUser)) {
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

    const renderTradeCard = (card, items) => {
        const body = card.querySelector('.ns-card-body');
        if (!items?.length) {
            body.innerHTML = '<div class="ns-empty">暂无交易信息</div>';
            return;
        }
        body.innerHTML = items.map(item => `
            <div class="ns-item ${item.visited ? 'visited' : ''}" data-post-id="${item.id}">
                <a href="${escapeHtml(item.url)}" target="_blank" title="${escapeHtml(item.title)}">
                    <div class="ns-item-row">
                        <span class="ns-tag ${item.type}">${item.tag}</span>
                        <span class="ns-title">${escapeHtml(truncate(item.title, 18))}</span>
                        ${item.visited ? '<span class="ns-visited-mark">✓已看</span>' : ''}
                    </div>
                </a>
            </div>
        `).join('');

        // 添加点击事件标记已浏览
        body.querySelectorAll('.ns-item').forEach(el => {
            el.addEventListener('click', () => {
                const postId = el.getAttribute('data-post-id');
                if (postId) {
                    markAsVisited(postId);
                    el.classList.add('visited');
                    if (!el.querySelector('.ns-visited-mark')) {
                        el.querySelector('.ns-item-row')?.insertAdjacentHTML('beforeend',
                            '<span class="ns-visited-mark">✓已看</span>');
                    }
                }
            });
        });
    };

    const renderLotteryCard = (card, items) => {
        const body = card.querySelector('.ns-card-body');
        if (!items?.length) {
            body.innerHTML = '<div class="ns-empty">暂无抽奖信息</div>';
            return;
        }
        body.innerHTML = items.map(item => `
            <div class="ns-item ${item.visited ? 'visited' : ''}" data-post-id="${item.id}">
                <a href="${escapeHtml(item.url)}" target="_blank" title="${escapeHtml(item.title)}">
                    <div class="ns-item-row">
                        <span class="ns-tag lottery">${item.tag}</span>
                        <span class="ns-title">${escapeHtml(truncate(item.title, 18))}</span>
                        ${item.visited ? '<span class="ns-visited-mark">✓已看</span>' : ''}
                    </div>
                    ${item.lotteryTime ? `<div class="ns-lottery-time">⏰ ${escapeHtml(item.lotteryTime)}</div>` : ''}
                </a>
            </div>
        `).join('');

        // 添加点击事件标记已浏览
        body.querySelectorAll('.ns-item').forEach(el => {
            el.addEventListener('click', () => {
                const postId = el.getAttribute('data-post-id');
                if (postId) {
                    markAsVisited(postId);
                    el.classList.add('visited');
                    if (!el.querySelector('.ns-visited-mark')) {
                        el.querySelector('.ns-item-row')?.insertAdjacentHTML('beforeend',
                            '<span class="ns-visited-mark">✓已看</span>');
                    }
                }
            });
        });
    };

    const loadSidebarData = async (sidebar) => {
        const [trades, lotteries] = await Promise.all([
            fetchActiveTrades(),
            fetchActiveLotteries()
        ]);

        renderTradeCard(sidebar.querySelector('.ns-card.trade'), trades);
        renderLotteryCard(sidebar.querySelector('.ns-card.lottery'), lotteries);
    };

    // ==================== 初始化 ====================
    const init = () => {
        console.log('[NS助手] v2.0.0 初始化');

        // 自动签到
        setTimeout(doCheckin, 1500);

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
            }, 800);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
