import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

// 类型声明
declare global {
  interface Window {
    electronAPI: {
      getAppVersion: () => Promise<string>;
      getStoreValue: (key: string) => Promise<any>;
      setStoreValue: (key: string, value: any) => Promise<boolean>;
      showSaveDialog: (options: any) => Promise<any>;
      showOpenDialog: (options: any) => Promise<any>;
      minimize: () => void;
      maximize: () => void;
      close: () => void;
    };
  }
}

// 使用 preload 脚本暴露的安全 API
const { electronAPI } = window;

// 类型定义
interface RequestParam {
    key: string;
    value: string;
    enabled: boolean;
}

interface RequestHeader {
    key: string;
    value: string;
    enabled: boolean;
}

interface AuthConfig {
    type: 'none' | 'bearer' | 'basic' | 'api-key';
    token: string;
    username: string;
    password: string;
    apiKey: string;
    apiValue: string;
}

interface RequestData {
    method: string;
    url: string;
    params: RequestParam[];
    headers: RequestHeader[];
    body: string;
    bodyType: 'none' | 'json' | 'text' | 'form';
    auth: AuthConfig;
}

interface Environment {
    baseUrl: string;
}

interface AppState {
    currentRequest: RequestData;
    collections: any[];
    environment: string;
    environments: Record<string, Environment>;
}

interface Elements {
    methodSelect: HTMLSelectElement;
    urlInput: HTMLInputElement;
    sendBtn: HTMLButtonElement;
    newRequestBtn: HTMLButtonElement;
    saveBtn: HTMLButtonElement;
    importBtn: HTMLButtonElement;
    envSelect: HTMLSelectElement;
    tabHeaders: NodeListOf<Element>;
    tabContents: NodeListOf<Element>;
    paramsTab: HTMLElement;
    headersTab: HTMLElement;
    bodyTab: HTMLElement;
    authTab: HTMLElement;
    paramsList: HTMLElement;
    headersList: HTMLElement;
    bodyTextarea: HTMLTextAreaElement;
    authType: HTMLSelectElement;
    authFields: HTMLElement;
    responseStatus: HTMLElement;
    responseBody: HTMLElement;
    responseHeadersContent: HTMLElement;
    responseCookiesContent: HTMLElement;
    modalOverlay: HTMLElement;
    modalTitle: HTMLElement;
    modalBody: HTMLElement;
    modalCancel: HTMLButtonElement;
    modalConfirm: HTMLButtonElement;
}

// 应用状态
const appState: AppState = {
    currentRequest: {
        method: 'GET',
        url: '',
        params: [],
        headers: [],
        body: '',
        bodyType: 'none',
        auth: {
            type: 'none',
            token: '',
            username: '',
            password: '',
            apiKey: '',
            apiValue: ''
        }
    },
    collections: [],
    environment: 'dev',
    environments: {
        dev: { baseUrl: 'http://localhost:3000' },
        test: { baseUrl: 'https://test-api.example.com' },
        prod: { baseUrl: 'https://api.example.com' }
    }
};

// DOM元素映射
const elements: Elements = {
    methodSelect: document.getElementById('method-select') as HTMLSelectElement,
    urlInput: document.getElementById('url-input') as HTMLInputElement,
    sendBtn: document.getElementById('send-btn') as HTMLButtonElement,
    newRequestBtn: document.getElementById('new-request-btn') as HTMLButtonElement,
    saveBtn: document.getElementById('save-btn') as HTMLButtonElement,
    importBtn: document.getElementById('import-btn') as HTMLButtonElement,
    envSelect: document.getElementById('env-select') as HTMLSelectElement,
    tabHeaders: document.querySelectorAll('.tab-header'),
    tabContents: document.querySelectorAll('.tab-content'),
    paramsTab: document.getElementById('params-tab') as HTMLElement,
    headersTab: document.getElementById('headers-tab') as HTMLElement,
    bodyTab: document.getElementById('body-tab') as HTMLElement,
    authTab: document.getElementById('auth-tab') as HTMLElement,
    paramsList: document.getElementById('params-list') as HTMLElement,
    headersList: document.getElementById('headers-list') as HTMLElement,
    bodyTextarea: document.getElementById('body-textarea') as HTMLTextAreaElement,
    authType: document.getElementById('auth-type') as HTMLSelectElement,
    authFields: document.getElementById('auth-fields') as HTMLElement,
    responseStatus: document.getElementById('response-status') as HTMLElement,
    responseBody: document.getElementById('response-body') as HTMLElement,
    responseHeadersContent: document.getElementById('response-headers-content') as HTMLElement,
    responseCookiesContent: document.getElementById('response-cookies-content') as HTMLElement,
    modalOverlay: document.getElementById('modal-overlay') as HTMLElement,
    modalTitle: document.getElementById('modal-title') as HTMLElement,
    modalBody: document.getElementById('modal-body') as HTMLElement,
    modalCancel: document.getElementById('modal-cancel') as HTMLButtonElement,
    modalConfirm: document.getElementById('modal-confirm') as HTMLButtonElement
};

// 应用初始化
function initApp(): void {
    setupEventListeners();
    loadStoredData();
    updateUI();
}

// 设置事件监听器
function setupEventListeners(): void {
    // 请求方法选择
    elements.methodSelect.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        appState.currentRequest.method = target.value;
        saveAppState();
    });

    // URL输入
    elements.urlInput.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        appState.currentRequest.url = target.value;
        saveAppState();
    });

    // 发送请求
    elements.sendBtn.addEventListener('click', sendRequest);

    // 新建请求
    elements.newRequestBtn.addEventListener('click', newRequest);

    // 保存请求
    elements.saveBtn.addEventListener('click', saveRequest);

    // 导入请求
    elements.importBtn.addEventListener('click', importRequest);

    // 环境选择
    elements.envSelect.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        appState.environment = target.value;
        saveAppState();
    });

    // 标签页切换
    elements.tabHeaders.forEach(header => {
        header.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const tabName = target.getAttribute('data-tab');
            if (tabName) {
                switchTab(tabName);
            }
        });
    });

    // 响应标签页切换
    document.querySelectorAll('.response-tabs .tab-header').forEach(header => {
        header.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const tabName = target.getAttribute('data-tab');
            if (tabName) {
                switchResponseTab(tabName);
            }
        });
    });

    // 请求体类型选择
    document.querySelectorAll('input[name="body-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            appState.currentRequest.bodyType = target.value as RequestData['bodyType'];
            updateBodyEditor();
            saveAppState();
        });
    });

    // 请求体内容
    elements.bodyTextarea.addEventListener('input', (e) => {
        const target = e.target as HTMLTextAreaElement;
        appState.currentRequest.body = target.value;
        saveAppState();
    });

    // 认证类型选择
    elements.authType.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        appState.currentRequest.auth.type = target.value as AuthConfig['type'];
        updateAuthFields();
        saveAppState();
    });

    // 添加参数按钮
    document.getElementById('add-param')?.addEventListener('click', addParam);

    // 添加请求头按钮
    document.getElementById('add-header')?.addEventListener('click', addHeader);

    // 格式化JSON按钮
    document.getElementById('format-json')?.addEventListener('click', formatResponseJson);

    // 复制响应按钮
    document.getElementById('copy-response')?.addEventListener('click', copyResponse);

    // 模态框事件
    elements.modalCancel.addEventListener('click', hideModal);
    elements.modalOverlay.addEventListener('click', (e) => {
        if (e.target === elements.modalOverlay) {
            hideModal();
        }
    });
}

// 切换标签页
function switchTab(tabName: string): void {
    // 更新标签头
    elements.tabHeaders.forEach(header => {
        header.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
    
    // 更新标签内容
    elements.tabContents.forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`)?.classList.add('active');
}

// 切换响应标签页
function switchResponseTab(tabName: string): void {
    // 更新标签头
    document.querySelectorAll('.response-tabs .tab-header').forEach(header => {
        header.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
    
    // 更新标签内容
    document.querySelectorAll('.response-tabs .tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`)?.classList.add('active');
}

// 发送请求
async function sendRequest(): Promise<void> {
    if (!appState.currentRequest.url.trim()) {
        showNotification('请输入请求URL', 'error');
        return;
    }
    
    // 显示加载状态
    elements.sendBtn.innerHTML = '<div class="loading"></div> 发送中...';
    elements.sendBtn.disabled = true;
    
    const startTime = Date.now();
    
    try {
        const config = buildRequestConfig();
        const response = await axios(config);
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        displayResponse(response, duration);
        
    } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        displayError(error as AxiosError, duration);
    } finally {
        // 恢复按钮状态
        elements.sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> 发送';
        elements.sendBtn.disabled = false;
    }
}

// 构建请求配置
function buildRequestConfig(): AxiosRequestConfig {
    const config: AxiosRequestConfig = {
        method: appState.currentRequest.method.toLowerCase() as any,
        url: appState.currentRequest.url,
        timeout: 30000
    };
    
    // 添加查询参数
    if (appState.currentRequest.params.length > 0) {
        config.params = {};
        appState.currentRequest.params.forEach(param => {
            if (param.enabled && param.key && config.params) {
                config.params[param.key] = param.value;
            }
        });
    }
    
    // 添加请求头
    if (appState.currentRequest.headers.length > 0) {
        config.headers = {};
        appState.currentRequest.headers.forEach(header => {
            if (header.enabled && header.key && config.headers) {
                config.headers[header.key] = header.value;
            }
        });
    }
    
    // 添加认证
    const auth = appState.currentRequest.auth;
    if (auth.type === 'bearer' && auth.token) {
        config.headers = config.headers || {};
        config.headers['Authorization'] = `Bearer ${auth.token}`;
    } else if (auth.type === 'basic' && auth.username) {
        config.auth = {
            username: auth.username,
            password: auth.password || ''
        };
    } else if (auth.type === 'api-key' && auth.apiKey) {
        config.headers = config.headers || {};
        config.headers[auth.apiKey] = auth.apiValue;
    }
    
    // 添加请求体
    if (['post', 'put', 'patch'].includes(config.method as string) && appState.currentRequest.bodyType !== 'none') {
        if (appState.currentRequest.bodyType === 'json') {
            try {
                config.data = JSON.parse(appState.currentRequest.body || '{}');
                config.headers = config.headers || {};
                config.headers['Content-Type'] = 'application/json';
            } catch (e) {
                throw new Error('JSON格式错误: ' + (e as Error).message);
            }
        } else {
            config.data = appState.currentRequest.body;
        }
    }
    
    return config;
}

// 显示响应
function displayResponse(response: AxiosResponse, duration: number): void {
    // 更新状态信息
    elements.responseStatus.innerHTML = `
        <span class="status-success">${response.status} ${response.statusText}</span>
        <span>• ${duration}ms</span>
        <span>• ${formatBytes(JSON.stringify(response.data).length)}</span>
    `;
    
    // 显示响应体
    let responseText = '';
    if (typeof response.data === 'object') {
        responseText = JSON.stringify(response.data, null, 2);
    } else {
        responseText = response.data;
    }
    elements.responseBody.textContent = responseText;
    
    // 显示响应头
    let headersHtml = '<div class="headers-list">';
    Object.entries(response.headers).forEach(([key, value]) => {
        headersHtml += `
            <div class="header-item">
                <strong>${key}:</strong> ${value}
            </div>
        `;
    });
    headersHtml += '</div>';
    elements.responseHeadersContent.innerHTML = headersHtml;
    
    // 显示Cookies（如果有）
    const cookies = response.headers['set-cookie'];
    if (cookies) {
        let cookiesHtml = '<div class="cookies-list">';
        cookies.forEach((cookie: string) => {
            cookiesHtml += `<div class="cookie-item">${cookie}</div>`;
        });
        cookiesHtml += '</div>';
        elements.responseCookiesContent.innerHTML = cookiesHtml;
    } else {
        elements.responseCookiesContent.innerHTML = '<p>无Cookies</p>';
    }
}

// 显示错误
function displayError(error: AxiosError, duration: number): void {
    let status = '错误';
    let statusClass = 'status-error';
    
    if (error.response) {
        status = `${error.response.status} ${error.response.statusText}`;
        displayResponse(error.response, duration);
    } else if (error.request) {
        status = '网络错误';
        elements.responseBody.textContent = '请求超时或网络连接失败';
    } else {
        status = '请求配置错误';
        elements.responseBody.textContent = error.message;
    }
    
    elements.responseStatus.innerHTML = `
        <span class="${statusClass}">${status}</span>
        <span>• ${duration}ms</span>
    `;
}

// 添加参数
function addParam(): void {
    const param: RequestParam = { key: '', value: '', enabled: true };
    appState.currentRequest.params.push(param);
    renderParams();
    saveAppState();
}

// 渲染参数列表
function renderParams(): void {
    const html = appState.currentRequest.params.map((param, index) => `
        <div class="param-item">
            <input type="checkbox" ${param.enabled ? 'checked' : ''} 
                   onchange="toggleParam(${index})">
            <input type="text" placeholder="参数名" value="${param.key}" 
                   onchange="updateParam(${index}, 'key', this.value)">
            <input type="text" placeholder="参数值" value="${param.value}" 
                   onchange="updateParam(${index}, 'value', this.value)">
            <button onclick="removeParam(${index})" class="btn-remove">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
    
    elements.paramsList.innerHTML = html;
}

// 添加请求头
function addHeader(): void {
    const header: RequestHeader = { key: '', value: '', enabled: true };
    appState.currentRequest.headers.push(header);
    renderHeaders();
    saveAppState();
}

// 渲染请求头列表
function renderHeaders(): void {
    const html = appState.currentRequest.headers.map((header, index) => `
        <div class="header-item">
            <input type="checkbox" ${header.enabled ? 'checked' : ''} 
                   onchange="toggleHeader(${index})">
            <input type="text" placeholder="请求头名" value="${header.key}" 
                   onchange="updateHeader(${index}, 'key', this.value)">
            <input type="text" placeholder="请求头值" value="${header.value}" 
                   onchange="updateHeader(${index}, 'value', this.value)">
            <button onclick="removeHeader(${index})" class="btn-remove">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
    
    elements.headersList.innerHTML = html;
}

// 更新请求体编辑器
function updateBodyEditor(): void {
    const bodyType = appState.currentRequest.bodyType;
    
    if (bodyType === 'none') {
        elements.bodyTextarea.style.display = 'none';
    } else {
        elements.bodyTextarea.style.display = 'block';
        
        if (bodyType === 'json' && !appState.currentRequest.body) {
            elements.bodyTextarea.value = '{\n  \n}';
            appState.currentRequest.body = elements.bodyTextarea.value;
        }
    }
}

// 更新认证字段
function updateAuthFields(): void {
    const authType = appState.currentRequest.auth.type;
    let html = '';
    
    switch (authType) {
        case 'bearer':
            html = `
                <div class="auth-field">
                    <label>Bearer Token:</label>
                    <input type="text" id="auth-token" placeholder="输入Token" 
                           value="${appState.currentRequest.auth.token}" 
                           onchange="updateAuthField('token', this.value)">
                </div>
            `;
            break;
        case 'basic':
            html = `
                <div class="auth-field">
                    <label>用户名:</label>
                    <input type="text" id="auth-username" placeholder="输入用户名" 
                           value="${appState.currentRequest.auth.username}" 
                           onchange="updateAuthField('username', this.value)">
                </div>
                <div class="auth-field">
                    <label>密码:</label>
                    <input type="password" id="auth-password" placeholder="输入密码" 
                           value="${appState.currentRequest.auth.password}" 
                           onchange="updateAuthField('password', this.value)">
                </div>
            `;
            break;
        case 'api-key':
            html = `
                <div class="auth-field">
                    <label>API Key名称:</label>
                    <input type="text" id="auth-api-key" placeholder="如: X-API-Key" 
                           value="${appState.currentRequest.auth.apiKey}" 
                           onchange="updateAuthField('apiKey', this.value)">
                </div>
                <div class="auth-field">
                    <label>API Key值:</label>
                    <input type="text" id="auth-api-value" placeholder="输入API Key值" 
                           value="${appState.currentRequest.auth.apiValue}" 
                           onchange="updateAuthField('apiValue', this.value)">
                </div>
            `;
            break;
    }
    
    elements.authFields.innerHTML = html;
}

// 全局函数（供HTML调用）
(window as any).toggleParam = function(index: number): void {
    appState.currentRequest.params[index].enabled = !appState.currentRequest.params[index].enabled;
    saveAppState();
};

(window as any).updateParam = function(index: number, field: string, value: string): void {
    (appState.currentRequest.params[index] as any)[field] = value;
    saveAppState();
};

(window as any).removeParam = function(index: number): void {
    appState.currentRequest.params.splice(index, 1);
    renderParams();
    saveAppState();
};

(window as any).toggleHeader = function(index: number): void {
    appState.currentRequest.headers[index].enabled = !appState.currentRequest.headers[index].enabled;
    saveAppState();
};

(window as any).updateHeader = function(index: number, field: string, value: string): void {
    (appState.currentRequest.headers[index] as any)[field] = value;
    saveAppState();
};

(window as any).removeHeader = function(index: number): void {
    appState.currentRequest.headers.splice(index, 1);
    renderHeaders();
    saveAppState();
};

(window as any).updateAuthField = function(field: string, value: string): void {
    (appState.currentRequest.auth as any)[field] = value;
    saveAppState();
};

// 工具函数
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatResponseJson(): void {
    try {
        const text = elements.responseBody.textContent || '';
        const json = JSON.parse(text);
        elements.responseBody.textContent = JSON.stringify(json, null, 2);
    } catch (e) {
        showNotification('响应内容不是有效的JSON格式', 'error');
    }
}

function copyResponse(): void {
    navigator.clipboard.writeText(elements.responseBody.textContent || '')
        .then(() => showNotification('响应内容已复制到剪贴板', 'success'))
        .catch(() => showNotification('复制失败', 'error'));
}

function newRequest(): void {
    appState.currentRequest = {
        method: 'GET',
        url: '',
        params: [],
        headers: [],
        body: '',
        bodyType: 'none',
        auth: {
            type: 'none',
            token: '',
            username: '',
            password: '',
            apiKey: '',
            apiValue: ''
        }
    };
    updateUI();
    saveAppState();
}

function saveRequest(): void {
    showModal('保存请求', `
        <div class="form-group">
            <label for="request-name">请求名称:</label>
            <input type="text" id="request-name" placeholder="输入请求名称">
        </div>
        <div class="form-group">
            <label for="collection-select">保存到集合:</label>
            <select id="collection-select">
                <option value="">选择集合...</option>
            </select>
        </div>
    `, () => {
        const nameInput = document.getElementById('request-name') as HTMLInputElement;
        const name = nameInput?.value;
        if (!name?.trim()) {
            showNotification('请输入请求名称', 'error');
            return;
        }
        // 保存逻辑
        showNotification('请求已保存', 'success');
        hideModal();
    });
}

function importRequest(): void {
    showNotification('导入功能开发中...', 'info');
}

function showAbout(): void {
    showModal('关于 ZeAPI', `
        <div class="about-content">
            <h4>ZeAPI v1.0.0</h4>
            <p>一个现代化的API测试工具</p>
            <p>基于 Electron 构建</p>
            <p>© 2024 Lemwood</p>
        </div>
    `);
}

function showModal(title: string, content: string, onConfirm?: () => void): void {
    elements.modalTitle.textContent = title;
    elements.modalBody.innerHTML = content;
    elements.modalOverlay.classList.add('show');
    
    if (onConfirm) {
        elements.modalConfirm.onclick = onConfirm;
        elements.modalConfirm.style.display = 'block';
    } else {
        elements.modalConfirm.style.display = 'none';
    }
}

function hideModal(): void {
    elements.modalOverlay.classList.remove('show');
    elements.modalConfirm.onclick = null;
}

type NotificationType = 'info' | 'success' | 'error' | 'warning';

function showNotification(message: string, type: NotificationType = 'info'): void {
    // 简单的通知实现
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 4px;
        color: white;
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    switch (type) {
        case 'success':
            notification.style.backgroundColor = '#28a745';
            break;
        case 'error':
            notification.style.backgroundColor = '#dc3545';
            break;
        case 'warning':
            notification.style.backgroundColor = '#ffc107';
            notification.style.color = '#000';
            break;
        default:
            notification.style.backgroundColor = '#17a2b8';
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function updateUI(): void {
    // 更新表单值
    elements.methodSelect.value = appState.currentRequest.method;
    elements.urlInput.value = appState.currentRequest.url;
    elements.bodyTextarea.value = appState.currentRequest.body;
    elements.authType.value = appState.currentRequest.auth.type;
    elements.envSelect.value = appState.environment;
    
    // 更新请求体类型
    const bodyTypeRadio = document.querySelector(`input[name="body-type"][value="${appState.currentRequest.bodyType}"]`) as HTMLInputElement;
    if (bodyTypeRadio) {
        bodyTypeRadio.checked = true;
    }
    
    // 渲染列表
    renderParams();
    renderHeaders();
    updateBodyEditor();
    updateAuthFields();
}

function saveAppState(): void {
    electronAPI.setStoreValue('appState', appState);
}

async function loadStoredData(): Promise<void> {
    try {
        const storedState = await electronAPI.getStoreValue('appState');
        if (storedState) {
            Object.assign(appState, storedState);
        }
    } catch (error) {
        console.error('加载存储数据失败:', error);
    }
}

// 应用启动
document.addEventListener('DOMContentLoaded', initApp);

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .param-item,
    .header-item {
        display: flex;
        gap: 8px;
        align-items: center;
        padding: 8px;
        border: 1px solid #e1e1e1;
        border-radius: 4px;
        background: #f8f9fa;
    }
    
    .param-item input,
    .header-item input {
        flex: 1;
        padding: 4px 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 13px;
    }
    
    .btn-remove {
        background: #dc3545;
        color: white;
        border: none;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
    }
    
    .auth-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    
    .auth-field label {
        font-weight: 600;
        font-size: 14px;
    }
    
    .auth-field input {
        padding: 6px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
    }
    
    .form-group {
        margin-bottom: 16px;
    }
    
    .form-group label {
        display: block;
        margin-bottom: 4px;
        font-weight: 600;
    }
    
    .form-group input,
    .form-group select {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
    }
    
    .about-content {
        text-align: center;
    }
    
    .about-content h4 {
        margin-bottom: 16px;
        color: #007acc;
    }
    
    .about-content p {
        margin-bottom: 8px;
        color: #666;
    }
`;
document.head.appendChild(style);