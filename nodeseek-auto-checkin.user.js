// ==UserScript==
// @name         NodeSeek 增强助手
// @namespace    https://github.com/weiruankeji2025/weiruan-nodeseek-Sign.in
// @version      1.4.0
// @description  NodeSeek论坛增强：自动签到 + 交易记录侧边栏 + 抽奖帖侧边栏
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
        HOME_URL: 'https://www.nodeseek.com/?orderBy=postTime',
        STORAGE_KEY: 'ns_last_checkin',
        RANDOM_MODE: true,
        SIDEBAR_COUNT: 5,
        CACHE_KEY: 'ns_sidebar_cache',
        CACHE_TTL: 3 * 60 * 1000  // 3分钟缓存
    };

    // ==================== 样式注入 ====================
    GM_addStyle(`
        /* 侧边栏容器 */
        .ns-sidebar {
            position: fixed;
            right: 15px;
            top: 50%;
            transform: translateY(-50%);
            width: 240px;
            max-height: 70vh;
            overflow-y: auto;
            z-index: 9998;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        /* 卡片样式 */
        .ns-card {
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow: hidden;
            font-size: 12px;
        }
        .ns-card-header {
            padding: 10px 12px;
            font-weight: 600;
            font-size: 13px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            user-select: none;
        }
        .ns-card-toggle { opacity: 0.7; font-size: 12px; }
        .ns-card-body { }
        .ns-card.collapsed .ns-card-body { display: none; }

        /* 交易卡片头部 */
        .ns-card.trade .ns-card-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff;
        }
        /* 抽奖卡片头部 */
        .ns-card.lottery .ns-card-header {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: #fff;
        }

        /* 列表项 */
        .ns-item {
            padding: 8px 12px;
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
            gap: 6px;
            line-height: 1.4;
        }
        .ns-item a:hover { color: #1890ff; }

        /* 标签 */
        .ns-tag {
            flex-shrink: 0;
            padding: 2px 5px;
            font-size: 10px;
            border-radius: 3px;
            color: #fff;
            font-weight: 500;
        }
        .ns-tag.sold { background: #52c41a; }
        .ns-tag.bought { background: #1890ff; }
        .ns-tag.active { background: #fa8c16; }
        .ns-tag.ended { background: #8c8c8c; }

        /* 标题文字 */
        .ns-title {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        /* 空状态 */
        .ns-empty {
            text-align: center;
            padding: 20px 12px;
            color: #999;
            font-size: 12px;
        }
        .ns-loading { color: #1890ff; }

        /* 深色模式 */
        @media (prefers-color-scheme: dark) {
            .ns-card { background: #242424; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
            .ns-item { border-color: #333; }
            .ns-item:hover { background: #2d2d2d; }
            .ns-item a { color: #e0e0e0; }
            .ns-empty { color: #666; }
        }

        /* 宽屏才显示 */
        @media (max-width: 1440px) {
            .ns-sidebar { display: none; }
        }
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
                console.log('[NS助手] 今日已签到过');
            } else {
                console.log('[NS助手] 签到响应:', data);
            }
        } catch (e) {
            console.error('[NS助手] 签到异常:', e);
        }
    };

    // ==================== 侧边栏数据获取 ====================

    // 从页面获取帖子列表
    const fetchPagePosts = async (url) => {
        try {
            console.log('[NS助手] 获取页面:', url);
            const res = await fetch(url, { credentials: 'include' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const html = await res.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');

            const posts = [];
            const seen = new Set();

            // 查找所有帖子链接
            const links = doc.querySelectorAll('a[href*="/post-"]');
            console.log('[NS助手] 找到链接数:', links.length);

            links.forEach(link => {
                const href = link.getAttribute('href');
                const postId = extractPostId(href);
                const title = link.textContent?.trim();

                // 过滤无效项
                if (!postId || !title || title.length < 3 || seen.has(postId)) return;

                // 排除分页链接、用户链接等
                if (link.closest('.pagination, [class*="page"]')) return;

                seen.add(postId);
                posts.push({
                    id: postId,
                    title: title,
                    url: href.startsWith('http') ? href : `https://www.nodeseek.com${href}`
                });
            });

            console.log('[NS助手] 解析帖子数:', posts.length);
            return posts;
        } catch (e) {
            console.error('[NS助手] 获取页面失败:', e);
            return [];
        }
    };

    // 获取交易成交记录
    const fetchTradeRecords = async () => {
        const posts = await fetchPagePosts(CONFIG.TRADE_URL);
        const results = [];

        for (const post of posts) {
            if (results.length >= CONFIG.SIDEBAR_COUNT) break;

            const title = post.title;
            // 匹配已出/已收
            const isSold = /[\[【(（]?已出[\]】)）]?|^已出/i.test(title);
            const isBought = /[\[【(（]?已收[\]】)）]?|^已收/i.test(title);

            if (isSold || isBought) {
                // 清理标题
                let cleanTitle = title
                    .replace(/[\[【(（]?\s*已出\s*[\]】)）]?/gi, '')
                    .replace(/[\[【(（]?\s*已收\s*[\]】)）]?/gi, '')
                    .replace(/^\s*[:：]\s*/, '')
                    .trim();

                if (cleanTitle.length > 2) {
                    results.push({
                        title: cleanTitle,
                        url: post.url,
                        type: isSold ? 'sold' : 'bought',
                        tag: isSold ? '已出' : '已收'
                    });
                }
            }
        }

        console.log('[NS助手] 交易记录:', results.length);
        return results;
    };

    // 获取抽奖帖子
    const fetchLotteryPosts = async () => {
        const posts = await fetchPagePosts(CONFIG.HOME_URL);
        const results = [];

        for (const post of posts) {
            if (results.length >= CONFIG.SIDEBAR_COUNT) break;

            const title = post.title;
            // 匹配抽奖相关关键词
            const isLottery = /抽奖|开奖|福利|免费送|白嫖|送\d+个|送.{1,5}账号/i.test(title);

            if (isLottery) {
                const isEnded = /已开奖|已结束|已完成|结束/.test(title);

                // 清理标题
                let cleanTitle = title
                    .replace(/[\[【(（]?\s*(已开奖|抽奖|开奖|福利)\s*[\]】)）]?/gi, '')
                    .replace(/^\s*[:：]\s*/, '')
                    .trim();

                results.push({
                    title: cleanTitle || title,
                    url: post.url,
                    type: isEnded ? 'ended' : 'active',
                    tag: isEnded ? '已开奖' : '进行中'
                });
            }
        }

        console.log('[NS助手] 抽奖帖子:', results.length);
        return results;
    };

    // ==================== 侧边栏UI ====================

    const createSidebar = () => {
        // 移除旧的
        document.querySelector('.ns-sidebar')?.remove();

        const sidebar = document.createElement('div');
        sidebar.className = 'ns-sidebar';
        sidebar.innerHTML = `
            <div class="ns-card trade">
                <div class="ns-card-header">
                    <span>📦 最近成交</span>
                    <span class="ns-card-toggle">−</span>
                </div>
                <div class="ns-card-body">
                    <div class="ns-empty ns-loading">加载中...</div>
                </div>
            </div>
            <div class="ns-card lottery">
                <div class="ns-card-header">
                    <span>🎁 最新抽奖</span>
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

    const renderCardData = (card, items) => {
        const body = card.querySelector('.ns-card-body');

        if (!items || items.length === 0) {
            body.innerHTML = '<div class="ns-empty">暂无数据</div>';
            return;
        }

        body.innerHTML = items.map(item => `
            <div class="ns-item">
                <a href="${escapeHtml(item.url)}" target="_blank" title="${escapeHtml(item.title)}">
                    <span class="ns-tag ${item.type}">${item.tag}</span>
                    <span class="ns-title">${escapeHtml(truncate(item.title, 20))}</span>
                </a>
            </div>
        `).join('');
    };

    const loadSidebarData = async (sidebar) => {
        const tradeCard = sidebar.querySelector('.ns-card.trade');
        const lotteryCard = sidebar.querySelector('.ns-card.lottery');

        // 并行加载数据
        const [trades, lotteries] = await Promise.all([
            fetchTradeRecords(),
            fetchLotteryPosts()
        ]);

        renderCardData(tradeCard, trades);
        renderCardData(lotteryCard, lotteries);
    };

    // ==================== 初始化 ====================
    const init = () => {
        console.log('[NS助手] v1.4.0 初始化');

        // 签到
        setTimeout(doCheckin, 1500);

        // 侧边栏 - 仅在列表页显示
        const isListPage = location.pathname === '/' ||
            location.pathname.startsWith('/board') ||
            location.pathname.startsWith('/categor');

        if (isListPage) {
            setTimeout(() => {
                const sidebar = createSidebar();
                loadSidebarData(sidebar);
            }, 1000);
        }
    };

    // 启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
