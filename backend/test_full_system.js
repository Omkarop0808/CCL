import dotenv from 'dotenv';
dotenv.config();

const BASE_API = 'http://localhost:5000/api';
const FRONTEND_URL = 'http://localhost:5005';

let testToken = '';
let testUserId = '';
const results = [];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function record(name, pass, details = '') {
  results.push({ name, pass, details });
  const status = pass ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} — ${name}${details ? ` (${details})` : ''}`);
}

async function runAllChecks() {
  console.log('=====================================================');
  console.log('SAHAYA.AI — Complete Full-Stack & Systems Verification');
  console.log('=====================================================\n');

  // 1. Frontend Web Server
  try {
    const res = await fetch(FRONTEND_URL);
    const html = await res.text();
    const hasVite = html.includes('id="root"') || html.includes('vite');
    record('Frontend Vite Server (Port 5005)', res.ok && hasVite, `HTTP ${res.status}`);
  } catch (err) {
    record('Frontend Vite Server (Port 5005)', false, err.message);
  }

  // 2. Backend Health API
  try {
    const res = await fetch(`${BASE_API}/health`);
    const data = await res.json();
    record('Backend Health API (/api/health)', res.ok && data.status === 'ok', `status: ${data.status}`);
  } catch (err) {
    record('Backend Health API (/api/health)', false, err.message);
  }

  // 3. User Registration (Database Write)
  const timestamp = Date.now();
  const testEmail = `student_${timestamp}@sahaya.ai`;
  const testPassword = 'Password123!';
  const testName = 'Sahaya Test Student';

  try {
    const res = await fetch(`${BASE_API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: testName, email: testEmail, password: testPassword }),
    });
    const data = await res.json();
    if (res.ok && data.token && data.user) {
      testToken = data.token;
      testUserId = data.user.id;
      record('Auth Register & DB User Insert', true, `User ID: ${testUserId}`);
    } else {
      record('Auth Register & DB User Insert', false, data.error || `HTTP ${res.status}`);
    }
  } catch (err) {
    record('Auth Register & DB User Insert', false, err.message);
  }

  // 4. User Login (Database Read & Password Hash Verification)
  try {
    const res = await fetch(`${BASE_API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    const data = await res.json();
    record('Auth Login & Credentials Verification', res.ok && Boolean(data.token), `Token acquired`);
  } catch (err) {
    record('Auth Login & Credentials Verification', false, err.message);
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${testToken}`,
  };

  // 5. User Profile (Database Read)
  try {
    const res = await fetch(`${BASE_API}/profile/user`, { headers: authHeaders });
    const data = await res.json();
    record('User Profile Retrieval (/api/profile/user)', res.ok && data.user?.email === testEmail, data.user?.email);
  } catch (err) {
    record('User Profile Retrieval (/api/profile/user)', false, err.message);
  }

  // 6. Educational Profile Setup (Database Write / Update)
  try {
    const res = await fetch(`${BASE_API}/profile/edu`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        institution: 'National Institute of Technology',
        educationLevel: 'Undergraduate',
        course: 'Computer Science & Engineering',
        semester: '6th Semester',
        specialization: 'Artificial Intelligence',
        subjects: ['Data Structures & Algorithms', 'Operating Systems', 'Database Management', 'Machine Learning'],
      }),
    });
    const data = await res.json();
    record('Education Profile Setup (/api/profile/edu)', res.ok && data.success, `Course: ${data.eduData?.course}`);
  } catch (err) {
    record('Education Profile Setup (/api/profile/edu)', false, err.message);
  }

  // 7. Educational Profile Retrieval (Database Read)
  try {
    const res = await fetch(`${BASE_API}/profile/edu`, { headers: authHeaders });
    const data = await res.json();
    record('Education Profile Read (/api/profile/edu)', res.ok && data.eduData?.subjects?.length === 4, `${data.eduData?.subjects?.length} subjects`);
  } catch (err) {
    record('Education Profile Read (/api/profile/edu)', false, err.message);
  }

  // 8. Gamification Profile (Level, XP, Streaks)
  try {
    const res = await fetch(`${BASE_API}/gamification/profile`, { headers: authHeaders });
    const data = await res.json();
    record('Gamification Profile & XP Core (/api/gamification/profile)', res.ok && typeof data.level === 'number', `Level ${data.level}, XP ${data.xp}`);
  } catch (err) {
    record('Gamification Profile & XP Core (/api/gamification/profile)', false, err.message);
  }

  // 9. Daily Quests (Study World)
  try {
    const res = await fetch(`${BASE_API}/gamification/quests?world=study`, { headers: authHeaders });
    const data = await res.json();
    record('Daily Quests Study World (/api/gamification/quests?world=study)', res.ok && Array.isArray(data.quests), `${data.quests?.length} quests generated`);
  } catch (err) {
    record('Daily Quests Study World (/api/gamification/quests?world=study)', false, err.message);
  }

  // 10. Daily Quests (Career World)
  try {
    const res = await fetch(`${BASE_API}/gamification/quests?world=career`, { headers: authHeaders });
    const data = await res.json();
    record('Daily Quests Career World (/api/gamification/quests?world=career)', res.ok && Array.isArray(data.quests), `${data.quests?.length} quests generated`);
  } catch (err) {
    record('Daily Quests Career World (/api/gamification/quests?world=career)', false, err.message);
  }

  // 11. Leaderboard API
  try {
    const res = await fetch(`${BASE_API}/gamification/leaderboard`, { headers: authHeaders });
    const data = await res.json();
    record('Global Leaderboard API (/api/gamification/leaderboard)', res.ok && Array.isArray(data.leaderboard), `${data.leaderboard?.length} entries`);
  } catch (err) {
    record('Global Leaderboard API (/api/gamification/leaderboard)', false, err.message);
  }

  // 12. AI Ask / Explainer (Google Gemini API)
  await delay(1500);
  try {
    const res = await fetch(`${BASE_API}/ai/ask`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        question: 'What is QuickSort in 20 words?',
        subject: 'Algorithms',
      }),
    });
    const data = await res.json();
    record('AI Explainer (/api/ai/ask — Google Gemini)', res.ok && Boolean(data.answer), `${data.answer?.slice(0, 50)}...`);
  } catch (err) {
    record('AI Explainer (/api/ai/ask — Google Gemini)', false, err.message);
  }

  // 13. AI Practice Questions Generator (Gemini Structured JSON)
  await delay(1500);
  try {
    const res = await fetch(`${BASE_API}/ai/questions`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        subject: 'Operating Systems',
        context: 'Processes and Threads',
        count: 2,
      }),
    });
    const data = await res.json();
    record('AI Question Bank Generator (/api/ai/questions)', res.ok && Array.isArray(data.questions) && data.questions.length > 0, `${data.questions?.length} questions generated`);
  } catch (err) {
    record('AI Question Bank Generator (/api/ai/questions)', false, err.message);
  }

  // 14. ML Predictor & Timetable Generator (Python Subprocess)
  try {
    const res = await fetch(`${BASE_API}/ai-predict`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        study_hours: 4,
        focus_level: 8,
        difficulty_level: 4,
        previous_score: 82,
        subjects: ['Algorithms', 'Operating Systems', 'Databases'],
      }),
    });
    const data = await res.json();
    record(
      'Machine Learning Performance Predictor (/api/ai-predict)',
      res.ok && typeof data.predicted_performance === 'number',
      `Predicted: ${data.predicted_performance}%, Rec Hours: ${data.recommended_hours}`
    );
  } catch (err) {
    record('Machine Learning Performance Predictor (/api/ai-predict)', false, err.message);
  }

  // 15. Study Coach AI Nudge
  await delay(1500);
  try {
    const res = await fetch(`${BASE_API}/study/coach/nudge?force=1`, { headers: authHeaders });
    const data = await res.json();
    record('Study Coach AI Nudge (/api/study/coach/nudge)', res.ok && Boolean(data.nudge), `${data.nudge?.slice(0, 50)}...`);
  } catch (err) {
    record('Study Coach AI Nudge (/api/study/coach/nudge)', false, err.message);
  }

  // 16. Algorithm Visualizer Analysis (Career World)
  await delay(1500);
  try {
    const res = await fetch(`${BASE_API}/career/visualizer/analyze`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        input: 'Binary Search Tree traversal',
        language: 'javascript',
      }),
    });
    const data = await res.json();
    const hasSteps = (data?.visualization?.steps?.length || 0) > 0 || Boolean(data?.problem?.title);
    record('Algorithm Visualizer AI Engine (/api/career/visualizer/analyze)', res.ok && hasSteps, `Problem: ${data?.problem?.title || 'BST Traversal'}, Steps: ${data?.visualization?.steps?.length || 0}`);
  } catch (err) {
    record('Algorithm Visualizer AI Engine (/api/career/visualizer/analyze)', false, err.message);
  }

  // 17. Interview Lab AI Mock Session Creation
  await delay(1500);
  try {
    const res = await fetch(`${BASE_API}/interview/start`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        type: 'Technical',
        difficulty: 'Fresher',
        duration: 10,
        companyStyle: 'Google',
        subject: 'Data Structures & Algorithms',
      }),
    });
    const data = await res.json();
    record('Interview Lab AI Engine (/api/interview/start)', res.ok && Boolean(data.sessionId), `Session: ${data.sessionId?.slice(0, 8)}..., Question: ${data.question?.text?.slice(0, 40)}...`);
  } catch (err) {
    record('Interview Lab AI Engine (/api/interview/start)', false, err.message);
  }

  // 18. Career Roadmap Generator (AI Multi-week Curriculum)
  await delay(1500);
  try {
    const res = await fetch(`${BASE_API}/roadmap/generate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        targetRole: 'Full Stack Engineer',
        timeframeWeeks: 8,
        hoursPerWeek: 15,
        currentLevel: 'Intermediate',
      }),
    });
    const data = await res.json();
    record('AI Career Roadmap Generator (/api/roadmap/generate)', res.ok && Boolean(data.roadmap), `Phases: ${data.roadmap?.phases?.length || 0}`);
  } catch (err) {
    record('AI Career Roadmap Generator (/api/roadmap/generate)', false, err.message);
  }

  // 19. Career Dashboard & Readiness Analytics
  try {
    const res = await fetch(`${BASE_API}/career/dashboard`, { headers: authHeaders });
    const data = await res.json();
    record('Career Dashboard & Readiness (/api/career/dashboard)', res.ok && typeof data.readinessScore === 'number', `Readiness Score: ${data.readinessScore}%`);
  } catch (err) {
    record('Career Dashboard & Readiness (/api/career/dashboard)', false, err.message);
  }

  // 20. Smart Upload Hub (AI Document Processing)
  await delay(1500);
  try {
    const res = await fetch(`${BASE_API}/study/hub/process`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        subject: 'Computer Networks',
        rawText: 'TCP (Transmission Control Protocol) is a connection-oriented, reliable transport protocol that uses a three-way handshake to establish connections.',
      }),
    });
    const data = await res.json();
    record('Smart Study Hub (/api/study/hub/process)', res.ok && Boolean(data.document?.id), `Doc ID: ${data.document?.id?.slice(0, 8)}...`);
  } catch (err) {
    record('Smart Study Hub (/api/study/hub/process)', false, err.message);
  }

  // 21. Database Persistence Verification
  try {
    const res = await fetch(`${BASE_API}/profile/user`, { headers: authHeaders });
    const data = await res.json();
    record('Database Persistence & Retrieval', res.ok && data.user?.id === testUserId, `Persisted record matches test user`);
  } catch (err) {
    record('Database Persistence & Retrieval', false, err.message);
  }

  console.log('\n=====================================================');
  const passCount = results.filter((r) => r.pass).length;
  const totalCount = results.length;
  console.log(`TOTAL PASSED: ${passCount} / ${totalCount}`);
  console.log('=====================================================\n');

  if (passCount !== totalCount) {
    process.exit(1);
  }
}

runAllChecks().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
