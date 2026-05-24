import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Briefcase, Target, Trophy, Clock } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

export default function JobHunterStats({ jobs, activeRun }) {
  const statsRef = useRef(null);

  useEffect(() => {
    let ctx = gsap.context(() => {
      if (statsRef.current) {
        gsap.fromTo(statsRef.current.children, 
          { y: 20, opacity: 0 },
          { 
            y: 0, opacity: 1, duration: 0.5, stagger: 0.1, ease: 'back.out(1.7)',
            scrollTrigger: {
              trigger: statsRef.current,
              start: 'top bottom-=50',
            }
          }
        );
      }
    }, statsRef);
    
    return () => ctx.revert(); // Cleanup GSAP animations and ScrollTriggers on unmount
  }, [jobs, activeRun]);

  const topScore = jobs.length > 0 ? Math.max(...jobs.map(j => j.score || 0)) : 0;
  const appliedCount = jobs.filter(j => j.status === 'applied').length;
  const freshCount = jobs.filter(j => {
    const posted = new Date(j.postedAt || j.createdAt).getTime();
    return posted >= Date.now() - 24 * 60 * 60 * 1000;
  }).length;

  return (
    <div ref={statsRef} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white/80 border border-slate-200 rounded-2xl p-5 flex items-center gap-4 backdrop-blur-md shadow-sm">
        <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
          <Briefcase className="text-violet-600" size={20} />
        </div>
        <div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Total Jobs</p>
          <p className="text-2xl font-black text-slate-800">{jobs.length}</p>
        </div>
      </div>
      
      <div className="bg-white/80 border border-slate-200 rounded-2xl p-5 flex items-center gap-4 backdrop-blur-md shadow-sm">
        <div className="w-12 h-12 rounded-full bg-cyan-100 flex items-center justify-center shrink-0">
          <Clock className="text-cyan-600" size={20} />
        </div>
        <div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Fresh (24h)</p>
          <p className="text-2xl font-black text-slate-800">{freshCount}</p>
        </div>
      </div>
      
      <div className="bg-white/80 border border-slate-200 rounded-2xl p-5 flex items-center gap-4 backdrop-blur-md shadow-sm">
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
          <Target className="text-emerald-600" size={20} />
        </div>
        <div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Applied</p>
          <p className="text-2xl font-black text-slate-800">{appliedCount}</p>
        </div>
      </div>
      
      <div className="bg-white/80 border border-slate-200 rounded-2xl p-5 flex items-center gap-4 backdrop-blur-md shadow-sm">
        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
          <Trophy className="text-amber-600" size={20} />
        </div>
        <div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Top Match</p>
          <p className="text-2xl font-black text-slate-800">{topScore}%</p>
        </div>
      </div>
    </div>
  );
}
