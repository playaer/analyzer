// Sender module for CAN frame transmission
import { sendWebSocketMessage, isWebSocketConnected } from './websocket.js';

let sentCount = 0;

// Initialize sender module
export function initSender() {
    // Additional initialization if needed
}

// Send CAN frame
export function sendCANFrame() {
    if (!isWebSocketConnected()) {
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

    if (sendWebSocketMessage(message)) {
        sentCount++;
        document.getElementById('sentCount').textContent = sentCount;
        console.log('Sent CAN frame:', message);
    } else {
        alert('Failed to send CAN frame: WebSocket not connected');
    }
}