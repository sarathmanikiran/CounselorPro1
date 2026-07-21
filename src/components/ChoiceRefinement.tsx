import React, { useState, useEffect } from 'react';
import { StudentProfile, WebOption, ChatMessage } from '../types';
import { ArrowLeft, ArrowRight, Sparkles, MessageSquare, Compass, Send, CheckCircle2, ChevronRight, AlertTriangle, ShieldCheck } from 'lucide-react';

interface ChoiceRefinementProps {
  profile: StudentProfile;
  selectedOptions: WebOption[];
  onNext: () => void;
  onBack: () => void;
}

export default function ChoiceRefinement({ profile, selectedOptions, onNext, onBack }: ChoiceRefinementProps) {
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState<string>('');
  const [sendingMessage, setSendingMessage] = useState<boolean>(false);

  // Auto trigger options list analysis on mount
  useEffect(() => {
    const triggerAnalysis = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/ai/analyze-choices', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            profile,
            options: selectedOptions,
          }),
        });
        const data = await response.json();
        if (data.analysis) {
          setAnalysis(data.analysis);
          setChatMessages([
            {
              sender: 'assistant',
              text: `Hello! I have completed a rigorous evaluation of your registered web choices. Please check the **Strategic AI Counsel Report** on the left to see cutoff matches and logical sequence suggestions! Ask me anything here about specific engineering branches or how to adjust choices.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }
          ]);
        } else {
          setAnalysis('Sorry, I failed to generate your strategic counselling report.');
        }
      } catch (err) {
        console.error(err);
        setAnalysis('Unable to contact the AI Counselor server. Please ensure the dev server is active and try again.');
      } finally {
        setLoading(false);
      }
    };

    triggerAnalysis();
  }, [profile, selectedOptions]);

  // Handle student questions in the chat assistant panel
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    const userMsg: ChatMessage = {
      sender: 'user',
      text: userInput,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages(prev => [...prev, userMsg]);
    const originalInput = userInput;
    setUserInput('');
    setSendingMessage(true);

    try {
      // Prompt query with option context
      const prompt = `
      You are an expert South Indian admissions counselor assisting a student for ${profile.exam}.
      Student Rank: ${profile.rank}, Category: ${profile.category}, Local region: ${profile.region}, Gender: ${profile.gender}.
      They have selected the following web options: ${selectedOptions.map(o => `${o.priority}. ${o.collegeCode} [${o.branch}]`).join(', ')}.
      
      They asked: "${originalInput}"
      
      Respond directly, simply, and expertly to their question. Help them figure out exactly what decisions to make to maximize college placement.
      Keep it brief, tactical, and positive.
      `;

      const response = await fetch('/api/ai/analyze-choices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profile,
          options: selectedOptions,
          customPrompt: prompt, // fallback context helper
        }),
      });

      const data = await response.json();
      
      setChatMessages(prev => [
        ...prev,
        {
          sender: 'assistant',
          text: data.analysis || "I received your question! Always ensure you have a healthy mix of top, target, and safety colleges based on cutoffs.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [
        ...prev,
        {
          sender: 'assistant',
          text: "I'm having trouble connecting to my central logic. Remember to order options strictly by quality, and avoid putting lower-ranked private colleges above universities.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    } finally {
      setSendingMessage(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4" id="ai-refinement-workspace">
      <div className="text-center mb-8">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
          Step 4 of 4
        </span>
        <h2 className="font-sans font-bold text-3xl text-slate-900 mt-3 tracking-tight">
          Review, Refine & AI Strategy Analysis
        </h2>
        <p className="text-slate-500 mt-2 text-sm max-w-xl mx-auto">
          Our intelligent simulation engine reviews your web option hierarchy to make sure you have the highest probability of gaining seat allocation.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COMPONENT: AI STRATEGIC REPORT */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col h-[600px]">
          <div className="bg-slate-50 border-b border-slate-200 text-slate-800 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-600 animate-pulse" />
              <h3 className="font-sans font-bold text-sm tracking-wide text-slate-950">Strategic AI Counsel Report</h3>
            </div>
            <span className="text-[10px] font-mono bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-0.5 rounded">
              POWERED BY GEMINI
            </span>
          </div>

          <div className="flex-grow overflow-y-auto p-6 space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 space-y-4">
                <Compass className="w-12 h-12 text-emerald-600 animate-spin" />
                <div className="text-center">
                  <h4 className="font-semibold text-slate-900 text-sm">Generating AI Match Report...</h4>
                  <p className="text-xs text-slate-500 mt-1">Comparing option sequence with historical category cutoff boundaries.</p>
                </div>
              </div>
            ) : (
              <div className="prose prose-slate max-w-none text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {analysis}
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center gap-2.5 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>Always place your highest-preference dream colleges at options 1-5, regardless of cutoffs.</span>
          </div>
        </div>

        {/* RIGHT COMPONENT: INTERACTIVE AI COUNSEL CHAT CHANNELS */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col h-[600px]">
          <div className="border-b border-slate-200 p-4 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span className="font-sans font-bold text-slate-900 text-sm">Ask AI Counselor Assistant</span>
            </div>
            <span className="text-[10px] font-mono text-teal-700 bg-teal-50 border border-teal-100 px-2.5 py-0.5 rounded-full font-bold">
              PORTAL ASSIST
            </span>
          </div>

          {/* Chat Messages */}
          <div className="flex-grow overflow-y-auto p-4 space-y-3 bg-slate-50/50">
            {chatMessages.map((msg, idx) => (
              <div 
                key={idx}
                className={`flex flex-col max-w-[85%] ${msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}
              >
                <div className={`p-3 rounded-2xl text-xs leading-relaxed shadow-3xs ${
                  msg.sender === 'user' 
                    ? 'bg-emerald-600 text-white rounded-br-none' 
                    : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                }`}>
                  {msg.text}
                </div>
                <span className="text-[9px] font-mono text-slate-400 mt-1 px-1">{msg.timestamp}</span>
              </div>
            ))}
            
            {sendingMessage && (
              <div className="flex items-center gap-2 text-xs text-slate-400 mr-auto p-3 bg-white border border-slate-200 rounded-2xl rounded-bl-none shadow-3xs">
                <span className="animate-bounce">●</span>
                <span className="animate-bounce delay-75">●</span>
                <span className="animate-bounce delay-150">●</span>
                <span>AI Counselor is typing...</span>
              </div>
            )}
          </div>

          {/* Message input */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 bg-white flex gap-2">
            <input
              type="text"
              placeholder="Ask a question about CBIT vs VCE, branch choices, etc..."
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              disabled={sendingMessage}
              id="chat-input"
              className="flex-grow px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
            <button
              type="submit"
              disabled={sendingMessage || !userInput.trim()}
              id="chat-send-btn"
              className="p-2 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 rounded-lg transition-all cursor-pointer flex items-center justify-center flex-shrink-0"
            >
              <Compass className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>

      {/* Button Controls */}
      <div className="mt-8 flex justify-between items-center border-t border-slate-200 pt-6">
        <button
          onClick={onBack}
          className="px-6 py-2.5 border border-slate-200 hover:bg-slate-100 rounded-lg transition-all font-medium flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={onNext}
          id="confirm-options-btn"
          className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-md transition-all flex items-center gap-2 cursor-pointer"
        >
          Generate Registered Web Options Form
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
