/**
 * 环境变量管理模块
 * 负责处理环境变量的解析、替换、管理等功能
 */

const { EventEmitter } = require('events');

class EnvironmentManager extends EventEmitter {
    constructor(storageManager) {
        super();
        this.storageManager = storageManager;
        this.currentEnvironment = null;
        this.globalVariables = new Map();
        this.sessionVariables = new Map();
        this.variablePattern = /\{\{([^}]+)\}\}/g;
        
        this.loadCurrentEnvironment();
    }

    /**
     * 加载当前环境
     */
    loadCurrentEnvironment() {
        try {
            const environments = this.storageManager.getEnvironments();
            const currentEnvId = environments.current;
            
            if (environments.environments[currentEnvId]) {
                this.currentEnvironment = {
                    id: currentEnvId,
                    ...environments.environments[currentEnvId]
                };
                
                this.emit('environmentLoaded', this.currentEnvironment);
            }
        } catch (error) {
            this.emit('environmentError', { error, operation: 'load' });
        }
    }

    /**
     * 切换环境
     * @param {string} environmentId 环境ID
     */
    switchEnvironment(environmentId) {
        try {
            const environments = this.storageManager.getEnvironments();
            
            if (!environments.environments[environmentId]) {
                throw new Error(`环境 ${environmentId} 不存在`);
            }
            
            // 更新存储中的当前环境
            this.storageManager.setCurrentEnvironment(environmentId);
            
            // 更新本地当前环境
            this.currentEnvironment = {
                id: environmentId,
                ...environments.environments[environmentId]
            };
            
            this.emit('environmentSwitched', this.currentEnvironment);
            
        } catch (error) {
            this.emit('environmentError', { error, operation: 'switch' });
            throw error;
        }
    }

    /**
     * 获取当前环境
     * @returns {Object} 当前环境信息
     */
    getCurrentEnvironment() {
        return this.currentEnvironment;
    }

    /**
     * 获取所有环境
     * @returns {Object} 所有环境
     */
    getAllEnvironments() {
        return this.storageManager.getEnvironments();
    }

    /**
     * 创建新环境
     * @param {Object} environmentData 环境数据
     * @returns {string} 环境ID
     */
    createEnvironment(environmentData) {
        try {
            const envId = this.storageManager.addEnvironment(environmentData);
            this.emit('environmentCreated', { id: envId, data: environmentData });
            return envId;
        } catch (error) {
            this.emit('environmentError', { error, operation: 'create' });
            throw error;
        }
    }

    /**
     * 更新环境
     * @param {string} environmentId 环境ID
     * @param {Object} updates 更新数据
     */
    updateEnvironment(environmentId, updates) {
        try {
            const environments = this.storageManager.getEnvironments();
            
            if (!environments.environments[environmentId]) {
                throw new Error(`环境 ${environmentId} 不存在`);
            }
            
            environments.environments[environmentId] = {
                ...environments.environments[environmentId],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            
            this.storageManager.saveEnvironments(environments);
            
            // 如果更新的是当前环境，重新加载
            if (environmentId === this.currentEnvironment?.id) {
                this.loadCurrentEnvironment();
            }
            
            this.emit('environmentUpdated', { id: environmentId, updates });
            
        } catch (error) {
            this.emit('environmentError', { error, operation: 'update' });
            throw error;
        }
    }

    /**
     * 删除环境
     * @param {string} environmentId 环境ID
     */
    deleteEnvironment(environmentId) {
        try {
            const environments = this.storageManager.getEnvironments();
            
            if (!environments.environments[environmentId]) {
                throw new Error(`环境 ${environmentId} 不存在`);
            }
            
            if (environmentId === 'default') {
                throw new Error('不能删除默认环境');
            }
            
            delete environments.environments[environmentId];
            
            // 如果删除的是当前环境，切换到默认环境
            if (environmentId === environments.current) {
                environments.current = 'default';
                this.loadCurrentEnvironment();
            }
            
            this.storageManager.saveEnvironments(environments);
            this.emit('environmentDeleted', { id: environmentId });
            
        } catch (error) {
            this.emit('environmentError', { error, operation: 'delete' });
            throw error;
        }
    }

    /**
     * 获取环境变量
     * @param {string} environmentId 环境ID（可选，默认当前环境）
     * @returns {Array} 环境变量列表
     */
    getEnvironmentVariables(environmentId = null) {
        const envId = environmentId || this.currentEnvironment?.id;
        
        if (!envId) {
            return [];
        }
        
        const environments = this.storageManager.getEnvironments();
        return environments.environments[envId]?.variables || [];
    }

    /**
     * 设置环境变量
     * @param {string} key 变量名
     * @param {string} value 变量值
     * @param {string} environmentId 环境ID（可选，默认当前环境）
     */
    setEnvironmentVariable(key, value, environmentId = null) {
        const envId = environmentId || this.currentEnvironment?.id;
        
        if (!envId) {
            throw new Error('没有可用的环境');
        }
        
        const environments = this.storageManager.getEnvironments();
        const environment = environments.environments[envId];
        
        if (!environment) {
            throw new Error(`环境 ${envId} 不存在`);
        }
        
        // 查找现有变量
        const existingIndex = environment.variables.findIndex(v => v.key === key);
        
        if (existingIndex >= 0) {
            // 更新现有变量
            environment.variables[existingIndex] = {
                ...environment.variables[existingIndex],
                value,
                updatedAt: new Date().toISOString()
            };
        } else {
            // 添加新变量
            environment.variables.push({
                key,
                value,
                enabled: true,
                description: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }
        
        this.storageManager.saveEnvironments(environments);
        
        // 如果是当前环境，重新加载
        if (envId === this.currentEnvironment?.id) {
            this.loadCurrentEnvironment();
        }
        
        this.emit('variableSet', { key, value, environmentId: envId });
    }

    /**
     * 获取环境变量值
     * @param {string} key 变量名
     * @param {string} environmentId 环境ID（可选，默认当前环境）
     * @returns {string|null} 变量值
     */
    getEnvironmentVariable(key, environmentId = null) {
        const variables = this.getEnvironmentVariables(environmentId);
        const variable = variables.find(v => v.key === key && v.enabled);
        return variable ? variable.value : null;
    }

    /**
     * 删除环境变量
     * @param {string} key 变量名
     * @param {string} environmentId 环境ID（可选，默认当前环境）
     */
    deleteEnvironmentVariable(key, environmentId = null) {
        const envId = environmentId || this.currentEnvironment?.id;
        
        if (!envId) {
            throw new Error('没有可用的环境');
        }
        
        const environments = this.storageManager.getEnvironments();
        const environment = environments.environments[envId];
        
        if (!environment) {
            throw new Error(`环境 ${envId} 不存在`);
        }
        
        const variableIndex = environment.variables.findIndex(v => v.key === key);
        
        if (variableIndex >= 0) {
            environment.variables.splice(variableIndex, 1);
            this.storageManager.saveEnvironments(environments);
            
            // 如果是当前环境，重新加载
            if (envId === this.currentEnvironment?.id) {
                this.loadCurrentEnvironment();
            }
            
            this.emit('variableDeleted', { key, environmentId: envId });
        }
    }

    /**
     * 设置全局变量
     * @param {string} key 变量名
     * @param {string} value 变量值
     */
    setGlobalVariable(key, value) {
        this.globalVariables.set(key, value);
        this.emit('globalVariableSet', { key, value });
    }

    /**
     * 获取全局变量
     * @param {string} key 变量名
     * @returns {string|null} 变量值
     */
    getGlobalVariable(key) {
        return this.globalVariables.get(key) || null;
    }

    /**
     * 设置会话变量
     * @param {string} key 变量名
     * @param {string} value 变量值
     */
    setSessionVariable(key, value) {
        this.sessionVariables.set(key, value);
        this.emit('sessionVariableSet', { key, value });
    }

    /**
     * 获取会话变量
     * @param {string} key 变量名
     * @returns {string|null} 变量值
     */
    getSessionVariable(key) {
        return this.sessionVariables.get(key) || null;
    }

    /**
     * 清空会话变量
     */
    clearSessionVariables() {
        this.sessionVariables.clear();
        this.emit('sessionVariablesCleared');
    }

    /**
     * 解析字符串中的变量
     * @param {string} text 包含变量的文本
     * @param {Object} options 解析选项
     * @returns {Object} 解析结果
     */
    resolveVariables(text, options = {}) {
        if (!text || typeof text !== 'string') {
            return {
                resolved: text,
                variables: [],
                unresolved: []
            };
        }
        
        const variables = [];
        const unresolved = [];
        let resolved = text;
        
        // 查找所有变量
        const matches = [...text.matchAll(this.variablePattern)];
        
        for (const match of matches) {
            const [fullMatch, variableName] = match;
            const trimmedName = variableName.trim();
            
            variables.push({
                name: trimmedName,
                placeholder: fullMatch,
                position: match.index
            });
            
            // 按优先级查找变量值
            let value = null;
            let source = null;
            
            // 1. 会话变量（最高优先级）
            if (this.sessionVariables.has(trimmedName)) {
                value = this.sessionVariables.get(trimmedName);
                source = 'session';
            }
            // 2. 全局变量
            else if (this.globalVariables.has(trimmedName)) {
                value = this.globalVariables.get(trimmedName);
                source = 'global';
            }
            // 3. 当前环境变量
            else if (this.currentEnvironment) {
                const envVar = this.currentEnvironment.variables.find(
                    v => v.key === trimmedName && v.enabled
                );
                if (envVar) {
                    value = envVar.value;
                    source = 'environment';
                }
            }
            // 4. 动态变量（如时间戳等）
            else {
                const dynamicValue = this.resolveDynamicVariable(trimmedName);
                if (dynamicValue !== null) {
                    value = dynamicValue;
                    source = 'dynamic';
                }
            }
            
            if (value !== null) {
                // 替换变量
                resolved = resolved.replace(fullMatch, value);
                variables[variables.length - 1].value = value;
                variables[variables.length - 1].source = source;
            } else {
                // 未解析的变量
                unresolved.push({
                    name: trimmedName,
                    placeholder: fullMatch
                });
                
                if (options.keepUnresolved !== true) {
                    // 移除未解析的变量占位符
                    resolved = resolved.replace(fullMatch, '');
                }
            }
        }
        
        return {
            resolved,
            variables,
            unresolved
        };
    }

    /**
     * 解析动态变量
     * @param {string} variableName 变量名
     * @returns {string|null} 变量值
     */
    resolveDynamicVariable(variableName) {
        const now = new Date();
        
        switch (variableName.toLowerCase()) {
            case 'timestamp':
                return now.getTime().toString();
            case 'datetime':
                return now.toISOString();
            case 'date':
                return now.toISOString().split('T')[0];
            case 'time':
                return now.toTimeString().split(' ')[0];
            case 'uuid':
                return this.generateUUID();
            case 'random':
                return Math.random().toString();
            case 'randomint':
                return Math.floor(Math.random() * 1000).toString();
            default:
                // 检查是否是带参数的动态变量
                if (variableName.startsWith('random(') && variableName.endsWith(')')) {
                    const params = variableName.slice(7, -1).split(',').map(p => p.trim());
                    if (params.length === 2) {
                        const min = parseInt(params[0]);
                        const max = parseInt(params[1]);
                        if (!isNaN(min) && !isNaN(max)) {
                            return (Math.floor(Math.random() * (max - min + 1)) + min).toString();
                        }
                    }
                }
                return null;
        }
    }

    /**
     * 生成UUID
     * @returns {string} UUID
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * 批量解析对象中的变量
     * @param {Object} obj 包含变量的对象
     * @param {Object} options 解析选项
     * @returns {Object} 解析后的对象
     */
    resolveObjectVariables(obj, options = {}) {
        if (!obj || typeof obj !== 'object') {
            return obj;
        }
        
        const resolved = {};
        
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                resolved[key] = this.resolveVariables(value, options).resolved;
            } else if (Array.isArray(value)) {
                resolved[key] = value.map(item => {
                    if (typeof item === 'string') {
                        return this.resolveVariables(item, options).resolved;
                    } else if (typeof item === 'object') {
                        return this.resolveObjectVariables(item, options);
                    }
                    return item;
                });
            } else if (typeof value === 'object') {
                resolved[key] = this.resolveObjectVariables(value, options);
            } else {
                resolved[key] = value;
            }
        }
        
        return resolved;
    }

    /**
     * 从响应中提取变量
     * @param {Object} response 响应对象
     * @param {Array} extractors 提取器配置
     */
    extractVariablesFromResponse(response, extractors = []) {
        if (!response || !extractors.length) {
            return;
        }
        
        extractors.forEach(extractor => {
            try {
                let value = null;
                
                switch (extractor.source) {
                    case 'header':
                        value = response.headers[extractor.path];
                        break;
                    case 'body':
                        if (typeof response.data === 'object') {
                            value = this.getNestedValue(response.data, extractor.path);
                        } else {
                            // 尝试解析JSON
                            try {
                                const parsed = JSON.parse(response.data);
                                value = this.getNestedValue(parsed, extractor.path);
                            } catch (e) {
                                // 如果不是JSON，使用正则表达式提取
                                if (extractor.regex) {
                                    const match = response.data.match(new RegExp(extractor.regex));
                                    value = match ? match[1] || match[0] : null;
                                }
                            }
                        }
                        break;
                    case 'cookie':
                        // 从Set-Cookie头中提取
                        const cookies = response.headers['set-cookie'];
                        if (cookies) {
                            const cookieMatch = cookies.find(c => c.startsWith(`${extractor.path}=`));
                            if (cookieMatch) {
                                value = cookieMatch.split('=')[1].split(';')[0];
                            }
                        }
                        break;
                }
                
                if (value !== null && value !== undefined) {
                    // 根据目标类型设置变量
                    switch (extractor.target) {
                        case 'environment':
                            this.setEnvironmentVariable(extractor.name, value.toString());
                            break;
                        case 'global':
                            this.setGlobalVariable(extractor.name, value.toString());
                            break;
                        case 'session':
                        default:
                            this.setSessionVariable(extractor.name, value.toString());
                            break;
                    }
                    
                    this.emit('variableExtracted', {
                        name: extractor.name,
                        value: value.toString(),
                        source: extractor.source,
                        target: extractor.target
                    });
                }
            } catch (error) {
                this.emit('extractionError', {
                    extractor,
                    error: error.message
                });
            }
        });
    }

    /**
     * 获取嵌套对象的值
     * @param {Object} obj 对象
     * @param {string} path 路径（如 'user.profile.name'）
     * @returns {any} 值
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : null;
        }, obj);
    }

    /**
     * 获取所有可用变量
     * @returns {Object} 所有变量
     */
    getAllVariables() {
        const result = {
            environment: [],
            global: [],
            session: [],
            dynamic: [
                'timestamp', 'datetime', 'date', 'time', 'uuid', 'random', 'randomint'
            ]
        };
        
        // 环境变量
        if (this.currentEnvironment) {
            result.environment = this.currentEnvironment.variables
                .filter(v => v.enabled)
                .map(v => ({ key: v.key, value: v.value, description: v.description }));
        }
        
        // 全局变量
        this.globalVariables.forEach((value, key) => {
            result.global.push({ key, value });
        });
        
        // 会话变量
        this.sessionVariables.forEach((value, key) => {
            result.session.push({ key, value });
        });
        
        return result;
    }

    /**
     * 验证变量名
     * @param {string} name 变量名
     * @returns {boolean} 是否有效
     */
    isValidVariableName(name) {
        // 变量名只能包含字母、数字、下划线和连字符
        return /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name);
    }

    /**
     * 获取变量使用统计
     * @returns {Object} 使用统计
     */
    getVariableUsageStats() {
        const stats = {
            environment: this.currentEnvironment ? this.currentEnvironment.variables.length : 0,
            global: this.globalVariables.size,
            session: this.sessionVariables.size,
            total: 0
        };
        
        stats.total = stats.environment + stats.global + stats.session;
        
        return stats;
    }
}

module.exports = EnvironmentManager;