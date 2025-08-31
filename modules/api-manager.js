/**
 * API请求管理模块
 * 负责处理API请求的发送、响应处理、历史记录等功能
 */

const axios = require('axios');
const { EventEmitter } = require('events');

class ApiManager extends EventEmitter {
    constructor() {
        super();
        this.requestHistory = [];
        this.activeRequests = new Map();
        this.interceptors = {
            request: [],
            response: []
        };
        this.setupAxiosInterceptors();
    }

    /**
     * 设置Axios拦截器
     */
    setupAxiosInterceptors() {
        // 请求拦截器
        axios.interceptors.request.use(
            (config) => {
                // 添加请求ID用于跟踪
                config.requestId = this.generateRequestId();
                config.startTime = Date.now();
                
                // 触发请求开始事件
                this.emit('requestStart', {
                    id: config.requestId,
                    config: this.sanitizeConfig(config)
                });
                
                // 执行自定义请求拦截器
                this.interceptors.request.forEach(interceptor => {
                    config = interceptor(config) || config;
                });
                
                return config;
            },
            (error) => {
                this.emit('requestError', { error });
                return Promise.reject(error);
            }
        );

        // 响应拦截器
        axios.interceptors.response.use(
            (response) => {
                const duration = Date.now() - response.config.startTime;
                response.duration = duration;
                
                // 触发响应成功事件
                this.emit('responseSuccess', {
                    id: response.config.requestId,
                    response: this.sanitizeResponse(response),
                    duration
                });
                
                // 执行自定义响应拦截器
                this.interceptors.response.forEach(interceptor => {
                    response = interceptor(response) || response;
                });
                
                return response;
            },
            (error) => {
                const duration = error.config ? Date.now() - error.config.startTime : 0;
                
                this.emit('responseError', {
                    id: error.config?.requestId,
                    error: this.sanitizeError(error),
                    duration
                });
                
                return Promise.reject(error);
            }
        );
    }

    /**
     * 发送API请求
     * @param {Object} requestConfig 请求配置
     * @returns {Promise} 请求Promise
     */
    async sendRequest(requestConfig) {
        try {
            // 验证请求配置
            this.validateRequestConfig(requestConfig);
            
            // 构建Axios配置
            const axiosConfig = this.buildAxiosConfig(requestConfig);
            
            // 存储活跃请求
            const requestId = axiosConfig.requestId || this.generateRequestId();
            axiosConfig.requestId = requestId;
            
            const cancelToken = axios.CancelToken.source();
            axiosConfig.cancelToken = cancelToken.token;
            
            this.activeRequests.set(requestId, {
                config: axiosConfig,
                cancelToken,
                startTime: Date.now()
            });
            
            // 发送请求
            const response = await axios(axiosConfig);
            
            // 保存到历史记录
            this.addToHistory({
                id: requestId,
                request: requestConfig,
                response: this.sanitizeResponse(response),
                timestamp: new Date().toISOString(),
                duration: response.duration
            });
            
            // 清理活跃请求
            this.activeRequests.delete(requestId);
            
            return response;
            
        } catch (error) {
            // 清理活跃请求
            if (error.config?.requestId) {
                this.activeRequests.delete(error.config.requestId);
            }
            
            throw error;
        }
    }

    /**
     * 取消请求
     * @param {string} requestId 请求ID
     */
    cancelRequest(requestId) {
        const activeRequest = this.activeRequests.get(requestId);
        if (activeRequest) {
            activeRequest.cancelToken.cancel('请求被用户取消');
            this.activeRequests.delete(requestId);
            this.emit('requestCancelled', { id: requestId });
        }
    }

    /**
     * 取消所有活跃请求
     */
    cancelAllRequests() {
        this.activeRequests.forEach((request, id) => {
            request.cancelToken.cancel('批量取消请求');
        });
        this.activeRequests.clear();
        this.emit('allRequestsCancelled');
    }

    /**
     * 验证请求配置
     * @param {Object} config 请求配置
     */
    validateRequestConfig(config) {
        if (!config.url) {
            throw new Error('请求URL不能为空');
        }
        
        if (!config.method) {
            throw new Error('请求方法不能为空');
        }
        
        // 验证URL格式
        try {
            new URL(config.url.startsWith('http') ? config.url : `http://${config.url}`);
        } catch (e) {
            throw new Error('请求URL格式不正确');
        }
    }

    /**
     * 构建Axios配置
     * @param {Object} requestConfig 请求配置
     * @returns {Object} Axios配置
     */
    buildAxiosConfig(requestConfig) {
        const config = {
            method: requestConfig.method.toLowerCase(),
            url: requestConfig.url,
            timeout: requestConfig.timeout || 30000,
            headers: {},
            validateStatus: () => true // 接受所有状态码
        };

        // 添加查询参数
        if (requestConfig.params && requestConfig.params.length > 0) {
            config.params = {};
            requestConfig.params.forEach(param => {
                if (param.enabled && param.key) {
                    config.params[param.key] = param.value;
                }
            });
        }

        // 添加请求头
        if (requestConfig.headers && requestConfig.headers.length > 0) {
            requestConfig.headers.forEach(header => {
                if (header.enabled && header.key) {
                    config.headers[header.key] = header.value;
                }
            });
        }

        // 添加认证
        this.addAuthentication(config, requestConfig.auth);

        // 添加请求体
        if (['post', 'put', 'patch'].includes(config.method)) {
            this.addRequestBody(config, requestConfig);
        }

        return config;
    }

    /**
     * 添加认证信息
     * @param {Object} config Axios配置
     * @param {Object} auth 认证配置
     */
    addAuthentication(config, auth) {
        if (!auth || auth.type === 'none') return;

        switch (auth.type) {
            case 'bearer':
                if (auth.token) {
                    config.headers['Authorization'] = `Bearer ${auth.token}`;
                }
                break;
            case 'basic':
                if (auth.username) {
                    config.auth = {
                        username: auth.username,
                        password: auth.password || ''
                    };
                }
                break;
            case 'api-key':
                if (auth.apiKey && auth.apiValue) {
                    config.headers[auth.apiKey] = auth.apiValue;
                }
                break;
        }
    }

    /**
     * 添加请求体
     * @param {Object} config Axios配置
     * @param {Object} requestConfig 请求配置
     */
    addRequestBody(config, requestConfig) {
        if (!requestConfig.body || requestConfig.bodyType === 'none') return;

        switch (requestConfig.bodyType) {
            case 'json':
                try {
                    config.data = JSON.parse(requestConfig.body);
                    config.headers['Content-Type'] = 'application/json';
                } catch (e) {
                    throw new Error(`JSON格式错误: ${e.message}`);
                }
                break;
            case 'form':
                // 解析表单数据
                const formData = new URLSearchParams();
                try {
                    const formObj = JSON.parse(requestConfig.body);
                    Object.entries(formObj).forEach(([key, value]) => {
                        formData.append(key, value);
                    });
                    config.data = formData;
                    config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
                } catch (e) {
                    config.data = requestConfig.body;
                    config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
                }
                break;
            case 'raw':
            default:
                config.data = requestConfig.body;
                break;
        }
    }

    /**
     * 添加请求拦截器
     * @param {Function} interceptor 拦截器函数
     */
    addRequestInterceptor(interceptor) {
        this.interceptors.request.push(interceptor);
    }

    /**
     * 添加响应拦截器
     * @param {Function} interceptor 拦截器函数
     */
    addResponseInterceptor(interceptor) {
        this.interceptors.response.push(interceptor);
    }

    /**
     * 获取请求历史
     * @param {number} limit 限制数量
     * @returns {Array} 历史记录
     */
    getHistory(limit = 50) {
        return this.requestHistory.slice(-limit);
    }

    /**
     * 清空请求历史
     */
    clearHistory() {
        this.requestHistory = [];
        this.emit('historyClear');
    }

    /**
     * 添加到历史记录
     * @param {Object} record 记录对象
     */
    addToHistory(record) {
        this.requestHistory.push(record);
        
        // 限制历史记录数量
        if (this.requestHistory.length > 1000) {
            this.requestHistory = this.requestHistory.slice(-500);
        }
        
        this.emit('historyAdd', record);
    }

    /**
     * 生成请求ID
     * @returns {string} 请求ID
     */
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 清理配置对象（移除敏感信息）
     * @param {Object} config 配置对象
     * @returns {Object} 清理后的配置
     */
    sanitizeConfig(config) {
        const sanitized = { ...config };
        
        // 移除敏感信息
        if (sanitized.auth) {
            sanitized.auth = { ...sanitized.auth };
            if (sanitized.auth.password) {
                sanitized.auth.password = '***';
            }
        }
        
        if (sanitized.headers && sanitized.headers.Authorization) {
            sanitized.headers.Authorization = sanitized.headers.Authorization.replace(/Bearer .+/, 'Bearer ***');
        }
        
        return sanitized;
    }

    /**
     * 清理响应对象
     * @param {Object} response 响应对象
     * @returns {Object} 清理后的响应
     */
    sanitizeResponse(response) {
        return {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            data: response.data,
            duration: response.duration
        };
    }

    /**
     * 清理错误对象
     * @param {Error} error 错误对象
     * @returns {Object} 清理后的错误
     */
    sanitizeError(error) {
        const sanitized = {
            message: error.message,
            code: error.code
        };
        
        if (error.response) {
            sanitized.response = this.sanitizeResponse(error.response);
        }
        
        if (error.request) {
            sanitized.request = {
                method: error.request.method,
                url: error.request.url
            };
        }
        
        return sanitized;
    }

    /**
     * 获取活跃请求列表
     * @returns {Array} 活跃请求列表
     */
    getActiveRequests() {
        const requests = [];
        this.activeRequests.forEach((request, id) => {
            requests.push({
                id,
                method: request.config.method,
                url: request.config.url,
                startTime: request.startTime,
                duration: Date.now() - request.startTime
            });
        });
        return requests;
    }

    /**
     * 导出请求配置
     * @param {Object} requestConfig 请求配置
     * @returns {Object} 导出的配置
     */
    exportRequest(requestConfig) {
        return {
            name: requestConfig.name || 'Untitled Request',
            method: requestConfig.method,
            url: requestConfig.url,
            params: requestConfig.params || [],
            headers: requestConfig.headers || [],
            body: requestConfig.body || '',
            bodyType: requestConfig.bodyType || 'none',
            auth: requestConfig.auth || { type: 'none' },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 导入请求配置
     * @param {Object} exportedConfig 导出的配置
     * @returns {Object} 请求配置
     */
    importRequest(exportedConfig) {
        return {
            method: exportedConfig.method || 'GET',
            url: exportedConfig.url || '',
            params: exportedConfig.params || [],
            headers: exportedConfig.headers || [],
            body: exportedConfig.body || '',
            bodyType: exportedConfig.bodyType || 'none',
            auth: exportedConfig.auth || { type: 'none' }
        };
    }
}

module.exports = ApiManager;