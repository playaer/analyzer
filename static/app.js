// Основной файл приложения
import { initWebSocket, connectWebSocket } from './websocket.js';
import { initFilters, updateFilterDisplay } from './filters.js';
import { initWidgets, processCANFrameForWidgets } from './widgets.js';
import { initSender, sendCANFrame } from './sender.js';
import { ProfilesManager, initTabs } from './profiles.js';

let profilesManager;

export async function init() {
    console.log('Initializing application...');

    initWebSocket(handleWebSocketMessage, updateConnectionStatus);
    initFilters();
    initWidgets();
    initSender();

    initTabs();
    profilesManager = new ProfilesManager();
    profilesManager.init();

    window.profilesManager = profilesManager;

    await updateFilterDisplay();

    setTimeout(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        console.log('Auto-connecting to WebSocket...');
        connectWebSocket(wsUrl);
    }, 1000);
}

function handleWebSocketMessage(data) {
    if (data.type === 'can_frame') {
        processCANFrame(data);
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

window.sendCANFrame = sendCANFrame;

document.addEventListener('DOMContentLoaded', init);