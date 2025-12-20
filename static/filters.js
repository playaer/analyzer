// Filters module
export let filters = new Set();

// Initialize filters module
export function initFilters() {
    // Additional initialization if needed
}

// Add a filter
export async function addFilter(canIdStr) {
    if (!canIdStr.match(/^0x[0-9a-f]+$/i)) {
        alert('Invalid CAN ID format. Use hex like 0x200');
        return;
    }

    if (filters.has(canIdStr)) {
        alert('Filter already exists');
        return;
    }

    try {
        // Convert hex string to number
        const canIdNum = parseInt(canIdStr, 16);

        // Save to server
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
            throw new Error(`Server error: ${errorText}`);
        }

        // Reload filters from server
        await updateFilterDisplay();

        console.log('Filter saved to server');
    } catch (error) {
        console.error('Error saving filter:', error);
        alert('Failed to save filter to server: ' + error.message);
    }
}

// Remove a filter
export async function removeFilter(canId) {
    try {
        // Delete from server using CAN ID
        const deleteResponse = await fetch(`/api/filters?can_id=${canId}`, {
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

    try {
        const response = await fetch('/api/filters');
        if (response.ok) {
            const serverFilters = await response.json();

            // Update local filters set
            filters.clear();
            serverFilters.forEach(filter => {
                if (filter.enabled) {
                    const canIdHex = '0x' + filter.can_id.toString(16).toLowerCase().padStart(3, '0');
                    filters.add(canIdHex);
                }
            });

            // Clear and rebuild container
            container.innerHTML = '';

            filters.forEach(canId => {
                const filterElement = document.createElement('div');
                filterElement.className = 'filter-item';
                filterElement.innerHTML = `
                    <div class="filter-header">
                        <span class="filter-can-id">${canId}</span>
                        <button class="remove-btn" data-canid="${canId}">×</button>
                    </div>
                    <div class="data-points">
                        Frames: <span id="count-${canId}">0</span>
                    </div>
                `;

                // Add event listener to remove button
                const removeBtn = filterElement.querySelector('.remove-btn');
                removeBtn.addEventListener('click', async () => {
                    await removeFilter(canId);
                });

                container.appendChild(filterElement);
            });

            document.getElementById('filterCount').textContent = filters.size;
        }
    } catch (error) {
        console.error('Failed to load filters from server:', error);
    }
}