// 全局类型定义文件

// ============= 基础类型定义 =============

// HTTP方法类型
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

// 认证类型
export type AuthType = 'none' | 'bearer' | 'basic' | 'api-key';

// 请求体类型
export type BodyType = 'none' | 'json' | 'form' | 'raw' | 'form-data' | 'x-www-form-urlencoded';

// 主题类型
export type ThemeType = 'light' | 'dark' | 'auto';

// 语言类型
export type LanguageType = 'zh-CN';

// ============= API请求相关类型 =============

// 参数配置
export interface ParamConfig {
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

// 请求头配置
export interface HeaderConfig {
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

// 认证配置
export interface AuthConfig {
  type: AuthType;
  token?: string;
  username?: string;
  password?: string;
  apiKey?: string;
  apiValue?: string;
  addTo?: 'header' | 'query';
}

// 请求配置
export interface RequestConfig {
  name?: string;
  method: HttpMethod;
  url: string;
  timeout?: number;
  params?: ParamConfig[];
  headers?: HeaderConfig[];
  body?: string;
  bodyType?: BodyType;
  auth?: AuthConfig;
  description?: string;
  tags?: string[];
  tests?: string;
  preRequestScript?: string;
}

// API请求实体
export interface Request {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  params?: ParamConfig[];
  headers?: HeaderConfig[];
  body?: string;
  bodyType?: BodyType;
  auth?: AuthConfig;
  folderId?: string | null;
  description?: string;
  tags?: string[];
  tests?: string;
  preRequestScript?: string;
  createdAt: string;
  updatedAt: string;
}

// API响应
export interface ApiResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  responseTime: number;
  timestamp: Date;
  size?: number;
}

// 扩展的Axios配置
export interface ExtendedAxiosConfig {
  requestId?: string;
  startTime?: number;
  [key: string]: any;
}

// 扩展的Axios响应
export interface ExtendedAxiosResponse {
  duration?: number;
  config: ExtendedAxiosConfig;
  [key: string]: any;
}

// 活跃请求
export interface ActiveRequest {
  config: ExtendedAxiosConfig;
  cancelToken: any;
  startTime: number;
}

// 历史记录
export interface HistoryRecord {
  id: string;
  method: HttpMethod;
  url: string;
  status?: number;
  responseTime?: number;
  timestamp: string;
  request?: RequestConfig;
  response?: any;
  duration?: number;
}

// ============= 集合管理相关类型 =============

// 文件夹
export interface Folder {
  id: string;
  name: string;
  description?: string;
  parentId?: string | null;
  collapsed?: boolean;
  createdAt: string;
  updatedAt: string;
}

// 文件夹数据
export interface FolderData {
  name?: string;
  description?: string;
  parentId?: string | null;
  collapsed?: boolean;
}

// 文件夹树节点
export interface FolderTreeNode extends Folder {
  children: FolderTreeNode[];
  requests: Request[];
}

// 集合
export interface Collection {
  folders: Folder[];
  requests: Request[];
}

// 搜索选项
export interface SearchOptions {
  includeUrl?: boolean;
  includeDescription?: boolean;
  includeTags?: boolean;
  caseSensitive?: boolean;
  folderId?: string;
}

// 导出选项
export interface ExportOptions {
  format?: 'zeapi' | 'postman';
  includeTests?: boolean;
  includeAuth?: boolean;
  folderId?: string;
  includeCollections?: boolean;
  includeEnvironments?: boolean;
  includeSettings?: boolean;
  includeHistory?: boolean;
}

// 导入选项
export interface ImportOptions {
  merge?: boolean;
  targetFolderId?: string;
  overwriteExisting?: boolean;
}

// 统计信息
export interface Statistics {
  totalRequests: number;
  totalFolders: number;
  requestsByMethod: Record<string, number>;
  requestsByFolder: Record<string, number>;
  recentActivity: Array<{
    type: 'create' | 'update' | 'delete';
    target: 'request' | 'folder';
    name: string;
    timestamp: string;
  }>;
}

// ============= 环境变量相关类型 =============

// 环境变量
export interface EnvironmentVariable {
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

// 环境
export interface Environment {
  name: string;
  description?: string;
  variables: EnvironmentVariable[];
  createdAt?: string;
  updatedAt?: string;
}

// 环境数据
export interface EnvironmentData {
  name?: string;
  description?: string;
  variables?: EnvironmentVariable[];
}

// 环境管理数据
export interface EnvironmentsData {
  current: string;
  environments: { [key: string]: Environment };
}

// 当前环境
export interface CurrentEnvironment extends Environment {
  id: string;
}

// 变量解析
export interface VariableResolution {
  name: string;
  placeholder: string;
  position?: number;
  value?: string;
  source?: 'session' | 'global' | 'environment' | 'dynamic';
}

// 解析结果
export interface ResolveResult {
  resolved: string;
  variables: VariableResolution[];
  unresolved: Array<{
    name: string;
    placeholder: string;
  }>;
}

// 解析选项
export interface ResolveOptions {
  keepUnresolved?: boolean;
  maxDepth?: number;
  currentDepth?: number;
}

// 变量提取器
export interface VariableExtractor {
  name: string;
  path: string;
  type?: 'string' | 'number' | 'boolean';
}

// 变量统计
export interface VariableStats {
  totalVariables: number;
  environmentVariables: number;
  globalVariables: number;
  sessionVariables: number;
  usageCount: Record<string, number>;
  mostUsed: Array<{
    name: string;
    count: number;
    source: string;
  }>;
}

// ============= 测试相关类型 =============

// 日志条目
export interface LogEntry {
  level: 'log' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
}

// 测试结果
export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  executedAt: string;
}

// 脚本错误
export interface ScriptError {
  message: string;
  stack?: string;
  line?: number | null;
}

// 执行结果
export interface ExecutionResult {
  success: boolean;
  tests: TestResult[];
  variables: { [key: string]: any };
  logs: LogEntry[];
  errors: ScriptError[];
}

// 测试执行结果
export interface TestExecutionResult extends ExecutionResult {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  passRate: string;
  executedAt: string;
}

// 响应数据
export interface ResponseData {
  data: any;
  headers: { [key: string]: string };
  status: number;
  responseTime: number;
}

// 执行上下文
export interface ExecutionContext {
  type?: 'pre-request' | 'test';
  response?: ResponseData;
  [key: string]: any;
}

// 测试统计
export interface TestStats {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  passRate: string;
}

// 测试报告
export interface TestReport {
  totalRuns: number;
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  averagePassRate: string;
  recentResults: Array<{
    executedAt: string;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    passRate: string;
  }>;
}

// 沙箱参数
export interface SandboxParams {
  context: ExecutionContext;
  logs: LogEntry[];
  tests: TestResult[];
  variables: { [key: string]: any };
  errors: ScriptError[];
}

// Postman风格的测试接口
export interface PmExpect {
  to: {
    equal: (expected: any) => void;
    not: {
      equal: (expected: any) => void;
    };
    include: (expected: any) => void;
    match: (pattern: RegExp) => void;
    have: {
      property: (prop: string, value?: any) => void;
      status: (code: number) => void;
      header: (name: string, value?: string) => void;
      jsonBody: (expected?: any) => void;
    };
    be: {
      ok: () => void;
      error: () => void;
    };
  };
}

export interface PmTest {
  (name: string, fn: () => void): void;
}

export interface PmEnvironment {
  get: (key: string) => any;
  set: (key: string, value: any) => void;
  unset: (key: string) => void;
}

export interface PmGlobals {
  get: (key: string) => any;
  set: (key: string, value: any) => void;
  unset: (key: string) => void;
}

export interface PmVariables {
  get: (key: string) => any;
  set: (key: string, value: any) => void;
}

export interface PmObject {
  test: PmTest;
  expect: (actual: any) => PmExpect;
  response: {
    to: {
      have: {
        status: (code: number) => void;
        header: (name: string, value?: string) => void;
        jsonBody: (expected?: any) => void;
      };
      be: {
        ok: () => void;
        error: () => void;
      };
    };
  };
  environment: PmEnvironment;
  globals: PmGlobals;
  variables: PmVariables;
}

// 测试用例
export interface TestCase {
  id: string;
  name: string;
  requestId: string;
  assertions: TestAssertion[];
  createdAt: Date;
  updatedAt: Date;
}

// 测试断言
export interface TestAssertion {
  type: 'status' | 'header' | 'body' | 'responseTime';
  field?: string;
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'exists';
  expectedValue: any;
}

// 断言结果
export interface AssertionResult {
  assertion: TestAssertion;
  passed: boolean;
  actualValue: any;
  message?: string;
}

// ============= 存储管理相关类型 =============

// 集合数据
export interface CollectionsData {
  folders: Folder[];
  requests: Request[];
}

// 设置数据
export interface SettingsData {
  theme: ThemeType;
  language: LanguageType;
  autoSave: boolean;
  requestTimeout: number;
  maxHistorySize: number;
  fontSize?: number;
  followRedirects?: boolean;
  validateSSL?: boolean;
  maxHistoryItems?: number;
}

// 历史数据
export interface HistoryData {
  requests: HistoryRecord[];
  lastCleanup: string;
}

// 备份信息
export interface BackupInfo {
  name: string;
  path: string;
  size: number;
  createdAt: string;
  modifiedAt: string;
}

// 导出数据
export interface ExportData {
  version: string;
  timestamp: string;
  data: {
    collections?: CollectionsData;
    environments?: EnvironmentsData;
    settings?: SettingsData;
    history?: HistoryData;
  };
}

// 存储统计
export interface StorageStats {
  collections: {
    folders: number;
    requests: number;
  };
  environments: number;
  history: number;
  backups: number;
  storage: {
    dataPath: string;
    backupPath: string;
  };
}

// 应用设置
export interface AppSettings {
  theme: ThemeType;
  language: LanguageType;
  autoSave: boolean;
  requestTimeout: number;
  maxHistorySize: number;
}

// 存储数据
export interface StorageData {
  collections: Collection;
  environments: EnvironmentsData;
  testCases: TestCase[];
  settings: AppSettings;
}

// Electron相关类型
export interface ElectronAPI {
  platform: string;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
  openExternal: (url: string) => Promise<void>;
  showSaveDialog: (options: any) => Promise<any>;
  showOpenDialog: (options: any) => Promise<any>;
}

// 声明全局变量
declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

// 模块声明
declare module '*.json' {
  const value: any;
  export default value;
}

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.css' {
  const content: string;
  export default content;
}