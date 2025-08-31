/**
 * 测试脚本管理模块
 * 负责处理API测试脚本的执行、断言、结果收集等功能
 */

import { EventEmitter } from 'events';
import * as vm from 'vm';
import {
  LogEntry,
  TestResult,
  ScriptError,
  ExecutionResult,
  TestExecutionResult,
  ResponseData,
  ExecutionContext,
  TestStats,
  TestReport,
  SandboxParams,
  PmExpect,
  PmTest,
  PmEnvironment,
  PmGlobals,
  PmVariables,
  PmObject
} from '../types/global';
import { ITestManager, TestManagerError } from '../types/modules';

// 保留原有的PmExpect接口扩展
interface ExtendedPmExpect extends PmExpect {
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

interface PmTest {
    (name: string, fn: () => void): void;
}

interface PmEnvironment {
    get: (key: string) => any;
    set: (key: string, value: any) => void;
    unset: (key: string) => void;
}

interface PmGlobals {
    get: (key: string) => any;
    set: (key: string, value: any) => void;
    unset: (key: string) => void;
}

interface PmVariables {
    get: (key: string) => any;
    set: (key: string, value: any) => void;
}

interface PmObject {
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

class TestManager extends EventEmitter implements ITestManager {
    private testResults: TestExecutionResult[];
    private globalVariables: { [key: string]: any };
    private testEnvironment: { [key: string]: any } | null;

    constructor() {
        super();
        this.testResults = [];
        this.globalVariables = {};
        this.testEnvironment = null;
    }

    /**
     * 设置测试环境
     */
    public setEnvironment(environment: { [key: string]: any }): void {
        this.testEnvironment = environment;
    }

    /**
     * 执行预请求脚本
     */
    public async executePreRequestScript(script: string, context: ExecutionContext = {}): Promise<ExecutionResult> {
        if (!script || script.trim() === '') {
            return { success: true, variables: {}, logs: [], tests: [], errors: [] };
        }

        try {
            const result = await this.executeScript(script, {
                ...context,
                type: 'pre-request'
            });
            
            this.emit('preRequestScriptExecuted', result);
            return result;
        } catch (error) {
            this.emit('scriptError', { error, type: 'pre-request', script });
            throw error;
        }
    }

    /**
     * 执行测试脚本
     */
    public async executeTestScript(script: string, response: ResponseData, context: ExecutionContext = {}): Promise<TestExecutionResult> {
        if (!script || script.trim() === '') {
            return {
                success: true,
                tests: [],
                variables: {},
                logs: [],
                errors: [],
                totalTests: 0,
                passedTests: 0,
                failedTests: 0,
                passRate: '0',
                executedAt: new Date().toISOString()
            };
        }

        try {
            const testContext: ExecutionContext = {
                ...context,
                response,
                type: 'test'
            };
            
            const result = await this.executeScript(script, testContext);
            
            // 计算测试统计
            const stats = this.calculateTestStats(result.tests);
            
            const testResult: TestExecutionResult = {
                ...result,
                ...stats,
                executedAt: new Date().toISOString()
            };
            
            this.testResults.push(testResult);
            this.emit('testScriptExecuted', testResult);
            
            return testResult;
        } catch (error) {
            this.emit('scriptError', { error, type: 'test', script });
            throw error;
        }
    }

    /**
     * 执行脚本
     */
    private async executeScript(script: string, context: ExecutionContext = {}): Promise<ExecutionResult> {
        const logs: LogEntry[] = [];
        const tests: TestResult[] = [];
        const variables = { ...this.globalVariables };
        const errors: ScriptError[] = [];

        // 创建沙箱环境
        const sandbox = this.createSandbox({
            context,
            logs,
            tests,
            variables,
            errors
        });

        try {
            // 创建虚拟机上下文
            const vmContext = vm.createContext(sandbox);
            
            // 执行脚本
            vm.runInContext(script, vmContext, {
                timeout: 5000, // 5秒超时
                displayErrors: true
            });
            
            // 更新全局变量
            Object.assign(this.globalVariables, variables);
            
            return {
                success: errors.length === 0,
                tests,
                variables,
                logs,
                errors
            };
        } catch (error) {
            const scriptError = error as Error;
            errors.push({
                message: scriptError.message,
                stack: scriptError.stack,
                line: this.extractLineNumber(scriptError)
            });
            
            return {
                success: false,
                tests,
                variables,
                logs,
                errors
            };
        }
    }

    /**
     * 创建脚本执行沙箱
     */
    private createSandbox({ context, logs, tests, variables, errors }: SandboxParams): any {
        const sandbox = {
            // 全局对象
            console: {
                log: (...args: any[]) => logs.push({ level: 'log', message: args.join(' '), timestamp: Date.now() }),
                info: (...args: any[]) => logs.push({ level: 'info', message: args.join(' '), timestamp: Date.now() }),
                warn: (...args: any[]) => logs.push({ level: 'warn', message: args.join(' '), timestamp: Date.now() }),
                error: (...args: any[]) => logs.push({ level: 'error', message: args.join(' '), timestamp: Date.now() })
            },
            
            // 测试函数
            pm: this.createPmObject(tests, variables, context),
            
            // 环境变量
            environment: this.testEnvironment || {},
            
            // 全局变量
            globals: this.globalVariables,
            
            // 响应对象（如果是测试脚本）
            responseBody: context.response ? context.response.data : null,
            responseHeaders: context.response ? context.response.headers : {},
            responseTime: context.response ? context.response.responseTime : 0,
            responseCode: context.response ? context.response.status : 0,
            
            // 工具函数
            JSON: JSON,
            Math: Math,
            Date: Date,
            parseInt: parseInt,
            parseFloat: parseFloat,
            isNaN: isNaN,
            isFinite: isFinite,
            
            // 加密和编码函数
            btoa: (str: string) => Buffer.from(str).toString('base64'),
            atob: (str: string) => Buffer.from(str, 'base64').toString(),
            
            // 随机数生成
            randomInt: (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min,
            
            // 其他工具函数
            setTimeout: setTimeout,
            clearTimeout: clearTimeout
        };
        
        return sandbox;
    }

    /**
     * 创建PM对象
     */
    private createPmObject(tests: TestResult[], variables: { [key: string]: any }, context: ExecutionContext): PmObject {
        return {
            // 测试函数
            test: (name: string, fn: () => void) => {
                try {
                    fn();
                    tests.push({
                        name,
                        passed: true,
                        executedAt: new Date().toISOString()
                    });
                } catch (error) {
                    tests.push({
                        name,
                        passed: false,
                        error: (error as Error).message,
                        executedAt: new Date().toISOString()
                    });
                }
            },
            
            // 断言函数
            expect: (actual: any): PmExpect => ({
                to: {
                    equal: (expected: any) => {
                        if (actual !== expected) {
                            throw new Error(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
                        }
                    },
                    not: {
                        equal: (expected: any) => {
                            if (actual === expected) {
                                throw new Error(`Expected ${JSON.stringify(actual)} not to equal ${JSON.stringify(expected)}`);
                            }
                        }
                    },
                    include: (expected: any) => {
                        if (typeof actual === 'string' && typeof expected === 'string') {
                            if (!actual.includes(expected)) {
                                throw new Error(`Expected "${actual}" to include "${expected}"`);
                            }
                        } else if (Array.isArray(actual)) {
                            if (!actual.includes(expected)) {
                                throw new Error(`Expected array to include ${JSON.stringify(expected)}`);
                            }
                        } else {
                            throw new Error('Include assertion only supports strings and arrays');
                        }
                    },
                    match: (pattern: RegExp) => {
                        if (typeof actual !== 'string' || !pattern.test(actual)) {
                            throw new Error(`Expected "${actual}" to match ${pattern}`);
                        }
                    },
                    have: {
                        property: (prop: string, value?: any) => {
                            if (typeof actual !== 'object' || actual === null) {
                                throw new Error('Expected value to be an object');
                            }
                            
                            const propValue = this.getNestedProperty(actual, prop);
                            if (propValue === undefined) {
                                throw new Error(`Expected object to have property "${prop}"`);
                            }
                            
                            if (value !== undefined && propValue !== value) {
                                throw new Error(`Expected property "${prop}" to equal ${JSON.stringify(value)}, but got ${JSON.stringify(propValue)}`);
                            }
                        },
                        status: (code: number) => {
                            const status = context.response ? context.response.status : 0;
                            if (status !== code) {
                                throw new Error(`Expected status code ${code}, but got ${status}`);
                            }
                        },
                        header: (name: string, value?: string) => {
                            const headers = context.response ? context.response.headers : {};
                            const headerValue = headers[name.toLowerCase()];
                            
                            if (headerValue === undefined) {
                                throw new Error(`Expected response to have header "${name}"`);
                            }
                            
                            if (value !== undefined && headerValue !== value) {
                                throw new Error(`Expected header "${name}" to equal "${value}", but got "${headerValue}"`);
                            }
                        },
                        jsonBody: (expected?: any) => {
                            const responseData = context.response ? context.response.data : null;
                            
                            if (typeof responseData !== 'object' || responseData === null) {
                                throw new Error('Expected response body to be JSON');
                            }
                            
                            if (expected !== undefined) {
                                const actualJson = JSON.stringify(responseData);
                                const expectedJson = JSON.stringify(expected);
                                
                                if (actualJson !== expectedJson) {
                                    throw new Error(`Expected JSON body to equal ${expectedJson}, but got ${actualJson}`);
                                }
                            }
                        }
                    },
                    be: {
                        ok: () => {
                            const status = context.response ? context.response.status : 0;
                            if (status < 200 || status >= 300) {
                                throw new Error(`Expected response to be ok, but got status ${status}`);
                            }
                        },
                        error: () => {
                            const status = context.response ? context.response.status : 0;
                            if (status < 400) {
                                throw new Error(`Expected response to be error, but got status ${status}`);
                            }
                        }
                    }
                }
            }),
            
            // 响应断言
            response: {
                to: {
                    have: {
                        status: (code: number) => {
                            const status = context.response ? context.response.status : 0;
                            if (status !== code) {
                                throw new Error(`Expected status code ${code}, but got ${status}`);
                            }
                        },
                        header: (name: string, value?: string) => {
                            const headers = context.response ? context.response.headers : {};
                            const headerValue = headers[name.toLowerCase()];
                            
                            if (headerValue === undefined) {
                                throw new Error(`Expected response to have header "${name}"`);
                            }
                            
                            if (value !== undefined && headerValue !== value) {
                                throw new Error(`Expected header "${name}" to equal "${value}", but got "${headerValue}"`);
                            }
                        },
                        jsonBody: (expected?: any) => {
                            const responseData = context.response ? context.response.data : null;
                            
                            if (typeof responseData !== 'object' || responseData === null) {
                                throw new Error('Expected response body to be JSON');
                            }
                            
                            if (expected !== undefined) {
                                const actualJson = JSON.stringify(responseData);
                                const expectedJson = JSON.stringify(expected);
                                
                                if (actualJson !== expectedJson) {
                                    throw new Error(`Expected JSON body to equal ${expectedJson}, but got ${actualJson}`);
                                }
                            }
                        }
                    },
                    be: {
                        ok: () => {
                            const status = context.response ? context.response.status : 0;
                            if (status < 200 || status >= 300) {
                                throw new Error(`Expected response to be ok, but got status ${status}`);
                            }
                        },
                        error: () => {
                            const status = context.response ? context.response.status : 0;
                            if (status < 400) {
                                throw new Error(`Expected response to be error, but got status ${status}`);
                            }
                        }
                    }
                }
            },
            
            // 环境变量操作
            environment: {
                get: (key: string) => this.testEnvironment ? this.testEnvironment[key] : undefined,
                set: (key: string, value: any) => {
                    if (this.testEnvironment) {
                        this.testEnvironment[key] = value;
                    }
                },
                unset: (key: string) => {
                    if (this.testEnvironment && key in this.testEnvironment) {
                        delete this.testEnvironment[key];
                    }
                }
            },
            
            // 全局变量操作
            globals: {
                get: (key: string) => variables[key],
                set: (key: string, value: any) => {
                    variables[key] = value;
                },
                unset: (key: string) => {
                    if (key in variables) {
                        delete variables[key];
                    }
                }
            },
            
            // 变量操作（兼容性）
            variables: {
                get: (key: string) => variables[key],
                set: (key: string, value: any) => {
                    variables[key] = value;
                }
            }
        };
    }

    /**
     * 获取嵌套属性值
     */
    private getNestedProperty(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    /**
     * 计算测试统计信息
     */
    private calculateTestStats(tests: TestResult[]): TestStats {
        const totalTests = tests.length;
        const passedTests = tests.filter(test => test.passed).length;
        const failedTests = totalTests - passedTests;
        
        return {
            totalTests,
            passedTests,
            failedTests,
            passRate: totalTests > 0 ? (passedTests / totalTests * 100).toFixed(2) : '0'
        };
    }

    /**
     * 提取错误行号
     */
    private extractLineNumber(error: Error): number | null {
        if (error.stack) {
            const match = error.stack.match(/:([0-9]+):[0-9]+/);
            return match ? parseInt(match[1]) : null;
        }
        return null;
    }

    /**
     * 获取测试历史
     */
    public getTestHistory(limit: number = 50): TestExecutionResult[] {
        return this.testResults
            .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
            .slice(0, limit);
    }

    /**
     * 清除测试历史
     */
    public clearTestHistory(): void {
        this.testResults = [];
        this.emit('testHistoryCleared');
    }

    /**
     * 获取测试统计报告
     */
    public getTestReport(): TestReport {
        const totalRuns = this.testResults.length;
        const totalTests = this.testResults.reduce((sum, result) => sum + result.totalTests, 0);
        const totalPassed = this.testResults.reduce((sum, result) => sum + result.passedTests, 0);
        const totalFailed = this.testResults.reduce((sum, result) => sum + result.failedTests, 0);
        
        const recentResults = this.testResults.slice(-10);
        const averagePassRate = totalTests > 0 ? (totalPassed / totalTests * 100).toFixed(2) : '0';
        
        return {
            totalRuns,
            totalTests,
            totalPassed,
            totalFailed,
            averagePassRate,
            recentResults: recentResults.map(result => ({
                executedAt: result.executedAt,
                totalTests: result.totalTests,
                passedTests: result.passedTests,
                failedTests: result.failedTests,
                passRate: result.passRate
            }))
        };
    }

    /**
     * 设置全局变量
     */
    public setGlobalVariable(key: string, value: any): void {
        this.globalVariables[key] = value;
        this.emit('globalVariableSet', { key, value });
    }

    /**
     * 获取全局变量
     */
    public getGlobalVariable(key: string): any {
        return this.globalVariables[key];
    }

    /**
     * 删除全局变量
     */
    public unsetGlobalVariable(key: string): void {
        if (key in this.globalVariables) {
            delete this.globalVariables[key];
            this.emit('globalVariableUnset', { key });
        }
    }

    /**
     * 清除所有全局变量
     */
    public clearGlobalVariables(): void {
        this.globalVariables = {};
        this.emit('globalVariablesCleared');
    }
}

export default TestManager;