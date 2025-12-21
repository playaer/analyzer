// Dual Chart Widget
import { MAX_POINTS, hexToBytes, parseByteConfig, calculateValue } from './utils.js';

export const canChart2Widget = {
    initChart(widgetId, widget) {
        const safeId = widgetId.replace(/[^a-zA-Z0-9-]/g, '-');
        const canvasId = `chart-${safeId}`;
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Уничтожаем старый график, если есть
        if (widget.chart) {
            widget.chart.destroy();
        }

        // Инициализируем данные, если их нет
        if (!widget.data) {
            widget.data = {
                labels: [],
                values1: [],
                values2: []
            };
        }

        // Создаем новый график
        widget.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: widget.data.labels,
                datasets: [
                    {
                        label: widget.config?.label1 || 'Value 1',
                        data: widget.data.values1,
                        borderColor: widget.config?.color1 || '#ff6384',
                        backgroundColor: 'rgba(255, 99, 132, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: false,
                        pointRadius: 0
                    },
                    {
                        label: widget.config?.label2 || 'Value 2',
                        data: widget.data.values2,
                        borderColor: widget.config?.color2 || '#36a2eb',
                        backgroundColor: 'rgba(54, 162, 235, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: false,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 0 },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    x: {
                        display: false,
                        ticks: {
                            maxTicksLimit: 10
                        }
                    },
                    y: {
                        display: true,
                        beginAtZero: false,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    },

    processFrame(widgetId, frame, widget) {
        if (!widget.config?.dataSource1 || !widget.config?.dataSource2) {
            console.warn('Widget config missing data sources');
            return;
        }

        const data = hexToBytes(frame.data);
        const timestamp = new Date().toLocaleTimeString();

        const parsedConfig1 = parseByteConfig(widget.config.dataSource1);
        const parsedConfig2 = parseByteConfig(widget.config.dataSource2);

        if (!parsedConfig1 || !parsedConfig2) {
            console.warn('Failed to parse byte configs');
            return;
        }

        const value1 = calculateValue(parsedConfig1, data);
        const value2 = calculateValue(parsedConfig2, data);

        // Инициализируем данные, если их нет
        if (!widget.data) {
            widget.data = {
                labels: [],
                values1: [],
                values2: []
            };
        }

        // Добавляем новые точки
        widget.data.labels.push(timestamp);
        widget.data.values1.push(value1);
        widget.data.values2.push(value2);

        // Ограничиваем количество точек
        if (widget.data.labels.length > MAX_POINTS) {
            widget.data.labels.shift();
            widget.data.values1.shift();
            widget.data.values2.shift();
        }

        // Обновляем отображение последних значений
        const safeId = widgetId.replace(/[^a-zA-Z0-9-]/g, '-');
        const lastValue1Elem = document.getElementById(`last-value1-${safeId}`);
        const lastValue2Elem = document.getElementById(`last-value2-${safeId}`);

        if (lastValue1Elem) {
            lastValue1Elem.textContent = value1.toFixed(parsedConfig1.decimalPlaces || 2);
        }
        if (lastValue2Elem) {
            lastValue2Elem.textContent = value2.toFixed(parsedConfig2.decimalPlaces || 2);
        }

        // Обновляем график, если он существует
        if (widget.chart) {
            widget.chart.data.labels = widget.data.labels;
            widget.chart.data.datasets[0].data = widget.data.values1;
            widget.chart.data.datasets[1].data = widget.data.values2;
            widget.chart.update('none');
        }
    },

    render(widgetId, widget) {
        const safeId = widgetId.replace(/[^a-zA-Z0-9-]/g, '-');
        return `
            <div class="widget-header">
                <div class="widget-title">${widget.canId} - Dual Chart</div>
                <div class="widget-actions">
                    <button class="widget-btn edit">Edit</button>
                    <button class="widget-btn remove">Remove</button>
                </div>
            </div>
            <div class="widget-content">
                <canvas id="chart-${safeId}" class="widget-chart"></canvas>
            </div>
            <div class="widget-stats">
                <span>Frames: <span id="frame-count-${safeId}">${widget.frameCount || 0}</span></span>
                <span>Value 1: <span id="last-value1-${safeId}">0</span></span>
                <span>Value 2: <span id="last-value2-${safeId}">0</span></span>
            </div>
        `;
    },

    destroy(widgetId) {
        // Уничтожение графика обрабатывается в основном модуле
        console.log(`Destroying dual chart widget: ${widgetId}`);
    }
};