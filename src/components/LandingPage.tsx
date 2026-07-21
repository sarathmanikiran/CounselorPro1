import React from 'react';
import { motion } from 'motion/react';
import { Compass, GraduationCap, ShieldAlert, Sparkles, CheckCircle2, ArrowRight, Database } from 'lucide-react';

interface LandingPageProps {
  onStart: () => void;
}

export default function LandingPage({ onStart }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between" id="landing-page">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50 px-4 sm:px-6 py-3.5 sm:py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 sm:p-2 bg-emerald-600 text-white rounded-lg shadow-sm shrink-0">
              <Compass className="w-5 h-5 sm:w-6 sm:h-6 animate-spin-slow" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-sans font-bold text-base sm:text-xl tracking-tight text-slate-900 truncate">CounselorPro</span>
              <span className="hidden sm:inline-block px-2 py-0.5 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full shrink-0">AI Simulator</span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 text-xs font-mono text-slate-500 shrink-0">
            <span className="hidden md:inline">PLATFORM: AP/TS WEB OPTIONS v2.5</span>
            <span className="hidden md:inline h-4 w-px bg-slate-200"></span>
            <span className="flex items-center gap-1 shrink-0">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="hidden sm:inline">LIVE SIMULATOR</span>
            </span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow max-w-7xl mx-auto px-6 py-12 md:py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-emerald-750 bg-emerald-50 border border-emerald-100 rounded-full"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            AI-Driven College Match Prediction
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="font-sans font-bold text-4xl sm:text-5xl md:text-6xl tracking-tight text-slate-900 leading-tight"
          >
            Practice Your <span className="text-emerald-600 relative inline-block">Counselling<span className="absolute bottom-1 left-0 w-full h-2 bg-emerald-50 -z-10"></span></span> <br className="hidden md:block"/> Before the Real Day
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-slate-600 text-lg sm:text-xl font-normal leading-relaxed max-w-2xl"
          >
            India's most realistic web options simulation platform for <strong className="text-slate-850">AP EAPCET</strong> and <strong className="text-slate-850">TS EAMCET</strong> engineering counseling. Avoid costly ordering errors that lead to bad seat allotments.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="pt-4 flex flex-col sm:flex-row gap-3"
          >
            <button
              onClick={onStart}
              id="start-simulation-btn"
              className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 group text-base cursor-pointer"
            >
              Start Counselling Simulation
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <a 
              href="#features-section" 
              className="px-6 py-4 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl border border-slate-200 transition-all text-center flex items-center justify-center"
            >
              Learn How It Works
            </a>
          </motion.div>

          {/* Social Proof Stats */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="pt-8 border-t border-slate-200 grid grid-cols-3 gap-6"
          >
            <div>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-sans">100%</p>
              <p className="text-xs text-slate-500 font-mono tracking-wider uppercase mt-1">Realistic Portal</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-sans">40+</p>
              <p className="text-xs text-slate-500 font-mono tracking-wider uppercase mt-1">Top Engineering Colleges</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-sans">AI</p>
              <p className="text-xs text-slate-500 font-mono tracking-wider uppercase mt-1">Counselor Feedback</p>
            </div>
          </motion.div>
        </div>

        {/* Hero Visual Block */}
        <div className="lg:col-span-5 relative flex justify-center">
          <div className="absolute inset-0 bg-emerald-50 rounded-3xl blur-3xl opacity-40 -z-10"></div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-md p-6 relative overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <span className="text-xs font-mono text-emerald-600 bg-emerald-50 px-2 py-1 rounded">MOCK ALLOTMENT ORDER</span>
              <span className="text-xs text-slate-400 font-mono">ID: #98421</span>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <GraduationCap className="w-5 h-5 text-emerald-600 mt-1" />
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm">Chaitanya Bharathi Institute of Technology</h3>
                  <p className="text-xs text-slate-500">Allotted Branch: CSE (Computer Science)</p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Hall Ticket:</span>
                  <span className="text-slate-800 font-semibold">2301A0512</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Rank Secured:</span>
                  <span className="text-slate-800 font-semibold">1,250</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Category Used:</span>
                  <span className="text-slate-800 font-semibold">OC_GEN_LOCAL</span>
                </div>
              </div>

              <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span className="text-xs text-emerald-800 font-medium leading-tight">
                  Seat matched preference #1 from your submitted options!
                </span>
              </div>
            </div>

            {/* floating badges */}
            <div className="absolute -right-6 top-1/2 transform -translate-y-1/2 rotate-12 bg-emerald-600 text-white font-bold text-xs px-10 py-1 shadow-md text-center select-none uppercase tracking-widest">
              SIMULATED
            </div>
          </motion.div>
        </div>
      </main>

      {/* Features / Why practice section */}
      <section id="features-section" className="bg-white border-t border-slate-200 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="font-sans font-bold text-3xl text-slate-900 tracking-tight">
              Why You Must Practice Counselling
            </h2>
            <p className="text-slate-500 text-base mt-2">
              The official web options locking portal is unforgiving. One typo or minor ordering error can result in a permanent seat allotment you do not want.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:shadow-sm transition-all">
              <div className="p-3 bg-red-50 text-red-600 rounded-lg w-fit mb-4">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="font-sans font-semibold text-lg text-slate-900">Avoid Option Blocking</h3>
              <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                Putting a lower-rated safety college above your dream college blocks you. If you qualify for both, the portal assigns the safety and discards your dream options.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:shadow-sm transition-all">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg w-fit mb-4">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="font-sans font-semibold text-lg text-slate-900">AI-Powered Strategy Review</h3>
              <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                Our built-in Gemini-powered counselor reviews your selected options list to flag logical errors, high-risk selections, and suggest optimized sequence improvements.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:shadow-sm transition-all">
              <div className="p-3 bg-teal-50 text-teal-600 rounded-lg w-fit mb-4">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-sans font-semibold text-lg text-slate-900">Run Mock Seat Allotment</h3>
              <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                Test your final choices against our simulated AP/TS seat allotment engine based on genuine historical cutoff categories, ranks, genders, and regions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-100 text-slate-600 py-10 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-emerald-600" />
            <span className="font-sans font-bold text-lg text-slate-950 tracking-tight">CounselorPro</span>
          </div>
          <p className="text-xs text-slate-500 text-center md:text-right font-mono">
            Designed for Andhra Pradesh and Telangana students. This is a counselling practice simulator and does not represent official AP EAPCET / TS EAMCET allotment outcomes.
          </p>
        </div>
      </footer>
    </div>
  );
}
