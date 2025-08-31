/**
 * 测试脚本管理模块
 * 负责处理API测试脚本的执行、断言、结果收集等功能
 */

const { EventEmitter } = require('events');
const vm = require('vm');

class TestManager extends EventEmitter {
    constructor() {
        super();
        this.testResults = [];
        this.globalVariables = {};
        this.testEnvironment = null;
    }

    /**
     * 设置测试环境
     * @param {Object} environment 环境变量
     */
    setEnvironment(environment) {
        this.testEnvironment = environment;
    }

    /**
     * 执行预请求脚本
     * @param {string} script 脚本内容
     * @param {Object} context 执行上下文
     * @returns {Object} 执行结果
     */
    async executePreRequestScript(script, context = {}) {
        if (!script || script.trim() === '') {
            return { success: true, variables: {}, logs: [] };
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
     * @param {string} script 脚本内容
     * @param {Object} response 响应对象
     * @param {Object} context 执行上下文
     * @returns {Object} 测试结果
     */
    async executeTestScript(script, response, context = {}) {
        if (!script || script.trim() === '') {
            return {
                success: true,
                tests: [],
                variables: {},
                logs: [],
                totalTests: 0,
                passedTests: 0,
                failedTests: 0
            };
        }

        try {
            const testContext = {
                ...context,
                response,
                type: 'test'
            };
            
            const result = await this.executeScript(script, testContext);
            
            // 计算测试统计
            const stats = this.calculateTestStats(result.tests);
            
            const testResult = {
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
     * @param {string} script 脚本内容
     * @param {Object} context 执行上下文
     * @returns {Object} 执行结果
     */
    async executeScript(script, context = {}) {
        const logs = [];
        const tests = [];
        const variables = { ...this.globalVariables };
        const errors = [];

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
            errors.push({
                message: error.message,
                stack: error.stack,
                line: this.extractLineNumber(error)
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
     * @param {Object} params 参数
     * @returns {Object} 沙箱对象
     */
    createSandbox({ context, logs, tests, variables, errors }) {
        const sandbox = {
            // 全局对象
            console: {
                log: (...args) => logs.push({ level: 'log', message: args.join(' '), timestamp: Date.now() }),
                info: (...args) => logs.push({ level: 'info', message: args.join(' '), timestamp: Date.now() }),
                warn: (...args) => logs.push({ level: 'warn', message: args.join(' '), timestamp: Date.now() }),
                error: (...args) => logs.push({ level: 'error', message: args.join(' '), timestamp: Date.now() })
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
            btoa: (str) => Buffer.from(str).toString('base64'),
            atob: (str) => Buffer.from(str, 'base64').toString(),
            
            // 随机数生成
            randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
            randomString: (length = 10) => Math.random().toString(36).substring(2, length + 2),
            uuid: () => {
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                    const r = Math.random() * 16 | 0;
                    const v = c === 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            },
            
            // 时间函数
            timestamp: () => Date.now(),
            isoTimestamp: () => new Date().toISOString(),
            
            // 错误处理
            setTimeout: () => { throw new Error('setTimeout is not allowed in test scripts'); },
            setInterval: () => { throw new Error('setInterval is not allowed in test scripts'); },
            require: () => { throw new Error('require is not allowed in test scripts'); }
        };
        
        return sandbox;
    }

    /**
     * 创建pm对象（类似Postman的pm对象）
     * @param {Array} tests 测试数组
     * @param {Object} variables 变量对象
     * @param {Object} context 上下文
     * @returns {Object} pm对象
     */
    createPmObject(tests, variables, context) {
        return {
            // 测试函数
            test: (name, fn) => {
                try {
                    const testResult = {
                        name,
                        passed: false,
                        error: null,
                        executedAt: Date.now()
                    };
                    
                    fn();
                    testResult.passed = true;
                    tests.push(testResult);
                } catch (error) {
                    tests.push({
                        name,
                        passed: false,
                        error: error.message,
                        executedAt: Date.now()
                    });
                }
            },
            
            // 期望函数
            expect: (actual) => {
                return {
                    to: {
                        equal: (expected) => {
                            if (actual !== expected) {
                                throw new Error(`Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
                            }
                        },
                        eql: (expected) => {
                            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                                throw new Error(`Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
                            }
                        },
                        be: {
                            a: (type) => {
                                if (typeof actual !== type) {
                                    throw new Error(`Expected type ${type}, but got ${typeof actual}`);
                                }
                            },
                            an: (type) => {
                                if (typeof actual !== type) {
                                    throw new Error(`Expected type ${type}, but got ${typeof actual}`);
                                }
                            },
                            above: (value) => {
                                if (actual <= value) {
                                    throw new Error(`Expected ${actual} to be above ${value}`);
                                }
                            },
                            below: (value) => {
                                if (actual >= value) {
                                    throw new Error(`Expected ${actual} to be below ${value}`);
                                }
                            },
                            true: () => {
                                if (actual !== true) {
                                    throw new Error(`Expected true, but got ${actual}`);
                                }
                            },
                            false: () => {
                                if (actual !== false) {
                                    throw new Error(`Expected false, but got ${actual}`);
                                }
                            },
                            null: () => {
                                if (actual !== null) {
                                    throw new Error(`Expected null, but got ${actual}`);
                                }
                            },
                            undefined: () => {
                                if (actual !== undefined) {
                                    throw new Error(`Expected undefined, but got ${actual}`);
                                }
                            }
                        },
                        have: {
                            property: (prop, value) => {
                                if (!(prop in actual)) {
                                    throw new Error(`Expected object to have property ${prop}`);
                                }
                                if (value !== undefined && actual[prop] !== value) {
                                    throw new Error(`Expected property ${prop} to equal ${value}, but got ${actual[prop]}`);
                                }
                            },
                            length: (length) => {
                                if (actual.length !== length) {
                                    throw new Error(`Expected length ${length}, but got ${actual.length}`);
                                }
                            }
                        },
                        include: (value) => {
                            if (Array.isArray(actual)) {
                                if (!actual.includes(value)) {
                                    throw new Error(`Expected array to include ${JSON.stringify(value)}`);
                                }
                            } else if (typeof actual === 'string') {
                                if (!actual.includes(value)) {
                                    throw new Error(`Expected string to include ${value}`);
                                }
                            } else {
                                throw new Error('Include assertion only works with arrays and strings');
                            }
                        },
                        match: (regex) => {
                            if (!regex.test(actual)) {
                                throw new Error(`Expected ${actual} to match ${regex}`);
                            }
                        }
                    },
                    not: {
                        to: {
                            equal: (expected) => {
                                if (actual === expected) {
                                    throw new Error(`Expected ${JSON.stringify(actual)} not to equal ${JSON.stringify(expected)}`);
                                }
                            },
                            be: {
                                null: () => {
                                    if (actual === null) {
                                        throw new Error('Expected value not to be null');
                                    }
                                },
                                undefined: () => {
                                    if (actual === undefined) {
                                        throw new Error('Expected value not to be undefined');
                                    }
                                }
                            }
                        }
                    }
                };
            },
            
            // 响应对象
            response: {
                to: {
                    have: {
                        status: (code) => {
                            const actualCode = context.response ? context.response.status : 0;
                            if (actualCode !== code) {
                                throw new Error(`Expected status ${code}, but got ${actualCode}`);
                            }
                        },
                        header: (name, value) => {
                            const headers = context.response ? context.response.headers : {};
                            const headerValue = headers[name.toLowerCase()];
                            if (headerValue === undefined) {
                                throw new Error(`Expected header ${name} to exist`);
                            }
                            if (value !== undefined && headerValue !== value) {
                                throw new Error(`Expected header ${name} to equal ${value}, but got ${headerValue}`);
                            }
                        },
                        jsonBody: (path, value) => {
                            const body = context.response ? context.response.data : null;
                            if (!body) {
                                throw new Error('Response body is empty');
                            }
                            
                            const actualValue = this.getNestedProperty(body, path);
                            if (value !== undefined && actualValue !== value) {
                                throw new Error(`Expected ${path} to equal ${value}, but got ${actualValue}`);
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
                get: (key) => this.testEnvironment ? this.testEnvironment[key] : undefined,
                set: (key, value) => {
                    if (this.testEnvironment) {
                        this.testEnvironment[key] = value;
                    }
                },
                unset: (key) => {
                    if (this.testEnvironment && key in this.testEnvironment) {
                        delete this.testEnvironment[key];
                    }
                }
            },
            
            // 全局变量操作
            globals: {
                get: (key) => variables[key],
                set: (key, value) => {
                    variables[key] = value;
                },
                unset: (key) => {
                    if (key in variables) {
                        delete variables[key];
                    }
                }
            },
            
            // 变量操作（兼容性）
            variables: {
                get: (key) => variables[key],
                set: (key, value) => {
                    variables[key] = value;
                }
            }
        };
    }

    /**
     * 获取嵌套属性值
     * @param {Object} obj 对象
     * @param {string} path 属性路径
     * @returns {*} 属性值
     */
    getNestedProperty(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    /**
     * 计算测试统计信息
     * @param {Array} tests 测试数组
     * @returns {Object} 统计信息
     */
    calculateTestStats(tests) {
        const totalTests = tests.length;
        const passedTests = tests.filter(test => test.passed).length;
        const failedTests = totalTests - passedTests;
        
        return {
            totalTests,
            passedTests,
            failedTests,
            passRate: totalTests > 0 ? (passedTests / totalTests * 100).toFixed(2) : 0
        };
    }

    /**
     * 提取错误行号
     * @param {Error} error 错误对象
     * @returns {number|null} 行号
     */
    extractLineNumber(error) {
        if (error.stack) {
            const match = error.stack.match(/:([0-9]+):[0-9]+/);
            return match ? parseInt(match[1]) : null;
        }
        return null;
    }

    /**
     * 获取测试历史
     * @param {number} limit 限制数量
     * @returns {Array} 测试历史
     */
    getTestHistory(limit = 50) {
        return this.testResults
            .sort((a, b) => new Date(b.executedAt) - new Date(a.executedAt))
            .slice(0, limit);
    }

    /**
     * 清除测试历史
     */
    clearTestHistory() {
        this.testResults = [];
        this.emit('testHistoryCleared');
    }

    /**
     * 获取测试统计报告
     * @returns {Object} 统计报告
     */
    getTestReport() {
        const totalRuns = this.testResults.length;
        const totalTests = this.testResults.reduce((sum, result) => sum + result.totalTests, 0);
        const totalPassed = this.testResults.reduce((sum, result) => sum + result.passedTests, 0);
        const totalFailed = this.testResults.reduce((sum, result) => sum + result.failedTests, 0);
        
        const recentResults = this.testResults.slice(-10);
        const averagePassRate = totalTests > 0 ? (totalPassed / totalTests * 100).toFixed(2) : 0;
        
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
     * @param {string} key 键
     * @param {*} value 值
     */
    setGlobalVariable(key, value) {
        this.globalVariables[key] = value;
        this.emit('globalVariableSet', { key, value });
    }

    /**
     * 获取全局变量
     * @param {string} key 键
     * @returns {*} 值
     */
    getGlobalVariable(key) {
        return this.globalVariables[key];
    }

    /**
     * 删除全局变量
     * @param {string} key 键
     */
    unsetGlobalVariable(key) {
        if (key in this.globalVariables) {
            delete this.globalVariables[key];
            this.emit('globalVariableUnset', { key });
        }
    }

    /**
     * 清除所有全局变量
     */
    clearGlobalVariables() {
        this.globalVariables = {};
        this.emit('globalVariablesCleared');
    }
}

module.exports = TestManager;