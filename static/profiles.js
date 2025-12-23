// Profiles module for managing settings profiles

export class ProfilesManager {
    constructor() {
        this.profiles = new Map();
        this.currentProfileId = null;
        this.loadCurrentProfileId();
    }

    // Инициализация модуля
    init() {
        console.log('Profiles module initialized');
        this.setupEventListeners();
        this.loadProfiles();
        this.updateCurrentProfileDisplay();
    }

    // Загрузка текущего профиля из localStorage
    loadCurrentProfileId() {
        try {
            this.currentProfileId = localStorage.getItem('currentProfileId');
            console.log('Loaded current profile ID:', this.currentProfileId);
        } catch (e) {
            console.error('Error loading current profile ID:', e);
            this.currentProfileId = null;
        }
    }

    // Сохранение текущего профиля в localStorage
    saveCurrentProfileId() {
        try {
            if (this.currentProfileId) {
                localStorage.setItem('currentProfileId', this.currentProfileId);
            } else {
                localStorage.removeItem('currentProfileId');
            }
        } catch (e) {
            console.error('Error saving current profile ID:', e);
        }
    }

    // Настройка обработчиков событий
    setupEventListeners() {
        // Кнопка создания профиля
        const createBtn = document.getElementById('createProfileBtn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.openProfileModal());
        }

        // Кнопка обновления списка
        const refreshBtn = document.getElementById('refreshProfilesBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadProfiles());
        }

        // Кнопка сохранения в текущий профиль
        const saveCurrentBtn = document.getElementById('saveCurrentProfileBtn');
        if (saveCurrentBtn) {
            saveCurrentBtn.addEventListener('click', () => this.saveToCurrentProfile());
        }

        // Обработчики модального окна профиля
        const profileModal = document.getElementById('profileModal');
        const profileCloseBtn = profileModal.querySelector('.modal-close');
        const profileCancelBtn = document.getElementById('profileCancelBtn');
        const profileSaveBtn = document.getElementById('profileSaveBtn');

        if (profileCloseBtn) {
            profileCloseBtn.addEventListener('click', () => this.closeProfileModal());
        }

        if (profileCancelBtn) {
            profileCancelBtn.addEventListener('click', () => this.closeProfileModal());
        }

        if (profileSaveBtn) {
            profileSaveBtn.addEventListener('click', () => this.saveProfile());
        }

        // Закрытие по клику вне окна
        profileModal.addEventListener('click', (e) => {
            if (e.target === profileModal) {
                this.closeProfileModal();
            }
        });

        // Обновление JSON при изменении имени или описания
        const nameInput = document.getElementById('profileName');
        const descInput = document.getElementById('profileDescription');

        if (nameInput) {
            nameInput.addEventListener('input', () => this.updateProfileJson());
        }

        if (descInput) {
            descInput.addEventListener('input', () => this.updateProfileJson());
        }
    }

    // Обновление отображения текущего профиля
    updateCurrentProfileDisplay() {
        const currentProfileDisplay = document.getElementById('currentProfileDisplay');
        if (!currentProfileDisplay) return;

        if (this.currentProfileId && this.profiles.has(this.currentProfileId)) {
            const profile = this.profiles.get(this.currentProfileId);
            currentProfileDisplay.innerHTML = `
                <strong>Current Profile:</strong> ${profile.name}
                <button class="profile-btn save-current" id="saveCurrentProfileBtn" style="margin-left: 10px; padding: 4px 8px;">
                    Save Current Settings
                </button>
            `;

            // Добавляем обработчик для кнопки сохранения
            const saveBtn = currentProfileDisplay.querySelector('.save-current');
            if (saveBtn) {
                saveBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.saveToCurrentProfile();
                });
            }
        } else {
            currentProfileDisplay.innerHTML = '<strong>No active profile</strong>';
        }
    }

    // Загрузка всех профилей с сервера
    async loadProfiles() {
        try {
            console.log('Loading profiles from server...');

            // Получаем все настройки
            const response = await fetch('/api/settings');

            if (response.ok) {
                const allSettings = await response.json();
                console.log('All settings from server:', allSettings);

                this.profiles.clear();

                // Фильтруем только профили (ключи начинаются с "profile_")
                const profileSettings = allSettings.filter(setting =>
                    setting.key && setting.key.startsWith('profile_')
                );

                profileSettings.forEach(setting => {
                    try {
                        // Проверяем, что значение существует и является строкой
                        if (!setting.value || typeof setting.value !== 'string') {
                            console.warn('Invalid profile value for key:', setting.key);
                            return;
                        }

                        const profileData = JSON.parse(setting.value);
                        this.profiles.set(setting.key, {
                            id: setting.key,
                            name: profileData.name || setting.key.replace('profile_', '').replace(/_/g, ' '),
                            description: profileData.description || '',
                            data: profileData.data || {},
                            createdAt: profileData.createdAt || new Date().toISOString(),
                            widgetsCount: profileData.data?.widgets ? Object.keys(profileData.data.widgets).length : 0,
                            filtersCount: profileData.data?.filters ? (Array.isArray(profileData.data.filters) ? profileData.data.filters.length : 0) : 0,
                            updatedAt: profileData.updatedAt || profileData.createdAt || new Date().toISOString()
                        });
                    } catch (e) {
                        console.error('Error parsing profile:', setting.key, setting.value, e);
                    }
                });

                console.log(`Loaded ${this.profiles.size} profiles`);
                this.renderProfiles();
                this.updateProfilesCount();
                this.updateCurrentProfileDisplay();
            } else {
                console.error('Failed to load profiles:', response.status);
            }
        } catch (error) {
            console.error('Error loading profiles:', error);
        }
    }

    // Рендеринг списка профилей
    renderProfiles() {
        const container = document.getElementById('profilesContainer');
        if (!container) return;

        container.innerHTML = '';

        if (this.profiles.size === 0) {
            container.innerHTML = `
                <div class="no-data-message" style="grid-column: 1 / -1;">
                    No profiles found. Create your first profile to save current settings.
                </div>
            `;
            return;
        }

        this.profiles.forEach((profile, profileId) => {
            const profileCard = document.createElement('div');
            profileCard.className = 'profile-card';
            const isCurrent = profileId === this.currentProfileId;

            profileCard.innerHTML = `
                <div class="profile-header">
                    <div class="profile-name">
                        ${profile.name}
                        ${isCurrent ? '<span class="current-badge">Current</span>' : ''}
                    </div>
                    <div class="profile-actions">
                        <button class="profile-btn ${isCurrent ? 'current' : 'load'}" 
                                data-profile-id="${profileId}">
                            ${isCurrent ? '✓ Current' : 'Load'}
                        </button>
                        <button class="profile-btn edit" data-profile-id="${profileId}">Edit</button>
                        <button class="profile-btn delete" data-profile-id="${profileId}">Delete</button>
                    </div>
                </div>
                <div class="profile-description">${profile.description || 'No description'}</div>
                <div class="profile-stats">
                    <span>Widgets: ${profile.widgetsCount}</span>
                    <span>Filters: ${profile.filtersCount}</span>
                    <span title="Updated: ${new Date(profile.updatedAt).toLocaleString()}">
                        ${new Date(profile.updatedAt).toLocaleDateString()}
                    </span>
                </div>
                ${isCurrent ? `
                <div class="profile-current-actions">
                    <button class="profile-btn save-current-small" data-profile-id="${profileId}">
                        Save Current Settings
                    </button>
                </div>
                ` : ''}
            `;

            // Добавляем обработчики действий
            const loadBtn = profileCard.querySelector('.load, .current');
            const editBtn = profileCard.querySelector('.edit');
            const deleteBtn = profileCard.querySelector('.delete');
            const saveCurrentBtn = profileCard.querySelector('.save-current-small');

            if (loadBtn) {
                loadBtn.addEventListener('click', () => this.loadProfile(profileId));
            }

            if (editBtn) {
                editBtn.addEventListener('click', () => this.editProfile(profileId));
            }

            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => this.deleteProfile(profileId));
            }

            if (saveCurrentBtn) {
                saveCurrentBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.saveToCurrentProfile();
                });
            }

            container.appendChild(profileCard);
        });
    }

    // Обновление счетчика профилей
    updateProfilesCount() {
        const countElem = document.getElementById('profilesCount');
        if (countElem) {
            countElem.textContent = this.profiles.size;
        }
    }

    // Открытие модального окна профиля
    openProfileModal(profileId = null) {
        const modal = document.getElementById('profileModal');
        const title = document.getElementById('profileModalTitle');
        const nameInput = document.getElementById('profileName');
        const descInput = document.getElementById('profileDescription');
        const jsonInput = document.getElementById('profileJson');

        if (profileId) {
            // Режим редактирования
            title.textContent = 'Edit Profile';
            const profile = this.profiles.get(profileId);

            if (profile) {
                nameInput.value = profile.name;
                descInput.value = profile.description;
                jsonInput.value = JSON.stringify({
                    name: profile.name,
                    description: profile.description,
                    data: profile.data,
                    createdAt: profile.createdAt,
                    updatedAt: profile.updatedAt
                }, null, 2);
            }
        } else {
            // Режим создания
            title.textContent = 'Create New Profile';
            nameInput.value = 'New Profile';
            descInput.value = '';

            // Автоматически генерируем JSON с текущими настройками
            this.updateProfileJson();
        }

        modal.style.display = 'block';
    }

    // Обновление JSON профиля
    async updateProfileJson() {
        const nameInput = document.getElementById('profileName');
        const descInput = document.getElementById('profileDescription');
        const jsonInput = document.getElementById('profileJson');

        if (!nameInput || !descInput || !jsonInput) return;

        try {
            const profileData = await this.generateCurrentSettingsJson();
            const fullProfile = {
                name: nameInput.value.trim() || 'New Profile',
                description: descInput.value.trim(),
                data: profileData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                version: '1.0'
            };

            jsonInput.value = JSON.stringify(fullProfile, null, 2);
        } catch (error) {
            console.error('Error updating profile JSON:', error);
        }
    }

    // Закрытие модального окна профиля
    closeProfileModal() {
        const modal = document.getElementById('profileModal');
        modal.style.display = 'none';
    }

    // Генерация JSON с текущими настройками
    async generateCurrentSettingsJson() {
        try {
            // Получаем текущие виджеты
            const widgets = this.getCurrentWidgets();

            // Получаем текущие фильтры
            const filters = await this.getCurrentFilters();

            // Получаем настройки сендера
            const sender = this.getCurrentSenderSettings();

            // Создаем объект данных профиля
            const profileData = {
                widgets: widgets,
                filters: filters,
                sender: sender,
                timestamp: new Date().toISOString()
            };

            return profileData;
        } catch (error) {
            console.error('Error generating settings JSON:', error);
            return {};
        }
    }

    // Получение текущих виджетов
    getCurrentWidgets() {
        try {
            // Используем функцию из widgets.js
            if (typeof window.getWidgetsState === 'function') {
                return window.getWidgetsState();
            }

            // Или загружаем из localStorage
            const saved = localStorage.getItem('canWidgets');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            console.error('Error getting widgets state:', e);
            return {};
        }
    }

    // Получение текущих фильтров
    async getCurrentFilters() {
        try {
            const response = await fetch('/api/filters');
            if (response.ok) {
                return await response.json();
            }
            return [];
        } catch (error) {
            console.error('Error getting filters:', error);
            return [];
        }
    }

    // Получение настроек сендера
    getCurrentSenderSettings() {
        return {
            canId: document.getElementById('canId').value,
            canData: document.getElementById('canData').value,
            sentCount: parseInt(document.getElementById('sentCount').textContent) || 0
        };
    }

    // Сохранение профиля
    async saveProfile() {
        const nameInput = document.getElementById('profileName');
        const descInput = document.getElementById('profileDescription');
        const jsonInput = document.getElementById('profileJson');

        const profileName = nameInput.value.trim();
        if (!profileName) {
            alert('Profile name is required');
            return;
        }

        try {
            // Парсим JSON для валидации
            const profileData = JSON.parse(jsonInput.value);

            // Генерируем уникальный ключ (если редактируем существующий, используем его ID)
            const modalTitle = document.getElementById('profileModalTitle').textContent;
            let profileKey;

            if (modalTitle === 'Edit Profile') {
                // Находим ID редактируемого профиля
                const profile = Array.from(this.profiles.entries()).find(([id, p]) =>
                    p.name === profileName || p.description === descInput.value
                );
                profileKey = profile ? profile[0] : `profile_${Date.now()}`;
            } else {
                profileKey = `profile_${Date.now()}`;
            }

            // Обновляем дату изменения
            profileData.updatedAt = new Date().toISOString();

            // Отправляем на сервер
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    key: profileKey,
                    value: JSON.stringify(profileData)
                })
            });

            if (response.ok) {
                console.log('Profile saved successfully');
                this.closeProfileModal();
                this.loadProfiles(); // Перезагружаем список

                // Если это текущий профиль, обновляем отображение
                if (profileKey === this.currentProfileId) {
                    this.updateCurrentProfileDisplay();
                }
            } else {
                const errorText = await response.text();
                throw new Error(`Failed to save profile: ${errorText}`);
            }
        } catch (error) {
            console.error('Error saving profile:', error);
            alert('Error saving profile: ' + error.message);
        }
    }

    // Загрузка профиля
    async loadProfile(profileId) {
        if (!confirm('Load this profile? Current settings will be overwritten.')) {
            return;
        }

        try {
            const profile = this.profiles.get(profileId);
            if (!profile) {
                throw new Error('Profile not found');
            }

            // Применяем настройки
            await this.applyProfileSettings(profile.data);

            // Устанавливаем текущий профиль
            this.currentProfileId = profileId;
            this.saveCurrentProfileId();

            // Обновляем отображение
            this.updateCurrentProfileDisplay();
            this.renderProfiles();

            // Переключаемся на основную вкладку
            this.switchToMainTab();

            alert('Profile loaded successfully');
        } catch (error) {
            console.error('Error loading profile:', error);
            alert('Error loading profile: ' + error.message);
        }
    }

    // Сохранение текущих настроек в текущий профиль
    async saveToCurrentProfile() {
        if (!this.currentProfileId) {
            alert('No active profile. Please load a profile first.');
            return;
        }

        if (!confirm('Save current settings to the current profile? This will overwrite the existing profile data.')) {
            return;
        }

        try {
            // Получаем текущий профиль
            const profile = this.profiles.get(this.currentProfileId);
            if (!profile) {
                throw new Error('Current profile not found');
            }

            // Генерируем новые данные профиля
            const profileData = {
                name: profile.name,
                description: profile.description,
                data: await this.generateCurrentSettingsJson(),
                createdAt: profile.createdAt,
                updatedAt: new Date().toISOString(),
                version: '1.0'
            };

            // Сохраняем на сервере
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    key: this.currentProfileId,
                    value: JSON.stringify(profileData)
                })
            });

            if (response.ok) {
                console.log('Settings saved to current profile');
                this.loadProfiles(); // Перезагружаем список профилей
                alert('Current settings saved to profile successfully');
            } else {
                const errorText = await response.text();
                throw new Error(`Failed to save settings: ${errorText}`);
            }
        } catch (error) {
            console.error('Error saving to current profile:', error);
            alert('Error saving to current profile: ' + error.message);
        }
    }

    // Применение настроек профиля
    async applyProfileSettings(settings) {
        try {
            // Применяем виджеты
            if (settings.widgets && typeof window.setWidgetsState === 'function') {
                window.setWidgetsState(settings.widgets);
            }

            // Применяем фильтры
            if (settings.filters && Array.isArray(settings.filters)) {
                await this.applyFilters(settings.filters);
            }

            // Применяем настройки сендера
            if (settings.sender) {
                this.applySenderSettings(settings.sender);
            }
        } catch (error) {
            console.error('Error applying profile settings:', error);
            throw error;
        }
    }

    // Применение фильтров
    async applyFilters(filters) {
        try {
            // Получаем текущие фильтры
            const currentFilters = await this.getCurrentFilters();

            // Удаляем все текущие фильтры
            const deletePromises = currentFilters.map(async filter => {
                try {
                    await fetch(`/api/filters?can_id=${filter.can_id}`, {
                        method: 'DELETE'
                    });
                } catch (error) {
                    console.error('Error deleting filter:', error);
                }
            });

            await Promise.all(deletePromises);

            // Добавляем новые фильтры
            const addPromises = filters.map(async filter => {
                try {
                    await fetch('/api/filters', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(filter)
                    });
                } catch (error) {
                    console.error('Error adding filter:', error);
                }
            });

            await Promise.all(addPromises);

            // Обновляем отображение
            if (typeof window.updateFilterDisplay === 'function') {
                await window.updateFilterDisplay();
            }
        } catch (error) {
            console.error('Error applying filters:', error);
            throw error;
        }
    }

    // Применение настроек сендера
    applySenderSettings(senderSettings) {
        if (senderSettings.canId) {
            document.getElementById('canId').value = senderSettings.canId;
        }
        if (senderSettings.canData) {
            document.getElementById('canData').value = senderSettings.canData;
        }
        if (senderSettings.sentCount) {
            document.getElementById('sentCount').textContent = senderSettings.sentCount;
        }
    }

    // Редактирование профиля
    editProfile(profileId) {
        this.openProfileModal(profileId);
    }

    // Удаление профиля
    async deleteProfile(profileId) {
        if (!confirm('Are you sure you want to delete this profile?')) {
            return;
        }

        try {
            // Удаляем с сервера
            const response = await fetch(`/api/settings?key=${encodeURIComponent(profileId)}`, {
                method: 'DELETE'
            });

            if (response.ok || response.status === 204) {
                console.log('Profile deleted successfully');
                this.profiles.delete(profileId);

                // Если удаляемый профиль был текущим, очищаем текущий профиль
                if (profileId === this.currentProfileId) {
                    this.currentProfileId = null;
                    this.saveCurrentProfileId();
                    this.updateCurrentProfileDisplay();
                }

                this.renderProfiles();
                this.updateProfilesCount();
            } else {
                const errorText = await response.text();
                throw new Error(`Failed to delete profile: ${errorText}`);
            }
        } catch (error) {
            console.error('Error deleting profile:', error);
            alert('Error deleting profile: ' + error.message);
        }
    }

    // Переключение на основную вкладку
    switchToMainTab() {
        const mainTab = document.querySelector('[data-tab="main"]');
        if (mainTab) {
            mainTab.click();
        }
    }

    // Экспортируем публичные методы
    getProfiles() {
        return this.profiles;
    }

    getCurrentProfileId() {
        return this.currentProfileId;
    }

    getCurrentProfile() {
        return this.currentProfileId ? this.profiles.get(this.currentProfileId) : null;
    }
}

// Инициализация вкладок
export function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;

            // Убираем активный класс у всех кнопок и контента
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Добавляем активный класс текущей кнопке и контенту
            btn.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
}