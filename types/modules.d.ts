// 模块类型定义文件
// 为各个管理器模块提供详细的类型定义和接口

import { EventEmitter } from 'events';
import {
  Collection,
  Request,
  Folder,
  Environment,
  EnvironmentVariable,
  RequestConfig,
  AuthConfig,
  ParamConfig,
  HeaderConfig,
  HistoryRecord,
  TestResult,
  ExecutionResult,
  TestExecutionResult,
  ResponseData,
  ExecutionContext,
  CollectionsData,
  EnvironmentsData,
  SettingsData,
  HistoryData,
  BackupInfo,
  ExportData,
  StorageStats,
  FolderData,
  RequestData,
  FolderTreeNode,
  SearchOptions,
  ExportOptions,
  ImportOptions,
  Statistics,
  EnvironmentData,
  CurrentEnvironment,
  VariableResolution,
  ResolveResult,
  ResolveOptions,
  VariableExtractor,
  VariableStats,
  ExtendedAxiosConfig,
  ExtendedAxiosResponse,
  ActiveRequest,
  LogEntry,
  ScriptError,
  TestStats,
  TestReport,
  SandboxParams,
  PmObject
} from './global';

// ============= API管理器相关类型 =============

// API管理器接口
export interface IApiManager extends EventEmitter {
  sendRequest(requestConfig: RequestConfig): Promise<ExtendedAxiosResponse>;
  cancelRequest(requestId: string): void;
  cancelAllRequests(): void;
  addRequestInterceptor(interceptor: (config: ExtendedAxiosConfig) => ExtendedAxiosConfig | void): void;
  addResponseInterceptor(interceptor: (response: ExtendedAxiosResponse) => ExtendedAxiosResponse | void): void;
  getHistory(limit?: number): HistoryRecord[];
  clearHistory(): void;
  getActiveRequests(): Array<{
    id: string;
    method: string;
    url: string;
    startTime: number;
    duration: number;
  }>;
  exportRequest(requestConfig: RequestConfig): any;
  importRequest(exportedConfig: any): RequestConfig;
}

// 拦截器类型
export interface Interceptors {
  request: Array<(config: ExtendedAxiosConfig) => ExtendedAxiosConfig | void>;
  response: Array<(response: ExtendedAxiosResponse) => ExtendedAxiosResponse | void>;
}

// API管理器事件类型
export interface ApiManagerEvents {
  requestStart: { id: string; config: any };
  requestError: { error: any };
  responseSuccess: { id: string; response: any; duration: number };
  responseError: { id: string; error: any; duration: number };
}

// ============= 集合管理器相关类型 =============

// 集合管理器接口
export interface ICollectionManager extends EventEmitter {
  getCollections(): Collection | null;
  getFolderTree(): FolderTreeNode[];
  getRootRequests(): Request[];
  createFolder(folderData: FolderData): string;
  updateFolder(folderId: string, updates: Partial<FolderData>): void;
  deleteFolder(folderId: string, moveRequestsToParent?: boolean): void;
  moveFolder(folderId: string, newParentId: string | null): void;
  createRequest(requestData: RequestData): string;
  updateRequest(requestId: string, updates: Partial<RequestData>): void;
  deleteRequest(requestId: string): void;
  duplicateRequest(requestId: string, newName?: string | null): string;
  moveRequest(requestId: string, newFolderId: string | null): void;
  searchRequests(query: string, options?: SearchOptions): Request[];
  getStatistics(): Statistics;
  exportCollection(options?: ExportOptions): any;
  importCollection(importData: any, options?: ImportOptions): void;
}

// 集合管理器事件类型
export interface CollectionManagerEvents {
  collectionsLoaded: Collection;
  collectionsSaved: Collection;
  collectionError: { error: any; operation: string };
  folderCreated: Folder;
  folderUpdated: { id: string; folder: Folder };
  folderDeleted: { id: string; name: string };
  folderMoved: { id: string; oldParentId: string | null; newParentId: string | null };
  requestCreated: Request;
  requestUpdated: { id: string; request: Request };
  requestDeleted: { id: string; name: string };
  requestDuplicated: { originalId: string; newId: string; newRequest: Request };
  requestMoved: { id: string; oldFolderId: string | null; newFolderId: string | null };
  collectionImported: { format: string; itemsCount: number };
  collectionExported: { format: string; itemsCount: number };
}

// ============= 环境管理器相关类型 =============

// 环境管理器接口
export interface IEnvironmentManager extends EventEmitter {
  switchEnvironment(environmentId: string): void;
  getCurrentEnvironment(): CurrentEnvironment | null;
  getAllEnvironments(): Record<string, Environment>;
  createEnvironment(environmentData: EnvironmentData): string;
  updateEnvironment(environmentId: string, updates: Partial<EnvironmentData>): void;
  deleteEnvironment(environmentId: string): void;
  getEnvironmentVariables(environmentId?: string | null): EnvironmentVariable[];
  setEnvironmentVariable(key: string, value: string, environmentId?: string | null): void;
  getEnvironmentVariable(key: string, environmentId?: string | null): string | null;
  deleteEnvironmentVariable(key: string, environmentId?: string | null): void;
  setGlobalVariable(key: string, value: string): void;
  getGlobalVariable(key: string): string | null;
  setSessionVariable(key: string, value: string): void;
  getSessionVariable(key: string): string | null;
  clearSessionVariables(): void;
  resolveVariables(text: string, options?: ResolveOptions): ResolveResult;
  resolveObjectVariables(obj: any, options?: ResolveOptions): any;
  extractVariablesFromResponse(response: any, extractors?: VariableExtractor[]): void;
  getAllVariables(): {
    environment: EnvironmentVariable[];
    global: Array<{ key: string; value: string }>;
    session: Array<{ key: string; value: string }>;
  };
  isValidVariableName(name: string): boolean;
  getVariableUsageStats(): VariableStats;
}

// 环境管理器事件类型
export interface EnvironmentManagerEvents {
  environmentLoaded: { id: string; environment: CurrentEnvironment };
  environmentSwitched: { previousId: string; currentId: string; environment: CurrentEnvironment };
  environmentCreated: { id: string; environment: Environment };
  environmentUpdated: { id: string; environment: Environment };
  environmentDeleted: { id: string; name: string };
  environmentError: { error: any; operation: string };
  variableSet: { key: string; value: string; source: string };
  variableDeleted: { key: string; source: string };
  variablesResolved: { original: string; resolved: string; variableCount: number };
  variablesExtracted: { count: number; source: string };
}

// ============= 存储管理器相关类型 =============

// 存储管理器接口
export interface IStorageManager extends EventEmitter {
  getCollections(): CollectionsData;
  saveCollections(collections: CollectionsData): void;
  addRequest(request: RequestData, folderId?: string | null): string;
  updateRequest(requestId: string, updates: Partial<RequestData>): void;
  deleteRequest(requestId: string): void;
  addFolder(folder: Omit<FolderData, 'id' | 'createdAt' | 'updatedAt'>): string;
  getEnvironments(): EnvironmentsData;
  saveEnvironments(environments: EnvironmentsData): void;
  addEnvironment(environment: Environment): string;
  setCurrentEnvironment(environmentId: string): void;
  getSettings(): SettingsData;
  saveSettings(settings: SettingsData): void;
  getHistory(limit?: number): HistoryRecord[];
  addHistory(record: Omit<HistoryRecord, 'id' | 'timestamp'>): void;
  clearHistory(): void;
  createBackup(name?: string | null): string;
  restoreBackup(backupFilePath: string): void;
  getBackupList(): BackupInfo[];
  exportData(filePath: string, options?: ExportOptions): void;
  importData(filePath: string, options?: ImportOptions): void;
  getStorageStats(): StorageStats | null;
}

// 存储管理器事件类型
export interface StorageManagerEvents {
  storageInitialized: void;
  storageError: { error: any; operation: string };
  dataLoaded: { type: string; size: number };
  dataSaved: { type: string; size: number };
  backupCreated: { name: string; path: string; size: number };
  backupRestored: { name: string; path: string };
  dataExported: { path: string; options: ExportOptions };
  dataImported: { path: string; options: ImportOptions };
  historyCleared: { deletedCount: number };
}

// ============= 测试管理器相关类型 =============

// 测试管理器接口
export interface ITestManager extends EventEmitter {
  setEnvironment(environment: { [key: string]: any }): void;
  executePreRequestScript(script: string, context?: ExecutionContext): Promise<ExecutionResult>;
  executeTestScript(script: string, response: ResponseData, context?: ExecutionContext): Promise<TestExecutionResult>;
  getTestHistory(limit?: number): TestExecutionResult[];
  clearTestHistory(): void;
  getTestReport(): TestReport;
  setGlobalVariable(key: string, value: any): void;
  getGlobalVariable(key: string): any;
  unsetGlobalVariable(key: string): void;
  clearGlobalVariables(): void;
}

// 测试管理器事件类型
export interface TestManagerEvents {
  environmentSet: { environment: { [key: string]: any } };
  scriptExecutionStart: { type: string; script: string };
  scriptExecutionComplete: { type: string; result: ExecutionResult | TestExecutionResult };
  scriptExecutionError: { type: string; error: any };
  testCompleted: { name: string; passed: boolean; duration: number };
  testFailed: { name: string; error: string; duration: number };
  variableSet: { key: string; value: any; scope: string };
  variableUnset: { key: string; scope: string };
  logMessage: { level: string; message: string; timestamp: number };
}

// ============= 通用管理器类型 =============

// 管理器基类接口
export interface IBaseManager extends EventEmitter {
  initialize?(): Promise<void> | void;
  destroy?(): Promise<void> | void;
}

// 管理器工厂接口
export interface IManagerFactory {
  createApiManager(): IApiManager;
  createCollectionManager(storageManager: IStorageManager): ICollectionManager;
  createEnvironmentManager(storageManager: IStorageManager): IEnvironmentManager;
  createStorageManager(): IStorageManager;
  createTestManager(): ITestManager;
}

// 管理器配置
export interface ManagerConfig {
  apiManager?: {
    timeout?: number;
    maxRetries?: number;
    retryDelay?: number;
  };
  collectionManager?: {
    autoSave?: boolean;
    maxCollections?: number;
  };
  environmentManager?: {
    maxVariables?: number;
    resolveDepth?: number;
  };
  storageManager?: {
    dataPath?: string;
    backupPath?: string;
    maxBackups?: number;
    autoBackup?: boolean;
  };
  testManager?: {
    timeout?: number;
    maxLogs?: number;
    sandboxTimeout?: number;
  };
}

// 管理器状态
export interface ManagerStatus {
  initialized: boolean;
  ready: boolean;
  error?: string;
  lastActivity?: string;
}

// 管理器统计信息
export interface ManagerStats {
  apiManager: {
    totalRequests: number;
    activeRequests: number;
    successRate: number;
    averageResponseTime: number;
  };
  collectionManager: {
    totalCollections: number;
    totalRequests: number;
    totalFolders: number;
  };
  environmentManager: {
    totalEnvironments: number;
    totalVariables: number;
    currentEnvironment: string | null;
  };
  storageManager: {
    dataSize: number;
    backupCount: number;
    lastBackup: string | null;
  };
  testManager: {
    totalTests: number;
    passRate: number;
    lastExecution: string | null;
  };
}

// ============= 错误类型定义 =============

// 管理器错误基类
export class ManagerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly manager: string,
    public readonly operation?: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'ManagerError';
  }
}

// API管理器错误
export class ApiManagerError extends ManagerError {
  constructor(message: string, code: string, operation?: string, details?: any) {
    super(message, code, 'ApiManager', operation, details);
    this.name = 'ApiManagerError';
  }
}

// 集合管理器错误
export class CollectionManagerError extends ManagerError {
  constructor(message: string, code: string, operation?: string, details?: any) {
    super(message, code, 'CollectionManager', operation, details);
    this.name = 'CollectionManagerError';
  }
}

// 环境管理器错误
export class EnvironmentManagerError extends ManagerError {
  constructor(message: string, code: string, operation?: string, details?: any) {
    super(message, code, 'EnvironmentManager', operation, details);
    this.name = 'EnvironmentManagerError';
  }
}

// 存储管理器错误
export class StorageManagerError extends ManagerError {
  constructor(message: string, code: string, operation?: string, details?: any) {
    super(message, code, 'StorageManager', operation, details);
    this.name = 'StorageManagerError';
  }
}

// 测试管理器错误
export class TestManagerError extends ManagerError {
  constructor(message: string, code: string, operation?: string, details?: any) {
    super(message, code, 'TestManager', operation, details);
    this.name = 'TestManagerError';
  }
}

// ============= 工具类型定义 =============

// 深度部分类型
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// 必需字段类型
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// 可选字段类型
export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// 事件监听器类型
export type EventListener<T = any> = (data: T) => void;

// 异步事件监听器类型
export type AsyncEventListener<T = any> = (data: T) => Promise<void>;

// 事件映射类型
export type EventMap = Record<string, any>;

// 类型守卫函数
export type TypeGuard<T> = (value: any) => value is T;

// 验证函数
export type Validator<T> = (value: T) => boolean | string;

// 转换函数
export type Transformer<T, U> = (value: T) => U;

// 序列化函数
export type Serializer<T> = (value: T) => string;

// 反序列化函数
export type Deserializer<T> = (value: string) => T;