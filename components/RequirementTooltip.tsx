import React, { useState } from 'react';
import { FileText, ExternalLink, AlertTriangle } from 'lucide-react';
import type { PRDRequirement } from '../types';

interface RequirementTooltipProps {
  requirement: PRDRequirement;
  children: React.ReactNode;
}

export const RequirementTooltip: React.FC<RequirementTooltipProps> = ({ requirement, children }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      
      {isVisible && (
        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-80">
          <div className="bg-slate-900 dark:bg-slate-800 text-white rounded-xl shadow-2xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 bg-purple-600/20 border-b border-slate-700">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                  Requirement Gap
                </span>
              </div>
            </div>
            
            <div className="p-4 space-y-3">
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Requirement</div>
                <div className="text-sm font-semibold text-white">
                  {requirement.id}: {requirement.title}
                </div>
              </div>
              
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Expected</div>
                <div className="text-xs text-slate-300 leading-relaxed">
                  {requirement.description}
                </div>
              </div>
              
              <div className="pt-2 border-t border-slate-700">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs text-amber-400 font-bold uppercase tracking-wider mb-1">
                      Gap Identified
                    </div>
                    <div className="text-xs text-slate-300 leading-relaxed">
                      {requirement.gap_description}
                    </div>
                  </div>
                </div>
              </div>
              
              {requirement.sourceUrl && (
                <a 
                  href={requirement.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>View in {requirement.source}</span>
                </a>
              )}
            </div>
            
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
              <div className="border-8 border-transparent border-t-slate-900 dark:border-t-slate-800" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
