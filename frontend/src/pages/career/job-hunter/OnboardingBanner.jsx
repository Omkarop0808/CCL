import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, X } from 'lucide-react';

export default function OnboardingBanner({ filters, socialLinks, onEditSetup }) {
  const [isVisible, setIsVisible] = useState(false);
  const [missingFields, setMissingFields] = useState([]);

  useEffect(() => {
    // Check missing preferences
    const missing = [];
    if (!filters.location) missing.push('Location');
    if (!filters.experienceLevel) missing.push('Experience Level');
    if (!(filters.preferredCompanies && filters.preferredCompanies.length)) missing.push('Preferred Companies');
    if (!socialLinks.linkedinUrl) missing.push('LinkedIn Profile');
    
    // Check if dismissed previously
    const dismissed = localStorage.getItem('jobhunter_onboarding_dismissed');
    
    if (missing.length > 0 && !dismissed) {
      setMissingFields(missing);
      setIsVisible(true);
    }
  }, [filters, socialLinks]);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('jobhunter_onboarding_dismissed', 'true');
  };

  if (!isVisible || missingFields.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="mb-6 rounded-2xl bg-gradient-to-r from-amber-50 to-violet-50 border border-amber-200 p-4 shadow-sm relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-white/40 backdrop-blur-md z-0 pointer-events-none" />
        <div className="relative z-10 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
            <Lightbulb className="text-amber-500" size={20} />
          </div>
          <div className="flex-1 pr-8">
            <h4 className="text-slate-800 font-extrabold mb-1">Pro Tip: Optimize your job matches</h4>
            <p className="text-sm text-slate-600 font-medium">
              Add your <span className="font-bold text-amber-600">{missingFields.join(', ')}</span> to get more accurate job matches and higher relevance scores from the AI.
            </p>
            <button 
              onClick={onEditSetup}
              className="mt-3 text-xs font-bold text-violet-600 hover:text-violet-700 uppercase tracking-wider flex items-center gap-1"
            >
              Update Preferences &rarr;
            </button>
          </div>
          <button 
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white text-slate-400 hover:text-slate-600 transition-colors shadow-sm bg-white/50 border border-transparent hover:border-slate-200"
          >
            <X size={16} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
