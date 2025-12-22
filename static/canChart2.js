// Multi Chart Widget (up to 4 parameters)
import { MAX_POINTS, hexToBytes } from './utils.js';
import { WidgetService } from './widgetService.js';

export const canChart2Widget = {
    initChart(widgetId, widget) {
        const safeId = widgetId.replace(/[^a-zA-Z0-9-]/g, '-');
        const canvasId = `chart-${safeId}`;
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Destroy old chart if exists
        if (widget.chart) {
            widget.chart.destroy();
        }

        // Initialize data structure
        if (!widget.data) {
            widget.data = {
                labels: [],
                datasets: {}
            };
            if (widget.config && widget.config.params) {
                widget.config.params.forEach((param, index) => {
                    widget.data.datasets[param.name] = [];
                });
            }
        }

        // Prepare datasets for Chart.js
        const datasets = this.prepareDatasets(widget);

        // Get Y axis limits
        const yAxisConfig = this.getYAxisConfig(widget);

        // Create chart
        widget.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: widget.data.labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 0 },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            boxWidth: 12,
                            padding: 10
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
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
                        ...yAxisConfig,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            callback: function(value) {
                                return parseFloat(value).toFixed(2);
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                elements: {
                    point: {
                        radius: 0,
                        hoverRadius: 4
                    }
                }
            }
        });
    },

    prepareDatasets(widget) {
        const datasets = [];

        if (widget.config && widget.config.params) {
            widget.config.params.forEach((param, index) => {
                datasets.push({
                    label: param.name,
                    data: widget.data.datasets[param.name] || [],
                    borderColor: param.color,
                    backgroundColor: this.hexToRgba(param.color, 0.1),
                    borderWidth: 2,
                    tension: 0.3,
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 4
                });
            });
        }

        return datasets;
    },

    getYAxisConfig(widget) {
        if (!widget.config) {
            return { beginAtZero: false };
        }

        // Check if auto scale is enabled
        if (widget.config.autoScale !== false) {
            return { beginAtZero: false };
        }

        // Use manual limits
        const min = widget.config.yMin !== undefined && widget.config.yMin !== ''
            ? parseFloat(widget.config.yMin)
            : undefined;

        const max = widget.config.yMax !== undefined && widget.config.yMax !== ''
            ? parseFloat(widget.config.yMax)
            : undefined;

        if (min !== undefined || max !== undefined) {
            return {
                beginAtZero: false,
                suggestedMin: min,
                suggestedMax: max
            };
        }

        return { beginAtZero: false };
    },

    processFrame(widgetId, frame, widget) {
        if (!widget.config || !widget.config.params || widget.config.params.length === 0) {
            return;
        }

        const data = hexToBytes(frame.data);
        const timestamp = new Date().toLocaleTimeString();
        const safeId = widgetId.replace(/[^a-zA-Z0-9-]/g, '-');

        // Initialize data structure if needed
        if (!widget.data) {
            widget.data = {
                labels: [],
                datasets: {}
            };
            widget.config.params.forEach(param => {
                widget.data.datasets[param.name] = [];
            });
        }

        // Add timestamp
        widget.data.labels.push(timestamp);

        // Process each parameter
        widget.config.params.forEach((param, paramIndex) => {
            // Check if this parameter listens to this CAN ID
            if (param.canId.toLowerCase() !== frame.id.toLowerCase()) {
                // This parameter doesn't listen to this CAN ID, add null value
                widget.data.datasets[param.name].push(null);
                return;
            }

            // Calculate value based on parameter configuration
            const value = this.calculateParamValue(param, data);

            // Add value to dataset
            widget.data.datasets[param.name].push(value);

            // Update last value display
            const lastValueElem = document.getElementById(`last-value-${safeId}-${paramIndex}`);
            if (lastValueElem) {
                const decimalPlaces = param.size === '32f' ? 4 :
                    param.size.includes('32') ? 0 :
                        param.size.includes('16') ? 0 : 0;
                lastValueElem.textContent = value.toFixed(decimalPlaces);
            }
        });

        // Limit data points
        if (widget.data.labels.length > MAX_POINTS) {
            widget.data.labels.shift();
            Object.keys(widget.data.datasets).forEach(key => {
                widget.data.datasets[key].shift();
            });
        }

        // Update chart if exists
        if (widget.chart) {
            // Update labels
            widget.chart.data.labels = widget.data.labels;

            // Update datasets
            widget.config.params.forEach((param, index) => {
                if (widget.chart.data.datasets[index]) {
                    widget.chart.data.datasets[index].data = widget.data.datasets[param.name];
                }
            });

            // Update Y axis if needed
            if (widget.config.autoScale === false &&
                (widget.config.yMin !== undefined || widget.config.yMax !== undefined)) {
                widget.chart.options.scales.y.suggestedMin = widget.config.yMin || undefined;
                widget.chart.options.scales.y.suggestedMax = widget.config.yMax || undefined;
            }

            widget.chart.update('none');
        }
    },

    calculateParamValue(param, canData) {
        const byteIndex = param.byteIndex;
        const size = param.size || '8';

        if (byteIndex >= canData.length) return 0;

        switch (size) {
            case '8': // 8-bit signed
                let value8 = canData[byteIndex];
                return value8 > 127 ? value8 - 256 : value8;

            case '8u': // 8-bit unsigned
                return canData[byteIndex];

            case '16': // 16-bit signed (big-endian)
                if (byteIndex + 1 >= canData.length) return 0;
                const val16 = (canData[byteIndex] << 8) | canData[byteIndex + 1];
                return val16 > 32767 ? val16 - 65536 : val16;

            case '16u': // 16-bit unsigned (big-endian)
                if (byteIndex + 1 >= canData.length) return 0;
                return (canData[byteIndex] << 8) | canData[byteIndex + 1];

            case '32': // 32-bit signed (big-endian)
                if (byteIndex + 3 >= canData.length) return 0;
                const val32 = (canData[byteIndex] << 24) |
                    (canData[byteIndex + 1] << 16) |
                    (canData[byteIndex + 2] << 8) |
                    canData[byteIndex + 3];
                return val32 > 2147483647 ? val32 - 4294967296 : val32;

            case '32u': // 32-bit unsigned (big-endian)
                if (byteIndex + 3 >= canData.length) return 0;
                return (canData[byteIndex] << 24) |
                    (canData[byteIndex + 1] << 16) |
                    (canData[byteIndex + 2] << 8) |
                    canData[byteIndex + 3];

            case '32f': // 32-bit float (big-endian)
                if (byteIndex + 3 >= canData.length) return 0;
                const buffer = new ArrayBuffer(4);
                const view = new DataView(buffer);
                view.setUint8(0, canData[byteIndex]);
                view.setUint8(1, canData[byteIndex + 1]);
                view.setUint8(2, canData[byteIndex + 2]);
                view.setUint8(3, canData[byteIndex + 3]);
                return parseFloat(view.getFloat32(0, false).toFixed(4));

            default:
                return 0;
        }
    },

    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    },

    render(widgetId, widget) {
        const safeId = widgetId.replace(/[^a-zA-Z0-9-]/g, '-');
        const widgetName = widget.config?.widgetName || widget.canId;
        const paramCount = widget.config?.params?.length || 0;
        const size = widget.size || 1;

        let paramsHtml = '';
        if (widget.config?.params) {
            widget.config.params.forEach((param, index) => {
                paramsHtml += `
                    <div class="param-stat">
                        <span class="param-name">${param.name}:</span>
                        <span class="param-value" id="last-value-${safeId}-${index}">0</span>
                    </div>
                `;
            });
        }

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
                ${paramsHtml}
            </div>
        `;
    },

    destroy(widgetId) {
        // Chart destruction is handled in the main module
        console.log(`Destroying multi chart widget: ${widgetId}`);
    }
};