// Utility functions
export const MAX_POINTS = 50;

// Parse byte configuration string
export function parseByteConfig(config) {
    const singleBytePattern = /^(\d+)$/;
    const signedWordPattern = /^(\d+)-(\d+)$/;
    const unsignedWordPattern = /^(\d+)-(\d+)U$/i;
    const floatPattern = /^(\d+)-(\d+)F(?:-(\d+))?$/i;

    let match;

    if ((match = config.match(singleBytePattern))) {
        const byteIndex = parseInt(match[1]);
        if (byteIndex >= 0 && byteIndex <= 7) {
            return {
                type: 'byte',
                byteIndex: byteIndex,
                signed: true,
                decimalPlaces: 0
            };
        }
    } else if ((match = config.match(signedWordPattern))) {
        const start = parseInt(match[1]);
        const end = parseInt(match[2]);
        if (start >= 0 && end <= 7 && end - start === 1) {
            return {
                type: 'word',
                startByte: Math.min(start, end),
                endByte: Math.max(start, end),
                signed: true,
                decimalPlaces: 0
            };
        }
    } else if ((match = config.match(unsignedWordPattern))) {
        const start = parseInt(match[1]);
        const end = parseInt(match[2]);
        if (start >= 0 && end <= 7 && end - start === 1) {
            return {
                type: 'word',
                startByte: Math.min(start, end),
                endByte: Math.max(start, end),
                signed: false,
                decimalPlaces: 0
            };
        }
    } else if ((match = config.match(floatPattern))) {
        const start = parseInt(match[1]);
        const end = parseInt(match[2]);
        const decimals = match[3] ? parseInt(match[3]) : 2;
        if (start >= 0 && end <= 7 && end - start === 3) {
            return {
                type: 'float',
                startByte: Math.min(start, end),
                endByte: Math.max(start, end),
                signed: true,
                decimalPlaces: decimals
            };
        }
    }

    return null;
}

// Calculate value from parsed config
export function calculateValue(parsedConfig, data) {
    let value = 0;

    switch (parsedConfig.type) {
        case 'byte':
            if (data.length > parsedConfig.byteIndex) {
                value = data[parsedConfig.byteIndex];
                if (parsedConfig.signed && value > 127) {
                    value = value - 256;
                }
            }
            break;
        case 'word':
            if (data.length > parsedConfig.endByte) {
                const highByte = data[parsedConfig.startByte];
                const lowByte = data[parsedConfig.endByte];
                value = (highByte << 8) | lowByte;

                if (parsedConfig.signed && value > 32767) {
                    value = value - 65536;
                }
            }
            break;
        case 'float':
            if (data.length > parsedConfig.endByte) {
                const buffer = new ArrayBuffer(4);
                const view = new DataView(buffer);
                view.setUint8(0, data[parsedConfig.startByte]);
                view.setUint8(1, data[parsedConfig.startByte + 1]);
                view.setUint8(2, data[parsedConfig.startByte + 2]);
                view.setUint8(3, data[parsedConfig.startByte + 3]);
                value = view.getFloat32(0, false);
                value = parseFloat(value.toFixed(parsedConfig.decimalPlaces));
            }
            break;
    }

    return value;
}

// Convert hex string to bytes array
export function hexToBytes(hex) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
}

// Generate safe ID from string
export function generateSafeId(str) {
    return str.replace(/[^a-zA-Z0-9-]/g, '-');
}