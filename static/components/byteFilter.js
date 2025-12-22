// Компонент для расширенной фильтрации по байтам CAN
export class ByteFilter {
    constructor(initialConfig = {}) {
        this.config = {
            canId: initialConfig.canId || '0x200',
            byte0Filter: initialConfig.byte0Filter || '',
            byte1Filter: initialConfig.byte1Filter || '',
            byte0Enabled: initialConfig.byte0Enabled || false,
            byte1Enabled: initialConfig.byte1Enabled || false
        };
    }

    // Генерация HTML компонента
    render() {
        return `
            <div class="byte-filter">
                <div class="form-group">
                    <label for="filter-can-id">CAN ID (hex):</label>
                    <input type="text" id="filter-can-id" class="filter-can-id" 
                           value="${this.config.canId}" placeholder="0x200">
                </div>
                
                <div class="filter-options">
                    <div class="filter-option">
                        <label class="checkbox-label">
                            <input type="checkbox" id="filter-byte0-enabled" class="filter-byte0-enabled" 
                                   ${this.config.byte0Enabled ? 'checked' : ''}>
                            <span>Filter Byte 0</span>
                        </label>
                        <input type="text" id="filter-byte0" class="filter-byte0" 
                               value="${this.config.byte0Filter}" placeholder="00" 
                               ${!this.config.byte0Enabled ? 'disabled' : ''}>
                        <small style="color: #666;">Hex value (00-FF)</small>
                    </div>
                    
                    <div class="filter-option">
                        <label class="checkbox-label">
                            <input type="checkbox" id="filter-byte1-enabled" class="filter-byte1-enabled" 
                                   ${this.config.byte1Enabled ? 'checked' : ''}>
                            <span>Filter Byte 1</span>
                        </label>
                        <input type="text" id="filter-byte1" class="filter-byte1" 
                               value="${this.config.byte1Filter}" placeholder="00" 
                               ${!this.config.byte1Enabled ? 'disabled' : ''}>
                        <small style="color: #666;">Hex value (00-FF)</small>
                    </div>
                </div>
                
                <div class="filter-help">
                    <small style="color: #666; display: block; margin-top: 10px;">
                        <strong>Note:</strong> Frame will be processed only if:
                        <ul style="margin: 5px 0 0 20px;">
                            <li>CAN ID matches</li>
                            <li>Byte 0 matches (if filter enabled)</li>
                            <li>Byte 1 matches (if filter enabled)</li>
                        </ul>
                        Leave filters empty to match only by CAN ID.
                    </small>
                </div>
            </div>
        `;
    }

    // Получение данных из DOM
    getDataFromDOM(container) {
        const canId = container.querySelector('.filter-can-id').value;
        const byte0Enabled = container.querySelector('.filter-byte0-enabled').checked;
        const byte1Enabled = container.querySelector('.filter-byte1-enabled').checked;
        const byte0Filter = byte0Enabled ? container.querySelector('.filter-byte0').value : '';
        const byte1Filter = byte1Enabled ? container.querySelector('.filter-byte1').value : '';

        return {
            canId,
            byte0Filter: this.normalizeHex(byte0Filter),
            byte1Filter: this.normalizeHex(byte1Filter),
            byte0Enabled,
            byte1Enabled
        };
    }

    // Проверка, проходит ли CAN фрейм фильтр
    checkFrame(frame) {
        const data = this.hexToBytes(frame.data);

        // Проверка CAN ID
        if (frame.id.toLowerCase() !== this.config.canId.toLowerCase()) {
            return false;
        }

        // Проверка байта 0 (если фильтр включен и заполнен)
        if (this.config.byte0Enabled && this.config.byte0Filter !== '') {
            const filterValue = parseInt(this.config.byte0Filter, 16);
            if (data.length > 0 && data[0] !== filterValue) {
                return false;
            }
        }

        // Проверка байта 1 (если фильтр включен и заполнен)
        if (this.config.byte1Enabled && this.config.byte1Filter !== '') {
            const filterValue = parseInt(this.config.byte1Filter, 16);
            if (data.length > 1 && data[1] !== filterValue) {
                return false;
            }
        }

        return true;
    }

    // Вспомогательные методы
    hexToBytes(hex) {
        const bytes = [];
        for (let i = 0; i < hex.length; i += 2) {
            bytes.push(parseInt(hex.substr(i, 2), 16));
        }
        return bytes;
    }

    normalizeHex(hex) {
        if (!hex) return '';
        // Удаляем префикс 0x если есть
        hex = hex.replace(/^0x/i, '');
        // Дополняем до 2 символов
        return hex.padStart(2, '0').toUpperCase();
    }
}

// Фабричная функция для создания DOM элемента
export function createByteFilterElement(initialConfig = {}) {
    const filter = new ByteFilter(initialConfig);
    const template = document.createElement('template');
    template.innerHTML = filter.render();
    const element = template.content.firstElementChild;

    // Добавляем обработчики для чекбоксов
    const byte0Enabled = element.querySelector('.filter-byte0-enabled');
    const byte1Enabled = element.querySelector('.filter-byte1-enabled');
    const byte0Input = element.querySelector('.filter-byte0');
    const byte1Input = element.querySelector('.filter-byte1');

    if (byte0Enabled && byte0Input) {
        byte0Enabled.addEventListener('change', () => {
            byte0Input.disabled = !byte0Enabled.checked;
            if (!byte0Enabled.checked) {
                byte0Input.value = '';
            }
        });
    }

    if (byte1Enabled && byte1Input) {
        byte1Enabled.addEventListener('change', () => {
            byte1Input.disabled = !byte1Enabled.checked;
            if (!byte1Enabled.checked) {
                byte1Input.value = '';
            }
        });
    }

    return {
        element,
        getData: () => filter.getDataFromDOM(element),
        checkFrame: (frame) => filter.checkFrame(frame)
    };
}