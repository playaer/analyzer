// Main widgets coordinator
import { canChartWidget } from './canChart.js';
import { canChart2Widget } from './canChart2.js';
import { WidgetService } from './widgetService.js';
import { WidgetDrag } from './widgetDrag.js';
import { WidgetResize } from './widgetResize.js';
import { ParamConfig } from './components/paramConfig.js';

export let widgets = new Map();
let widgetDrag = null;
let widgetResize = null;
let currentEditWidgetId = null;

// Инициализация
export function initWidgets() {
    console.log('Widgets module initialized');
    loadWidgetsFromStorage();
    renderWidgets();
    setupModalEvents();

    // Инициализируем drag & drop и resize
    widgetDrag = new WidgetDrag();
    widgetResize = new WidgetResize();
}

// Обработка CAN фреймов
export function processCANFrameForWidgets(frame) {
    const canId = frame.id.toLowerCase();

    widgets.forEach((widget, widgetId) => {
        if (widget.enabled) {
            let shouldProcess = false;

            // Проверяем, слушает ли виджет этот CAN ID
            if (widget.type === 'canChart') {
                shouldProcess = widget.canId === canId;
            } else if (widget.type === 'canChart2' && widget.config?.params) {
                // Multi-chart может слушать несколько CAN ID через разные параметры
                shouldProcess = widget.config.params.some(param =>
                    param.canId.toLowerCase() === canId
                );
            }

            if (shouldProcess) {
                widget.frameCount = (widget.frameCount || 0) + 1;
                updateFrameCount(widgetId, widget.frameCount);

                switch (widget.type) {
                    case 'canChart':
                        canChartWidget.processFrame(widgetId, frame, widget);
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
    const closeBtn = document.querySelector('.modal-close');
    const cancelBtn = document.getElementById('modalCancelBtn');
    const saveBtn = document.getElementById('modalSaveBtn');
    const widgetTypeSelect = document.getElementById('modalWidgetType');
    const addParamBtn = document.getElementById('addParamBtn');

    // Кнопка добавления виджета
    if (addBtn) {
        addBtn.addEventListener('click', () => openModal());
    }

    // Закрытие модального окна
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // Изменение типа виджета
    if (widgetTypeSelect) {
        widgetTypeSelect.addEventListener('change', (e) => {
            const type = e.target.value;
            updateModalForType(type);
        });
    }

    // Добавление параметра
    if (addParamBtn) {
        addParamBtn.addEventListener('click', () => addParamComponent());
    }

    // Сохранение виджета
    if (saveBtn) saveBtn.addEventListener('click', saveWidget);

    // Закрытие по клику вне окна
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
        // Режим редактирования
        modalTitle.textContent = 'Edit Widget';
        const widget = widgets.get(widgetId);
        if (widget) {
            modalWidgetId.value = widgetId;
            modalWidgetName.value = widget.config?.widgetName || widget.canId;
            modalWidgetType.value = widget.type;

            // Загружаем конфигурацию
            loadWidgetConfig(widget);
        }
    } else {
        // Режим добавления
        modalTitle.textContent = 'Add New Widget';
        modalWidgetId.value = WidgetService.generateUniqueWidgetId();
        modalWidgetName.value = '';
        modalWidgetType.value = 'canChart';

        // Сбрасываем конфигурацию
        resetModalConfig();
    }

    // Показываем соответствующую конфигурацию
    updateModalForType(modalWidgetType.value);
    modal.style.display = 'block';
}

// Загрузка конфигурации виджета в модальное окно
function loadWidgetConfig(widget) {
    const paramContainer = document.getElementById('paramContainer');
    const singleParamContainer = document.getElementById('singleChartParamContainer');

    // Очищаем контейнеры
    if (paramContainer) paramContainer.innerHTML = '';
    if (singleParamContainer) singleParamContainer.innerHTML = '';

    if (widget.type === 'canChart2' && widget.config?.params) {
        // Загружаем параметры для multi-chart
        widget.config.params.forEach((paramData, index) => {
            const param = new ParamConfig(index, paramData);
            const paramElement = createParamElement(param);
            if (paramContainer) {
                paramContainer.appendChild(paramElement);
            }
        });

        // Загружаем настройки графика
        const yMinInput = document.getElementById('chartYMin');
        const yMaxInput = document.getElementById('chartYMax');
        const autoScaleCheckbox = document.getElementById('chartAutoScale');

        if (yMinInput) yMinInput.value = widget.config.yMin || '';
        if (yMaxInput) yMaxInput.value = widget.config.yMax || '';
        if (autoScaleCheckbox) {
            autoScaleCheckbox.checked = widget.config.autoScale !== false;
        }
    } else if (widget.type === 'canChart' && widget.config) {
        // Загружаем параметр для single-chart
        const param = new ParamConfig(0, {
            name: widget.config.label || 'Value',
            canId: widget.canId,
            byteIndex: 0,
            size: '8',
            color: widget.config.color || '#ff6384'
        });
        const paramElement = createParamElement(param);
        if (singleParamContainer) {
            singleParamContainer.appendChild(paramElement);
        }
    }
}

// Создание элемента параметра
function createParamElement(param) {
    const template = document.createElement('template');
    template.innerHTML = param.render();
    const element = template.content.firstElementChild;

    // Добавляем обработчик удаления
    const removeBtn = element.querySelector('.remove-param-btn');
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            element.remove();
        });
    }

    return element;
}

// Добавление нового параметра
function addParamComponent() {
    const paramContainer = document.getElementById('paramContainer');
    if (!paramContainer) return;

    // Ограничиваем до 4 параметров
    const currentParams = paramContainer.querySelectorAll('.param-config');
    if (currentParams.length >= 4) {
        alert('Maximum 4 parameters allowed');
        return;
    }

    const index = currentParams.length;
    const param = new ParamConfig(index);
    const paramElement = createParamElement(param);
    paramContainer.appendChild(paramElement);
}

// Обновление модального окна в зависимости от типа
function updateModalForType(type) {
    const singleConfig = document.getElementById('singleChartConfig');
    const multiConfig = document.getElementById('multiChartConfig');
    const addParamBtn = document.getElementById('addParamBtn');

    if (type === 'canChart') {
        singleConfig.style.display = 'block';
        multiConfig.style.display = 'none';
    } else {
        singleConfig.style.display = 'none';
        multiConfig.style.display = 'block';

        // Инициализируем параметры для multi-chart если их нет
        const paramContainer = document.getElementById('paramContainer');
        if (paramContainer && paramContainer.children.length === 0) {
            // Добавляем первый параметр по умолчанию
            addParamComponent();
        }
    }
}

// Сброс конфигурации модального окна
function resetModalConfig() {
    const paramContainer = document.getElementById('paramContainer');
    const singleParamContainer = document.getElementById('singleChartParamContainer');
    const yMinInput = document.getElementById('chartYMin');
    const yMaxInput = document.getElementById('chartYMax');
    const autoScaleCheckbox = document.getElementById('chartAutoScale');

    if (paramContainer) paramContainer.innerHTML = '';
    if (singleParamContainer) singleParamContainer.innerHTML = '';
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
        widgetName: widgetName,
        enabled: true,
        frameCount: 0,
        size: 1, // Default size
        createdAt: new Date().toISOString(),
        config: {}
    };

    // Собираем конфигурацию в зависимости от типа
    if (widgetType === 'canChart') {
        const paramElement = document.querySelector('#singleChartParamContainer .param-config');
        if (paramElement) {
            const param = new ParamConfig(0);
            const paramData = param.getDataFromDOM(paramElement);

            widgetConfig.canId = paramData.canId;
            widgetConfig.config = {
                label: paramData.name,
                color: paramData.color,
                byteIndex: paramData.byteIndex,
                size: paramData.size
            };
        }
    } else if (widgetType === 'canChart2') {
        // Собираем параметры
        const paramElements = document.querySelectorAll('#paramContainer .param-config');
        const params = [];

        paramElements.forEach((element, index) => {
            const param = new ParamConfig(index);
            params.push(param.getDataFromDOM(element));
        });

        if (params.length === 0) {
            alert('At least one parameter is required');
            return;
        }

        // Собираем настройки графика
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

        // Для multi-chart используем первый CAN ID для обратной совместимости
        widgetConfig.canId = params[0].canId;
    }

    // Сохраняем виджет
    widgets.set(widgetId, widgetConfig);

    // Закрываем модальное окно и обновляем интерфейс
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

        // Рендерим в зависимости от типа
        switch (widget.type) {
            case 'canChart':
                widgetHTML = canChartWidget.render(widgetId, widget);
                break;
            case 'canChart2':
                widgetHTML = canChart2Widget.render(widgetId, widget);
                break;
        }

        // Создаем элемент виджета
        const widgetElement = WidgetService.createWidgetElement(widgetId, widget);
        widgetElement.innerHTML += widgetHTML;

        // Добавляем обработчики
        const editBtn = widgetElement.querySelector('.widget-btn.edit');
        const removeBtn = widgetElement.querySelector('.widget-btn.remove');

        if (editBtn) editBtn.addEventListener('click', () => openModal(widgetId));
        if (removeBtn) removeBtn.addEventListener('click', () => removeWidget(widgetId));

        // Применяем сохраненный размер
        if (widgetResize) {
            widgetResize.applySavedSize(widgetElement);
        }

        // Обновляем бейдж размера
        WidgetService.updateWidgetBadge(widgetElement, widget);

        container.appendChild(widgetElement);

        // Инициализируем график
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

    // Обновляем счетчик виджетов
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

// Удаление виджета
function removeWidget(widgetId) {
    if (!confirm('Remove this widget?')) return;

    const widget = widgets.get(widgetId);
    if (widget) {
        // Очищаем ресурсы графика
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

// Загрузка виджетов из хранилища
function loadWidgetsFromStorage() {
    try {
        const saved = WidgetService.loadWidgetConfig();
        Object.entries(saved).forEach(([id, widget]) => {
            widgets.set(id, {
                ...widget,
                frameCount: 0 // Сбрасываем счетчик
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