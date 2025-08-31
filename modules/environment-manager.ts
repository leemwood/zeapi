/**
 * 环境变量管理模块
 * 负责处理环境变量的解析、替换、管理等功能
 */

import { EventEmitter } from 'events';
import {
  Environment,
  EnvironmentVariable,
  EnvironmentData,
  VariableResolution,
  ResolveResult,
  ResolveOptions,
  VariableExtractor,
  VariableStats,
  CurrentEnvironment
} from '../types/global';
import { IEnvironmentManager, EnvironmentManagerError } from '../types/modules';
import { IStorageManager } from '../types/modules';

class EnvironmentManager extends EventEmitter implements IEnvironmentManager {
  private storageManager: IStorageManager;
  private currentEnvironment: CurrentEnvironment | null = null;
  private globalVariables: Map<string, string> = new Map();
  private sessionVariables: Map<string, string> = new Map();
  private readonly variablePattern: RegExp = /\{\{([^}]+)\}\}/g;

  constructor(storageManager: StorageManager) {
    super();
    this.storageManager = storageManager;
    this.loadCurrentEnvironment();
  }

  /**
   * 加载当前环境
   */
  private loadCurrentEnvironment(): void {
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
   * @param environmentId 环境ID
   */
  switchEnvironment(environmentId: string): void {
    try {
      const environments = this.storageManager.getEnvironments();
      
      if (!environments.environments[environmentId]) {
        throw new Error(`环境 ${environmentId} 不存在`);
      }
      
      // 更新当前环境
      environments.current = environmentId;
      this.storageManager.saveEnvironments(environments);
      
      this.currentEnvironment = {
        id: environmentId,
        ...environments.environments[environmentId]
      };
      
      // 清空会话变量
      this.sessionVariables.clear();
      
      this.emit('environmentSwitched', {
        previousId: environments.current,
        currentId: environmentId,
        environment: this.currentEnvironment
      });
    } catch (error) {
      this.emit('environmentError', { error, operation: 'switch' });
      throw error;
    }
  }

  /**
   * 获取当前环境
   * @returns 当前环境
   */
  getCurrentEnvironment(): CurrentEnvironment | null {
    return this.currentEnvironment;
  }

  /**
   * 获取所有环境
   * @returns 所有环境
   */
  getAllEnvironments(): Record<string, Environment> {
    return this.storageManager.getEnvironments().environments;
  }

  /**
   * 创建环境
   * @param environmentData 环境数据
   * @returns 环境ID
   */
  createEnvironment(environmentData: EnvironmentData): string {
    try {
      const environments = this.storageManager.getEnvironments();
      const environmentId = this.generateId();
      
      const environment: Environment = {
        name: environmentData.name || 'New Environment',
        description: environmentData.description || '',
        variables: environmentData.variables || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      environments.environments[environmentId] = environment;
      this.storageManager.saveEnvironments(environments);
      
      this.emit('environmentCreated', { id: environmentId, environment });
      return environmentId;
    } catch (error) {
      this.emit('environmentError', { error, operation: 'create' });
      throw error;
    }
  }

  /**
   * 更新环境
   * @param environmentId 环境ID
   * @param updates 更新数据
   */
  updateEnvironment(environmentId: string, updates: Partial<EnvironmentData>): void {
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
      
      // 如果更新的是当前环境，同步更新
      if (this.currentEnvironment && this.currentEnvironment.id === environmentId) {
        this.currentEnvironment = {
          id: environmentId,
          ...environments.environments[environmentId]
        };
      }
      
      this.emit('environmentUpdated', {
        id: environmentId,
        environment: environments.environments[environmentId]
      });
    } catch (error) {
      this.emit('environmentError', { error, operation: 'update' });
      throw error;
    }
  }

  /**
   * 删除环境
   * @param environmentId 环境ID
   */
  deleteEnvironment(environmentId: string): void {
    try {
      const environments = this.storageManager.getEnvironments();
      
      if (!environments.environments[environmentId]) {
        throw new Error(`环境 ${environmentId} 不存在`);
      }
      
      // 不能删除当前环境
      if (environments.current === environmentId) {
        throw new Error('不能删除当前使用的环境');
      }
      
      const environment = environments.environments[environmentId];
      delete environments.environments[environmentId];
      
      this.storageManager.saveEnvironments(environments);
      this.emit('environmentDeleted', { id: environmentId, environment });
    } catch (error) {
      this.emit('environmentError', { error, operation: 'delete' });
      throw error;
    }
  }

  /**
   * 获取环境变量
   * @param environmentId 环境ID（可选，默认当前环境）
   * @returns 环境变量列表
   */
  getEnvironmentVariables(environmentId: string | null = null): EnvironmentVariable[] {
    const targetEnv = environmentId 
      ? this.getAllEnvironments()[environmentId]
      : this.currentEnvironment;
    
    return targetEnv ? targetEnv.variables : [];
  }

  /**
   * 设置环境变量
   * @param key 变量名
   * @param value 变量值
   * @param environmentId 环境ID（可选，默认当前环境）
   */
  setEnvironmentVariable(key: string, value: string, environmentId: string | null = null): void {
    try {
      const targetEnvId = environmentId || this.currentEnvironment?.id;
      
      if (!targetEnvId) {
        throw new Error('没有可用的环境');
      }
      
      const environments = this.storageManager.getEnvironments();
      
      if (!environments.environments[targetEnvId]) {
        throw new Error(`环境 ${targetEnvId} 不存在`);
      }
      
      const environment = environments.environments[targetEnvId];
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
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      
      environment.updatedAt = new Date().toISOString();
      this.storageManager.saveEnvironments(environments);
      
      // 如果是当前环境，同步更新
      if (this.currentEnvironment && this.currentEnvironment.id === targetEnvId) {
        this.currentEnvironment = {
          id: targetEnvId,
          ...environment
        };
      }
      
      this.emit('environmentVariableSet', {
        environmentId: targetEnvId,
        key,
        value
      });
    } catch (error) {
      this.emit('environmentError', { error, operation: 'setVariable' });
      throw error;
    }
  }

  /**
   * 获取环境变量值
   * @param key 变量名
   * @param environmentId 环境ID（可选，默认当前环境）
   * @returns 变量值
   */
  getEnvironmentVariable(key: string, environmentId: string | null = null): string | null {
    const variables = this.getEnvironmentVariables(environmentId);
    const variable = variables.find(v => v.key === key && v.enabled);
    return variable ? variable.value : null;
  }

  /**
   * 删除环境变量
   * @param key 变量名
   * @param environmentId 环境ID（可选，默认当前环境）
   */
  deleteEnvironmentVariable(key: string, environmentId: string | null = null): void {
    try {
      const targetEnvId = environmentId || this.currentEnvironment?.id;
      
      if (!targetEnvId) {
        throw new Error('没有可用的环境');
      }
      
      const environments = this.storageManager.getEnvironments();
      
      if (!environments.environments[targetEnvId]) {
        throw new Error(`环境 ${targetEnvId} 不存在`);
      }
      
      const environment = environments.environments[targetEnvId];
      const variableIndex = environment.variables.findIndex(v => v.key === key);
      
      if (variableIndex >= 0) {
        environment.variables.splice(variableIndex, 1);
        environment.updatedAt = new Date().toISOString();
        
        this.storageManager.saveEnvironments(environments);
        
        // 如果是当前环境，同步更新
        if (this.currentEnvironment && this.currentEnvironment.id === targetEnvId) {
          this.currentEnvironment = {
            id: targetEnvId,
            ...environment
          };
        }
        
        this.emit('environmentVariableDeleted', {
          environmentId: targetEnvId,
          key
        });
      }
    } catch (error) {
      this.emit('environmentError', { error, operation: 'deleteVariable' });
      throw error;
    }
  }

  /**
   * 设置全局变量
   * @param key 变量名
   * @param value 变量值
   */
  setGlobalVariable(key: string, value: string): void {
    this.globalVariables.set(key, value);
    this.emit('globalVariableSet', { key, value });
  }

  /**
   * 获取全局变量
   * @param key 变量名
   * @returns 变量值
   */
  getGlobalVariable(key: string): string | null {
    return this.globalVariables.get(key) || null;
  }

  /**
   * 设置会话变量
   * @param key 变量名
   * @param value 变量值
   */
  setSessionVariable(key: string, value: string): void {
    this.sessionVariables.set(key, value);
    this.emit('sessionVariableSet', { key, value });
  }

  /**
   * 获取会话变量
   * @param key 变量名
   * @returns 变量值
   */
  getSessionVariable(key: string): string | null {
    return this.sessionVariables.get(key) || null;
  }

  /**
   * 清空会话变量
   */
  clearSessionVariables(): void {
    this.sessionVariables.clear();
    this.emit('sessionVariablesCleared');
  }

  /**
   * 解析字符串中的变量
   * @param text 包含变量的文本
   * @param options 解析选项
   * @returns 解析结果
   */
  resolveVariables(text: string, options: ResolveOptions = {}): ResolveResult {
    if (!text || typeof text !== 'string') {
      return {
        resolved: text,
        variables: [],
        unresolved: []
      };
    }
    
    const { maxDepth = 5, currentDepth = 0 } = options;
    
    // 防止无限递归
    if (currentDepth >= maxDepth) {
      return {
        resolved: text,
        variables: [],
        unresolved: []
      };
    }
    
    const variables: VariableResolution[] = [];
    const unresolved: Array<{ name: string; placeholder: string }> = [];
    let resolved = text;
    
    // 查找所有变量
    const matches = [...text.matchAll(this.variablePattern)];
    
    for (const match of matches) {
      const [fullMatch, variableName] = match;
      const trimmedName = variableName.trim();
      
      const variableInfo: VariableResolution = {
        name: trimmedName,
        placeholder: fullMatch,
        position: match.index
      };
      
      // 按优先级查找变量值
      let value: string | null = null;
      let source: 'session' | 'global' | 'environment' | 'dynamic' | null = null;
      
      // 1. 会话变量（最高优先级）
      if (this.sessionVariables.has(trimmedName)) {
        value = this.sessionVariables.get(trimmedName)!;
        source = 'session';
      }
      // 2. 全局变量
      else if (this.globalVariables.has(trimmedName)) {
        value = this.globalVariables.get(trimmedName)!;
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
      if (value === null) {
        const dynamicValue = this.resolveDynamicVariable(trimmedName);
        if (dynamicValue !== null) {
          value = dynamicValue;
          source = 'dynamic';
        }
      }
      
      if (value !== null && source !== null) {
        // 替换变量
        resolved = resolved.replace(fullMatch, value);
        variableInfo.value = value;
        variableInfo.source = source;
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
      
      variables.push(variableInfo);
    }
    
    // 递归解析（处理变量值中包含其他变量的情况）
    if (resolved !== text && currentDepth < maxDepth) {
      const recursiveResult = this.resolveVariables(resolved, {
        ...options,
        currentDepth: currentDepth + 1
      });
      
      return {
        resolved: recursiveResult.resolved,
        variables: [...variables, ...recursiveResult.variables],
        unresolved: [...unresolved, ...recursiveResult.unresolved]
      };
    }
    
    return {
      resolved,
      variables,
      unresolved
    };
  }

  /**
   * 解析动态变量
   * @param variableName 变量名
   * @returns 变量值
   */
  private resolveDynamicVariable(variableName: string): string | null {
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
   * @returns UUID
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * 批量解析对象中的变量
   * @param obj 包含变量的对象
   * @param options 解析选项
   * @returns 解析后的对象
   */
  resolveObjectVariables(obj: any, options: ResolveOptions = {}): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.resolveObjectVariables(item, options));
    }
    
    const resolved: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        resolved[key] = this.resolveVariables(value, options).resolved;
      } else if (typeof value === 'object' && value !== null) {
        resolved[key] = this.resolveObjectVariables(value, options);
      } else {
        resolved[key] = value;
      }
    }
    
    return resolved;
  }

  /**
   * 从响应中提取变量
   * @param response 响应对象
   * @param extractors 提取器配置
   */
  extractVariablesFromResponse(response: any, extractors: VariableExtractor[] = []): void {
    if (!response || !extractors.length) {
      return;
    }
    
    extractors.forEach(extractor => {
      try {
        let value = this.getNestedValue(response, extractor.path);
        
        if (value !== undefined && value !== null) {
          // 类型转换
          switch (extractor.type) {
            case 'string':
              value = String(value);
              break;
            case 'number':
              value = Number(value);
              if (isNaN(value)) {
                throw new Error(`无法将值转换为数字: ${extractor.path}`);
              }
              value = value.toString();
              break;
            case 'boolean':
              value = Boolean(value).toString();
              break;
            default:
              value = String(value);
          }
          
          // 设置为会话变量
          this.setSessionVariable(extractor.name, value);
          
          this.emit('variableExtracted', {
            name: extractor.name,
            value,
            path: extractor.path,
            type: extractor.type || 'string'
          });
        }
      } catch (error) {
        this.emit('variableExtractionError', {
          extractor,
          error
        });
      }
    });
  }

  /**
   * 获取嵌套对象的值
   * @param obj 对象
   * @param path 路径（如 'data.user.name'）
   * @returns 值
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * 获取所有变量
   * @returns 所有变量
   */
  getAllVariables(): {
    environment: EnvironmentVariable[];
    global: Array<{ key: string; value: string }>;
    session: Array<{ key: string; value: string }>;
  } {
    const environment = this.currentEnvironment ? this.currentEnvironment.variables : [];
    
    const global = Array.from(this.globalVariables.entries()).map(([key, value]) => ({
      key,
      value
    }));
    
    const session = Array.from(this.sessionVariables.entries()).map(([key, value]) => ({
      key,
      value
    }));
    
    return {
      environment,
      global,
      session
    };
  }

  /**
   * 验证变量名是否有效
   * @param name 变量名
   * @returns 是否有效
   */
  isValidVariableName(name: string): boolean {
    // 变量名只能包含字母、数字、下划线，且不能以数字开头
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
  }

  /**
   * 获取变量使用统计
   * @returns 统计信息
   */
  getVariableUsageStats(): VariableStats {
    const allVars = this.getAllVariables();
    
    const stats: VariableStats = {
      totalVariables: allVars.environment.length + allVars.global.length + allVars.session.length,
      environmentVariables: allVars.environment.length,
      globalVariables: allVars.global.length,
      sessionVariables: allVars.session.length,
      usageCount: {},
      mostUsed: []
    };
    
    // 这里可以添加更复杂的使用统计逻辑
    // 例如跟踪变量在请求中的使用频率
    
    return stats;
  }

  /**
   * 生成唯一ID
   * @returns 唯一ID
   */
  private generateId(): string {
    return `env_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default EnvironmentManager;
export {
  EnvironmentData,
  VariableResolution,
  ResolveResult,
  ResolveOptions,
  VariableExtractor,
  VariableStats,
  CurrentEnvironment
};