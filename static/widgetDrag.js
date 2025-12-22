// Widget drag and drop functionality
export class WidgetDrag {
    constructor(containerSelector = '#widgetsContainer') {
        this.container = document.querySelector(containerSelector);
        this.widgets = [];
        this.draggedWidget = null;
        this.dragOffset = { x: 0, y: 0 };
        this.isDragging = false;

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
            if (dragHandle) {
                this.startDrag(e, dragHandle.closest('.widget'));
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isDragging && this.draggedWidget) {
                this.drag(e);
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.stopDrag();
            }
        });

        // Touch events for mobile
        this.container.addEventListener('touchstart', (e) => {
            const dragHandle = e.target.closest('.widget-drag-handle');
            if (dragHandle) {
                e.preventDefault();
                this.startDrag(e.touches[0], dragHandle.closest('.widget'));
            }
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (this.isDragging && this.draggedWidget && e.touches.length === 1) {
                e.preventDefault();
                this.drag(e.touches[0]);
            }
        }, { passive: false });

        document.addEventListener('touchend', () => {
            if (this.isDragging) {
                this.stopDrag();
            }
        });
    }

    startDrag(event, widget) {
        this.isDragging = true;
        this.draggedWidget = widget;

        // Calculate offset from mouse to widget top-left corner
        const rect = widget.getBoundingClientRect();
        this.dragOffset.x = event.clientX - rect.left;
        this.dragOffset.y = event.clientY - rect.top;

        // Add dragging class
        widget.classList.add('dragging');

        // Make widget positioned absolute during drag
        const containerRect = this.container.getBoundingClientRect();
        const widgetRect = widget.getBoundingClientRect();

        widget.style.position = 'fixed';
        widget.style.left = `${widgetRect.left}px`;
        widget.style.top = `${widgetRect.top}px`;
        widget.style.width = `${widgetRect.width}px`;
        widget.style.height = `${widgetRect.height}px`;
        widget.style.zIndex = '1000';

        // Create placeholder
        this.createPlaceholder(widget);
    }

    drag(event) {
        if (!this.draggedWidget) return;

        // Update widget position
        this.draggedWidget.style.left = `${event.clientX - this.dragOffset.x}px`;
        this.draggedWidget.style.top = `${event.clientY - this.dragOffset.y}px`;

        // Find potential drop position
        this.updateDropPosition(event);
    }

    stopDrag() {
        if (!this.draggedWidget) return;

        // Remove dragging class
        this.draggedWidget.classList.remove('dragging');

        // Reset styles
        this.draggedWidget.style.position = '';
        this.draggedWidget.style.left = '';
        this.draggedWidget.style.top = '';
        this.draggedWidget.style.width = '';
        this.draggedWidget.style.height = '';
        this.draggedWidget.style.zIndex = '';

        // Remove placeholder and reinsert widget
        this.removePlaceholder();

        // Save new order
        this.saveWidgetOrder();

        // Reset state
        this.draggedWidget = null;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
    }

    createPlaceholder(widget) {
        this.placeholder = document.createElement('div');
        this.placeholder.className = 'widget widget-placeholder';
        this.placeholder.style.gridColumnEnd = widget.style.gridColumnEnd;
        this.placeholder.style.gridRowEnd = widget.style.gridRowEnd;

        // Insert placeholder at widget's position
        widget.parentNode.insertBefore(this.placeholder, widget);
    }

    removePlaceholder() {
        if (this.placeholder && this.placeholder.parentNode) {
            this.placeholder.parentNode.removeChild(this.placeholder);
            this.placeholder = null;
        }
    }

    updateDropPosition(event) {
        // Simple implementation - you might want to use a more sophisticated
        // grid snapping algorithm based on your specific grid layout
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

        // Move placeholder before closest widget
        if (closestWidget && this.placeholder) {
            this.container.insertBefore(this.placeholder, closestWidget);
        }
    }

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
}