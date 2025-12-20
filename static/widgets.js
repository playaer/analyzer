// Widgets module for CAN ID blocks and charts
import { chartColors, MAX_POINTS, hexToBytes } from './utils.js';

export let canIdBlocks = new Map();

// Initialize widgets module
export function initWidgets() {
    // Additional initialization if needed
}

// Render CAN ID blocks
export function renderCanIdBlocks() {
    const container = document.getElementById('canIdBlocks');
    container.innerHTML = '';

    canIdBlocks.forEach((block, canId) => {
        const blockElement = document.createElement('div');
        blockElement.className = 'can-id-block';
        blockElement.id = `block-${canId}`;

        let byteInputs = '';
        for (let i = 0; i < 8; i++) {
            byteInputs += `
                <div class="byte-input">
                    <label>Byte ${i}</label>
                    <input type="text" 
                           value="${block.byteConfigs[i] || ''}" 
                           placeholder="0, 0-1, 0-1(U), 0-3(F,2)"
                           data-canid="${canId}"
                           data-byteindex="${i}">
                </div>
            `;
        }

        blockElement.innerHTML = `
            <div class="can-id-header">
                <div>
                    <span style="font-weight: bold; font-size: 1.2em;">${canId}</span>
                    <span class="data-points" style="margin-left: 10px;">
                        Frames: <span id="frame-count-${canId}">${block.frameCount}</span>
                    </span>
                </div>
                <div class="controls-row">
                    <button class="toggle-btn" data-canid="${canId}">
                        ${block.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button class="remove-btn" data-canid="${canId}">Remove</button>
                </div>
            </div>
            
            <div class="byte-inputs">
                ${byteInputs}
            </div>
            
            <div class="chart-grid">
                ${renderChartsForBlock(block)}
            </div>
        `;

        container.appendChild(blockElement);

        // Add event listeners
        const inputs = blockElement.querySelectorAll('.byte-input input');
        inputs.forEach(input => {
            input.addEventListener('change', function() {
                const canId = this.getAttribute('data-canid');
                const byteIndex = parseInt(this.getAttribute('data-byteindex'));
                updateByteConfig(canId, byteIndex, this.value);
            });
        });

        const toggleBtn = blockElement.querySelector('.toggle-btn');
        toggleBtn.addEventListener('click', () => toggleBlock(canId));

        const removeBtn = blockElement.querySelector('.remove-btn');
        removeBtn.addEventListener('click', () => removeCanIdBlock(canId));
    });

    document.getElementById('blockCount').textContent = canIdBlocks.size;

    // Initialize charts for each block
    setTimeout(() => {
        canIdBlocks.forEach((block, canId) => {
            initChartsForBlock(block, canId);
        });
    }, 100);
}

// Process CAN frame for widgets
export function processCANFrameForWidgets(frame, filters) {
    const canId = frame.id.toLowerCase();
    const data = hexToBytes(frame.data);
    const timestamp = new Date().toLocaleTimeString();

    // Process CAN ID blocks
    const block = canIdBlocks.get(canId);
    if (block && block.enabled) {
        block.frameCount++;
        const frameCountElem = document.getElementById(`frame-count-${canId}`);
        if (frameCountElem) {
            frameCountElem.textContent = block.frameCount;
        }

        // Process each byte configuration
        for (let i = 0; i < block.byteConfigs.length; i++) {
            const config = block.byteConfigs[i];
            if (!config || data.length <= i) continue;

            const parsedConfig = parseByteConfig(config);
            if (!parsedConfig) continue;

            // Calculate value based on configuration
            let value = calculateValue(parsedConfig, data);

            // Update chart data
            const chartKey = parsedConfig.key;
            if (!block.chartData[chartKey]) {
                block.chartData[chartKey] = {
                    labels: [],
                    data: [],
                    chart: null,
                    type: parsedConfig.type
                };
            }

            const chartData = block.chartData[chartKey];

            // Add new data point
            chartData.labels.push(timestamp);
            chartData.data.push(value);

            // Limit to MAX_POINTS
            if (chartData.labels.length > MAX_POINTS) {
                chartData.labels.shift();
                chartData.data.shift();
            }

            // Update last value display
            const lastValueElem = document.getElementById(`last-value-${block.canId}-${chartKey}`);
            if (lastValueElem) {
                lastValueElem.textContent = value.toFixed(parsedConfig.decimalPlaces);
            }

            // Update chart
            if (chartData.chart) {
                chartData.chart.data.labels = chartData.labels;
                chartData.chart.data.datasets[0].data = chartData.data;
                chartData.chart.update('none');
            }
        }
    }
}

// Helper functions for widgets
function parseByteConfig(config) {
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

function calculateValue(parsedConfig, data) {
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

function renderChartsForBlock(block) {
    if (Object.keys(block.chartData).length === 0) {
        return '<div class="no-data">No charts configured. Configure byte inputs to display charts.</div>';
    }

    let chartsHTML = '';

    for (const [key, chartData] of Object.entries(block.chartData)) {
        chartsHTML += `
            <div class="chart-container mini-chart-container">
                <div class="chart-header">
                    <h4>${getChartTitle(key, chartData.type)}</h4>
                    <div class="chart-stats">
                        <span>Points: ${chartData.data.length}</span>
                        <span id="last-value-${block.canId}-${key}">0</span>
                    </div>
                </div>
                <canvas id="chart-${block.canId}-${key}"></canvas>
            </div>
        `;
    }

    return chartsHTML;
}

function getChartTitle(key, type) {
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

function initChartsForBlock(block, canId) {
    for (const [key, chartData] of Object.entries(block.chartData)) {
        const canvasId = `chart-${canId}-${key}`;
        const canvas = document.getElementById(canvasId);
        if (!canvas) continue;

        const ctx = canvas.getContext('2d');

        if (chartData.chart) {
            chartData.chart.destroy();
        }

        chartData.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: key,
                    data: chartData.data,
                    borderColor: chartColors[Object.keys(block.chartData).indexOf(key) % chartColors.length],
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

export function updateByteConfig(canId, byteIndex, config) {
    const block = canIdBlocks.get(canId);
    if (block) {
        block.byteConfigs[byteIndex] = config.trim();
        updateChartDataStructure(block);
        renderCanIdBlocks();
    }
}

function updateChartDataStructure(block) {
    const chartKeys = new Set();

    for (let i = 0; i < block.byteConfigs.length; i++) {
        const config = block.byteConfigs[i];
        if (!config) continue;

        const parsed = parseByteConfig(config);
        if (parsed) {
            chartKeys.add(parsed.key);
        }
    }

    for (const key of chartKeys) {
        if (!block.chartData[key]) {
            block.chartData[key] = {
                labels: [],
                data: [],
                chart: null,
                type: 'byte'
            };
        }
    }

    for (const key in block.chartData) {
        if (!chartKeys.has(key)) {
            if (block.chartData[key].chart) {
                block.chartData[key].chart.destroy();
            }
            delete block.chartData[key];
        }
    }
}

function toggleBlock(canId) {
    const block = canIdBlocks.get(canId);
    if (block) {
        block.enabled = !block.enabled;
        renderCanIdBlocks();
    }
}

function removeCanIdBlock(canId) {
    const block = canIdBlocks.get(canId);
    if (block) {
        for (const chartId in block.chartData) {
            if (block.chartData[chartId].chart) {
                block.chartData[chartId].chart.destroy();
            }
        }
    }

    canIdBlocks.delete(canId);
    renderCanIdBlocks();
}