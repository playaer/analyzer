// Компонент для выбора цвета линии
export function createColorPicker(initialColor = '#ff6384', label = 'Line Color:') {
    const container = document.createElement('div');
    container.className = 'color-picker-container';

    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    container.appendChild(labelElement);

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = initialColor;
    colorInput.className = 'color-input';

    const preview = document.createElement('div');
    preview.className = 'color-preview';
    preview.style.backgroundColor = initialColor;
    preview.style.width = '30px';
    preview.style.height = '20px';
    preview.style.display = 'inline-block';
    preview.style.marginLeft = '10px';
    preview.style.borderRadius = '3px';
    preview.style.border = '1px solid #ccc';

    colorInput.addEventListener('input', (e) => {
        preview.style.backgroundColor = e.target.value;
    });

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '10px';
    wrapper.appendChild(colorInput);
    wrapper.appendChild(preview);

    container.appendChild(wrapper);

    return {
        container,
        getColor: () => colorInput.value,
        setColor: (color) => {
            colorInput.value = color;
            preview.style.backgroundColor = color;
        }
    };
}

export function getColorValue(colorPickerContainer) {
    const input = colorPickerContainer.querySelector('.color-input');
    return input ? input.value : '#ff6384';
}