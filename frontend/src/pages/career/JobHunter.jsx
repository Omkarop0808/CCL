import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  jobHunterGetJobs,
  jobHunterGetProfile,
  jobHunterGetRuns,
  jobHunterSaveProfile,
  jobHunterStartRun,
  jobHunterStopRun,
  jobHunterUpdateStatus,
  jobHunterGenerateCoverLetter,
  uploadResumePdf,
} from '../../utils/careerApi';

// Import new modular components
import JobHunterHero from './job-hunter/JobHunterHero';
import JobHunterWizard from './job-hunter/JobHunterWizard';
import JobCardGrid from './job-hunter/JobCardGrid';
import JobDetailDrawer from './job-hunter/JobDetailDrawer';
import JobHunterStats from './job-hunter/JobHunterStats';
import OnboardingBanner from './job-hunter/OnboardingBanner';

const ROLE_SUGGESTIONS = [
  'Software Engineer Intern', 'Frontend Developer', 'Backend Developer',
  'Full Stack Developer', 'React Developer', 'Node.js Developer',
  'SDE 1', 'SDE 2', 'Data Analyst', 'Data Scientist',
  'Machine Learning Engineer', 'DevOps Engineer', 'QA Engineer', 'Product Engineer',
];

const COMPANY_SUGGESTIONS = [
  'Google', 'Microsoft', 'Amazon', 'Meta', 'Apple', 'Netflix', 'Uber',
  'Atlassian', 'Adobe', 'NVIDIA', 'Infosys', 'TCS', 'Wipro', 'Accenture',
  'Flipkart', 'Swiggy', 'Zomato',
];

const EMPTY_FILTERS = {
  keyword: '',
  location: '',
  experienceLevel: '',
  remote: '',
  easyApply: false,
  preferredCompanies: [],
  excludeKeywords: [],
};

export default function JobHunter() {
  const resumeInputRef = useRef(null);
  const [activeView, setActiveView] = useState('filters');
  const [wizardStep, setWizardStep] = useState(1);
  const [targetRoleInput, setTargetRoleInput] = useState('');
  const [companyInput, setCompanyInput] = useState('');
  const [excludeInput, setExcludeInput] = useState('');
  const [targetRoles, setTargetRoles] = useState([]);
  const [resumeText, setResumeText] = useState('');
  const [resumeFileRef, setResumeFileRef] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [socialLinks, setSocialLinks] = useState({
    githubUrl: '',
    linkedinUrl: '',
    portfolioUrl: '',
  });
  const [runs, setRuns] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [searching, setSearching] = useState(false);
  const [jobSearchQuery, setSearchQuery] = useState('');

  const activeRun = useMemo(() => runs.find((x) => x.runId === selectedRunId) || runs[0] || null, [runs, selectedRunId]);
  const hasResume = Boolean(resumeText.trim() || resumeFileRef.trim());
  const hasRoles = targetRoles.length > 0;
  const canStart = hasResume && hasRoles;

  const roleMatches = useMemo(() => {
    const q = targetRoleInput.trim().toLowerCase();
    if (!q) return ROLE_SUGGESTIONS.slice(0, 6);
    return ROLE_SUGGESTIONS.filter((r) => r.toLowerCase().includes(q) && !targetRoles.includes(r)).slice(0, 6);
  }, [targetRoleInput, targetRoles]);

  const companyMatches = useMemo(() => {
    const q = companyInput.trim().toLowerCase();
    const selected = filters.preferredCompanies || [];
    if (!q) return COMPANY_SUGGESTIONS.filter((c) => !selected.includes(c)).slice(0, 6);
    return COMPANY_SUGGESTIONS.filter((c) => c.toLowerCase().includes(q) && !selected.includes(c)).slice(0, 6);
  }, [companyInput, filters.preferredCompanies]);

  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - ONE_WEEK_MS;

  const filteredJobs = useMemo(() => {
    const q = jobSearchQuery.trim().toLowerCase();
    return jobs.filter((job) => {
      // Expiry filter: hide jobs older than 7 days
      const jobDate = new Date(job.postedAt || job.createdAt).getTime();
      if (jobDate < cutoff) return false;

      // Text search
      if (q) {
        const title = String(job.title || '').toLowerCase();
        const comp = String(job.company || '').toLowerCase();
        const desc = String(job.description || '').toLowerCase();
        if (!title.includes(q) && !comp.includes(q) && !desc.includes(q)) return false;
      }
      return true;
    });
  }, [jobs, jobSearchQuery]);

  const selectedJob = useMemo(() => jobs.find(j => j.id === selectedJobId), [jobs, selectedJobId]);

  useEffect(() => {
    loadProfile();
    loadRuns();
  }, []);

  useEffect(() => {
    if (activeRun) {
      loadJobs(activeRun.runId);
      setActiveView('results');
    }
  }, [activeRun?.runId]);

  useEffect(() => {
    let timer;
    if (activeRun && ['queued', 'running'].includes(activeRun.status)) {
      timer = setInterval(() => {
        loadRuns();
        if (activeRun.runId) loadJobs(activeRun.runId);
      }, 5000);
    }
    return () => clearInterval(timer);
  }, [activeRun]);

  const loadProfile = async () => {
    try {
      const p = await jobHunterGetProfile();
      if (!p) return;
      if (Array.isArray(p.targetRoles)) setTargetRoles(p.targetRoles);
      if (p.resumeText) setResumeText(p.resumeText);
      if (p.resumeFileRef) setResumeFileRef(p.resumeFileRef);
      if (p.filters) setFilters((prev) => ({ ...prev, ...p.filters }));
      if (p.socialLinks) setSocialLinks((prev) => ({ ...prev, ...p.socialLinks }));
    } catch (err) {
      console.error(err);
    }
  };

  const loadRuns = async () => {
    try {
      const res = await jobHunterGetRuns();
      setRuns(res.runs || []);
      if (!selectedRunId && res.runs?.length) setSelectedRunId(res.runs[0].runId);
    } catch (err) {
      console.error(err);
    }
  };

  const loadJobs = async (runId) => {
    try {
      setSearching(true);
      const res = await jobHunterGetJobs(runId);
      setJobs(res.jobs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const handleUploadPdf = async (file) => {
    if (!file) return;
    try {
      const res = await uploadResumePdf(file);
      setResumeText(res?.resume?.extractedText || '');
      setResumeFileRef(res?.resume?.fileName || file.name);
      setMessage('Resume extracted successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(err.message || 'Error extracting resume');
    }
  };

  const addTagFromInput = (type) => {
    if (type === 'role' && targetRoleInput.trim()) {
      setTargetRoles((p) => [...new Set([...p, targetRoleInput.trim()])]);
      setTargetRoleInput('');
    } else if (type === 'company' && companyInput.trim()) {
      setFilters((p) => ({ ...p, preferredCompanies: [...new Set([...(p.preferredCompanies || []), companyInput.trim()])] }));
      setCompanyInput('');
    } else if (type === 'exclude' && excludeInput.trim()) {
      setFilters((p) => ({ ...p, excludeKeywords: [...new Set([...(p.excludeKeywords || []), excludeInput.trim()])] }));
      setExcludeInput('');
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      setMessage('');
      await jobHunterSaveProfile({
        targetRoles,
        resumeText,
        resumeFileRef,
        filters,
        socialLinks,
      });
      setMessage('Profile saved.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(err.message || 'Error saving profile');
    } finally {
      setSaving(false);
    }
  };

  const handleStartRun = async () => {
    if (!canStart) return;
    try {
      setLoading(true);
      setMessage('');
      await handleSaveProfile();
      const res = await jobHunterStartRun();
      setSelectedRunId(res.runId);
      await loadRuns();
      setActiveView('results');
    } catch (err) {
      setMessage(err.message || 'Error starting run');
    } finally {
      setLoading(false);
    }
  };

  const handleStopRun = async () => {
    if (!activeRun) return;
    try {
      setMessage('Stopping...');
      await jobHunterStopRun(activeRun.runId);
      await loadRuns();
      setMessage('Run stopped.');
    } catch (err) {
      setMessage(err.message || 'Error stopping run');
    }
  };

  const handleJobAction = async (jobId, actionStatus) => {
    try {
      await jobHunterUpdateStatus(jobId, actionStatus);
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: actionStatus } : j)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateCoverLetter = async (jobId) => {
    try {
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, generatingCl: true } : j)));
      const res = await jobHunterGenerateCoverLetter(jobId, { resumeText });
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, coverLetter: res.coverLetter, generatingCl: false } : j))
      );
      setMessage('Cover letter generated using Gemini AI!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(err.message || 'Error generating cover letter');
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, generatingCl: false } : j)));
    }
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto min-h-screen pb-20">
      
      {/* Toast Message */}
      {message && (
        <div className="fixed top-20 right-6 z-50 animate-fadeUp bg-violet-600 text-white px-6 py-3 rounded-xl shadow-[0_8px_32px_rgba(139,92,246,0.3)] font-medium">
          {message}
        </div>
      )}

      {/* Hero Header */}
      <JobHunterHero runs={runs} activeView={activeView} setActiveView={setActiveView} setWizardStep={setWizardStep} />

      {activeView === 'filters' && (
        <JobHunterWizard
          wizardStep={wizardStep}
          setWizardStep={setWizardStep}
          hasResume={hasResume}
          hasRoles={hasRoles}
          canStart={canStart}
          resumeInputRef={resumeInputRef}
          handleUploadPdf={handleUploadPdf}
          resumeFileRef={resumeFileRef}
          targetRoleInput={targetRoleInput}
          setTargetRoleInput={setTargetRoleInput}
          addTagFromInput={addTagFromInput}
          roleMatches={roleMatches}
          setTargetRoles={setTargetRoles}
          targetRoles={targetRoles}
          filters={filters}
          setFilters={setFilters}
          companyInput={companyInput}
          setCompanyInput={setCompanyInput}
          companyMatches={companyMatches}
          excludeInput={excludeInput}
          setExcludeInput={setExcludeInput}
          socialLinks={socialLinks}
          setSocialLinks={setSocialLinks}
          handleSaveProfile={handleSaveProfile}
          saving={saving}
          handleStartRun={handleStartRun}
          loading={loading}
          handleStopRun={handleStopRun}
          activeRun={activeRun}
        />
      )}

      {activeView === 'results' && (
        <div className="mt-8">
          
          <OnboardingBanner filters={filters} socialLinks={socialLinks} onEditSetup={() => { setActiveView('filters'); setWizardStep(3); }} />
          
          {activeRun && ['queued', 'running'].includes(activeRun.status) && (
            <div className="mb-6 rounded-2xl bg-gradient-to-r from-violet-50 to-cyan-50 border border-violet-200 p-5 flex items-center gap-4 shadow-sm">
              <Loader2 className="animate-spin text-violet-600" size={24} />
              <div>
                <p className="text-slate-800 font-extrabold">Agents are actively searching for jobs...</p>
                <p className="text-sm text-slate-600 font-medium">Scraping LinkedIn. This may take a minute or two.</p>
              </div>
            </div>
          )}

          <JobHunterStats jobs={jobs} activeRun={activeRun} />
          
          <div className="flex flex-col xl:flex-row gap-6 relative">
            <div className={`flex-1 transition-all duration-300 ${selectedJobId ? 'xl:w-[calc(100%-420px)]' : 'w-full'}`}>
              <JobCardGrid
                jobs={filteredJobs}
                loading={searching}
                searchQuery={jobSearchQuery}
                setSearchQuery={setSearchQuery}
                selectedJobId={selectedJobId}
                setSelectedJobId={setSelectedJobId}
                handleJobAction={handleJobAction}
              />
            </div>
            
            <JobDetailDrawer
              job={selectedJob}
              onClose={() => setSelectedJobId(null)}
              onAction={handleJobAction}
              onGenerateCoverLetter={handleGenerateCoverLetter}
            />
          </div>
        </div>
      )}
    </div>
  );
}
