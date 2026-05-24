import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, Target, Search, Globe, Sparkles, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';

const WIZARD_STEPS = [
  { id: 1, title: 'Resume', icon: UploadCloud },
  { id: 2, title: 'Roles', icon: Target },
  { id: 3, title: 'Preferences', icon: Search },
  { id: 4, title: 'Links', icon: Globe },
  { id: 5, title: 'Launch', icon: Sparkles },
];

export default function JobHunterWizard({
  wizardStep,
  setWizardStep,
  hasResume,
  hasRoles,
  canStart,
  resumeInputRef,
  handleUploadPdf,
  resumeFileRef,
  targetRoleInput,
  setTargetRoleInput,
  addTagFromInput,
  roleMatches,
  setTargetRoles,
  targetRoles,
  filters,
  setFilters,
  companyInput,
  setCompanyInput,
  companyMatches,
  excludeInput,
  setExcludeInput,
  socialLinks,
  setSocialLinks,
  handleSaveProfile,
  saving,
  handleStartRun,
  loading,
  handleStopRun,
  activeRun,
}) {

  const slideVariants = {
    initial: { x: 50, opacity: 0 },
    animate: { x: 0, opacity: 1, transition: { duration: 0.4, ease: 'easeOut' } },
    exit: { x: -50, opacity: 0, transition: { duration: 0.3 } }
  };

  return (
    <div className="max-w-4xl mx-auto mt-6">
      <section className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 space-y-6 shadow-md backdrop-blur-xl relative overflow-hidden">
        
        {/* Progress Stepper */}
        <div className="relative">
          <div className="absolute top-5 left-0 w-full h-1 bg-slate-100 -translate-y-1/2 rounded-full" />
          <div 
            className="absolute top-5 left-0 h-1 bg-gradient-to-r from-violet-500 to-cyan-400 -translate-y-1/2 rounded-full transition-all duration-500 ease-in-out" 
            style={{ width: `${((wizardStep - 1) / (WIZARD_STEPS.length - 1)) * 100}%` }} 
          />
          <div className="relative flex justify-between z-10">
            {WIZARD_STEPS.map((step) => {
              const Icon = step.icon;
              const isActive = wizardStep === step.id;
              const isPast = wizardStep > step.id;
              
              return (
                <div key={step.id} className="flex flex-col items-center gap-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-300 ${
                    isActive 
                      ? 'bg-violet-600 text-white shadow-md' 
                      : isPast 
                        ? 'bg-cyan-500 text-white' 
                        : 'bg-white text-slate-400 border border-slate-200'
                  }`}>
                    {isPast ? <CheckCircle2 size={18} /> : <Icon size={18} />}
                  </div>
                  <span className={`text-[11px] font-bold tracking-wider uppercase ${
                    isActive ? 'text-violet-700' : isPast ? 'text-cyan-700' : 'text-slate-400'
                  }`}>
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="min-h-[280px] py-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={wizardStep}
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="w-full"
            >
              {wizardStep === 1 && (
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-6 space-y-4 shadow-sm">
                  <div>
                    <h3 className="text-lg text-slate-800 font-bold tracking-wide">Upload your resume</h3>
                    <p className="text-sm text-slate-600">We'll extract the text automatically to match against jobs.</p>
                  </div>
                  <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-xl bg-white hover:bg-slate-50 transition-colors">
                    <input
                      ref={resumeInputRef}
                      type="file"
                      accept=".pdf"
                      onChange={(e) => handleUploadPdf(e.target.files?.[0])}
                      className="hidden"
                    />
                    <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center mb-4">
                      <UploadCloud className="text-violet-600" size={32} />
                    </div>
                    <button
                      type="button"
                      onClick={() => resumeInputRef.current?.click()}
                      className="px-6 py-2.5 rounded-xl bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors font-semibold border border-violet-200"
                    >
                      Browse PDF
                    </button>
                    {resumeFileRef ? (
                      <p className="text-sm text-emerald-600 font-medium mt-4 flex items-center gap-2">
                        <CheckCircle2 size={16} /> {resumeFileRef} uploaded
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 mt-3 font-medium">No file selected yet</p>
                    )}
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-6 space-y-5 shadow-sm">
                  <div>
                    <h3 className="text-lg text-slate-800 font-bold tracking-wide">Target Roles</h3>
                    <p className="text-sm text-slate-600">Add job titles you are looking for.</p>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors shadow-sm" 
                      value={targetRoleInput} 
                      onChange={(e) => setTargetRoleInput(e.target.value)} 
                      placeholder="e.g. Frontend Engineer, SDE 1..." 
                      onKeyDown={(e) => e.key === 'Enter' && addTagFromInput('role')} 
                    />
                    <button 
                      onClick={() => addTagFromInput('role')} 
                      className="px-6 py-3 rounded-xl bg-slate-800 text-white font-semibold hover:bg-slate-700 transition-colors shadow-sm"
                    >
                      Add
                    </button>
                  </div>
                  {!!roleMatches.length && (
                    <div className="flex flex-wrap gap-2">
                      {roleMatches.map((item) => (
                        <button
                          key={item}
                          className="px-3 py-1.5 rounded-full border border-violet-200 bg-violet-50 text-violet-700 font-medium text-xs hover:bg-violet-100 transition-colors"
                          onClick={() => {
                            setTargetRoles((prev) => [...new Set([...prev, item])]);
                            setTargetRoleInput('');
                          }}
                        >
                          + {item}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {targetRoles.map((r) => (
                      <button 
                        key={r} 
                        className="px-3 py-1.5 rounded-full bg-violet-600 text-white text-xs font-semibold flex items-center gap-2 group shadow-sm" 
                        onClick={() => setTargetRoles((prev) => prev.filter((x) => x !== r))}
                      >
                        {r} <span className="opacity-70 group-hover:opacity-100">✕</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-6 space-y-5 shadow-sm">
                  <div>
                    <h3 className="text-lg text-slate-800 font-bold tracking-wide">Job Preferences</h3>
                    <p className="text-sm text-slate-600">Tune the scraper to find exactly what you want.</p>
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1 uppercase tracking-wide">Keyword</label>
                      <input 
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors shadow-sm" 
                        placeholder="e.g. React, Python" 
                        value={filters.keyword} 
                        onChange={(e) => setFilters((p) => ({ ...p, keyword: e.target.value }))} 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1 uppercase tracking-wide">Location</label>
                      <input 
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors shadow-sm" 
                        placeholder="e.g. India, London" 
                        value={filters.location} 
                        onChange={(e) => setFilters((p) => ({ ...p, location: e.target.value }))} 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1 uppercase tracking-wide">Experience Level</label>
                      <input 
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors shadow-sm" 
                        placeholder="e.g. Entry, Senior" 
                        value={filters.experienceLevel} 
                        onChange={(e) => setFilters((p) => ({ ...p, experienceLevel: e.target.value }))} 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1 uppercase tracking-wide">Work Type</label>
                      <select 
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors shadow-sm appearance-none" 
                        value={filters.remote} 
                        onChange={(e) => setFilters((p) => ({ ...p, remote: e.target.value }))}
                      >
                        <option value="">Remote / Hybrid / On-site</option>
                        <option value="remote">Remote</option>
                        <option value="hybrid">Hybrid</option>
                        <option value="on-site">On-site</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <label className="relative flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={filters.easyApply} 
                        onChange={(e) => setFilters((p) => ({ ...p, easyApply: e.target.checked }))} 
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500 shadow-inner"></div>
                      <span className="ml-3 text-sm font-bold text-slate-700">Easy Apply Only</span>
                    </label>
                  </div>

                  <div className="pt-4 border-t border-slate-200">
                    <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Preferred Companies</label>
                    <div className="flex gap-2 mb-3">
                      <input
                        className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors shadow-sm"
                        value={companyInput}
                        onChange={(e) => setCompanyInput(e.target.value)}
                        placeholder="e.g. Google"
                        onKeyDown={(e) => e.key === 'Enter' && addTagFromInput('company')}
                      />
                      <button onClick={() => addTagFromInput('company')} className="px-4 py-2.5 rounded-xl bg-slate-800 text-white font-semibold hover:bg-slate-700 transition-colors shadow-sm">Add</button>
                    </div>
                    {!!companyMatches.length && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {companyMatches.map((c) => (
                          <button
                            key={c}
                            className="px-3 py-1 rounded-full border border-cyan-200 bg-cyan-50 text-cyan-700 font-medium text-xs hover:bg-cyan-100 transition-colors"
                            onClick={() => setFilters((prev) => ({ ...prev, preferredCompanies: [...new Set([...(prev.preferredCompanies || []), c])] }))}
                          >
                            + {c}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {(filters.preferredCompanies || []).map((c) => (
                        <button
                          key={c}
                          className="px-3 py-1 rounded-full bg-cyan-100 text-cyan-800 font-semibold text-xs flex items-center gap-2 group border border-cyan-200"
                          onClick={() => setFilters((prev) => ({ ...prev, preferredCompanies: (prev.preferredCompanies || []).filter((x) => x !== c) }))}
                        >
                          {c} <span className="opacity-60 group-hover:opacity-100 text-cyan-900">✕</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 4 && (
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-6 space-y-5 shadow-sm">
                  <div>
                    <h3 className="text-lg text-slate-800 font-bold tracking-wide">Profile Links</h3>
                    <p className="text-sm text-slate-600">Optional: Add your links to be included in cover letters.</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1 uppercase tracking-wide">LinkedIn Profile</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Globe className="text-slate-400" size={16} />
                        </div>
                        <input 
                          className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors shadow-sm" 
                          placeholder="https://linkedin.com/in/..." 
                          value={socialLinks.linkedinUrl} 
                          onChange={(e) => setSocialLinks((p) => ({ ...p, linkedinUrl: e.target.value }))} 
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1 uppercase tracking-wide">GitHub Profile</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Globe className="text-slate-400" size={16} />
                        </div>
                        <input 
                          className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors shadow-sm" 
                          placeholder="https://github.com/..." 
                          value={socialLinks.githubUrl} 
                          onChange={(e) => setSocialLinks((p) => ({ ...p, githubUrl: e.target.value }))} 
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1 uppercase tracking-wide">Portfolio Website</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Globe className="text-slate-400" size={16} />
                        </div>
                        <input 
                          className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors shadow-sm" 
                          placeholder="https://your-portfolio.com" 
                          value={socialLinks.portfolioUrl} 
                          onChange={(e) => setSocialLinks((p) => ({ ...p, portfolioUrl: e.target.value }))} 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 5 && (
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-8 text-center space-y-6 shadow-sm">
                  <div className="w-20 h-20 mx-auto bg-gradient-to-br from-violet-500 to-cyan-400 rounded-full flex items-center justify-center shadow-lg">
                    <Sparkles className="text-white" size={36} />
                  </div>
                  <div>
                    <h3 className="text-2xl text-slate-800 font-extrabold tracking-tight mb-2">Ready to Launch</h3>
                    <p className="text-sm text-slate-600 font-medium">
                      Your resume is {hasResume ? <span className="text-emerald-600 font-bold">ready</span> : <span className="text-rose-500 font-bold">missing</span>} 
                      {' '}and you are targeting <span className="text-violet-600 font-bold">{targetRoles.length} roles</span>.
                    </p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                    <button 
                      disabled={saving} 
                      onClick={handleSaveProfile} 
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Profile'}
                    </button>
                    
                    <button 
                      disabled={loading || !canStart} 
                      onClick={handleStartRun} 
                      className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white font-bold shadow-md transition-all disabled:opacity-50 disabled:shadow-none"
                    >
                      {loading ? 'Starting Scraper...' : 'Start Job Search'}
                    </button>
                  </div>
                  
                  {activeRun && ['queued', 'running'].includes(activeRun.status) && (
                    <div className="pt-4">
                      <button 
                        onClick={handleStopRun} 
                        className="text-xs font-bold text-rose-500 hover:text-rose-600 underline"
                      >
                        Stop Current Run
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-200 mt-6 relative z-10">
          <button
            className={`px-5 py-2.5 rounded-xl border border-slate-200 font-bold flex items-center gap-2 transition-colors ${
              wizardStep === 1 ? 'opacity-0 pointer-events-none' : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800 shadow-sm'
            }`}
            onClick={() => setWizardStep((s) => Math.max(1, s - 1))}
          >
            <ChevronLeft size={16} /> Back
          </button>
          
          <button
            className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-sm ${
              wizardStep === 5 
                ? 'opacity-0 pointer-events-none' 
                : ((wizardStep === 1 && !hasResume) || (wizardStep === 2 && !hasRoles))
                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
                  : 'bg-violet-100 text-violet-700 border border-violet-200 hover:bg-violet-200'
            }`}
            onClick={() => setWizardStep((s) => Math.min(5, s + 1))}
            disabled={(wizardStep === 1 && !hasResume) || (wizardStep === 2 && !hasRoles) || wizardStep === 5}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
        
      </section>
    </div>
  );
}
