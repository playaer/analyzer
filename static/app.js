// app.js - Основной файл приложения
import { initWebSocket, connectWebSocket } from './websocket.js';
import { initFilters, updateFilterDisplay } from './filters.js';
import { initWidgets, processCANFrameForWidgets } from './widgets.js';
import { initSender, sendCANFrame } from './sender.js';
import { ProfilesManager, initTabs } from './profiles.js';
import { UDSManager } from './udsManager.js';

let profilesManager;
let udsManager;

export async function init() {
    console.log('Initializing application...');

    initWebSocket(handleWebSocketMessage, updateConnectionStatus);
    initFilters();
    initWidgets();
    initSender();

    initTabs();
    profilesManager = new ProfilesManager();
    profilesManager.init();

    // Инициализация UDS менеджера
    udsManager = new UDSManager();
    udsManager.init('udsWidgetsContainer');

    window.profilesManager = profilesManager;
    window.udsManager = udsManager;

    await updateFilterDisplay();

    setTimeout(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        console.log('Auto-connecting to WebSocket...');
        const ws = connectWebSocket(wsUrl);

        // Передаем WebSocket в UDS менеджер
        udsManager.setWebSocket(ws);
    }, 1000);
}

function handleWebSocketMessage(data) {
    if (data.type === 'can_frame') {
        processCANFrame(data);
    } else if (data.type === 'uds_response') {
        // Обработка UDS ответов
        if (udsManager) {
            udsManager.handleResponse(data);
        }
    }
}

function processCANFrame(frame) {
    processCANFrameForWidgets(frame);
}

function updateConnectionStatus(connected) {
    const statusElem = document.getElementById('connectionStatus');
    if (statusElem) {
        statusElem.textContent = connected ? 'Connected' : 'Disconnected';
        statusElem.className = `status ${connected ? 'connected' : 'disconnected'}`;
    }
}

// Глобальные функции
window.sendCANFrame = sendCANFrame;
window.openUDSModal = () => {
    if (udsManager) {
        udsManager.openModal();
    }
};

document.addEventListener('DOMContentLoaded', init);