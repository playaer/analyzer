// Parameter configuration component
export class ParamConfig {
    constructor(index, existingData = null) {
        this.index = index;
        this.data = existingData || this.getDefaultData();
    }

    getDefaultData() {
        return {
            name: `Parameter ${this.index + 1}`,
            canId: '0x200',
            byteIndex: 0,
            size: '8',
            color: this.getDefaultColor(this.index),
            yMin: '',
            yMax: '',
            autoScale: true
        };
    }

    getDefaultColor(index) {
        const colors = ['#ff6384', '#36a2eb', '#4bc0c0', '#ff9f40', '#9966ff', '#ffcd56', '#c9cbcf'];
        return colors[index % colors.length];
    }

    render() {
        return `
            <div class="param-config" data-param-index="${this.index}">
                <div class="param-header">
                    <div class="param-title">${this.data.name}</div>
                    <button type="button" class="remove-param-btn" title="Remove parameter">×</button>
                </div>
                <div class="param-fields">
                    <div class="form-group">
                        <label>Parameter Name:</label>
                        <input type="text" class="param-name" value="${this.data.name}" 
                               placeholder="Parameter name">
                    </div>
                    <div class="form-group">
                        <label>CAN ID:</label>
                        <input type="text" class="param-can-id" value="${this.data.canId}" 
                               placeholder="0x200">
                    </div>
                    <div class="form-group">
                        <label>Byte Index:</label>
                        <input type="number" class="param-byte-index" value="${this.data.byteIndex}" 
                               min="0" max="7" step="1">
                    </div>
                    <div class="form-group">
                        <label>Data Size:</label>
                        <select class="param-size">
                            <option value="8" ${this.data.size === '8' ? 'selected' : ''}>8-bit (signed)</option>
                            <option value="8u" ${this.data.size === '8u' ? 'selected' : ''}>8-bit (unsigned)</option>
                            <option value="16" ${this.data.size === '16' ? 'selected' : ''}>16-bit (signed)</option>
                            <option value="16u" ${this.data.size === '16u' ? 'selected' : ''}>16-bit (unsigned)</option>
                            <option value="32" ${this.data.size === '32' ? 'selected' : ''}>32-bit (signed)</option>
                            <option value="32u" ${this.data.size === '32u' ? 'selected' : ''}>32-bit (unsigned)</option>
                            <option value="32f" ${this.data.size === '32f' ? 'selected' : ''}>32-bit (float)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Line Color:</label>
                        <input type="color" class="param-color" value="${this.data.color}">
                    </div>
                    <div class="form-group">
                        <label>Y Min:</label>
                        <input type="number" class="param-y-min" value="${this.data.yMin}" 
                               placeholder="Auto" step="any">
                    </div>
                    <div class="form-group">
                        <label>Y Max:</label>
                        <input type="number" class="param-y-max" value="${this.data.yMax}" 
                               placeholder="Auto" step="any">
                    </div>
                </div>
            </div>
        `;
    }

    getDataFromDOM(element) {
        return {
            name: element.querySelector('.param-name').value || `Parameter ${this.index + 1}`,
            canId: element.querySelector('.param-can-id').value || '0x200',
            byteIndex: parseInt(element.querySelector('.param-byte-index').value) || 0,
            size: element.querySelector('.param-size').value || '8',
            color: element.querySelector('.param-color').value || this.getDefaultColor(this.index),
            yMin: element.querySelector('.param-y-min').value || '',
            yMax: element.querySelector('.param-y-max').value || '',
            autoScale: !element.querySelector('.param-y-min').value && !element.querySelector('.param-y-max').value
        };
    }

    validate() {
        const errors = [];

        if (!this.data.canId.match(/^0x[0-9a-f]+$/i)) {
            errors.push(`Parameter ${this.index + 1}: Invalid CAN ID format`);
        }

        if (this.data.byteIndex < 0 || this.data.byteIndex > 7) {
            errors.push(`Parameter ${this.index + 1}: Byte index must be between 0 and 7`);
        }

        return errors;
    }

    // Calculate value from CAN data based on configuration
    calculateValue(canData) {
        const byteIndex = this.data.byteIndex;
        const size = this.data.size;

        if (byteIndex >= canData.length) return 0;

        switch (size) {
            case '8': // 8-bit signed
                let value = canData[byteIndex];
                return value > 127 ? value - 256 : value;

            case '8u': // 8-bit unsigned
                return canData[byteIndex];

            case '16': // 16-bit signed (big-endian)
                if (byteIndex + 1 >= canData.length) return 0;
                const val16 = (canData[byteIndex] << 8) | canData[byteIndex + 1];
                return val16 > 32767 ? val16 - 65536 : val16;

            case '16u': // 16-bit unsigned (big-endian)
                if (byteIndex + 1 >= canData.length) return 0;
                return (canData[byteIndex] << 8) | canData[byteIndex + 1];

            case '32': // 32-bit signed (big-endian)
                if (byteIndex + 3 >= canData.length) return 0;
                const val32 = (canData[byteIndex] << 24) |
                    (canData[byteIndex + 1] << 16) |
                    (canData[byteIndex + 2] << 8) |
                    canData[byteIndex + 3];
                return val32 > 2147483647 ? val32 - 4294967296 : val32;

            case '32u': // 32-bit unsigned (big-endian)
                if (byteIndex + 3 >= canData.length) return 0;
                return (canData[byteIndex] << 24) |
                    (canData[byteIndex + 1] << 16) |
                    (canData[byteIndex + 2] << 8) |
                    canData[byteIndex + 3];

            case '32f': // 32-bit float (big-endian)
                if (byteIndex + 3 >= canData.length) return 0;
                const buffer = new ArrayBuffer(4);
                const view = new DataView(buffer);
                view.setUint8(0, canData[byteIndex]);
                view.setUint8(1, canData[byteIndex + 1]);
                view.setUint8(2, canData[byteIndex + 2]);
                view.setUint8(3, canData[byteIndex + 3]);
                return parseFloat(view.getFloat32(0, false).toFixed(4));

            default:
                return 0;
        }
    }
}