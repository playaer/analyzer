// Основной файл приложения, который инициализирует все модули
import { initWebSocket, connectWebSocket, disconnectWebSocket, sendWebSocketMessage } from './websocket.js';
import { initFilters, addFilter, removeFilter, updateFilterDisplay, filters } from './filters.js';
import { initSender, sendCANFrame } from './sender.js';
import { hexToBytes } from './utils.js';

// Widget management
import { CanChartWidget } from './widgets/canChart.js';

// DOM Elements
let newFilterInput, newBlockInput;
let addWidgetBtn, widgetModal, closeModal, cancelWidgetBtn, saveWidgetBtn;
let widgetTypeSelect, widgetCanIdInput, widgetSettingsContainer;

// Widget management
let widgets = new Map(); // Map<widgetId, widgetInstance>

// Initialize the application
export async function init() {
    console.log('Initializing application...');

    // Cache DOM elements
    newFilterInput = document.getElementById('newFilterId');
    addWidgetBtn = document.getElementById('addWidgetBtn');
    widgetModal = document.getElementById('widgetModal');
    closeModal = document.querySelector('.close');
    cancelWidgetBtn = document.getElementById('cancelWidgetBtn');
    saveWidgetBtn = document.getElementById('saveWidgetBtn');
    widgetTypeSelect = document.getElementById('widgetType');
    widgetCanIdInput = document.getElementById('widgetCanId');
    widgetSettingsContainer = document.getElementById('widgetSettings');

    // Initialize modules
    initWebSocket(handleWebSocketMessage, updateConnectionStatus);
    initFilters();
    initSender();

    // Add event listeners for filters
    const addFilterBtn = document.querySelector('#filtersContainer').parentElement.querySelector('.add-btn');
    addFilterBtn.addEventListener('click', () => {
        const value = newFilterInput.value.trim().toLowerCase();
        if (value) {
            addFilter(value);
        }
    });

    // Add event listeners for widgets modal
    addWidgetBtn.addEventListener('click', openWidgetModal);
    closeModal.addEventListener('click', closeWidgetModal);
    cancelWidgetBtn.addEventListener('click', closeWidgetModal);
    saveWidgetBtn.addEventListener('click', saveWidget);
    widgetTypeSelect.addEventListener('change', updateWidgetSettings);

    // Load filters from server
    await updateFilterDisplay();

    // Load widgets from localStorage
    loadWidgetsFromLocalStorage();

    // Auto-connect WebSocket after 1 second
    setTimeout(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        console.log('Auto-connecting to WebSocket...');
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
    const canIdNum = parseInt(canId, 16);

    // Apply filtering - only process frames that pass the filter
    if (filters.size > 0 && !filters.has(canIdNum)) {
        console.log(`Frame filtered out: ${canId}`);
        return; // Skip this frame, it's filtered out
    }

    // Update filter counter
    const countElem = document.getElementById(`count-${canId}`);
    if (countElem) {
        const current = parseInt(countElem.textContent) || 0;
        countElem.textContent = current + 1;
    }

    // Process frame for widgets
    const data = hexToBytes(frame.data);
    const timestamp = new Date().toLocaleTimeString();

    // Process all widgets
    widgets.forEach(widget => {
        if (widget.canId === canId) {
            widget.processFrame(data, timestamp);
        }
    });
}

// Update connection status
function updateConnectionStatus(connected) {
    const statusElem = document.getElementById('connectionStatus');

    if (connected) {
        statusElem.textContent = 'Connected';
        statusElem.className = 'status connected';
    } else {
        statusElem.textContent = 'Disconnected';
        statusElem.className = 'status disconnected';
    }
}

// Modal functions
function openWidgetModal() {
    widgetModal.style.display = 'block';
    updateWidgetSettings(); // Initialize settings for current type
}

function closeWidgetModal() {
    widgetModal.style.display = 'none';
}

function updateWidgetSettings() {
    const type = widgetTypeSelect.value;
    if (type === 'canChart') {
        // Settings are already in HTML, no need to change
    }
}

function saveWidget() {
    const type = widgetTypeSelect.value;

    if (type === 'canChart') {
        const canId = document.getElementById('widgetCanId').value.trim().toLowerCase();

        if (!canId.match(/^0x[0-9a-f]+$/i)) {
            alert('Invalid CAN ID format. Use hex like 0x200');
            return;
        }

        // Collect byte configurations
        const byteConfigs = [];
        for (let i = 0; i < 8; i++) {
            const input = document.getElementById(`byteConfig${i}`);
            byteConfigs.push(input.value.trim());
        }

        // Create widget
        const widgetId = `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const widget = new CanChartWidget({
            id: widgetId,
            canId: canId,
            byteConfigs: byteConfigs,
            enabled: true
        });

        // Add to DOM
        const container = document.getElementById('widgetsContainer');
        container.appendChild(widget.render());

        // Store reference
        widgets.set(widgetId, widget);
        widget.onRemove = (id) => {
            widgets.delete(id);
            document.getElementById('widgetCount').textContent = widgets.size;
            saveWidgetsToLocalStorage();
        };

        // Update count
        document.getElementById('widgetCount').textContent = widgets.size;

        // Clear inputs
        document.getElementById('widgetCanId').value = '';
        for (let i = 0; i < 8; i++) {
            document.getElementById(`byteConfig${i}`).value = '';
        }

        // Save to localStorage
        saveWidgetsToLocalStorage();
    }

    closeWidgetModal();
}

function saveWidgetsToLocalStorage() {
    const widgetsData = [];
    widgets.forEach(widget => {
        widgetsData.push({
            type: 'canChart',
            id: widget.id,
            canId: widget.canId,
            byteConfigs: widget.byteConfigs,
            enabled: widget.enabled
        });
    });
    localStorage.setItem('widgets', JSON.stringify(widgetsData));
}

function loadWidgetsFromLocalStorage() {
    const saved = localStorage.getItem('widgets');
    if (saved) {
        try {
            const widgetsData = JSON.parse(saved);
            widgetsData.forEach(data => {
                if (data.type === 'canChart') {
                    const widget = new CanChartWidget(data);
                    const container = document.getElementById('widgetsContainer');
                    if (container) {
                        container.appendChild(widget.render());
                    }
                    widgets.set(data.id, widget);
                    widget.onRemove = (id) => {
                        widgets.delete(id);
                        document.getElementById('widgetCount').textContent = widgets.size;
                        saveWidgetsToLocalStorage();
                    };
                }
            });
            document.getElementById('widgetCount').textContent = widgets.size;
        } catch (e) {
            console.error('Failed to load widgets:', e);
        }
    }
}

// Expose functions to window for inline event handlers
window.sendCANFrame = sendCANFrame;

// Initialize on load
document.addEventListener('DOMContentLoaded', init);

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    // Clean up all charts
    widgets.forEach(widget => {
        for (const key in widget.chartData) {
            if (widget.chartData[key].chart) {
                widget.chartData[key].chart.destroy();
            }
        }
    });

    // Close WebSocket
    disconnectWebSocket();
});