// WebSocket module
let ws = null;
let isConnected = false;
let messageHandler = null;
let connectionStatusHandler = null;

// Initialize WebSocket module
export function initWebSocket(msgHandler, statusHandler) {
    messageHandler = msgHandler;
    connectionStatusHandler = statusHandler;
}

// Connect to WebSocket
export function connectWebSocket(url) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        return;
    }

    ws = new WebSocket(url);

    ws.onopen = function() {
        isConnected = true;
        if (connectionStatusHandler) connectionStatusHandler(true);
        console.log('WebSocket connected');
    };

    ws.onclose = function() {
        isConnected = false;
        if (connectionStatusHandler) connectionStatusHandler(false);
        console.log('WebSocket disconnected');
    };

    ws.onerror = function(error) {
        console.error('WebSocket error:', error);
    };

    ws.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            if (messageHandler) messageHandler(data);
        } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
        }
    };
}

// Disconnect from WebSocket
export function disconnectWebSocket() {
    if (ws) {
        ws.close();
        ws = null;
    }
}

// Send message via WebSocket
export function sendWebSocketMessage(message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
        return true;
    }
    return false;
}

// Check if WebSocket is connected
export function isWebSocketConnected() {
    return isConnected;
}