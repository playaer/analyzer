// Функция для изменения размера виджетов
export function initWidgetResize(widgetElement, onResize) {
    if (!widgetElement) return;

    // Создаем элемент для изменения размера
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'widget-resize-handle';
    resizeHandle.innerHTML = '↘';

    // Добавляем стили
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

    // Добавляем в виджет
    widgetElement.appendChild(resizeHandle);

    // Обработчики событий
    let isResizing = false;
    let startX, startWidth;
    const gridSize = 350; // минимальная ширина из README
    const maxSize = 3; // максимальный множитель

    resizeHandle.addEventListener('mouseenter', () => {
        resizeHandle.style.opacity = '1';
    });

    resizeHandle.addEventListener('mouseleave', () => {
        if (!isResizing) {
            resizeHandle.style.opacity = '0.7';
        }
    });

    resizeHandle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isResizing = true;
        startX = e.clientX;
        startWidth = widgetElement.offsetWidth;

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        widgetElement.classList.add('resizing');
    });

    function onMouseMove(e) {
        if (!isResizing) return;

        const deltaX = e.clientX - startX;
        const newWidth = startWidth + deltaX;

        // Привязка к сетке: x1, x2, x3 (350px, 700px, 1050px)
        const size = Math.max(1, Math.min(maxSize, Math.round(newWidth / gridSize)));
        const finalWidth = size * gridSize;

        // Обновляем размер
        widgetElement.style.gridColumn = `span ${size}`;

        // Обновляем бейдж размера
        const badge = widgetElement.querySelector('.widget-size-badge');
        if (badge) {
            badge.textContent = `${size}×`;
        }

        // Вызываем callback если нужно
        if (onResize) {
            onResize(size);
        }
    }

    function onMouseUp() {
        if (!isResizing) return;

        isResizing = false;
        resizeHandle.style.opacity = '0.7';
        widgetElement.classList.remove('resizing');

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }

    // Touch события для мобильных устройств
    resizeHandle.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (e.touches.length === 1) {
            isResizing = true;
            startX = e.touches[0].clientX;
            startWidth = widgetElement.offsetWidth;

            document.addEventListener('touchmove', onTouchMove);
            document.addEventListener('touchend', onTouchEnd);

            widgetElement.classList.add('resizing');
        }
    });

    function onTouchMove(e) {
        if (!isResizing || e.touches.length !== 1) return;

        const deltaX = e.touches[0].clientX - startX;
        const newWidth = startWidth + deltaX;
        const size = Math.max(1, Math.min(maxSize, Math.round(newWidth / gridSize)));

        widgetElement.style.gridColumn = `span ${size}`;

        const badge = widgetElement.querySelector('.widget-size-badge');
        if (badge) {
            badge.textContent = `${size}×`;
        }

        if (onResize) {
            onResize(size);
        }
    }

    function onTouchEnd() {
        if (!isResizing) return;

        isResizing = false;
        resizeHandle.style.opacity = '0.7';
        widgetElement.classList.remove('resizing');

        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);
    }

    return {
        destroy: () => {
            if (resizeHandle.parentNode) {
                resizeHandle.parentNode.removeChild(resizeHandle);
            }
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
        }
    };
}