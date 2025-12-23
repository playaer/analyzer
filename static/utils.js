// Utility functions
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
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// static/utils.js

// Пример парсинга конфига (на основе описания в README)
export function parseByteConfig(config) {
    // Логика парсинга строки конфига, если нужно (например, "0-1" для байтов)
    return config; // Предполагаем, что config уже parsed
}

// Расчет значения с применением формулы
export function calculateValue(frameData, config) {
    const bytes = frameData.split(' ').map(hex => parseInt(hex, 16));
    const startByte = config.byte;
    let value;

    switch (config.size) {
        case '8':
            value = new Int8Array([bytes[startByte]])[0]; // signed 8-bit
            break;
        case '8u':
            value = bytes[startByte]; // unsigned 8-bit
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

    // Применение формулы: (parameter * input1) + input2
    value = (value * config.multiplier) + config.adder;

    return value;
}

// Функция для применения формулы
export function applyFormula(value, config) {
    const multiplier = config.multiplier || 1;
    const adder = config.adder || 0;
    return (value * multiplier) + adder;
}

// Функция для парсинга формулы (если нужны более сложные формулы в будущем)
export function parseFormula(formula, value) {
    if (!formula) return value;

    // Простая поддержка линейных формул вида: x*2+1 или (x+3)*1.5
    try {
        // Заменяем x на значение
        const expression = formula.replace(/x/g, value.toString());
        // Безопасное вычисление
        return Function('"use strict"; return (' + expression + ')')();
    } catch (e) {
        console.error('Formula parsing error:', e);
        return value;
    }
}