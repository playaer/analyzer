// Основной файл приложения
import { initWebSocket, connectWebSocket } from './websocket.js';
import { initFilters, updateFilterDisplay } from './filters.js';
import { initWidgets, processCANFrameForWidgets } from './widgets.js';
import { initSender, sendCANFrame } from './sender.js';
import { ProfilesManager, initTabs } from './profiles.js';

// Глобальная переменная для менеджера профилей
let profilesManager;

// Инициализация приложения
export async function init() {
    console.log('Initializing application...');

    // Инициализируем модули
    initWebSocket(handleWebSocketMessage, updateConnectionStatus);
    initFilters();
    initWidgets();
    initSender();

    // Инициализируем вкладки и профили
    initTabs();
    profilesManager = new ProfilesManager();
    profilesManager.init();

    // Экспортируем менеджер профилей в глобальную область видимости
    window.profilesManager = profilesManager;

    // Загружаем фильтры с сервера
    await updateFilterDisplay();

    // Автоподключение WebSocket через 1 секунду
    setTimeout(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        console.log('Auto-connecting to WebSocket...');
        connectWebSocket(wsUrl);
    }, 1000);
}

// Обработка сообщений WebSocket
function handleWebSocketMessage(data) {
    if (data.type === 'can_frame') {
        processCANFrame(data);
    }
}

// Обработка CAN фреймов
function processCANFrame(frame) {
    processCANFrameForWidgets(frame);
}

// Обновление статуса подключения
function updateConnectionStatus(connected) {
    const statusElem = document.getElementById('connectionStatus');
    if (statusElem) {
        statusElem.textContent = connected ? 'Connected' : 'Disconnected';
        statusElem.className = `status ${connected ? 'connected' : 'disconnected'}`;
    }
}

// Экспортируем функции в глобальную область видимости
window.sendCANFrame = sendCANFrame;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', init);