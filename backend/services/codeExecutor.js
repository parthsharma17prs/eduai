import {spawn} from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import {v4 as uuidv4} from 'uuid';
import {fileURLToPath} from 'url';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);

const MAX_EXECUTION_TIME=parseInt(process.env.MAX_EXECUTION_TIME)||5000;
const MAX_COMPILE_TIME=parseInt(process.env.MAX_COMPILE_TIME)||10000;
const MAX_OUTPUT_SIZE=1024*512;
const MAX_CODE_SIZE=1024*100;
const MAX_MEMORY_MB=parseInt(process.env.MAX_MEMORY_MB)||256;

class CodeExecutor
{
    constructor()
    {
        this.tempDir=path.join(__dirname, '..', 'temp');
        this.ensureTempDir();
    }

    async ensureTempDir()
    {
        try
        {
            await fs.mkdir(this.tempDir, {recursive: true});
        } catch (error)
        {
            console.error('Failed to create temp directory:', error);
        }
    }

    async execute(code, language, input='')
    {
        const startTime=Date.now();
        try
        {
            if (code.length>MAX_CODE_SIZE)
            {
                throw new Error(`Code exceeds maximum size of ${MAX_CODE_SIZE/1024}KB`);
            }
            const securityCheck=this.validateCodeSecurity(code, language);
            if (!securityCheck.safe)
            {
                throw new Error(`Security violation: ${securityCheck.reason}`);
            }
            let result;
            switch (language.toLowerCase())
            {
                case 'python': result=await this.executePython(code, input); break;
                case 'javascript': case 'js': result=await this.executeJavaScript(code, input); break;
                case 'java': result=await this.executeJava(code, input); break;
                case 'cpp': case 'c++': result=await this.executeCpp(code, input); break;
                case 'c': result=await this.executeC(code, input); break;
                default: throw new Error(`Language ${language} not supported`);
            }
            const executionTime=Date.now()-startTime;
            if (result.output&&result.output.length>MAX_OUTPUT_SIZE)
            {
                result.output=result.output.substring(0, MAX_OUTPUT_SIZE)+'\n... [Output truncated]';
            }
            return {...result, executionTime};
        } catch (error)
        {
            return {output: '', errors: error.message, executionTime: Date.now()-startTime, hasError: true};
        }
    }

    validateCodeSecurity(code, language)
    {
        const dangerousPatterns={
            python: [
                /import\s+os\b/i, /from\s+os\b/i, /import\s+\w+\s+as\s+\w+.*\bos\b/i,
                /import\s+subprocess\b/i, /from\s+subprocess\b/i,
                /import\s+sys\b/i, /from\s+sys\b/i,
                /import\s+shutil\b/i, /from\s+shutil\b/i,
                /import\s+socket\b/i, /from\s+socket\b/i,
                /import\s+http/i, /from\s+http/i,
                /import\s+urllib/i, /from\s+urllib/i,
                /import\s+requests\b/i,
                /import\s+ctypes\b/i, /from\s+ctypes\b/i,
                /import\s+signal\b/i, /from\s+signal\b/i,
                /__import__\s*\(/i, /importlib/i,
                /eval\s*\(/i, /exec\s*\(/i, /compile\s*\(/i,
                /open\s*\(/i, /file\s*\(/i,
                /getattr\s*\(/i, /setattr\s*\(/i,
                /globals\s*\(/i, /locals\s*\(/i,
                /breakpoint\s*\(/i,
            ],
            javascript: [
                /require\s*\(/i, /import\s+.*from/i,
                /eval\s*\(/i, /Function\s*\(/i,
                /child_process/i, /\bfs\b[\s.]/i, /process\./i,
                /globalThis/i, /Reflect\./i,
                /WebAssembly/i, /SharedArrayBuffer/i,
            ],
            java: [
                /Runtime\.getRuntime/i, /ProcessBuilder/i,
                /java\.io\.File/i, /java\.nio\.file/i,
                /System\.exit/i, /Class\.forName/i,
                /java\.net\./i, /java\.lang\.reflect/i,
                /SecurityManager/i, /ClassLoader/i,
            ],
            cpp: [
                /system\s*\(/i, /exec\w*\s*\(/i, /popen/i,
                /#include\s*<fstream>/i, /remove\s*\(/i, /rename\s*\(/i,
                /#include\s*<cstdlib>/i, /#include\s*<unistd\.h>/i,
                /fork\s*\(/i, /socket\s*\(/i,
            ],
            c: [
                /system\s*\(/i, /exec\w*\s*\(/i, /popen/i,
                /fopen/i, /remove\s*\(/i, /rename\s*\(/i,
                /fork\s*\(/i, /socket\s*\(/i,
                /#include\s*<unistd\.h>/i,
            ]
        };
        const lang=language.toLowerCase();
        const patterns=dangerousPatterns[lang==='c++'? 'cpp':lang]||[];
        for (const pattern of patterns)
        {
            if (pattern.test(code))
            {
                return {safe: false, reason: `Dangerous pattern detected: ${pattern.toString()}`};
            }
        }
        return {safe: true};
    }

    async executePython(code, input)
    {
        const filename=`temp_${uuidv4()}.py`;
        const filepath=path.join(this.tempDir, filename);
        // Sandbox: restrict imports by prepending policy
        const sandboxedCode=`import resource\nresource.setrlimit(resource.RLIMIT_AS, (${MAX_MEMORY_MB}*1024*1024, ${MAX_MEMORY_MB}*1024*1024))\n`+code;
        try
        {
            await fs.writeFile(filepath, process.platform==='linux'? sandboxedCode:code);
            const pythonBin = process.env.PYTHON_BIN || 'python3';
            const result=await this.runCommand(pythonBin, ['-u', filepath], input);
            await fs.unlink(filepath).catch((e) => console.warn('[CODE-EXEC] Cleanup failed:', e.message));
            return result;
        } catch (error)
        {
            await fs.unlink(filepath).catch((e) => console.warn('[CODE-EXEC] Cleanup failed:', e.message));
            throw error;
        }
    }

    async executeJavaScript(code, input)
    {
        // Write user code to a separate file to avoid template injection
        const codeFilename=`temp_code_${uuidv4()}.js`;
        const codeFilepath=path.join(this.tempDir, codeFilename);

        const filename=`temp_${uuidv4()}.js`;
        const filepath=path.join(this.tempDir, filename);

        const wrappedCode=`
const fs = require('fs');
const userCode = fs.readFileSync(${JSON.stringify(codeFilepath)}, 'utf8');
const inputs = ${JSON.stringify(input.split('\n'))};
let inputIndex = 0;
global.input = () => inputs[inputIndex++] || '';
const vm = require('vm');
const sandbox = { console, input: global.input, setTimeout, setInterval, clearTimeout, clearInterval, Math, JSON, Date, Array, Object, String, Number, Boolean, Map, Set, RegExp, Error, parseInt, parseFloat, isNaN, isFinite };
vm.createContext(sandbox);
vm.runInContext(userCode, sandbox, { timeout: ${MAX_EXECUTION_TIME}, filename: 'user-code.js' });
`;
        try
        {
            await fs.writeFile(codeFilepath, code);
            await fs.writeFile(filepath, wrappedCode);
            const result=await this.runCommand('node', [filepath], input);
            await fs.unlink(filepath).catch(() => {});
            await fs.unlink(codeFilepath).catch(() => {});
            return result;
        } catch (error)
        {
            await fs.unlink(filepath).catch(() => {});
            await fs.unlink(codeFilepath).catch(() => {});
            throw error;
        }
    }

    async executeJava(code, input)
    {
        const className=this.extractJavaClassName(code)||'Main';
        const filename=`${className}.java`;
        const filepath=path.join(this.tempDir, filename);
        try
        {
            await fs.writeFile(filepath, code);
            const compileResult=await this.compileCommand('javac', [filepath]);
            if (compileResult.hasError)
            {
                return {output: '', errors: compileResult.errors, hasError: true};
            }
            const result=await this.runCommand('java', [`-Xmx${MAX_MEMORY_MB}m`, '-cp', this.tempDir, className], input);
            await fs.unlink(filepath).catch((e) => console.warn('[CODE-EXEC] Cleanup:', e.message));
            await fs.unlink(path.join(this.tempDir, `${className}.class`)).catch((e) => console.warn('[CODE-EXEC] Cleanup:', e.message));
            return result;
        } catch (error)
        {
            await fs.unlink(filepath).catch((e) => console.warn('[CODE-EXEC] Cleanup:', e.message));
            throw error;
        }
    }

    async executeCpp(code, input)
    {
        const filename=`temp_${uuidv4()}.cpp`;
        const filepath=path.join(this.tempDir, filename);
        const exepath=path.join(this.tempDir, `temp_${uuidv4()}.exe`);
        try
        {
            await fs.writeFile(filepath, code);
            const compileResult=await this.compileCommand('g++', [filepath, '-o', exepath]);
            if (compileResult.hasError)
            {
                return {output: '', errors: compileResult.errors, hasError: true};
            }
            const result=await this.runCommand(exepath, [], input);
            await fs.unlink(filepath).catch(() => {});
            await fs.unlink(exepath).catch(() => {});
            return result;
        } catch (error)
        {
            await fs.unlink(filepath).catch(() => {});
            await fs.unlink(exepath).catch(() => {});
            throw error;
        }
    }

    async executeC(code, input)
    {
        const filename=`temp_${uuidv4()}.c`;
        const filepath=path.join(this.tempDir, filename);
        const exepath=path.join(this.tempDir, `temp_${uuidv4()}.exe`);
        try
        {
            await fs.writeFile(filepath, code);
            const compileResult=await this.compileCommand('gcc', [filepath, '-o', exepath]);
            if (compileResult.hasError)
            {
                return {output: '', errors: compileResult.errors, hasError: true};
            }
            const result=await this.runCommand(exepath, [], input);
            await fs.unlink(filepath).catch(() => {});
            await fs.unlink(exepath).catch(() => {});
            return result;
        } catch (error)
        {
            await fs.unlink(filepath).catch(() => {});
            await fs.unlink(exepath).catch(() => {});
            throw error;
        }
    }

    // Non-blocking async compilation (replaces execSync which blocked the event loop)
    compileCommand(compiler, args=[])
    {
        return new Promise((resolve) =>
        {
            const safeEnv={
                PATH: process.env.PATH,
                HOME: process.env.HOME||process.env.USERPROFILE||'/tmp',
                TEMP: process.env.TEMP||'/tmp',
                TMP: process.env.TMP||'/tmp',
            };

            const proc=spawn(compiler, args, {
                env: safeEnv,
                cwd: this.tempDir,
            });
            let stderr='';
            const timeout=setTimeout(() => {proc.kill('SIGKILL'); resolve({hasError: true, errors: 'Compilation timeout'});}, MAX_COMPILE_TIME);
            proc.stderr.on('data', (data) => {stderr+=data.toString();});
            proc.on('close', (code) => {clearTimeout(timeout); resolve({hasError: code!==0, errors: stderr});});
            proc.on('error', (error) => {clearTimeout(timeout); resolve({hasError: true, errors: error.message});});
        });
    }

    runCommand(command, args=[], input='')
    {
        return new Promise((resolve, reject) =>
        {
            // Use minimal environment to prevent credential leakage
            const safeEnv={
                PATH: process.env.PATH,
                HOME: process.env.HOME||process.env.USERPROFILE||'/tmp',
                TEMP: process.env.TEMP||'/tmp',
                TMP: process.env.TMP||'/tmp',
                LANG: process.env.LANG||'en_US.UTF-8',
            };

            const proc=spawn(command, args, {
                env: safeEnv,
                cwd: this.tempDir,
            });
            let stdout='';
            let stderr='';
            const timeout=setTimeout(() => {proc.kill('SIGKILL'); reject(new Error('Execution timeout'));}, MAX_EXECUTION_TIME);
            proc.stdout.on('data', (data) => {stdout+=data.toString();});
            proc.stderr.on('data', (data) => {stderr+=data.toString();});
            proc.on('close', (code) => {clearTimeout(timeout); resolve({output: stdout, errors: stderr, hasError: code!==0||stderr.length>0});});
            proc.on('error', (error) => {clearTimeout(timeout); reject(error);});
            if (input) {proc.stdin.write(input); proc.stdin.end();}
        });
    }

    async validateSyntax(code, language)
    {
        try
        {
            const result=await this.execute(code, language, '');
            return {valid: !result.hasError, errors: result.hasError? result.errors:null};
        } catch (error)
        {
            return {valid: false, errors: error.message};
        }
    }

    extractJavaClassName(code)
    {
        const match=code.match(/public\s+class\s+(\w+)/);
        return match? match[1]:null;
    }
}

export default new CodeExecutor();
