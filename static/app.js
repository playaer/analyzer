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
    await updateFilterDisplay();

    // Auto-connect WebSocket
    setTimeout(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        connectWS(wsUrl);
    }, 1000);
}

// Handle incoming WebSocket messages
function handleWebSocketMessage(data) {
    if (data.type === 'can_frame') {
        processCANFrame(data);
    }
}

// Process CAN frame data
function processCANFrame(frame) {
    processCANFrameForWidgets(frame);
}

// Update connection status
function updateConnectionStatus(connected) {
    const statusElem = document.getElementById('connectionStatus');
    statusElem.textContent = connected ? 'Connected' : 'Disconnected';
    statusElem.className = `status ${connected ? 'connected' : 'disconnected'}`;
}

// Expose functions to window
window.sendCANFrame = sendCANFrame;
window.connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    connectWS(wsUrl);
};
window.disconnectWebSocket = disconnectWebSocket;

// Initialize on load
document.addEventListener('DOMContentLoaded', init);

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    disconnectWebSocket();
});