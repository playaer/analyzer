// Основной файл приложения
import { initWebSocket, connectWebSocket as connectWS, disconnectWebSocket, sendWebSocketMessage, isWebSocketConnected } from './websocket.js';
import { initFilters, updateFilterDisplay } from './filters.js';
import { initWidgets, processCANFrameForWidgets } from './widgets.js';
import { initSender, sendCANFrame } from './sender.js';

// Initialize the application
export async function init() {
    console.log('Initializing application...');

    // Initialize modules
    initWebSocket(handleWebSocketMessage, updateConnectionStatus);
    initFilters();
    initWidgets();
    initSender();

    // Load filters from server
    try {
        await updateFilterDisplay();
    } catch (error) {
        console.error('Failed to load filters:', error);
    }

    // Auto-connect WebSocket
    setTimeout(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        console.log('Auto-connecting to WebSocket:', wsUrl);
        connectWS(wsUrl);
    }, 1000);
}

// Handle incoming WebSocket messages
function handleWebSocketMessage(data) {
    try {
        if (data.type === 'can_frame') {
            processCANFrame(data);
        }
    } catch (error) {
        console.error('Error processing WebSocket message:', error);
    }
}

// Process CAN frame data
function processCANFrame(frame) {
    try {
        processCANFrameForWidgets(frame);
    } catch (error) {
        console.error('Error processing CAN frame:', error);
    }
}

// Update connection status
function updateConnectionStatus(connected) {
    const statusElem = document.getElementById('connectionStatus');
    if (statusElem) {
        statusElem.textContent = connected ? 'Connected' : 'Disconnected';
        statusElem.className = `status ${connected ? 'connected' : 'disconnected'}`;
    }
}

// Expose functions to window
window.sendCANFrame = sendCANFrame;

// Initialize on load
document.addEventListener('DOMContentLoaded', init);

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    // Close WebSocket
    if (typeof disconnectWebSocket === 'function') {
        disconnectWebSocket();
    }
});