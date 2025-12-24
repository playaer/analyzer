// udsWidget.js - Виджет для UDS запросов
import { hexToBytes, calculateParamValue, formatValue } from './utils.js';

export class UDSWidget {
    constructor(config) {
        this.id = config.id;
        this.name = config.name || `UDS_${config.sidType}`;
        this.sidType = config.sidType; // '22', '23', '27', '31'
        this.address = config.address || '0xF101';
        this.dataType = config.dataType || '16u';
        this.interval = config.interval || 1000; // мс, -1 одноразовый, 0 немедленно, >0 интервал
        this.state = 'paused'; // 'running', 'paused'
        this.lastRequest = null;
        this.lastResponse = null;
        this.timeoutTimer = null;
        this.intervalTimer = null;
        this.requestCount = 0;
        this.responseCount = 0;
        this.errorCount = 0;
        this.widgetElement = null;
        this.onSendRequest = null;
        this.onRemove = null;
    }

    render() {
        const widget = document.createElement('div');
        widget.className = 'uds-widget widget';
        widget.id = `uds-widget-${this.id}`;

        const sidLabel = this.getSidLabel();
        const intervalLabel = this.getIntervalLabel();
        const addressLabel = this.getAddressLabel();
        const showDataType = ['22', '23'].includes(this.sidType);

        widget.innerHTML = `
            <div class="widget-header">
                <div class="widget-title">
                    ${this.name}
                    <span class="widget-size-badge">UDS</span>
                    <span class="uds-sid-badge ${this.sidType}">${sidLabel}</span>
                </div>
                <div class="widget-actions">
                    <button class="widget-btn ${this.state === 'running' ? 'pause' : 'start'}">
                        ${this.state === 'running' ? '⏸️ Pause' : '▶️ Start'}
                    </button>
                    <button class="widget-btn remove">🗑️ Remove</button>
                </div>
            </div>
            <div class="widget-content">
                <div class="uds-info">
                    <div class="uds-info-row">
                        <span class="uds-label">Type:</span>
                        <span class="uds-value">${sidLabel}</span>
                    </div>
                    <div class="uds-info-row">
                        <span class="uds-label">${this.getAddressLabelName()}:</span>
                        <span class="uds-value">${addressLabel}</span>
                    </div>
                    ${showDataType ? `
                    <div class="uds-info-row">
                        <span class="uds-label">Data Type:</span>
                        <span class="uds-value">${this.dataType}</span>
                    </div>
                    ` : ''}
                    <div class="uds-info-row">
                        <span class="uds-label">Interval:</span>
                        <span class="uds-value">${intervalLabel}</span>
                    </div>
                </div>
                
                <div class="uds-response-container">
                    <div class="uds-response-header">
                        <span>Response</span>
                        <span class="uds-response-status" id="response-status-${this.id}">● Waiting</span>
                    </div>
                    <div class="uds-response-body">
                        <div class="uds-hex-response" id="hex-response-${this.id}">
                            No response yet
                        </div>
                        ${showDataType ? `
                        <div class="uds-numeric-response" id="numeric-response-${this.id}">
                            —
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            <div class="widget-stats uds-stats">
                <span>Sent: <span id="sent-count-${this.id}">${this.requestCount}</span></span>
                <span>Received: <span id="recv-count-${this.id}">${this.responseCount}</span></span>
                <span>Errors: <span id="error-count-${this.id}">${this.errorCount}</span></span>
            </div>
            <div class="widget-resize-handle">↘</div>
        `;

        this.widgetElement = widget;

        // Добавляем обработчики событий
        const startPauseBtn = widget.querySelector('.widget-btn.start, .widget-btn.pause');
        const removeBtn = widget.querySelector('.widget-btn.remove');

        startPauseBtn.addEventListener('click', () => this.toggleState());
        removeBtn.addEventListener('click', () => {
            if (this.onRemove) {
                this.onRemove(this.id);
            }
        });

        return widget;
    }

    getSidLabel() {
        switch(this.sidType) {
            case '22': return 'ReadDataByIdentifier';
            case '23': return 'ReadMemoryByAddress';
            case '27': return 'SecurityAccess';
            case '31': return 'RoutineControl';
            default: return `SID_0x${this.sidType}`;
        }
    }

    getAddressLabel() {
        const addr = this.address.toUpperCase();
        if (addr.startsWith('0X')) return addr;
        return `0x${addr}`;
    }

    getAddressLabelName() {
        switch(this.sidType) {
            case '22': return 'DID';
            case '23': return 'Address';
            case '27': return 'SubFunc';
            case '31': return 'RoutineID';
            default: return 'Address';
        }
    }

    getIntervalLabel() {
        if (this.interval === -1) return 'Once';
        if (this.interval === 0) return 'Immediate';
        return `${this.interval}ms`;
    }

    toggleState() {
        if (this.state === 'running') {
            this.pause();
        } else {
            this.start();
        }
        this.updateUI();
    }

    start() {
        this.state = 'running';
        this.sendRequest();
    }

    pause() {
        this.state = 'paused';
        this.clearTimers();
    }

    clearTimers() {
        if (this.timeoutTimer) {
            clearTimeout(this.timeoutTimer);
            this.timeoutTimer = null;
        }
        if (this.intervalTimer) {
            clearTimeout(this.intervalTimer);
            this.intervalTimer = null;
        }
    }

    sendRequest() {
        if (this.state !== 'running') return;

        this.requestCount++;
        this.updateStats();

        // Подмаргиваем кнопку Start
        this.blinkButton();

        // Формируем запрос
        const request = {
            type: 'uds_request',
            widgetId: this.id,
            sid: this.sidType,
            address: this.address,
            dataType: this.dataType
        };

        // Для SID 0x23 добавляем длину данных
        if (this.sidType === '23') {
            const lengthMap = {
                '8': 1, '8u': 1,
                '16': 2, '16u': 2,
                '32': 4, '32u': 4, '32f': 4
            };
            request.length = lengthMap[this.dataType] || 4;
        }

        // Отправляем запрос
        if (this.onSendRequest) {
            this.onSendRequest(request);
        }

        this.lastRequest = new Date();

        // Таймаут 3 секунды
        this.timeoutTimer = setTimeout(() => {
            this.handleTimeout();
        }, 3000);
    }

    blinkButton() {
        const btn = this.widgetElement.querySelector('.widget-btn.start, .widget-btn.pause');
        if (btn) {
            btn.classList.add('blinking');
            setTimeout(() => {
                btn.classList.remove('blinking');
            }, 300);
        }
    }

    handleResponse(response) {
        this.clearTimers();
        this.responseCount++;

        const responseElement = document.getElementById(`hex-response-${this.id}`);
        const statusElement = document.getElementById(`response-status-${this.id}`);

        if (response.success) {
            this.lastResponse = response;

            // Подмаргиваем блок с ответом
            if (responseElement) {
                responseElement.classList.add('blinking');
                setTimeout(() => {
                    responseElement.classList.remove('blinking');
                }, 300);
            }

            // Отображаем hex ответ
            const hexData = response.data || '';
            if (responseElement) {
                responseElement.textContent = hexData;
                responseElement.className = 'uds-hex-response success';
            }

            if (statusElement) {
                statusElement.textContent = '● Success';
                statusElement.className = 'uds-response-status success';
            }

            // Если нужно, преобразуем в числовое значение
            if (['22', '23'].includes(this.sidType) && hexData.length >= 4) {
                this.displayNumericValue(hexData);
            }

            // Обработка следующего запроса
            this.scheduleNextRequest();
        } else {
            this.errorCount++;
            this.handleError(response.error || 'Unknown error');
        }

        this.updateStats();
    }

    displayNumericValue(hexData) {
        try {
            // Парсим hex данные (убираем SID если есть)
            let data = hexData;
            if (data.startsWith('62') || data.startsWith('63') || data.startsWith('67') || data.startsWith('71')) {
                data = data.substring(2); // Убираем SID ответа
            }

            // Убираем адрес/DID (первые 2 байта)
            if (data.length > 4) {
                data = data.substring(4);
            }

            const bytes = hexToBytes(data);
            if (bytes.length === 0) return;

            // Создаем параметр для расчета значения
            const param = {
                byteIndex: 0,
                size: this.dataType,
                multiplier: 1,
                adder: 0
            };

            const value = calculateParamValue(param, bytes);
            const formattedValue = formatValue(value, param);

            const numericElement = document.getElementById(`numeric-response-${this.id}`);
            if (numericElement) {
                numericElement.textContent = formattedValue;
            }
        } catch (error) {
            console.error('Error converting to numeric:', error);
        }
    }

    handleError(error) {
        const responseElement = document.getElementById(`hex-response-${this.id}`);
        const statusElement = document.getElementById(`response-status-${this.id}`);

        if (responseElement) {
            responseElement.textContent = `Err: ${error}`;
            responseElement.className = 'uds-hex-response error';
        }

        if (statusElement) {
            statusElement.textContent = '● Error';
            statusElement.className = 'uds-response-status error';
        }

        this.pause();
    }

    handleTimeout() {
        this.errorCount++;
        this.handleError('Timeout');
        this.updateStats();
    }

    scheduleNextRequest() {
        if (this.state !== 'running') return;

        if (this.interval === -1) {
            this.pause();
            return;
        }

        const delay = this.interval === 0 ? 0 : this.interval;

        this.intervalTimer = setTimeout(() => {
            if (this.state === 'running') {
                this.sendRequest();
            }
        }, delay);
    }

    updateUI() {
        const btn = this.widgetElement.querySelector('.widget-btn.start, .widget-btn.pause');
        if (btn) {
            if (this.state === 'running') {
                btn.textContent = '⏸️ Pause';
                btn.className = 'widget-btn pause';
            } else {
                btn.textContent = '▶️ Start';
                btn.className = 'widget-btn start';
            }
        }
    }

    updateStats() {
        const sentElement = document.getElementById(`sent-count-${this.id}`);
        const recvElement = document.getElementById(`recv-count-${this.id}`);
        const errorElement = document.getElementById(`error-count-${this.id}`);

        if (sentElement) sentElement.textContent = this.requestCount;
        if (recvElement) recvElement.textContent = this.responseCount;
        if (errorElement) errorElement.textContent = this.errorCount;
    }

    destroy() {
        this.clearTimers();
        if (this.widgetElement && this.widgetElement.parentNode) {
            this.widgetElement.parentNode.removeChild(this.widgetElement);
        }
    }
}