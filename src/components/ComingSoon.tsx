import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Mail, CheckCircle2, ArrowRight } from 'lucide-react';

interface ComingSoonProps {
  onBack: () => void;
}

export default function ComingSoon({ onBack }: ComingSoonProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track if they have submitted in the current session
  const [isSubmitted, setIsSubmitted] = useState(() => {
    return sessionStorage.getItem('ts_bipc_notified') === 'true';
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Email address is required.');
      return;
    }

    const trimmedEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/notify-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: trimmedEmail,
          examGroup: 'TS_EAPCET_BIPC',
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setIsSubmitted(true);
        sessionStorage.setItem('ts_bipc_notified', 'true');
      } else {
        setError(result.error || 'Failed to submit. Please try again.');
      }
    } catch (err: any) {
      console.error('Error submitting notification request:', err);
      setError('Network error: Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4" id="coming-soon-step">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-md text-center space-y-6 relative overflow-hidden">
        {/* Animated SVG illustration */}
        <div className="relative w-40 h-40 mx-auto flex items-center justify-center">
          <svg width="140" height="140" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-xs">
            <defs>
              <style>
                {`
                  @keyframes flask-float {
                    0%, 100% { transform: translateY(0px) rotate(0deg); }
                    50% { transform: translateY(-5px) rotate(1.5deg); }
                  }
                  @keyframes bubble-rise-1 {
                    0% { transform: translate(46px, 65px) scale(0.6); opacity: 0; }
                    10% { opacity: 0.8; }
                    90% { opacity: 0.8; }
                    100% { transform: translate(44px, 20px) scale(1.1); opacity: 0; }
                  }
                  @keyframes bubble-rise-2 {
                    0% { transform: translate(52px, 60px) scale(0.5); opacity: 0; }
                    15% { opacity: 0.7; }
                    85% { opacity: 0.7; }
                    100% { transform: translate(55px, 15px) scale(1); opacity: 0; }
                  }
                  @keyframes bubble-rise-3 {
                    0% { transform: translate(48px, 55px) scale(0.4); opacity: 0; }
                    25% { opacity: 0.9; }
                    75% { opacity: 0.9; }
                    100% { transform: translate(47px, 10px) scale(0.9); opacity: 0; }
                  }
                  .flask-group {
                    animation: flask-float 2.5s ease-in-out infinite;
                    transform-origin: center bottom;
                  }
                  .bubble-1 {
                    animation: bubble-rise-1 2.8s ease-in-out infinite;
                  }
                  .bubble-2 {
                    animation: bubble-rise-2 2s ease-in-out infinite 0.4s;
                  }
                  .bubble-3 {
                    animation: bubble-rise-3 2.4s ease-in-out infinite 0.9s;
                  }
                `}
              </style>
            </defs>

            {/* Float animated flask group */}
            <g className="flask-group">
              {/* Conical liquid volume background */}
              <path d="M44 40 L35.5 68 C34 73 37.5 76 43 76 H57 C62.5 76 66 73 64.5 68 L56 40 Z" fill="#e6f4ea" />
              
              {/* Actual colored liquid inside flask */}
              <path d="M37.8 62 C43 60.5, 47 63.5, 52 61 C57 58.5, 60 61, 62.2 62 L64.5 68 C66 73 62.5 76 57 76 H43 C37.5 76 34 73 35.5 68 Z" fill="#059669" />
              <path d="M41 68 C45 67, 50 69, 55 68 C58 67, 59 68, 60.5 68 L59.5 70 H40.5 Z" fill="#34d399" opacity="0.6" />

              {/* Glass body path with thick strokes */}
              <path d="M44 32 H56 V40 L65.5 69 C67.5 75 63 80 56.5 80 H43.5 C37 80 32.5 75 34.5 69 L44 40 V32 Z" 
                    stroke="#334155" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
              
              {/* Flask mouth rim */}
              <rect x="41" y="27" width="18" height="5" rx="2.5" fill="#f1f5f9" stroke="#334155" strokeWidth="4" strokeLinejoin="round" />
              
              {/* Stopper cork */}
              <path d="M44.5 27 L46.5 21 H53.5 L55.5 27 Z" fill="#d97706" stroke="#334155" strokeWidth="3.5" strokeLinejoin="round" />
              
              {/* White glass shine reflection */}
              <path d="M38.5 70 C37.5 67, 39 63, 40 60" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
            </g>

            {/* Bubbling circles rising up */}
            <circle cx="0" cy="0" r="3.5" fill="#34d399" className="bubble-1" />
            <circle cx="0" cy="0" r="2.5" fill="#a7f3d0" className="bubble-2" />
            <circle cx="0" cy="0" r="2" fill="#059669" className="bubble-3" />
          </svg>
        </div>

        {!isSubmitted ? (
          <>
            <div className="space-y-2">
              <h2 className="font-sans font-extrabold text-2xl text-slate-900 tracking-tight">
                TS BiPC Data Coming Soon!
              </h2>
              <p className="text-slate-500 text-sm max-w-sm mx-auto leading-relaxed">
                We're working hard to add TS EAPCET BiPC colleges. Hang tight!
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 max-w-sm mx-auto text-left">
              <div className="space-y-1.5">
                <label htmlFor="notif-email" className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Email Address
                </label>
                <div className="relative rounded-lg shadow-2xs">
                  <input
                    type="email"
                    id="notif-email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 bg-white text-sm"
                  />
                  <div className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {error && (
                <p className="text-red-600 text-xs font-semibold font-mono flex items-center gap-1">
                  ⚠️ {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                {loading ? 'Adding You...' : 'Notify Me'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </>
        ) : (
          <div className="space-y-4">
            <div className="inline-flex p-2.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="font-sans font-extrabold text-2xl text-slate-900 tracking-tight">
                You're on the list! 🎉
              </h2>
              <p className="text-slate-500 text-sm max-w-sm mx-auto leading-relaxed">
                We'll email you the moment TS BiPC data is ready.
              </p>
            </div>
            
            <div className="pt-2">
              <span className="text-xs font-mono text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 font-semibold">
                Session registered successfully
              </span>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-100">
          <button
            onClick={onBack}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline transition-all cursor-pointer"
          >
            ← Choose a different option
          </button>
        </div>
      </div>
    </div>
  );
}
