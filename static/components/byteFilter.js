// Упрощенный компонент фильтрации по байтам (теперь интегрирован в paramConfig.js)
// Этот файл больше не нужен для основной функциональности
// Оставляем его для совместимости с существующим кодом

export class ByteFilter {
    constructor(initialConfig = {}) {
        this.config = {
            canId: initialConfig.canId || '0x200',
            byte0Filter: initialConfig.byte0Filter || '',
            byte1Filter: initialConfig.byte1Filter || ''
        };
    }

    // Проверка, проходит ли CAN фрейм фильтр
    checkFrame(frame) {
        const data = this.hexToBytes(frame.data);

        // Проверка CAN ID
        if (frame.id.toLowerCase() !== this.config.canId.toLowerCase()) {
            return false;
        }

        // Проверка байта 0 (если указан фильтр)
        if (this.config.byte0Filter && this.config.byte0Filter.trim() !== '') {
            const filterValue = parseInt(this.config.byte0Filter, 16);
            if (data.length === 0 || data[0] !== filterValue) {
                return false;
            }
        }

        // Проверка байта 1 (если указан фильтр)
        if (this.config.byte1Filter && this.config.byte1Filter.trim() !== '') {
            const filterValue = parseInt(this.config.byte1Filter, 16);
            if (data.length < 2 || data[1] !== filterValue) {
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
}

// Фабричная функция (для совместимости)
export function createByteFilterElement(initialConfig = {}) {
    const filter = new ByteFilter(initialConfig);
    return {
        element: document.createElement('div'),
        getData: () => ({
            canId: initialConfig.canId || '0x200',
            byte0Filter: initialConfig.byte0Filter || '',
            byte1Filter: initialConfig.byte1Filter || '',
            byte0Enabled: !!initialConfig.byte0Filter,
            byte1Enabled: !!initialConfig.byte1Filter
        }),
        checkFrame: (frame) => filter.checkFrame(frame)
    };
}
