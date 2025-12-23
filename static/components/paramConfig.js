// Компонент конфигурации параметра для виджетов с оптимизированным интерфейсом

// Палитра цветов по умолчанию
const COLOR_PALETTE = [
    '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
    '#FF8000', '#8000FF', '#0080FF', '#FF0080', '#80FF00', '#008000', '#800000',
    '#808080', '#C0C0C0', '#FFFFFF'
];

export class ParamConfig {
    constructor(paramIndex, initialConfig = {}) {
        this.paramIndex = paramIndex;
        this.config = {
            name: initialConfig.name || `Param ${paramIndex + 1}`,
            canId: initialConfig.canId || '0x200',
            byteIndex: initialConfig.byteIndex || 0,
            size: initialConfig.size || '8',
            color: initialConfig.color || (initialConfig.type === 'numeric' ? '#000000' : '#ff6384'),
            multiplier: initialConfig.multiplier || 1,
            adder: initialConfig.adder || 0,
            byte0Filter: initialConfig.byte0Filter || '',
            byte1Filter: initialConfig.byte1Filter || ''
        };
    }

    // Генерация HTML для конфигурации параметра
    render(widgetType = 'canChart2') {
        const defaultColor = widgetType === 'numeric' ? '#000000' : '#ff6384';
        const selectedColor = this.config.color || defaultColor;

        return `
            <div class="param-config" data-param-index="${this.paramIndex}">
                <div class="param-header">
                    <strong>Parameter ${this.paramIndex + 1}</strong>
                    <button type="button" class="remove-param-btn">×</button>
                </div>
                
                <div class="form-group">
                    <label for="param-name-${this.paramIndex}">Name:</label>
                    <input type="text" id="param-name-${this.paramIndex}" class="param-name" 
                           value="${this.config.name}" placeholder="Parameter name">
                </div>
                
                <!-- CAN ID и фильтры по байтам в одной строке -->
                <div class="grid-3">
                    <div class="form-group">
                        <label for="param-canid-${this.paramIndex}">CAN ID:</label>
                        <input type="text" id="param-canid-${this.paramIndex}" class="param-canid" 
                               value="${this.config.canId}" placeholder="0x200">
                    </div>
                    
                    <div class="form-group">
                        <label for="param-byte0-${this.paramIndex}">Byte 0:</label>
                        <input type="text" id="param-byte0-${this.paramIndex}" class="param-byte0" 
                               value="${this.config.byte0Filter}" placeholder="00" maxlength="2">
                        <small style="color: #666; font-size: 0.7em;">Hex (00-FF)</small>
                    </div>
                    
                    <div class="form-group">
                        <label for="param-byte1-${this.paramIndex}">Byte 1:</label>
                        <input type="text" id="param-byte1-${this.paramIndex}" class="param-byte1" 
                               value="${this.config.byte1Filter}" placeholder="00" maxlength="2">
                        <small style="color: #666; font-size: 0.7em;">Hex (00-FF)</small>
                    </div>
                </div>
                
                <div class="grid-2">
                    <div class="form-group">
                        <label for="param-byte-${this.paramIndex}">Byte Index:</label>
                        <input type="number" id="param-byte-${this.paramIndex}" class="param-byte" 
                               min="0" max="7" value="${this.config.byteIndex}">
                        <small style="color: #666; font-size: 0.7em;">0-7</small>
                    </div>
                    
                    <div class="form-group">
                        <label for="param-size-${this.paramIndex}">Data Size:</label>
                        <select id="param-size-${this.paramIndex}" class="param-size">
                            <option value="8" ${this.config.size === '8' ? 'selected' : ''}>8-bit signed</option>
                            <option value="8u" ${this.config.size === '8u' ? 'selected' : ''}>8-bit unsigned</option>
                            <option value="16" ${this.config.size === '16' ? 'selected' : ''}>16-bit signed</option>
                            <option value="16u" ${this.config.size === '16u' ? 'selected' : ''}>16-bit unsigned</option>
                            <option value="32" ${this.config.size === '32' ? 'selected' : ''}>32-bit signed</option>
                            <option value="32u" ${this.config.size === '32u' ? 'selected' : ''}>32-bit unsigned</option>
                            <option value="32f" ${this.config.size === '32f' ? 'selected' : ''}>32-bit float</option>
                        </select>
                    </div>
                </div>
                
                <!-- Цвет в отдельной строке -->
                <div class="form-group">
                    <label>Color:</label>
                    <div class="color-palette" id="color-palette-${this.paramIndex}">
                        ${this.renderColorPalette(selectedColor)}
                    </div>
                    <input type="hidden" id="param-color-${this.paramIndex}" class="param-color" 
                           value="${selectedColor}">
                </div>
                
                <!-- Multiplier и Adder в одной строке -->
                <div class="grid-2">
                    <div class="form-group">
                        <label for="param-multiplier-${this.paramIndex}">Multiplier:</label>
                        <input type="number" id="param-multiplier-${this.paramIndex}" class="param-multiplier" 
                               step="0.001" value="${this.config.multiplier}">
                        <small style="color: #666; font-size: 0.7em;">Value × multiplier</small>
                    </div>
                    
                    <div class="form-group">
                        <label for="param-adder-${this.paramIndex}">Adder:</label>
                        <input type="number" id="param-adder-${this.paramIndex}" class="param-adder" 
                               step="0.01" value="${this.config.adder}">
                        <small style="color: #666; font-size: 0.7em;">Value + adder</small>
                    </div>
                </div>
            </div>
        `;
    }

    // Рендер палитры цветов
    renderColorPalette(selectedColor) {
        return COLOR_PALETTE.map(color => `
            <div class="color-option ${color === selectedColor ? 'selected' : ''}" 
                 style="background-color: ${color}" 
                 data-color="${color}"
                 title="${color}">
            </div>
        `).join('');
    }

    // Получение данных конфигурации из DOM
    getDataFromDOM(container) {
        return {
            name: container.querySelector('.param-name').value,
            canId: container.querySelector('.param-canid').value,
            byteIndex: parseInt(container.querySelector('.param-byte').value),
            size: container.querySelector('.param-size').value,
            color: container.querySelector('.param-color').value,
            multiplier: parseFloat(container.querySelector('.param-multiplier').value) || 1,
            adder: parseFloat(container.querySelector('.param-adder').value) || 0,
            byte0Filter: container.querySelector('.param-byte0').value.trim().toLowerCase(),
            byte1Filter: container.querySelector('.param-byte1').value.trim().toLowerCase()
        };
    }
}

// Функция для создания DOM элемента из параметра
export function createParamElement(param, widgetType = 'canChart2') {
    const template = document.createElement('template');
    template.innerHTML = param.render(widgetType);
    const element = template.content.firstElementChild;

    // Добавляем обработчик выбора цвета
    const colorPalette = element.querySelector('.color-palette');
    const colorInput = element.querySelector('.param-color');

    if (colorPalette && colorInput) {
        colorPalette.addEventListener('click', (e) => {
            const colorOption = e.target.closest('.color-option');
            if (colorOption) {
                const color = colorOption.dataset.color;

                // Убираем выделение со всех вариантов
                colorPalette.querySelectorAll('.color-option').forEach(opt => {
                    opt.classList.remove('selected');
                });

                // Выделяем выбранный вариант
                colorOption.classList.add('selected');

                // Устанавливаем значение
                colorInput.value = color;
            }
        });
    }

    // Добавляем обработчик удаления
    const removeBtn = element.querySelector('.remove-param-btn');
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            element.remove();
        });
    }

    return element;
}

// Функция для применения формулы к значению
export function applyFormula(value, multiplier = 1, adder = 0) {
    return (value * multiplier) + adder;
}

// Функция проверки фрейма на соответствие фильтрам параметра
export function checkFrameAgainstParam(frame, param) {
    // Проверка CAN ID
    if (frame.id.toLowerCase() !== param.canId.toLowerCase()) {
        return false;
    }

    // Если есть фильтры по байтам, проверяем их
    const hexToBytes = (hex) => {
        const bytes = [];
        for (let i = 0; i < hex.length; i += 2) {
            bytes.push(parseInt(hex.substr(i, 2), 16));
        }
        return bytes;
    };

    const data = hexToBytes(frame.data);

    // Проверка байта 0 (если указан фильтр)
    if (param.byte0Filter && param.byte0Filter.trim() !== '') {
        const filterValue = parseInt(param.byte0Filter, 16);
        if (data.length === 0 || data[0] !== filterValue) {
            return false;
        }
    }

    // Проверка байта 1 (если указан фильтр)
    if (param.byte1Filter && param.byte1Filter.trim() !== '') {
        const filterValue = parseInt(param.byte1Filter, 16);
        if (data.length < 2 || data[1] !== filterValue) {
            return false;
        }
    }

    return true;
}