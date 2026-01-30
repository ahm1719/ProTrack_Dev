
import React from 'react';

export const LogoSymbol = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="pinGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#a855f7" />
        <stop offset="100%" stopColor="#4f46e5" />
      </linearGradient>
    </defs>
    {/* Connection lines on the left */}
    <circle cx="15" cy="30" r="4" fill="#a855f7" />
    <path d="M15 30H25" stroke="#a855f7" strokeWidth="2" />
    <circle cx="10" cy="50" r="4" fill="#8b5cf6" />
    <path d="M10 50H25" stroke="#8b5cf6" strokeWidth="2" />
    <circle cx="15" cy="70" r="4" fill="#6366f1" />
    <path d="M15 70H25" stroke="#6366f1" strokeWidth="2" />
    
    {/* Main Pin Shape */}
    <path d="M55 10C35.67 10 20 25.67 20 45C20 65 55 90 55 90C55 90 90 65 90 45C90 25.67 74.33 10 55 10Z" fill="url(#pinGradient)" />
    
    {/* Brain Icon Reconstruction */}
    <path d="M45 35C42 35 40 37 40 40C40 43 42 45 45 45V55C42 55 40 57 40 60C40 63 42 65 45 65M65 35C68 35 70 37 70 40C70 43 68 45 65 45V55C68 55 70 57 70 60C70 63 68 65 65 65" stroke="white" strokeWidth="3" strokeLinecap="round" />
    <path d="M55 30V70" stroke="white" strokeWidth="3" strokeLinecap="round" />
    <path d="M48 32C52 30 58 30 62 32M48 68C52 70 58 70 62 68" stroke="white" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const FullLogo = ({ isSidebarOpen = true }: { isSidebarOpen?: boolean }) => (
  <div className="flex items-center gap-3">
    <LogoSymbol className={isSidebarOpen ? "w-10 h-10" : "w-12 h-12"} />
    {isSidebarOpen && (
      <span className="font-bold text-2xl tracking-tight text-slate-800">
        ProTrack<span className="text-indigo-600">AI</span>
      </span>
    )}
  </div>
);
