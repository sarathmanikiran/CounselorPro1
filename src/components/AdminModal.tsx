import React, { useState, useEffect, useRef } from 'react';
import { Database, UploadCloud, AlertCircle, RefreshCw, X, CheckCircle, Info, Lock, ShieldCheck, Mail, LogOut, Key } from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess?: () => void;
}

export default function AdminModal({ isOpen, onClose, onUploadSuccess }: AdminModalProps) {
  const [adminEmail, setAdminEmail] = useState<string>('');
  const [authError, setAuthError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'parsing' | 'ready' | 'uploading' | 'success' | 'error'>('idle');
  const [log, setLog] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Firebase integration states
  const [firebaseConfig, setFirebaseConfig] = useState<any>(null);
  const [firebaseApp, setFirebaseApp] = useState<any>(null);
  const [firebaseAuth, setFirebaseAuth] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string>('');
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  // Load configuration and listen to authentication state
  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/config/firebase');
        if (!response.ok) throw new Error('Failed to load Firebase config');
        const config = await response.json();
        
        if (active) {
          setFirebaseConfig(config);
          setIsLoadingConfig(false);

          if (config.apiKey && config.projectId) {
            try {
              const app = getApps().length === 0 ? initializeApp(config) : getApp();
              const auth = getAuth(app);
              setFirebaseApp(app);
              setFirebaseAuth(auth);

              const unsubscribe = onAuthStateChanged(auth, async (user) => {
                if (user) {
                  setCurrentUser(user);
                  try {
                    const token = await user.getIdToken();
                    setIdToken(token);
                    if (user.email) {
                      setAdminEmail(user.email);
                    }
                  } catch (tokenErr) {
                    console.error('Failed to get user ID token:', tokenErr);
                  }
                } else {
                  setCurrentUser(null);
                  setIdToken('');
                  setAdminEmail('');
                }
              });

              return () => {
                unsubscribe();
              };
            } catch (initErr) {
              console.error('Error initializing client Firebase:', initErr);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load Firebase configuration from server:', err);
        if (active) setIsLoadingConfig(false);
      }
    };

    fetchConfig();
    return () => {
      active = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const appendLog = (msg: string) => {
    setLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.json')) {
      setStatus('error');
      setErrorMsg('Invalid file format. Please upload a .json file.');
      return;
    }

    setFile(selectedFile);
    setStatus('parsing');
    setLog([]);
    appendLog(`Loading file: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)`);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const json = JSON.parse(text);

        if (!Array.isArray(json)) {
          throw new Error('JSON is not an array. Expected an array of college-branch records.');
        }

        if (json.length === 0) {
          throw new Error('The JSON array is empty.');
        }

        // Validate basic fields of the first entry
        const first = json[0];
        const required = ['inst_code', 'institution_name', 'branch_code'];
        const missing = required.filter(field => !(field in first));
        if (missing.length > 0) {
          throw new Error(`Missing required fields in dataset: ${missing.join(', ')}`);
        }

        setParsedData(json);
        setStatus('ready');
        appendLog(`Successfully parsed dataset: ${json.length.toLocaleString()} entries found.`);
        appendLog(`Ready to commit to Firebase Firestore (projectId: ${firebaseConfig?.projectId || 'counselorpro-6975d'}).`);
      } catch (err: any) {
        setStatus('error');
        setErrorMsg(`Parsing Error: ${err.message}`);
        appendLog(`ERROR: Failed to parse JSON file.`);
      }
    };
    reader.onerror = () => {
      setStatus('error');
      setErrorMsg('Failed to read the file.');
    };
    reader.readAsText(selectedFile);
  };

  const triggerUpload = async () => {
    if (!parsedData) return;

    setStatus('uploading');
    appendLog(`Initiating secure administrator pipeline...`);
    appendLog(`Splitting dataset into chunks of 300 entries for safety...`);

    const chunkSize = 300;
    const totalChunks = Math.ceil(parsedData.length / chunkSize);
    appendLog(`Total chunks to process: ${totalChunks}`);

    try {
      for (let index = 0; index < totalChunks; index++) {
        const start = index * chunkSize;
        const end = Math.min(start + chunkSize, parsedData.length);
        const chunk = parsedData.slice(start, end);
        const isLast = index === totalChunks - 1;

        appendLog(`Uploading chunk ${index + 1} of ${totalChunks} (isLastChunk: ${isLast})...`);

        const res = await fetch(`/api/admin/upload-colleges?chunkIndex=${index}&isLastChunk=${isLast}`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify(chunk)
        });

        let result: any;
        const responseText = await res.text();
        try {
          result = JSON.parse(responseText);
        } catch (parseErr: any) {
          throw new Error(`Failed to parse server response as JSON. Server might have timed out or crashed. Raw response (truncated): ${responseText.substring(0, 400)}${responseText.length > 400 ? '...' : ''}`);
        }

        if (!res.ok) {
          throw new Error(result.error || result.details || `Server returned error status ${res.status} on chunk ${index + 1}.`);
        }

        appendLog(`Successfully uploaded chunk ${index + 1}/${totalChunks}: ${result.details || result.message}`);
      }

      setStatus('success');
      appendLog(`Successfully synchronized all ${parsedData.length.toLocaleString()} documents in ${totalChunks} sequential batches!`);
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message);
      appendLog(`FATAL UPLOAD ERROR: ${err.message}`);
    }
  };

  const resetPortal = () => {
    setFile(null);
    setParsedData(null);
    setStatus('idle');
    setLog([]);
    setErrorMsg('');
  };

  const handleGoogleSignIn = async () => {
    if (!firebaseAuth) {
      setAuthError('Firebase Authentication has not been initialized. Please check configuration.');
      return;
    }
    setAuthError('');
    setIsVerifying(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(firebaseAuth, provider);
      const user = result.user;
      const token = await user.getIdToken();
      
      if (user.email === 'sarathdasireddy369@gmail.com') {
        setIdToken(token);
        setAdminEmail(user.email);
      } else {
        setAuthError(`Access Denied: '${user.email}' is not authorized. This administrator console is secured for sarathdasireddy369@gmail.com only.`);
        await signOut(firebaseAuth);
      }
    } catch (err: any) {
      console.error('Google Auth Sign In error:', err);
      if (err.message?.includes('unauthorized-domain') || err.code?.includes('unauthorized-domain')) {
        setAuthError(`Firebase Error (auth/unauthorized-domain): The domain "${window.location.hostname}" is not authorized. To resolve this permanently, log into your Firebase Console -> Authentication -> Settings -> Authorized Domains and add "${window.location.hostname}".`);
      } else if (err.message?.includes('operation-not-allowed') || err.code?.includes('operation-not-allowed')) {
        setAuthError(`Firebase Error (auth/operation-not-allowed): Google Sign-In is not enabled as a sign-in provider in your Firebase project. To resolve this permanently, open your Firebase Console -> Authentication -> Sign-in method, click 'Add new provider', and enable 'Google'.`);
      } else {
        setAuthError(`Authentication Error: ${err.message || err}`);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSignOutAdmin = async () => {
    setAdminEmail('');
    setIdToken('');
    resetPortal();
    if (firebaseAuth) {
      try {
        await signOut(firebaseAuth);
      } catch (err) {
        console.error('Failed to sign out from Firebase:', err);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-100 flex items-center justify-center p-4" id="admin-modal-overlay">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden" id="admin-modal-container">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-600 text-white rounded-md">
              <Database className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="font-sans font-extrabold text-slate-900 tracking-tight text-base leading-none">Database Administration</h2>
              <p className="text-[10px] text-slate-500 font-mono mt-1">PROJECT: {firebaseConfig?.projectId || 'counselorpro-6975d'}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {adminEmail !== 'sarathdasireddy369@gmail.com' ? (
          <>
            {/* Content View - AUTH GATE */}
            <div className="p-6 flex-grow overflow-y-auto space-y-6">
              <div className="text-center max-w-md mx-auto py-4 space-y-4">
                <div className="inline-flex p-3.5 bg-slate-50 border border-slate-200/80 text-slate-700 rounded-2xl shadow-2xs">
                  <Lock className="w-8 h-8 text-slate-600" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-sans font-extrabold text-slate-900 text-lg tracking-tight">System Administrator Gate</h3>
                  <p className="text-slate-500 text-xs leading-relaxed max-w-sm mx-auto">
                    This console contains administrative pipelines and write privileges to the college database. Authenticate below.
                  </p>
                </div>
              </div>

              {isLoadingConfig ? (
                <div className="flex flex-col items-center justify-center py-6 space-y-2">
                  <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin" />
                  <span className="text-xs text-slate-500 font-mono">Loading authentication options...</span>
                </div>
              ) : (
                <div className="max-w-md mx-auto space-y-5">
                  {authError && (
                    <div className="p-3.5 bg-red-50 border border-red-100 text-red-800 rounded-xl text-xs flex gap-2.5 items-start font-sans leading-relaxed animate-fade-in" id="auth-error-alert">
                      <AlertCircle className="w-4.5 h-4.5 text-red-600 shrink-0 mt-0.5" />
                      <span>{authError}</span>
                    </div>
                  )}

                   {firebaseConfig?.apiKey && firebaseConfig?.projectId ? (
                    <div className="space-y-4">
                      <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={isVerifying}
                        className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-850 active:scale-[0.99] text-white font-bold rounded-xl text-xs tracking-wider uppercase font-mono shadow-sm transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-75"
                      >
                        {isVerifying ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Verifying Session...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4.5 h-4.5 text-emerald-400" />
                            <span>Sign In with Google</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-amber-50 border border-amber-100/60 rounded-xl flex gap-2.5 items-start text-[10px] text-amber-800 leading-relaxed font-sans">
                      <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-semibold block text-amber-900 mb-0.5">Firebase Client SDK Offline</strong>
                        Configure Google Auth secrets (FIREBASE_API_KEY, etc.) to enable social login options.
                      </div>
                    </div>
                  )}


                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 text-xs text-slate-400 font-mono">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse"></span>
                Console Secured
              </span>
              <button 
                onClick={onClose}
                className="px-4 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Content View - UNLOCKED PANEL */}
            <div className="p-6 flex-grow overflow-y-auto space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-emerald-50/60 border border-emerald-100 rounded-xl p-4 text-emerald-800">
                <div className="flex gap-3 text-emerald-800">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <span className="font-bold block">Verified Session: {adminEmail}</span>
                    <p className="leading-relaxed text-emerald-700">
                      You are authenticated as the system administrator. Database writes will commit directly to Firestore.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleSignOutAdmin}
                  className="px-2.5 py-1.5 bg-emerald-100/80 hover:bg-emerald-150 border border-emerald-200 text-emerald-800 font-semibold rounded-lg text-[10px] font-mono flex items-center gap-1 transition-all shrink-0 cursor-pointer"
                  title="Sign Out Admin"
                >
                  <LogOut className="w-3 h-3" />
                  <span>SIGN OUT</span>
                </button>
              </div>

              {/* Interactive Drag Drop Zone */}
              {status === 'idle' && (
                <div 
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    dragActive ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50/50'
                  }`}
                >
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    className="hidden" 
                    accept=".json"
                    onChange={handleFileChange}
                  />
                  <UploadCloud className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-800">Drag & Drop colleges_2024.json or Click to Browse</p>
                  <p className="text-xs text-slate-400 font-mono mt-1">Accepts standard JSON format only</p>
                </div>
              )}

              {/* File Loaded View */}
              {(status === 'parsing' || status === 'ready' || status === 'uploading' || status === 'success' || status === 'error') && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border border-slate-200 rounded-xl p-4 bg-slate-50 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <Database className="w-6 h-6 text-emerald-600" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 font-mono">{file?.name}</h4>
                        <p className="text-[10px] text-slate-500 font-mono">{(file!.size / 1024).toFixed(1)} KB • {parsedData ? `${parsedData.length.toLocaleString()} entries` : 'parsing...'}</p>
                      </div>
                    </div>
                    {status === 'ready' && (
                      <button 
                        onClick={resetPortal}
                        className="text-xs text-slate-500 font-semibold hover:bg-slate-200 px-3 py-1.5 rounded-lg border border-slate-300 transition-all cursor-pointer"
                      >
                        Change File
                      </button>
                    )}
                  </div>

                  {/* Logger Console Box */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono tracking-wider font-bold text-slate-400 block uppercase">Real-Time Administrative Logs</label>
                    <div className="bg-slate-950 text-emerald-400 font-mono text-[10px] p-4 rounded-xl h-44 overflow-y-auto space-y-1 shadow-inner border border-slate-900 leading-normal font-medium">
                      {log.map((line, idx) => (
                        <div key={idx} className="whitespace-pre-wrap">{line}</div>
                      ))}
                      {status === 'parsing' && <div className="text-slate-500 animate-pulse">Parsing file...</div>}
                      {status === 'uploading' && <div className="text-slate-300 flex items-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Committing documents to Firebase Firestore in chunks...
                      </div>}
                    </div>
                  </div>

                  {/* Status Views */}
                  {status === 'success' && (
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3 text-emerald-800">
                      <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                      <div className="text-xs">
                        <strong className="font-bold block text-sm">Synchronized Successfully!</strong>
                        <p className="text-emerald-700 leading-relaxed mt-0.5">
                          All {parsedData?.length.toLocaleString()} college-branch profiles have been successfully mapped, buffered, and deployed to your Firebase collection <code className="font-mono bg-emerald-100 px-1 rounded">colleges_2024</code>.
                        </p>
                      </div>
                    </div>
                  )}

                  {status === 'error' && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-800">
                      <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                      <div className="text-xs">
                        <strong className="font-bold block text-sm">Processing Failed</strong>
                        <p className="text-red-700 leading-relaxed mt-0.5">{errorMsg}</p>
                        <button 
                          onClick={resetPortal}
                          className="mt-3 text-xs bg-white text-red-700 border border-red-200 font-bold px-3 py-1.5 rounded-lg hover:bg-red-50 cursor-pointer"
                        >
                          Retry upload
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer controls */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50">
              <button 
                onClick={onClose}
                disabled={status === 'uploading'}
                className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-lg text-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              
              {status === 'ready' && (
                <button 
                  onClick={triggerUpload}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-lg text-xs shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Database className="w-3.5 h-3.5" />
                  Upload & Populate Firestore
                </button>
              )}

              {status === 'success' && (
                <button 
                  onClick={onClose}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-850 text-white font-semibold rounded-lg text-xs cursor-pointer"
                >
                  Done
                </button>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
