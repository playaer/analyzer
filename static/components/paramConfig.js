// Компонент конфигурации параметра для виджетов
import { createByteFilterElement } from './byteFilter.js';

export class ParamConfig {
    constructor(paramIndex, initialConfig = {}) {
        this.paramIndex = paramIndex;
        this.config = {
            name: initialConfig.name || `Param ${paramIndex + 1}`,
            canId: initialConfig.canId || '0x200',
            byteIndex: initialConfig.byteIndex || 0,
            size: initialConfig.size || '8',
            color: initialConfig.color || '#ff6384',
            multiplier: initialConfig.multiplier || 1,
            adder: initialConfig.adder || 0,
            byte0Filter: initialConfig.byte0Filter || '',
            byte1Filter: initialConfig.byte1Filter || '',
            byte0Enabled: initialConfig.byte0Enabled || false,
            byte1Enabled: initialConfig.byte1Enabled || false
        };
    }

    // Генерация HTML для конфигурации параметра
    render() {
        return `
            <div class="param-config" data-param-index="${this.paramIndex}">
                <div class="param-header">
                    <strong>Parameter ${this.paramIndex + 1}</strong>
                    <button type="button" class="remove-param-btn">×</button>
                </div>
                
                <div class="form-group">
                    <label for="param-name-${this.paramIndex}">Parameter Name:</label>
                    <input type="text" id="param-name-${this.paramIndex}" class="param-name" 
                           value="${this.config.name}" placeholder="Parameter name">
                </div>
                
                <!-- Вставляем компонент фильтрации -->
                <div id="byte-filter-${this.paramIndex}" class="byte-filter-container"></div>
                
                <div class="grid-2" style="gap: 10px; margin-bottom: 15px;">
                    <div class="form-group">
                        <label for="param-byte-${this.paramIndex}">Data Byte Index (0-7):</label>
                        <input type="number" id="param-byte-${this.paramIndex}" class="param-byte" 
                               min="0" max="7" value="${this.config.byteIndex}">
                        <small style="color: #666; font-size: 0.85em;">Which byte to extract value from</small>
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
                
                <div class="form-group">
                    <label for="param-color-${this.paramIndex}">Line Color:</label>
                    <input type="color" id="param-color-${this.paramIndex}" class="param-color" 
                           value="${this.config.color}">
                </div>
                
                <div class="grid-2" style="gap: 10px; margin: 15px 0;">
                    <div class="form-group">
                        <label for="param-multiplier-${this.paramIndex}">Multiplier (input1):</label>
                        <input type="number" id="param-multiplier-${this.paramIndex}" class="param-multiplier" 
                               step="0.01" value="${this.config.multiplier}">
                        <small style="color: #666; font-size: 0.85em;">Value × multiplier</small>
                    </div>
                    
                    <div class="form-group">
                        <label for="param-adder-${this.paramIndex}">Adder (input2):</label>
                        <input type="number" id="param-adder-${this.paramIndex}" class="param-adder" 
                               step="0.01" value="${this.config.adder}">
                        <small style="color: #666; font-size: 0.85em;">Value + adder</small>
                    </div>
                </div>
            </div>
        `;
    }

    // Получение данных конфигурации из DOM
    getDataFromDOM(container) {
        // Получаем данные из компонента фильтрации
        const filterContainer = container.querySelector('.byte-filter-container');
        let canId = '0x200';
        let byte0Filter = '';
        let byte1Filter = '';
        let byte0Enabled = false;
        let byte1Enabled = false;

        if (filterContainer && filterContainer.filterComponent) {
            const filterData = filterContainer.filterComponent.getData();
            canId = filterData.canId;
            byte0Filter = filterData.byte0Filter;
            byte1Filter = filterData.byte1Filter;
            byte0Enabled = filterData.byte0Enabled;
            byte1Enabled = filterData.byte1Enabled;
        }

        return {
            name: container.querySelector('.param-name').value,
            canId,
            byteIndex: parseInt(container.querySelector('.param-byte').value),
            size: container.querySelector('.param-size').value,
            color: container.querySelector('.param-color').value,
            multiplier: parseFloat(container.querySelector('.param-multiplier').value) || 1,
            adder: parseFloat(container.querySelector('.param-adder').value) || 0,
            byte0Filter,
            byte1Filter,
            byte0Enabled,
            byte1Enabled
        };
    }
}

// Функция для создания DOM элемента из параметра
export function createParamElement(param) {
    const template = document.createElement('template');
    template.innerHTML = param.render();
    const element = template.content.firstElementChild;

    // Инициализируем компонент фильтрации
    const filterContainer = element.querySelector('.byte-filter-container');
    if (filterContainer) {
        const filterComponent = createByteFilterElement({
            canId: param.config.canId,
            byte0Filter: param.config.byte0Filter,
            byte1Filter: param.config.byte1Filter,
            byte0Enabled: param.config.byte0Enabled,
            byte1Enabled: param.config.byte1Enabled
        });

        filterContainer.appendChild(filterComponent.element);
        filterContainer.filterComponent = filterComponent;
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

    // Если фильтры по байтам не включены, достаточно совпадения CAN ID
    if (!param.byte0Enabled && !param.byte1Enabled) {
        return true;
    }

    // Конвертируем данные фрейма в байты
    const hexToBytes = (hex) => {
        const bytes = [];
        for (let i = 0; i < hex.length; i += 2) {
            bytes.push(parseInt(hex.substr(i, 2), 16));
        }
        return bytes;
    };

    const data = hexToBytes(frame.data);

    // Проверка байта 0
    if (param.byte0Enabled && param.byte0Filter) {
        const filterValue = parseInt(param.byte0Filter, 16);
        if (data.length === 0 || data[0] !== filterValue) {
            return false;
        }
    }

    // Проверка байта 1
    if (param.byte1Enabled && param.byte1Filter) {
        const filterValue = parseInt(param.byte1Filter, 16);
        if (data.length < 2 || data[1] !== filterValue) {
            return false;
        }
    }

    return true;
}