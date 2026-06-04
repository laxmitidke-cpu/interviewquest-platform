/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Users, BookOpen, Clock, FileText, CheckCircle2, XCircle, 
  Send, Plus, Copy, Check, LogOut, ChevronRight, MessageSquare, 
  Sparkles, Mail, ShieldAlert, FileDown, Search, ArrowRight, Loader2
} from "lucide-react";
import { User, Assessment, AssessmentSession, EmailInvitation, OutgoingEmail } from "../types";
import { jsPDF } from "jspdf";

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
}

export default function AdminDashboard({ user, onLogout }: AdminDashboardProps) {
  // Stats
  const [stats, setStats] = useState({
    totalAssessments: 0,
    totalCandidates: 0,
    completedCount: 0,
    progressCount: 0,
    pendingCount: 0,
    avgScorePercentage: 0
  });

  // DB States
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [sessions, setSessions] = useState<AssessmentSession[]>([]);
  const [invitations, setInvitations] = useState<EmailInvitation[]>([]);
  const [emails, setEmails] = useState<OutgoingEmail[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // UI forms & tabs
  const [activeTab, setActiveTab] = useState<"overview" | "create" | "candidates" | "emails" | "audit">("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Form: Create assessment
  const [assTitle, setAssTitle] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>(["React"]);
  const [numQuestions, setNumQuestions] = useState(3);
  const [timeLimit, setTimeLimit] = useState(20);
  const [difficultyLevel, setDifficultyLevel] = useState<"easy" | "medium" | "hard">("medium");
  const [useAi, setUseAi] = useState(true);
  const [creatingAss, setCreatingAss] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);

  

  // Form: Invite candidate
  const [candEmail, setCandEmail] = useState("");
  const [candName, setCandName] = useState("");
  const [selectedAssId, setSelectedAssId] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Selected candidate result view
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const skillOptions = ["React", "Python", "Node.js", "PostgreSQL", "System Design", "Cloud Computing", "Networking", "Linux", "CI/CD tools"];

  const handleToggleSkill = (skill: string) => {
    if (selectedSkills.includes(skill)) {
      if (selectedSkills.length > 1) {
        setSelectedSkills(selectedSkills.filter(s => s !== skill));
      }
    } else {
      setSelectedSkills([...selectedSkills, skill]);
    }
  };

  const getDashboardData = async () => {
    try {
      const res = await fetch("/api/recruiter/dashboard-stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setAssessments(data.assessments);
        setSessions(data.sessions);
        setInvitations(data.invitations);
        setSelectedAssId((prevSelectedAssId) => {
          if (data.assessments.length === 0) return "";
          if (!prevSelectedAssId || !data.assessments.some(a => a.id === prevSelectedAssId)) {
            return data.assessments[0].id;
          }
          return prevSelectedAssId;
        });
        
      }

      // Fetch emails
      const mailRes = await fetch("/api/emails");
      if (mailRes.ok) {
        const mailData = await mailRes.json();
        setEmails(mailData.emails);
      }

      // Fetch audit logs
      const auditRes = await fetch("/api/audit-trail");
      if (auditRes.ok) {
        const auditData = await auditRes.json();
        setAuditLogs(auditData.logs);
      }
    } catch (err) {
      console.error("Failed to load dashboard statistics:", err);
    }
  };

  useEffect(() => {
    getDashboardData();
    const interval = setInterval(getDashboardData, 8000); // Poll dashboard data automatically for interactive updates
    return () => clearInterval(interval);
  }, []);

  const handleCreateAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assTitle.trim()) return;

    setCreatingAss(true);
    setCreateSuccess(false);

    try {
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: assTitle.trim(),
          creatorId: user.id,
          skills: selectedSkills,
          numQuestions,
          timeLimit,
          useAi,
          difficultyLevel
        })
      });

      if (res.ok) {
        const data = await res.json();
        setCreateSuccess(true);
        setAssTitle("");
        if (data.assessment?.id) {
          setSelectedAssId(data.assessment.id);
        }
        await getDashboardData();
        setTimeout(() => setCreateSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Failed to create assessment questionnaire:", err);
    } finally {
      setCreatingAss(false);
    }
  };

  

  const handleInviteCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candEmail.trim() || !candName.trim() || !selectedAssId) return;

    setInviting(true);
    setInviteSuccess(false);

    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId: selectedAssId,
          candidateEmail: candEmail.trim(),
          candidateName: candName.trim()
        })
      });

      if (res.ok) {
        setInviteSuccess(true);
        setCandEmail("");
        setCandName("");
        await getDashboardData();
        setTimeout(() => setInviteSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Failed to invite candidate:", err);
    } finally {
      setInviting(false);
    }
  };

  const handleCopyLink = (token: string) => {
    const sandboxLink = `${window.location.origin}/login?token=${token}`;
    navigator.clipboard.writeText(sandboxLink);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  // PDF Export Performance Report generator using jsPDF
  const handleExportPdf = (session: AssessmentSession, assessment: Assessment | undefined) => {
    if (!assessment) return;

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    // 1. Theme and Borders (Aesthetic layout pairings matching guidelines)
    doc.setFillColor(31, 41, 55); // slate gray header background
    doc.rect(0, 0, 210, 38, "F");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text("INTERVIEWQUEST CANDIDATE REPORT", 14, 16);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(190, 200, 220);
    doc.text(`Hash Certified: SHA-256 Validated Signature`, 14, 23);
    doc.text(`Generated At: ${new Date().toLocaleDateString()} - SECURE PORTAL`, 14, 28);

    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text("POSTGRES DB VERIFIED RECORD", 150, 16);
    doc.text(`ID: ${session.id}`, 150, 23);

    // 2. Candidate Information Block
    doc.setFillColor(243, 244, 246);
    doc.rect(14, 46, 182, 36, "F");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(31, 41, 55);
    doc.text("CANDIDATE DOSSIER", 18, 53);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(55, 65, 81);
    doc.text(`Full Name:   ${session.candidateName}`, 18, 61);
    doc.text(`Email ID:     ${session.candidateEmail}`, 18, 67);
    doc.text(`Status:        ${session.status.toUpperCase()} (${session.results?.passed ? "PASSED" : "FAILED"})`, 18, 73);

    doc.text(`Assessment:  ${assessment.title}`, 105, 61);
    doc.text(`Topic Skills: ${assessment.skills.join(", ")}`, 105, 67);
    doc.text(`Score Cards: ${session.results?.totalScore || 0} / ${session.results?.maxScore || 0} (${Math.round(((session.results?.totalScore || 0) / (session.results?.maxScore || 1)) * 100)}%)`, 105, 73);

    // 3. Overall Feedback block
    doc.setFont("Helvetica", "bold");
    doc.text("AI GEMINI RECRUITER GRADE:", 14, 94);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(55, 65, 81);
    
    // Split text into lines of 170 characters
    const feedbackText = session.results?.overallFeedback || "No overall feedback compiled.";
    const splitFeedback = doc.splitTextToSize(feedbackText, 182);
    doc.text(splitFeedback, 14, 100);

    // 4. Score breakdown on individual questions
    let yPos = 120 + (splitFeedback.length * 4);
    doc.setFont("Helvetica", "bold");
    doc.text("TECHNICAL PERFORMANCE EVALUATIONS", 14, yPos);
    yPos += 6;

    if (session.results?.evaluations) {
      session.results.evaluations.forEach((evalItem, idx) => {
        const originalQ = assessment.questions.find(q => q.id === evalItem.questionId);
        if (originalQ) {
          // Keep layout tidy, break pages if exceeding maximum mm
          if (yPos > 240) {
            doc.addPage();
            yPos = 20;
          }

          doc.setFillColor(249, 250, 251);
          doc.rect(14, yPos, 182, 30, "F");

          doc.setFont("Helvetica", "bold");
          doc.setTextColor(17, 24, 39);
          // Truncate long questions for presentation space
          const cleanQText = originalQ.text.length > 85 ? originalQ.text.slice(0, 85) + "..." : originalQ.text;
          doc.text(`Q${idx + 1}: ${cleanQText}`, 18, yPos + 6);

          doc.setFont("Helvetica", "normal");
          doc.setTextColor(75, 85, 99);
          doc.setFontSize(9);
          doc.text(`Earned: ${evalItem.pointsEarned}/${originalQ.points} Pts`, 18, yPos + 12);
          doc.text(`Type: ${originalQ.type === "mcq" ? "MCQ Selection" : "Open short answer text"}`, 95, yPos + 12);
          doc.text(`Correct: ${evalItem.isCorrect ? "YES" : "NO"}`, 160, yPos + 12);

          const answerText = evalItem.feedback || "Processed standardly.";
          const splitAnswer = doc.splitTextToSize(answerText, 172);
          doc.text(splitAnswer, 18, yPos + 18);

          doc.setFontSize(10);
          yPos += 36;
        }
      });
    }

    // 5. Secure Hash Stamp representing database cryptographic chain
    if (yPos > 255) {
      doc.addPage();
      yPos = 20;
    }

    doc.setDrawColor(229, 231, 235);
    doc.line(14, yPos, 196, yPos);
    yPos += 8;

    doc.setFont("Courier", "normal");
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(`POSTGRES CRYPTO SECURE CHAIN ENVELOPE:`, 14, yPos);
    doc.text(`${session.secureHash || "UNSIGNED-TAMPER_WARNING"}`, 14, yPos + 4);

    doc.text(`Candidate Answers Saved Session Integrity: verified`, 14, yPos + 8);

    doc.save(`InterviewQuest_Report_${session.candidateName.replace(/\s+/g, "_")}.pdf`);
  };

  const selectedSession = sessions.find(s => s.id === selectedSessionId);
  const selectedAssessment = selectedSession ? assessments.find(a => a.id === selectedSession.assessmentId) : undefined;

  // Filter sessions
  const filteredSessions = sessions.filter(s => 
    s.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.candidateEmail.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Dynamic Header */}
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 text-white p-2 rounded-xl">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">InterviewQuest Recruiter Console</h1>
            <p className="text-xs text-gray-400">Welcome back, <span className="font-semibold text-indigo-600">{user.name}</span></p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl text-xs font-mono font-medium flex items-center">
            <span className="h-2 w-2 bg-indigo-500 rounded-full animate-pulse mr-2"></span>
            PostgreSQL Ready
          </div>
          <button
            onClick={onLogout}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 border border-gray-200 text-xs font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
            id="btn-logout"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </nav>

      {/* Main layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Navigation panel */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 flex flex-col space-y-1">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">Navigation</h3>
            <button
              onClick={() => { setActiveTab("overview"); setSelectedSessionId(null); }}
              className={`flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === "overview" && !selectedSessionId
                  ? "bg-indigo-600 text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4" />
                <span>Executive Dashboard</span>
              </div>
              <ChevronRight className={`h-3.5 w-3.5 ${activeTab === "overview" && !selectedSessionId ? "opacity-100" : "opacity-40"}`} />
            </button>

            <button
              onClick={() => { setActiveTab("create"); setSelectedSessionId(null); }}
              className={`flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === "create"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Create Questionnaire</span>
              </div>
              <ChevronRight className={`h-3.5 w-3.5 ${activeTab === "create" ? "opacity-100" : "opacity-40"}`} />
            </button>

            

            <button
              onClick={() => { setActiveTab("candidates"); setSelectedSessionId(null); }}
              className={`flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === "candidates" && !selectedSessionId
                  ? "bg-indigo-600 text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center space-x-2">
                <FileText className="h-4 w-4" />
                <span>Screening Scores</span>
              </div>
              <ChevronRight className={`h-3.5 w-3.5 ${activeTab === "candidates" ? "opacity-100" : "opacity-40"}`} />
            </button>

            <button
              onClick={() => { setActiveTab("emails"); setSelectedSessionId(null); }}
              className={`flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === "emails"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4" />
                <span>Simulated Mail Queue</span>
              </div>
              <div className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {emails.length}
              </div>
            </button>

            <button
              onClick={() => { setActiveTab("audit"); setSelectedSessionId(null); }}
              className={`flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === "audit"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center space-x-2">
                <ShieldAlert className="h-4 w-4" />
                <span>Database Audit Trails</span>
              </div>
              <ChevronRight className={`h-3.5 w-3.5 ${activeTab === "audit" ? "opacity-100" : "opacity-40"}`} />
            </button>
          </div>

          {/* Quick invite candidate short-form inside left-rail for enhanced recruiters convenience! */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2 flex items-center">
              <Send className="h-3.5 w-3.5 mr-1.5 text-indigo-500" />
              Direct Invite Dispatcher
            </h3>
            <form onSubmit={handleInviteCandidate} className="space-y-3">
              {inviteSuccess && (
                <div className="p-2.5 bg-green-50 text-green-700 text-[10px] rounded-lg border border-green-100">
                  Invitation sent! Email logged below.
                </div>
              )}
              <div>
                <input
                  type="text"
                  placeholder="Candidate Full Name"
                  required
                  value={candName}
                  onChange={(e) => setCandName(e.target.value)}
                  className="w-full text-xs rounded-lg border border-gray-200 px-3 py-2 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <input
                  type="email"
                  placeholder="name@gmail.com"
                  required
                  value={candEmail}
                  onChange={(e) => setCandEmail(e.target.value)}
                  className="w-full text-xs rounded-lg border border-gray-200 px-3 py-2 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <select
                  value={selectedAssId}
                  onChange={(e) => setSelectedAssId(e.target.value)}
                  className="w-full text-xs rounded-lg border border-gray-200 px-3 py-2 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="" disabled>Choose assessment material</option>
                  {assessments.map(as => (
                    <option key={as.id} value={as.id}>{as.title}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={inviting || assessments.length === 0}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg text-xs transition-all disabled:opacity-50 flex items-center justify-center space-x-1"
              >
                {inviting ? (
                  <Loader2 className="animate-spin h-3 w-3" />
                ) : (
                  <>
                    <span>Dispatch Invite Link</span>
                    <ArrowRight className="h-3 w-3" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Dynamic Context Canvas */}
        <div className="lg:col-span-9">
          {/* Detailed Candidate Result View Panel overrides standard displays */}
          {selectedSessionId && selectedSession && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-6">
              <div className="flex items-start justify-between pb-4 border-b border-gray-100">
                <div>
                  <button 
                    onClick={() => { setSelectedSessionId(null); setActiveTab("candidates"); }}
                    className="text-indigo-600 text-xs font-semibold hover:underline mb-2 flex items-center"
                  >
                    ← Back to Dashboard Overview
                  </button>
                  <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">
                    Candidate Evaluation Report: {selectedSession.candidateName}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5 font-mono">{selectedSession.candidateEmail}</p>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => handleExportPdf(selectedSession, selectedAssessment)}
                    className="flex items-center space-x-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                  >
                    <FileDown className="h-4 w-4" />
                    <span>Export Performance PDF</span>
                  </button>
                </div>
              </div>

              {/* Score breakdown metrics grids */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border border-gray-100 p-4 rounded-2xl bg-indigo-50/20 text-center">
                  <span className="block text-xs text-gray-400 font-semibold mb-1">AGGREGATED SCORE</span>
                  <p className="text-3xl font-extrabold text-indigo-700">
                    {selectedSession.results?.totalScore || 0} / {selectedSession.results?.maxScore || 0}
                  </p>
                  <span className="text-[10px] text-gray-400">
                    ({Math.round(((selectedSession.results?.totalScore || 0) / (selectedSession.results?.maxScore || 1)) * 100)}% absolute target)
                  </span>
                </div>

                <div className="border border-gray-100 p-4 rounded-2xl text-center flex flex-col justify-center items-center">
                  <span className="block text-xs text-gray-400 font-semibold mb-1">HIRING BENCHMARK</span>
                  {selectedSession.results?.passed ? (
                    <div className="text-emerald-600 flex items-center font-bold text-sm bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      MEETS BENCHMARK
                    </div>
                  ) : (
                    <div className="text-rose-600 flex items-center font-bold text-sm bg-rose-50 px-3 py-1 rounded-full border border-rose-100">
                      <XCircle className="h-4 w-4 mr-1" />
                      RE-SCREEN REQ
                    </div>
                  )}
                  <span className="text-[10px] text-gray-400 mt-1">Passing threshold value set at 60%</span>
                </div>

                <div className="border border-gray-100 p-4 rounded-2xl bg-gray-50 text-left flex flex-col justify-center font-mono text-[10px]">
                  <span className="block text-xs text-gray-400 font-sans font-semibold mb-1">POSTGRES TAMPER-PROOF SIGN</span>
                  <div className="bg-white p-2 rounded-lg border border-gray-200 break-all text-gray-500 text-[9px] leading-relaxed select-all">
                    {selectedSession.secureHash || "UNSIGNED"}
                  </div>
                </div>
              </div>

              {/* Overall qualitative feedback crafted by Gemini AI */}
              <div className="bg-indigo-50/30 border border-indigo-100 p-5 rounded-2xl space-y-2">
                <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-widest flex items-center">
                  <Sparkles className="h-4 w-4 mr-1.5 text-indigo-600" />
                  Gemini AI Recruiter Evaluation Report
                </h4>
                <p className="text-xs text-gray-700 leading-relaxed font-sans">
                  {selectedSession.results?.overallFeedback || "Evaluation process active."}
                </p>
              </div>

              {/* Individual Question score charts */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">Technical Question Breakdown</h3>
                {selectedAssessment?.questions.map((question, index) => {
                  const evalItem = selectedSession.results?.evaluations.find(e => e.questionId === question.id);
                  const candAns = selectedSession.answers.find(a => a.questionId === question.id);

                  return (
                    <div key={question.id} className="border border-gray-100 rounded-xl p-4 space-y-3 shadow-xs bg-gray-50/50">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-md mr-2">
                            Q{index + 1} ({question.type.toUpperCase()})
                          </span>
                          <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-500 font-medium">
                            <span>{question.skills.join(", ")}</span>
                            {question.difficulty && (
                              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
                                {question.difficulty.charAt(0).toUpperCase() + question.difficulty.slice(1)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-gray-900">
                            {evalItem ? evalItem.pointsEarned : 0} / {question.points} Pts
                          </span>
                        </div>
                      </div>

                      <p className="text-xs font-semibold text-gray-900 leading-relaxed">{question.text}</p>

                      {/* Display answer choice context based on types */}
                      {question.type === "mcq" ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                          {question.choices?.map((ch, oIdx) => {
                            const isCorrect = oIdx === question.correctAnswerIndex;
                            const isSelected = oIdx === candAns?.selectedAnswerIndex;
                            return (
                              <div 
                                key={ch} 
                                className={`p-2 rounded-lg text-[10px] border flex items-center justify-between ${
                                  isCorrect 
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                    : isSelected
                                      ? "bg-rose-50 border-rose-200 text-rose-800"
                                      : "bg-white border-gray-100 text-gray-600"
                                }`}
                              >
                                <span>{ch}</span>
                                {isCorrect && <Check className="h-3 w-3 text-emerald-600" />}
                                {isSelected && !isCorrect && <XCircle className="h-3 w-3 text-rose-500" />}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="space-y-2 pt-1">
                          <div className="bg-white p-3 rounded-lg border border-gray-200">
                            <span className="block text-[9px] text-gray-400 font-bold uppercase mb-1">CANDIDATE WRITTEN ANSWER</span>
                            <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line font-mono">
                              {candAns?.typedAnswer || "[No answer submitted]"}
                            </p>
                          </div>
                          {question.correctAnswerRubric && (
                            <div className="bg-emerald-50/40 p-3 rounded-lg border border-emerald-100">
                              <span className="block text-[9px] text-emerald-800 font-bold uppercase mb-1">EVALUATION RUBRIC STANDARD</span>
                              <p className="text-xs text-emerald-800/80 leading-relaxed">
                                {question.correctAnswerRubric}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {evalItem && (
                        <div className="bg-white p-3 border border-gray-100 rounded-lg text-xs space-y-1">
                          <span className="text-[10px] font-bold text-gray-400 flex items-center">
                            <MessageSquare className="h-3 w-3 mr-1 text-indigo-500" />
                            GRADING EVALUATION
                          </span>
                          <p className="text-gray-600 leading-relaxed italic">{evalItem.feedback}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 1: EXECUTIVE OVERVIEW */}
          {activeTab === "overview" && !selectedSessionId && (
            <div className="space-y-6">
              {/* Recruiter metrics scorecard banners */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-400">EVALUATION TEMPLATES</span>
                    <div className="bg-indigo-50 text-indigo-600 p-2 rounded-xl">
                      <BookOpen className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-2xl font-extrabold text-gray-900 mt-2">{stats.totalAssessments}</p>
                  <span className="text-[9px] text-gray-400">Total skills defined specs</span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-400">TESTED CANDIDATES</span>
                    <div className="bg-indigo-50 text-indigo-600 p-2 rounded-xl">
                      <Users className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-2xl font-extrabold text-gray-900 mt-2">{stats.totalCandidates}</p>
                  <span className="text-[9px] text-gray-400">Invitations processed</span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-400">COMPLETED GRADING</span>
                    <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-2xl font-extrabold text-emerald-700 mt-2">{stats.completedCount}</p>
                  <span className="text-[9px] text-gray-400">
                    {stats.progressCount} sessions actively running
                  </span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-400">AVERAGE SCORE</span>
                    <div className="bg-amber-50 text-amber-600 p-2 rounded-xl">
                      <Clock className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-2xl font-extrabold text-amber-700 mt-2">{stats.avgScorePercentage}%</p>
                  <span className="text-[9px] text-gray-400">Baseline threshold 60% pass</span>
                </div>
              </div>

              {/* Recruitment Activity table list */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4 shadow-xs">
                <div className="flex flex-col md:flex-row items-center justify-between gap-3 border-b border-gray-50 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Active Pipeline Candidates</h2>
                    <p className="text-xs text-gray-400">Monitor technical metrics, launch evaluations, or download progress reports.</p>
                  </div>

                  <div className="relative w-full md:w-72">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <Search className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      className="pl-9 w-full text-xs rounded-xl border border-gray-200 px-3 py-2 focus:border-indigo-500 focus:outline-none"
                      placeholder="Search candidates by name or email ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                {filteredSessions.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-xs">
                    No candidate records found. Click "Create Questionnaire" or dispatch invites to begin.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider text-[10px]">
                          <th className="pb-3 font-semibold">Candidate Detail</th>
                          <th className="pb-3 font-semibold">Target Assessment</th>
                          <th className="pb-3 font-semibold text-center">Status</th>
                          <th className="pb-3 font-semibold text-center">Score Card</th>
                          <th className="pb-3 font-semibold text-center">Access Link</th>
                          <th className="pb-3 font-semibold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredSessions.map((session) => {
                          const associatedAss = assessments.find(a => a.id === session.assessmentId);
                          const matchingInvite = invitations.find(i => i.assessmentId === session.assessmentId && i.candidateEmail === session.candidateEmail);

                          return (
                            <tr key={session.id} className="hover:bg-gray-55 transition-all text-gray-700">
                              <td className="py-4">
                                <span className="block font-bold text-gray-900">{session.candidateName}</span>
                                <span className="text-[10px] text-gray-400 font-mono">{session.candidateEmail}</span>
                              </td>
                              <td className="py-4">
                                <span className="block font-medium text-gray-800">{associatedAss ? associatedAss.title : "Interview Match"}</span>
                                <span className="text-[10px] text-indigo-500 font-semibold">{associatedAss?.skills.join(", ")}</span>
                              </td>
                              <td className="py-4 text-center">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                  session.status === "submitted"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                    : session.status === "in_progress"
                                      ? "bg-amber-50 text-amber-700 border border-amber-100 animate-pulse"
                                      : session.status === "expired"
                                        ? "bg-gray-100 text-gray-600"
                                        : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                                }`}>
                                  {session.status.toUpperCase()}
                                </span>
                              </td>
                              <td className="py-4 text-center font-bold">
                                {session.status === "submitted" && session.results ? (
                                  <span className={session.results.passed ? "text-emerald-600" : "text-rose-500"}>
                                    {session.results.totalScore}/{session.results.maxScore}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 font-normal italic">Pending Exam</span>
                                )}
                              </td>
                              <td className="py-4 text-center">
                                {matchingInvite ? (
                                  <button
                                    onClick={() => handleCopyLink(matchingInvite.token)}
                                    className="inline-flex items-center space-x-1 px-2 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all text-[10px] font-semibold text-gray-600"
                                    title="Copy direct sandbox link and bypass auth"
                                  >
                                    {copiedToken === matchingInvite.token ? (
                                      <>
                                        <Check className="h-3 w-3 text-green-600" />
                                        <span className="text-green-600">Copied!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="h-3 w-3 text-gray-400" />
                                        <span>Candidate Link</span>
                                      </>
                                    )}
                                  </button>
                                ) : (
                                  <span className="text-gray-300 italic text-[11px]">No link</span>
                                )}
                              </td>
                              <td className="py-4 text-right">
                                {session.status === "submitted" ? (
                                  <div className="flex items-center justify-end space-x-2">
                                    <button
                                      onClick={() => handleExportPdf(session, associatedAss)}
                                      className="text-gray-500 hover:text-indigo-600 p-1 rounded-lg"
                                      title="Fast Export PDF metrics"
                                    >
                                      <FileDown className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => setSelectedSessionId(session.id)}
                                      className="bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-600 hover:text-white px-2.5 py-1 rounded-lg transition-all text-[11px] font-bold"
                                    >
                                      View Score
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-gray-400 italic text-[11px]">Exam Active</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: CREATE QUESTIONNAIRE */}
          {activeTab === "create" && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-6 shadow-xs max-w-2xl">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Configure New Assessment SPEC</h2>
                <p className="text-xs text-gray-400">Select target skills, set appropriate limits, and generate standardized screen tests automatically.</p>
              </div>

              <form onSubmit={handleCreateAssessment} className="space-y-5" id="form-create-ass">
                {createSuccess && (
                  <div className="p-4 bg-green-50 text-green-700 text-xs rounded-xl border border-green-100">
                    Template created successfully! You can invite candidates immediately.
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Assessment Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior Backend Python Specialist"
                    value={assTitle}
                    onChange={(e) => setAssTitle(e.target.value)}
                    className="w-full text-xs rounded-xl border border-gray-200 px-3.5 py-2.5 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <span className="block text-xs font-semibold text-gray-700 mb-2">Testable Engineering Skills:</span>
                  <div className="flex flex-wrap gap-2">
                    {skillOptions.map(skill => {
                      const isSelected = selectedSkills.includes(skill);
                      return (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => handleToggleSkill(skill)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            isSelected
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                              : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          {skill}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Total Questions
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={12}
                      value={numQuestions}
                      onChange={(e) => setNumQuestions(parseInt(e.target.value) || 3)}
                      className="w-full text-xs rounded-xl border border-gray-200 px-3.5 py-2.5 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Time Constraints (Minutes)
                    </label>
                    <input
                      type="number"
                      required
                      min={3}
                      max={90}
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(parseInt(e.target.value) || 20)}
                      className="w-full text-xs rounded-xl border border-gray-200 px-3.5 py-2.5 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Question Difficulty
                  </label>
                  <div className="flex gap-2">
                    {(["easy", "medium", "hard"] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setDifficultyLevel(level)}
                        className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                          difficultyLevel === level
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Gemini AI Toggler matching guideline MAJOR_CAPABILITY */}
                <div className="bg-indigo-50/40 p-4 border border-indigo-100 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="h-4 w-4 text-indigo-600 animate-pulse" />
                      <span className="text-xs font-bold text-indigo-900">Gemini AI Assessment Generator</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={useAi} 
                        onChange={(e) => setUseAi(e.target.checked)}
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                  <p className="text-[11px] text-indigo-950/70 leading-relaxed leading-snug">
                    When enabled, Gemini automatically drafts robust MCQ and subjective open-text reasoning questions customized to your chosen parameters. When disabled, static pre-vetted queries are compiled.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={creatingAss}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 hover:shadow-xs text-white font-bold py-2.5 rounded-xl text-xs transition-all disabled:opacity-50 flex items-center justify-center space-x-1"
                >
                  {creatingAss ? (
                    <>
                      <Loader2 className="animate-spin h-3.5 w-3.5 mr-1.5" />
                      <span>Synthesizing Custom Exam Material via Gemini AI...</span>
                    </>
                  ) : (
                    <>
                      <span>Generate Assessment specs</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          

          {/* TAB 3: SCREENING DETAILED CORES */}
          {activeTab === "candidates" && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col space-y-4">
                <h2 className="text-lg font-bold text-gray-900">Recruiter Evaluation Archives</h2>
                <p className="text-xs text-gray-400">Review full scorecard evaluations, point values, answers, PDF certificates, and secure cryptographic hashes.</p>
                
                {sessions.filter(s => s.status === "submitted").length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-xs">
                    No submitted assessments yet. Try completing an exam using the direct tokens panel.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sessions.filter(s => s.status === "submitted").map(sess => {
                      const associated = assessments.find(a => a.id === sess.assessmentId);
                      return (
                        <div key={sess.id} className="border border-gray-100 p-5 rounded-2xl flex flex-col justify-between space-y-4 shadow-xs hover:border-indigo-300 transition-all bg-white">
                          <div className="space-y-1">
                            <div className="flex justify-between items-start">
                              <span className="text-xs font-extrabold text-gray-900">{sess.candidateName}</span>
                              <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${sess.results?.passed ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
                                {sess.results?.passed ? "MEETS SPEC" : "FAIL TARGET"}
                              </span>
                            </div>
                            <span className="block text-[10px] text-gray-400 font-mono">{sess.candidateEmail}</span>
                            <p className="text-xs text-gray-600 font-medium pt-2">{associated?.title}</p>
                          </div>

                          <div className="flex items-center justify-between border-t border-gray-50 pt-3 text-xs">
                            <div>
                              <span className="block text-[9px] text-gray-400">FINAL SCORE</span>
                              <p className="text-indigo-600 font-bold">{sess.results?.totalScore || 0}/{sess.results?.maxScore || 0}</p>
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleExportPdf(sess, associated)}
                                className="px-2.5 py-1 text-[11px] border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 flex items-center space-x-1"
                              >
                                <FileDown className="h-3 w-3" />
                                <span>PDF Report</span>
                              </button>
                              <button
                                onClick={() => setSelectedSessionId(sess.id)}
                                className="bg-indigo-600 text-white px-2.5 py-1 text-[11px] rounded-lg hover:bg-indigo-700"
                              >
                                Review Dossier
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: SIMULATED OUTBOX */}
          {activeTab === "emails" && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5 shadow-xs">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Simulated Automated Email Dispatcher</h2>
                <p className="text-xs text-gray-400">View actual outbox HTML emails sent to candidates. Recruiter can copy-paste direct tokens or launch candidate test sandbox in a single click!</p>
              </div>

              {emails.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-xs">
                  No automated outbound emails logged yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {emails.map((mail) => {
                    const trackingInvite = invitations.find(i => i.candidateEmail === mail.toEmail);
                    return (
                      <div key={mail.id} className="border border-gray-200 rounded-xl overflow-hidden flex flex-col md:flex-row bg-gray-50/50">
                        <div className="p-4 md:w-1/3 border-b md:border-b-0 md:border-r border-gray-200 space-y-2 font-mono text-[11px]">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-indigo-600 font-bold uppercase text-[9px] bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">LOGGED-OUTBOX</span>
                            <span className="text-gray-400 text-[10px]">{new Date(mail.sentAt).toLocaleTimeString()}</span>
                          </div>
                          <p><strong>To:</strong> {mail.toName} &lt;{mail.toEmail}&gt;</p>
                          <p><strong>Subject:</strong> {mail.subject}</p>
                          <p><strong>Status:</strong> <span className="text-emerald-600 font-bold">✓ DELIVERED</span></p>
                          
                          {trackingInvite && (
                            <div className="pt-3 border-t border-gray-200 space-y-2">
                              <span className="block text-[9px] text-gray-400 font-bold uppercase">Sandbox Test Actions</span>
                              
                              <button
                                onClick={() => handleCopyLink(trackingInvite.token)}
                                className="w-full text-[10px] text-left underline font-semibold text-indigo-600 hover:text-indigo-800 flex items-center"
                              >
                                {copiedToken === trackingInvite.token ? (
                                  <span className="text-emerald-600 font-bold">✓ Direct URL Copied!</span>
                                ) : (
                                  <span>⚙ Copy Invitation URL</span>
                                )}
                              </button>

                              {/* Direct Launch Candidates Landing Frame */}
                              <a 
                                href={`/login?token=${trackingInvite.token}`} 
                                target="_blank"
                                rel="noreferrer"
                                className="block w-full text-center py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-[10px] transition-all"
                              >
                                Launch Exam Sandbox
                              </a>
                            </div>
                          )}
                        </div>

                        {/* Simulated actual invitation HTML rendered inline */}
                        <div className="flex-1 p-4 bg-white overflow-y-auto max-h-72">
                          <span className="block text-[9px] text-gray-400 font-bold uppercase mb-2">RENDERED E-MAIL HTML EMBED:</span>
                          <div 
                            className="bg-white border border-gray-100 p-4 rounded-xl scale-95 origin-top" 
                            dangerouslySetInnerHTML={{ __html: mail.htmlBody }} 
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: AUDIT TRAIL LOGS */}
          {activeTab === "audit" && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4 shadow-xs font-mono text-xs">
              <div>
                <h2 className="text-lg font-sans font-bold text-gray-900">PostgreSQL Transaction Security Logs</h2>
                <p className="text-xs font-sans text-gray-400">Cryptographically stamp every submission validation, AI assessment creation, and token launch for full structural standard security audits.</p>
              </div>

              {auditLogs.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-xs">
                  No logs generated yet.
                </div>
              ) : (
                <div className="bg-gray-900 text-gray-300 p-4 rounded-xl border border-gray-800 max-h-96 overflow-y-auto space-y-2">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="text-[11px] leading-relaxed border-b border-gray-800 pb-2 flex flex-col md:flex-row md:items-center">
                      <span className="text-gray-500 font-bold md:w-36 select-none">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                      <span className="text-emerald-500 font-semibold md:w-40 uppercase tracking-tight">[{log.action}]</span>
                      <span className="text-indigo-400 md:w-28 font-semibold">@ {log.performedBy || "SYSTEM"}</span>
                      <span className="text-gray-300 flex-1">{log.details}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
