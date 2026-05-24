import React from 'react';
import ThreeParticleCanvas from './ThreeParticleCanvas';

export default function JobHunterHero({ runs, activeView, setActiveView, setWizardStep }) {
  return (
    <div className="relative rounded-2xl border border-slate-200/60 bg-gradient-to-r from-violet-50/80 to-cyan-50/80 p-6 shadow-sm overflow-hidden backdrop-blur-xl">
      {/* Background ambient layer */}
      <div className="absolute inset-0 bg-white/40 z-0 pointer-events-none" />
      
      {/* 3D Particles */}
      <ThreeParticleCanvas />

      {/* Content */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-1 drop-shadow-sm">
            Job Hunter
          </h2>
          <p className="text-sm text-slate-600 font-medium">
            Upload your resume, set your preferences, and launch an AI-powered job search.
          </p>
        </div>
        
        {runs.length > 0 && (
          <button
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
              activeView === 'results' 
                ? 'bg-violet-600 text-white shadow-md hover:bg-violet-700 border border-violet-500' 
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-sm'
            }`}
            onClick={() => {
              if (activeView === 'results') {
                setActiveView('filters');
                if (setWizardStep) setWizardStep(1);
              } else {
                setActiveView('results');
              }
            }}
          >
            {activeView === 'results' ? 'Back To Setup' : 'View Results'}
          </button>
        )}
      </div>
    </div>
  );
}
