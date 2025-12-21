// Sender module for CAN frame transmission
import { sendWebSocketMessage, isWebSocketConnected } from './websocket.js';

let sentCount = 0;

export function initSender() {
    // Инициализация, если нужна
}

export function sendCANFrame() {
    if (!isWebSocketConnected()) {
        alert('WebSocket не подключен. Данные не могут быть отправлены.');
        return;
    }

    const canId = document.getElementById('canId').value;
    const canData = document.getElementById('canData').value;

    // Validate input
    if (!canId.match(/^0x[0-9A-Fa-f]+$/)) {
        alert('Неверный формат CAN ID. Используйте hex, например 0x200');
        return;
    }

    if (!canData.match(/^([0-9A-Fa-f]{2}\s*)+$/)) {
        alert('Неверный формат данных. Используйте hex байты, разделенные пробелами');
        return;
    }

    const message = {
        type: 'send_can',
        id: canId,
        data: canData.replace(/\s+/g, '')
    };

    if (sendWebSocketMessage(message)) {
        sentCount++;
        document.getElementById('sentCount').textContent = sentCount;
        console.log('Отправлен CAN фрейм:', message);
    } else {
        alert('Не удалось отправить CAN фрейм: WebSocket не подключен');
    }
}