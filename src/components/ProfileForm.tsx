import React, { useState, useEffect } from 'react';
import { StudentProfile, ExamType } from '../types';
import { ArrowLeft, ArrowRight, UserCircle, RefreshCw, Trophy, HelpCircle } from 'lucide-react';

interface ProfileFormProps {
  exam: ExamType;
  profile: StudentProfile;
  onChange: (updated: StudentProfile) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function ProfileForm({ exam, profile, onChange, onNext, onBack }: ProfileFormProps) {
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Auto-generate a random ticket number if empty
  const generateMockTicket = () => {
    const year = new Date().getFullYear() % 100;
    const center = Math.floor(100 + Math.random() * 900);
    const seq = Math.floor(1000 + Math.random() * 9000);
    const prefixes = exam === 'AP_EAPCET' ? ['AP', 'AU', 'SV'] : ['TS', 'OU', 'HY'];
    const selectedPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    
    onChange({
      ...profile,
      hallTicket: `${selectedPrefix}${year}${center}${seq}`
    });
  };

  useEffect(() => {
    if (!profile.hallTicket) {
      generateMockTicket();
    }
  }, []);

  const handleRankChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const newErrors = { ...errors };
    
    if (rawVal === '') {
      newErrors.rank = 'Rank cannot be empty. Please enter a valid rank.';
      setErrors(newErrors);
      onChange({ ...profile, rank: 0 });
      return;
    }
    
    // Check for negative or non-numeric characters (decimals, sign characters, scientific notation)
    if (!/^\d+$/.test(rawVal)) {
      newErrors.rank = 'Rank must be a numeric value containing digits only. Decimals, sign symbols, or letters are not allowed.';
      setErrors(newErrors);
      return;
    }
    
    const parsed = parseInt(rawVal, 10);
    
    if (parsed <= 0) {
      newErrors.rank = 'Rank must be a positive integer greater than 0.';
      setErrors(newErrors);
      onChange({ ...profile, rank: parsed });
      return;
    }
    
    if (parsed > 200000) {
      newErrors.rank = 'Please enter a rank below 200,000.';
      setErrors(newErrors);
      onChange({ ...profile, rank: parsed });
      return;
    }
    
    // Clear rank error if valid
    delete newErrors.rank;
    setErrors(newErrors);
    onChange({ ...profile, rank: parsed });
  };

  const validate = () => {
    const tempErrors: { [key: string]: string } = {};
    if (!profile.hallTicket || profile.hallTicket.trim() === '') {
      tempErrors.hallTicket = 'Hall Ticket Number is required.';
    }
    if (profile.rank <= 0 || isNaN(profile.rank)) {
      tempErrors.rank = 'Rank must be a positive number greater than 0.';
    } else if (profile.rank > 200000) {
      tempErrors.rank = 'Please enter a rank below 200,000.';
    }
    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleNextClick = () => {
    if (validate()) {
      onNext();
    }
  };

  const getRankGuidance = (rank: number) => {
    if (rank <= 0) return null;
    if (rank <= 2000) {
      return {
        tier: "Excellent Merit (Tier 1)",
        color: "text-emerald-700 bg-emerald-50 border border-emerald-200",
        advice: "Outstanding rank! You have high eligibility for Computer Science (CSE) at apex institutions like JNTU, OUCE, or CBIT."
      };
    }
    if (rank <= 10000) {
      return {
        tier: "High Merit (Tier 2)",
        color: "text-teal-700 bg-teal-50 border border-teal-200",
        advice: "Great score! Strong chance for premier branches (CSE, CSE-AIML, ECE) in highly coveted autonomous private colleges, or core branches in Govt colleges."
      };
    }
    if (rank <= 25000) {
      return {
        tier: "Above Average (Tier 3)",
        color: "text-amber-700 bg-amber-50 border border-amber-200",
        advice: "Good position! High probability for CSE or specializations in reputed autonomous colleges, or ECE/EEE in top private colleges."
      };
    }
    return {
      tier: "General Cutoff Band (Tier 4)",
      color: "text-slate-700 bg-slate-50 border border-slate-200",
      advice: "Satisfactory rank. To guarantee seat allotment, you should choose a larger list of options (15+), including multiple branches like ECE, INF, or EEE across different colleges."
    };
  };

  const rankFeedback = getRankGuidance(profile.rank);

  return (
    <div className="max-w-3xl mx-auto py-8 px-4" id="profile-details-step">
      <div className="text-center mb-8">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
          Step 2 of 4
        </span>
        <h2 className="font-sans font-bold text-3xl text-slate-900 mt-3 tracking-tight">
          Enter Your Profile Details
        </h2>
        <p className="text-slate-500 mt-2 text-sm">
          Please fill in your authentic rank card details. Our system uses this information to simulate seat priority matching and compute real-time probabilities.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-2 text-slate-800 font-bold text-lg border-b border-slate-100 pb-3 mb-2">
          <UserCircle className="w-5 h-5 text-emerald-600" />
          <span>Student Rank Card Credentials</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Hall Ticket Number */}
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-slate-800">
              Hall Ticket / Roll Number
            </label>
            <div className="relative">
              <input
                type="text"
                value={profile.hallTicket}
                onChange={(e) => onChange({ ...profile, hallTicket: e.target.value.toUpperCase() })}
                id="hall-ticket-input"
                placeholder="E.g., AP2301A451"
                className={`w-full px-4 py-2.5 rounded-lg border focus:outline-none focus:ring-2 font-mono text-sm tracking-widest bg-white ${
                  errors.hallTicket 
                    ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500 bg-red-50/10' 
                    : 'border-slate-300 focus:ring-emerald-600/20 focus:border-emerald-600'
                }`}
              />
              <button
                type="button"
                onClick={generateMockTicket}
                className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 transition-all cursor-pointer"
                title="Generate Mock Number"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            {errors.hallTicket && (
              <p className="text-red-600 text-xs font-semibold font-mono flex items-center gap-1">
                ⚠️ {errors.hallTicket}
              </p>
            )}
          </div>

          {/* Rank */}
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-slate-800">
              Exam Rank Obtained
            </label>
            <div className="relative">
              <input
                type="number"
                value={profile.rank || ''}
                onChange={handleRankChange}
                id="rank-input"
                placeholder="E.g., 4250"
                min="1"
                max="200000"
                className={`w-full px-4 py-2.5 rounded-lg border focus:outline-none focus:ring-2 font-mono text-sm ${
                  errors.rank 
                    ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500 bg-red-50/10' 
                    : 'border-slate-300 focus:ring-emerald-600/20 focus:border-emerald-600'
                }`}
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none">
                <Trophy className="w-4 h-4 text-amber-500" />
              </div>
            </div>
            {errors.rank && (
              <p className="text-red-600 text-xs font-semibold font-mono flex items-center gap-1">
                ⚠️ {errors.rank}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Gender Selector */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Gender</label>
            <select
              value={profile.gender}
              onChange={(e) => onChange({ ...profile, gender: e.target.value as 'Male' | 'Female' })}
              id="gender-select"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 bg-white text-sm"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>

          {/* Reservation Category */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Category</label>
            <select
              value={profile.category}
              onChange={(e) => onChange({ ...profile, category: e.target.value as any })}
              id="category-select"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 bg-white text-sm"
            >
              <option value="OC">OC (Open Competition)</option>
              <option value="BC-A">BC-A (Backward Class A)</option>
              <option value="BC-B">BC-B (Backward Class B)</option>
              <option value="BC-C">BC-C (Backward Class C)</option>
              <option value="BC-D">BC-D (Backward Class D)</option>
              <option value="BC-E">BC-E (Backward Class E)</option>
              <option value="SC">SC (Scheduled Caste)</option>
              <option value="ST">ST (Scheduled Tribe)</option>
            </select>
          </div>

          {/* Local University Region */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">
              Local University Region
            </label>
            <select
              value={profile.region}
              onChange={(e) => onChange({ ...profile, region: e.target.value as any })}
              id="region-select"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 bg-white text-sm"
            >
              {exam === 'AP_EAPCET' ? (
                <>
                  <option value="AU">AU (Andhra University Region)</option>
                  <option value="SVU">SVU (Sri Venkateswara University Region)</option>
                </>
              ) : (
                <option value="OU">OU (Osmania University Region)</option>
              )}
            </select>
          </div>
        </div>

        {/* Dynamic Rank Guidance Panel */}
        {rankFeedback && (
          <div className={`p-4 rounded-xl space-y-1 transition-all ${rankFeedback.color}`}>
            <div className="flex items-center gap-1.5 font-bold text-sm">
              <Trophy className="w-4 h-4 text-emerald-600" />
              <span>Rank Status: {rankFeedback.tier}</span>
            </div>
            <p className="text-xs leading-relaxed opacity-90">{rankFeedback.advice}</p>
          </div>
        )}

        {/* Reservation quota notice */}
        <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl flex gap-3 text-xs text-amber-800">
          <HelpCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 leading-relaxed">
            <span className="font-bold block">How Reservation Categories Affect Your Allotment</span>
            <p>
              Under NIC counselling rules, if a seat is available in your social category (e.g., <strong>{profile.category}</strong>), the system attempts to allocate it there first. If no category seats remain, you are automatically matched against general <strong>OC</strong> cutoff limits.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="mt-8 flex justify-between items-center border-t border-slate-200 pt-6">
        <button
          onClick={onBack}
          className="px-6 py-2.5 border border-slate-200 hover:bg-slate-100 rounded-lg transition-all font-medium flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={handleNextClick}
          id="profile-next-btn"
          className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-md transition-all flex items-center gap-2 cursor-pointer"
        >
          Proceed to College Selection
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
