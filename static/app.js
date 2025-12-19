// WebSocket connection
let ws = null;
let isConnected = false;
let sentCount = 0;

// Data storage
const MAX_POINTS = 50;
const chartColors = [
    'rgba(255, 99, 132, 1)',
    'rgba(54, 162, 235, 1)',
    'rgba(75, 192, 192, 1)',
    'rgba(153, 102, 255, 1)',
    'rgba(255, 159, 64, 1)',
    'rgba(255, 205, 86, 1)',
    'rgba(201, 203, 207, 1)',
    'rgba(0, 200, 83, 1)'
];

// Фильтры
let filters = new Set();
let canIdBlocks = new Map(); // Map<canId, BlockData>

// DOM Elements
let connectBtn, disconnectBtn, newFilterInput, newBlockInput;

// Initialize
function init() {
    // Cache DOM elements
    connectBtn = document.getElementById('connectBtn');
    disconnectBtn = document.getElementById('disconnectBtn');
    newFilterInput = document.getElementById('newFilterId');
    newBlockInput = document.getElementById('newBlockId');

    // Add event listeners
    connectBtn.addEventListener('click', connectWebSocket);
    disconnectBtn.addEventListener('click', disconnectWebSocket);

    const addFilterBtn = document.querySelector('#filtersContainer').parentElement.querySelector('.add-btn');
    const addBlockBtn = document.querySelector('#canIdBlocks').parentElement.querySelector('.add-btn');

    addFilterBtn.addEventListener('click', addFilter);
    addBlockBtn.addEventListener('click', addCanIdBlock);

    // Load from localStorage
    loadFromLocalStorage();
    updateFilterDisplay();
    renderCanIdBlocks();

    // Auto-connect after 1 second
    setTimeout(connectWebSocket, 1000);
}

// Local storage
function loadFromLocalStorage() {
    const savedFilters = localStorage.getItem('canFilters');
    if (savedFilters) {
        try {
            const filterArray = JSON.parse(savedFilters);
            filters = new Set(filterArray);
        } catch (e) {
            console.error('Failed to load filters:', e);
        }
    }

    const savedBlocks = localStorage.getItem('canIdBlocks');
    if (savedBlocks) {
        try {
            const blocks = JSON.parse(savedBlocks);
            canIdBlocks = new Map(Object.entries(blocks));
            // Initialize chart data for each block
            for (const [canId, block] of canIdBlocks) {
                if (!block.chartData) {
                    block.chartData = {};
                }
            }
        } catch (e) {
            console.error('Failed to load blocks:', e);
        }
    }
}

function saveToLocalStorage() {
    localStorage.setItem('canFilters', JSON.stringify(Array.from(filters)));

    const blocksObj = {};
    canIdBlocks.forEach((value, key) => {
        // Don't save chart data to localStorage
        const saveBlock = { ...value };
        delete saveBlock.chartData;
        blocksObj[key] = saveBlock;
    });
    localStorage.setItem('canIdBlocks', JSON.stringify(blocksObj));
}

// Filters management
async function addFilter() {
    const canId = newFilterInput.value.trim().toLowerCase();

    if (!canId.match(/^0x[0-9a-f]+$/i)) {
        alert('Invalid CAN ID format. Use hex like 0x200');
        return;
    }

    if (filters.has(canId)) {
        alert('Filter already exists');
        return;
    }

    try {
        // Save to server
        const response = await fetch('/api/filters', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                can_id: parseInt(canId, 16),
                mask: 0xFFFFFFFF,
                enabled: true
            })
        });

        if (!response.ok) {
            throw new Error('Failed to save filter to server');
        }

        const savedFilter = await response.json();

        // Add to local set
        filters.add(canId);
        newFilterInput.value = '';
        updateFilterDisplay();
        saveToLocalStorage();

        console.log('Filter saved to server:', savedFilter);
    } catch (error) {
        console.error('Error saving filter:', error);
        alert('Failed to save filter to server: ' + error.message);
    }
}

async function removeFilter(canId) {
    try {
        // Get filter ID from server
        const filtersResponse = await fetch('/api/filters');
        const serverFilters = await filtersResponse.json();

        const filterToDelete = serverFilters.find(f =>
            f.can_id === parseInt(canId, 16)
        );

        if (filterToDelete) {
            // Delete from server
            const deleteResponse = await fetch(`/api/filters?id=${filterToDelete.id}`, {
                method: 'DELETE'
            });

            if (!deleteResponse.ok) {
                throw new Error('Failed to delete filter from server');
            }
        }

        // Remove from local set
        filters.delete(canId);
        updateFilterDisplay();
        saveToLocalStorage();

    } catch (error) {
        console.error('Error removing filter:', error);
        alert('Failed to remove filter from server: ' + error.message);
    }
}

async function updateFilterDisplay() {
    const container = document.getElementById('filtersContainer');
    container.innerHTML = '';

    // Load filters from server
    try {
        const response = await fetch('/api/filters');
        if (response.ok) {
            const serverFilters = await response.json();

            // Update local filters set
            filters.clear();
            serverFilters.forEach(filter => {
                if (filter.enabled) {
                    filters.add(`0x${filter.can_id.toString(16).toLowerCase()}`);
                }
            });
        }
    } catch (error) {
        console.error('Failed to load filters from server:', error);
    }

    filters.forEach(canId => {
        const filterElement = document.createElement('div');
        filterElement.className = 'filter-item';
        filterElement.innerHTML = `
            <div class="filter-header">
                <span class="filter-can-id">${canId}</span>
                <button class="remove-btn">×</button>
            </div>
            <div class="data-points">
                Frames: <span id="count-${canId}">0</span>
            </div>
        `;

        // Add event listener to remove button
        const removeBtn = filterElement.querySelector('.remove-btn');
        removeBtn.addEventListener('click', () => removeFilter(canId));

        container.appendChild(filterElement);
    });

    document.getElementById('filterCount').textContent = filters.size;
}

// CAN ID Blocks management
function addCanIdBlock() {
    let canId = newBlockInput.value.trim().toLowerCase();

    if (!canId.match(/^0x[0-9a-f]+$/i)) {
        alert('Invalid CAN ID format. Use hex like 0x200');
        return;
    }

    if (canIdBlocks.has(canId)) {
        alert('Block already exists');
        return;
    }

    // Initialize block configuration
    const blockConfig = {
        canId: canId,
        byteConfigs: Array(8).fill(''), // Empty configs for 8 bytes
        enabled: true,
        chartData: {}, // Will store data for each configured chart
        frameCount: 0
    };

    canIdBlocks.set(canId, blockConfig);
    newBlockInput.value = '';
    renderCanIdBlocks();
    saveToLocalStorage();
}

function removeCanIdBlock(canId) {
    // Clean up chart resources
    const block = canIdBlocks.get(canId);
    if (block) {
        // Destroy any charts
        for (const chartId in block.chartData) {
            if (block.chartData[chartId].chart) {
                block.chartData[chartId].chart.destroy();
            }
        }
    }

    canIdBlocks.delete(canId);
    renderCanIdBlocks();
    saveToLocalStorage();
}

function updateByteConfig(canId, byteIndex, config) {
    const block = canIdBlocks.get(canId);
    if (block) {
        block.byteConfigs[byteIndex] = config.trim();

        // Update chart data structure
        updateChartDataStructure(block);
        renderCanIdBlocks();
        saveToLocalStorage();
    }
}

function updateChartDataStructure(block) {
    // Parse all byte configs and create appropriate chart data structures
    const chartKeys = new Set();

    for (let i = 0; i < block.byteConfigs.length; i++) {
        const config = block.byteConfigs[i];
        if (!config) continue;

        const parsed = parseByteConfig(config);
        if (parsed) {
            chartKeys.add(parsed.key);
        }
    }

    // Initialize or cleanup chart data
    for (const key of chartKeys) {
        if (!block.chartData[key]) {
            block.chartData[key] = {
                labels: [],
                data: [],
                chart: null,
                type: 'byte' // byte, word, float
            };
        }
    }

    // Remove unused chart data
    for (const key in block.chartData) {
        if (!chartKeys.has(key)) {
            if (block.chartData[key].chart) {
                block.chartData[key].chart.destroy();
            }
            delete block.chartData[key];
        }
    }
}

function parseByteConfig(config) {
    // Updated patterns according to requirements:
    // "0" -> single byte (signed)
    // "0-1" -> signed word (bytes 0-1, HiLo)
    // "0-1(U)" -> unsigned word (bytes 0-1, HiLo)
    // "0-3(F)" -> float (bytes 0-3, default decimals)
    // "0-3(F,2)" -> float (bytes 0-3, 2 decimal places)

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

    return null; // Invalid config
}

function renderCanIdBlocks() {
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

        // Destroy existing chart
        if (chartData.chart) {
            chartData.chart.destroy();
        }

        // Create new chart
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
                animation: {
                    duration: 0
                },
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        display: false
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
    }
}

function toggleBlock(canId) {
    const block = canIdBlocks.get(canId);
    if (block) {
        block.enabled = !block.enabled;
        saveToLocalStorage();
        renderCanIdBlocks();
    }
}

// WebSocket functions
function connectWebSocket() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    ws = new WebSocket(wsUrl);

    ws.onopen = function() {
        isConnected = true;
        updateConnectionStatus(true);
        console.log('WebSocket connected');
    };

    ws.onclose = function() {
        isConnected = false;
        updateConnectionStatus(false);
        console.log('WebSocket disconnected');
    };

    ws.onerror = function(error) {
        console.error('WebSocket error:', error);
        alert('Failed to connect to WebSocket server');
    };

    ws.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
        }
    };
}

function disconnectWebSocket() {
    if (ws) {
        ws.close();
        ws = null;
    }
}

function updateConnectionStatus(connected) {
    const statusElem = document.getElementById('connectionStatus');

    if (connected) {
        statusElem.textContent = 'Connected';
        statusElem.className = 'status connected';
        connectBtn.disabled = true;
        disconnectBtn.disabled = false;
    } else {
        statusElem.textContent = 'Disconnected';
        statusElem.className = 'status disconnected';
        connectBtn.disabled = false;
        disconnectBtn.disabled = true;
    }
}

// Handle incoming WebSocket messages
function handleWebSocketMessage(data) {
    if (data.type === 'can_frame') {
        processCANFrame(data);
    } else if (data.type === 'ack') {
        console.log('ACK received:', data.message);
    }
}

// Process CAN frame data
function processCANFrame(frame) {
    const canId = frame.id.toLowerCase();
    const data = hexToBytes(frame.data);
    const timestamp = new Date().toLocaleTimeString();

    // Update filter counter if this CAN ID is filtered
    if (filters.has(canId)) {
        const countElem = document.getElementById(`count-${canId}`);
        if (countElem) {
            const current = parseInt(countElem.textContent) || 0;
            countElem.textContent = current + 1;
        }
    }

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
            let value = 0;

            switch (parsedConfig.type) {
                case 'byte':
                    if (data.length > parsedConfig.byteIndex) {
                        value = data[parsedConfig.byteIndex];
                        // Convert to signed if needed (two's complement)
                        if (parsedConfig.signed && value > 127) {
                            value = value - 256;
                        }
                    }
                    break;
                case 'word':
                    if (data.length > parsedConfig.endByte) {
                        // HiLo byte order (big-endian)
                        const highByte = data[parsedConfig.startByte];
                        const lowByte = data[parsedConfig.endByte];
                        value = (highByte << 8) | lowByte;

                        // Convert to signed if needed
                        if (parsedConfig.signed && value > 32767) {
                            value = value - 65536;
                        }
                    }
                    break;
                case 'float':
                    if (data.length > parsedConfig.endByte) {
                        // Create a DataView to interpret bytes as float
                        const buffer = new ArrayBuffer(4);
                        const view = new DataView(buffer);
                        // HiLo byte order (big-endian)
                        view.setUint8(0, data[parsedConfig.startByte]);
                        view.setUint8(1, data[parsedConfig.startByte + 1]);
                        view.setUint8(2, data[parsedConfig.startByte + 2]);
                        view.setUint8(3, data[parsedConfig.startByte + 3]);
                        value = view.getFloat32(0, false); // Big-endian (HiLo)
                        value = parseFloat(value.toFixed(parsedConfig.decimalPlaces));
                    }
                    break;
            }

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

// Send CAN frame
function sendCANFrame() {
    if (!isConnected || !ws) {
        alert('Please connect to WebSocket first');
        return;
    }

    const canId = document.getElementById('canId').value;
    const canData = document.getElementById('canData').value;

    // Validate input
    if (!canId.match(/^0x[0-9A-Fa-f]+$/)) {
        alert('Invalid CAN ID format. Use hex like 0x200');
        return;
    }

    if (!canData.match(/^([0-9A-Fa-f]{2}\s*)+$/)) {
        alert('Invalid data format. Use hex bytes separated by spaces');
        return;
    }

    // Send via WebSocket
    const message = {
        type: 'send_can',
        id: canId,
        data: canData.replace(/\s+/g, '')
    };

    ws.send(JSON.stringify(message));
    sentCount++;
    document.getElementById('sentCount').textContent = sentCount;

    console.log('Sent CAN frame:', message);
}

// Utility functions
function hexToBytes(hex) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
}

function bytesToHex(bytes) {
    return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);

// Cleanup on page unload to prevent memory leaks
window.addEventListener('beforeunload', function() {
    // Clean up all charts
    canIdBlocks.forEach(block => {
        for (const key in block.chartData) {
            if (block.chartData[key].chart) {
                block.chartData[key].chart.destroy();
            }
        }
    });

    // Close WebSocket
    if (ws) {
        ws.close();
    }
});

// Periodically clean up memory
setInterval(function() {
    // Limit the number of stored frames in each chart
    canIdBlocks.forEach(block => {
        for (const key in block.chartData) {
            const chartData = block.chartData[key];
            if (chartData.labels.length > MAX_POINTS * 2) {
                chartData.labels = chartData.labels.slice(-MAX_POINTS);
                chartData.data = chartData.data.slice(-MAX_POINTS);
            }
        }
    });
}, 30000); // Every 30 seconds