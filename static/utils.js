// Utility functions

// ==================== ОБЩИЕ УТИЛИТЫ ====================

export const MAX_POINTS = 150;

// Generate unique widget ID
export function generateWidgetId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `widget-${timestamp}-${random}`;
}

// Generate safe ID for HTML elements
export function generateSafeId(str) {
    return str.replace(/[^a-zA-Z0-9-]/g, '-');
}

// ==================== HEX И ЦВЕТОВЫЕ УТИЛИТЫ ====================

// Convert hex string to bytes array
export function hexToBytes(hex) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
}

// Helper to convert hex color to rgba
export function hexToRgba(hex, alpha = 1) {
    if (!hex || hex.length < 7) return `rgba(0, 0, 0, ${alpha})`;

    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Validate hex color
export function isValidHexColor(color) {
    return /^#[0-9A-F]{6}$/i.test(color);
}

// ==================== РАСЧЕТ ЗНАЧЕНИЙ И ФИЛЬТРАЦИЯ ====================

// Расчет значения параметра CAN
export function calculateParamValue(param, canData) {
    const byteIndex = param.byteIndex;
    const size = param.size || '8';
    const multiplier = param.multiplier || 1;
    const adder = param.adder || 0;

    if (byteIndex >= canData.length) return 0;

    let rawValue;

    switch (size) {
        case '8': // 8-bit signed
            let value8 = canData[byteIndex];
            rawValue = value8 > 127 ? value8 - 256 : value8;
            break;

        case '8u': // 8-bit unsigned
            rawValue = canData[byteIndex];
            break;

        case '16': // 16-bit signed (big-endian)
            if (byteIndex + 1 >= canData.length) return 0;
            const val16 = (canData[byteIndex] << 8) | canData[byteIndex + 1];
            rawValue = val16 > 32767 ? val16 - 65536 : val16;
            break;

        case '16u': // 16-bit unsigned (big-endian)
            if (byteIndex + 1 >= canData.length) return 0;
            rawValue = (canData[byteIndex] << 8) | canData[byteIndex + 1];
            break;

        case '32': // 32-bit signed (big-endian)
            if (byteIndex + 3 >= canData.length) return 0;
            const val32 = (canData[byteIndex] << 24) |
                (canData[byteIndex + 1] << 16) |
                (canData[byteIndex + 2] << 8) |
                canData[byteIndex + 3];
            rawValue = val32 > 2147483647 ? val32 - 4294967296 : val32;
            break;

        case '32u': // 32-bit unsigned (big-endian)
            if (byteIndex + 3 >= canData.length) return 0;
            rawValue = (canData[byteIndex] << 24) |
                (canData[byteIndex + 1] << 16) |
                (canData[byteIndex + 2] << 8) |
                canData[byteIndex + 3];
            break;

        case '32f': // 32-bit float (big-endian)
            if (byteIndex + 3 >= canData.length) return 0;
            const buffer = new ArrayBuffer(4);
            const view = new DataView(buffer);
            view.setUint8(0, canData[byteIndex]);
            view.setUint8(1, canData[byteIndex + 1]);
            view.setUint8(2, canData[byteIndex + 2]);
            view.setUint8(3, canData[byteIndex + 3]);
            rawValue = parseFloat(view.getFloat32(0, false).toFixed(4));
            break;

        default:
            rawValue = 0;
    }

    const result = (rawValue * multiplier) + adder;

    if (size === '32f') {
        return parseFloat(result.toFixed(4));
    }
    if (size.includes('32') || size.includes('16')) {
        return Math.round(result);
    }
    return result;
}

// Проверка параметра на соответствие фильтрам
export function checkParamFilters(param, frame) {
    // Проверка CAN ID
    if (param.canId.toLowerCase() !== frame.id.toLowerCase()) {
        return false;
    }

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

// Форматирование значения в зависимости от типа данных
export function formatValue(value, param) {
    const size = param.size || '8';

    if (size === '32f') {
        return value.toFixed(4);
    } else if (size.includes('32') || size.includes('16')) {
        return Math.round(value).toString();
    } else {
        return Math.round(value).toString();
    }
}

// Парсинг конфига байтов
export function parseByteConfig(config) {
    return config;
}

// Расчет значения с применением формулы
export function calculateValue(frameData, config) {
    const bytes = frameData.split(' ').map(hex => parseInt(hex, 16));
    const startByte = config.byte;
    let value;

    switch (config.size) {
        case '8':
            value = new Int8Array([bytes[startByte]])[0];
            break;
        case '8u':
            value = bytes[startByte];
            break;
        case '16':
            value = new Int16Array(new Uint8Array(bytes.slice(startByte, startByte + 2)).buffer)[0];
            break;
        case '16u':
            value = new Uint16Array(new Uint8Array(bytes.slice(startByte, startByte + 2)).buffer)[0];
            break;
        case '32':
            value = new Int32Array(new Uint8Array(bytes.slice(startByte, startByte + 4)).buffer)[0];
            break;
        case '32u':
            value = new Uint32Array(new Uint8Array(bytes.slice(startByte, startByte + 4)).buffer)[0];
            break;
        case '32f':
            value = new Float32Array(new Uint8Array(bytes.slice(startByte, startByte + 4)).buffer)[0];
            break;
        default:
            value = 0;
    }

    value = (value * config.multiplier) + config.adder;
    return value;
}

// Применение формулы
export function applyFormula(value, config) {
    const multiplier = config.multiplier || 1;
    const adder = config.adder || 0;
    return (value * multiplier) + adder;
}

// Парсинг сложных формул
export function parseFormula(formula, value) {
    if (!formula) return value;

    try {
        const expression = formula.replace(/x/g, value.toString());
        return Function('"use strict"; return (' + expression + ')')();
    } catch (e) {
        console.error('Formula parsing error:', e);
        return value;
    }
}

// ==================== РАБОТА С CAN ДАННЫМИ ====================

// Проверка CAN ID
export function isValidCanId(canId) {
    return canId && canId.match(/^0x[0-9a-f]+$/i);
}

// Нормализация CAN ID
export function normalizeCanId(canId) {
    if (!canId) return '0x000';

    let cleanId = canId.toLowerCase().trim();
    if (!cleanId.startsWith('0x')) {
        cleanId = '0x' + cleanId;
    }

    // Убедимся, что это валидный hex
    if (!cleanId.match(/^0x[0-9a-f]+$/)) {
        return '0x000';
    }

    return cleanId;
}

// ==================== РАБОТА С ЛОКАЛЬНЫМ ХРАНИЛИЩЕМ ====================

// Сохранение данных в localStorage с обработкой ошибок
export function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (e) {
        console.error(`Failed to save to localStorage (${key}):`, e);
        return false;
    }
}

// Загрузка данных из localStorage с обработкой ошибок
export function loadFromLocalStorage(key, defaultValue = null) {
    try {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : defaultValue;
    } catch (e) {
        console.error(`Failed to load from localStorage (${key}):`, e);
        return defaultValue;
    }
}

// Очистка конкретного ключа из localStorage
export function clearLocalStorageKey(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (e) {
        console.error(`Failed to clear localStorage key (${key}):`, e);
        return false;
    }
}

// ==================== РАБОТА С DOM ====================

// Создание элемента с атрибутами
export function createElement(tag, attributes = {}, children = []) {
    const element = document.createElement(tag);

    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'textContent') {
            element.textContent = value;
        } else if (key === 'innerHTML') {
            element.innerHTML = value;
        } else {
            element.setAttribute(key, value);
        }
    });

    children.forEach(child => {
        if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
            element.appendChild(child);
        }
    });

    return element;
}

// Удаление всех дочерних элементов
export function removeAllChildren(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

// ==================== ДАТА И ВРЕМЯ ====================

// Форматирование времени
export function formatTime(date = new Date()) {
    return date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// Форматирование даты
export function formatDate(date = new Date()) {
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// ==================== МАТЕМАТИЧЕСКИЕ УТИЛИТЫ ====================

// Ограничение значения в диапазоне
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// Округление до указанного количества знаков
export function roundTo(value, decimals = 2) {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}

// Линейная интерполяция
export function lerp(start, end, t) {
    return start + (end - start) * t;
}

// ==================== ОБРАБОТКА ОШИБОК ====================

// Безопасное выполнение функции с обработкой ошибок
export function safeExecute(func, errorMessage = 'Error executing function') {
    try {
        return func();
    } catch (error) {
        console.error(`${errorMessage}:`, error);
        return null;
    }
}

// Асинхронная безопасное выполнение функции
export async function safeExecuteAsync(func, errorMessage = 'Error executing async function') {
    try {
        return await func();
    } catch (error) {
        console.error(`${errorMessage}:`, error);
        return null;
    }
}