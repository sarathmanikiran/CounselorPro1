import { College, ExamType } from '../types';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

export let COLLEGES_DB: College[] = [];
export let COLLEGES_SOURCE = 'Initial State';

// Helper to retrieve/initialize the client-side Firebase and Firestore instance dynamically
async function getClientFirestoreDb() {
  if (getApps().length > 0) {
    const app = getApp();
    return getFirestore(app);
  }

  // Fetch the Firebase web client configuration dynamically
  const response = await fetch('/api/config/firebase');
  if (!response.ok) {
    throw new Error('Failed to load Firebase configuration from the server API');
  }
  const config = await response.json();
  if (!config.apiKey || !config.projectId) {
    throw new Error('Firebase client configuration is incomplete or unavailable');
  }
  const app = initializeApp(config);
  return getFirestore(app);
}

// In-memory client-side cache to prevent multiple network requests for the same file (Requirement 5)
const clientCache: Record<string, College[]> = {};

function mapDistrictAbbr(dist: string): string {
  const map: Record<string, string> = {
    'VSKP': 'Visakhapatnam',
    'EG': 'East Godavari',
    'WG': 'West Godavari',
    'ATP': 'Anantapur',
    'CTR': 'Chittoor',
    'KRI': 'Krishna',
    'SKL': 'Srikakulam',
    'GNT': 'Guntur',
    'NLR': 'Nellore',
    'VSP': 'Visakhapatnam',
    'KST': 'Krishna',
    'GTR': 'Guntur',
    'NLR_': 'Nellore'
  };
  return map[(dist || "").toUpperCase()] || dist || "Unknown";
}

export function normalizeCollege(item: any, index: number): College {
  const code = item.code || item.inst_code || 'UNKN';
  const branch = item.branch || item.branch_code || 'CSE';
  const isGovt = item.type === 'GOVT' || String(item.type).toUpperCase() === 'GOVT' || item.type === 'Govt';
  const typeMapped = isGovt ? 'Govt' : (item.type === 'PVT' ? 'Private' : (item.type || 'Private-Autonomous'));
  
  const rawCutoffOC = item.cutoffOC || item.oc_boys || item.oc_girls;
  const cutoffOC = Number(rawCutoffOC || 15000);

  const rawCutoffBC = item.cutoffBC || item.bcb_boys || item.bca_boys || item.bcd_boys;
  const cutoffBC = Number(rawCutoffBC || 25000);

  const rawCutoffSCST = item.cutoffSCST || item.sc_boys || item.sc_girls || item.st_boys;
  const cutoffSCST = Number(rawCutoffSCST || 55000);

  const rawCutoffEWS = item.oc_ews_boys || item.oc_ews_girls || item.cutoffEWS;
  const cutoffEWS = rawCutoffEWS ? Number(rawCutoffEWS) : cutoffOC;

  return {
    id: item.id || `${(item.exam || 'ap_eapcet').toLowerCase()}-${code.toLowerCase()}-${branch.toLowerCase()}-${index}`,
    code,
    name: item.name || item.institution_name || 'Unknown Institution',
    branch,
    district: mapDistrictAbbr(item.district || item.dist || 'OU'),
    type: typeMapped,
    fee: isGovt ? 35000 : (item.fee || 95000),
    cutoffOC,
    cutoffBC,
    cutoffSCST,
    cutoffEWS,
    region: item.region || item.inst_region || 'AU',
    exam: item.exam || 'AP_EAPCET'
  };
}

export function getExamGroup(exam: string | null, stream: 'MPC' | 'BiPC'): string {
  if (exam === 'AP_EAPCET') {
    return stream === 'BiPC' ? 'AP_EAPCET_BIPC' : 'AP_EAPCET_MPC';
  } else {
    // Default to TS_EAMCET or TS_EAPCET_BIPC
    return stream === 'BiPC' ? 'TS_EAPCET_BIPC' : 'TS_EAMCET';
  }
}

// Dynamically retrieve only the file the student needs based on their selection (Requirement 4)
export async function loadRealCollegesForExam(exam: ExamType | null, stream: 'MPC' | 'BiPC', year: number = 2025): Promise<number> {
  if (!exam) return 0;
  
  const examGroup = getExamGroup(exam, stream);
  const cacheKey = `${examGroup}_${year}`;

  // Serve from in-memory cache if available (Requirement 5)
  if (clientCache[cacheKey]) {
    console.log(`[CLIENT CACHE HIT] Serving ${clientCache[cacheKey].length} colleges for ${cacheKey} from cache.`);
    COLLEGES_DB.length = 0;
    COLLEGES_DB.push(...clientCache[cacheKey]);
    COLLEGES_SOURCE = `Static Cache (${examGroup})`;
    return COLLEGES_DB.length;
  }

  console.log(`[CLIENT FETCHING] Directly querying Firestore using Firebase App instance for exam: ${examGroup}, year: ${year}...`);

  try {
    const db = await getClientFirestoreDb();
    const collegesRef = collection(db, "colleges");
    const q = query(
      collegesRef,
      where("exam", "==", examGroup),
      where("year", "==", year)
    );
    
    const querySnapshot = await getDocs(q);

    // Implement proper error handling for empty result sets
    if (querySnapshot.empty) {
      throw new Error(`Empty result set: The Firestore database contains no records for "${examGroup}" in year ${year}. Please upload the dataset via the Admin Console.`);
    }

    const fetchedColleges: any[] = [];
    querySnapshot.forEach((doc) => {
      fetchedColleges.push({ id: doc.id, ...doc.data() });
    });

    const normalized = fetchedColleges.map((item, idx) => normalizeCollege(item, idx));
    
    // Cache the normalized colleges
    clientCache[cacheKey] = normalized;

    // Update COLLEGES_DB in-place
    COLLEGES_DB.length = 0;
    COLLEGES_DB.push(...normalized);
    COLLEGES_SOURCE = 'Real-time Firestore (Client SDK)';
    
    console.log(`[CLIENT SUCCESS] Successfully loaded ${normalized.length} colleges directly from Firestore using Firebase Web SDK.`);
    return normalized.length;
  } catch (err: any) {
    console.warn(`[CLIENT WARN] Direct Firestore query failed or returned permissions error:`, err.message || err);
    
    // If client SDK query fails (e.g. Missing or insufficient permissions), fallback to server API endpoint proxy
    try {
      console.log(`[CLIENT FALLBACK] Requesting real-time database via server API endpoint proxy: /api/colleges?exam=${examGroup}&year=${year}`);
      const res = await fetch(`/api/colleges?exam=${examGroup}&year=${year}`);
      if (!res.ok) throw new Error(`Server API returned error status: ${res.status}`);
      const data = await res.json();
      if (data && Array.isArray(data.colleges) && data.colleges.length > 0) {
        const normalized = data.colleges.map((item, idx) => normalizeCollege(item, idx));
        clientCache[cacheKey] = normalized;
        COLLEGES_DB.length = 0;
        COLLEGES_DB.push(...normalized);
        COLLEGES_SOURCE = data.source || 'Live Database (Server Proxy)';
        console.log(`[CLIENT SUCCESS] Loaded ${normalized.length} colleges from live server API proxy successfully.`);
        return normalized.length;
      } else {
        throw new Error(`Empty result set from server API: No records for "${examGroup}" in year ${year}.`);
      }
    } catch (apiErr: any) {
      console.warn(`[CLIENT API WARN] Failed to load from server API proxy:`, apiErr.message || apiErr);
      
      // Secondary fallback to static files (e.g. public/data/...)
      try {
        const filename = `${examGroup}_${year}.json`;
        console.log(`[CLIENT FALLBACK] Requesting static data file: /data/${filename}`);
        const res = await fetch(`/data/${filename}`);
        if (!res.ok) {
          throw new Error(`Static file /data/${filename} returned status ${res.status}`);
        }
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const normalized = data.map((item, idx) => normalizeCollege(item, idx));
          clientCache[cacheKey] = normalized;
          COLLEGES_DB.length = 0;
          COLLEGES_DB.push(...normalized);
          COLLEGES_SOURCE = `Static File Fallback (${examGroup}_${year})`;
          console.log(`[CLIENT SUCCESS] Loaded ${normalized.length} colleges from static JSON file fallback.`);
          return normalized.length;
        } else {
          throw new Error(`Empty result set in static file fallback for "${examGroup}" in year ${year}.`);
        }
      } catch (staticErr: any) {
        console.error('[CLIENT FATAL] All college retrieval strategies failed:', staticErr.message || staticErr);
        throw new Error(`Failed to load colleges database: ${staticErr.message || staticErr}`);
      }
    }
  }
}

// Deprecated single load wrapper to retain backwards compatibility
export async function loadRealColleges(): Promise<number> {
  return loadRealCollegesForExam('AP_EAPCET', 'MPC', 2025);
}

// Helper to get cutoff based on student details
export function getCollegeCutoff(college: College, category: string, ews_status?: boolean): number {
  if (ews_status || category === 'EWS') {
    return college.cutoffEWS || college.cutoffOC;
  }
  if (category.startsWith('BC')) {
    return college.cutoffBC;
  }
  if (category === 'SC' || category === 'ST') {
    return college.cutoffSCST;
  }
  return college.cutoffOC;
}

// Helper to determine AI allotment probability
export function getSeatProbability(college: College, rank: number, category: string, ews_status?: boolean): 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW' {
  const cutoff = getCollegeCutoff(college, category, ews_status);
  
  if (rank <= cutoff * 0.8) {
    return 'HIGH';
  } else if (rank <= cutoff * 1.2) {
    return 'MEDIUM';
  } else if (rank <= cutoff * 1.8) {
    return 'LOW';
  } else {
    return 'VERY_LOW';
  }
}

// Helper to retrieve colleges adapted for a specific academic stream (MPC vs BiPC)
export function getCollegesForStream(stream: 'MPC' | 'BiPC'): College[] {
  // COLLEGES_DB is already pre-grouped and adapted on the server/static generation layer, so we return it directly!
  return COLLEGES_DB;
}
