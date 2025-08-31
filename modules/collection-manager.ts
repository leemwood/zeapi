/**
 * 请求集合管理模块
 * 负责处理请求集合的组织、管理、导入导出等功能
 */

import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';
import {
  Collection,
  Folder,
  Request,
  StorageManager,
  FolderData,
  RequestData,
  FolderTreeNode,
  SearchOptions,
  ExportOptions,
  ImportOptions,
  Statistics
} from '../types/global';

import { ICollectionManager, CollectionManagerError } from '../types/modules';
import { IStorageManager } from '../types/modules';

class CollectionManager extends EventEmitter implements ICollectionManager {
  private storageManager: IStorageManager;
  private collections: Collection | null = null;

  constructor(storageManager: StorageManager) {
    super();
    this.storageManager = storageManager;
    this.loadCollections();
  }

  /**
   * 加载集合数据
   */
  private loadCollections(): void {
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
  private saveCollections(): void {
    try {
      if (!this.collections) {
        throw new Error('集合数据未初始化');
      }
      this.storageManager.saveCollections(this.collections);
      this.emit('collectionsSaved', this.collections);
    } catch (error) {
      this.emit('collectionError', { error, operation: 'save' });
      throw error;
    }
  }

  /**
   * 获取所有集合数据
   * @returns 集合数据
   */
  getCollections(): Collection | null {
    return this.collections;
  }

  /**
   * 获取文件夹树结构
   * @returns 文件夹树
   */
  getFolderTree(): FolderTreeNode[] {
    if (!this.collections) return [];
    
    const buildTree = (parentId: string | null = null): FolderTreeNode[] => {
      return this.collections!.folders
        .filter(folder => folder.parentId === parentId)
        .map(folder => ({
          ...folder,
          children: buildTree(folder.id),
          requests: this.collections!.requests.filter(req => req.folderId === folder.id)
        }));
    };
    
    return buildTree();
  }

  /**
   * 获取根级别的请求（不在任何文件夹中）
   * @returns 根级别请求
   */
  getRootRequests(): Request[] {
    if (!this.collections) return [];
    return this.collections.requests.filter(req => !req.folderId);
  }

  /**
   * 创建文件夹
   * @param folderData 文件夹数据
   * @returns 文件夹ID
   */
  createFolder(folderData: FolderData): string {
    try {
      if (!this.collections) {
        throw new Error('集合数据未初始化');
      }
      
      const folderId = this.generateId();
      const folder: Folder = {
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
   * @param folderId 文件夹ID
   * @param updates 更新数据
   */
  updateFolder(folderId: string, updates: Partial<FolderData>): void {
    try {
      if (!this.collections) {
        throw new Error('集合数据未初始化');
      }
      
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
   * @param folderId 文件夹ID
   * @param moveRequestsToParent 是否将请求移动到父文件夹
   */
  deleteFolder(folderId: string, moveRequestsToParent: boolean = true): void {
    try {
      if (!this.collections) {
        throw new Error('集合数据未初始化');
      }
      
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
   * @param folderId 文件夹ID
   * @param newParentId 新父文件夹ID
   */
  moveFolder(folderId: string, newParentId: string | null): void {
    try {
      if (this.wouldCreateCycle(folderId, newParentId)) {
        throw new Error('移动操作会创建循环引用');
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
   * @param folderId 文件夹ID
   * @param newParentId 新父文件夹ID
   * @returns 是否会创建循环
   */
  private wouldCreateCycle(folderId: string, newParentId: string | null): boolean {
    if (!newParentId || !this.collections) {
      return false;
    }
    
    let currentParentId = newParentId;
    while (currentParentId) {
      if (currentParentId === folderId) {
        return true;
      }
      const parentFolder = this.collections.folders.find(f => f.id === currentParentId);
      currentParentId = parentFolder?.parentId || null;
    }
    
    return false;
  }

  /**
   * 创建请求
   * @param requestData 请求数据
   * @returns 请求ID
   */
  createRequest(requestData: RequestData): string {
    try {
      if (!this.collections) {
        throw new Error('集合数据未初始化');
      }
      
      const requestId = this.generateId();
      const request: Request = {
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
   * @param requestId 请求ID
   * @param updates 更新数据
   */
  updateRequest(requestId: string, updates: Partial<RequestData>): void {
    try {
      if (!this.collections) {
        throw new Error('集合数据未初始化');
      }
      
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
   * @param requestId 请求ID
   */
  deleteRequest(requestId: string): void {
    try {
      if (!this.collections) {
        throw new Error('集合数据未初始化');
      }
      
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
   * @param requestId 请求ID
   * @param newName 新名称（可选）
   * @returns 新请求ID
   */
  duplicateRequest(requestId: string, newName: string | null = null): string {
    try {
      if (!this.collections) {
        throw new Error('集合数据未初始化');
      }
      
      const originalRequest = this.collections.requests.find(r => r.id === requestId);
      
      if (!originalRequest) {
        throw new Error('请求不存在');
      }
      
      const duplicatedRequest: Request = {
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
   * @param requestId 请求ID
   * @param newFolderId 新文件夹ID
   */
  moveRequest(requestId: string, newFolderId: string | null): void {
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
   * @param query 搜索关键词
   * @param options 搜索选项
   * @returns 搜索结果
   */
  searchRequests(query: string, options: SearchOptions = {}): Request[] {
    if (!this.collections || !query.trim()) {
      return [];
    }
    
    const {
      includeUrl = true,
      includeDescription = true,
      includeTags = true,
      caseSensitive = false,
      folderId
    } = options;
    
    const searchQuery = caseSensitive ? query : query.toLowerCase();
    
    let requests = this.collections.requests;
    
    // 按文件夹过滤
    if (folderId !== undefined) {
      requests = requests.filter(req => req.folderId === folderId);
    }
    
    return requests.filter(request => {
      const name = caseSensitive ? request.name : request.name.toLowerCase();
      const url = caseSensitive ? request.url : request.url.toLowerCase();
      const description = caseSensitive ? request.description : request.description.toLowerCase();
      const tags = request.tags.map(tag => caseSensitive ? tag : tag.toLowerCase());
      
      // 搜索名称
      if (name.includes(searchQuery)) {
        return true;
      }
      
      // 搜索URL
      if (includeUrl && url.includes(searchQuery)) {
        return true;
      }
      
      // 搜索描述
      if (includeDescription && description.includes(searchQuery)) {
        return true;
      }
      
      // 搜索标签
      if (includeTags && tags.some(tag => tag.includes(searchQuery))) {
        return true;
      }
      
      return false;
    });
  }

  /**
   * 获取统计信息
   * @returns 统计信息
   */
  getStatistics(): Statistics {
    if (!this.collections) {
      return {
        totalRequests: 0,
        totalFolders: 0,
        requestsByMethod: {},
        requestsByFolder: {},
        recentActivity: []
      };
    }
    
    const requestsByMethod: Record<string, number> = {};
    const requestsByFolder: Record<string, number> = {};
    
    this.collections.requests.forEach(request => {
      // 按方法统计
      const method = request.method.toUpperCase();
      requestsByMethod[method] = (requestsByMethod[method] || 0) + 1;
      
      // 按文件夹统计
      const folderName = request.folderId 
        ? this.collections!.folders.find(f => f.id === request.folderId)?.name || 'Unknown'
        : 'Root';
      requestsByFolder[folderName] = (requestsByFolder[folderName] || 0) + 1;
    });
    
    // 获取最近活动（基于更新时间）
    const allItems = [
      ...this.collections.requests.map(r => ({ ...r, type: 'request' as const })),
      ...this.collections.folders.map(f => ({ ...f, type: 'folder' as const }))
    ];
    
    const recentActivity = allItems
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 10)
      .map(item => ({
        type: 'update' as const,
        target: item.type,
        name: item.name,
        timestamp: item.updatedAt
      }));
    
    return {
      totalRequests: this.collections.requests.length,
      totalFolders: this.collections.folders.length,
      requestsByMethod,
      requestsByFolder,
      recentActivity
    };
  }

  /**
   * 导出集合
   * @param options 导出选项
   * @returns 导出数据
   */
  exportCollection(options: ExportOptions = {}): any {
    if (!this.collections) {
      throw new Error('集合数据未初始化');
    }
    
    const {
      format = 'zeapi',
      includeTests = true,
      includeAuth = true,
      folderId
    } = options;
    
    let data = { ...this.collections };
    
    // 按文件夹过滤
    if (folderId) {
      const folder = this.collections.folders.find(f => f.id === folderId);
      if (!folder) {
        throw new Error('文件夹不存在');
      }
      
      // 获取子文件夹
      const getChildFolders = (parentId: string): Folder[] => {
        const children = this.collections!.folders.filter(f => f.parentId === parentId);
        return children.concat(...children.map(child => getChildFolders(child.id)));
      };
      
      const targetFolders = [folder, ...getChildFolders(folderId)];
      const targetFolderIds = targetFolders.map(f => f.id);
      
      data = {
        folders: targetFolders,
        requests: this.collections.requests.filter(r => 
          targetFolderIds.includes(r.folderId || '')
        )
      };
    }
    
    // 清理数据
    if (!includeTests) {
      data.requests = data.requests.map(r => ({ ...r, tests: '', preRequestScript: '' }));
    }
    
    if (!includeAuth) {
      data.requests = data.requests.map(r => ({ ...r, auth: { type: 'none' } }));
    }
    
    // 转换格式
    if (format === 'postman') {
      return this.convertToPostmanFormat(data);
    }
    
    return {
      info: {
        name: 'ZeAPI Collection',
        version: '1.0.0',
        exportedAt: new Date().toISOString()
      },
      ...data
    };
  }

  /**
   * 导入集合
   * @param importData 导入数据
   * @param options 导入选项
   */
  importCollection(importData: any, options: ImportOptions = {}): void {
    try {
      if (!this.collections) {
        throw new Error('集合数据未初始化');
      }
      
      const { merge = true, targetFolderId, overwriteExisting = false } = options;
      
      // 验证导入数据
      this.validateCollection(importData);
      
      let data = importData;
      
      // 检测并转换Postman格式
      if (data.info && data.item) {
        data = this.convertFromPostmanFormat(data);
      }
      
      if (!merge) {
        // 完全替换
        this.collections = {
          folders: data.folders || [],
          requests: data.requests || []
        };
      } else {
        // 合并导入
        const idMapping = new Map<string, string>();
        
        // 导入文件夹
        if (data.folders) {
          data.folders.forEach((folder: any) => {
            const oldId = folder.id;
            const newId = this.generateId();
            idMapping.set(oldId, newId);
            
            const existingFolder = this.collections!.folders.find(f => f.name === folder.name);
            
            if (existingFolder && !overwriteExisting) {
              idMapping.set(oldId, existingFolder.id);
            } else {
              const newFolder: Folder = {
                ...folder,
                id: newId,
                parentId: targetFolderId || (folder.parentId ? idMapping.get(folder.parentId) || null : null),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              
              if (existingFolder && overwriteExisting) {
                const index = this.collections!.folders.findIndex(f => f.id === existingFolder.id);
                this.collections!.folders[index] = newFolder;
                idMapping.set(oldId, existingFolder.id);
              } else {
                this.collections!.folders.push(newFolder);
              }
            }
          });
        }
        
        // 导入请求
        if (data.requests) {
          data.requests.forEach((request: any) => {
            const existingRequest = this.collections!.requests.find(r => r.name === request.name);
            
            if (existingRequest && !overwriteExisting) {
              return; // 跳过已存在的请求
            }
            
            const newRequest: Request = {
              ...request,
              id: this.generateId(),
              folderId: targetFolderId || (request.folderId ? idMapping.get(request.folderId) || null : null),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            
            if (existingRequest && overwriteExisting) {
              const index = this.collections!.requests.findIndex(r => r.id === existingRequest.id);
              this.collections!.requests[index] = newRequest;
            } else {
              this.collections!.requests.push(newRequest);
            }
          });
        }
      }
      
      this.saveCollections();
      this.emit('collectionImported', { data, options });
    } catch (error) {
      this.emit('collectionError', { error, operation: 'importCollection' });
      throw error;
    }
  }

  /**
   * 转换为Postman格式
   * @param data 集合数据
   * @returns Postman格式数据
   */
  private convertToPostmanFormat(data: Collection): any {
    const postmanCollection = {
      info: {
        name: 'ZeAPI Collection',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      item: [] as any[]
    };
    
    // 构建文件夹树
    const buildPostmanTree = (parentId: string | null = null): any[] => {
      const folders = data.folders.filter(f => f.parentId === parentId);
      const requests = data.requests.filter(r => r.folderId === parentId);
      
      const items = [];
      
      // 添加文件夹
      folders.forEach(folder => {
        items.push({
          name: folder.name,
          description: folder.description,
          item: buildPostmanTree(folder.id)
        });
      });
      
      // 添加请求
      requests.forEach(request => {
        items.push(this.convertRequestToPostmanFormat(request));
      });
      
      return items;
    };
    
    postmanCollection.item = buildPostmanTree();
    return postmanCollection;
  }

  /**
   * 将请求转换为Postman格式
   * @param request 请求对象
   * @returns Postman请求格式
   */
  private convertRequestToPostmanFormat(request: Request): any {
    const postmanRequest: any = {
      name: request.name,
      request: {
        method: request.method.toUpperCase(),
        header: request.headers
          .filter(h => h.enabled)
          .map(h => ({ key: h.key, value: h.value })),
        url: {
          raw: request.url,
          query: request.params
            .filter(p => p.enabled)
            .map(p => ({ key: p.key, value: p.value }))
        }
      }
    };
    
    // 添加请求体
    if (request.body && request.bodyType !== 'none') {
      postmanRequest.request.body = {
        mode: request.bodyType === 'json' ? 'raw' : request.bodyType,
        raw: request.body
      };
      
      if (request.bodyType === 'json') {
        postmanRequest.request.body.options = {
          raw: { language: 'json' }
        };
      }
    }
    
    // 添加认证
    if (request.auth && request.auth.type !== 'none') {
      switch (request.auth.type) {
        case 'bearer':
          postmanRequest.request.auth = {
            type: 'bearer',
            bearer: [{ key: 'token', value: request.auth.token || '' }]
          };
          break;
        case 'basic':
          postmanRequest.request.auth = {
            type: 'basic',
            basic: [
              { key: 'username', value: request.auth.username || '' },
              { key: 'password', value: request.auth.password || '' }
            ]
          };
          break;
      }
    }
    
    return postmanRequest;
  }

  /**
   * 从Postman格式转换
   * @param postmanData Postman数据
   * @returns ZeAPI格式数据
   */
  private convertFromPostmanFormat(postmanData: any): Collection {
    const collection: Collection = {
      folders: [],
      requests: []
    };
    
    const processItems = (items: any[], parentId: string | null = null): void => {
      items.forEach(item => {
        if (item.item) {
          // 这是一个文件夹
          const folderId = this.generateId();
          const folder: Folder = {
            id: folderId,
            name: item.name || 'Untitled Folder',
            description: item.description || '',
            parentId,
            collapsed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          collection.folders.push(folder);
          processItems(item.item, folderId);
        } else if (item.request) {
          // 这是一个请求
          const request = this.convertPostmanRequestToZeAPI(item, parentId);
          collection.requests.push(request);
        }
      });
    };
    
    if (postmanData.item) {
      processItems(postmanData.item);
    }
    
    return collection;
  }

  /**
   * 将Postman请求转换为ZeAPI格式
   * @param postmanRequest Postman请求
   * @param folderId 文件夹ID
   * @returns ZeAPI请求
   */
  private convertPostmanRequestToZeAPI(postmanRequest: any, folderId: string | null): Request {
    const request: Request = {
      id: this.generateId(),
      name: postmanRequest.name || 'Untitled Request',
      method: postmanRequest.request?.method?.toLowerCase() || 'get',
      url: postmanRequest.request?.url?.raw || postmanRequest.request?.url || '',
      params: [],
      headers: [],
      body: '',
      bodyType: 'none',
      auth: { type: 'none' },
      folderId,
      description: postmanRequest.description || '',
      tags: [],
      tests: '',
      preRequestScript: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // 转换查询参数
    if (postmanRequest.request?.url?.query) {
      request.params = postmanRequest.request.url.query.map((param: any) => ({
        key: param.key || '',
        value: param.value || '',
        enabled: !param.disabled
      }));
    }
    
    // 转换请求头
    if (postmanRequest.request?.header) {
      request.headers = postmanRequest.request.header.map((header: any) => ({
        key: header.key || '',
        value: header.value || '',
        enabled: !header.disabled
      }));
    }
    
    // 转换请求体
    if (postmanRequest.request?.body) {
      const body = postmanRequest.request.body;
      if (body.mode === 'raw') {
        request.body = body.raw || '';
        request.bodyType = body.options?.raw?.language === 'json' ? 'json' : 'raw';
      } else if (body.mode === 'formdata' || body.mode === 'urlencoded') {
        request.bodyType = 'form';
        if (body.formdata || body.urlencoded) {
          const formData: Record<string, string> = {};
          (body.formdata || body.urlencoded).forEach((item: any) => {
            if (!item.disabled) {
              formData[item.key] = item.value || '';
            }
          });
          request.body = JSON.stringify(formData);
        }
      }
    }
    
    // 转换认证
    if (postmanRequest.request?.auth) {
      const auth = postmanRequest.request.auth;
      switch (auth.type) {
        case 'bearer':
          request.auth = {
            type: 'bearer',
            token: auth.bearer?.find((item: any) => item.key === 'token')?.value || ''
          };
          break;
        case 'basic':
          request.auth = {
            type: 'basic',
            username: auth.basic?.find((item: any) => item.key === 'username')?.value || '',
            password: auth.basic?.find((item: any) => item.key === 'password')?.value || ''
          };
          break;
      }
    }
    
    return request;
  }

  /**
   * 生成唯一ID
   * @returns 唯一ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 验证集合数据
   * @param data 集合数据
   */
  private validateCollection(data: any): void {
    if (!data || typeof data !== 'object') {
      throw new Error('无效的集合数据格式');
    }
    
    // 验证基本结构
    if (data.folders && !Array.isArray(data.folders)) {
      throw new Error('文件夹数据必须是数组');
    }
    
    if (data.requests && !Array.isArray(data.requests)) {
      throw new Error('请求数据必须是数组');
    }
    
    // 验证文件夹
    if (data.folders) {
      data.folders.forEach((folder: any, index: number) => {
        if (!folder.id || !folder.name) {
          throw new Error(`文件夹 ${index} 缺少必要字段`);
        }
      });
    }
    
    // 验证请求
    if (data.requests) {
      data.requests.forEach((request: any, index: number) => {
        if (!request.id || !request.name || !request.method || !request.url) {
          throw new Error(`请求 ${index} 缺少必要字段`);
        }
      });
    }
  }
}

export default CollectionManager;
export { 
  FolderData, 
  RequestData, 
  FolderTreeNode, 
  SearchOptions, 
  ExportOptions, 
  ImportOptions, 
  Statistics 
};