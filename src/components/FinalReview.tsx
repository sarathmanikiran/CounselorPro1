import React, { useState } from 'react';
import { StudentProfile, WebOption, MockAllotmentResult } from '../types';
import { COLLEGES_DB, getCollegeCutoff, getCollegesForStream } from '../data/colleges';
import { ArrowLeft, CheckCircle2, Award, Download, Building, DollarSign, Calendar, FileText, Sparkles, HelpCircle, AlertTriangle } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface FinalReviewProps {
  profile: StudentProfile;
  selectedOptions: WebOption[];
  onBack: () => void;
  onFinish: () => void;
}

export default function FinalReview({ profile, selectedOptions, onBack, onFinish }: FinalReviewProps) {
  const [allotment, setAllotment] = useState<MockAllotmentResult | null>(null);
  const [runningAllotment, setRunningAllotment] = useState<boolean>(false);

  // Core Mock Allotment Algorithm based on actual EAPCET/EAMCET reservation/cutoff bounds
  const runAllotmentLogic = () => {
    setRunningAllotment(true);
    
    // Simulate real seat matching processing time
    setTimeout(() => {
      let allottedResult: MockAllotmentResult = { allotted: false };
      const collegesList = getCollegesForStream(profile.stream);

      // Loop through choices in sequential priority order (1 to N)
      for (let i = 0; i < selectedOptions.length; i++) {
        const option = selectedOptions[i];
        // Match option against our DB
        const collegeDb = collegesList.find(c => c.id === option.collegeId);
        
        if (collegeDb) {
          const cutoff = getCollegeCutoff(collegeDb, profile.category);
          
          // Local/Non-local penalty: if college region doesn't match student's region, add difficulty
          // In real counselling, 85% of seats are reserved for local region. So non-local cutoffs are much harder!
          const regionModifier = (collegeDb.region !== profile.region) ? 0.75 : 1.0;
          const adjustedCutoff = cutoff * regionModifier;

          if (profile.rank <= adjustedCutoff) {
            allottedResult = {
              allotted: true,
              college: collegeDb,
              optionNumber: option.priority,
              categoryUsed: profile.category,
              allotmentType: collegeDb.region === profile.region ? "Local Quota" : "Non-Local Quota",
              message: `You successfully matched historical seat cutoff boundaries at priority order #${option.priority}.`
            };
            break; // Matched highest preference, exit loop!
          }
        }
      }

      setAllotment(allottedResult);
      setRunningAllotment(false);
    }, 1500);
  };

  // Printable registered list PDF simulation action
  const handleDownloadSlip = () => {
    const header = `=== REGISTERED WEB OPTIONS RECEIPT ===\nEXAM: ${profile.exam}\nHALL TICKET: ${profile.hallTicket}\nRANK: ${profile.rank}\nCATEGORY: ${profile.category} (${profile.region})\nDATE: ${new Date().toLocaleDateString()}\n\n`;
    const choices = selectedOptions
      .map(o => `Option #${o.priority}: [${o.collegeCode}] ${o.collegeName} - Branch: ${o.branch} (Fee: ₹${o.fee.toLocaleString()}/yr)`)
      .join('\n');
    
    const footer = `\n\n======================================\nThank you for practicing with CounselorPro. Good luck on final counselling day!`;
    const fileContent = header + choices + footer;

    const element = document.createElement("a");
    const file = new Blob([fileContent], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${profile.hallTicket}_Registered_Options.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Professional PDF report generator using jsPDF and jspdf-autotable
  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Page dimensions
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Top Border Accent (Dark Slate/Teal color scheme)
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, pageWidth, 6, 'F');

      // Decorative header badge
      doc.setFillColor(241, 245, 249); // slate-100
      doc.roundedRect(pageWidth / 2 - 40, 10, 80, 8, 2, 2, 'F');
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text("CONVENOR ADMISSIONS PORTAL (SIMULATION)", pageWidth / 2, 15, { align: 'center' });

      // Title & Council
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text("STATE COUNCIL OF HIGHER EDUCATION", pageWidth / 2, 28, { align: 'center' });

      doc.setFontSize(11);
      doc.setTextColor(5, 150, 105); // emerald-600
      doc.text("OFFICIAL REGISTERED WEB OPTIONS RECORD RECEIPT", pageWidth / 2, 34, { align: 'center' });

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(`Receipt ID: HT-${profile.hallTicket}-${new Date().getFullYear()} • Generated via CounselorPro`, pageWidth / 2, 39, { align: 'center' });

      // Dividers
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.5);
      doc.line(15, 43, pageWidth - 15, 43);

      // Student Profile Metadata Box
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.roundedRect(15, 47, pageWidth - 30, 32, 2, 2, 'FD');

      // Heading for student details
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text("CANDIDATE PROFILE DETAILS", 20, 53);

      doc.setDrawColor(241, 245, 249);
      doc.line(20, 55, pageWidth - 20, 55);

      // Metadata Key-Value pairs
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139); // slate-500
      
      // Col 1
      doc.text("HALL TICKET NO:", 20, 61);
      doc.text("SECURED RANK:", 20, 67);
      doc.text("ENTRANCE EXAM:", 20, 73);

      // Col 2
      doc.text("RESERVATION CATEGORY:", 110, 61);
      doc.text("LOCAL REGION:", 110, 67);
      doc.text("SUBMISSION DATE:", 110, 73);

      // Values
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(String(profile.hallTicket || ''), 55, 61);
      doc.text(Number(profile.rank || 0).toLocaleString(), 55, 67);
      doc.text(String(profile.exam || '').replace('_', ' ') + ` (${profile.stream || ''})`, 55, 73);

      doc.text(String(profile.category || ''), 155, 61);
      doc.text(String(profile.region || ''), 155, 67);
      doc.text(new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString(), 155, 73);

      // Table Title
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text("REGISTERED CHOICE SEQUENCE & PRIORITY ORDER", 15, 88);

      // Options table
      const tableHeaders = [['No.', 'Code', 'College/Institution Name', 'Branch', 'Annual Fee']];
      const tableRows = selectedOptions.map(opt => [
        String(opt.priority),
        String(opt.collegeCode),
        String(opt.collegeName),
        String(opt.branch),
        `Rs. ${Number(opt.fee).toLocaleString()}/-`
      ]);

      // Call autoTable helper
      autoTable(doc, {
        startY: 92,
        margin: { left: 15, right: 15 },
        head: tableHeaders,
        body: tableRows,
        theme: 'striped',
        headStyles: {
          fillColor: [15, 23, 42], // slate-900 theme
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold',
          halign: 'left'
        },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' }, // Priority
          1: { cellWidth: 25, fontStyle: 'bold', textColor: [5, 150, 105] }, // Code (Emerald)
          2: { cellWidth: 'auto' }, // Name
          3: { cellWidth: 25, halign: 'center' }, // Branch
          4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' } // Fee
        },
        styles: {
          fontSize: 8.5,
          cellPadding: 3,
          valign: 'middle'
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252] // slate-50
        }
      });

      // Get Y coordinate after table
      let finalY = (doc as any).lastAutoTable.finalY + 10;

      // Check if signature box would overflow page height, if so start new page or handle gracefully
      if (finalY + 45 > pageHeight) {
        doc.addPage();
        finalY = 20;
      }

      // Digital Integrity Footer Box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(15, finalY, pageWidth - 30, 32, 2, 2, 'FD');

      // Security Watermark Box (QR Code simulation)
      doc.setFillColor(30, 41, 59); // slate-800
      doc.rect(20, finalY + 4, 24, 24, 'F');
      
      // Draw grid pattern to simulate QR code
      doc.setFillColor(255, 255, 255);
      // Corners
      doc.rect(22, finalY + 6, 6, 6, 'F');
      doc.rect(36, finalY + 6, 6, 6, 'F');
      doc.rect(22, finalY + 20, 6, 6, 'F');
      doc.setFillColor(30, 41, 59);
      doc.rect(24, finalY + 8, 2, 2, 'F');
      doc.rect(38, finalY + 8, 2, 2, 'F');
      doc.rect(24, finalY + 22, 2, 2, 'F');
      // Random mock QR dots
      doc.setFillColor(255, 255, 255);
      doc.rect(30, finalY + 14, 2, 2, 'F');
      doc.rect(34, finalY + 16, 2, 2, 'F');
      doc.rect(28, finalY + 18, 2, 2, 'F');
      doc.rect(32, finalY + 22, 4, 2, 'F');

      // Integrity Details
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(5, 150, 105); // emerald-600
      doc.text("SECURE PORTAL DIGITAL INTEGRITY VERIFIED", 48, finalY + 10);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text("This counseling choice sheet is securely generated and locked by CounselorPro.", 48, finalY + 15);
      doc.text("It has been formatted as an official counseling list document ready for physical reference.", 48, finalY + 19);
      doc.text("Timestamp: " + new Date().toISOString() + " | Sign-hash: " + Math.random().toString(16).substring(2, 10).toUpperCase(), 48, finalY + 23);
      doc.text("Status: VERIFIED ADMISSION SEQUENCE", 48, finalY + 27);

      // Final signature line
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text("CONVENOR SIGNATURE", pageWidth - 55, finalY + 24, { align: 'center' });
      doc.setDrawColor(203, 213, 225); // slate-300
      doc.line(pageWidth - 75, finalY + 20, pageWidth - 15, finalY + 20);

      // Page numbers & disclaimers at the absolute bottom
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text("Disclaimer: This is a simulated option slip. Keep this secure for your counseling practice sessions.", pageWidth / 2, pageHeight - 12, { align: 'center' });
      doc.text("Page 1 of 1 • CounselorPro Web-Options System", pageWidth / 2, pageHeight - 8, { align: 'center' });

      // Trigger standard save
      doc.save(`${profile.hallTicket}_Counseling_Options.pdf`);
    } catch (err: any) {
      console.error("Failed to generate PDF:", err);
      alert("An error occurred while generating the PDF: " + err.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4" id="final-review-workspace">
      
      {/* Step Banner */}
      <div className="text-center mb-8">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
          Step 4 of 4: Final Review & Allotment
        </span>
        <h2 className="font-sans font-bold text-3xl text-slate-900 mt-3 tracking-tight">
          Review & Run Mock Allotment
        </h2>
        <p className="text-slate-500 mt-2 text-sm max-w-xl mx-auto">
          Review your official registered choices receipt below, then run the Mock Allotment Engine to see which college gets allocated!
        </p>
      </div>

      {allotment === null ? (
        <div className="space-y-6">
          
          {/* REGISTERED SLIP CONTAINER */}
          <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden" id="registered-slip-card">
            
            {/* Slip Header */}
            <div className="bg-slate-50 p-6 border-b border-slate-200 flex justify-between items-start flex-wrap gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-mono tracking-widest text-slate-500 block uppercase">CONVENOR ADMISSIONS OFFICE</span>
                <h3 className="font-sans font-extrabold text-slate-900 text-lg">REGISTERED OPTIONS RECORD RECEIPT</h3>
                <p className="text-xs font-mono text-slate-500">Receipt ID: HT-{profile.hallTicket}-{new Date().getFullYear()}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleDownloadSlip}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Download Slip Text Document"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Plain TXT
                </button>
                <button
                  onClick={handleDownloadPDF}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Download Official Counseling List PDF Document"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Download as PDF
                </button>
              </div>
            </div>

            {/* Student Metadata Strip */}
            <div className="px-6 py-4 bg-slate-100/50 border-b border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
              <div>
                <span className="text-slate-400 block uppercase text-[9px]">Hall Ticket</span>
                <span className="font-bold text-slate-800">{profile.hallTicket}</span>
              </div>
              <div>
                <span className="text-slate-400 block uppercase text-[9px]">Secured Rank</span>
                <span className="font-bold text-slate-800">{profile.rank?.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-400 block uppercase text-[9px]">Reservation Quota</span>
                <span className="font-bold text-slate-800">{profile.category} ({profile.region})</span>
              </div>
              <div>
                <span className="text-slate-400 block uppercase text-[9px]">Submission Date</span>
                <span className="font-bold text-slate-800">{new Date().toLocaleDateString()}</span>
              </div>
            </div>

            {/* Option Entry Slip Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-mono text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3 px-6 text-center w-20">Priority No</th>
                    <th className="py-3 px-6">College Code</th>
                    <th className="py-3 px-6">College Name</th>
                    <th className="py-3 px-6">Branch</th>
                    <th className="py-3 px-6 text-right">Est. Fee per year</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {selectedOptions.map((opt) => (
                    <tr key={opt.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-6 text-center font-bold text-slate-900 bg-slate-50/30 w-20 font-mono">
                        {opt.priority}
                      </td>
                      <td className="py-3 px-6 font-mono font-bold text-emerald-700">
                        {opt.collegeCode}
                      </td>
                      <td className="py-3 px-6 font-medium text-slate-900">
                        {opt.collegeName}
                      </td>
                      <td className="py-3 px-6">
                        <span className="px-2 py-0.5 text-[10px] font-mono font-semibold text-emerald-800 bg-emerald-50 border border-emerald-100 rounded">
                          {opt.branch}
                        </span>
                      </td>
                      <td className="py-3 px-6 text-right font-mono font-semibold text-slate-900">
                        ₹{opt.fee.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Call to Allotment Option */}
          <div className="p-6 bg-white border border-slate-200 text-slate-800 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-xs relative overflow-hidden animate-fade-in">
            <div className="absolute right-0 top-0 transform translate-x-12 -translate-y-12 bg-emerald-500/5 h-40 w-40 rounded-full blur-2xl"></div>
            <div className="space-y-1 max-w-xl z-10">
              <div className="flex items-center gap-1.5 font-bold tracking-wide uppercase text-xs text-emerald-600">
                <Sparkles className="w-4 h-4 text-emerald-500 animate-spin-slow" />
                Step 5: Simulated Board Seat Allocation
              </div>
              <h4 className="font-sans font-extrabold text-xl text-slate-900">Ready to test your options?</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Clicking the button will trigger the simulated admissions council seat assignment algorithm. The system evaluates options in descending sequence against reservation boundaries.
              </p>
            </div>
            
            <button
              onClick={runAllotmentLogic}
              disabled={runningAllotment}
              id="run-allotment-btn"
              className="px-6 py-3.5 bg-emerald-600 text-white hover:bg-emerald-700 font-bold rounded-xl shadow-md transition-all flex items-center gap-2 flex-shrink-0 z-10 cursor-pointer text-sm"
            >
              {runningAllotment ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing Seat...
                </>
              ) : (
                <>
                  Run Mock Seat Allotment
                </>
              )}
            </button>
          </div>

          {/* Back Trigger */}
          <div className="flex justify-start">
            <button
              onClick={onBack}
              className="px-5 py-2.5 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Adjust Options Sequence
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* MOCK ALLOTMENT ORDER LETTER BOX */}
          <div className="bg-white border-2 border-slate-300 shadow-xl rounded-2xl overflow-hidden relative" id="allotment-letter">
            
            {/* Watermark background */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
              <Award className="w-96 h-96" />
            </div>

            {/* Letter Header */}
            <div className="p-6 border-b border-slate-200 text-center space-y-1 bg-slate-50">
              <span className="font-mono text-slate-500 text-[10px] font-bold block uppercase tracking-widest">STATE COUNCIL OF ADMISSIONS & ACADEMICS</span>
              <h3 className="font-sans font-black text-slate-900 text-xl tracking-tight uppercase">PROVISIONAL SEAT ALLOTMENT LETTER</h3>
              <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold inline-block">
                MOCK ALLOTMENT - PRACTICE ONLY
              </span>
            </div>

            {allotment.allotted ? (
              <div className="p-6 sm:p-8 space-y-6 text-xs sm:text-sm text-slate-700">
                <p className="leading-relaxed font-sans">
                  Based on your common entrance exam rank performance in <strong>{profile.exam?.replace('_', ' ')}</strong>, and local option priority criteria submissions, you have been provisionally matched and allotted a seat in the following institution:
                </p>

                {/* Main Allotment Details Card */}
                <div className="p-5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-600 text-white rounded-lg">
                      <Building className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-mono tracking-widest text-emerald-700 block uppercase font-bold">ALLOTTED INSTITUTION</span>
                      <h4 className="font-sans font-extrabold text-slate-900 text-base sm:text-lg">{allotment.college?.name}</h4>
                      <p className="text-xs text-slate-500 font-mono">College Code: {allotment.college?.code} • Region: {allotment.college?.region}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-emerald-100">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-mono tracking-widest text-emerald-700 block uppercase font-bold">ALLOTTED BRANCH</span>
                      <p className="font-sans font-bold text-slate-900 text-sm">{allotment.college?.branch}</p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-mono tracking-widest text-emerald-700 block uppercase font-bold">MATCHED PREFERENCE</span>
                      <p className="font-sans font-bold text-slate-900 text-sm">Priority Choice #{allotment.optionNumber}</p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-mono tracking-widest text-emerald-700 block uppercase font-bold">ESTIMATED ANNUAL FEE</span>
                      <p className="font-sans font-bold text-slate-900 text-sm">₹{allotment.college?.fee.toLocaleString()}/yr</p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-mono tracking-widest text-emerald-700 block uppercase font-bold">CATEGORY USED</span>
                      <p className="font-sans font-bold text-slate-900 text-sm">{allotment.categoryUsed} ({allotment.allotmentType})</p>
                    </div>
                  </div>
                </div>

                {/* Reporting Instructions */}
                <div className="space-y-2 border-t border-slate-100 pt-5 text-slate-600 leading-relaxed">
                  <h5 className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    Reporting Instructions (Practice Days)
                  </h5>
                  <ul className="list-disc pl-5 space-y-1 text-xs">
                    <li>This is a simulated allotment under the practice portal to test sequence validity.</li>
                    <li>If this were real, you would be required to physically report to <strong>{allotment.college?.name}</strong> within 4 reporting working days with your seat confirmation receipt and TC.</li>
                    <li>Because your priority ranking successfully achieved this placement, we recommend keeping this choice list as a reference when filling the real NIC government portal.</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center space-y-4">
                <div className="p-3 bg-red-100 text-red-600 rounded-full w-fit mx-auto">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <div className="max-w-md mx-auto space-y-2">
                  <h4 className="font-sans font-black text-slate-900 text-lg">NO SEAT ALLOTTED</h4>
                  <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
                    Based on your rank of <strong>{profile.rank.toLocaleString()}</strong> and selected list of choices, you did not match any cutoff boundaries. This can happen if you only choose ultra-competitive premium college branches (e.g. CSE at JNTU/CBIT) with insufficient safety options.
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={() => setAllotment(null)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs cursor-pointer shadow-sm"
                    >
                      Go Back & Add Safety Colleges
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Official Looking Seal/Footer */}
            {allotment.allotted && (
              <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[10px] font-mono text-slate-400">
                <span>SIMULATION CERTIFICATE NO: PROX-{profile.hallTicket}-ALLOT</span>
                <span className="text-emerald-600 font-extrabold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  MOCK VERIFIED MATCH
                </span>
              </div>
            )}
          </div>

          {/* Action Trigger Buttons */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 mt-8">
            <button
              onClick={() => setAllotment(null)}
              className="px-6 py-3 border border-slate-200 bg-white hover:bg-slate-100 rounded-xl text-slate-700 font-semibold cursor-pointer text-xs sm:text-sm text-center"
            >
              Reset Mock Allotment
            </button>
            <button
              onClick={onFinish}
              id="finish-simulation-btn"
              className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all cursor-pointer text-xs sm:text-sm text-center"
            >
              Submit & Complete Practice
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
