// Main widgets coordinator
import { canChartWidget } from './canChart.js';
import { canChart2Widget } from './canChart2.js';
import { generateWidgetId } from './utils.js';

export let widgets = new Map(); // Map<widgetId, WidgetConfig>
let currentEditWidgetId = null;

// Инициализация виджетов
export function initWidgets() {
    console.log('Widgets module initialized');
    setupModalEvents();
    loadWidgetsFromStorage();
    renderWidgets();
}

// Обработка CAN фреймов для виджетов
export function processCANFrameForWidgets(frame) {
    const canId = frame.id.toLowerCase();

    // Проходим по всем виджетам
    widgets.forEach((widget, widgetId) => {
        if (widget.canId === canId && widget.enabled) {
            // Обновляем счетчик фреймов
            widget.frameCount = (widget.frameCount || 0) + 1;

            // Обновляем отображение счетчика
            const countElem = document.getElementById(`frame-count-${widgetId}`);
            if (countElem) {
                countElem.textContent = widget.frameCount;
            }

            // Обрабатываем фрейм в зависимости от типа виджета
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

// Настройка событий модального окна
function setupModalEvents() {
    const modal = document.getElementById('widgetModal');
    const addBtn = document.getElementById('addWidgetBtn');
    const closeBtn = document.querySelector('.modal-close');
    const cancelBtn = document.getElementById('modalCancelBtn');
    const saveBtn = document.getElementById('modalSaveBtn');
    const widgetTypeSelect = document.getElementById('modalWidgetType');

    // Кнопка добавления виджета
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            openModal(); // Режим добавления
        });
    }

    // Закрытие модального окна
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // Изменение типа виджета
    if (widgetTypeSelect) {
        widgetTypeSelect.addEventListener('change', (e) => {
            const type = e.target.value;
            document.getElementById('singleChartConfig').style.display =
                type === 'canChart' ? 'block' : 'none';
            document.getElementById('dualChartConfig').style.display =
                type === 'canChart2' ? 'block' : 'none';
        });
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
    const modal = document.getElementById('widgetModal');
    const modalWidgetId = document.getElementById('modalWidgetId');
    const modalCanId = document.getElementById('modalCanId');
    const modalWidgetType = document.getElementById('modalWidgetType');

    currentEditWidgetId = widgetId;

    if (widgetId) {
        // Режим редактирования
        const widget = widgets.get(widgetId);
        if (widget) {
            // Заполняем поля формы
            modalWidgetId.value = widgetId;
            modalCanId.value = widget.canId;
            modalWidgetType.value = widget.type;

            // Загружаем конфигурацию в зависимости от типа
            if (widget.type === 'canChart' && widget.config) {
                document.querySelector('#singleChartConfig input').value = widget.config.dataSource || '';
                document.getElementById('singleChartColor').value = widget.config.color || '#ff6384';
            } else if (widget.type === 'canChart2' && widget.config) {
                const inputs = document.querySelectorAll('#dualChartConfig .byte-input input');
                if (inputs[0]) inputs[0].value = widget.config.dataSource1 || '';
                if (inputs[1]) inputs[1].value = widget.config.dataSource2 || '';
                document.getElementById('dualChartColor1').value = widget.config.color1 || '#ff6384';
                document.getElementById('dualChartColor2').value = widget.config.color2 || '#36a2eb';
            }
        }
    } else {
        // Режим добавления - генерируем случайный ID
        modalWidgetId.value = generateWidgetId();
        modalCanId.value = '';
        modalWidgetType.value = 'canChart';

        // Сбрасываем конфигурацию
        document.querySelector('#singleChartConfig input').value = '';
        document.getElementById('singleChartColor').value = '#ff6384';

        const dualInputs = document.querySelectorAll('#dualChartConfig .byte-input input');
        dualInputs.forEach(input => input.value = '');
        document.getElementById('dualChartColor1').value = '#ff6384';
        document.getElementById('dualChartColor2').value = '#36a2eb';
    }

    // Показываем/скрываем соответствующие секции конфигурации
    const type = modalWidgetType.value;
    document.getElementById('singleChartConfig').style.display =
        type === 'canChart' ? 'block' : 'none';
    document.getElementById('dualChartConfig').style.display =
        type === 'canChart2' ? 'block' : 'none';

    modal.style.display = 'block';
}

// Закрытие модального окна
function closeModal() {
    const modal = document.getElementById('widgetModal');
    modal.style.display = 'none';
    currentEditWidgetId = null;
    clearModal();
}

// Очистка модального окна
function clearModal() {
    document.getElementById('modalWidgetId').value = '';
    document.getElementById('modalCanId').value = '';
    document.getElementById('modalWidgetType').value = 'canChart';

    // Сбрасываем конфигурацию
    document.querySelector('#singleChartConfig input').value = '';
    document.getElementById('singleChartColor').value = '#ff6384';

    const dualInputs = document.querySelectorAll('#dualChartConfig .byte-input input');
    dualInputs.forEach(input => input.value = '');
    document.getElementById('dualChartColor1').value = '#ff6384';
    document.getElementById('dualChartColor2').value = '#36a2eb';

    // Показываем single chart конфиг по умолчанию
    document.getElementById('singleChartConfig').style.display = 'block';
    document.getElementById('dualChartConfig').style.display = 'none';
}

// Сохранение виджета
function saveWidget() {
    const widgetId = document.getElementById('modalWidgetId').value;
    const canId = document.getElementById('modalCanId').value;
    const type = document.getElementById('modalWidgetType').value;

    // Валидация CAN ID
    if (!canId.match(/^0x[0-9a-f]+$/i)) {
        alert('Invalid CAN ID format. Use hex like 0x200');
        return;
    }

    const widgetConfig = {
        widgetId: widgetId,
        canId: canId.toLowerCase(),
        type: type,
        enabled: true,
        frameCount: 0,
        createdAt: new Date().toISOString(),
        config: {}
    };

    // Получаем конфигурацию в зависимости от типа
    if (type === 'canChart') {
        const dataSource = document.querySelector('#singleChartConfig input').value;
        const color = document.getElementById('singleChartColor').value;
        widgetConfig.config = {
            dataSource: dataSource,
            color: color,
            label: 'Value'
        };
    } else if (type === 'canChart2') {
        const inputs = document.querySelectorAll('#dualChartConfig .byte-input input');
        const dataSource1 = inputs[0]?.value || '';
        const dataSource2 = inputs[1]?.value || '';
        const color1 = document.getElementById('dualChartColor1').value;
        const color2 = document.getElementById('dualChartColor2').value;
        widgetConfig.config = {
            dataSource1: dataSource1,
            dataSource2: dataSource2,
            color1: color1,
            color2: color2,
            label1: 'Value 1',
            label2: 'Value 2'
        };
    }

    // Сохраняем виджет
    widgets.set(widgetId, widgetConfig);

    // Закрываем модальное окно и рендерим виджеты
    closeModal();
    renderWidgets();
    saveWidgetsToStorage();

    console.log('Widget saved:', widgetConfig);
}

// Рендеринг виджетов
export function renderWidgets() {
    const container = document.getElementById('widgetsContainer');
    if (!container) {
        console.error('Widgets container not found');
        return;
    }

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
            default:
                console.error('Unknown widget type:', widget.type);
                return;
        }

        const widgetElement = document.createElement('div');
        widgetElement.className = 'widget';
        widgetElement.id = `widget-${widgetId.replace(/[^a-zA-Z0-9-]/g, '-')}`;
        widgetElement.innerHTML = widgetHTML;

        container.appendChild(widgetElement);

        // Добавляем обработчики событий
        const editBtn = widgetElement.querySelector('.widget-btn.edit');
        const removeBtn = widgetElement.querySelector('.widget-btn.remove');

        if (editBtn) {
            editBtn.addEventListener('click', () => openModal(widgetId));
        }

        if (removeBtn) {
            removeBtn.addEventListener('click', () => removeWidget(widgetId));
        }

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

// Удаление виджета
function removeWidget(widgetId) {
    if (confirm('Remove this widget?')) {
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
}

// Загрузка виджетов из localStorage
function loadWidgetsFromStorage() {
    try {
        const saved = localStorage.getItem('canWidgets');
        if (saved) {
            const savedWidgets = JSON.parse(saved);
            Object.entries(savedWidgets).forEach(([id, widget]) => {
                widgets.set(id, {
                    ...widget,
                    frameCount: 0 // Сбрасываем счетчик при загрузке
                });
            });
            console.log('Widgets loaded from storage:', widgets.size);
        }
    } catch (e) {
        console.error('Failed to load widgets from storage:', e);
    }
}

// Сохранение виджетов в localStorage
function saveWidgetsToStorage() {
    try {
        const widgetsObj = {};
        widgets.forEach((widget, id) => {
            // Не сохраняем временные данные
            const saveWidget = { ...widget };
            delete saveWidget.frameCount;
            delete saveWidget.chart;
            delete saveWidget.data;
            widgetsObj[id] = saveWidget;
        });
        localStorage.setItem('canWidgets', JSON.stringify(widgetsObj));
        console.log('Widgets saved to storage');
    } catch (e) {
        console.error('Failed to save widgets to storage:', e);
    }
}