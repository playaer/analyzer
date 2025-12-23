// Filters module
export let filters = new Set(); // Храним числовые CAN ID

// DOM элемент для ввода нового фильтра
let newFilterInput = null;

// Initialize filters module
export function initFilters() {
    console.log('Filters module initialized');
    newFilterInput = document.getElementById('newFilterId');

    // Назначаем обработчик для кнопки добавления фильтра
    const addFilterBtn = document.querySelector('#filtersContainer').parentElement.querySelector('.add-btn');
    if (addFilterBtn) {
        addFilterBtn.addEventListener('click', () => {
            if (newFilterInput && newFilterInput.value) {
                addFilter(newFilterInput.value.trim().toLowerCase());
            }
        });
    }
}

// Add a filter
export async function addFilter(canIdStr) {
    console.log('Adding filter:', canIdStr);

    if (!canIdStr.match(/^0x[0-9a-f]+$/i)) {
        alert('Invalid CAN ID format. Use hex like 0x200');
        return;
    }

    const canIdNum = parseInt(canIdStr, 16);
    console.log('CAN ID number:', canIdNum);

    // Проверяем, есть ли уже такой фильтр в локальном наборе
    if (filters.has(canIdNum)) {
        alert('Filter already exists');
        return;
    }

    try {
        console.log('Sending filter to server...');
        // Исправляем запрос: отправляем can_id как число, enabled как true
        const response = await fetch('/api/filters', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                can_id: canIdNum,  // Отправляем как число
                mask: 0xFFFFFFFF,
                enabled: true       // Отправляем как boolean
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error:', errorText);
            throw new Error(`Server error: ${response.status} ${errorText}`);
        }

        const savedFilter = await response.json();
        console.log('Filter saved to server:', savedFilter);

        // Очищаем поле ввода
        if (newFilterInput) {
            newFilterInput.value = '';
        }

        // Перезагружаем фильтры с сервера
        await updateFilterDisplay();

    } catch (error) {
        console.error('Error saving filter:', error);
        alert('Failed to save filter to server: ' + error.message);
    }
}

// Remove a filter
export async function removeFilter(canIdHex) {
    console.log('Removing filter:', canIdHex);

    try {
        // Удаляем с сервера по CAN ID (hex строке)
        const deleteResponse = await fetch(`/api/filters?can_id=${canIdHex}`, {
            method: 'DELETE'
        });

        if (!deleteResponse.ok) {
            const errorText = await deleteResponse.text();
            throw new Error(`Failed to delete filter: ${errorText}`);
        }

        // Перезагружаем фильтры
        await updateFilterDisplay();

    } catch (error) {
        console.error('Error removing filter:', error);
        alert('Failed to remove filter from server: ' + error.message);
    }
}

// Update filter display
export async function updateFilterDisplay() {
    const container = document.getElementById('filtersContainer');
    if (!container) {
        console.error('Filters container not found');
        return;
    }

    console.log('Updating filter display...');

    try {
        const response = await fetch('/api/filters');
        console.log('Filters response status:', response.status);

        if (response.ok) {
            const serverFilters = await response.json();
            console.log('Server filters loaded:', serverFilters);

            // Очищаем контейнер
            container.innerHTML = '';

            // Очищаем и обновляем локальный набор фильтров
            filters.clear();

            serverFilters.forEach(filter => {
                if (filter.enabled) {
                    const canIdNum = filter.can_id;
                    const canIdHex = '0x' + canIdNum.toString(16).toLowerCase();

                    // Добавляем в локальный набор
                    filters.add(canIdNum);

                    // Создаем элемент фильтра
                    const filterElement = document.createElement('div');
                    filterElement.className = 'filter-item';
                    filterElement.innerHTML = `
                        <div class="filter-header">
                            <span class="filter-can-id">${canIdHex}</span>
                            <button class="remove-btn" data-canid="${canIdHex}">×</button>
                        </div>
                        <div class="data-points">
                            Frames: <span id="count-${canIdHex}">0</span>
                        </div>
                    `;

                    // Добавляем обработчик удаления
                    const removeBtn = filterElement.querySelector('.remove-btn');
                    removeBtn.addEventListener('click', async () => {
                        await removeFilter(canIdHex);
                    });

                    container.appendChild(filterElement);
                }
            });

            // Обновляем счетчик
            const filterCount = document.getElementById('filterCount');
            if (filterCount) {
                filterCount.textContent = filters.size;
                console.log('Filter count updated:', filters.size);
            }
        } else {
            console.error('Failed to fetch filters, status:', response.status);
        }
    } catch (error) {
        console.error('Failed to load filters from server:', error);
    }
}

export function getFiltersState() {
    return Array.from(filters);
}

export function setFiltersState(state) {
    filters.clear();
    state.forEach(filter => filters.add(filter));
    updateFilterDisplay();
}

// Экспорт в глобальную область видимости
window.updateFilterDisplay = updateFilterDisplay;