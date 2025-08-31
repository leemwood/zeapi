/**
 * 请求集合管理模块
 * 负责处理请求集合的组织、管理、导入导出等功能
 */

const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs');

class CollectionManager extends EventEmitter {
    constructor(storageManager) {
        super();
        this.storageManager = storageManager;
        this.collections = null;
        this.loadCollections();
    }

    /**
     * 加载集合数据
     */
    loadCollections() {
        try {
            this.collections = this.storageManager.getCollections();
            this.emit('collectionsLoaded', this.collections);
        } catch (error) {
            this.emit('collectionError', { error, operation: 'load' });
            // 初始化空集合
            this.collections = {
                folders: [],
                requests: []
            };
        }
    }

    /**
     * 保存集合数据
     */
    saveCollections() {
        try {
            this.storageManager.saveCollections(this.collections);
            this.emit('collectionsSaved', this.collections);
        } catch (error) {
            this.emit('collectionError', { error, operation: 'save' });
            throw error;
        }
    }

    /**
     * 获取所有集合数据
     * @returns {Object} 集合数据
     */
    getCollections() {
        return this.collections;
    }

    /**
     * 获取文件夹树结构
     * @returns {Array} 文件夹树
     */
    getFolderTree() {
        const buildTree = (parentId = null) => {
            return this.collections.folders
                .filter(folder => folder.parentId === parentId)
                .map(folder => ({
                    ...folder,
                    children: buildTree(folder.id),
                    requests: this.collections.requests.filter(req => req.folderId === folder.id)
                }));
        };
        
        return buildTree();
    }

    /**
     * 获取根级别的请求（不在任何文件夹中）
     * @returns {Array} 根级别请求
     */
    getRootRequests() {
        return this.collections.requests.filter(req => !req.folderId);
    }

    /**
     * 创建文件夹
     * @param {Object} folderData 文件夹数据
     * @returns {string} 文件夹ID
     */
    createFolder(folderData) {
        try {
            const folderId = this.generateId();
            const folder = {
                id: folderId,
                name: folderData.name || 'New Folder',
                description: folderData.description || '',
                parentId: folderData.parentId || null,
                collapsed: folderData.collapsed || false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            this.collections.folders.push(folder);
            this.saveCollections();
            
            this.emit('folderCreated', folder);
            return folderId;
        } catch (error) {
            this.emit('collectionError', { error, operation: 'createFolder' });
            throw error;
        }
    }

    /**
     * 更新文件夹
     * @param {string} folderId 文件夹ID
     * @param {Object} updates 更新数据
     */
    updateFolder(folderId, updates) {
        try {
            const folderIndex = this.collections.folders.findIndex(f => f.id === folderId);
            
            if (folderIndex === -1) {
                throw new Error('文件夹不存在');
            }
            
            this.collections.folders[folderIndex] = {
                ...this.collections.folders[folderIndex],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            
            this.saveCollections();
            this.emit('folderUpdated', { id: folderId, folder: this.collections.folders[folderIndex] });
        } catch (error) {
            this.emit('collectionError', { error, operation: 'updateFolder' });
            throw error;
        }
    }

    /**
     * 删除文件夹
     * @param {string} folderId 文件夹ID
     * @param {boolean} moveRequestsToParent 是否将请求移动到父文件夹
     */
    deleteFolder(folderId, moveRequestsToParent = true) {
        try {
            const folderIndex = this.collections.folders.findIndex(f => f.id === folderId);
            
            if (folderIndex === -1) {
                throw new Error('文件夹不存在');
            }
            
            const folder = this.collections.folders[folderIndex];
            
            // 处理子文件夹
            const childFolders = this.collections.folders.filter(f => f.parentId === folderId);
            childFolders.forEach(childFolder => {
                if (moveRequestsToParent) {
                    childFolder.parentId = folder.parentId;
                } else {
                    this.deleteFolder(childFolder.id, false);
                }
            });
            
            // 处理文件夹中的请求
            const folderRequests = this.collections.requests.filter(r => r.folderId === folderId);
            folderRequests.forEach(request => {
                if (moveRequestsToParent) {
                    request.folderId = folder.parentId;
                } else {
                    this.deleteRequest(request.id);
                }
            });
            
            // 删除文件夹
            this.collections.folders.splice(folderIndex, 1);
            this.saveCollections();
            
            this.emit('folderDeleted', { id: folderId, folder });
        } catch (error) {
            this.emit('collectionError', { error, operation: 'deleteFolder' });
            throw error;
        }
    }

    /**
     * 移动文件夹
     * @param {string} folderId 文件夹ID
     * @param {string} newParentId 新父文件夹ID
     */
    moveFolder(folderId, newParentId) {
        try {
            // 检查是否会造成循环引用
            if (this.wouldCreateCycle(folderId, newParentId)) {
                throw new Error('不能将文件夹移动到其子文件夹中');
            }
            
            this.updateFolder(folderId, { parentId: newParentId });
            this.emit('folderMoved', { id: folderId, newParentId });
        } catch (error) {
            this.emit('collectionError', { error, operation: 'moveFolder' });
            throw error;
        }
    }

    /**
     * 检查是否会创建循环引用
     * @param {string} folderId 文件夹ID
     * @param {string} newParentId 新父文件夹ID
     * @returns {boolean} 是否会创建循环
     */
    wouldCreateCycle(folderId, newParentId) {
        if (!newParentId || newParentId === folderId) {
            return false;
        }
        
        let currentParent = newParentId;
        while (currentParent) {
            if (currentParent === folderId) {
                return true;
            }
            
            const parentFolder = this.collections.folders.find(f => f.id === currentParent);
            currentParent = parentFolder ? parentFolder.parentId : null;
        }
        
        return false;
    }

    /**
     * 创建请求
     * @param {Object} requestData 请求数据
     * @returns {string} 请求ID
     */
    createRequest(requestData) {
        try {
            const requestId = this.generateId();
            const request = {
                id: requestId,
                name: requestData.name || 'Untitled Request',
                method: requestData.method || 'GET',
                url: requestData.url || '',
                params: requestData.params || [],
                headers: requestData.headers || [],
                body: requestData.body || '',
                bodyType: requestData.bodyType || 'none',
                auth: requestData.auth || { type: 'none' },
                folderId: requestData.folderId || null,
                description: requestData.description || '',
                tags: requestData.tags || [],
                tests: requestData.tests || '',
                preRequestScript: requestData.preRequestScript || '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            this.collections.requests.push(request);
            this.saveCollections();
            
            this.emit('requestCreated', request);
            return requestId;
        } catch (error) {
            this.emit('collectionError', { error, operation: 'createRequest' });
            throw error;
        }
    }

    /**
     * 更新请求
     * @param {string} requestId 请求ID
     * @param {Object} updates 更新数据
     */
    updateRequest(requestId, updates) {
        try {
            const requestIndex = this.collections.requests.findIndex(r => r.id === requestId);
            
            if (requestIndex === -1) {
                throw new Error('请求不存在');
            }
            
            this.collections.requests[requestIndex] = {
                ...this.collections.requests[requestIndex],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            
            this.saveCollections();
            this.emit('requestUpdated', { id: requestId, request: this.collections.requests[requestIndex] });
        } catch (error) {
            this.emit('collectionError', { error, operation: 'updateRequest' });
            throw error;
        }
    }

    /**
     * 删除请求
     * @param {string} requestId 请求ID
     */
    deleteRequest(requestId) {
        try {
            const requestIndex = this.collections.requests.findIndex(r => r.id === requestId);
            
            if (requestIndex === -1) {
                throw new Error('请求不存在');
            }
            
            const request = this.collections.requests.splice(requestIndex, 1)[0];
            this.saveCollections();
            
            this.emit('requestDeleted', { id: requestId, request });
        } catch (error) {
            this.emit('collectionError', { error, operation: 'deleteRequest' });
            throw error;
        }
    }

    /**
     * 复制请求
     * @param {string} requestId 请求ID
     * @param {string} newName 新名称（可选）
     * @returns {string} 新请求ID
     */
    duplicateRequest(requestId, newName = null) {
        try {
            const originalRequest = this.collections.requests.find(r => r.id === requestId);
            
            if (!originalRequest) {
                throw new Error('请求不存在');
            }
            
            const duplicatedRequest = {
                ...originalRequest,
                id: this.generateId(),
                name: newName || `${originalRequest.name} Copy`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            this.collections.requests.push(duplicatedRequest);
            this.saveCollections();
            
            this.emit('requestDuplicated', { originalId: requestId, newRequest: duplicatedRequest });
            return duplicatedRequest.id;
        } catch (error) {
            this.emit('collectionError', { error, operation: 'duplicateRequest' });
            throw error;
        }
    }

    /**
     * 移动请求
     * @param {string} requestId 请求ID
     * @param {string} newFolderId 新文件夹ID
     */
    moveRequest(requestId, newFolderId) {
        try {
            this.updateRequest(requestId, { folderId: newFolderId });
            this.emit('requestMoved', { id: requestId, newFolderId });
        } catch (error) {
            this.emit('collectionError', { error, operation: 'moveRequest' });
            throw error;
        }
    }

    /**
     * 搜索请求
     * @param {string} query 搜索查询
     * @param {Object} options 搜索选项
     * @returns {Array} 搜索结果
     */
    searchRequests(query, options = {}) {
        if (!query || query.trim() === '') {
            return this.collections.requests;
        }
        
        const searchTerm = query.toLowerCase().trim();
        const {
            searchInName = true,
            searchInUrl = true,
            searchInDescription = true,
            searchInTags = true,
            method = null,
            folderId = null
        } = options;
        
        return this.collections.requests.filter(request => {
            // 方法过滤
            if (method && request.method !== method) {
                return false;
            }
            
            // 文件夹过滤
            if (folderId !== null && request.folderId !== folderId) {
                return false;
            }
            
            // 文本搜索
            const matches = [];
            
            if (searchInName && request.name.toLowerCase().includes(searchTerm)) {
                matches.push('name');
            }
            
            if (searchInUrl && request.url.toLowerCase().includes(searchTerm)) {
                matches.push('url');
            }
            
            if (searchInDescription && request.description.toLowerCase().includes(searchTerm)) {
                matches.push('description');
            }
            
            if (searchInTags && request.tags.some(tag => tag.toLowerCase().includes(searchTerm))) {
                matches.push('tags');
            }
            
            return matches.length > 0;
        });
    }

    /**
     * 获取请求统计信息
     * @returns {Object} 统计信息
     */
    getStatistics() {
        const stats = {
            totalFolders: this.collections.folders.length,
            totalRequests: this.collections.requests.length,
            requestsByMethod: {},
            requestsByFolder: {},
            recentRequests: []
        };
        
        // 按方法统计
        this.collections.requests.forEach(request => {
            stats.requestsByMethod[request.method] = (stats.requestsByMethod[request.method] || 0) + 1;
        });
        
        // 按文件夹统计
        this.collections.requests.forEach(request => {
            const folderId = request.folderId || 'root';
            stats.requestsByFolder[folderId] = (stats.requestsByFolder[folderId] || 0) + 1;
        });
        
        // 最近更新的请求
        stats.recentRequests = this.collections.requests
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
            .slice(0, 10)
            .map(request => ({
                id: request.id,
                name: request.name,
                method: request.method,
                url: request.url,
                updatedAt: request.updatedAt
            }));
        
        return stats;
    }

    /**
     * 导出集合
     * @param {Object} options 导出选项
     * @returns {Object} 导出数据
     */
    exportCollection(options = {}) {
        const {
            includeRequests = true,
            includeFolders = true,
            folderId = null,
            format = 'zeapi'
        } = options;
        
        let exportData = {
            info: {
                name: 'ZeAPI Collection',
                description: 'Exported from ZeAPI',
                version: '1.0.0',
                schema: 'https://schema.zeapi.com/collection/v1.0.0/collection.json',
                exportedAt: new Date().toISOString()
            },
            folders: [],
            requests: []
        };
        
        if (includeFolders) {
            exportData.folders = folderId 
                ? this.collections.folders.filter(f => f.id === folderId || f.parentId === folderId)
                : this.collections.folders;
        }
        
        if (includeRequests) {
            exportData.requests = folderId
                ? this.collections.requests.filter(r => r.folderId === folderId)
                : this.collections.requests;
        }
        
        // 根据格式转换
        if (format === 'postman') {
            exportData = this.convertToPostmanFormat(exportData);
        } else if (format === 'insomnia') {
            exportData = this.convertToInsomniaFormat(exportData);
        }
        
        return exportData;
    }

    /**
     * 导入集合
     * @param {Object} importData 导入数据
     * @param {Object} options 导入选项
     */
    importCollection(importData, options = {}) {
        try {
            const {
                merge = false,
                targetFolderId = null,
                format = 'auto'
            } = options;
            
            let processedData = importData;
            
            // 自动检测格式
            if (format === 'auto') {
                if (importData.info && importData.info.schema && importData.info.schema.includes('postman')) {
                    processedData = this.convertFromPostmanFormat(importData);
                } else if (importData._type === 'export' && importData.resources) {
                    processedData = this.convertFromInsomniaFormat(importData);
                }
            } else if (format === 'postman') {
                processedData = this.convertFromPostmanFormat(importData);
            } else if (format === 'insomnia') {
                processedData = this.convertFromInsomniaFormat(importData);
            }
            
            if (!merge) {
                // 替换模式：清空现有数据
                this.collections = {
                    folders: [],
                    requests: []
                };
            }
            
            // 导入文件夹
            if (processedData.folders) {
                processedData.folders.forEach(folder => {
                    const newFolder = {
                        ...folder,
                        id: this.generateId(),
                        parentId: targetFolderId || folder.parentId,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    
                    this.collections.folders.push(newFolder);
                });
            }
            
            // 导入请求
            if (processedData.requests) {
                processedData.requests.forEach(request => {
                    const newRequest = {
                        ...request,
                        id: this.generateId(),
                        folderId: targetFolderId || request.folderId,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    
                    this.collections.requests.push(newRequest);
                });
            }
            
            this.saveCollections();
            this.emit('collectionImported', { data: processedData, options });
            
        } catch (error) {
            this.emit('collectionError', { error, operation: 'import' });
            throw error;
        }
    }

    /**
     * 转换为Postman格式
     * @param {Object} data ZeAPI格式数据
     * @returns {Object} Postman格式数据
     */
    convertToPostmanFormat(data) {
        // 实现Postman格式转换
        return {
            info: {
                name: data.info.name,
                description: data.info.description,
                schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
            },
            item: this.convertRequestsToPostmanItems(data.requests, data.folders)
        };
    }

    /**
     * 从Postman格式转换
     * @param {Object} postmanData Postman格式数据
     * @returns {Object} ZeAPI格式数据
     */
    convertFromPostmanFormat(postmanData) {
        // 实现从Postman格式的转换
        const result = {
            folders: [],
            requests: []
        };
        
        const processItems = (items, parentFolderId = null) => {
            items.forEach(item => {
                if (item.item) {
                    // 这是一个文件夹
                    const folderId = this.generateId();
                    result.folders.push({
                        id: folderId,
                        name: item.name,
                        description: item.description || '',
                        parentId: parentFolderId
                    });
                    
                    processItems(item.item, folderId);
                } else {
                    // 这是一个请求
                    result.requests.push(this.convertPostmanRequestToZeAPI(item, parentFolderId));
                }
            });
        };
        
        if (postmanData.item) {
            processItems(postmanData.item);
        }
        
        return result;
    }

    /**
     * 转换Postman请求为ZeAPI格式
     * @param {Object} postmanRequest Postman请求
     * @param {string} folderId 文件夹ID
     * @returns {Object} ZeAPI请求
     */
    convertPostmanRequestToZeAPI(postmanRequest, folderId) {
        const request = {
            name: postmanRequest.name,
            method: postmanRequest.request.method,
            url: typeof postmanRequest.request.url === 'string' 
                ? postmanRequest.request.url 
                : postmanRequest.request.url.raw,
            params: [],
            headers: [],
            body: '',
            bodyType: 'none',
            auth: { type: 'none' },
            folderId: folderId,
            description: postmanRequest.request.description || ''
        };
        
        // 转换查询参数
        if (postmanRequest.request.url && postmanRequest.request.url.query) {
            request.params = postmanRequest.request.url.query.map(param => ({
                key: param.key,
                value: param.value,
                enabled: !param.disabled
            }));
        }
        
        // 转换请求头
        if (postmanRequest.request.header) {
            request.headers = postmanRequest.request.header.map(header => ({
                key: header.key,
                value: header.value,
                enabled: !header.disabled
            }));
        }
        
        // 转换请求体
        if (postmanRequest.request.body) {
            const body = postmanRequest.request.body;
            if (body.mode === 'raw') {
                request.body = body.raw;
                request.bodyType = 'raw';
            } else if (body.mode === 'formdata') {
                request.bodyType = 'form';
                // 转换表单数据
            } else if (body.mode === 'urlencoded') {
                request.bodyType = 'form';
                // 转换URL编码数据
            }
        }
        
        return request;
    }

    /**
     * 生成唯一ID
     * @returns {string} 唯一ID
     */
    generateId() {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 验证集合数据
     * @param {Object} data 集合数据
     * @returns {Object} 验证结果
     */
    validateCollection(data) {
        const errors = [];
        const warnings = [];
        
        if (!data || typeof data !== 'object') {
            errors.push('集合数据格式无效');
            return { valid: false, errors, warnings };
        }
        
        // 验证文件夹
        if (data.folders) {
            data.folders.forEach((folder, index) => {
                if (!folder.id) {
                    errors.push(`文件夹 ${index} 缺少ID`);
                }
                if (!folder.name) {
                    warnings.push(`文件夹 ${index} 缺少名称`);
                }
            });
        }
        
        // 验证请求
        if (data.requests) {
            data.requests.forEach((request, index) => {
                if (!request.id) {
                    errors.push(`请求 ${index} 缺少ID`);
                }
                if (!request.method) {
                    errors.push(`请求 ${index} 缺少HTTP方法`);
                }
                if (!request.url) {
                    warnings.push(`请求 ${index} 缺少URL`);
                }
            });
        }
        
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
}

module.exports = CollectionManager;