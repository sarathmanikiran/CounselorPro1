import React from 'react';
import { motion } from 'motion/react';
import { ExamType } from '../types';
import { ArrowRight, Landmark, GraduationCap, Cpu, FlaskConical } from 'lucide-react';

interface ExamSelectorProps {
  selectedExam: ExamType | null;
  selectedStream: 'MPC' | 'BiPC';
  onSelect: (exam: ExamType) => void;
  onSelectStream: (stream: 'MPC' | 'BiPC') => void;
  onNext: () => void;
  onBack: () => void;
}

export default function ExamSelector({ 
  selectedExam, 
  selectedStream,
  onSelect, 
  onSelectStream,
  onNext, 
  onBack 
}: ExamSelectorProps) {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4" id="exam-selector-step">
      <div className="text-center mb-8">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
          Step 1 of 4
        </span>
        <h2 className="font-sans font-bold text-3xl text-slate-900 mt-3 tracking-tight">
          Select Your Counselling Exam & Stream
        </h2>
        <p className="text-slate-500 mt-2 text-sm max-w-xl mx-auto">
          Choose the entrance test system you appeared for and your high school stream to load the correct database of matching courses and cutoffs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        {/* AP EAPCET Option Card */}
        <div
          onClick={() => onSelect('AP_EAPCET')}
          id="select-ap-eapcet"
          className={`cursor-pointer group rounded-2xl p-6 border-2 transition-all duration-200 flex flex-col justify-between h-72 ${
            selectedExam === 'AP_EAPCET'
              ? 'border-emerald-600 bg-emerald-50/40 shadow-md ring-1 ring-emerald-600'
              : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
          }`}
        >
          <div className="space-y-4">
            <div className={`p-3 rounded-xl w-fit ${selectedExam === 'AP_EAPCET' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-sans font-bold text-xl text-slate-900">AP EAPCET</h3>
              <p className="text-xs text-slate-500 font-mono mt-1">ANDHRA PRADESH COUNSELLING</p>
            </div>
            <p className="text-slate-600 text-sm leading-relaxed">
              Andhra Pradesh Engineering, Agriculture and Pharmacy Common Entrance Test. Includes top state institutions like <strong>AU College of Engineering (Visakhapatnam)</strong>, <strong>JNTU Kakinada</strong>, <strong>JNTU Anantapur</strong>, and premier autonomous colleges.
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-2">
            <span className="text-xs font-mono text-slate-500">REGIONS: AU, SVU</span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              selectedExam === 'AP_EAPCET' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              {selectedExam === 'AP_EAPCET' ? 'Selected' : 'Select Exam'}
            </span>
          </div>
        </div>

        {/* TS EAMCET Option Card */}
        <div
          onClick={() => onSelect('TS_EAMCET')}
          id="select-ts-eamcet"
          className={`cursor-pointer group rounded-2xl p-6 border-2 transition-all duration-200 flex flex-col justify-between h-72 ${
            selectedExam === 'TS_EAMCET'
              ? 'border-emerald-600 bg-emerald-50/40 shadow-md ring-1 ring-emerald-600'
              : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
          }`}
        >
          <div className="space-y-4">
            <div className={`p-3 rounded-xl w-fit ${selectedExam === 'TS_EAMCET' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-sans font-bold text-xl text-slate-900">TS EAMCET</h3>
              <p className="text-xs text-slate-500 font-mono mt-1">TELANGANA STATE COUNSELLING</p>
            </div>
            <p className="text-slate-600 text-sm leading-relaxed">
              Telangana State Engineering, Agriculture and Medical Common Entrance Test. Includes premier options like <strong>JNTU Hyderabad</strong>, <strong>Osmania University College of Engineering</strong>, <strong>CBIT</strong>, <strong>Vasavi</strong>, and <strong>VNR Vignana Jyothi</strong>.
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-2">
            <span className="text-xs font-mono text-slate-500">REGION: OU</span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              selectedExam === 'TS_EAMCET' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              {selectedExam === 'TS_EAMCET' ? 'Selected' : 'Select Exam'}
            </span>
          </div>
        </div>
      </div>

      {/* Stream Selection */}
      {selectedExam && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs"
        >
          <div className="text-center mb-5">
            <h3 className="font-sans font-bold text-slate-900 text-base">
              Select Your Academic Stream
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Select your high school stream to unlock eligible seat branches and accurate cutoff profiles.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* MPC Option */}
            <div
              onClick={() => onSelectStream('MPC')}
              className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                selectedStream === 'MPC'
                  ? 'border-emerald-600 bg-emerald-50/40 ring-1 ring-emerald-600'
                  : 'border-slate-200 hover:border-slate-300 bg-white shadow-3xs'
              }`}
            >
              <div className={`p-2.5 rounded-lg ${selectedStream === 'MPC' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                <Cpu className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h4 className="font-sans font-bold text-xs text-slate-900">MPC Stream (Engineering)</h4>
                <p className="text-[10px] text-slate-500 leading-tight">CSE, ECE, EEE, MECH, CIVIL, INF & IT branches</p>
              </div>
            </div>

            {/* BiPC Option */}
            <div
              onClick={() => onSelectStream('BiPC')}
              className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                selectedStream === 'BiPC'
                  ? 'border-emerald-600 bg-emerald-50/40 ring-1 ring-emerald-600'
                  : 'border-slate-200 hover:border-slate-300 bg-white shadow-3xs'
              }`}
            >
              <div className={`p-2.5 rounded-lg ${selectedStream === 'BiPC' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                <FlaskConical className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h4 className="font-sans font-bold text-xs text-slate-900">BiPC Stream (Agri, Pharma, Bio)</h4>
                <p className="text-[10px] text-slate-500 leading-tight">Agriculture, Pharmacy, Bio-Tech & Pharma-D branches</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Button Controls */}
      <div className="mt-8 flex justify-between items-center border-t border-slate-200 pt-6">
        <button
          onClick={onBack}
          className="px-6 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-all font-medium cursor-pointer text-xs"
        >
          Back to Start
        </button>
        <button
          onClick={onNext}
          disabled={!selectedExam}
          id="exam-next-btn"
          className={`px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-md transition-all flex items-center gap-2 cursor-pointer text-xs ${
            !selectedExam ? 'opacity-50 cursor-not-allowed bg-slate-300 shadow-none hover:bg-slate-300' : ''
          }`}
        >
          Continue to Details
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
