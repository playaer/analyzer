// Single Chart Widget
import { MAX_POINTS, hexToBytes, parseByteConfig, calculateValue } from './utils.js';

export const canChartWidget = {
    initChart(widgetId, widget) {
        const canvasId = `chart-${widgetId.replace(/[^a-zA-Z0-9-]/g, '-')}`;
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        if (widget.chart) {
            widget.chart.destroy();
        }

        widget.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: widget.data?.labels || [],
                datasets: [{
                    label: widget.config?.label || 'Value',
                    data: widget.data?.values || [],
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

        widget.data = widget.data || { labels: [], values: [] };
    },

    processFrame(widgetId, frame, widget) {
        const data = hexToBytes(frame.data);
        const timestamp = new Date().toLocaleTimeString();

        if (!widget.config?.dataSource) return;

        const parsedConfig = parseByteConfig(widget.config.dataSource);
        if (!parsedConfig) return;

        const value = calculateValue(parsedConfig, data);

        // Update widget data
        widget.data.labels.push(timestamp);
        widget.data.values.push(value);

        // Limit to MAX_POINTS
        if (widget.data.labels.length > MAX_POINTS) {
            widget.data.labels.shift();
            widget.data.values.shift();
        }

        // Update last value display
        const lastValueElem = document.getElementById(`last-value-${widgetId}`);
        if (lastValueElem) {
            lastValueElem.textContent = value.toFixed(parsedConfig.decimalPlaces);
        }

        // Update chart
        if (widget.chart) {
            widget.chart.data.labels = widget.data.labels;
            widget.chart.data.datasets[0].data = widget.data.values;
            widget.chart.update('none');
        }
    },

    getConfigFromModal() {
        return {
            dataSource: document.querySelector('#singleChartConfig input').value,
            color: document.getElementById('singleChartColor').value,
            label: 'Value'
        };
    },

    render(widgetId, widget) {
        const safeId = widgetId.replace(/[^a-zA-Z0-9-]/g, '-');
        return `
            <div class="widget-header">
                <div class="widget-title">${widget.canId} - Single Chart</div>
                <div class="widget-actions">
                    <button class="widget-btn edit">Edit</button>
                    <button class="widget-btn remove">Remove</button>
                </div>
            </div>
            <div class="widget-content">
                <canvas id="chart-${safeId}" class="widget-chart"></canvas>
            </div>
            <div class="widget-stats">
                <span>Frames: <span id="frame-count-${safeId}">${widget.frameCount}</span></span>
                <span>Last: <span id="last-value-${safeId}">0</span></span>
            </div>
        `;
    },

    destroy(widgetId) {
        const widget = widgets.get(widgetId);
        if (widget && widget.chart) {
            widget.chart.destroy();
        }
    }
};