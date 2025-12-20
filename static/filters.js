// Filters module
export let filters = new Set(); // Set<number> - храним числовые CAN ID

// Initialize filters module
export function initFilters() {
    console.log('Filters module initialized');
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

    if (filters.has(canIdNum)) {
        alert('Filter already exists');
        return;
    }

    try {
        // Save to server
        console.log('Saving filter to server...');
        const response = await fetch('/api/filters', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                can_id: canIdNum,
                mask: 0xFFFFFFFF,
                enabled: true
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error:', errorText);
            throw new Error(`Server error: ${response.status} ${errorText}`);
        }

        const savedFilter = await response.json();
        console.log('Filter saved to server:', savedFilter);

        // Reload filters from server
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
        // Delete from server using CAN ID
        const deleteResponse = await fetch(`/api/filters?can_id=${canIdHex}`, {
            method: 'DELETE'
        });

        if (!deleteResponse.ok) {
            throw new Error('Failed to delete filter from server');
        }

        // Reload filters from server
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

            // Update local filters set
            filters.clear();
            const enabledFilters = [];

            serverFilters.forEach(filter => {
                if (filter.enabled) {
                    filters.add(filter.can_id);
                    enabledFilters.push(filter);
                }
            });

            console.log('Enabled filters:', enabledFilters);
            console.log('Filters set size:', filters.size);

            // Clear and rebuild container
            container.innerHTML = '';

            enabledFilters.forEach(filter => {
                const canIdHex = '0x' + filter.can_id.toString(16).toLowerCase();
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

                // Add event listener to remove button
                const removeBtn = filterElement.querySelector('.remove-btn');
                removeBtn.addEventListener('click', async () => {
                    await removeFilter(canIdHex);
                });

                container.appendChild(filterElement);
            });

            const filterCount = document.getElementById('filterCount');
            if (filterCount) {
                filterCount.textContent = enabledFilters.length;
                console.log('Filter count updated:', enabledFilters.length);
            }

        } else {
            console.error('Failed to fetch filters, status:', response.status);
        }
    } catch (error) {
        console.error('Failed to load filters from server:', error);
    }
}