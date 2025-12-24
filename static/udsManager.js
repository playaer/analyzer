// udsManager.js - Менеджер UDS виджетов
import { UDSWidget } from './udsWidget.js';

export class UDSManager {
    constructor() {
        this.widgets = new Map();
        this.container = null;
        this.modal = null;
        this.ws = null;
    }

    init(containerId) {
        this.container = document.getElementById(containerId);
        this.setupModal();
        this.loadWidgets();
        this.renderWidgets();
    }

    setupModal() {
        // Создаем модальное окно для UDS виджетов
        this.modal = document.createElement('div');
        this.modal.className = 'modal';
        this.modal.id = 'udsModal';
        this.modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="udsModalTitle">Create UDS Widget</h3>
                    <span class="modal-close">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="udsWidgetName">Widget Name:</label>
                        <input type="text" id="udsWidgetName" placeholder="UDS Request">
                    </div>
                    
                    <div class="modal-grid-2">
                        <div class="form-group">
                            <label for="udsSidType">SID Type:</label>
                            <select id="udsSidType">
                                <option value="22">0x22 - ReadDataByIdentifier</option>
                                <option value="23">0x23 - ReadMemoryByAddress</option>
                                <option value="27">0x27 - SecurityAccess</option>
                                <option value="31">0x31 - RoutineControl</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label id="udsAddressLabel" for="udsAddress">DID (hex):</label>
                            <input type="text" id="udsAddress" placeholder="0xF101" value="0xF101">
                        </div>
                    </div>
                    
                    <div id="udsDataTypeSection" class="form-group">
                        <label for="udsDataType">Data Type:</label>
                        <select id="udsDataType">
                            <option value="8">8-bit signed</option>
                            <option value="8u">8-bit unsigned</option>
                            <option value="16">16-bit signed</option>
                            <option value="16u" selected>16-bit unsigned</option>
                            <option value="32">32-bit signed</option>
                            <option value="32u">32-bit unsigned</option>
                            <option value="32f">32-bit float</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="udsInterval">Interval (ms):</label>
                        <input type="number" id="udsInterval" min="-1" value="1000">
                        <small>-1 = once, 0 = immediate, >0 = interval in ms</small>
                    </div>
                    
                    <div class="modal-actions">
                        <button id="udsSaveBtn" class="save-btn">Create Widget</button>
                        <button id="udsCancelBtn" class="cancel-btn">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.modal);

        // Обработчики событий
        const closeBtn = this.modal.querySelector('.modal-close');
        const cancelBtn = document.getElementById('udsCancelBtn');
        const saveBtn = document.getElementById('udsSaveBtn');
        const sidTypeSelect = document.getElementById('udsSidType');
        const addressLabel = document.getElementById('udsAddressLabel');

        closeBtn.addEventListener('click', () => this.closeModal());
        cancelBtn.addEventListener('click', () => this.closeModal());
        saveBtn.addEventListener('click', () => this.saveWidget());

        sidTypeSelect.addEventListener('change', (e) => {
            this.updateAddressLabel(e.target.value);
        });

        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });

        // Инициализация
        this.updateAddressLabel('22');
    }

    updateAddressLabel(sidType) {
        const label = document.getElementById('udsAddressLabel');
        const dataTypeSection = document.getElementById('udsDataTypeSection');
        const addressInput = document.getElementById('udsAddress');

        switch(sidType) {
            case '22':
                label.textContent = 'DID (hex):';
                addressInput.placeholder = '0xF101';
                dataTypeSection.style.display = 'block';
                break;
            case '23':
                label.textContent = 'Memory Address (hex):';
                addressInput.placeholder = '0x08001000';
                dataTypeSection.style.display = 'block';
                break;
            case '27':
                label.textContent = 'SubFunction (hex):';
                addressInput.placeholder = '0x01';
                dataTypeSection.style.display = 'none';
                break;
            case '31':
                label.textContent = 'Routine ID (hex):';
                addressInput.placeholder = '0x0203';
                dataTypeSection.style.display = 'none';
                break;
        }
    }

    openModal() {
        this.modal.style.display = 'block';
    }

    closeModal() {
        this.modal.style.display = 'none';
        this.resetModal();
    }

    resetModal() {
        document.getElementById('udsWidgetName').value = '';
        document.getElementById('udsSidType').value = '22';
        document.getElementById('udsAddress').value = '0xF101';
        document.getElementById('udsDataType').value = '16u';
        document.getElementById('udsInterval').value = '1000';
        this.updateAddressLabel('22');
    }

    saveWidget() {
        const name = document.getElementById('udsWidgetName').value;
        const sidType = document.getElementById('udsSidType').value;
        const address = document.getElementById('udsAddress').value;
        const dataType = document.getElementById('udsDataType').value;
        const interval = parseInt(document.getElementById('udsInterval').value);

        if (!name.trim()) {
            alert('Widget name is required');
            return;
        }

        if (!address.match(/^0x[0-9A-Fa-f]+$/)) {
            alert('Invalid address format. Use hex like 0xF101');
            return;
        }

        const widgetId = `uds-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const widget = new UDSWidget({
            id: widgetId,
            name: name,
            sidType: sidType,
            address: address,
            dataType: dataType,
            interval: interval
        });

        widget.onSendRequest = (request) => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify(request));
            }
        };

        widget.onRemove = (id) => {
            this.removeWidget(id);
        };

        this.widgets.set(widgetId, widget);
        this.renderWidgets();
        this.saveToStorage();
        this.closeModal();
    }

    renderWidgets() {
        if (!this.container) return;

        this.container.innerHTML = '';

        if (this.widgets.size === 0) {
            this.container.innerHTML = `
                <div class="no-data-message">
                    No UDS widgets created yet. Click "Add UDS Widget" to create one.
                </div>
            `;
            return;
        }

        this.widgets.forEach((widget, widgetId) => {
            const widgetElement = widget.render();
            this.container.appendChild(widgetElement);
        });
    }

    removeWidget(widgetId) {
        if (!confirm('Remove this UDS widget?')) return;

        const widget = this.widgets.get(widgetId);
        if (widget) {
            widget.destroy();
            this.widgets.delete(widgetId);
            this.saveToStorage();
            this.renderWidgets();
        }
    }

    handleResponse(response) {
        const widget = this.widgets.get(response.widgetId);
        if (widget) {
            widget.handleResponse(response);
        }
    }

    setWebSocket(ws) {
        this.ws = ws;
    }

    saveToStorage() {
        const data = {};
        this.widgets.forEach((widget, id) => {
            data[id] = {
                name: widget.name,
                sidType: widget.sidType,
                address: widget.address,
                dataType: widget.dataType,
                interval: widget.interval
            };
        });
        localStorage.setItem('udsWidgets', JSON.stringify(data));
    }

    loadWidgets() {
        try {
            const saved = localStorage.getItem('udsWidgets');
            if (saved) {
                const data = JSON.parse(saved);
                Object.entries(data).forEach(([id, config]) => {
                    const widget = new UDSWidget({
                        id: id,
                        ...config
                    });

                    widget.onSendRequest = (request) => {
                        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                            this.ws.send(JSON.stringify(request));
                        }
                    };

                    widget.onRemove = (widgetId) => {
                        this.removeWidget(widgetId);
                    };

                    this.widgets.set(id, widget);
                });
            }
        } catch (error) {
            console.error('Error loading UDS widgets:', error);
        }
    }

    getWidgetsState() {
        const state = {};
        this.widgets.forEach((widget, id) => {
            state[id] = {
                name: widget.name,
                sidType: widget.sidType,
                address: widget.address,
                dataType: widget.dataType,
                interval: widget.interval,
                state: widget.state,
                requestCount: widget.requestCount,
                responseCount: widget.responseCount,
                errorCount: widget.errorCount
            };
        });
        return state;
    }

    setWidgetsState(state) {
        this.widgets.clear();
        Object.entries(state).forEach(([id, config]) => {
            const widget = new UDSWidget({
                id: id,
                ...config
            });

            widget.onSendRequest = (request) => {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify(request));
                }
            };

            widget.onRemove = (widgetId) => {
                this.removeWidget(widgetId);
            };

            this.widgets.set(id, widget);
        });
        this.renderWidgets();
    }
}