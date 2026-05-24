import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, MapPin, Building, Calendar, CheckCircle2 } from 'lucide-react';

export default function JobDetailDrawer({ job, onClose, onAction, onGenerateCoverLetter }) {
  if (!job) return null;

  return (
    <AnimatePresence>
      {/* Mobile Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[90] xl:hidden"
      />

      {/* Drawer */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed top-0 right-0 h-screen w-full sm:w-[450px] bg-white border-l border-slate-200 shadow-2xl z-[100] xl:sticky xl:top-[88px] xl:h-[calc(100vh-100px)] xl:rounded-2xl xl:border xl:w-[400px] flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-extrabold text-slate-800 tracking-wide">Job Details</h3>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide bg-white">
          
          {/* Header Info */}
          <div>
            <h2 className="text-2xl font-black text-slate-900 mb-2 leading-tight">{job.title}</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-slate-700">
                <Building size={16} className="text-violet-500" />
                <span className="font-bold">{job.company}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600 font-medium">
                <MapPin size={16} />
                <span>{job.location || 'Remote'}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                <Calendar size={14} />
                <span>Posted: {new Date(job.postedAt || job.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Match Score & Insights */}
          <div className="rounded-xl border border-violet-100 bg-violet-50 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-black text-violet-700 uppercase tracking-wide">Match Score</span>
              <span className="text-3xl font-black text-violet-900">{job.score || 0}<span className="text-sm text-violet-400 font-bold">/100</span></span>
            </div>
            
            {job.improvements && job.improvements.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-violet-600 uppercase tracking-wider">To Improve Score:</p>
                <ul className="space-y-2">
                  {job.improvements.map((imp, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-violet-800 font-medium">
                      <div className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-violet-400" />
                      {imp}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Skills */}
          {job.skills && job.skills.length > 0 && (
            <div>
              <h4 className="text-xs font-black text-slate-400 mb-3 tracking-wider uppercase">Required Skills</h4>
              <div className="flex flex-wrap gap-2">
                {job.skills.map((s, idx) => (
                  <span key={idx} className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold shadow-sm">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Description Snippet */}
          <div>
            <h4 className="text-xs font-black text-slate-400 mb-3 tracking-wider uppercase">About the Role</h4>
            <div className="text-sm text-slate-600 font-medium leading-relaxed whitespace-pre-wrap bg-slate-50 p-4 rounded-xl border border-slate-100">
              {job.description?.slice(0, 800)}
              {job.description?.length > 800 ? '...' : ''}
            </div>
          </div>

          {/* AI Cover Letter Generator */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-black text-slate-400 tracking-wider uppercase">Gemini Cover Letter</h4>
              {!job.coverLetter && (
                <button
                  onClick={() => onGenerateCoverLetter && onGenerateCoverLetter(job.id)}
                  disabled={job.generatingCl}
                  className="px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 font-bold text-xs hover:bg-violet-200 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {job.generatingCl ? 'Generating...' : '✨ Generate with AI'}
                </button>
              )}
            </div>
            
            {job.coverLetter && (
              <div className="relative">
                <textarea
                  readOnly
                  value={job.coverLetter.body || job.coverLetter}
                  className="w-full h-48 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 focus:outline-none focus:border-violet-500 font-medium resize-none"
                />
                <div className="absolute top-3 right-3 flex gap-2">
                  <button
                    onClick={() => onGenerateCoverLetter && onGenerateCoverLetter(job.id)}
                    disabled={job.generatingCl}
                    className="p-1.5 rounded bg-white border border-slate-200 text-slate-500 hover:text-violet-600 shadow-sm disabled:opacity-50"
                    title="Regenerate"
                  >
                    {job.generatingCl ? (
                      <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>
                    )}
                  </button>
                  <button
                    onClick={() => navigator.clipboard.writeText(job.coverLetter.body || job.coverLetter)}
                    className="p-1.5 rounded bg-white border border-slate-200 text-slate-500 hover:text-violet-600 shadow-sm"
                    title="Copy to clipboard"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex gap-3">
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold transition-colors shadow-md"
          >
            Apply Now <ExternalLink size={16} />
          </a>
          {job.status !== 'applied' && (
            <button
              onClick={() => onAction(job.id, 'applied')}
              className="flex items-center justify-center px-4 py-3 rounded-xl bg-white hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 hover:border-emerald-200 font-bold transition-colors border border-slate-200 shadow-sm"
              title="Mark as applied"
            >
              <CheckCircle2 size={18} className="text-emerald-500" />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
