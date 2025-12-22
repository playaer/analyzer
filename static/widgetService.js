// Widget service for common operations
import { generateWidgetId } from './utils.js';

export class WidgetService {
    static generateUniqueWidgetId() {
        return generateWidgetId();
    }

    static getWidgetSizeClass(span) {
        switch (span) {
            case 2: return 'widget-size-2';
            case 3: return 'widget-size-3';
            default: return '';
        }
    }

    static createWidgetElement(widgetId, widget) {
        const safeId = widgetId.replace(/[^a-zA-Z0-9-]/g, '-');
        const element = document.createElement('div');

        element.className = 'widget';
        element.id = `widget-${safeId}`;

        // Применяем размер если есть
        if (widget.size && widget.size > 1) {
            element.classList.add(`widget-size-${widget.size}`);
        }

        // Добавляем drag handle
        element.innerHTML = `
        <div class="widget-drag-handle">↔</div>
    `;

        return element;
    }

    static updateWidgetBadge(widgetElement, widget) {
        const header = widgetElement.querySelector('.widget-header');
        if (header) {
            let badge = header.querySelector('.widget-size-badge');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'widget-size-badge';
                header.querySelector('.widget-title').after(badge);
            }
            badge.textContent = `${widget.size || 1}×`;
        }
    }

    static saveWidgetConfig(widgets) {
        try {
            const config = {};
            widgets.forEach((widget, id) => {
                // Clone widget without circular references
                const saveWidget = { ...widget };
                delete saveWidget.chart;
                delete saveWidget.data;
                config[id] = saveWidget;
            });
            localStorage.setItem('canWidgets', JSON.stringify(config));
            return true;
        } catch (e) {
            console.error('Failed to save widget config:', e);
            return false;
        }
    }

    static loadWidgetConfig() {
        try {
            const saved = localStorage.getItem('canWidgets');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            console.error('Failed to load widget config:', e);
            return {};
        }
    }
}