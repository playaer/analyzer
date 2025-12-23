// Numeric Widget - отображение числовых значений в блоках
import { hexToBytes } from './utils.js';

export const numericWidget = {
    initWidget(widgetId, widget) {
        const safeId = widgetId.replace(/[^a-zA-Z0-9-]/g, '-');

        if (!widget.data) {
            widget.data = {};
            if (widget.config?.params) {
                widget.config.params.forEach(param => {
                    widget.data[param.name] = {
                        value: 0,
                        timestamp: null,
                        formattedValue: '0'
                    };
                });
            }
        }

        this.updateDisplay(widgetId, widget);
    },

    processFrame(widgetId, frame, widget) {
        if (!widget.config || !widget.config.params || widget.config.params.length === 0) {
            return;
        }

        const data = hexToBytes(frame.data);
        const safeId = widgetId.replace(/[^a-zA-Z0-9-]/g, '-');

        if (!widget.data) {
            widget.data = {};
        }

        widget.frameCount = (widget.frameCount || 0) + 1;
        this.updateFrameCount(widgetId, widget.frameCount);

        widget.config.params.forEach((param, paramIndex) => {
            const passesFilter = this.checkParamFilters(param, frame);

            if (!passesFilter) {
                return;
            }

            const rawValue = this.calculateParamValue(param, data);
            const value = (rawValue * (param.multiplier || 1)) + (param.adder || 0);
            const formattedValue = this.formatValue(value, param);

            if (!widget.data[param.name]) {
                widget.data[param.name] = {};
            }

            widget.data[param.name] = {
                value: value,
                formattedValue: formattedValue,
                timestamp: new Date().toLocaleTimeString(),
                rawValue: rawValue
            };

            this.updateParamDisplay(widgetId, paramIndex, param, widget.data[param.name]);
        });
    },

    checkParamFilters(param, frame) {
        // Проверка CAN ID
        if (param.canId.toLowerCase() !== frame.id.toLowerCase()) {
            return false;
        }

        const data = this.hexToBytes(frame.data);

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
    },

    calculateParamValue(param, canData) {
        const byteIndex = param.byteIndex;
        const size = param.size || '8';

        if (byteIndex >= canData.length) return 0;

        switch (size) {
            case '8': // 8-bit signed
                let value8 = canData[byteIndex];
                return value8 > 127 ? value8 - 256 : value8;

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
    },

    formatValue(value, param) {
        const size = param.size || '8';

        if (size === '32f') {
            return value.toFixed(4);
        } else if (size.includes('32') || size.includes('16')) {
            return Math.round(value).toString();
        } else {
            return Math.round(value).toString();
        }
    },

    updateParamDisplay(widgetId, paramIndex, param, data) {
        const safeId = widgetId.replace(/[^a-zA-Z0-9-]/g, '-');
        const valueElement = document.getElementById(`numeric-value-${safeId}-${paramIndex}`);
        const timestampElement = document.getElementById(`numeric-timestamp-${safeId}-${paramIndex}`);

        if (valueElement) {
            valueElement.textContent = data.formattedValue;
            valueElement.style.color = param.color || '#000000'; // Чёрный по умолчанию для numeric
        }

        if (timestampElement) {
            timestampElement.textContent = data.timestamp;
        }
    },

    updateFrameCount(widgetId, count) {
        const safeId = widgetId.replace(/[^a-zA-Z0-9-]/g, '-');
        const countElem = document.getElementById(`frame-count-${safeId}`);
        if (countElem) {
            countElem.textContent = count;
        }
    },

    updateDisplay(widgetId, widget) {
        const safeId = widgetId.replace(/[^a-zA-Z0-9-]/g, '-');
        this.updateFrameCount(widgetId, widget.frameCount || 0);

        if (widget.config?.params && widget.data) {
            widget.config.params.forEach((param, index) => {
                const paramData = widget.data[param.name];
                if (paramData) {
                    this.updateParamDisplay(widgetId, index, param, paramData);
                }
            });
        }
    },

    render(widgetId, widget) {
        const safeId = widgetId.replace(/[^a-zA-Z0-9-]/g, '-');
        const widgetName = widget.config?.widgetName || 'Numeric Values';
        const size = widget.size || 1;
        const paramCount = widget.config?.params?.length || 0;

        let numericBlocksHtml = '';

        if (widget.config?.params) {
            widget.config.params.forEach((param, index) => {
                const paramData = widget.data && widget.data[param.name]
                    ? widget.data[param.name]
                    : { formattedValue: '0', timestamp: '--:--:--' };

                numericBlocksHtml += `
                    <div class="numeric-block" id="numeric-block-${safeId}-${index}">
                        <div class="numeric-header">
                            <span class="numeric-name">${param.name}</span>
                            <span class="numeric-can-id">${param.canId}</span>
                        </div>
                        <div class="numeric-value-container">
                            <span class="numeric-value" id="numeric-value-${safeId}-${index}" 
                                  style="color: ${param.color || '#000000'}">${paramData.formattedValue}</span>
                        </div>
                        <div class="numeric-footer">
                            <span class="numeric-timestamp" id="numeric-timestamp-${safeId}-${index}">
                                ${paramData.timestamp || '--:--:--'}
                            </span>
                        </div>
                    </div>
                `;
            });
        } else {
            numericBlocksHtml = `
                <div class="no-data-message">
                    No parameters configured. Edit widget to add parameters.
                </div>
            `;
        }

        return `
            <div class="widget-header">
                <div class="widget-title">${widgetName} 
                    <span class="widget-size-badge">${size}×</span>
                </div>
                <div class="widget-actions">
                    <button class="widget-btn edit">Edit</button>
                    <button class="widget-btn remove">Remove</button>
                </div>
            </div>
            <div class="widget-content numeric-content">
                <div class="numeric-grid" id="numeric-grid-${safeId}">
                    ${numericBlocksHtml}
                </div>
            </div>
            <div class="widget-stats">
                <span>Frames: <span id="frame-count-${safeId}">${widget.frameCount || 0}</span></span>
                <span>Parameters: ${paramCount}</span>
            </div>
        `;
    },

    destroy(widgetId) {
        console.log(`Destroying numeric widget: ${widgetId}`);
    },

    hexToBytes(hex) {
        const bytes = [];
        for (let i = 0; i < hex.length; i += 2) {
            bytes.push(parseInt(hex.substr(i, 2), 16));
        }
        return bytes;
    }
};
