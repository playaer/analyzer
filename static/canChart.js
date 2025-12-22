// Single Chart Widget
import { MAX_POINTS, hexToBytes } from './utils.js';

export const canChartWidget = {
    initChart(widgetId, widget) {
        const safeId = widgetId.replace(/[^a-zA-Z0-9-]/g, '-');
        const canvasId = `chart-${safeId}`;
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        if (widget.chart) {
            widget.chart.destroy();
        }

        if (!widget.data) {
            widget.data = {
                labels: [],
                values: []
            };
        }

        widget.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: widget.data.labels,
                datasets: [{
                    label: widget.config?.label || 'Value',
                    data: widget.data.values,
                    borderColor: widget.config?.color || '#ff6384',
                    backgroundColor: 'rgba(255, 99, 132, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: false,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 0 },
                plugins: { legend: { display: true } },
                scales: {
                    x: { display: false },
                    y: {
                        display: true,
                        beginAtZero: false,
                        grid: { color: 'rgba(0, 0, 0, 0.1)' }
                    }
                }
            }
        });
    },

    processFrame(widgetId, frame, widget) {
        if (widget.canId !== frame.id.toLowerCase()) {
            return;
        }

        if (!widget.config) {
            console.warn('Widget config missing');
            return;
        }

        const data = hexToBytes(frame.data);
        const timestamp = new Date().toLocaleTimeString();
        const safeId = widgetId.replace(/[^a-zA-Z0-9-]/g, '-');

        if (!widget.data) {
            widget.data = {
                labels: [],
                values: []
            };
        }

        // Calculate value (упрощенная версия)
        const byteIndex = widget.config.byteIndex || 0;
        let value = 0;

        if (byteIndex < data.length) {
            value = data[byteIndex];
            if (widget.config.size === '8') {
                value = value > 127 ? value - 256 : value;
            }
        }

        // Add data point
        widget.data.labels.push(timestamp);
        widget.data.values.push(value);

        // Limit points
        if (widget.data.labels.length > MAX_POINTS) {
            widget.data.labels.shift();
            widget.data.values.shift();
        }

        // Update display
        const lastValueElem = document.getElementById(`last-value-${safeId}`);
        if (lastValueElem) {
            lastValueElem.textContent = value.toFixed(2);
        }

        // Update chart
        if (widget.chart) {
            widget.chart.data.labels = widget.data.labels;
            widget.chart.data.datasets[0].data = widget.data.values;
            widget.chart.update('none');
        }
    },

    render(widgetId, widget) {
        const safeId = widgetId.replace(/[^a-zA-Z0-9-]/g, '-');
        const widgetName = widget.config?.widgetName || widget.canId;
        const size = widget.size || 1;

        return `
            <div class="widget-header">
                <div class="widget-title">${widgetName} 
                    <span class="widget-size-badge">${size}×</span>
                </div>
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
                <span>Last: <span id="last-value-${safeId}">0</span></span>
            </div>
        `;
    },

    destroy(widgetId) {
        console.log(`Destroying single chart widget: ${widgetId}`);
    }
};