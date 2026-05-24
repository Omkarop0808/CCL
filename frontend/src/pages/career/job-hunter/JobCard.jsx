import React, { useEffect, useRef } from 'react';
import { MapPin, Building, Sparkles, ExternalLink, Briefcase } from 'lucide-react';
import anime from 'animejs';

const JobCard = React.memo(({ job, isSelected, onClick, onAction }) => {
  const cardRef = useRef(null);
  const scoreRef = useRef(null);
  const hasAnimatedScore = useRef(false);

  // 24-hour freshness check
  const isNew = (() => {
    const posted = new Date(job.postedAt || job.createdAt).getTime();
    return posted >= Date.now() - 24 * 60 * 60 * 1000;
  })();

  // Circular progress math
  const score = job.score || 0;
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  
  const scoreColor = 
    score >= 80 ? '#10B981' : // Emerald
    score >= 60 ? '#8B5CF6' : // Violet
    '#F59E0B';                // Amber

  useEffect(() => {
    if (isSelected && !hasAnimatedScore.current && scoreRef.current) {
      anime({
        targets: scoreRef.current,
        innerHTML: [0, score],
        round: 1,
        easing: 'easeOutExpo',
        duration: 1500
      });
      hasAnimatedScore.current = true;
    }
  }, [isSelected, score]);

  return (
    <div 
      ref={cardRef}
      className={`job-card-anim group relative overflow-hidden rounded-2xl border transition-all duration-300 cursor-pointer backdrop-blur-sm ${
        isSelected 
          ? 'bg-white border-violet-400 shadow-[0_8px_30px_rgba(139,92,246,0.12)] z-10' 
          : 'bg-white/60 border-slate-200/80 hover:bg-white hover:border-slate-300 hover:shadow-md'
      }`}
      onClick={() => onClick(job)}
    >
      <div className="p-5">
        <div className="flex justify-between items-start gap-4 mb-3">
          <div className="min-w-0 flex-1">
            <h4 className="text-lg font-bold text-slate-800 truncate group-hover:text-violet-700 transition-colors">
              {job.title}
            </h4>
            <div className="flex items-center gap-2 mt-1 text-sm text-slate-600 font-medium truncate">
              <Building size={14} className="shrink-0 text-slate-400" />
              <span className="truncate">{job.company}</span>
              {job.source === 'linkedin' && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#0A66C2]/10 text-[#0A66C2] font-bold border border-[#0A66C2]/20">LI</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-medium truncate">
              <MapPin size={12} className="shrink-0" />
              <span className="truncate">{job.location || 'Remote'}</span>
            </div>
          </div>
          
          <div className="shrink-0 relative flex items-center justify-center">
            <svg width="48" height="48" className="transform -rotate-90">
              <circle
                cx="24" cy="24" r={radius}
                stroke="rgba(0,0,0,0.05)" strokeWidth="4" fill="none"
              />
              <circle
                cx="24" cy="24" r={radius}
                stroke={scoreColor} strokeWidth="4" fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span ref={scoreRef} className="text-xs font-black text-slate-700">{score}</span>
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {isNew && (
            <span className="new-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase tracking-wide shadow-sm">
              <Sparkles size={10} /> NEW
            </span>
          )}
          {job.easyApply && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-700 border border-cyan-200">
              Easy Apply
            </span>
          )}
          {(job.skills || []).slice(0, 3).map((skill, idx) => (
            <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
              {skill}
            </span>
          ))}
          {job.skills?.length > 3 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-400 border border-slate-100">
              +{job.skills.length - 3}
            </span>
          )}
        </div>

        {/* Action Row */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            {new Date(job.postedAt || job.createdAt).toLocaleDateString()}
          </span>
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            {job.status !== 'applied' && (
              <button
                onClick={() => onAction(job.id, 'applied')}
                className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 text-xs font-bold hover:bg-emerald-100 hover:border-emerald-200 transition-colors shadow-sm"
              >
                Mark Applied
              </button>
            )}
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors shadow-sm"
              title="Open Job Link"
            >
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
});

export default JobCard;
