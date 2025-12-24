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

// Функция для отправки UDS запросов через CAN
export function sendUDSRequest(request) {
    if (!isWebSocketConnected()) {
        console.error('WebSocket not connected for UDS request');
        return false;
    }

    // Преобразуем UDS запрос в CAN сообщение
    const canId = '0x7E0'; // Стандартный CAN ID для UDS запросов
    let data = '';

    switch(request.sid) {
        case '22': // ReadDataByIdentifier
            const did = parseInt(request.address, 16);
            data = '22' + ('0000' + did.toString(16)).slice(-4).toUpperCase();
            break;

        case '23': // ReadMemoryByAddress
            const addr = parseInt(request.address, 16);
            const length = request.length || 4;
            data = '23' +
                ('00000000' + addr.toString(16)).slice(-8).toUpperCase() +
                ('00' + length.toString(16)).slice(-2).toUpperCase();
            break;

        case '27': // SecurityAccess
            const subFunc = parseInt(request.address, 16);
            data = '27' + ('00' + subFunc.toString(16)).slice(-2).toUpperCase();
            break;

        case '31': // RoutineControl
            const routineId = parseInt(request.address, 16);
            data = '31' + ('0000' + routineId.toString(16)).slice(-4).toUpperCase() + '01';
            break;
    }

    const message = {
        type: 'send_can',
        id: canId,
        data: data
    };

    return sendWebSocketMessage(message);
}