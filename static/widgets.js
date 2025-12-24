// Main widgets coordinator
import { numericWidget } from './numericWidget.js';
import { canChart2Widget } from './canChart2.js';
import { WidgetService } from './widgetService.js';
import { ParamConfig, createParamElement } from './components.js';
import { WidgetInteractions, addResizeHandle } from './widgetInteractions.js';

export let widgets = new Map();
let widgetInteractions = null;
let currentEditWidgetId = null;

// Инициализация
export function initWidgets() {
    console.log('Widgets module initialized');
    loadWidgetsFromStorage();
    renderWidgets();
    setupModalEvents();

    widgetInteractions = new WidgetInteractions();
    widgetInteractions.onResize((newSize, widgetElement) => {
        const widgetId = widgetElement.id.replace('widget-', '');
        const widget = widgets.get(widgetId);
        if (widget) {
            widget.size = newSize;
            const badge = widgetElement.querySelector('.widget-size-badge');
            if (badge) {
                badge.textContent = `${newSize}×`;
            }
            saveWidgetsToStorage();

            setTimeout(() => {
                if (widget.chart) {
                    widget.chart.resize();
                    widget.chart.update('none');
                }
            }, 100);
        }
    });
}

// Обработка CAN фреймов
export function processCANFrameForWidgets(frame) {
    const canId = frame.id.toLowerCase();

    widgets.forEach((widget, widgetId) => {
        if (widget.enabled) {
            let shouldProcess = false;

            if (widget.type === 'numeric') {
                shouldProcess = widget.config?.params?.some(param =>
                    param.canId.toLowerCase() === canId
                );
            } else if (widget.type === 'canChart2' && widget.config?.params) {
                shouldProcess = widget.config.params.some(param =>
                    param.canId.toLowerCase() === canId
                );
            }

            if (shouldProcess) {
                widget.frameCount = (widget.frameCount || 0) + 1;
                updateFrameCount(widgetId, widget.frameCount);

                switch (widget.type) {
                    case 'numeric':
                        numericWidget.processFrame(widgetId, frame, widget);
                        break;
                    case 'canChart2':
                        canChart2Widget.processFrame(widgetId, frame, widget);
                        break;
                }
            }
        }
    });
}

// Настройка модального окна
function setupModalEvents() {
    const modal = document.getElementById('widgetModal');
    const addBtn = document.getElementById('addWidgetBtn');
    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtn = document.getElementById('modalCancelBtn');
    const saveBtn = document.getElementById('modalSaveBtn');
    const widgetTypeSelect = document.getElementById('modalWidgetType');
    const addParamBtn = document.getElementById('addParamBtn');
    const addNumericParamBtn = document.getElementById('addNumericParamBtn');

    if (addBtn) {
        addBtn.addEventListener('click', () => openModal());
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    if (widgetTypeSelect) {
        widgetTypeSelect.addEventListener('change', (e) => {
            updateModalForType(e.target.value);
        });
    }

    if (addParamBtn) {
        addParamBtn.addEventListener('click', () => addParamComponent());
    }

    if (addNumericParamBtn) {
        addNumericParamBtn.addEventListener('click', () => addNumericParamComponent());
    }

    if (saveBtn) saveBtn.addEventListener('click', saveWidget);

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
}

// Открытие модального окна
function openModal(widgetId = null) {
    currentEditWidgetId = widgetId;
    const modal = document.getElementById('widgetModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalWidgetId = document.getElementById('modalWidgetId');
    const modalWidgetName = document.getElementById('modalWidgetName');
    const modalWidgetType = document.getElementById('modalWidgetType');

    if (widgetId) {
        modalTitle.textContent = 'Edit Widget';
        const widget = widgets.get(widgetId);
        if (widget) {
            modalWidgetId.value = widgetId;
            modalWidgetName.value = widget.config?.widgetName || '';
            modalWidgetType.value = widget.type;
            loadWidgetConfig(widget);
        }
    } else {
        modalTitle.textContent = 'Add New Widget';
        modalWidgetId.value = WidgetService.generateUniqueWidgetId();
        modalWidgetName.value = '';
        modalWidgetType.value = 'numeric';
        resetModalConfig();
    }

    updateModalForType(modalWidgetType.value);
    modal.style.display = 'block';
}

function loadWidgetConfig(widget) {
    const paramContainer = document.getElementById('paramContainer');
    const numericParamContainer = document.getElementById('numericParamContainer');

    if (paramContainer) paramContainer.innerHTML = '';
    if (numericParamContainer) numericParamContainer.innerHTML = '';

    if (widget.type === 'canChart2') {
        const yMinInput = document.getElementById('chartYMin');
        const yMaxInput = document.getElementById('chartYMax');
        const autoScaleCheckbox = document.getElementById('chartAutoScale');

        if (yMinInput) yMinInput.value = widget.config?.yMin || '';
        if (yMaxInput) yMaxInput.value = widget.config?.yMax || '';
        if (autoScaleCheckbox) {
            autoScaleCheckbox.checked = widget.config?.autoScale !== false;
        }

        if (widget.config?.params) {
            widget.config.params.forEach((paramData, index) => {
                const param = new ParamConfig(index, { ...paramData, type: 'canChart2' });
                const paramElement = createParamElement(param, 'canChart2');
                paramContainer.appendChild(paramElement);
            });
        }
    } else if (widget.type === 'numeric' && widget.config?.params) {
        widget.config.params.forEach((paramData, index) => {
            const param = new ParamConfig(index, { ...paramData, type: 'numeric' });
            const paramElement = createParamElement(param, 'numeric');
            numericParamContainer.appendChild(paramElement);
        });
    }
}

// Добавление нового параметра для multi-chart
function addParamComponent() {
    const paramContainer = document.getElementById('paramContainer');
    if (!paramContainer) return;

    const currentParams = paramContainer.querySelectorAll('.param-config');
    if (currentParams.length >= 4) {
        alert('Maximum 4 parameters allowed');
        return;
    }

    const index = currentParams.length;
    const param = new ParamConfig(index, { color: '#ff6384', type: 'canChart2' });
    const paramElement = createParamElement(param, 'canChart2');
    paramContainer.appendChild(paramElement);
}

// Добавление нового параметра для numeric widget
function addNumericParamComponent() {
    const paramContainer = document.getElementById('numericParamContainer');
    if (!paramContainer) return;

    const currentParams = paramContainer.querySelectorAll('.param-config');
    if (currentParams.length >= 4) {
        alert('Maximum 4 parameters allowed');
        return;
    }

    const index = currentParams.length;
    const param = new ParamConfig(index, { color: '#000000', type: 'numeric' });
    const paramElement = createParamElement(param, 'numeric');
    paramContainer.appendChild(paramElement);
}

// Обновление модального окна в зависимости от типа
function updateModalForType(type) {
    const chartSettings = document.getElementById('chartSettings');
    const multiConfig = document.getElementById('multiChartConfig');
    const numericConfig = document.getElementById('numericConfig');

    if (chartSettings) chartSettings.style.display = 'none';
    if (multiConfig) multiConfig.style.display = 'none';
    if (numericConfig) numericConfig.style.display = 'none';

    if (type === 'canChart2') {
        if (chartSettings) chartSettings.style.display = 'block';
        multiConfig.style.display = 'block';
        const paramContainer = document.getElementById('paramContainer');
        if (paramContainer && paramContainer.children.length === 0) {
            addParamComponent();
        }
    } else if (type === 'numeric') {
        numericConfig.style.display = 'block';
        const numericParamContainer = document.getElementById('numericParamContainer');
        if (numericParamContainer && numericParamContainer.children.length === 0) {
            addNumericParamComponent();
        }
    }
}

// Сброс конфигурации модального окна
function resetModalConfig() {
    const paramContainer = document.getElementById('paramContainer');
    const numericParamContainer = document.getElementById('numericParamContainer');
    const yMinInput = document.getElementById('chartYMin');
    const yMaxInput = document.getElementById('chartYMax');
    const autoScaleCheckbox = document.getElementById('chartAutoScale');

    if (paramContainer) paramContainer.innerHTML = '';
    if (numericParamContainer) numericParamContainer.innerHTML = '';
    if (yMinInput) yMinInput.value = '';
    if (yMaxInput) yMaxInput.value = '';
    if (autoScaleCheckbox) autoScaleCheckbox.checked = true;
}

// Сохранение виджета
function saveWidget() {
    const widgetId = document.getElementById('modalWidgetId').value;
    const widgetName = document.getElementById('modalWidgetName').value;
    const widgetType = document.getElementById('modalWidgetType').value;

    if (!widgetId || !widgetType) {
        alert('Widget ID and type are required');
        return;
    }

    const widgetConfig = {
        widgetId: widgetId,
        type: widgetType,
        widgetName: widgetName || `${widgetType} Widget`,
        enabled: true,
        frameCount: 0,
        size: 1,
        createdAt: new Date().toISOString(),
        config: {}
    };

    if (widgetType === 'canChart2') {
        const paramElements = document.querySelectorAll('#paramContainer .param-config');
        const params = [];

        paramElements.forEach((element) => {
            const param = new ParamConfig(0);
            const paramData = param.getDataFromDOM(element);
            params.push(paramData);
        });

        if (params.length === 0) {
            alert('At least one parameter is required');
            return;
        }

        const yMinInput = document.getElementById('chartYMin');
        const yMaxInput = document.getElementById('chartYMax');
        const autoScaleCheckbox = document.getElementById('chartAutoScale');

        widgetConfig.config = {
            widgetName: widgetName,
            params: params,
            yMin: yMinInput?.value || '',
            yMax: yMaxInput?.value || '',
            autoScale: autoScaleCheckbox?.checked !== false
        };
        widgetConfig.canId = params[0].canId;
    } else if (widgetType === 'numeric') {
        const paramElements = document.querySelectorAll('#numericParamContainer .param-config');
        const params = [];

        paramElements.forEach((element) => {
            const param = new ParamConfig(0);
            const paramData = param.getDataFromDOM(element);
            params.push(paramData);
        });

        if (params.length === 0) {
            alert('At least one parameter is required');
            return;
        }

        widgetConfig.config = {
            widgetName: widgetName,
            params: params
        };
        widgetConfig.canId = params[0].canId;
    }

    widgets.set(widgetId, widgetConfig);
    closeModal();
    renderWidgets();
    saveWidgetsToStorage();
    console.log('Widget saved:', widgetConfig);
}

// Рендеринг виджетов
export function renderWidgets() {
    const container = document.getElementById('widgetsContainer');
    if (!container) return;

    container.innerHTML = '';

    widgets.forEach((widget, widgetId) => {
        let widgetHTML = '';

        switch (widget.type) {
            case 'numeric':
                widgetHTML = numericWidget.render(widgetId, widget);
                break;
            case 'canChart2':
                widgetHTML = canChart2Widget.render(widgetId, widget);
                break;
        }

        const widgetElement = WidgetService.createWidgetElement(widgetId, widget);
        widgetElement.innerHTML += widgetHTML;

        // Добавляем обработчики
        const editBtn = widgetElement.querySelector('.widget-btn.edit');
        const removeBtn = widgetElement.querySelector('.widget-btn.remove');

        if (editBtn) editBtn.addEventListener('click', () => openModal(widgetId));
        if (removeBtn) removeBtn.addEventListener('click', () => removeWidget(widgetId));

        if (widget.size && widget.size > 1) {
            widgetElement.style.gridColumn = `span ${widget.size}`;
            const badge = widgetElement.querySelector('.widget-size-badge');
            if (badge) {
                badge.textContent = `${widget.size}×`;
            }
        }

        // Добавляем resize handle
        addResizeHandle(widgetElement);

        container.appendChild(widgetElement);

        setTimeout(() => {
            switch (widget.type) {
                case 'numeric':
                    numericWidget.initWidget(widgetId, widget);
                    break;
                case 'canChart2':
                    canChart2Widget.initChart(widgetId, widget);
                    break;
            }
        }, 100);
    });

    const widgetCountElem = document.getElementById('widgetCount');
    if (widgetCountElem) {
        widgetCountElem.textContent = widgets.size;
    }
}

// Закрытие модального окна
function closeModal() {
    const modal = document.getElementById('widgetModal');
    modal.style.display = 'none';
    currentEditWidgetId = null;
    resetModalConfig();
}

// Обновление счетчика фреймов
function updateFrameCount(widgetId, count) {
    const safeId = widgetId.replace(/[^a-zA-Z0-9-]/g, '-');
    const countElem = document.getElementById(`frame-count-${safeId}`);
    if (countElem) {
        countElem.textContent = count;
    }
}

function removeWidget(widgetId) {
    if (!confirm('Remove this widget?')) return;

    const widget = widgets.get(widgetId);
    if (widget) {
        switch (widget.type) {
            case 'canChart2':
                canChart2Widget.destroy(widgetId);
                break;
        }
    }

    widgets.delete(widgetId);
    renderWidgets();
    saveWidgetsToStorage();
}

// Загрузка виджетов из хранилища
function loadWidgetsFromStorage() {
    try {
        const saved = WidgetService.loadWidgetConfig();
        Object.entries(saved).forEach(([id, widget]) => {
            widgets.set(id, {
                ...widget,
                frameCount: 0
            });
        });
        console.log(`Loaded ${widgets.size} widgets from storage`);
    } catch (e) {
        console.error('Failed to load widgets:', e);
    }
}

// Сохранение виджетов в хранилище
function saveWidgetsToStorage() {
    WidgetService.saveWidgetConfig(widgets);
}

export function getWidgetsState() {
    const state = {};
    widgets.forEach((widget, id) => {
        const widgetCopy = { ...widget };

        delete widgetCopy.chart;
        delete widgetCopy.resizeHandler;

        if (widgetCopy.type === 'canChart2') {
            widgetCopy.data = {
                labels: [],
                datasets: {}
            };
        } else if (widgetCopy.type === 'numeric') {
            widgetCopy.data = {};
        }

        state[id] = widgetCopy;
    });
    return state;
}

export function setWidgetsState(state) {
    widgets.clear();

    Object.entries(state).forEach(([id, widget]) => {
        widgets.set(id, {
            ...widget,
            frameCount: 0
        });
    });

    renderWidgets();
}

// Экспортируем в глобальную область видимости
window.getWidgetsState = getWidgetsState;
window.setWidgetsState = setWidgetsState;