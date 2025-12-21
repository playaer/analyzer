// Main widgets coordinator
import { canChartWidget } from './canChart.js';
import { canChart2Widget } from './canChart2.js';

export let widgets = new Map(); // Map<widgetId, WidgetConfig>

export function initWidgets() {
    console.log('Widgets module initialized');
    setupModalEvents();
    loadWidgetsFromStorage();
    renderWidgets();
}

export function processCANFrameForWidgets(frame) {
    const canId = frame.id.toLowerCase();

    // Process frame for each widget
    widgets.forEach((widget, widgetId) => {
        if (widget.canId === canId && widget.enabled) {
            widget.frameCount++;

            // Update widget frame count display
            const countElem = document.getElementById(`frame-count-${widgetId}`);
            if (countElem) {
                countElem.textContent = widget.frameCount;
            }

            // Process based on widget type
            switch (widget.type) {
                case 'canChart':
                    canChartWidget.processFrame(widgetId, frame, widget);
                    break;
                case 'canChart2':
                    canChart2Widget.processFrame(widgetId, frame, widget);
                    break;
            }
        }
    });
}

// Modal handling
function setupModalEvents() {
    const modal = document.getElementById('widgetModal');
    const addBtn = document.getElementById('addWidgetBtn');
    const closeBtn = document.querySelector('.modal-close');
    const cancelBtn = document.getElementById('modalCancelBtn');
    const saveBtn = document.getElementById('modalSaveBtn');
    const widgetTypeSelect = document.getElementById('modalWidgetType');

    addBtn.addEventListener('click', () => {
        openModal();
    });

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    widgetTypeSelect.addEventListener('change', (e) => {
        const type = e.target.value;
        document.getElementById('singleChartConfig').style.display =
            type === 'canChart' ? 'block' : 'none';
        document.getElementById('dualChartConfig').style.display =
            type === 'canChart2' ? 'block' : 'none';
    });

    saveBtn.addEventListener('click', saveWidget);

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
}

function openModal(widgetId = null) {
    const modal = document.getElementById('widgetModal');
    const modalWidgetId = document.getElementById('modalWidgetId');
    const modalCanId = document.getElementById('modalCanId');
    const modalWidgetType = document.getElementById('modalWidgetType');

    if (widgetId) {
        // Edit mode
        const widget = widgets.get(widgetId);
        if (widget) {
            modalWidgetId.value = widgetId;
            modalWidgetId.readOnly = true;
            modalCanId.value = widget.canId;
            modalWidgetType.value = widget.type;

            // Load specific config based on type
            if (widget.type === 'canChart') {
                // Load single chart config
            } else if (widget.type === 'canChart2') {
                // Load dual chart config
            }
        }
    } else {
        // Add mode
        modalWidgetId.value = `widget-${Date.now()}`;
        modalWidgetId.readOnly = false;
        modalCanId.value = '';
        modalWidgetType.value = 'canChart';
    }

    modal.style.display = 'block';
}

function closeModal() {
    document.getElementById('widgetModal').style.display = 'none';
    clearModal();
}

function clearModal() {
    document.getElementById('modalWidgetId').value = '';
    document.getElementById('modalCanId').value = '';
    document.getElementById('modalWidgetType').value = 'canChart';

    // Reset config sections
    document.getElementById('singleChartConfig').style.display = 'block';
    document.getElementById('dualChartConfig').style.display = 'none';
}

function saveWidget() {
    const widgetId = document.getElementById('modalWidgetId').value;
    const canId = document.getElementById('modalCanId').value;
    const type = document.getElementById('modalWidgetType').value;

    if (!widgetId.match(/^[a-zA-Z0-9-_]+$/)) {
        alert('Widget ID может содержать только буквы, цифры, дефисы и подчеркивания');
        return;
    }

    if (!canId.match(/^0x[0-9a-f]+$/i)) {
        alert('Неверный формат CAN ID. Используйте hex, например 0x200');
        return;
    }

    const widgetConfig = {
        widgetId: widgetId,
        canId: canId.toLowerCase(),
        type: type,
        enabled: true,
        frameCount: 0,
        createdAt: new Date().toISOString()
    };

    // Save config based on widget type
    if (type === 'canChart') {
        widgetConfig.config = canChartWidget.getConfigFromModal();
    } else if (type === 'canChart2') {
        widgetConfig.config = canChart2Widget.getConfigFromModal();
    }

    widgets.set(widgetId, widgetConfig);
    closeModal();
    renderWidgets();
    saveWidgetsToStorage();
}

export function renderWidgets() {
    const container = document.getElementById('widgetsContainer');
    container.innerHTML = '';

    widgets.forEach((widget, widgetId) => {
        let widgetHTML = '';

        switch (widget.type) {
            case 'canChart':
                widgetHTML = canChartWidget.render(widgetId, widget);
                break;
            case 'canChart2':
                widgetHTML = canChart2Widget.render(widgetId, widget);
                break;
        }

        const widgetElement = document.createElement('div');
        widgetElement.className = 'widget';
        widgetElement.id = `widget-${widgetId}`;
        widgetElement.innerHTML = widgetHTML;

        container.appendChild(widgetElement);

        // Add event listeners for widget actions
        const editBtn = widgetElement.querySelector('.widget-btn.edit');
        const removeBtn = widgetElement.querySelector('.widget-btn.remove');

        if (editBtn) {
            editBtn.addEventListener('click', () => openModal(widgetId));
        }

        if (removeBtn) {
            removeBtn.addEventListener('click', () => removeWidget(widgetId));
        }

        // Initialize chart if needed
        setTimeout(() => {
            switch (widget.type) {
                case 'canChart':
                    canChartWidget.initChart(widgetId, widget);
                    break;
                case 'canChart2':
                    canChart2Widget.initChart(widgetId, widget);
                    break;
            }
        }, 100);
    });

    document.getElementById('widgetCount').textContent = widgets.size;
}

function removeWidget(widgetId) {
    if (confirm('Удалить этот виджет?')) {
        const widget = widgets.get(widgetId);
        if (widget) {
            // Clean up chart resources
            switch (widget.type) {
                case 'canChart':
                    canChartWidget.destroy(widgetId);
                    break;
                case 'canChart2':
                    canChart2Widget.destroy(widgetId);
                    break;
            }
        }

        widgets.delete(widgetId);
        renderWidgets();
        saveWidgetsToStorage();
    }
}

// Storage functions
function loadWidgetsFromStorage() {
    try {
        const saved = localStorage.getItem('canWidgets');
        if (saved) {
            const savedWidgets = JSON.parse(saved);
            Object.entries(savedWidgets).forEach(([id, widget]) => {
                widgets.set(id, {
                    ...widget,
                    frameCount: 0 // Reset frame count on load
                });
            });
        }
    } catch (e) {
        console.error('Failed to load widgets:', e);
    }
}

function saveWidgetsToStorage() {
    const widgetsObj = {};
    widgets.forEach((widget, id) => {
        const saveWidget = { ...widget };
        delete saveWidget.frameCount; // Don't save frame count
        widgetsObj[id] = saveWidget;
    });
    localStorage.setItem('canWidgets', JSON.stringify(widgetsObj));
}