/**
 * ZeAPI 构建脚本
 * 用于构建不同平台的应用程序
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 构建配置接口
interface BuildConfig {
  appId: string;
  productName: string;
  version: string;
  author: string;
  description: string;
}

// 构建选项接口
interface BuildOptions {
  clean?: boolean;
  install?: boolean;
  publish?: string;
  config?: string;
  release?: boolean;
  skipTests?: boolean;
  skipLint?: boolean;
}

// 包信息接口
interface PackageJson {
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

class BuildManager {
  private projectRoot: string;
  private distDir: string;
  private buildConfig: BuildConfig;

  constructor() {
    this.projectRoot = process.cwd();
    this.distDir = path.join(this.projectRoot, 'dist');
    this.buildConfig = {
      appId: 'cn.lemwood.zeapi',
      productName: 'ZeAPI',
      version: this.getVersion(),
      author: 'Lemwood',
      description: 'Professional API Testing Tool'
    };
  }

  /**
   * 获取应用版本
   */
  private getVersion(): string {
    try {
      const packageJson: PackageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      return packageJson.version || '1.0.0';
    } catch (error) {
      console.warn('无法读取版本信息，使用默认版本 1.0.0');
      return '1.0.0';
    }
  }

  /**
   * 检查构建环境
   */
  private checkEnvironment(): void {
    console.log('🔍 检查构建环境...');
    
    // 检查Node.js版本
    const nodeVersion = process.version;
    console.log(`Node.js 版本: ${nodeVersion}`);
    
    if (parseInt(nodeVersion.slice(1)) < 14) {
      throw new Error('需要 Node.js 14 或更高版本');
    }
    
    // 检查必要的依赖
    const requiredDeps = ['electron', 'electron-builder'];
    const packageJson: PackageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    for (const dep of requiredDeps) {
      if (!packageJson.devDependencies?.[dep] && !packageJson.dependencies?.[dep]) {
        throw new Error(`缺少必要依赖: ${dep}`);
      }
    }
    
    console.log('✅ 环境检查通过');
  }

  /**
   * 清理构建目录
   */
  clean(): void {
    console.log('🧹 清理构建目录...');
    
    if (fs.existsSync(this.distDir)) {
      fs.rmSync(this.distDir, { recursive: true, force: true });
    }
    
    // 清理其他临时文件
    const tempDirs = ['build', 'out', '.tmp'];
    tempDirs.forEach(dir => {
      const dirPath = path.join(this.projectRoot, dir);
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
      }
    });
    
    console.log('✅ 清理完成');
  }

  /**
   * 安装依赖
   */
  private installDependencies(): void {
    console.log('📦 安装依赖...');
    
    try {
      execSync('npm install', { 
        stdio: 'inherit',
        cwd: this.projectRoot
      });
      console.log('✅ 依赖安装完成');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`依赖安装失败: ${errorMessage}`);
    }
  }

  /**
   * 编译TypeScript
   */
  private compileTypeScript(): void {
    console.log('🔨 编译TypeScript...');
    
    try {
      // 检查是否存在tsconfig.json
      const tsconfigPath = path.join(this.projectRoot, 'tsconfig.json');
      if (!fs.existsSync(tsconfigPath)) {
        console.warn('⚠️ 未找到tsconfig.json，跳过TypeScript编译');
        return;
      }
      
      // 编译主进程文件
      execSync('npm run build:main', { 
        stdio: 'inherit',
        cwd: this.projectRoot
      });
      
      // 编译 preload.ts 到 dist 目录
      const preloadPath = path.join(this.projectRoot, 'preload.ts');
      if (fs.existsSync(preloadPath)) {
        console.log('🔨 编译 preload 脚本...');
        execSync(`npx tsc preload.ts --outDir ${this.distDir} --target es2020 --module commonjs --esModuleInterop --allowSyntheticDefaultImports --skipLibCheck`, {
          stdio: 'inherit',
          cwd: this.projectRoot
        });
      }
      
      console.log('✅ TypeScript编译完成');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`TypeScript编译失败: ${errorMessage}`);
    }
  }

  /**
   * 构建前端资源
   */
  private buildRenderer(): void {
    console.log('🎨 构建前端资源...');
    
    try {
      // 确保dist目录存在
      if (!fs.existsSync(this.distDir)) {
        fs.mkdirSync(this.distDir, { recursive: true });
      }
      
      // 复制前端文件到dist目录
      const rendererSrc = path.join(this.projectRoot, 'renderer');
      const rendererDist = path.join(this.distDir, 'renderer');
      
      if (fs.existsSync(rendererSrc)) {
        this.copyDirectory(rendererSrc, rendererDist);
      }
      
      // 复制index.html
      const indexSrc = path.join(this.projectRoot, 'index.html');
      const indexDist = path.join(this.distDir, 'index.html');
      
      if (fs.existsSync(indexSrc)) {
        fs.copyFileSync(indexSrc, indexDist);
      }
      
      // 复制assets目录
      const assetsSrc = path.join(this.projectRoot, 'assets');
      const assetsDist = path.join(this.distDir, 'assets');
      
      if (fs.existsSync(assetsSrc)) {
        this.copyDirectory(assetsSrc, assetsDist);
      }
      
      // 编译scripts目录下的TypeScript文件
      const scriptsSrc = path.join(this.projectRoot, 'scripts');
      const scriptsDist = path.join(this.distDir, 'scripts');
      
      if (fs.existsSync(scriptsSrc)) {
        if (!fs.existsSync(scriptsDist)) {
          fs.mkdirSync(scriptsDist, { recursive: true });
        }
        
        // 编译scripts/main.ts
        const mainTsPath = path.join(scriptsSrc, 'main.ts');
        if (fs.existsSync(mainTsPath)) {
          execSync(`tsc ${mainTsPath} --outDir ${scriptsDist} --target es2020 --module es2015 --esModuleInterop --allowSyntheticDefaultImports --skipLibCheck --moduleResolution node --noImplicitAny false --strict false`, {
            cwd: this.projectRoot,
            stdio: 'inherit'
          });
        }
      }
      
      console.log('✅ 前端资源构建完成');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`前端资源构建失败: ${errorMessage}`);
    }
  }

  /**
   * 复制目录
   */
  private copyDirectory(src: string, dest: string): void {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const items = fs.readdirSync(src);
    
    for (const item of items) {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);
      
      if (fs.statSync(srcPath).isDirectory()) {
        this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * 构建应用
   * @param platform 目标平台
   * @param options 构建选项
   */
  async build(platform: string = 'current', options: BuildOptions = {}): Promise<void> {
    try {
      this.checkEnvironment();
      
      if (options.clean !== false) {
        this.clean();
      }
      
      if (options.install !== false) {
        this.installDependencies();
      }
      
      // 编译TypeScript
      this.compileTypeScript();
      
      // 构建前端资源
      this.buildRenderer();
      
      console.log(`🚀 开始构建 ${platform} 平台应用...`);
      
      const buildCommand = this.getBuildCommand(platform, options);
      
      execSync(buildCommand, {
        stdio: 'inherit',
        cwd: this.projectRoot,
        env: {
          ...process.env,
          NODE_ENV: 'production'
        }
      });
      
      console.log('✅ 构建完成!');
      this.showBuildInfo(platform);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ 构建失败:', errorMessage);
      process.exit(1);
    }
  }

  /**
   * 获取构建命令
   * @param platform 目标平台
   * @param options 构建选项
   */
  private getBuildCommand(platform: string, options: BuildOptions): string {
    const baseCommand = 'npx electron-builder';
    const flags: string[] = [];
    
    // 平台参数
    switch (platform.toLowerCase()) {
      case 'windows':
      case 'win':
        flags.push('--win');
        break;
      case 'macos':
      case 'mac':
        flags.push('--mac');
        break;
      case 'linux':
        flags.push('--linux');
        break;
      case 'android':
        return this.getAndroidBuildCommand(options);
      case 'all':
        flags.push('--win', '--mac', '--linux');
        break;
      case 'current':
      default:
        // 根据当前系统选择平台
        const currentPlatform = os.platform();
        if (currentPlatform === 'win32') {
          flags.push('--win');
        } else if (currentPlatform === 'darwin') {
          flags.push('--mac');
        } else {
          flags.push('--linux');
        }
        break;
    }
    
    // 其他选项
    if (options.publish) {
      flags.push('--publish', options.publish);
    }
    
    if (options.config) {
      flags.push('--config', options.config);
    }
    
    return `${baseCommand} ${flags.join(' ')}`;
  }

  /**
   * 获取Android构建命令
   * @param options 构建选项
   */
  private getAndroidBuildCommand(options: BuildOptions): string {
    // Android构建需要特殊处理
    const commands = [
      'npx cap add android',
      'npx cap sync android',
      'npx cap build android'
    ];
    
    if (options.release) {
      commands[commands.length - 1] += ' --prod --release';
    }
    
    return commands.join(' && ');
  }

  /**
   * 显示构建信息
   * @param platform 构建平台
   */
  private showBuildInfo(platform: string): void {
    console.log('\n📋 构建信息:');
    console.log(`应用名称: ${this.buildConfig.productName}`);
    console.log(`应用版本: ${this.buildConfig.version}`);
    console.log(`构建平台: ${platform}`);
    console.log(`构建时间: ${new Date().toLocaleString()}`);
    
    // 显示输出文件
    if (fs.existsSync(this.distDir)) {
      console.log('\n📁 输出文件:');
      const files = fs.readdirSync(this.distDir);
      files.forEach(file => {
        const filePath = path.join(this.distDir, file);
        const stats = fs.statSync(filePath);
        const size = this.formatFileSize(stats.size);
        console.log(`  ${file} (${size})`);
      });
    }
  }

  /**
   * 格式化文件大小
   * @param bytes 字节数
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * 开发模式启动
   */
  dev(): void {
    console.log('🚀 启动开发模式...');
    
    try {
      execSync('npm run dev', {
        stdio: 'inherit',
        cwd: this.projectRoot
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ 开发模式启动失败:', errorMessage);
      process.exit(1);
    }
  }

  /**
   * 运行测试
   */
  test(): void {
    console.log('🧪 运行测试...');
    
    try {
      execSync('npm test', {
        stdio: 'inherit',
        cwd: this.projectRoot
      });
      console.log('✅ 测试完成');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ 测试失败:', errorMessage);
      process.exit(1);
    }
  }

  /**
   * 代码检查
   */
  lint(): void {
    console.log('🔍 代码检查...');
    
    try {
      execSync('npm run lint', {
        stdio: 'inherit',
        cwd: this.projectRoot
      });
      console.log('✅ 代码检查通过');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn('⚠️ 代码检查发现问题:', errorMessage);
    }
  }

  /**
   * 打包发布
   * @param platform 目标平台
   * @param options 发布选项
   */
  async release(platform: string = 'current', options: BuildOptions = {}): Promise<void> {
    console.log('📦 准备发布...');
    
    // 运行测试
    if (options.skipTests !== true) {
      this.test();
    }
    
    // 代码检查
    if (options.skipLint !== true) {
      this.lint();
    }
    
    // 构建应用
    await this.build(platform, {
      ...options,
      publish: options.publish || 'never'
    });
    
    console.log('🎉 发布准备完成!');
  }
}

// 命令行接口
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const platform = args[1] || 'current';
  
  const buildManager = new BuildManager();
  
  switch (command) {
    case 'build':
      buildManager.build(platform);
      break;
    case 'dev':
      buildManager.dev();
      break;
    case 'test':
      buildManager.test();
      break;
    case 'lint':
      buildManager.lint();
      break;
    case 'clean':
      buildManager.clean();
      break;
    case 'release':
      buildManager.release(platform);
      break;
    case 'help':
    default:
      console.log(`
🛠️  ZeAPI 构建工具

使用方法:
  node build.js <command> [platform] [options]

命令:
  build [platform]    构建应用 (windows|macos|linux|android|all|current)
  dev                 启动开发模式
  test               运行测试
  lint               代码检查
  clean              清理构建文件
  release [platform] 打包发布
  help               显示帮助信息

平台:
  windows            Windows 平台
  macos              macOS 平台
  linux              Linux 平台
  android            Android 平台
  all                所有平台
  current            当前平台 (默认)

示例:
  node build.js build windows
  node build.js dev
  node build.js release android
`);
      break;
  }
}

export default BuildManager;
export { BuildConfig, BuildOptions, PackageJson };