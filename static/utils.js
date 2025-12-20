// Utility functions
export const MAX_POINTS = 50;
export const chartColors = [
    'rgba(255, 99, 132, 1)',
    'rgba(54, 162, 235, 1)',
    'rgba(75, 192, 192, 1)',
    'rgba(153, 102, 255, 1)',
    'rgba(255, 159, 64, 1)',
    'rgba(255, 205, 86, 1)',
    'rgba(201, 203, 207, 1)',
    'rgba(0, 200, 83, 1)'
];

// Convert hex string to bytes array
export function hexToBytes(hex) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
}

// Convert bytes array to hex string
export function bytesToHex(bytes) {
    return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Load from localStorage
export function loadFromLocalStorage() {
    try {
        const savedBlocks = localStorage.getItem('canIdBlocks');
        if (savedBlocks) {
            return JSON.parse(savedBlocks);
        }
    } catch (e) {
        console.error('Failed to load from localStorage:', e);
    }
    return {};
}