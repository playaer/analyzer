// Numeric Widget - отображение числовых значений в блоках
import { hexToBytes, calculateParamValue, checkParamFilters, formatValue } from './utils.js';

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
            const passesFilter = checkParamFilters(param, frame);

            if (!passesFilter) {
                return;
            }

            const value = calculateParamValue(param, data);
            const formattedValue = formatValue(value, param);

            if (!widget.data[param.name]) {
                widget.data[param.name] = {};
            }

            widget.data[param.name] = {
                value: value,
                formattedValue: formattedValue,
                timestamp: new Date().toLocaleTimeString(),
                rawValue: value
            };

            this.updateParamDisplay(widgetId, paramIndex, param, widget.data[param.name]);
        });
    },

    updateParamDisplay(widgetId, paramIndex, param, data) {
        const safeId = widgetId.replace(/[^a-zA-Z0-9-]/g, '-');
        const valueElement = document.getElementById(`numeric-value-${safeId}-${paramIndex}`);
        const timestampElement = document.getElementById(`numeric-timestamp-${safeId}-${paramIndex}`);

        if (valueElement) {
            valueElement.textContent = data.formattedValue;
            valueElement.style.color = param.color || '#000000';
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
    }
};