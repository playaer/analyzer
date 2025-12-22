// Widget resize functionality
export class WidgetResize {
    constructor() {
        this.resizingWidget = null;
        this.startWidth = 0;
        this.startX = 0;
        this.gridSize = 350; // Minimum widget width
        this.minCols = 1;
        this.maxCols = 3;

        this.init();
    }

    init() {
        // Event delegation for resize handles
        document.addEventListener('mousedown', (e) => {
            const resizeHandle = e.target.closest('.widget-resize-handle');
            if (resizeHandle) {
                this.startResize(e, resizeHandle.closest('.widget'));
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.resizingWidget) {
                this.resize(e);
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.resizingWidget) {
                this.stopResize();
            }
        });

        // Touch events
        document.addEventListener('touchstart', (e) => {
            const resizeHandle = e.target.closest('.widget-resize-handle');
            if (resizeHandle) {
                e.preventDefault();
                this.startResize(e.touches[0], resizeHandle.closest('.widget'));
            }
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (this.resizingWidget && e.touches.length === 1) {
                e.preventDefault();
                this.resize(e.touches[0]);
            }
        }, { passive: false });

        document.addEventListener('touchend', () => {
            if (this.resizingWidget) {
                this.stopResize();
            }
        });
    }

    startResize(event, widget) {
        this.resizingWidget = widget;
        this.startX = event.clientX;

        // Get current span count
        const currentSpan = this.getCurrentSpan(widget);
        this.startWidth = currentSpan;

        // Add resizing class
        widget.classList.add('resizing');

        // Prevent text selection during resize
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';
    }

    resize(event) {
        if (!this.resizingWidget) return;

        const deltaX = event.clientX - this.startX;
        const gridUnits = Math.round(deltaX / this.gridSize);

        let newSpan = this.startWidth + gridUnits;
        newSpan = Math.max(this.minCols, Math.min(this.maxCols, newSpan));

        // Update widget size
        this.setWidgetSize(this.resizingWidget, newSpan);
    }

    stopResize() {
        if (!this.resizingWidget) return;

        // Remove resizing class
        this.resizingWidget.classList.remove('resizing');

        // Save widget size
        const widgetId = this.resizingWidget.id.replace('widget-', '');
        const currentSpan = this.getCurrentSpan(this.resizingWidget);
        this.saveWidgetSize(widgetId, currentSpan);

        // Reset styles
        document.body.style.userSelect = '';
        document.body.style.cursor = '';

        this.resizingWidget = null;
        this.startWidth = 0;
        this.startX = 0;
    }

    getCurrentSpan(widget) {
        const style = window.getComputedStyle(widget);
        const gridColumnEnd = style.gridColumnEnd;

        if (gridColumnEnd === 'auto') {
            return 1;
        }

        // Parse span value from grid-column-end
        const match = gridColumnEnd.match(/span (\d+)/);
        return match ? parseInt(match[1], 10) : 1;
    }

    setWidgetSize(widget, span) {
        // Remove all size classes
        widget.classList.remove('widget-size-2', 'widget-size-3');

        // Add appropriate size class
        if (span === 2) {
            widget.classList.add('widget-size-2');
        } else if (span === 3) {
            widget.classList.add('widget-size-3');
        }

        // Update badge if exists
        const badge = widget.querySelector('.widget-size-badge');
        if (badge) {
            badge.textContent = `${span}×`;
        }
    }

    saveWidgetSize(widgetId, span) {
        try {
            const sizes = JSON.parse(localStorage.getItem('widgetSizes') || '{}');
            sizes[widgetId] = span;
            localStorage.setItem('widgetSizes', JSON.stringify(sizes));
        } catch (e) {
            console.error('Failed to save widget size:', e);
        }
    }

    loadWidgetSize(widgetId) {
        try {
            const sizes = JSON.parse(localStorage.getItem('widgetSizes') || '{}');
            return sizes[widgetId] || 1;
        } catch (e) {
            console.error('Failed to load widget size:', e);
            return 1;
        }
    }

    applySavedSize(widget) {
        const widgetId = widget.id.replace('widget-', '');
        const savedSize = this.loadWidgetSize(widgetId);
        this.setWidgetSize(widget, savedSize);
    }
}