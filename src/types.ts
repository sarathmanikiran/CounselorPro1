export type ExamType = 'AP_EAPCET' | 'TS_EAMCET';

export interface StudentProfile {
  exam: ExamType | null;
  stream: 'MPC' | 'BiPC';
  rank: number;
  gender: 'Male' | 'Female';
  category: 'OC' | 'BC-A' | 'BC-B' | 'BC-C' | 'BC-D' | 'BC-E' | 'SC' | 'ST';
  region: 'AU' | 'SVU' | 'OU';
  hallTicket: string;
}

export interface College {
  id: string;
  code: string;
  name: string;
  branch: string;
  district: string;
  type: 'Govt' | 'Private-Autonomous' | 'Private';
  fee: number;
  cutoffOC: number;
  cutoffBC: number;
  cutoffSCST: number;
  region: 'AU' | 'SVU' | 'OU';
  exam: ExamType;
}

export interface WebOption {
  id: string; // unique for this choice item (combining college + branch)
  priority: number; // 1-indexed order
  collegeId: string;
  collegeCode: string;
  collegeName: string;
  branch: string;
  district: string;
  fee: number;
}

export interface MockAllotmentResult {
  allotted: boolean;
  college?: College;
  optionNumber?: number;
  categoryUsed?: string;
  allotmentType?: string; // e.g. "General", "Local", "Category"
  message?: string;
}

export interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}
