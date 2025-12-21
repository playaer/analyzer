// Dual Chart Widget
import { MAX_POINTS, hexToBytes, parseByteConfig, calculateValue } from './utils.js';

export const canChart2Widget = {
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
                datasets: [
                    {
                        label: widget.config?.label1 || 'Value 1',
                        data: widget.data?.values1 || [],
                        borderColor: widget.config?.color1 || '#ff6384',
                        backgroundColor: 'rgba(255, 99, 132, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: false,
                        pointRadius: 0
                    },
                    {
                        label: widget.config?.label2 || 'Value 2',
                        data: widget.data?.values2 || [],
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

        widget.data = widget.data || {
            labels: [],
            values1: [],
            values2: []
        };
    },

    processFrame(widgetId, frame, widget) {
        const data = hexToBytes(frame.data);
        const timestamp = new Date().toLocaleTimeString();

        if (!widget.config?.dataSource1 || !widget.config?.dataSource2) return;

        const parsedConfig1 = parseByteConfig(widget.config.dataSource1);
        const parsedConfig2 = parseByteConfig(widget.config.dataSource2);

        if (!parsedConfig1 || !parsedConfig2) return;

        const value1 = calculateValue(parsedConfig1, data);
        const value2 = calculateValue(parsedConfig2, data);

        // Update widget data
        widget.data.labels.push(timestamp);
        widget.data.values1.push(value1);
        widget.data.values2.push(value2);

        // Limit to MAX_POINTS
        if (widget.data.labels.length > MAX_POINTS) {
            widget.data.labels.shift();
            widget.data.values1.shift();
            widget.data.values2.shift();
        }

        // Update last values display
        const lastValue1Elem = document.getElementById(`last-value1-${widgetId}`);
        const lastValue2Elem = document.getElementById(`last-value2-${widgetId}`);

        if (lastValue1Elem) {
            lastValue1Elem.textContent = value1.toFixed(parsedConfig1.decimalPlaces);
        }
        if (lastValue2Elem) {
            lastValue2Elem.textContent = value2.toFixed(parsedConfig2.decimalPlaces);
        }

        // Update chart
        if (widget.chart) {
            widget.chart.data.labels = widget.data.labels;
            widget.chart.data.datasets[0].data = widget.data.values1;
            widget.chart.data.datasets[1].data = widget.data.values2;
            widget.chart.update('none');
        }
    },

    getConfigFromModal() {
        const inputs = document.querySelectorAll('#dualChartConfig .byte-input input');
        return {
            dataSource1: inputs[0]?.value || '',
            dataSource2: inputs[1]?.value || '',
            color1: document.getElementById('dualChartColor1').value,
            color2: document.getElementById('dualChartColor2').value,
            label1: 'Value 1',
            label2: 'Value 2'
        };
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
                <span>Frames: <span id="frame-count-${safeId}">${widget.frameCount}</span></span>
                <span>Value 1: <span id="last-value1-${safeId}">0</span></span>
                <span>Value 2: <span id="last-value2-${safeId}">0</span></span>
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