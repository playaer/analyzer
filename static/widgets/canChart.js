// Widget for displaying CAN ID data charts
import { chartColors, MAX_POINTS } from '../utils.js';

export class CanChartWidget {
    constructor(config) {
        this.id = config.id || `widget-${Date.now()}`;
        this.canId = config.canId;
        this.byteConfigs = config.byteConfigs || Array(8).fill('');
        this.enabled = config.enabled !== false;
        this.chartData = {};
        this.frameCount = 0;
        this.element = null;
        this.onRemove = null;

        // Initialize chart data structure
        this.updateChartDataStructure();
    }

    render() {
        const widgetElement = document.createElement('div');
        widgetElement.className = 'widget';
        widgetElement.id = this.id;

        widgetElement.innerHTML = `
            <div class="widget-header">
                <div>
                    <strong>${this.canId}</strong>
                    <span class="data-points" style="margin-left: 10px;">
                        Frames: <span id="frame-count-${this.canId}">${this.frameCount}</span>
                    </span>
                </div>
                <div class="controls-row">
                    <button class="toggle-btn" data-widgetid="${this.id}">
                        ${this.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button class="remove-btn" data-widgetid="${this.id}">Remove</button>
                </div>
            </div>
            <div class="widget-charts">
                ${this.renderCharts()}
            </div>
        `;

        this.element = widgetElement;
        this.initCharts();
        this.attachEventListeners();
        return widgetElement;
    }

    renderCharts() {
        if (Object.keys(this.chartData).length === 0) {
            return '<div class="no-data">No charts configured. Configure byte inputs in settings.</div>';
        }

        let chartsHTML = '';
        for (const [key, data] of Object.entries(this.chartData)) {
            chartsHTML += `
                <div class="chart-container mini-chart-container">
                    <div class="chart-header">
                        <h4>${this.getChartTitle(key, data.type)}</h4>
                        <div class="chart-stats">
                            <span>Points: ${data.data.length}</span>
                            <span id="last-value-${this.id}-${key}">0</span>
                        </div>
                    </div>
                    <canvas id="chart-${this.id}-${key}"></canvas>
                </div>
            `;
        }
        return chartsHTML;
    }

    initCharts() {
        for (const [key, data] of Object.entries(this.chartData)) {
            const canvasId = `chart-${this.id}-${key}`;
            const canvas = this.element.querySelector(`#${canvasId}`);
            if (!canvas) continue;

            const ctx = canvas.getContext('2d');
            if (data.chart) {
                data.chart.destroy();
            }

            data.chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.labels,
                    datasets: [{
                        label: key,
                        data: data.data,
                        borderColor: chartColors[Object.keys(this.chartData).indexOf(key) % chartColors.length],
                        backgroundColor: 'rgba(0, 0, 0, 0.1)',
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
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { display: false },
                        y: {
                            display: true,
                            beginAtZero: false,
                            grid: { color: 'rgba(0, 0, 0, 0.1)' }
                        }
                    },
                    interaction: { intersect: false, mode: 'index' }
                }
            });
        }
    }

    attachEventListeners() {
        const toggleBtn = this.element.querySelector('.toggle-btn');
        const removeBtn = this.element.querySelector('.remove-btn');

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggle());
        }
        if (removeBtn) {
            removeBtn.addEventListener('click', () => this.remove());
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        const toggleBtn = this.element.querySelector('.toggle-btn');
        if (toggleBtn) {
            toggleBtn.textContent = this.enabled ? 'Disable' : 'Enable';
        }
    }

    remove() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }

        // Destroy all charts
        for (const key in this.chartData) {
            if (this.chartData[key].chart) {
                this.chartData[key].chart.destroy();
            }
        }

        // Notify parent
        if (this.onRemove) {
            this.onRemove(this.id);
        }
    }

    processFrame(data, timestamp) {
        if (!this.enabled) return;

        this.frameCount++;
        const frameCountElem = this.element.querySelector(`#frame-count-${this.canId}`);
        if (frameCountElem) {
            frameCountElem.textContent = this.frameCount;
        }

        // Process byte configurations
        for (let i = 0; i < this.byteConfigs.length; i++) {
            const config = this.byteConfigs[i];
            if (!config || data.length <= i) continue;

            const parsedConfig = this.parseByteConfig(config);
            if (!parsedConfig) continue;

            const value = this.calculateValue(parsedConfig, data);
            this.updateChartData(parsedConfig.key, value, timestamp, parsedConfig);
        }
    }

    parseByteConfig(config) {
        const singleBytePattern = /^(\d+)$/;
        const signedWordPattern = /^(\d+)-(\d+)$/;
        const unsignedWordPattern = /^(\d+)-(\d+)\(U\)$/i;
        const floatPattern = /^(\d+)-(\d+)\(F(?:,(\d+))?\)$/i;

        let match;

        if ((match = config.match(singleBytePattern))) {
            const byteIndex = parseInt(match[1]);
            if (byteIndex >= 0 && byteIndex <= 7) {
                return {
                    type: 'byte',
                    key: `byte${byteIndex}`,
                    byteIndex: byteIndex,
                    signed: true,
                    decimalPlaces: 0
                };
            }
        } else if ((match = config.match(signedWordPattern))) {
            const start = parseInt(match[1]);
            const end = parseInt(match[2]);
            if (start >= 0 && end <= 7 && end - start === 1) {
                return {
                    type: 'word',
                    key: `word${start}-${end}(S)`,
                    startByte: Math.min(start, end),
                    endByte: Math.max(start, end),
                    signed: true,
                    decimalPlaces: 0
                };
            }
        } else if ((match = config.match(unsignedWordPattern))) {
            const start = parseInt(match[1]);
            const end = parseInt(match[2]);
            if (start >= 0 && end <= 7 && end - start === 1) {
                return {
                    type: 'word',
                    key: `word${start}-${end}(U)`,
                    startByte: Math.min(start, end),
                    endByte: Math.max(start, end),
                    signed: false,
                    decimalPlaces: 0
                };
            }
        } else if ((match = config.match(floatPattern))) {
            const start = parseInt(match[1]);
            const end = parseInt(match[2]);
            const decimals = match[3] ? parseInt(match[3]) : 2;
            if (start >= 0 && end <= 7 && end - start === 3) {
                return {
                    type: 'float',
                    key: `float${start}-${end}`,
                    startByte: Math.min(start, end),
                    endByte: Math.max(start, end),
                    signed: true,
                    decimalPlaces: decimals
                };
            }
        }
        return null;
    }

    calculateValue(parsedConfig, data) {
        let value = 0;

        switch (parsedConfig.type) {
            case 'byte':
                if (data.length > parsedConfig.byteIndex) {
                    value = data[parsedConfig.byteIndex];
                    if (parsedConfig.signed && value > 127) {
                        value = value - 256;
                    }
                }
                break;
            case 'word':
                if (data.length > parsedConfig.endByte) {
                    const highByte = data[parsedConfig.startByte];
                    const lowByte = data[parsedConfig.endByte];
                    value = (highByte << 8) | lowByte;

                    if (parsedConfig.signed && value > 32767) {
                        value = value - 65536;
                    }
                }
                break;
            case 'float':
                if (data.length > parsedConfig.endByte) {
                    const buffer = new ArrayBuffer(4);
                    const view = new DataView(buffer);
                    view.setUint8(0, data[parsedConfig.startByte]);
                    view.setUint8(1, data[parsedConfig.startByte + 1]);
                    view.setUint8(2, data[parsedConfig.startByte + 2]);
                    view.setUint8(3, data[parsedConfig.startByte + 3]);
                    value = view.getFloat32(0, false);
                    value = parseFloat(value.toFixed(parsedConfig.decimalPlaces));
                }
                break;
        }
        return value;
    }

    updateChartData(key, value, timestamp, config) {
        if (!this.chartData[key]) {
            this.chartData[key] = {
                labels: [],
                data: [],
                chart: null,
                type: config.type
            };
        }

        const chart = this.chartData[key];
        chart.labels.push(timestamp);
        chart.data.push(value);

        if (chart.labels.length > MAX_POINTS) {
            chart.labels.shift();
            chart.data.shift();
        }

        const lastValueElem = this.element.querySelector(`#last-value-${this.id}-${key}`);
        if (lastValueElem) {
            lastValueElem.textContent = value.toFixed(config.decimalPlaces);
        }

        if (chart.chart) {
            chart.chart.data.labels = chart.labels;
            chart.chart.data.datasets[0].data = chart.data;
            chart.chart.update('none');
        }
    }

    updateChartDataStructure() {
        const chartKeys = new Set();

        for (let i = 0; i < this.byteConfigs.length; i++) {
            const config = this.byteConfigs[i];
            if (!config) continue;

            const parsed = this.parseByteConfig(config);
            if (parsed) {
                chartKeys.add(parsed.key);
            }
        }

        for (const key of chartKeys) {
            if (!this.chartData[key]) {
                this.chartData[key] = {
                    labels: [],
                    data: [],
                    chart: null,
                    type: 'byte'
                };
            }
        }

        for (const key in this.chartData) {
            if (!chartKeys.has(key)) {
                if (this.chartData[key].chart) {
                    this.chartData[key].chart.destroy();
                }
                delete this.chartData[key];
            }
        }
    }

    getChartTitle(key, type) {
        switch (type) {
            case 'byte':
                const byteNum = key.replace('byte', '');
                return `Byte ${byteNum}`;
            case 'word':
                if (key.includes('(U)')) {
                    const bytes = key.replace('word', '').replace('(U)', '');
                    return `Bytes ${bytes} (Unsigned)`;
                } else {
                    const bytes = key.replace('word', '').replace('(S)', '');
                    return `Bytes ${bytes} (Signed)`;
                }
            case 'float':
                const floatBytes = key.replace('float', '');
                return `Bytes ${floatBytes} (Float)`;
            default:
                return key;
        }
    }
}

// Экспортируем класс
// export { CanChartWidget };