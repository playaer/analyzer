// Основной файл приложения, который инициализирует все модули
import { initWebSocket, connectWebSocket, disconnectWebSocket, sendWebSocketMessage } from './websocket.js';
import { initFilters, addFilter, removeFilter, updateFilterDisplay, filters } from './filters.js';
import { initWidgets, renderCanIdBlocks, processCANFrameForWidgets, canIdBlocks } from './widgets.js';
import { initSender, sendCANFrame } from './sender.js';
import { loadFromLocalStorage, saveToLocalStorage } from './utils.js';

// DOM Elements
let connectBtn, disconnectBtn, newFilterInput, newBlockInput;

// Initialize the application
export async function init() {
    // Cache DOM elements
    connectBtn = document.getElementById('connectBtn');
    disconnectBtn = document.getElementById('disconnectBtn');
    newFilterInput = document.getElementById('newFilterId');
    newBlockInput = document.getElementById('newBlockId');

    // Initialize modules
    initWebSocket(handleWebSocketMessage, updateConnectionStatus);
    initFilters();
    initWidgets();
    initSender();

    // Add event listeners
    connectBtn.addEventListener('click', () => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        connectWebSocket(wsUrl);
    });

    disconnectBtn.addEventListener('click', disconnectWebSocket);

    const addFilterBtn = document.querySelector('#filtersContainer').parentElement.querySelector('.add-btn');
    const addBlockBtn = document.querySelector('#canIdBlocks').parentElement.querySelector('.add-btn');

    addFilterBtn.addEventListener('click', () => {
        addFilter(newFilterInput.value.trim().toLowerCase());
    });

    addBlockBtn.addEventListener('click', () => {
        addCanIdBlock(newBlockInput.value.trim().toLowerCase());
    });

    // Load from localStorage
    loadFromLocalStorage();

    // Load filters from server
    await updateFilterDisplay();

    // Render CAN ID blocks
    renderCanIdBlocks();

    // Auto-connect after 1 second
    setTimeout(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        connectWebSocket(wsUrl);
    }, 1000);
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

    // Apply filtering - only process frames that pass the filter
    if (filters.size > 0 && !filters.has(canId)) {
        return; // Skip this frame, it's filtered out
    }

    // Update filter counter
    const countElem = document.getElementById(`count-${canId}`);
    if (countElem) {
        const current = parseInt(countElem.textContent) || 0;
        countElem.textContent = current + 1;
    }

    // Process frame for widgets
    processCANFrameForWidgets(frame, filters);
}

// Update connection status
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

// Function to add CAN ID block (re-exported from widgets)
function addCanIdBlock(canId) {
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
        byteConfigs: Array(8).fill(''),
        enabled: true,
        chartData: {},
        frameCount: 0
    };

    canIdBlocks.set(canId, blockConfig);
    newBlockInput.value = '';
    renderCanIdBlocks();
    saveToLocalStorage();
}

// Expose functions to window for inline event handlers
window.sendCANFrame = sendCANFrame;
window.connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    connectWebSocket(wsUrl);
};
window.disconnectWebSocket = disconnectWebSocket;

// Initialize on load
document.addEventListener('DOMContentLoaded', init);

// Cleanup on page unload
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
    disconnectWebSocket();
});