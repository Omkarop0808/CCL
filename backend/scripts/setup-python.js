import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('Ensuring Python dependencies are installed...');

function runCommand(command) {
  try {
    console.log(`Running: ${command}`);
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (err) {
    console.warn(`Command failed: ${command}`);
    return false;
  }
}

const reqFile = 'ai_service/requirements.txt';

const isLinux = process.platform === 'linux';
const venvDir = 'ai_service/venv';
const venvPython = isLinux ? `${venvDir}/bin/python` : `${venvDir}/Scripts/python`;

let success = false;

// 1. Create a virtual environment locally
console.log('Creating local Python virtual environment...');
const venvCreated = 
  runCommand(`python3 -m venv ${venvDir}`) || 
  runCommand(`python -m venv ${venvDir}`) || 
  runCommand(`py -m venv ${venvDir}`);

if (venvCreated) {
  console.log(`Installing dependencies into ${venvDir}...`);
  success = runCommand(`${venvPython} -m pip install -r ${reqFile}`);
  
  if (!success && isLinux) {
    console.log('Venv pip install failed (likely missing ensurepip). Bootstrapping pip into venv...');
    runCommand('curl -fsSL https://bootstrap.pypa.io/get-pip.py -o get-pip.py');
    runCommand(`${venvPython} get-pip.py`);
    success = runCommand(`${venvPython} -m pip install -r ${reqFile}`);
  }
}

// 2. Fallbacks if venv creation or installation failed
if (!success) {
  console.log('Venv failed, trying fallback global installation...');
  if (isLinux) {
    success =
      runCommand(`python3 -m pip install -r ${reqFile} --break-system-packages`) ||
      (
        runCommand('curl -fsSL https://bootstrap.pypa.io/get-pip.py -o get-pip.py') &&
        runCommand('python3 get-pip.py --break-system-packages') &&
        runCommand(`python3 -m pip install -r ${reqFile} --break-system-packages`)
      );
  } else {
    success =
      runCommand(`python -m pip install -r ${reqFile}`) ||
      runCommand(`py -m pip install -r ${reqFile}`) ||
      runCommand(`python3 -m pip install -r ${reqFile}`);
  }
}

if (!success) {
  console.error('Failed to install Python dependencies. Please check the logs.');
  process.exit(1);
} else {
  console.log('Python dependencies installed successfully.');
}
