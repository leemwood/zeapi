/**
 * 数据存储管理模块
 * 负责处理应用数据的本地存储、导入导出、备份恢复等功能
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { EventEmitter } = require('events');

class StorageManager extends EventEmitter {
    constructor() {
        super();
        this.userDataPath = app.getPath('userData');
        this.dataPath = path.join(this.userDataPath, 'zeapi-data');
        this.collectionsPath = path.join(this.dataPath, 'collections.json');
        this.environmentsPath = path.join(this.dataPath, 'environments.json');
        this.settingsPath = path.join(this.dataPath, 'settings.json');
        this.historyPath = path.join(this.dataPath, 'history.json');
        this.backupPath = path.join(this.dataPath, 'backups');
        
        this.initializeStorage();
    }

    /**
     * 初始化存储目录和文件
     */
    initializeStorage() {
        try {
            // 创建数据目录
            if (!fs.existsSync(this.dataPath)) {
                fs.mkdirSync(this.dataPath, { recursive: true });
            }
            
            // 创建备份目录
            if (!fs.existsSync(this.backupPath)) {
                fs.mkdirSync(this.backupPath, { recursive: true });
            }
            
            // 初始化默认数据文件
            this.initializeDefaultFiles();
            
            this.emit('storageInitialized');
        } catch (error) {
            this.emit('storageError', { error, operation: 'initialize' });
            throw error;
        }
    }

    /**
     * 初始化默认数据文件
     */
    initializeDefaultFiles() {
        const defaultData = {
            collections: {
                folders: [],
                requests: []
            },
            environments: {
                current: 'default',
                environments: {
                    default: {
                        name: '默认环境',
                        variables: []
                    }
                }
            },
            settings: {
                theme: 'light',
                fontSize: 14,
                timeout: 30000,
                followRedirects: true,
                validateSSL: true,
                autoSave: true,
                maxHistoryItems: 1000,
                language: 'zh-CN'
            },
            history: {
                requests: [],
                lastCleanup: new Date().toISOString()
            }
        };

        // 创建默认文件（如果不存在）
        Object.entries({
            [this.collectionsPath]: defaultData.collections,
            [this.environmentsPath]: defaultData.environments,
            [this.settingsPath]: defaultData.settings,
            [this.historyPath]: defaultData.history
        }).forEach(([filePath, defaultContent]) => {
            if (!fs.existsSync(filePath)) {
                this.writeJsonFile(filePath, defaultContent);
            }
        });
    }

    /**
     * 读取JSON文件
     * @param {string} filePath 文件路径
     * @returns {Object} 解析后的JSON对象
     */
    readJsonFile(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                return null;
            }
            
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            this.emit('storageError', { error, operation: 'read', filePath });
            throw new Error(`读取文件失败: ${error.message}`);
        }
    }

    /**
     * 写入JSON文件
     * @param {string} filePath 文件路径
     * @param {Object} data 要写入的数据
     */
    writeJsonFile(filePath, data) {
        try {
            const content = JSON.stringify(data, null, 2);
            fs.writeFileSync(filePath, content, 'utf8');
            this.emit('dataWritten', { filePath, size: content.length });
        } catch (error) {
            this.emit('storageError', { error, operation: 'write', filePath });
            throw new Error(`写入文件失败: ${error.message}`);
        }
    }

    /**
     * 获取请求集合数据
     * @returns {Object} 集合数据
     */
    getCollections() {
        return this.readJsonFile(this.collectionsPath) || {
            folders: [],
            requests: []
        };
    }

    /**
     * 保存请求集合数据
     * @param {Object} collections 集合数据
     */
    saveCollections(collections) {
        this.writeJsonFile(this.collectionsPath, collections);
        this.emit('collectionsUpdated', collections);
    }

    /**
     * 添加请求到集合
     * @param {Object} request 请求对象
     * @param {string} folderId 文件夹ID（可选）
     * @returns {string} 请求ID
     */
    addRequest(request, folderId = null) {
        const collections = this.getCollections();
        const requestId = this.generateId();
        
        const newRequest = {
            id: requestId,
            name: request.name || 'Untitled Request',
            method: request.method,
            url: request.url,
            params: request.params || [],
            headers: request.headers || [],
            body: request.body || '',
            bodyType: request.bodyType || 'none',
            auth: request.auth || { type: 'none' },
            folderId: folderId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        collections.requests.push(newRequest);
        this.saveCollections(collections);
        
        return requestId;
    }

    /**
     * 更新请求
     * @param {string} requestId 请求ID
     * @param {Object} updates 更新数据
     */
    updateRequest(requestId, updates) {
        const collections = this.getCollections();
        const requestIndex = collections.requests.findIndex(r => r.id === requestId);
        
        if (requestIndex === -1) {
            throw new Error('请求不存在');
        }
        
        collections.requests[requestIndex] = {
            ...collections.requests[requestIndex],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        
        this.saveCollections(collections);
        this.emit('requestUpdated', { id: requestId, request: collections.requests[requestIndex] });
    }

    /**
     * 删除请求
     * @param {string} requestId 请求ID
     */
    deleteRequest(requestId) {
        const collections = this.getCollections();
        const requestIndex = collections.requests.findIndex(r => r.id === requestId);
        
        if (requestIndex === -1) {
            throw new Error('请求不存在');
        }
        
        const deletedRequest = collections.requests.splice(requestIndex, 1)[0];
        this.saveCollections(collections);
        this.emit('requestDeleted', { id: requestId, request: deletedRequest });
    }

    /**
     * 添加文件夹
     * @param {Object} folder 文件夹对象
     * @returns {string} 文件夹ID
     */
    addFolder(folder) {
        const collections = this.getCollections();
        const folderId = this.generateId();
        
        const newFolder = {
            id: folderId,
            name: folder.name || 'New Folder',
            description: folder.description || '',
            parentId: folder.parentId || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        collections.folders.push(newFolder);
        this.saveCollections(collections);
        
        return folderId;
    }

    /**
     * 获取环境数据
     * @returns {Object} 环境数据
     */
    getEnvironments() {
        return this.readJsonFile(this.environmentsPath) || {
            current: 'default',
            environments: {
                default: {
                    name: '默认环境',
                    variables: []
                }
            }
        };
    }

    /**
     * 保存环境数据
     * @param {Object} environments 环境数据
     */
    saveEnvironments(environments) {
        this.writeJsonFile(this.environmentsPath, environments);
        this.emit('environmentsUpdated', environments);
    }

    /**
     * 添加环境
     * @param {Object} environment 环境对象
     * @returns {string} 环境ID
     */
    addEnvironment(environment) {
        const environments = this.getEnvironments();
        const envId = this.generateId();
        
        environments.environments[envId] = {
            name: environment.name || 'New Environment',
            variables: environment.variables || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.saveEnvironments(environments);
        return envId;
    }

    /**
     * 设置当前环境
     * @param {string} environmentId 环境ID
     */
    setCurrentEnvironment(environmentId) {
        const environments = this.getEnvironments();
        
        if (!environments.environments[environmentId]) {
            throw new Error('环境不存在');
        }
        
        environments.current = environmentId;
        this.saveEnvironments(environments);
    }

    /**
     * 获取应用设置
     * @returns {Object} 设置数据
     */
    getSettings() {
        return this.readJsonFile(this.settingsPath) || {
            theme: 'light',
            fontSize: 14,
            timeout: 30000,
            followRedirects: true,
            validateSSL: true,
            autoSave: true,
            maxHistoryItems: 1000,
            language: 'zh-CN'
        };
    }

    /**
     * 保存应用设置
     * @param {Object} settings 设置数据
     */
    saveSettings(settings) {
        this.writeJsonFile(this.settingsPath, settings);
        this.emit('settingsUpdated', settings);
    }

    /**
     * 获取历史记录
     * @param {number} limit 限制数量
     * @returns {Array} 历史记录
     */
    getHistory(limit = 50) {
        const history = this.readJsonFile(this.historyPath) || { requests: [] };
        return history.requests.slice(-limit);
    }

    /**
     * 添加历史记录
     * @param {Object} record 历史记录
     */
    addHistory(record) {
        const history = this.readJsonFile(this.historyPath) || { requests: [] };
        const settings = this.getSettings();
        
        history.requests.push({
            ...record,
            timestamp: new Date().toISOString()
        });
        
        // 限制历史记录数量
        if (history.requests.length > settings.maxHistoryItems) {
            history.requests = history.requests.slice(-settings.maxHistoryItems);
        }
        
        this.writeJsonFile(this.historyPath, history);
        this.emit('historyAdded', record);
    }

    /**
     * 清空历史记录
     */
    clearHistory() {
        const history = {
            requests: [],
            lastCleanup: new Date().toISOString()
        };
        
        this.writeJsonFile(this.historyPath, history);
        this.emit('historyCleared');
    }

    /**
     * 创建备份
     * @param {string} name 备份名称
     * @returns {string} 备份文件路径
     */
    createBackup(name = null) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = name || `backup-${timestamp}`;
        const backupFilePath = path.join(this.backupPath, `${backupName}.json`);
        
        const backupData = {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            data: {
                collections: this.getCollections(),
                environments: this.getEnvironments(),
                settings: this.getSettings(),
                history: this.readJsonFile(this.historyPath)
            }
        };
        
        this.writeJsonFile(backupFilePath, backupData);
        this.emit('backupCreated', { name: backupName, path: backupFilePath });
        
        return backupFilePath;
    }

    /**
     * 恢复备份
     * @param {string} backupFilePath 备份文件路径
     */
    restoreBackup(backupFilePath) {
        try {
            const backupData = this.readJsonFile(backupFilePath);
            
            if (!backupData || !backupData.data) {
                throw new Error('无效的备份文件');
            }
            
            // 创建当前数据的备份
            this.createBackup('pre-restore-backup');
            
            // 恢复数据
            if (backupData.data.collections) {
                this.saveCollections(backupData.data.collections);
            }
            
            if (backupData.data.environments) {
                this.saveEnvironments(backupData.data.environments);
            }
            
            if (backupData.data.settings) {
                this.saveSettings(backupData.data.settings);
            }
            
            if (backupData.data.history) {
                this.writeJsonFile(this.historyPath, backupData.data.history);
            }
            
            this.emit('backupRestored', { path: backupFilePath });
            
        } catch (error) {
            this.emit('storageError', { error, operation: 'restore', filePath: backupFilePath });
            throw new Error(`恢复备份失败: ${error.message}`);
        }
    }

    /**
     * 获取备份列表
     * @returns {Array} 备份列表
     */
    getBackupList() {
        try {
            const files = fs.readdirSync(this.backupPath)
                .filter(file => file.endsWith('.json'))
                .map(file => {
                    const filePath = path.join(this.backupPath, file);
                    const stats = fs.statSync(filePath);
                    
                    return {
                        name: file.replace('.json', ''),
                        path: filePath,
                        size: stats.size,
                        createdAt: stats.birthtime.toISOString(),
                        modifiedAt: stats.mtime.toISOString()
                    };
                })
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            return files;
        } catch (error) {
            this.emit('storageError', { error, operation: 'listBackups' });
            return [];
        }
    }

    /**
     * 导出数据
     * @param {string} filePath 导出文件路径
     * @param {Object} options 导出选项
     */
    exportData(filePath, options = {}) {
        const exportData = {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            data: {}
        };
        
        if (options.includeCollections !== false) {
            exportData.data.collections = this.getCollections();
        }
        
        if (options.includeEnvironments !== false) {
            exportData.data.environments = this.getEnvironments();
        }
        
        if (options.includeSettings) {
            exportData.data.settings = this.getSettings();
        }
        
        if (options.includeHistory) {
            exportData.data.history = this.readJsonFile(this.historyPath);
        }
        
        this.writeJsonFile(filePath, exportData);
        this.emit('dataExported', { path: filePath, options });
    }

    /**
     * 导入数据
     * @param {string} filePath 导入文件路径
     * @param {Object} options 导入选项
     */
    importData(filePath, options = {}) {
        try {
            const importData = this.readJsonFile(filePath);
            
            if (!importData || !importData.data) {
                throw new Error('无效的导入文件');
            }
            
            if (options.merge) {
                // 合并模式
                if (importData.data.collections) {
                    const currentCollections = this.getCollections();
                    const mergedCollections = this.mergeCollections(currentCollections, importData.data.collections);
                    this.saveCollections(mergedCollections);
                }
                
                if (importData.data.environments) {
                    const currentEnvironments = this.getEnvironments();
                    const mergedEnvironments = this.mergeEnvironments(currentEnvironments, importData.data.environments);
                    this.saveEnvironments(mergedEnvironments);
                }
            } else {
                // 替换模式
                if (importData.data.collections) {
                    this.saveCollections(importData.data.collections);
                }
                
                if (importData.data.environments) {
                    this.saveEnvironments(importData.data.environments);
                }
                
                if (importData.data.settings) {
                    this.saveSettings(importData.data.settings);
                }
            }
            
            this.emit('dataImported', { path: filePath, options });
            
        } catch (error) {
            this.emit('storageError', { error, operation: 'import', filePath });
            throw new Error(`导入数据失败: ${error.message}`);
        }
    }

    /**
     * 合并集合数据
     * @param {Object} current 当前数据
     * @param {Object} imported 导入数据
     * @returns {Object} 合并后的数据
     */
    mergeCollections(current, imported) {
        const merged = {
            folders: [...current.folders],
            requests: [...current.requests]
        };
        
        // 合并文件夹（避免重复）
        imported.folders.forEach(folder => {
            const exists = merged.folders.find(f => f.name === folder.name);
            if (!exists) {
                merged.folders.push({ ...folder, id: this.generateId() });
            }
        });
        
        // 合并请求（避免重复）
        imported.requests.forEach(request => {
            const exists = merged.requests.find(r => r.name === request.name && r.url === request.url);
            if (!exists) {
                merged.requests.push({ ...request, id: this.generateId() });
            }
        });
        
        return merged;
    }

    /**
     * 合并环境数据
     * @param {Object} current 当前数据
     * @param {Object} imported 导入数据
     * @returns {Object} 合并后的数据
     */
    mergeEnvironments(current, imported) {
        const merged = {
            current: current.current,
            environments: { ...current.environments }
        };
        
        // 合并环境（避免重复）
        Object.entries(imported.environments).forEach(([key, env]) => {
            if (!merged.environments[key]) {
                merged.environments[key] = env;
            }
        });
        
        return merged;
    }

    /**
     * 生成唯一ID
     * @returns {string} 唯一ID
     */
    generateId() {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 获取存储统计信息
     * @returns {Object} 统计信息
     */
    getStorageStats() {
        try {
            const collections = this.getCollections();
            const environments = this.getEnvironments();
            const history = this.readJsonFile(this.historyPath) || { requests: [] };
            const backups = this.getBackupList();
            
            return {
                collections: {
                    folders: collections.folders.length,
                    requests: collections.requests.length
                },
                environments: Object.keys(environments.environments).length,
                history: history.requests.length,
                backups: backups.length,
                storage: {
                    dataPath: this.dataPath,
                    backupPath: this.backupPath
                }
            };
        } catch (error) {
            this.emit('storageError', { error, operation: 'getStats' });
            return null;
        }
    }
}

module.exports = StorageManager;