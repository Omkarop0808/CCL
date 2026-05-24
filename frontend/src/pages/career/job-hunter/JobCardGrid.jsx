import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import anime from 'animejs';
import { Search, Filter } from 'lucide-react';
import JobCard from './JobCard';

gsap.registerPlugin(ScrollTrigger);

export default function JobCardGrid({
  jobs,
  loading,
  searchQuery,
  setSearchQuery,
  selectedJobId,
  setSelectedJobId,
  handleJobAction
}) {
  const gridRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    // GSAP Scroll Reveal for the search bar
    let ctx = gsap.context(() => {
      if (searchRef.current) {
        gsap.fromTo(searchRef.current, 
          { y: 30, opacity: 0 },
          { 
            y: 0, opacity: 1, duration: 0.6, ease: 'power3.out',
            scrollTrigger: {
              trigger: searchRef.current,
              start: 'top bottom-=50',
            }
          }
        );
      }
    }, searchRef);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    // Anime.js Staggered Entrance for Job Cards
    if (!loading && jobs.length > 0 && gridRef.current) {
      const cards = gridRef.current.querySelectorAll('.job-card-anim');
      if (cards.length) {
        anime({
          targets: cards,
          translateY: [20, 0],
          opacity: [0, 1],
          delay: anime.stagger(50),
          easing: 'spring(1, 80, 10, 0)',
        });
      }
    }
  }, [jobs, loading]);

  if (loading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-500 text-sm font-medium">Searching the web for jobs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <div ref={searchRef} className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white/80 border border-slate-200 p-2 rounded-2xl backdrop-blur-md shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search within results..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none text-slate-800 pl-12 pr-4 py-3 text-sm focus:outline-none placeholder:text-slate-400 font-medium"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto px-2">
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors text-sm border border-slate-200 font-bold shadow-sm">
            <Filter size={16} /> Filters
          </button>
        </div>
      </div>

      {/* Grid */}
      {jobs.length === 0 ? (
        <div className="py-16 text-center bg-slate-50 border border-slate-200 rounded-2xl border-dashed">
          <p className="text-slate-500 font-medium">No jobs found matching your criteria.</p>
        </div>
      ) : (
        <div 
          ref={gridRef}
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
        >
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              isSelected={selectedJobId === job.id}
              onClick={(j) => setSelectedJobId(j.id === selectedJobId ? null : j.id)}
              onAction={handleJobAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}
