// Utility functions
export const MAX_POINTS = 50;

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