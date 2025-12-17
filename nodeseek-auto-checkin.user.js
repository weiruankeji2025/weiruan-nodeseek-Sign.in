// ==UserScript==
// @name         NodeSeek 增强助手
// @namespace    https://github.com/weiruankeji2025/weiruan-nodeseek-Sign.in
// @version      1.2.0
// @description  NodeSeek论坛增强：自动签到 + 最新留言预览 + 交易成功记录侧边栏
// @author       weiruankeji2025
// @match        https://www.nodeseek.com/*
// @icon         https://www.nodeseek.com/favicon.ico
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @grant        GM_addStyle
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // ==================== 配置 ====================
    const CONFIG = {
        API_URL: 'https://www.nodeseek.com/api/attendance',
        TRADE_URL: 'https://www.nodeseek.com/categories/trade',
        STORAGE_KEY: 'ns_last_checkin',
        RANDOM_MODE: true,
        PREVIEW_MAX_LEN: 50,
        TRADE_COUNT: 5,
        CACHE_TTL: 5 * 60 * 1000
    };

    const commentCache = new Map();

    // ==================== 样式注入 ====================
    GM_addStyle(`
        /* 最新留言样式 */
        .ns-latest-comment {
            display: inline-block;
            max-width: 300px;
            margin-left: 8px;
            padding: 2px 8px;
            font-size: 12px;
            color: #666;
            background: #f5f5f5;
            border-radius: 4px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            vertical-align: middle;
            cursor: pointer;
            transition: all 0.2s;
        }
        .ns-latest-comment:hover { background: #e8e8e8; color: #333; }
        .ns-latest-comment .ns-author { color: #1890ff; margin-right: 4px; }
        .ns-loading { color: #999; font-style: italic; }

        /* 交易侧边栏样式 */
        .ns-trade-sidebar {
            position: fixed;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            width: 280px;
            max-height: 400px;
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.1);
            z-index: 9999;
            overflow: hidden;
            font-size: 13px;
        }
        .ns-trade-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff;
            padding: 12px 15px;
            font-weight: 600;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .ns-trade-header span { font-size: 12px; opacity: 0.8; cursor: pointer; }
        .ns-trade-header span:hover { opacity: 1; }
        .ns-trade-list { padding: 8px 0; max-height: 320px; overflow-y: auto; }
        .ns-trade-item {
            padding: 10px 15px;
            border-bottom: 1px solid #f0f0f0;
            transition: background 0.2s;
        }
        .ns-trade-item:last-child { border-bottom: none; }
        .ns-trade-item:hover { background: #f9f9f9; }
        .ns-trade-item a {
            color: #333;
            text-decoration: none;
            display: block;
            line-height: 1.4;
        }
        .ns-trade-item a:hover { color: #1890ff; }
        .ns-trade-title {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            margin-bottom: 4px;
        }
        .ns-trade-tag {
            display: inline-block;
            padding: 1px 6px;
            font-size: 11px;
            border-radius: 3px;
            margin-right: 5px;
        }
        .ns-trade-tag.sold { background: #52c41a; color: #fff; }
        .ns-trade-tag.bought { background: #1890ff; color: #fff; }
        .ns-trade-meta { font-size: 11px; color: #999; }
        .ns-trade-empty { text-align: center; padding: 30px; color: #999; }
        .ns-trade-collapsed { width: auto; height: auto; }
        .ns-trade-collapsed .ns-trade-list { display: none; }
        .ns-trade-collapsed .ns-trade-header { border-radius: 8px; }

        /* 深色模式 */
        @media (prefers-color-scheme: dark) {
            .ns-latest-comment { background: #333; color: #aaa; }
            .ns-latest-comment:hover { background: #444; color: #ddd; }
            .ns-trade-sidebar { background: #1f1f1f; }
            .ns-trade-item { border-color: #333; }
            .ns-trade-item:hover { background: #2a2a2a; }
            .ns-trade-item a { color: #ddd; }
            .ns-trade-meta { color: #666; }
        }

        /* 响应式隐藏 */
        @media (max-width: 1400px) {
            .ns-trade-sidebar { display: none; }
        }
    `);

    // ==================== 工具函数 ====================
    const getToday = () => new Date().toISOString().slice(0, 10);
    const hasCheckedIn = () => GM_getValue(CONFIG.STORAGE_KEY) === getToday();
    const notify = (title, text) => {
        GM_notification({ title, text, timeout: 3000 });
        console.log(`[NS助手] ${title}: ${text}`);
    };
    const extractPostId = (url) => {
        const match = url.match(/\/post-(\d+)/);
        return match ? match[1] : null;
    };
    const truncate = (text, len) => {
        text = text.trim().replace(/\s+/g, ' ');
        return text.length > len ? text.slice(0, len) + '...' : text;
    };

    // ==================== 签到功能 ====================
    const doCheckin = async () => {
        if (hasCheckedIn()) return;
        try {
            const res = await fetch(CONFIG.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Origin': 'https://www.nodeseek.com',
                    'Referer': 'https://www.nodeseek.com/board'
                },
                credentials: 'include',
                body: `random=${CONFIG.RANDOM_MODE}`
            });
            const data = await res.json();
            if (data.success) {
                GM_setValue(CONFIG.STORAGE_KEY, getToday());
                notify('签到成功', data.message || '获得鸡腿奖励！');
            } else if (data.message?.includes('已完成签到')) {
                GM_setValue(CONFIG.STORAGE_KEY, getToday());
            }
        } catch (e) {
            console.error('[NS助手] 签到异常:', e);
        }
    };

    // ==================== 最新留言功能 ====================
    const fetchLatestComment = async (postId) => {
        const cached = commentCache.get(postId);
        if (cached && Date.now() - cached.time < CONFIG.CACHE_TTL) return cached.data;

        try {
            const res = await fetch(`https://www.nodeseek.com/post-${postId}-1`, { credentials: 'include' });
            const html = await res.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');

            const pagination = doc.querySelector('.pagination');
            let lastPageUrl = `/post-${postId}-1`;
            if (pagination) {
                const pageLinks = pagination.querySelectorAll('a[href*="/post-"]');
                if (pageLinks.length > 0) lastPageUrl = pageLinks[pageLinks.length - 1].getAttribute('href');
            }

            let commentsDoc = doc;
            if (lastPageUrl !== `/post-${postId}-1`) {
                const lastRes = await fetch(`https://www.nodeseek.com${lastPageUrl}`, { credentials: 'include' });
                commentsDoc = new DOMParser().parseFromString(await lastRes.text(), 'text/html');
            }

            const comments = commentsDoc.querySelectorAll('.post-content, .comment-content, .content, [class*="comment"], [class*="reply"]');
            let latestComment = null;

            if (comments.length > 0) {
                const lastComment = comments[comments.length - 1];
                const authorEl = lastComment.closest('[class*="post"], [class*="comment"], [class*="reply"]')
                    ?.querySelector('[class*="author"], [class*="user"], .username, a[href*="/space/"]');
                latestComment = {
                    author: authorEl?.textContent?.trim() || '匿名',
                    content: lastComment.textContent?.trim() || ''
                };
            }

            if (!latestComment?.content) {
                const allPosts = commentsDoc.querySelectorAll('[id^="post-"]');
                if (allPosts.length > 0) {
                    const lastPost = allPosts[allPosts.length - 1];
                    const contentEl = lastPost.querySelector('[class*="content"], p, .text');
                    const authorEl = lastPost.querySelector('a[href*="/space/"], [class*="author"]');
                    if (contentEl) {
                        latestComment = {
                            author: authorEl?.textContent?.trim() || '匿名',
                            content: contentEl.textContent?.trim() || ''
                        };
                    }
                }
            }

            commentCache.set(postId, { data: latestComment, time: Date.now() });
            return latestComment;
        } catch (e) {
            console.error('[NS助手] 获取评论失败:', e);
            return null;
        }
    };

    const addCommentPreview = async (titleEl, postId) => {
        if (titleEl.dataset.nsProcessed) return;
        titleEl.dataset.nsProcessed = 'true';

        const preview = document.createElement('span');
        preview.className = 'ns-latest-comment ns-loading';
        preview.textContent = '加载中...';
        titleEl.parentNode.insertBefore(preview, titleEl.nextSibling);

        const comment = await fetchLatestComment(postId);
        if (comment?.content) {
            preview.className = 'ns-latest-comment';
            preview.innerHTML = `<span class="ns-author">${comment.author}:</span>${truncate(comment.content, CONFIG.PREVIEW_MAX_LEN)}`;
            preview.title = `${comment.author}: ${comment.content}`;
        } else {
            preview.remove();
        }
    };

    const processPostList = () => {
        document.querySelectorAll('a[href*="/post-"]').forEach(link => {
            const postId = extractPostId(link.getAttribute('href'));
            if (!postId) return;
            const parent = link.closest('[class*="title"], [class*="post-item"], [class*="topic"], li, tr');
            if (!parent) return;
            const isMainTitle = link.textContent.length > 5 && !link.closest('[class*="meta"], [class*="info"], [class*="stat"]');
            if (isMainTitle) addCommentPreview(link, postId);
        });
    };

    // ==================== 交易记录侧边栏 ====================
    const fetchTradeRecords = async () => {
        try {
            const res = await fetch(CONFIG.TRADE_URL, { credentials: 'include' });
            const html = await res.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');

            const trades = [];
            const links = doc.querySelectorAll('a[href*="/post-"]');

            links.forEach(link => {
                const title = link.textContent.trim();
                const href = link.getAttribute('href');

                // 匹配已出/已收标记
                const soldMatch = title.match(/[\[【(（]?\s*已出\s*[\]】)）]?/i);
                const boughtMatch = title.match(/[\[【(（]?\s*已收\s*[\]】)）]?/i);

                if ((soldMatch || boughtMatch) && href && trades.length < CONFIG.TRADE_COUNT) {
                    // 清理标题
                    let cleanTitle = title
                        .replace(/[\[【(（]?\s*已出\s*[\]】)）]?/gi, '')
                        .replace(/[\[【(（]?\s*已收\s*[\]】)）]?/gi, '')
                        .trim();

                    if (cleanTitle.length > 2) {
                        trades.push({
                            title: cleanTitle,
                            url: href.startsWith('http') ? href : `https://www.nodeseek.com${href}`,
                            type: soldMatch ? 'sold' : 'bought'
                        });
                    }
                }
            });

            return trades;
        } catch (e) {
            console.error('[NS助手] 获取交易记录失败:', e);
            return [];
        }
    };

    const createTradeSidebar = async () => {
        // 检查是否已存在
        if (document.querySelector('.ns-trade-sidebar')) return;

        const sidebar = document.createElement('div');
        sidebar.className = 'ns-trade-sidebar';
        sidebar.innerHTML = `
            <div class="ns-trade-header">
                <span>📦 最近成交</span>
                <span class="ns-toggle" title="折叠/展开">−</span>
            </div>
            <div class="ns-trade-list">
                <div class="ns-trade-empty">加载中...</div>
            </div>
        `;
        document.body.appendChild(sidebar);

        // 折叠功能
        const toggle = sidebar.querySelector('.ns-toggle');
        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('ns-trade-collapsed');
            toggle.textContent = sidebar.classList.contains('ns-trade-collapsed') ? '+' : '−';
        });

        // 获取交易记录
        const trades = await fetchTradeRecords();
        const list = sidebar.querySelector('.ns-trade-list');

        if (trades.length === 0) {
            list.innerHTML = '<div class="ns-trade-empty">暂无成交记录</div>';
            return;
        }

        list.innerHTML = trades.map(t => `
            <div class="ns-trade-item">
                <a href="${t.url}" target="_blank">
                    <div class="ns-trade-title">
                        <span class="ns-trade-tag ${t.type}">${t.type === 'sold' ? '已出' : '已收'}</span>
                        ${truncate(t.title, 30)}
                    </div>
                </a>
            </div>
        `).join('');
    };

    // ==================== 初始化 ====================
    const init = () => {
        setTimeout(doCheckin, 2000);

        // 帖子列表页处理最新留言
        if (location.pathname.includes('/board') ||
            location.pathname === '/' ||
            location.pathname.includes('/category')) {
            setTimeout(processPostList, 1000);

            const observer = new MutationObserver((mutations) => {
                for (const m of mutations) {
                    if (m.addedNodes.length) {
                        setTimeout(processPostList, 500);
                        break;
                    }
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }

        // 主页显示交易侧边栏
        if (location.pathname === '/' || location.pathname.includes('/board')) {
            setTimeout(createTradeSidebar, 1500);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
