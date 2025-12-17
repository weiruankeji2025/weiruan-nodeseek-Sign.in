// ==UserScript==
// @name         NodeSeek 增强助手
// @namespace    https://github.com/weiruankeji2025/weiruan-nodeseek-Sign.in
// @version      1.6.0
// @description  NodeSeek论坛增强：自动签到 + 进行中交易 + 抽奖帖 + 鸡腿排行榜(30分钟刷新)
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
        RANK_CACHE_KEY: 'ns_rank_cache',
        RANDOM_MODE: true,
        TRADE_COUNT: 5,
        LOTTERY_COUNT: 10,
        RANK_COUNT: 10,
        RANK_REFRESH_INTERVAL: 30 * 60 * 1000  // 30分钟刷新
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
        .ns-card.rank .ns-card-header { background: linear-gradient(135deg, #f6d365 0%, #fda085 100%); color: #fff; }

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

        .ns-title {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        /* 排行榜样式 */
        .ns-rank-item {
            padding: 6px 10px;
            border-bottom: 1px solid #f0f0f0;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 11px;
        }
        .ns-rank-item:last-child { border-bottom: none; }
        .ns-rank-item:hover { background: #f8f9fa; }
        .ns-rank-num {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: 700;
            color: #fff;
            flex-shrink: 0;
        }
        .ns-rank-num.r1 { background: linear-gradient(135deg, #ffd700, #ff8c00); text-shadow: 0 1px 1px rgba(0,0,0,0.2); }
        .ns-rank-num.r2 { background: linear-gradient(135deg, #e8e8e8, #b0b0b0); }
        .ns-rank-num.r3 { background: linear-gradient(135deg, #cd7f32, #8b4513); }
        .ns-rank-num.rn { background: #f0f0f0; color: #666; }
        .ns-rank-name {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .ns-rank-name a { color: #333; text-decoration: none; font-weight: 500; }
        .ns-rank-name a:hover { color: #1890ff; }
        .ns-rank-credit {
            color: #fa8c16;
            font-weight: 600;
            font-size: 11px;
            white-space: nowrap;
        }
        .ns-rank-footer {
            padding: 6px 10px;
            text-align: center;
            font-size: 10px;
            color: #999;
            border-top: 1px solid #f0f0f0;
        }

        .ns-empty { text-align: center; padding: 15px 10px; color: #999; font-size: 11px; }
        .ns-loading { color: #1890ff; }

        @media (prefers-color-scheme: dark) {
            .ns-card { background: #242424; box-shadow: 0 1px 6px rgba(0,0,0,0.3); }
            .ns-item, .ns-rank-item, .ns-rank-footer { border-color: #333; }
            .ns-item:hover, .ns-rank-item:hover { background: #2d2d2d; }
            .ns-item a, .ns-rank-name a { color: #e0e0e0; }
            .ns-rank-num.rn { background: #333; color: #aaa; }
            .ns-empty, .ns-rank-footer { color: #666; }
        }

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
    const formatNumber = (num) => {
        if (num >= 10000) return (num / 10000).toFixed(1) + 'w';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
        return num.toString();
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

    // ==================== 数据获取 ====================
    const fetchPagePosts = async (url) => {
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
                posts.push({ id: postId, title, url: href.startsWith('http') ? href : `https://www.nodeseek.com${href}` });
            });
            return posts;
        } catch (e) {
            console.error('[NS助手] 获取页面失败:', e);
            return [];
        }
    };

    const fetchActiveTrades = async () => {
        const posts = await fetchPagePosts(CONFIG.TRADE_URL);
        const results = [];
        for (const post of posts) {
            if (results.length >= CONFIG.TRADE_COUNT) break;
            if (/已出|已收|已售|sold|closed/i.test(post.title)) continue;
            const isBuy = /收|求|buy|购/i.test(post.title);
            results.push({ title: post.title, url: post.url, type: isBuy ? 'buy' : 'sell', tag: isBuy ? '求购' : '出售' });
        }
        return results;
    };

    const fetchActiveLotteries = async () => {
        const allPosts = [];
        for (const url of [CONFIG.HOME_URL, CONFIG.HOME_URL + '?page=2']) {
            allPosts.push(...await fetchPagePosts(url));
        }
        const results = [], seen = new Set();
        for (const post of allPosts) {
            if (results.length >= CONFIG.LOTTERY_COUNT || seen.has(post.id)) continue;
            if (!/抽奖|开奖|福利|免费送|白嫖|送\d+|🎁|🎉/i.test(post.title)) continue;
            if (/已开奖|已结束|已完成|结束|开奖结果/i.test(post.title)) continue;
            seen.add(post.id);
            const cleanTitle = post.title.replace(/[\[【(（]?\s*(抽奖|开奖|福利)\s*[\]】)）]?/gi, '').replace(/^\s*[:：]\s*/, '').trim();
            results.push({ title: cleanTitle || post.title, url: post.url, type: 'active', tag: '抽奖' });
        }
        return results;
    };

    // ==================== 鸡腿排行榜 ====================
    const fetchCreditRank = async (forceRefresh = false) => {
        // 检查缓存
        const cached = GM_getValue(CONFIG.RANK_CACHE_KEY);
        if (!forceRefresh && cached && Date.now() - cached.time < CONFIG.RANK_REFRESH_INTERVAL) {
            console.log('[NS助手] 使用排行榜缓存');
            return cached.data;
        }

        console.log('[NS助手] 获取全站鸡腿排行榜...');
        const results = [];

        // 尝试多个可能的排行榜URL
        const rankUrls = [
            'https://www.nodeseek.com/rank',
            'https://www.nodeseek.com/rank/credit',
            'https://www.nodeseek.com/ranks',
            'https://www.nodeseek.com/leaderboard'
        ];

        for (const url of rankUrls) {
            try {
                const res = await fetch(url, { credentials: 'include' });
                if (!res.ok) continue;

                const html = await res.text();
                const doc = new DOMParser().parseFromString(html, 'text/html');

                // 尝试解析排行榜数据
                const items = doc.querySelectorAll('tr, [class*="rank-item"], [class*="user-item"], [class*="leaderboard"]');

                items.forEach(item => {
                    if (results.length >= CONFIG.RANK_COUNT) return;

                    const userLink = item.querySelector('a[href*="/space/"]');
                    if (!userLink) return;

                    const username = userLink.textContent?.trim();
                    const userUrl = userLink.getAttribute('href');
                    if (!username || username.length < 2) return;

                    // 查找鸡腿数
                    let credit = 0;
                    const allText = item.textContent;

                    // 尝试多种匹配方式
                    const patterns = [
                        /(\d{1,7})\s*鸡腿/,
                        /鸡腿[：:\s]*(\d{1,7})/,
                        /credit[：:\s]*(\d{1,7})/i,
                        /积分[：:\s]*(\d{1,7})/,
                        /(\d{3,7})(?=\s*$)/  // 行末的大数字
                    ];

                    for (const pattern of patterns) {
                        const match = allText.match(pattern);
                        if (match) {
                            credit = parseInt(match[1]);
                            break;
                        }
                    }

                    // 检查是否重复
                    if (results.some(r => r.username === username)) return;

                    results.push({
                        rank: results.length + 1,
                        username,
                        url: userUrl?.startsWith('http') ? userUrl : `https://www.nodeseek.com${userUrl}`,
                        credit
                    });
                });

                if (results.length > 0) {
                    console.log(`[NS助手] 从 ${url} 获取到 ${results.length} 条排行数据`);
                    break;
                }
            } catch (e) {
                console.log(`[NS助手] ${url} 获取失败:`, e.message);
            }
        }

        // 如果没有获取到数据，尝试从API获取
        if (results.length === 0) {
            try {
                const apiUrls = [
                    'https://www.nodeseek.com/api/rank/credit',
                    'https://www.nodeseek.com/api/users/top',
                    'https://www.nodeseek.com/api/leaderboard'
                ];

                for (const apiUrl of apiUrls) {
                    try {
                        const res = await fetch(apiUrl, { credentials: 'include' });
                        if (!res.ok) continue;

                        const data = await res.json();
                        if (data && Array.isArray(data.data || data.users || data.list || data)) {
                            const list = data.data || data.users || data.list || data;
                            list.slice(0, CONFIG.RANK_COUNT).forEach((item, i) => {
                                results.push({
                                    rank: i + 1,
                                    username: item.username || item.name || item.user,
                                    url: `https://www.nodeseek.com/space/${item.uid || item.id || item.userId}`,
                                    credit: item.credit || item.score || item.points || 0
                                });
                            });
                            if (results.length > 0) {
                                console.log(`[NS助手] 从API获取到 ${results.length} 条排行数据`);
                                break;
                            }
                        }
                    } catch {}
                }
            } catch {}
        }

        // 缓存结果
        if (results.length > 0) {
            GM_setValue(CONFIG.RANK_CACHE_KEY, { data: results, time: Date.now() });
        }

        return results;
    };

    // ==================== 侧边栏UI ====================
    let sidebarInstance = null;
    let rankRefreshTimer = null;

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
                <div class="ns-card-body"><div class="ns-empty ns-loading">加载中...</div></div>
            </div>
            <div class="ns-card lottery">
                <div class="ns-card-header">
                    <span>🎁 进行中抽奖</span>
                    <span class="ns-card-toggle">−</span>
                </div>
                <div class="ns-card-body"><div class="ns-empty ns-loading">加载中...</div></div>
            </div>
            <div class="ns-card rank">
                <div class="ns-card-header">
                    <span>🏆 鸡腿排行榜</span>
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

        const now = new Date();
        const nextRefresh = new Date(now.getTime() + CONFIG.RANK_REFRESH_INTERVAL);
        const refreshTime = `${nextRefresh.getHours().toString().padStart(2, '0')}:${nextRefresh.getMinutes().toString().padStart(2, '0')}`;

        body.innerHTML = items.map(item => {
            const rankClass = item.rank === 1 ? 'r1' : item.rank === 2 ? 'r2' : item.rank === 3 ? 'r3' : 'rn';
            return `
                <div class="ns-rank-item">
                    <span class="ns-rank-num ${rankClass}">${item.rank}</span>
                    <span class="ns-rank-name">
                        <a href="${escapeHtml(item.url)}" target="_blank">${escapeHtml(truncate(item.username, 10))}</a>
                    </span>
                    <span class="ns-rank-credit">🍗 ${item.credit > 0 ? formatNumber(item.credit) : '-'}</span>
                </div>
            `;
        }).join('') + `<div class="ns-rank-footer">每30分钟更新 · 下次 ${refreshTime}</div>`;
    };

    const loadSidebarData = async (sidebar) => {
        const [trades, lotteries, ranks] = await Promise.all([
            fetchActiveTrades(),
            fetchActiveLotteries(),
            fetchCreditRank()
        ]);

        renderTradeCard(sidebar.querySelector('.ns-card.trade'), trades);
        renderLotteryCard(sidebar.querySelector('.ns-card.lottery'), lotteries);
        renderRankCard(sidebar.querySelector('.ns-card.rank'), ranks);
    };

    const refreshRankData = async () => {
        if (!sidebarInstance) return;
        const rankCard = sidebarInstance.querySelector('.ns-card.rank');
        if (!rankCard) return;

        console.log('[NS助手] 刷新鸡腿排行榜...');
        const ranks = await fetchCreditRank(true);
        renderRankCard(rankCard, ranks);
    };

    // ==================== 初始化 ====================
    const init = () => {
        console.log('[NS助手] v1.6.0 初始化');

        setTimeout(doCheckin, 1500);

        const isListPage = location.pathname === '/' ||
            location.pathname.startsWith('/board') ||
            location.pathname.startsWith('/categor');

        if (isListPage) {
            setTimeout(async () => {
                const sidebar = createSidebar();
                await loadSidebarData(sidebar);

                // 设置30分钟刷新排行榜
                rankRefreshTimer = setInterval(refreshRankData, CONFIG.RANK_REFRESH_INTERVAL);
                console.log('[NS助手] 排行榜将每30分钟刷新一次');
            }, 800);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
