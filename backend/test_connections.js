import dotenv from 'dotenv';
dotenv.config();
import { callGemini } from './services/gemini.js';
import { callGeminiStructuredJSON, callGroqChatJSON } from './services/careerAi.js';
import { tavilySearch } from './services/tavily.js';
import { readDB, writeDB } from './db.js';
import { execFile } from 'child_process';
import path from 'path';

async function runTests() {
  console.log('====================================');
  console.log('SAHAYA.AI — System & API Diagnostics');
  console.log('====================================');

  // 1. Test Gemini General AI
  console.log('\n[1/5] Testing Google Gemini API...');
  try {
    const geminiRes = await callGemini('You are an educational AI assistant.', 'Reply with the single word: OK');
    console.log('  -> Gemini Response:', geminiRes.trim());
    console.log('  -> Status: PASS (Gemini working)');
  } catch (err) {
    console.error('  -> Gemini FAILED:', err.message);
  }

  // 2. Test Gemini Structured JSON
  console.log('\n[2/5] Testing Gemini Structured JSON...');
  try {
    const jsonRes = await callGeminiStructuredJSON(
      'Return a JSON object with keys "connected" (boolean) and "message" (string).',
      'Generate connection status'
    );
    console.log('  -> Structured JSON:', JSON.stringify(jsonRes));
    console.log('  -> Status: PASS (Structured JSON working)');
  } catch (err) {
    console.error('  -> Structured JSON FAILED:', err.message);
  }

  // 3. Test Career AI / Groq Fallback
  console.log('\n[3/5] Testing Career AI Fallback...');
  try {
    const fallbackRes = await callGroqChatJSON(
      'Return JSON with key "careerReady": true',
      'Test career AI connector'
    );
    console.log('  -> Career AI Response:', JSON.stringify(fallbackRes));
    console.log('  -> Status: PASS (Career AI working)');
  } catch (err) {
    console.error('  -> Career AI FAILED:', err.message);
  }

  // 4. Test Tavily Web Search API
  console.log('\n[4/5] Testing Tavily Search API...');
  try {
    const tavilyRes = await tavilySearch('data structures and algorithms roadmap');
    console.log(`  -> Tavily search returned ${tavilyRes?.results?.length || 0} results.`);
    console.log('  -> Status: PASS (Tavily working)');
  } catch (err) {
    console.error('  -> Tavily FAILED:', err.message);
  }

  // 5. Test Python Predictor Engine
  console.log('\n[5/5] Testing Python Predictor Engine...');
  const pythonBin = process.env.PYTHON_BIN || 'python';
  const scriptPath = path.resolve('ai_service/predict.py');
  const payload = JSON.stringify({
    study_hours: 4,
    focus_level: 7,
    breaks: 2,
    difficulty_level: 3,
    previous_score: 75,
    subjects: ['Math', 'Physics']
  });

  try {
    const pyOutput = await new Promise((resolve, reject) => {
      const child = execFile(pythonBin, [scriptPath], (error, stdout, stderr) => {
        if (error) return reject(new Error(stderr || error.message));
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch (e) {
          reject(new Error(`Invalid JSON from Python: ${stdout} | Stderr: ${stderr}`));
        }
      });
      child.stdin.write(payload);
      child.stdin.end();
    });
    console.log('  -> Python Engine Output:', JSON.stringify(pyOutput));
    console.log('  -> Status: PASS (Python AI Predictor working)');
  } catch (err) {
    console.error('  -> Python Engine Warning:', err.message);
  }

  console.log('\n====================================');
  console.log('Diagnostics Complete.');
  console.log('====================================\n');
}

runTests();
