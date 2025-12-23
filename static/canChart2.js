// Multi Chart Widget (up to 4 parameters)
import { MAX_POINTS, hexToBytes } from './utils.js';

export const canChart2Widget = {
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
                datasets: {}
            };
            if (widget.config && widget.config.params) {
                widget.config.params.forEach((param, index) => {
                    widget.data.datasets[param.name] = [];
                });
            }
        }

        const datasets = this.prepareDatasets(widget);
        const yAxisConfig = this.getYAxisConfig(widget);

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

        if (widget.config.autoScale !== false) {
            return { beginAtZero: false };
        }

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

        if (!widget.data) {
            widget.data = {
                labels: [],
                datasets: {}
            };
            widget.config.params.forEach(param => {
                widget.data.datasets[param.name] = [];
            });
        }

        widget.data.labels.push(timestamp);

        widget.config.params.forEach((param, paramIndex) => {
            const passesFilter = this.checkParamFilters(param, frame);

            if (!passesFilter) {
                widget.data.datasets[param.name].push(null);
                return;
            }

            const value = this.calculateParamValue(param, data);
            widget.data.datasets[param.name].push(value);

            const lastValueElem = document.getElementById(`last-value-${safeId}-${paramIndex}`);
            if (lastValueElem) {
                const decimalPlaces = param.size === '32f' ? 4 :
                    param.size.includes('32') ? 0 :
                        param.size.includes('16') ? 0 : 0;
                lastValueElem.textContent = value.toFixed(decimalPlaces);
            }
        });

        if (widget.data.labels.length > MAX_POINTS) {
            widget.data.labels.shift();
            Object.keys(widget.data.datasets).forEach(key => {
                widget.data.datasets[key].shift();
            });
        }

        if (widget.chart) {
            widget.chart.data.labels = widget.data.labels;

            widget.config.params.forEach((param, index) => {
                if (widget.chart.data.datasets[index]) {
                    widget.chart.data.datasets[index].data = widget.data.datasets[param.name];
                }
            });

            if (widget.config.autoScale === false &&
                (widget.config.yMin !== undefined || widget.config.yMax !== undefined)) {
                widget.chart.options.scales.y.suggestedMin = widget.config.yMin || undefined;
                widget.chart.options.scales.y.suggestedMax = widget.config.yMax || undefined;
            }

            widget.chart.update('none');
        }
    },

    checkParamFilters(param, frame) {
        // Проверка CAN ID
        if (param.canId.toLowerCase() !== frame.id.toLowerCase()) {
            return false;
        }

        const data = this.hexToBytes(frame.data);

        // Проверка байта 0 (если указан фильтр)
        if (param.byte0Filter && param.byte0Filter.trim() !== '') {
            const filterValue = parseInt(param.byte0Filter, 16);
            if (data.length === 0 || data[0] !== filterValue) {
                return false;
            }
        }

        // Проверка байта 1 (если указан фильтр)
        if (param.byte1Filter && param.byte1Filter.trim() !== '') {
            const filterValue = parseInt(param.byte1Filter, 16);
            if (data.length < 2 || data[1] !== filterValue) {
                return false;
            }
        }

        return true;
    },

    hexToBytes(hex) {
        const bytes = [];
        for (let i = 0; i < hex.length; i += 2) {
            bytes.push(parseInt(hex.substr(i, 2), 16));
        }
        return bytes;
    },

    calculateParamValue(param, canData) {
        const byteIndex = param.byteIndex;
        const size = param.size || '8';
        const multiplier = param.multiplier || 1;
        const adder = param.adder || 0;

        if (byteIndex >= canData.length) return 0;

        let rawValue;

        switch (size) {
            case '8': // 8-bit signed
                let value8 = canData[byteIndex];
                rawValue = value8 > 127 ? value8 - 256 : value8;
                break;

            case '8u': // 8-bit unsigned
                rawValue = canData[byteIndex];
                break;

            case '16': // 16-bit signed (big-endian)
                if (byteIndex + 1 >= canData.length) return 0;
                const val16 = (canData[byteIndex] << 8) | canData[byteIndex + 1];
                rawValue = val16 > 32767 ? val16 - 65536 : val16;
                break;

            case '16u': // 16-bit unsigned (big-endian)
                if (byteIndex + 1 >= canData.length) return 0;
                rawValue = (canData[byteIndex] << 8) | canData[byteIndex + 1];
                break;

            case '32': // 32-bit signed (big-endian)
                if (byteIndex + 3 >= canData.length) return 0;
                const val32 = (canData[byteIndex] << 24) |
                    (canData[byteIndex + 1] << 16) |
                    (canData[byteIndex + 2] << 8) |
                    canData[byteIndex + 3];
                rawValue = val32 > 2147483647 ? val32 - 4294967296 : val32;
                break;

            case '32u': // 32-bit unsigned (big-endian)
                if (byteIndex + 3 >= canData.length) return 0;
                rawValue = (canData[byteIndex] << 24) |
                    (canData[byteIndex + 1] << 16) |
                    (canData[byteIndex + 2] << 8) |
                    canData[byteIndex + 3];
                break;

            case '32f': // 32-bit float (big-endian)
                if (byteIndex + 3 >= canData.length) return 0;
                const buffer = new ArrayBuffer(4);
                const view = new DataView(buffer);
                view.setUint8(0, canData[byteIndex]);
                view.setUint8(1, canData[byteIndex + 1]);
                view.setUint8(2, canData[byteIndex + 2]);
                view.setUint8(3, canData[byteIndex + 3]);
                rawValue = parseFloat(view.getFloat32(0, false).toFixed(4));
                break;

            default:
                rawValue = 0;
        }

        const result = (rawValue * multiplier) + adder;

        if (size === '32f') {
            return parseFloat(result.toFixed(4));
        }
        if (size.includes('32') || size.includes('16')) {
            return Math.round(result);
        }
        return result;
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
        console.log(`Destroying multi chart widget: ${widgetId}`);
    }
};
