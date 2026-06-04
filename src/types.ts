/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// User roles configuration
export type UserRole = "admin" | "candidate";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

// Assessment Questionnaire defined by recruiters
export interface Assessment {
  id: string;
  title: string;
  creatorId: string;
  skills: string[];
  numQuestions: number;
  timeLimit: number; // in minutes
  createdAt: string;
  questions: Question[];
}

export type QuestionType = "mcq" | "short_answer";
export type QuestionDifficulty = "easy" | "medium" | "hard";

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  skills: string[];
  points: number;
  difficulty?: QuestionDifficulty;
  // Multi-choice question requirements
  choices?: string[];
  correctAnswerIndex?: number; // 0-based index for MCQ
  // Short answer rubrics for Gemini assessment
  correctAnswerRubric?: string;
}

// Dynamic response from candidate during assessment
export interface CandidateAnswer {
  questionId: string;
  selectedAnswerIndex?: number; // MCQ only
  typedAnswer?: string; // Short answer only
  timeSpentSec?: number; // Time tracking per question
}

// Question score evaluation
export interface QuestionResult {
  questionId: string;
  pointsEarned: number;
  isCorrect: boolean;
  feedback: string; // Dynamic grading breakdown (especially via Gemini AI for short answers)
}

// Active session status and records
export type SessionStatus = "invited" | "in_progress" | "submitted" | "expired";

export interface AssessmentSession {
  id: string;
  assessmentId: string;
  candidateEmail: string;
  candidateName: string;
  status: SessionStatus;
  startedAt?: string;
  completedAt?: string;
  answers: CandidateAnswer[];
  results?: {
    totalScore: number;
    maxScore: number;
    passed: boolean;
    evaluations: QuestionResult[];
    overallFeedback?: string; // Generated with Gemini
  };
  secureHash?: string; // Tamperproof SHA-256 result signature for secure storage
}

// Candidate invitation status tracker
export interface EmailInvitation {
  id: string;
  assessmentId: string;
  candidateEmail: string;
  candidateName: string;
  token: string; // Invitation unique assessment access URL key
  status: "pending" | "sent" | "failed" | "opened" | "completed";
  sentAt?: string;
  completedAt?: string;
}

// Simulated automated email queue
export interface OutgoingEmail {
  id: string;
  toEmail: string;
  toName: string;
  subject: string;
  htmlBody: string;
  sentAt: string;
  status: "sent" | "delivered";
}
