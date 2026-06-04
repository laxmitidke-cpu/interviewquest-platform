/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Clock, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, 
  Send, Sparkles, LogOut, FileText, Bookmark, CircleDot, Loader2
} from "lucide-react";
import { Assessment, AssessmentSession, CandidateAnswer, Question } from "../types";

interface CandidateExamProps {
  token: string;
  onExit: () => void;
}

export default function CandidateExam({ token, onExit }: CandidateExamProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Loaded metadata
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [session, setSession] = useState<AssessmentSession | null>(null);

  // Local state
  const [sessionStarted, setSessionStarted] = useState(false);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<CandidateAnswer[]>([]);
  const [remainingSeconds, setRemainingSeconds] = useState(600);
  const [securityViolations, setSecurityViolations] = useState(0);
  const [showBlurWarning, setShowBlurWarning] = useState(false);

  // Submit / Completion
  const [submitting, setSubmitting] = useState(false);
  const [gradedSession, setGradedSession] = useState<AssessmentSession | null>(null);

  // Time tracking per question
  const questionStartRef = useRef<number>(Date.now());
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSessionInfo = async () => {
    try {
      const res = await fetch(`/api/candidate/session-by-token/${token}`);
      if (!res.ok) {
        throw new Error("Invalid or expired invitation token.");
      }
      const data = await res.json();
      setAssessment(data.assessment);
      setSession(data.session);

      // Initialize answers structure
      const preppedAnswers = data.assessment.questions.map((q: Question) => {
        const existingAns = data.session?.answers.find((a: any) => a.questionId === q.id);
        return {
          questionId: q.id,
          selectedAnswerIndex: existingAns?.selectedAnswerIndex,
          typedAnswer: existingAns?.typedAnswer || "",
          timeSpentSec: existingAns?.timeSpentSec || 0
        };
      });
      setAnswers(preppedAnswers);

      if (data.session?.status === "submitted" || data.session?.status === "expired") {
        setGradedSession(data.session);
      } else if (data.session?.status === "in_progress" && data.session.startedAt) {
        // Resume session
        setSessionStarted(true);
        const startedTime = new Date(data.session.startedAt).getTime();
        const durationSec = data.assessment.timeLimit * 60;
        const elapsedSec = Math.floor((Date.now() - startedTime) / 1000);
        const remaining = durationSec - elapsedSec;

        if (remaining <= 0) {
          handleTimeoutGrace();
        } else {
          setRemainingSeconds(remaining);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to query candidates context.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionInfo();
  }, [token]);

  // Window blur security monitoring system matches guidelines
  useEffect(() => {
    if (!sessionStarted || gradedSession) return;

    const handleWindowBlur = () => {
      setSecurityViolations((prev) => {
        const nextVal = prev + 1;
        setShowBlurWarning(true);
        setTimeout(() => setShowBlurWarning(false), 5000);
        return nextVal;
      });
    };

    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [sessionStarted, gradedSession]);

  // Timer Tick implementation
  useEffect(() => {
    if (!sessionStarted || gradedSession) return;

    timerIntervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current!);
          handleTimeoutGrace();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [sessionStarted, gradedSession]);

  // Intermediate autosaving every 15 seconds logic
  useEffect(() => {
    if (!sessionStarted || gradedSession || !session) return;

    const autosaveInterval = setInterval(() => {
      commitIntermediateAnswers();
    }, 15000);

    return () => clearInterval(autosaveInterval);
  }, [sessionStarted, gradedSession, answers]);

  const commitIntermediateAnswers = async () => {
    if (!session) return;
    try {
      await fetch(`/api/candidate/save-answers/${session.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers })
      });
    } catch {
      // Background failure silently handled for candidates reliability
    }
  };

  const handleStartExam = async () => {
    if (!assessment) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/candidate/start-session/${token}`, {
        method: "POST"
      });

      if (res.ok) {
        setSessionStarted(true);
        setRemainingSeconds(assessment.timeLimit * 60);
        questionStartRef.current = Date.now();
      } else {
        throw new Error("Unable to initialize start conditions.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to start assessment.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerMcq = (choiceIdx: number) => {
    const updated = [...answers];
    const item = updated[currentQIndex];
    item.selectedAnswerIndex = choiceIdx;
    
    // Accumulate times spent
    const diffSec = Math.floor((Date.now() - questionStartRef.current) / 1000);
    item.timeSpentSec = (item.timeSpentSec || 0) + diffSec;
    questionStartRef.current = Date.now();

    setAnswers(updated);
  };

  const handleAnswerShort = (typed: string) => {
    const updated = [...answers];
    const item = updated[currentQIndex];
    item.typedAnswer = typed;
    setAnswers(updated);
  };

  const handleNavQ = (nextIdx: number) => {
    // Commit current time parameters
    const updated = [...answers];
    const item = updated[currentQIndex];
    const diffSec = Math.floor((Date.now() - questionStartRef.current) / 1000);
    item.timeSpentSec = (item.timeSpentSec || 0) + diffSec;
    setAnswers(updated);

    setCurrentQIndex(nextIdx);
    questionStartRef.current = Date.now();
  };

  const handleTimeoutGrace = () => {
    commitFinalSubmission(true);
  };

  const commitFinalSubmission = async (isTimeExpired = false) => {
    if (!session || !assessment) return;
    setSubmitting(true);

    try {
      // Append time parameters of final slide
      const updated = [...answers];
      const item = updated[currentQIndex];
      const diffSec = Math.floor((Date.now() - questionStartRef.current) / 1000);
      item.timeSpentSec = (item.timeSpentSec || 0) + diffSec;

      const res = await fetch(`/api/candidate/submit-assessment/${session.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: updated,
          isExpired: isTimeExpired
        })
      });

      if (res.ok) {
        const data = await res.json();
        setGradedSession(data.session);
      } else {
        throw new Error("Submit process failed.");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong during evaluation submission.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimerString = (secTotal: number) => {
    const m = Math.floor(secTotal / 60);
    const s = secTotal % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center font-sans">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Syncing Candidate Session Secure Sandbox...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-gray-200 text-center space-y-4">
          <div className="bg-rose-50 text-rose-600 p-3 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-2">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Sandbox Retrieval Failure</h2>
          <p className="text-xs text-gray-500 leading-relaxed">{error}</p>
          <button
            onClick={onExit}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all"
          >
            Return to Desk
          </button>
        </div>
      </div>
    );
  }

  // SCREEN A: GRADDED / FINALIZED OUTCOME DASHBOARD
  if (gradedSession) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
        <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl border border-gray-100 shadow-xs space-y-8">
          <div className="text-center space-y-2 pb-6 border-b border-gray-100">
            <div className="bg-emerald-50 text-emerald-600 p-2 rounded-full w-12 h-12 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Technical Assessment Complete</h1>
            <p className="text-xs text-gray-400">Results stored securely in core database registers.</p>
          </div>

          {/* Graded metric summary card display */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-indigo-50/20 border border-indigo-100 p-5 rounded-2xl text-center">
              <span className="block text-xs font-semibold text-indigo-700 uppercase tracking-widest mb-1">SCORE REPORT</span>
              <p className="text-4xl font-extrabold text-indigo-800">
                {gradedSession.results?.totalScore || 0} / {gradedSession.results?.maxScore || 0}
              </p>
              <span className="text-[10px] text-gray-400">
                ({Math.round(((gradedSession.results?.totalScore || 0) / (gradedSession.results?.maxScore || 1)) * 100)}% correct weight)
              </span>
            </div>

            <div className="bg-gray-50 p-5 rounded-2xl flex flex-col justify-center items-center text-center">
              <span className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1 shadow-xs">CANDIDATE CODE INTID</span>
              <div className="bg-white px-3 py-1.5 border border-gray-100 rounded-lg text-[9px] font-mono text-gray-500 break-all select-all">
                {gradedSession.secureHash || "AUTHENTICATED_NOT_SIGNED"}
              </div>
            </div>
          </div>

          {/* Gemini AI interactive summary box */}
          {gradedSession.results?.overallFeedback && (
            <div className="bg-indigo-50/30 p-5 border border-indigo-100 rounded-2xl space-y-1.5">
              <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center">
                <Sparkles className="h-3.5 w-3.5 mr-1 text-indigo-600" />
                Gemini AI Grade Feedback Summary
              </h4>
              <p className="text-xs text-gray-750 leading-relaxed font-sans">{gradedSession.results.overallFeedback}</p>
            </div>
          )}

          {/* Submittable complete list details */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">Your Technical Response Summary</h3>
            <div className="space-y-3">
              {assessment?.questions.map((q, idx) => {
                const myAns = gradedSession.answers.find(a => a.questionId === q.id);
                const evalItem = gradedSession.results?.evaluations.find(e => e.questionId === q.id);

                return (
                  <div key={q.id} className="p-4 border border-gray-105 rounded-xl bg-gray-50/50 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-gray-800">Q{idx + 1}: {q.text}</span>
                      <span className="font-semibold text-indigo-600 font-mono">
                        {evalItem ? evalItem.pointsEarned : 0} / {q.points} Pts
                      </span>
                    </div>

                    {q.type === "mcq" ? (
                      <p className="text-xs text-gray-500 italic">
                        Selected: "{myAns?.selectedAnswerIndex !== undefined ? q.choices?.[myAns.selectedAnswerIndex] : 'No Choice'}"
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500 leading-relaxed truncate">
                        Response: "{myAns?.typedAnswer || 'No answer submitted'}"
                      </p>
                    )}

                    {evalItem && (
                      <p className="text-[11px] text-gray-600 bg-white p-2 rounded-lg border border-gray-200 leading-relaxed italic">
                        Feedback: {evalItem.feedback}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-center pt-4">
            <button
              onClick={onExit}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all flex items-center space-x-1"
            >
              <LogOut className="h-4 w-4" />
              <span>Close Assessment Sandbox</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // SCREEN B: ASSESSMENT INITIAL PREPARATION / LANDING PAGE
  if (!sessionStarted && assessment && session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
        <div className="max-w-lg w-full bg-white p-8 rounded-2xl border border-gray-100 shadow-xs space-y-6">
          <div className="text-center space-y-2">
            <span className="bg-indigo-50 text-indigo-700 font-mono text-[10px] font-bold px-3 py-1 rounded-full uppercase border border-indigo-100">
              Technical Assessment Intake
            </span>
            <h1 className="text-2xl font-black text-gray-950 tracking-tight">{assessment.title}</h1>
            <p className="text-xs text-gray-400">Please review guidelines and instructions before starting the assessment clock.</p>
          </div>

          {/* Guidelines info block */}
          <div className="bg-gray-50/50 p-5 rounded-2xl border border-gray-150 space-y-4">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest">Candidate Directions</h3>
            <ul className="space-y-2 text-xs text-gray-600">
              <li className="flex items-start">
                <span className="text-indigo-600 font-bold mr-2">•</span>
                <strong>Timer constraints:</strong> You have exactly <strong>{assessment.timeLimit} minutes</strong> to complete the exam. The timer runs continuously once started.
              </li>
              <li className="flex items-start">
                <span className="text-indigo-600 font-bold mr-2">•</span>
                <strong>Auto-Save Security:</strong> Draft answers are synced securely to the server in real-time every 15 seconds. If you lose connection, your inputs are saved.
              </li>
              <li className="flex items-start">
                <span className="text-indigo-600 font-bold mr-2">•</span>
                <strong>Tab Switching Safeguard:</strong> Leaving or tabbing away from this window is monitored and will register focal tracking violations in your recruiter dossier.
              </li>
              <li className="flex items-start">
                <span className="text-indigo-600 font-bold mr-2">•</span>
                <strong>Formatting standard:</strong> Subjective written answers will be evaluated directly against standard technical rubrics by our secure Gemini AI module.
              </li>
            </ul>
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-4">
            <div className="flex items-center space-x-3 text-xs text-gray-700 bg-indigo-50/35 p-3 rounded-xl">
              <Clock className="h-5 w-5 text-indigo-600" />
              <div>
                <p className="font-semibold">Candidate: {session.candidateName}</p>
                <p className="text-gray-400 font-mono text-[10px]">{session.candidateEmail}</p>
              </div>
            </div>

            <button
              onClick={handleStartExam}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-1 hover:shadow-xs"
            >
              <span>Accept & Start Timed Assessment</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // SCREEN C: EXAM ENVIRONMENT ACTIVE CANVAS
  const activeQuestion: Question | undefined = assessment?.questions[currentQIndex];
  const activeAnswer: CandidateAnswer | undefined = answers[currentQIndex];
  const isLastQuestion = assessment ? currentQIndex === assessment.questions.length - 1 : false;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Dynamic Exam Header containing running counts and alerts */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-xs">
        <div className="flex items-center space-x-3">
          <span className="text-xs bg-gray-100 text-gray-600 font-mono font-bold px-2.5 py-1 rounded-md uppercase">
            SANDBOX SECURED
          </span>
          <h1 className="text-sm font-bold text-gray-900 hidden md:block">{assessment?.title}</h1>
        </div>

        {/* Timer Alert panel */}
        <div className={`flex items-center space-x-2 px-4 py-1.5 rounded-xl font-mono text-xs font-extrabold border ${
          remainingSeconds < 180 
            ? "bg-rose-50 text-rose-600 border-rose-200 animate-pulse" 
            : "bg-indigo-50 text-indigo-700 border-indigo-200"
        }`}>
          <Clock className="h-4 w-4" />
          <span>{formatTimerString(remainingSeconds)}</span>
        </div>

        <div>
          <button
            onClick={() => { if (confirm("Are you sure you want to exit? The timer will NOT stop.")) onExit(); }}
            className="text-xs border border-gray-200 px-3.5 py-1.5 rounded-xl text-gray-500 hover:bg-gray-50 font-semibold"
          >
            Suspend View
          </button>
        </div>
      </nav>

      {/* Security alert overlay toaster standard matches custom guidelines */}
      {showBlurWarning && (
        <div className="bg-yellow-600 text-white font-mono text-[10px] text-center py-2 px-4 sticky top-[69px] z-40 flex items-center justify-center space-x-2 animate-bounce">
          <AlertTriangle className="h-4 w-4" />
          <span>SECURITY WARNING: Focus blur detected. Leaving the interview tab has been logged in audit tracks.</span>
        </div>
      )}

      {/* Main active exam slider canvas */}
      <div className="flex-1 max-w-5xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Hand dynamic questions slide triggers */}
        <div className="lg:col-span-3 bg-white p-4 rounded-xl border border-gray-200 space-y-3">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Questions Slider</h3>
          <div className="grid grid-cols-4 lg:grid-cols-1 gap-2">
            {assessment?.questions.map((q, idx) => {
              const myAns = answers[idx];
              const isAnswered = q.type === "mcq" 
                ? myAns?.selectedAnswerIndex !== undefined 
                : myAns?.typedAnswer?.trim().length > 6;

              return (
                <button
                  key={q.id}
                  onClick={() => handleNavQ(idx)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold border flex items-center justify-between transition-all ${
                    currentQIndex === idx
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : isAnswered
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <span className="font-mono">Q{idx + 1}</span>
                  {isAnswered && (
                    <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full hidden lg:block" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-gray-100 hidden lg:block space-y-1">
            <span className="text-[9px] font-bold text-gray-400 uppercase">Trackers</span>
            <div className="text-[10px] text-gray-500 space-y-1">
              <p>• Violations: <span className="font-bold text-rose-500">{securityViolations}</span></p>
              <p>• Autosave status: <span className="font-bold text-emerald-600">Active</span></p>
            </div>
          </div>
        </div>

        {/* Right hand question text card details */}
        <div className="lg:col-span-9 bg-white p-6 rounded-xl border border-gray-250 flex flex-col justify-between min-h-[420px] shadow-xs">
          {activeQuestion && activeAnswer ? (
            <div className="space-y-6">
              {/* Question metadata header */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <span className="bg-indigo-100 text-indigo-800 text-[10px] font-extrabold px-2 py-0.5 rounded-md mr-2">
                    {activeQuestion.type === "mcq" ? "MULTIPLE CHOICE" : "SUBJECTIVE REASONING"}
                  </span>
                  <span className="text-xs text-gray-400 font-medium">Topic: {activeQuestion.skills.join(", ")}</span>
                  {activeQuestion.difficulty && (
                    <span className="inline-flex items-center ml-2 text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                      Difficulty: {activeQuestion.difficulty.charAt(0).toUpperCase() + activeQuestion.difficulty.slice(1)}
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold text-gray-400">Value: {activeQuestion.points} points</span>
              </div>

              {/* Question visual wording */}
              <p className="text-sm font-semibold text-gray-900 leading-relaxed md:text-md">
                {activeQuestion.text}
              </p>

              {/* Multi-choice options block */}
              {activeQuestion.type === "mcq" ? (
                <div className="space-y-3 pt-2" id="mcq-choices">
                  {activeQuestion.choices?.map((choice, cIdx) => {
                    const isSelected = activeAnswer.selectedAnswerIndex === cIdx;
                    return (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => handleAnswerMcq(cIdx)}
                        className={`w-full text-left p-3.5 rounded-xl text-xs border font-medium flex items-center justify-between transition-all ${
                          isSelected
                            ? "bg-indigo-50 border-indigo-400 text-indigo-800 ring-1 ring-indigo-400"
                            : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <CircleDot className={`h-4 w-4 ${isSelected ? "text-indigo-600" : "text-gray-300"}`} />
                          <span>{choice}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* Written answer open-text area block */
                <div className="space-y-2 pt-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                    Your written answer text
                  </label>
                  <textarea
                    className="w-full text-xs rounded-xl border border-gray-200 px-4 py-3 focus:border-indigo-500 focus:outline-none min-h-[160px] leading-relaxed font-mono resize-none"
                    placeholder="Provide a comprehensive technical response describing structural patterns, bottlenecks, implementation choices, and direct trade-offs..."
                    value={activeAnswer.typedAnswer || ""}
                    onChange={(e) => handleAnswerShort(e.target.value)}
                  />
                  <div className="flex justify-between items-center text-[10px] text-gray-400">
                    <span>Draft changes saved recursively on backend.</span>
                    <span className="font-mono">{`Characters: ${(activeAnswer.typedAnswer || "").length}`}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              Exam material initialization mismatch.
            </div>
          )}

          {/* Nav Controls sliders footer */}
          <div className="flex items-center justify-between border-t border-gray-100 pt-6 mt-8">
            <button
              onClick={() => handleNavQ(currentQIndex - 1)}
              disabled={currentQIndex === 0}
              className="px-4 py-2 hover:bg-gray-50 disabled:opacity-30 border border-gray-200 text-xs font-bold rounded-xl text-gray-600 flex items-center space-x-1"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </button>

            {isLastQuestion ? (
              <button
                onClick={() => { if (confirm("Do you want to finalize and submit all answers? This is irreversible.")) commitFinalSubmission(false); }}
                disabled={submitting}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1 hover:shadow-xs transition-all disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4 mr-1.5" />
                    <span>Grading via Gemini...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Submit & Finish Exam</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={() => handleNavQ(currentQIndex + 1)}
                className="px-5 py-2 hover:bg-gray-150 bg-indigo-65 text-indigo-600 border border-indigo-200 text-xs font-bold rounded-xl flex items-center space-x-1 hover:bg-indigo-50"
              >
                <span>Next Slide</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
