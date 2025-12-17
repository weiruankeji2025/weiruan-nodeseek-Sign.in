// ==UserScript==
// @name         NodeSeek 增强助手
// @namespace    https://github.com/weiruankeji2025/weiruan-nodeseek-Sign.in
// @version      1.5.0
// @description  NodeSeek论坛增强：自动签到 + 进行中交易 + 抽奖帖 + 鸡腿排行榜
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
        RANK_URL: 'https://www.nodeseek.com/rank/credit',
        STORAGE_KEY: 'ns_last_checkin',
        RANDOM_MODE: true,
        TRADE_COUNT: 5,
        LOTTERY_COUNT: 10,
        RANK_COUNT: 20
    };

    // ==================== 样式注入 ====================
    GM_addStyle(`
        /* 侧边栏容器 */
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

        /* 卡片样式 */
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

        /* 卡片头部颜色 */
        .ns-card.trade .ns-card-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; }
        .ns-card.lottery .ns-card-header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: #fff; }
        .ns-card.rank .ns-card-header { background: linear-gradient(135deg, #f6d365 0%, #fda085 100%); color: #fff; }

        /* 列表项 */
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
            align-items: center;
            gap: 5px;
            line-height: 1.3;
            font-size: 11px;
        }
        .ns-item a:hover { color: #1890ff; }

        /* 标签 */
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
        .ns-tag.active { background: #73d13d; }
        .ns-tag.gold { background: #faad14; }
        .ns-tag.silver { background: #8c8c8c; }
        .ns-tag.bronze { background: #d48806; }

        /* 标题文字 */
        .ns-title {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        /* 排行榜样式 */
        .ns-rank-item {
            padding: 5px 10px;
            border-bottom: 1px solid #f0f0f0;
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
        }
        .ns-rank-item:last-child { border-bottom: none; }
        .ns-rank-item:hover { background: #f8f9fa; }
        .ns-rank-num {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: 600;
            color: #fff;
            flex-shrink: 0;
        }
        .ns-rank-num.r1 { background: linear-gradient(135deg, #ffd700, #ffb700); }
        .ns-rank-num.r2 { background: linear-gradient(135deg, #c0c0c0, #a0a0a0); }
        .ns-rank-num.r3 { background: linear-gradient(135deg, #cd7f32, #b5651d); }
        .ns-rank-num.rn { background: #e0e0e0; color: #666; }
        .ns-rank-name {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: #333;
        }
        .ns-rank-name a { color: inherit; text-decoration: none; }
        .ns-rank-name a:hover { color: #1890ff; }
        .ns-rank-score { color: #faad14; font-weight: 500; font-size: 10px; }

        /* 空状态 */
        .ns-empty { text-align: center; padding: 15px 10px; color: #999; font-size: 11px; }
        .ns-loading { color: #1890ff; }

        /* 深色模式 */
        @media (prefers-color-scheme: dark) {
            .ns-card { background: #242424; box-shadow: 0 1px 6px rgba(0,0,0,0.3); }
            .ns-item, .ns-rank-item { border-color: #333; }
            .ns-item:hover, .ns-rank-item:hover { background: #2d2d2d; }
            .ns-item a, .ns-rank-name { color: #e0e0e0; }
            .ns-empty { color: #666; }
        }

        /* 响应式 */
        @media (max-width: 1400px) { .ns-sidebar { display: none; } }
    `);

    // ==================== 工具函数 ====================
    const getToday = () => new Date().toISOString().slice(0, 10);
    const hasCheckedIn = () => GM_getValue(CONFIG.STORAGE_KEY) === getToday();
    const notify = (title, text) => {
        GM_notification({ title, text, timeout: 3000 });
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

    // ==================== 签到功能 ====================
    const doCheckin = async () => {
        if (hasCheckedIn()) {
            console.log('[NS助手] 今日已签到');
            return;
        }
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

    // ==================== 数据获取 ====================

    // 获取页面帖子
    const fetchPagePosts = async (url) => {
        try {
            const res = await fetch(url, { credentials: 'include' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const html = await res.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');

            const posts = [];
            const seen = new Set();
            const links = doc.querySelectorAll('a[href*="/post-"]');

            links.forEach(link => {
                const href = link.getAttribute('href');
                const postId = extractPostId(href);
                const title = link.textContent?.trim();
                if (!postId || !title || title.length < 3 || seen.has(postId)) return;
                if (link.closest('.pagination, [class*="page"]')) return;

                seen.add(postId);
                posts.push({
                    id: postId,
                    title: title,
                    url: href.startsWith('http') ? href : `https://www.nodeseek.com${href}`
                });
            });

            return posts;
        } catch (e) {
            console.error('[NS助手] 获取页面失败:', e);
            return [];
        }
    };

    // 获取进行中的交易（排除已出/已收）
    const fetchActiveTrades = async () => {
        const posts = await fetchPagePosts(CONFIG.TRADE_URL);
        const results = [];

        for (const post of posts) {
            if (results.length >= CONFIG.TRADE_COUNT) break;
            const title = post.title;

            // 排除已完成的交易
            const isCompleted = /已出|已收|已售|sold|closed/i.test(title);
            if (isCompleted) continue;

            // 判断是出售还是求购
            const isSell = /出|sell|售/i.test(title);
            const isBuy = /收|求|buy|购/i.test(title);

            results.push({
                title: title,
                url: post.url,
                type: isBuy ? 'buy' : 'sell',
                tag: isBuy ? '求购' : '出售'
            });
        }

        console.log('[NS助手] 进行中交易:', results.length);
        return results;
    };

    // 获取进行中的抽奖（排除已开奖，获取10个）
    const fetchActiveLotteries = async () => {
        // 尝试多个页面获取更多抽奖帖
        const urls = [
            CONFIG.HOME_URL,
            CONFIG.HOME_URL + '?page=2'
        ];

        const allPosts = [];
        for (const url of urls) {
            const posts = await fetchPagePosts(url);
            allPosts.push(...posts);
        }

        const results = [];
        const seen = new Set();

        for (const post of allPosts) {
            if (results.length >= CONFIG.LOTTERY_COUNT) break;
            if (seen.has(post.id)) continue;

            const title = post.title;
            // 匹配抽奖关键词
            const isLottery = /抽奖|开奖|福利|免费送|白嫖|送\d+|🎁|🎉/i.test(title);
            if (!isLottery) continue;

            // 排除已开奖
            const isEnded = /已开奖|已结束|已完成|结束|开奖结果/i.test(title);
            if (isEnded) continue;

            seen.add(post.id);
            let cleanTitle = title
                .replace(/[\[【(（]?\s*(抽奖|开奖|福利)\s*[\]】)）]?/gi, '')
                .replace(/^\s*[:：]\s*/, '')
                .trim();

            results.push({
                title: cleanTitle || title,
                url: post.url,
                type: 'active',
                tag: '抽奖'
            });
        }

        console.log('[NS助手] 进行中抽奖:', results.length);
        return results;
    };

    // 获取鸡腿排行榜
    const fetchCreditRank = async () => {
        try {
            // 尝试从排行榜页面获取
            const res = await fetch(CONFIG.RANK_URL, { credentials: 'include' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const html = await res.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');

            const results = [];

            // 尝试多种选择器
            const rows = doc.querySelectorAll('tr, [class*="rank"], [class*="item"], [class*="user"]');

            rows.forEach(row => {
                if (results.length >= CONFIG.RANK_COUNT) return;

                // 查找用户链接
                const userLink = row.querySelector('a[href*="/space/"]');
                if (!userLink) return;

                const username = userLink.textContent?.trim();
                const userUrl = userLink.getAttribute('href');
                if (!username) return;

                // 查找鸡腿数 - 尝试多种方式
                let credit = 0;
                const texts = row.textContent;

                // 尝试匹配数字
                const creditMatch = texts.match(/(\d{1,6})\s*(鸡腿|积分|credit)?/i);
                if (creditMatch) {
                    credit = parseInt(creditMatch[1]);
                }

                // 也检查特定class
                const creditEl = row.querySelector('[class*="credit"], [class*="score"], [class*="point"]');
                if (creditEl) {
                    const num = parseInt(creditEl.textContent.replace(/\D/g, ''));
                    if (num > 0) credit = num;
                }

                if (credit > 0 || results.length < 3) {
                    results.push({
                        rank: results.length + 1,
                        username: username,
                        url: userUrl?.startsWith('http') ? userUrl : `https://www.nodeseek.com${userUrl}`,
                        credit: credit
                    });
                }
            });

            // 如果排行榜页面没数据，尝试从首页提取活跃用户
            if (results.length === 0) {
                console.log('[NS助手] 排行榜页面无数据，尝试备用方案');
                return await fetchTopUsersFromHome();
            }

            console.log('[NS助手] 鸡腿排行榜:', results.length);
            return results;
        } catch (e) {
            console.error('[NS助手] 获取排行榜失败:', e);
            return await fetchTopUsersFromHome();
        }
    };

    // 备用：从活跃用户获取
    const fetchTopUsersFromHome = async () => {
        try {
            const res = await fetch(CONFIG.HOME_URL, { credentials: 'include' });
            const html = await res.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');

            const users = new Map();
            const userLinks = doc.querySelectorAll('a[href*="/space/"]');

            userLinks.forEach(link => {
                const username = link.textContent?.trim();
                const href = link.getAttribute('href');
                if (!username || username.length < 2 || username.length > 20) return;

                if (!users.has(username)) {
                    users.set(username, {
                        username,
                        url: href?.startsWith('http') ? href : `https://www.nodeseek.com${href}`,
                        count: 1
                    });
                } else {
                    users.get(username).count++;
                }
            });

            // 按出现次数排序
            const sorted = Array.from(users.values())
                .sort((a, b) => b.count - a.count)
                .slice(0, CONFIG.RANK_COUNT)
                .map((u, i) => ({
                    rank: i + 1,
                    username: u.username,
                    url: u.url,
                    credit: 0  // 无法获取具体鸡腿数
                }));

            return sorted;
        } catch (e) {
            console.error('[NS助手] 备用方案失败:', e);
            return [];
        }
    };

    // ==================== 侧边栏UI ====================
    const createSidebar = () => {
        document.querySelector('.ns-sidebar')?.remove();

        const sidebar = document.createElement('div');
        sidebar.className = 'ns-sidebar';
        sidebar.innerHTML = `
            <div class="ns-card trade">
                <div class="ns-card-header">
                    <span>💰 进行中交易</span>
                    <span class="ns-card-toggle">−</span>
                </div>
                <div class="ns-card-body">
                    <div class="ns-empty ns-loading">加载中...</div>
                </div>
            </div>
            <div class="ns-card lottery">
                <div class="ns-card-header">
                    <span>🎁 进行中抽奖</span>
                    <span class="ns-card-toggle">−</span>
                </div>
                <div class="ns-card-body">
                    <div class="ns-empty ns-loading">加载中...</div>
                </div>
            </div>
            <div class="ns-card rank">
                <div class="ns-card-header">
                    <span>🏆 鸡腿排行榜</span>
                    <span class="ns-card-toggle">−</span>
                </div>
                <div class="ns-card-body">
                    <div class="ns-empty ns-loading">加载中...</div>
                </div>
            </div>
        `;

        document.body.appendChild(sidebar);

        // 绑定折叠事件
        sidebar.querySelectorAll('.ns-card-header').forEach(header => {
            header.addEventListener('click', () => {
                const card = header.closest('.ns-card');
                const toggle = header.querySelector('.ns-card-toggle');
                card.classList.toggle('collapsed');
                toggle.textContent = card.classList.contains('collapsed') ? '+' : '−';
            });
        });

        return sidebar;
    };

    const renderTradeCard = (card, items) => {
        const body = card.querySelector('.ns-card-body');
        if (!items?.length) {
            body.innerHTML = '<div class="ns-empty">暂无进行中交易</div>';
            return;
        }
        body.innerHTML = items.map(item => `
            <div class="ns-item">
                <a href="${escapeHtml(item.url)}" target="_blank" title="${escapeHtml(item.title)}">
                    <span class="ns-tag ${item.type}">${item.tag}</span>
                    <span class="ns-title">${escapeHtml(truncate(item.title, 18))}</span>
                </a>
            </div>
        `).join('');
    };

    const renderLotteryCard = (card, items) => {
        const body = card.querySelector('.ns-card-body');
        if (!items?.length) {
            body.innerHTML = '<div class="ns-empty">暂无进行中抽奖</div>';
            return;
        }
        body.innerHTML = items.map(item => `
            <div class="ns-item">
                <a href="${escapeHtml(item.url)}" target="_blank" title="${escapeHtml(item.title)}">
                    <span class="ns-tag ${item.type}">${item.tag}</span>
                    <span class="ns-title">${escapeHtml(truncate(item.title, 18))}</span>
                </a>
            </div>
        `).join('');
    };

    const renderRankCard = (card, items) => {
        const body = card.querySelector('.ns-card-body');
        if (!items?.length) {
            body.innerHTML = '<div class="ns-empty">暂无排行数据</div>';
            return;
        }
        body.innerHTML = items.map(item => {
            const rankClass = item.rank === 1 ? 'r1' : item.rank === 2 ? 'r2' : item.rank === 3 ? 'r3' : 'rn';
            return `
                <div class="ns-rank-item">
                    <span class="ns-rank-num ${rankClass}">${item.rank}</span>
                    <span class="ns-rank-name">
                        <a href="${escapeHtml(item.url)}" target="_blank">${escapeHtml(truncate(item.username, 12))}</a>
                    </span>
                    ${item.credit > 0 ? `<span class="ns-rank-score">🍗${item.credit}</span>` : ''}
                </div>
            `;
        }).join('');
    };

    const loadSidebarData = async (sidebar) => {
        const tradeCard = sidebar.querySelector('.ns-card.trade');
        const lotteryCard = sidebar.querySelector('.ns-card.lottery');
        const rankCard = sidebar.querySelector('.ns-card.rank');

        // 并行加载
        const [trades, lotteries, ranks] = await Promise.all([
            fetchActiveTrades(),
            fetchActiveLotteries(),
            fetchCreditRank()
        ]);

        renderTradeCard(tradeCard, trades);
        renderLotteryCard(lotteryCard, lotteries);
        renderRankCard(rankCard, ranks);
    };

    // ==================== 初始化 ====================
    const init = () => {
        console.log('[NS助手] v1.5.0 初始化');

        setTimeout(doCheckin, 1500);

        const isListPage = location.pathname === '/' ||
            location.pathname.startsWith('/board') ||
            location.pathname.startsWith('/categor');

        if (isListPage) {
            setTimeout(() => {
                const sidebar = createSidebar();
                loadSidebarData(sidebar);
            }, 800);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
