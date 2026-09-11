/* ============================================================
   MODERN UI ENHANCER — additive only.
   - Injects charts (Chart.js) onto the dashboard
   - Animates stat numbers
   - Ripple effect on buttons/cards
   - Sparkline mini-charts in stat cards
   - Tilt shine on cards
   Everything is wrapped in try/catch and is fully optional.
   ============================================================ */
(function () {
    "use strict";

    const MUI = {
        chartInstances: new Map(),
        observer: null,
        debounceTimer: null,

        init() {
            try {
                if (typeof window.SoundEffects !== 'undefined') window.SoundEffects.init();
                this.installRipple();
                this.installCardShine();
                this.installBackToTop();
                this.attachObserver();
                // first run after main scripts boot the dashboard
                requestAnimationFrame(() => requestAnimationFrame(() => this.applyEnhancements()));
            } catch (e) {
                console.warn("[modern-ui] init failed:", e);
            }
        },

        attachObserver() {
            const main = document.getElementById("main-content");
            if (!main) return;
            this.observer = new MutationObserver(() => {
                clearTimeout(this.debounceTimer);
                this.debounceTimer = setTimeout(() => this.applyEnhancements(), 80);
            });
            this.observer.observe(main, { childList: true, subtree: false });
        },

        async applyEnhancements() {
            try {
                const chartSurface = document.querySelector('.dashboard,.personal-page,.tech-theme-habits,.tech-theme-goals,.tech-theme-tracker,.tech-theme-money,.tech-theme-tech');
                if (chartSurface && !this.ensureChart() && window.AssetLoader) await AssetLoader.chart();
                this.disposeCharts();
                this.injectDashboardCharts();
                this.injectPersonalHomeChart();
                this.injectHabitsCharts();
                this.injectGoalsChart();
                this.injectTrackerChart();
                this.injectMoneyChart();
                this.injectTechChart();
                this.animateStatNumbers();
                this.addSparklines();
                this.animateProgressBars();
                this.scrollActiveFeatureTab();
            } catch (e) {
                console.warn("[modern-ui] enhance failed:", e);
            }
        },

        /* ------------- Active feature-tab into view ---------- */
        scrollActiveFeatureTab() {
            const tabs = document.querySelector(".feature-tabs");
            if (!tabs) return;
            const active = tabs.querySelector(".cat-btn.active");
            if (!active) return;
            try {
                const tabsBox = tabs.getBoundingClientRect();
                const aBox = active.getBoundingClientRect();
                if (aBox.left < tabsBox.left || aBox.right > tabsBox.right) {
                    active.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
                }
            } catch (_) {}
        },

        /* ------------- Chart.js helpers ------------- */
        themeColors() {
            const css = getComputedStyle(document.body);
            const accent = (css.getPropertyValue("--accent").trim() || "#7C4DFF");
            const accent2 = (css.getPropertyValue("--accent2").trim() || "#00BFA5");
            const accent3 = (css.getPropertyValue("--accent3").trim() || "#FF6D00");
            const text = (css.getPropertyValue("--text-primary").trim() || "#f0f2f7");
            const muted = (css.getPropertyValue("--text-muted").trim() || "#5a6380");
            const border = (css.getPropertyValue("--border").trim() || "rgba(255,255,255,.08)");
            return { accent, accent2, accent3, text, muted, border };
        },

        gradient(ctx, area, c1, c2) {
            if (!area) return c1;
            const g = ctx.createLinearGradient(0, area.top, 0, area.bottom);
            g.addColorStop(0, c1);
            g.addColorStop(1, c2);
            return g;
        },

        ensureChart() {
            return typeof window !== "undefined" && typeof window.Chart !== "undefined";
        },

        disposeCharts() {
            this.chartInstances.forEach(c => { try { c.destroy(); } catch (_) {} });
            this.chartInstances.clear();
        },

        /* ------------- Dashboard charts ------------- */
        injectDashboardCharts() {
            const dashboard = document.querySelector(".dashboard");
            if (!dashboard) return;
            if (dashboard.classList.contains('dashboard-today')) return;

            if (!this.ensureChart()) {
                // chart.js still loading — try again shortly
                setTimeout(() => this.injectDashboardCharts(), 250);
                return;
            }

            const data = this.collectDashboardData();
            if (!data) return;

            const grid = dashboard.querySelector(".mui-charts-grid");
            if (grid) {
                const activityWrap = grid.querySelector(".mui-chart-card:not(.is-donut) .mui-chart-canvas-wrap");
                if (activityWrap) activityWrap.innerHTML = '<canvas id="mui-chart-activity"></canvas>';
                const distributionWrap = grid.querySelector(".mui-chart-card.is-donut .mui-chart-canvas-wrap");
                if (distributionWrap) distributionWrap.innerHTML = '<canvas id="mui-chart-distribution"></canvas>';
                this.renderActivityChart(data);
                this.renderDistributionChart(data);
                return;
            }

            const newGrid = document.createElement("div");
            newGrid.className = "mui-charts-grid";
            newGrid.innerHTML = `
                <div class="mui-chart-card">
                    <div class="mui-chart-head">
                        <h3><span>📈</span> Atividade dos últimos 14 dias</h3>
                        <span class="mui-chip">Linha do tempo</span>
                    </div>
                    <div class="mui-chart-canvas-wrap">
                        <canvas id="mui-chart-activity"></canvas>
                    </div>
                </div>
                <div class="mui-chart-card is-donut">
                    <div class="mui-chart-head">
                        <h3><span>🧭</span> Distribuição do conteúdo</h3>
                        <span class="mui-chip">Resumo</span>
                    </div>
                    <div class="mui-chart-canvas-wrap">
                        <canvas id="mui-chart-distribution"></canvas>
                    </div>
                    <div class="mui-donut-legend" id="mui-donut-legend"></div>
                </div>
            `;

            // Place AFTER the stats grid if present, else AFTER the welcome block
            const stats = dashboard.querySelector(".stats-grid");
            const cockpit = dashboard.querySelector(".power-cockpit");
            const anchor = stats || cockpit || dashboard.querySelector(".dash-welcome");
            if (anchor && anchor.parentNode === dashboard) {
                anchor.insertAdjacentElement("afterend", newGrid);
            } else {
                dashboard.appendChild(newGrid);
            }

            this.renderActivityChart(data);
            this.renderDistributionChart(data);
        },

        collectDashboardData() {
            try {
                const bks = (typeof Storage !== "undefined" && Storage.getBookmarks) ? Storage.getBookmarks() : [];
                const notes = (typeof Storage !== "undefined" && Storage.getNotes) ? Storage.getNotes() : [];
                const days = 14;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const labels = [];
                const linksSeries = new Array(days).fill(0);
                const notesSeries = new Array(days).fill(0);

                for (let i = days - 1; i >= 0; i--) {
                    const d = new Date(today);
                    d.setDate(today.getDate() - i);
                    labels.push(d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }));
                }

                const indexOfDate = (dateStr) => {
                    if (!dateStr) return -1;
                    const d = new Date(dateStr);
                    if (Number.isNaN(d.getTime())) return -1;
                    d.setHours(0, 0, 0, 0);
                    const diff = Math.floor((today - d) / 86400000);
                    if (diff < 0 || diff >= days) return -1;
                    return days - 1 - diff;
                };

                bks.forEach(b => {
                    const idx = indexOfDate(b.createdAt || b.updatedAt);
                    if (idx >= 0) linksSeries[idx]++;
                });
                notes.forEach(n => {
                    const idx = indexOfDate(n.updatedAt || n.createdAt);
                    if (idx >= 0) notesSeries[idx]++;
                });

                // distribution
                const folders = (typeof Storage !== "undefined" && Storage.getBkFolders ? Storage.getBkFolders() : [])
                    .concat(typeof Storage !== "undefined" && Storage.getNtFolders ? Storage.getNtFolders() : []);
                const favorites = bks.filter(b => b.favorite).length;
                const distribution = [
                    { label: "Bookmarks", value: bks.length },
                    { label: "Notas", value: notes.length },
                    { label: "Pastas", value: folders.length },
                    { label: "Favoritos", value: favorites }
                ];

                return { labels, linksSeries, notesSeries, distribution };
            } catch (e) {
                console.warn("[modern-ui] collectDashboardData:", e);
                return null;
            }
        },

        renderActivityChart(data) {
            const canvas = document.getElementById("mui-chart-activity");
            if (!canvas || !this.ensureChart()) return;
            const total = (data.linksSeries.reduce((a, b) => a + b, 0)) + (data.notesSeries.reduce((a, b) => a + b, 0));
            if (total === 0) {
                this.renderEmpty(canvas, "Sem atividade ainda", "Comece a salvar bookmarks ou notas — o gráfico aparece aqui.");
                return;
            }
            const colors = this.themeColors();
            const ctx = canvas.getContext("2d");
            const chart = new Chart(ctx, {
                type: "line",
                data: {
                    labels: data.labels,
                    datasets: [
                        {
                            label: "Bookmarks",
                            data: data.linksSeries,
                            borderColor: colors.accent,
                            backgroundColor: (c) => this.gradient(c.chart.ctx, c.chart.chartArea, hexA(colors.accent, .35), hexA(colors.accent, 0)),
                            tension: 0.4,
                            fill: true,
                            borderWidth: 2,
                            pointRadius: 0,
                            pointHoverRadius: 5,
                            pointHoverBackgroundColor: colors.accent,
                            pointHoverBorderColor: "#fff",
                            pointHoverBorderWidth: 2,
                        },
                        {
                            label: "Notas",
                            data: data.notesSeries,
                            borderColor: colors.accent2,
                            backgroundColor: (c) => this.gradient(c.chart.ctx, c.chart.chartArea, hexA(colors.accent2, .28), hexA(colors.accent2, 0)),
                            tension: 0.4,
                            fill: true,
                            borderWidth: 2,
                            pointRadius: 0,
                            pointHoverRadius: 5,
                            pointHoverBackgroundColor: colors.accent2,
                            pointHoverBorderColor: "#fff",
                            pointHoverBorderWidth: 2,
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: "index", intersect: false },
                    plugins: {
                        legend: {
                            position: "top",
                            align: "end",
                            labels: { color: colors.text, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: "circle" }
                        },
                        tooltip: {
                            backgroundColor: "rgba(15,19,34,0.95)",
                            titleColor: colors.text,
                            bodyColor: colors.text,
                            borderColor: hexA(colors.accent, .35),
                            borderWidth: 1,
                            padding: 10,
                            cornerRadius: 8,
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: hexA(colors.muted, .12), drawBorder: false },
                            ticks: { color: colors.muted, maxTicksLimit: 7 }
                        },
                        y: {
                            beginAtZero: true,
                            grid: { color: hexA(colors.muted, .12), drawBorder: false },
                            ticks: { color: colors.muted, precision: 0 }
                        }
                    }
                }
            });
            this.chartInstances.set("activity", chart);
        },

        renderDistributionChart(data) {
            const canvas = document.getElementById("mui-chart-distribution");
            const legendBox = document.getElementById("mui-donut-legend");
            if (!canvas || !this.ensureChart()) return;
            const total = data.distribution.reduce((a, b) => a + b.value, 0);
            if (total === 0) {
                this.renderEmpty(canvas, "Sem dados", "Adicione bookmarks, notas ou pastas para ver a distribuição.");
                if (legendBox) legendBox.innerHTML = "";
                return;
            }
            const colors = this.themeColors();
            const palette = [colors.accent, colors.accent2, colors.accent3, "#5d8cff"];
            const ctx = canvas.getContext("2d");

            const chart = new Chart(ctx, {
                type: "doughnut",
                data: {
                    labels: data.distribution.map(d => d.label),
                    datasets: [{
                        data: data.distribution.map(d => d.value),
                        backgroundColor: palette,
                        borderColor: "rgba(0,0,0,0)",
                        borderWidth: 0,
                        hoverOffset: 8,
                        spacing: 2,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: "68%",
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: "rgba(15,19,34,0.95)",
                            titleColor: colors.text,
                            bodyColor: colors.text,
                            borderColor: hexA(colors.accent, .35),
                            borderWidth: 1,
                            padding: 10,
                            cornerRadius: 8,
                        }
                    }
                },
                plugins: [{
                    id: "centerText",
                    beforeDraw(chart) {
                        const { width, height, ctx } = chart;
                        ctx.save();
                        const x = width / 2;
                        const y = height / 2;
                        ctx.fillStyle = colors.text;
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.font = "700 1.6rem Inter, sans-serif";
                        ctx.fillText(String(total), x, y - 4);
                        ctx.fillStyle = colors.muted;
                        ctx.font = "500 .72rem Inter, sans-serif";
                        ctx.fillText("itens no total", x, y + 16);
                        ctx.restore();
                    }
                }]
            });
            this.chartInstances.set("distribution", chart);

            if (legendBox) {
                legendBox.innerHTML = data.distribution.map((d, i) =>
                    `<span><i style="background:${palette[i % palette.length]}"></i>${escapeHtml(d.label)} · ${d.value}</span>`
                ).join("");
            }
        },

        renderEmpty(canvas, title, hint) {
            const wrap = canvas.parentElement;
            if (!wrap) return;
            wrap.innerHTML = `
                <div class="mui-chart-empty">
                    <div class="mui-emoji">📊</div>
                    <strong>${escapeHtml(title)}</strong>
                    <span style="font-size:.82rem">${escapeHtml(hint)}</span>
                </div>`;
        },

        /* ------------- Animated stat numbers ------------- */
        animateStatNumbers() {
            document.querySelectorAll(".stat-card .stat-number").forEach(el => {
                if (el.dataset.muiAnimated === "1") return;
                const target = parseInt((el.textContent || "0").replace(/[^\d-]/g, ""), 10);
                if (!Number.isFinite(target)) return;
                el.dataset.muiAnimated = "1";
                animateCount(el, 0, target, 900);
            });
        },

        /* ------------- Sparklines ------------- */
        addSparklines() {
            if (!this.ensureChart()) return;
            const data = this.collectDashboardData();
            if (!data) return;

            const cards = document.querySelectorAll(".dashboard .stats-grid .stat-card");
            const series = [
                data.linksSeries,
                data.notesSeries,
                sumSeries(data.linksSeries, data.notesSeries).map(v => Math.round(v / 2)),
                data.linksSeries.map((v, i) => Math.max(0, v - 1))
            ];
            cards.forEach((card, i) => {
                if (card.querySelector(".mui-spark")) return;
                const colorVar = getComputedStyle(card).getPropertyValue("--card-accent").trim() || "#7C4DFF";
                const canvas = document.createElement("canvas");
                canvas.className = "mui-spark";
                card.appendChild(canvas);
                try {
                    const ctx = canvas.getContext("2d");
                    const chart = new Chart(ctx, {
                        type: "line",
                        data: {
                            labels: data.labels,
                            datasets: [{
                                data: (series[i] || data.linksSeries),
                                borderColor: colorVar,
                                backgroundColor: (c) => this.gradient(c.chart.ctx, c.chart.chartArea, hexA(colorVar, .55), hexA(colorVar, 0)),
                                tension: 0.45,
                                fill: true,
                                borderWidth: 1.5,
                                pointRadius: 0,
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            animation: { duration: 700 },
                            plugins: { legend: { display: false }, tooltip: { enabled: false } },
                            scales: { x: { display: false }, y: { display: false, beginAtZero: true } }
                        }
                    });
                    this.chartInstances.set("spark-" + i, chart);
                } catch (_) {}
            });
        },

        /* ------------- Page-specific charts ------------- */

        _getPersonal() {
            try { return (typeof Storage !== "undefined" && Storage.getPersonalData) ? Storage.getPersonalData() : {}; }
            catch { return {}; }
        },

        _mountChartGrid(parent, anchor, layout, cardsHtml) {
            if (!parent) return null;
            let wrap = parent.querySelector(".mui-page-charts");
            if (!wrap) {
                wrap = document.createElement("div");
                wrap.className = "mui-page-charts " + (layout || "cols-2");
                wrap.innerHTML = cardsHtml;
                if (anchor && anchor.parentNode === parent) {
                    anchor.insertAdjacentElement("afterend", wrap);
                } else {
                    parent.appendChild(wrap);
                }
            } else {
                const cards = wrap.querySelectorAll(".mui-chart-card");
                cards.forEach(card => {
                    const canvasWrap = card.querySelector(".mui-chart-canvas-wrap");
                    if (canvasWrap) {
                        const id = card.dataset.chartId;
                        if (id) {
                            canvasWrap.innerHTML = `<canvas id="${id}"></canvas>`;
                        }
                    }
                });
            }
            return wrap;
        },

        _emptyChart(canvasId, title, hint) {
            const c = document.getElementById(canvasId);
            if (c) this.renderEmpty(c, title, hint);
        },

        _chartCardHtml(id, title, chip, badgeEmoji = "📊") {
            return `
                <div class="mui-chart-card" data-chart-id="${id}">
                    <div class="mui-chart-head">
                        <h3><span>${badgeEmoji}</span> ${escapeHtml(title)}</h3>
                        <span class="mui-chip">${escapeHtml(chip)}</span>
                    </div>
                    <div class="mui-chart-canvas-wrap">
                        <canvas id="${id}"></canvas>
                    </div>
                </div>`;
        },

        /* --- Personal home (page=personal): tendência hábitos 14d --- */
        injectPersonalHomeChart() {
            if (typeof App === "undefined" || App.currentPage !== "personal") return;
            const page = document.querySelector(".module-page.personal-page");
            if (!page) return;
            const anchor = page.querySelector(".module-stats");
            if (!this.ensureChart()) { setTimeout(() => this.injectPersonalHomeChart(), 250); return; }

            const personal = this._getPersonal();
            const habits = personal.habits || [];
            const logs = personal.habitLogs || {};
            const days = 14;
            const labels = [];
            const series = [];
            const today = new Date(); today.setHours(0,0,0,0);
            for (let i = days - 1; i >= 0; i--) {
                const d = new Date(today); d.setDate(today.getDate() - i);
                const key = d.toISOString().slice(0, 10);
                labels.push(d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }));
                const done = habits.reduce((acc, h) => acc + (logs[h.id]?.[key] ? 1 : 0), 0);
                series.push(done);
            }
            const total = series.reduce((a, b) => a + b, 0);
            this._mountChartGrid(page, anchor, "cols-1",
                this._chartCardHtml("mui-personal-trend", "Consistência dos hábitos (14 dias)", "Hábitos", "🌱")
            );
            if (!total || !habits.length) {
                this._emptyChart("mui-personal-trend", "Sem check-ins ainda", "Crie hábitos e marque check-ins para ver o gráfico.");
                return;
            }
            const colors = this.themeColors();
            const canvas = document.getElementById("mui-personal-trend");
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            const chart = new Chart(ctx, {
                type: "bar",
                data: {
                    labels,
                    datasets: [{
                        label: "Check-ins",
                        data: series,
                        backgroundColor: (c) => this.gradient(c.chart.ctx, c.chart.chartArea, hexA(colors.accent, .9), hexA(colors.accent2, .35)),
                        borderRadius: 8,
                        maxBarThickness: 28,
                    }]
                },
                options: this._barOpts(colors)
            });
            this.chartInstances.set("personal-trend", chart);
        },

        /* --- Habits page: bar weekly + donut por área --- */
        injectHabitsCharts() {
            if (typeof App === "undefined" || App.currentPage !== "habits") return;
            const page = document.querySelector(".module-page.personal-page");
            if (!page) return;
            const anchor = page.querySelector(".module-hero");
            if (!this.ensureChart()) { setTimeout(() => this.injectHabitsCharts(), 250); return; }
            const personal = this._getPersonal();
            const habits = personal.habits || [];
            const logs = personal.habitLogs || {};
            if (!habits.length) return;

            this._mountChartGrid(page, anchor, "cols-2",
                this._chartCardHtml("mui-habits-weekly", "Check-ins por dia da semana (últimas 4 semanas)", "Hábitos", "📆") +
                this._chartCardHtml("mui-habits-streak", "Streak atual por hábito", "Sequência", "🔥")
            );

            // weekly heatmap collapsed to weekday counts
            const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
            const counts = new Array(7).fill(0);
            const today = new Date(); today.setHours(0,0,0,0);
            for (let i = 0; i < 28; i++) {
                const d = new Date(today); d.setDate(today.getDate() - i);
                const key = d.toISOString().slice(0,10);
                const w = d.getDay();
                counts[w] += habits.reduce((acc, h) => acc + (logs[h.id]?.[key] ? 1 : 0), 0);
            }
            const colors = this.themeColors();
            const wctx = document.getElementById("mui-habits-weekly")?.getContext("2d");
            if (wctx) {
                const chart = new Chart(wctx, {
                    type: "bar",
                    data: {
                        labels: weekdays,
                        datasets: [{
                            label: "Check-ins",
                            data: counts,
                            backgroundColor: (c) => this.gradient(c.chart.ctx, c.chart.chartArea, hexA(colors.accent, .85), hexA(colors.accent2, .35)),
                            borderRadius: 8,
                            maxBarThickness: 36,
                        }]
                    },
                    options: this._barOpts(colors)
                });
                this.chartInstances.set("habits-weekly", chart);
            }

            // streak bars (top 8 by streak)
            const streaks = habits.map(h => {
                const log = logs[h.id] || {};
                let s = 0;
                for (let i = 0; i < 365; i++) {
                    const d = new Date(today); d.setDate(today.getDate() - i);
                    if (log[d.toISOString().slice(0,10)]) s++;
                    else break;
                }
                return { name: h.name || "—", streak: s, color: h.color || colors.accent };
            }).sort((a,b) => b.streak - a.streak).slice(0, 8);

            const sctx = document.getElementById("mui-habits-streak")?.getContext("2d");
            if (sctx) {
                if (!streaks.some(s => s.streak > 0)) {
                    this._emptyChart("mui-habits-streak", "Nenhum streak ainda", "Marque hábitos hoje para começar.");
                } else {
                    const chart = new Chart(sctx, {
                        type: "bar",
                        data: {
                            labels: streaks.map(s => s.name),
                            datasets: [{
                                label: "Dias seguidos",
                                data: streaks.map(s => s.streak),
                                backgroundColor: streaks.map(s => s.color),
                                borderRadius: 8,
                                maxBarThickness: 22,
                            }]
                        },
                        options: { ...this._barOpts(colors), indexAxis: "y" }
                    });
                    this.chartInstances.set("habits-streak", chart);
                }
            }
        },

        /* --- Goals page: donut por status + barras de progresso --- */
        injectGoalsChart() {
            if (typeof App === "undefined" || App.currentPage !== "goals") return;
            const page = document.querySelector(".module-page.personal-page");
            if (!page) return;
            const anchor = page.querySelector(".module-hero");
            if (!this.ensureChart()) { setTimeout(() => this.injectGoalsChart(), 250); return; }
            const goals = this._getPersonal().goals || [];
            if (!goals.length) return;

            this._mountChartGrid(page, anchor, "cols-2",
                this._chartCardHtml("mui-goals-status", "Metas por status", "Visão", "🎯") +
                this._chartCardHtml("mui-goals-progress", "Top 6 — progresso", "Progresso", "📈")
            );

            const colors = this.themeColors();
            const palette = [colors.accent, colors.accent2, colors.accent3, "#5d8cff", "#a855f7"];
            const buckets = {};
            goals.forEach(g => {
                const k = (g.status || "ativa").toString();
                buckets[k] = (buckets[k] || 0) + 1;
            });
            const labels = Object.keys(buckets);
            const data = labels.map(l => buckets[l]);

            const dctx = document.getElementById("mui-goals-status")?.getContext("2d");
            if (dctx) {
                const chart = new Chart(dctx, {
                    type: "doughnut",
                    data: { labels, datasets: [{ data, backgroundColor: palette, borderWidth: 0, hoverOffset: 8, spacing: 2 }] },
                    options: this._donutOpts(colors)
                });
                this.chartInstances.set("goals-status", chart);
            }

            const pctx = document.getElementById("mui-goals-progress")?.getContext("2d");
            if (pctx) {
                const top = [...goals].sort((a,b) => goalPct(b) - goalPct(a)).slice(0, 6);
                const chart = new Chart(pctx, {
                    type: "bar",
                    data: {
                        labels: top.map(g => g.title || "—"),
                        datasets: [{
                            label: "%",
                            data: top.map(g => goalPct(g)),
                            backgroundColor: (c) => this.gradient(c.chart.ctx, c.chart.chartArea, hexA(colors.accent, .9), hexA(colors.accent2, .5)),
                            borderRadius: 8,
                            maxBarThickness: 22,
                        }]
                    },
                    options: { ...this._barOpts(colors), indexAxis: "y", scales: { ...this._barOpts(colors).scales, x: { ...this._barOpts(colors).scales.x, max: 100 } } }
                });
                this.chartInstances.set("goals-progress", chart);
            }
        },

        /* --- Tracker page: donut by type + status --- */
        injectTrackerChart() {
            if (typeof App === "undefined" || App.currentPage !== "tracker") return;
            const page = document.querySelector(".module-page.personal-page.tracker-page") || document.querySelector(".module-page.personal-page");
            if (!page) return;
            const anchor = page.querySelector(".module-stats") || page.querySelector(".module-hero");
            if (!this.ensureChart()) { setTimeout(() => this.injectTrackerChart(), 250); return; }
            const items = this._getPersonal().tracker || [];
            if (!items.length) return;

            this._mountChartGrid(page, anchor, "cols-2",
                this._chartCardHtml("mui-tracker-type", "Obras por tipo", "Biblioteca", "📚") +
                this._chartCardHtml("mui-tracker-status", "Obras por status", "Andamento", "🧭")
            );

            const colors = this.themeColors();
            const palette = [colors.accent, colors.accent2, colors.accent3, "#5d8cff", "#a855f7", "#22d3ee", "#f59e0b"];

            const grouped = (key) => {
                const m = {};
                items.forEach(i => { const v = (i[key] || "outro").toString(); m[v] = (m[v] || 0) + 1; });
                return m;
            };
            const drawDonut = (canvasId, map) => {
                const ctx = document.getElementById(canvasId)?.getContext("2d");
                if (!ctx) return;
                const labels = Object.keys(map);
                const data = labels.map(l => map[l]);
                const chart = new Chart(ctx, {
                    type: "doughnut",
                    data: { labels, datasets: [{ data, backgroundColor: palette, borderWidth: 0, hoverOffset: 8, spacing: 2 }] },
                    options: this._donutOpts(colors)
                });
                this.chartInstances.set(canvasId, chart);
            };
            drawDonut("mui-tracker-type", grouped("type"));
            drawDonut("mui-tracker-status", grouped("status"));
        },

        /* --- Money page: trend de saldo (cumulativo) --- */
        injectMoneyChart() {
            if (typeof App === "undefined" || App.currentPage !== "money") return;
            const page = document.querySelector(".module-page.personal-page.money-page");
            if (!page) return;
            const anchor = page.querySelector(".module-stats");
            if (!this.ensureChart()) { setTimeout(() => this.injectMoneyChart(), 250); return; }
            const items = (this._getPersonal().money || []).slice();
            if (!items.length) return;

            this._mountChartGrid(page, anchor, "cols-1",
                this._chartCardHtml("mui-money-trend", "Evolução do saldo (90 dias)", "Fluxo", "💸")
            );
            const today = new Date(); today.setHours(0,0,0,0);
            const days = 90;
            const map = new Map();
            items.forEach(i => {
                const d = new Date(i.date || i.createdAt || Date.now()); d.setHours(0,0,0,0);
                const k = d.toISOString().slice(0,10);
                const sign = (i.type === "entrada") ? 1 : -1;
                map.set(k, (map.get(k) || 0) + sign * Number(i.amount || 0));
            });
            const labels = [];
            const series = [];
            let running = 0;
            for (let i = days - 1; i >= 0; i--) {
                const d = new Date(today); d.setDate(today.getDate() - i);
                const k = d.toISOString().slice(0,10);
                running += (map.get(k) || 0);
                labels.push(d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }));
                series.push(running);
            }
            const colors = this.themeColors();
            const ctx = document.getElementById("mui-money-trend")?.getContext("2d");
            if (!ctx) return;
            const chart = new Chart(ctx, {
                type: "line",
                data: {
                    labels,
                    datasets: [{
                        label: "Saldo acumulado",
                        data: series,
                        borderColor: colors.accent2,
                        backgroundColor: (c) => this.gradient(c.chart.ctx, c.chart.chartArea, hexA(colors.accent2, .35), hexA(colors.accent2, 0)),
                        tension: 0.35, fill: true, borderWidth: 2,
                        pointRadius: 0, pointHoverRadius: 5,
                        pointHoverBackgroundColor: colors.accent2, pointHoverBorderColor: "#fff",
                    }]
                },
                options: this._lineOpts(colors, true)
            });
            this.chartInstances.set("money-trend", chart);
        },

        /* --- Técnico OS: charts por módulo --- */
        injectTechChart() {
            if (typeof App === "undefined" || App.currentPage !== "tech") return;
            const page = document.querySelector(".module-page");
            if (!page) return;
            const anchor = page.querySelector(".module-stats");
            if (!this.ensureChart()) { setTimeout(() => this.injectTechChart(), 250); return; }
            let records = [];
            try { records = (typeof Storage !== "undefined" && Storage.getProfessionalRecords) ? Storage.getProfessionalRecords() : []; }
            catch { return; }
            if (!records.length) return;

            this._mountChartGrid(page, anchor, "cols-2",
                this._chartCardHtml("mui-tech-module", "Registros por módulo", "Distribuição", "🛠") +
                this._chartCardHtml("mui-tech-status", "Atendimentos por status", "OS", "🔧")
            );
            const colors = this.themeColors();
            const palette = [colors.accent, colors.accent2, colors.accent3, "#5d8cff", "#a855f7", "#22d3ee", "#f59e0b", "#ec4899"];

            const byModule = {};
            records.forEach(r => { const k = r.moduleKey || "outro"; byModule[k] = (byModule[k] || 0) + 1; });
            const mctx = document.getElementById("mui-tech-module")?.getContext("2d");
            if (mctx) {
                const chart = new Chart(mctx, {
                    type: "doughnut",
                    data: { labels: Object.keys(byModule), datasets: [{ data: Object.values(byModule), backgroundColor: palette, borderWidth: 0, hoverOffset: 8, spacing: 2 }] },
                    options: this._donutOpts(colors)
                });
                this.chartInstances.set("tech-module", chart);
            }

            const tickets = records.filter(r => r.moduleKey === "tickets");
            const byStatus = {};
            tickets.forEach(t => { const k = (t.status || "aberto").toString(); byStatus[k] = (byStatus[k] || 0) + 1; });
            const sctx = document.getElementById("mui-tech-status")?.getContext("2d");
            if (sctx) {
                if (!Object.keys(byStatus).length) {
                    this._emptyChart("mui-tech-status", "Sem atendimentos", "Crie OS para ver a distribuição.");
                } else {
                    const chart = new Chart(sctx, {
                        type: "bar",
                        data: {
                            labels: Object.keys(byStatus),
                            datasets: [{
                                label: "OS",
                                data: Object.values(byStatus),
                                backgroundColor: (c) => this.gradient(c.chart.ctx, c.chart.chartArea, hexA(colors.accent, .9), hexA(colors.accent2, .4)),
                                borderRadius: 8,
                                maxBarThickness: 30,
                            }]
                        },
                        options: this._barOpts(colors)
                    });
                    this.chartInstances.set("tech-status", chart);
                }
            }
        },

        /* shared options */
        _barOpts(colors) {
            return {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: "rgba(15,19,34,0.95)",
                        titleColor: colors.text, bodyColor: colors.text,
                        borderColor: hexA(colors.accent, .35), borderWidth: 1, padding: 10, cornerRadius: 8
                    }
                },
                scales: {
                    x: { grid: { color: hexA(colors.muted, .12), drawBorder: false }, ticks: { color: colors.muted, autoSkip: true, maxRotation: 0 } },
                    y: { beginAtZero: true, grid: { color: hexA(colors.muted, .12), drawBorder: false }, ticks: { color: colors.muted, precision: 0 } }
                }
            };
        },

        _donutOpts(colors) {
            return {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "62%",
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: { color: colors.text, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: "circle" }
                    },
                    tooltip: {
                        backgroundColor: "rgba(15,19,34,0.95)",
                        titleColor: colors.text, bodyColor: colors.text,
                        borderColor: hexA(colors.accent, .35), borderWidth: 1, padding: 10, cornerRadius: 8
                    }
                }
            };
        },

        _lineOpts(colors, withFill) {
            return {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: "rgba(15,19,34,0.95)",
                        titleColor: colors.text, bodyColor: colors.text,
                        borderColor: hexA(colors.accent, .35), borderWidth: 1, padding: 10, cornerRadius: 8
                    }
                },
                scales: {
                    x: { grid: { color: hexA(colors.muted, .12), drawBorder: false }, ticks: { color: colors.muted, maxTicksLimit: 8 } },
                    y: { grid: { color: hexA(colors.muted, .12), drawBorder: false }, ticks: { color: colors.muted } }
                }
            };
        },

        /* ------------- Animate progress bars on render ------- */
        animateProgressBars() {
            document.querySelectorAll(".tracker-progress > span, .goal-progress > span").forEach(span => {
                if (span.dataset.muiAnimated === "1") return;
                const target = span.style.width || "0%";
                span.dataset.muiAnimated = "1";
                span.style.width = "0%";
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    span.style.width = target;
                }));
            });
        },

        /* ------------- Back to top FAB ----------------------- */
        installBackToTop() {
            try {
                const main = document.querySelector(".app-main") || document.body;
                let fab = document.querySelector(".mui-fab");
                if (!fab) {
                    fab = document.createElement("button");
                    fab.className = "mui-fab";
                    fab.setAttribute("aria-label", "Voltar ao topo");
                    fab.innerHTML = "↑";
                    document.body.appendChild(fab);
                }
                const scrollTarget = () => {
                    // app-main is the scroll container, but inner pages scroll on their own
                    const innerScroller = document.querySelector(".dashboard, .module-page, .feature-page, .settings-page, .page-main");
                    return innerScroller && (innerScroller.scrollTop > 0 ? innerScroller : innerScroller.parentElement)
                        ? (innerScroller && innerScroller.scrollHeight > innerScroller.clientHeight ? innerScroller : window)
                        : window;
                };
                fab.addEventListener("click", () => {
                    const t = scrollTarget();
                    if (t === window) {
                        window.scrollTo({ top: 0, behavior: "smooth" });
                    } else {
                        t.scrollTo({ top: 0, behavior: "smooth" });
                    }
                });
                const checkVisibility = () => {
                    const scroller = document.querySelector(".dashboard, .module-page, .feature-page, .settings-page");
                    const y = (scroller && scroller.scrollHeight > scroller.clientHeight)
                        ? scroller.scrollTop
                        : (window.scrollY || document.documentElement.scrollTop || 0);
                    fab.classList.toggle("is-visible", y > 240);
                };
                window.addEventListener("scroll", checkVisibility, { passive: true });
                // also listen on the main app container's scroll events bubbling up
                document.addEventListener("scroll", checkVisibility, { capture: true, passive: true });
                this._fabCheck = checkVisibility;
                checkVisibility();
            } catch (e) { console.warn("[modern-ui] fab failed:", e); }
        },

        /* ------------- Ripple ------------- */
        installRipple() {
            document.addEventListener("click", (e) => {
                try {
                    const target = e.target.closest(".btn, .quick-action-btn, .module-card, .stat-card, .cockpit-card, .nav-item, .global-result, .category-chip, .tab-btn");
                    if (!target) return;

                    // Play click sound using Web Audio API!
                    if (typeof window.SoundEffects !== 'undefined') {
                        window.SoundEffects.playClick();
                    }

                    const rect = target.getBoundingClientRect();
                    const size = Math.max(rect.width, rect.height);
                    const ripple = document.createElement("span");
                    ripple.className = "mui-ripple";
                    ripple.style.width = ripple.style.height = size + "px";
                    ripple.style.left = (e.clientX - rect.left - size / 2) + "px";
                    ripple.style.top = (e.clientY - rect.top - size / 2) + "px";
                    target.appendChild(ripple);
                    setTimeout(() => ripple.remove(), 650);
                } catch (_) {}
            }, true);
        },

        /* ------------- Card shine on hover ------------- */
        installCardShine() {
            document.addEventListener("pointermove", (e) => {
                const card = e.target.closest(".stat-card");
                if (!card) return;
                const rect = card.getBoundingClientRect();
                const mx = ((e.clientX - rect.left) / rect.width) * 100;
                const my = ((e.clientY - rect.top) / rect.height) * 100;
                card.style.setProperty("--mx", mx + "%");
                card.style.setProperty("--my", my + "%");
            });
        }
    };

    /* ------------- helpers ------------- */
    function animateCount(el, from, to, duration) {
        const start = performance.now();
        const tick = (now) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            const value = Math.round(from + (to - from) * eased);
            el.textContent = String(value);
            if (t < 1) requestAnimationFrame(tick);
            else el.textContent = String(to);
        };
        requestAnimationFrame(tick);
    }

    function hexA(input, alpha) {
        // converts #RRGGBB or rgb()/rgba() into rgba()
        const s = String(input || "").trim();
        if (s.startsWith("rgb")) {
            const nums = s.replace(/rgba?\(|\)/g, "").split(",").map(v => parseFloat(v));
            const [r, g, b] = nums;
            return `rgba(${r|0},${g|0},${b|0},${alpha})`;
        }
        let hex = s.replace("#", "");
        if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        if ([r, g, b].some(n => Number.isNaN(n))) return `rgba(124,77,255,${alpha})`;
        return `rgba(${r},${g},${b},${alpha})`;
    }

    function goalPct(goal) {
        const cur = Number(goal.current || 0);
        const tgt = Math.max(1, Number(goal.target || 1));
        return Math.max(0, Math.min(100, Math.round((cur / tgt) * 100)));
    }

    function sumSeries(a, b) {
        const out = [];
        const len = Math.max(a.length, b.length);
        for (let i = 0; i < len; i++) out.push((a[i] || 0) + (b[i] || 0));
        return out;
    }

    function escapeHtml(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    /* ------------- boot ------------- */
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => MUI.init());
    } else {
        MUI.init();
    }

    // re-render charts when the user toggles theme (App.applyAppearance toggles body class)
    const themeObserver = new MutationObserver(() => {
        clearTimeout(MUI._themeTimer);
        MUI._themeTimer = setTimeout(() => MUI.applyEnhancements(), 60);
    });
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ["class", "style"] });

    // expose for debugging (non-essential)
    window.ModernUI = MUI;
})();

const SoundEffects = {
    _ctx: null,
    enabled: true,

    init() {
        try {
            const settings = JSON.parse(localStorage.getItem('booklist_settings') || '{}');
            this.enabled = settings.interfaceSounds !== false;
        } catch (_) {}
    },

    ctx() {
        if (!this._ctx) {
            this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this._ctx.state === 'suspended') {
            this._ctx.resume();
        }
        return this._ctx;
    },

    playClick() {
        if (!this.enabled) return;
        try {
            const c = this.ctx();
            const osc = c.createOscillator();
            const gain = c.createGain();

            osc.connect(gain);
            gain.connect(c.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(900, c.currentTime);
            osc.frequency.exponentialRampToValueAtTime(150, c.currentTime + 0.035);

            gain.gain.setValueAtTime(0.02, c.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.035);

            osc.start();
            osc.stop(c.currentTime + 0.035);
        } catch (_) {}
    },

    playComplete() {
        if (!this.enabled) return;
        try {
            const c = this.ctx();
            const now = c.currentTime;
            
            // Note 1 (C5)
            const osc1 = c.createOscillator();
            const gain1 = c.createGain();
            osc1.connect(gain1);
            gain1.connect(c.destination);
            osc1.type = 'triangle';
            osc1.frequency.setValueAtTime(523.25, now);
            gain1.gain.setValueAtTime(0.04, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            osc1.start(now);
            osc1.stop(now + 0.08);

            // Note 2 (E5, delayed)
            const osc2 = c.createOscillator();
            const gain2 = c.createGain();
            osc2.connect(gain2);
            gain2.connect(c.destination);
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(659.25, now + 0.06);
            gain2.gain.setValueAtTime(0.04, now + 0.06);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            osc2.start(now + 0.06);
            osc2.stop(now + 0.2);
        } catch (_) {}
    },

    playSync() {
        if (!this.enabled) return;
        try {
            const c = this.ctx();
            const now = c.currentTime;
            const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
            notes.forEach((freq, index) => {
                const osc = c.createOscillator();
                const gain = c.createGain();
                osc.connect(gain);
                gain.connect(c.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + (index * 0.06));
                gain.gain.setValueAtTime(0.025, now + (index * 0.06));
                gain.gain.exponentialRampToValueAtTime(0.001, now + (index * 0.06) + 0.22);
                osc.start(now + (index * 0.06));
                osc.stop(now + (index * 0.06) + 0.22);
            });
        } catch (_) {}
    },

    playAi() {
        if (!this.enabled) return;
        try {
            const c = this.ctx();
            const now = c.currentTime;
            
            const filter = c.createBiquadFilter();
            filter.type = 'peaking';
            filter.frequency.setValueAtTime(1200, now);
            filter.Q.setValueAtTime(4, now);
            filter.connect(c.destination);

            for (let i = 0; i < 6; i++) {
                const osc = c.createOscillator();
                const gain = c.createGain();
                osc.connect(gain);
                gain.connect(filter);
                osc.type = 'sine';
                
                const noteTime = now + (i * 0.04);
                const freq = 1000 + (i * 250);
                osc.frequency.setValueAtTime(freq, noteTime);
                
                gain.gain.setValueAtTime(0.015, noteTime);
                gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.12);
                
                osc.start(noteTime);
                osc.stop(noteTime + 0.12);
            }
        } catch (_) {}
    }
};

window.SoundEffects = SoundEffects;
