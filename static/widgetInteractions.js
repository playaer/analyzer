// Widget drag and resize functionality
export class WidgetInteractions {
    constructor(containerSelector = '#widgetsContainer') {
        this.container = document.querySelector(containerSelector);
        this.widgets = [];
        this.draggedWidget = null;
        this.dragOffset = { x: 0, y: 0 };
        this.isDragging = false;
        this.isResizing = false;
        this.resizeData = null;

        if (this.container) {
            this.init();
        }
    }

    init() {
        this.setupEventListeners();
        this.loadWidgetPositions();
    }

    setupEventListeners() {
        // Use event delegation for drag handles
        this.container.addEventListener('mousedown', (e) => {
            const dragHandle = e.target.closest('.widget-drag-handle');
            const resizeHandle = e.target.closest('.widget-resize-handle');

            if (dragHandle) {
                this.startDrag(e, dragHandle.closest('.widget'));
            } else if (resizeHandle) {
                this.startResize(e, resizeHandle.closest('.widget'));
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isDragging && this.draggedWidget) {
                this.drag(e);
            } else if (this.isResizing && this.resizeData) {
                this.resize(e);
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.stopDrag();
            } else if (this.isResizing) {
                this.stopResize();
            }
        });

        // Touch events for mobile
        this.container.addEventListener('touchstart', (e) => {
            const dragHandle = e.target.closest('.widget-drag-handle');
            const resizeHandle = e.target.closest('.widget-resize-handle');

            if (dragHandle) {
                e.preventDefault();
                this.startDrag(e.touches[0], dragHandle.closest('.widget'));
            } else if (resizeHandle) {
                e.preventDefault();
                this.startResize(e.touches[0], resizeHandle.closest('.widget'));
            }
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (this.isDragging && this.draggedWidget && e.touches.length === 1) {
                e.preventDefault();
                this.drag(e.touches[0]);
            } else if (this.isResizing && this.resizeData && e.touches.length === 1) {
                e.preventDefault();
                this.resize(e.touches[0]);
            }
        }, { passive: false });

        document.addEventListener('touchend', () => {
            if (this.isDragging) {
                this.stopDrag();
            } else if (this.isResizing) {
                this.stopResize();
            }
        });
    }

    // ==================== DRAG FUNCTIONALITY ====================

    startDrag(event, widget) {
        this.isDragging = true;
        this.draggedWidget = widget;

        const rect = widget.getBoundingClientRect();
        this.dragOffset.x = event.clientX - rect.left;
        this.dragOffset.y = event.clientY - rect.top;

        widget.classList.add('dragging');

        const containerRect = this.container.getBoundingClientRect();
        const widgetRect = widget.getBoundingClientRect();

        widget.style.position = 'fixed';
        widget.style.left = `${widgetRect.left}px`;
        widget.style.top = `${widgetRect.top}px`;
        widget.style.width = `${widgetRect.width}px`;
        widget.style.height = `${widgetRect.height}px`;
        widget.style.zIndex = '1000';

        this.createPlaceholder(widget);
    }

    drag(event) {
        if (!this.draggedWidget) return;

        this.draggedWidget.style.left = `${event.clientX - this.dragOffset.x}px`;
        this.draggedWidget.style.top = `${event.clientY - this.dragOffset.y}px`;

        this.updateDropPosition(event);
    }

    stopDrag() {
        if (!this.draggedWidget) return;

        this.draggedWidget.classList.remove('dragging');

        this.draggedWidget.style.position = '';
        this.draggedWidget.style.left = '';
        this.draggedWidget.style.top = '';
        this.draggedWidget.style.width = '';
        this.draggedWidget.style.height = '';
        this.draggedWidget.style.zIndex = '';

        this.removePlaceholder();
        this.saveWidgetOrder();

        this.draggedWidget = null;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
    }

    createPlaceholder(widget) {
        this.placeholder = document.createElement('div');
        this.placeholder.className = 'widget widget-placeholder';
        this.placeholder.style.gridColumnEnd = widget.style.gridColumnEnd;
        this.placeholder.style.gridRowEnd = widget.style.gridRowEnd;

        widget.parentNode.insertBefore(this.placeholder, widget);
    }

    removePlaceholder() {
        if (this.placeholder && this.placeholder.parentNode) {
            this.placeholder.parentNode.removeChild(this.placeholder);
            this.placeholder = null;
        }
    }

    updateDropPosition(event) {
        const widgets = Array.from(this.container.querySelectorAll('.widget:not(.dragging):not(.widget-placeholder)'));

        let closestWidget = null;
        let minDistance = Infinity;

        widgets.forEach(widget => {
            const rect = widget.getBoundingClientRect();
            const distance = Math.sqrt(
                Math.pow(event.clientX - (rect.left + rect.width / 2), 2) +
                Math.pow(event.clientY - (rect.top + rect.height / 2), 2)
            );

            if (distance < minDistance) {
                minDistance = distance;
                closestWidget = widget;
            }
        });

        if (closestWidget && this.placeholder) {
            this.container.insertBefore(this.placeholder, closestWidget);
        }
    }

    // ==================== RESIZE FUNCTIONALITY ====================

    startResize(event, widget) {
        this.isResizing = true;
        this.resizeData = {
            widget: widget,
            startX: event.clientX,
            startWidth: widget.offsetWidth
        };

        const resizeHandle = widget.querySelector('.widget-resize-handle');
        if (resizeHandle) {
            resizeHandle.style.opacity = '1';
        }

        widget.classList.add('resizing');
    }

    resize(event) {
        if (!this.resizeData) return;

        const { widget, startX, startWidth } = this.resizeData;
        const deltaX = event.clientX - startX;
        const newWidth = startWidth + deltaX;

        const gridSize = 350;
        const maxSize = 3;
        const size = Math.max(1, Math.min(maxSize, Math.round(newWidth / gridSize)));
        const finalWidth = size * gridSize;

        widget.style.gridColumn = `span ${size}`;

        const badge = widget.querySelector('.widget-size-badge');
        if (badge) {
            badge.textContent = `${size}×`;
        }

        if (typeof this.onResizeCallback === 'function') {
            this.onResizeCallback(size, widget);
        }
    }

    stopResize() {
        if (!this.resizeData) return;

        const resizeHandle = this.resizeData.widget.querySelector('.widget-resize-handle');
        if (resizeHandle) {
            resizeHandle.style.opacity = '0.7';
        }

        this.resizeData.widget.classList.remove('resizing');

        this.isResizing = false;
        this.resizeData = null;
    }

    // ==================== COMMON METHODS ====================

    saveWidgetOrder() {
        const widgetIds = Array.from(this.container.querySelectorAll('.widget:not(.widget-placeholder)'))
            .map(widget => widget.id.replace('widget-', ''));

        localStorage.setItem('widgetOrder', JSON.stringify(widgetIds));
    }

    loadWidgetPositions() {
        try {
            const savedOrder = localStorage.getItem('widgetOrder');
            if (savedOrder) {
                const widgetIds = JSON.parse(savedOrder);
                this.reorderWidgets(widgetIds);
            }
        } catch (e) {
            console.error('Failed to load widget order:', e);
        }
    }

    reorderWidgets(widgetIds) {
        widgetIds.forEach(widgetId => {
            const widget = document.getElementById(`widget-${widgetId}`);
            if (widget && widget.parentNode === this.container) {
                this.container.appendChild(widget);
            }
        });
    }

    onResize(callback) {
        this.onResizeCallback = callback;
    }

    destroy() {
        if (this.placeholder && this.placeholder.parentNode) {
            this.placeholder.parentNode.removeChild(this.placeholder);
        }

        document.removeEventListener('mousemove', this.drag);
        document.removeEventListener('mouseup', this.stopDrag);
        document.removeEventListener('touchmove', this.drag);
        document.removeEventListener('touchend', this.stopDrag);
    }
}

// Function to add resize handle to a widget
export function addResizeHandle(widgetElement) {
    if (!widgetElement) return;

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'widget-resize-handle';
    resizeHandle.innerHTML = '↘';

    resizeHandle.style.position = 'absolute';
    resizeHandle.style.bottom = '5px';
    resizeHandle.style.right = '5px';
    resizeHandle.style.width = '15px';
    resizeHandle.style.height = '15px';
    resizeHandle.style.cursor = 'se-resize';
    resizeHandle.style.background = '#667eea';
    resizeHandle.style.color = 'white';
    resizeHandle.style.fontSize = '10px';
    resizeHandle.style.textAlign = 'center';
    resizeHandle.style.lineHeight = '15px';
    resizeHandle.style.borderRadius = '50%';
    resizeHandle.style.opacity = '0.7';
    resizeHandle.style.transition = 'opacity 0.2s';
    resizeHandle.style.zIndex = '10';

    widgetElement.appendChild(resizeHandle);
    return resizeHandle;
}