/**
 * 数据存储管理模块
 * 负责处理应用数据的本地存储、导入导出、备份恢复等功能
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { EventEmitter } from 'events';
import {
    RequestData,
    FolderData,
    CollectionsData,
    EnvironmentVariable,
    Environment,
    EnvironmentsData,
    SettingsData,
    HistoryRecord,
    HistoryData,
    BackupInfo,
    ExportData,
    ExportOptions,
    ImportOptions,
    StorageStats
} from '../types/global';
import { IStorageManager, StorageManagerError } from '../types/modules';

class StorageManager extends EventEmitter implements IStorageManager {
    private userDataPath: string;
    private dataPath: string;
    private collectionsPath: string;
    private environmentsPath: string;
    private settingsPath: string;
    private historyPath: string;
    private backupPath: string;

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
    private initializeStorage(): void {
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
    private initializeDefaultFiles(): void {
        const defaultData = {
            collections: {
                folders: [],
                requests: []
            } as CollectionsData,
            environments: {
                current: 'default',
                environments: {
                    default: {
                        name: '默认环境',
                        variables: []
                    }
                }
            } as EnvironmentsData,
            settings: {
                theme: 'light' as const,
                fontSize: 14,
                timeout: 30000,
                followRedirects: true,
                validateSSL: true,
                autoSave: true,
                maxHistoryItems: 1000,
                language: 'zh-CN'
            } as SettingsData,
            history: {
                requests: [],
                lastCleanup: new Date().toISOString()
            } as HistoryData
        };

        // 创建默认文件（如果不存在）
        const fileMap: { [key: string]: any } = {
            [this.collectionsPath]: defaultData.collections,
            [this.environmentsPath]: defaultData.environments,
            [this.settingsPath]: defaultData.settings,
            [this.historyPath]: defaultData.history
        };

        Object.entries(fileMap).forEach(([filePath, defaultContent]) => {
            if (!fs.existsSync(filePath)) {
                this.writeJsonFile(filePath, defaultContent);
            }
        });
    }

    /**
     * 读取JSON文件
     */
    private readJsonFile<T = any>(filePath: string): T | null {
        try {
            if (!fs.existsSync(filePath)) {
                return null;
            }
            
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content) as T;
        } catch (error) {
            this.emit('storageError', { error, operation: 'read', filePath });
            throw new Error(`读取文件失败: ${(error as Error).message}`);
        }
    }

    /**
     * 写入JSON文件
     */
    private writeJsonFile(filePath: string, data: any): void {
        try {
            const content = JSON.stringify(data, null, 2);
            fs.writeFileSync(filePath, content, 'utf8');
            this.emit('dataWritten', { filePath, size: content.length });
        } catch (error) {
            this.emit('storageError', { error, operation: 'write', filePath });
            throw new Error(`写入文件失败: ${(error as Error).message}`);
        }
    }

    /**
     * 获取请求集合数据
     */
    public getCollections(): CollectionsData {
        return this.readJsonFile<CollectionsData>(this.collectionsPath) || {
            folders: [],
            requests: []
        };
    }

    /**
     * 保存请求集合数据
     */
    public saveCollections(collections: CollectionsData): void {
        this.writeJsonFile(this.collectionsPath, collections);
        this.emit('collectionsUpdated', collections);
    }

    /**
     * 添加请求到集合
     */
    public addRequest(request: RequestData, folderId: string | null = null): string {
        const collections = this.getCollections();
        const requestId = this.generateId();
        
        const newRequest: RequestData = {
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
     */
    public updateRequest(requestId: string, updates: Partial<RequestData>): void {
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
    }

    /**
     * 删除请求
     */
    public deleteRequest(requestId: string): void {
        const collections = this.getCollections();
        const requestIndex = collections.requests.findIndex(r => r.id === requestId);
        
        if (requestIndex === -1) {
            throw new Error('请求不存在');
        }
        
        collections.requests.splice(requestIndex, 1);
        this.saveCollections(collections);
    }

    /**
     * 添加文件夹
     */
    public addFolder(folder: Omit<FolderData, 'id' | 'createdAt' | 'updatedAt'>): string {
        const collections = this.getCollections();
        const folderId = this.generateId();
        
        const newFolder: FolderData = {
            id: folderId,
            name: folder.name,
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
     */
    public getEnvironments(): EnvironmentsData {
        const environments = this.readJsonFile<EnvironmentsData>(this.environmentsPath);
        if (!environments) {
            return {
                current: 'default',
                environments: {
                    default: {
                        name: '默认环境',
                        variables: []
                    }
                }
            };
        }
        return environments;
    }

    /**
     * 保存环境数据
     */
    public saveEnvironments(environments: EnvironmentsData): void {
        this.writeJsonFile(this.environmentsPath, environments);
        this.emit('environmentsUpdated', environments);
    }

    /**
     * 添加环境
     */
    public addEnvironment(environment: Environment): string {
        const environments = this.getEnvironments();
        const environmentId = this.generateId();
        
        environments.environments[environmentId] = {
            name: environment.name,
            variables: environment.variables || []
        };
        
        this.saveEnvironments(environments);
        
        return environmentId;
    }

    /**
     * 设置当前环境
     */
    public setCurrentEnvironment(environmentId: string): void {
        const environments = this.getEnvironments();
        
        if (!environments.environments[environmentId]) {
            throw new Error('环境不存在');
        }
        
        environments.current = environmentId;
        this.saveEnvironments(environments);
    }

    /**
     * 获取设置
     */
    public getSettings(): SettingsData {
        return this.readJsonFile<SettingsData>(this.settingsPath) || {
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
     * 保存设置
     */
    public saveSettings(settings: SettingsData): void {
        this.writeJsonFile(this.settingsPath, settings);
        this.emit('settingsUpdated', settings);
    }

    /**
     * 获取历史记录
     */
    public getHistory(limit: number = 50): HistoryRecord[] {
        const history = this.readJsonFile<HistoryData>(this.historyPath);
        if (!history || !history.requests) {
            return [];
        }
        
        return history.requests
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, limit);
    }

    /**
     * 添加历史记录
     */
    public addHistory(record: Omit<HistoryRecord, 'id' | 'timestamp'>): void {
        const history = this.readJsonFile<HistoryData>(this.historyPath) || {
            requests: [],
            lastCleanup: new Date().toISOString()
        };
        
        const newRecord: HistoryRecord = {
            id: this.generateId(),
            ...record,
            timestamp: new Date().toISOString()
        };
        
        history.requests.unshift(newRecord);
        
        // 限制历史记录数量
        const settings = this.getSettings();
        if (history.requests.length > settings.maxHistoryItems) {
            history.requests = history.requests.slice(0, settings.maxHistoryItems);
        }
        
        this.writeJsonFile(this.historyPath, history);
        this.emit('historyUpdated', newRecord);
    }

    /**
     * 清空历史记录
     */
    public clearHistory(): void {
        const history: HistoryData = {
            requests: [],
            lastCleanup: new Date().toISOString()
        };
        
        this.writeJsonFile(this.historyPath, history);
        this.emit('historyCleared');
    }

    /**
     * 创建备份
     */
    public createBackup(name: string | null = null): string {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = name || `backup-${timestamp}`;
        const backupFilePath = path.join(this.backupPath, `${backupName}.json`);
        
        const backupData: ExportData = {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            data: {
                collections: this.getCollections(),
                environments: this.getEnvironments(),
                settings: this.getSettings(),
                history: this.readJsonFile<HistoryData>(this.historyPath) || { requests: [], lastCleanup: new Date().toISOString() }
            }
        };
        
        this.writeJsonFile(backupFilePath, backupData);
        this.emit('backupCreated', { name: backupName, path: backupFilePath });
        
        return backupFilePath;
    }

    /**
     * 恢复备份
     */
    public restoreBackup(backupFilePath: string): void {
        try {
            const backupData = this.readJsonFile<ExportData>(backupFilePath);
            
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
            throw new Error(`恢复备份失败: ${(error as Error).message}`);
        }
    }

    /**
     * 获取备份列表
     */
    public getBackupList(): BackupInfo[] {
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
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            
            return files;
        } catch (error) {
            this.emit('storageError', { error, operation: 'listBackups' });
            return [];
        }
    }

    /**
     * 导出数据
     */
    public exportData(filePath: string, options: ExportOptions = {}): void {
        const exportData: ExportData = {
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
            exportData.data.history = this.readJsonFile<HistoryData>(this.historyPath);
        }
        
        this.writeJsonFile(filePath, exportData);
        this.emit('dataExported', { path: filePath, options });
    }

    /**
     * 导入数据
     */
    public importData(filePath: string, options: ImportOptions = {}): void {
        try {
            const importData = this.readJsonFile<ExportData>(filePath);
            
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
            throw new Error(`导入数据失败: ${(error as Error).message}`);
        }
    }

    /**
     * 合并集合数据
     */
    private mergeCollections(current: CollectionsData, imported: CollectionsData): CollectionsData {
        const merged: CollectionsData = {
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
     */
    private mergeEnvironments(current: EnvironmentsData, imported: EnvironmentsData): EnvironmentsData {
        const merged: EnvironmentsData = {
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
     */
    private generateId(): string {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 获取存储统计信息
     */
    public getStorageStats(): StorageStats | null {
        try {
            const collections = this.getCollections();
            const environments = this.getEnvironments();
            const history = this.readJsonFile<HistoryData>(this.historyPath) || { requests: [], lastCleanup: new Date().toISOString() };
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

export default StorageManager;