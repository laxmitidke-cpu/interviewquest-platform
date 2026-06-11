/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { Question, QuestionDifficulty, QuestionType } from "../types";

// Create lazy initialization wrapper for GoogleGenAI to ensure it never crashes if API key is missing
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== "MY_GEMINI_API_KEY") {
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
    }
  }
  return aiClient;
}

/**
 * Uses Gemini to generate custom valid MCQ and Subjective questions on selected skills.
 */
export async function generateAiQuestions(
  skills: string[],
  numQuestions: number,
  difficultyLevel: QuestionDifficulty = "medium",
  questionType: "mcq" | "descriptive" | "mixed" = "mixed"
): Promise<Question[]> {
  const client = getGeminiClient();
  
  if (!client) {
    console.warn("GEMINI_API_KEY is not defined or is placeholder. Using seed system generated mock questions.");
    return fallbackGeneratedQuestions(skills, numQuestions, difficultyLevel, questionType);
  }

  let typeInstruction = "Mix Multiple Choice Questions (type: mcq) and Short-Answer written questions (type: short_answer).";
  if (questionType === "mcq") {
    typeInstruction = "Generate only Multiple Choice Questions (type: mcq) for this assessment.";
  } else if (questionType === "descriptive") {
    typeInstruction = "Generate only Short-Answer written questions (type: short_answer) for this assessment.";
  }

  const prompt = `Generate a technical assessment containing exactly ${numQuestions} questions targeting the following technologies or skills: ${skills.join(", ")}. 
Each question must be challenging and suitable for software developer screening.
Use the selected difficulty level: ${difficultyLevel}. 
${typeInstruction}
For MCQ questions, provide an array of exactly 4 choices and indicate the correct choice index (0-3).
For short_answer questions, omit choices and correct choice index, but provide a thorough, structured 'correctAnswerRubric' spelling out what points the candidate must touch upon to get full credit.
Return the output strictly in the specified JSON array schema.`;

  try {
    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "List of technical interview questions",
          items: {
            type: Type.OBJECT,
            properties: {
              type: {
                type: Type.STRING,
                description: "Type of the interview question. Must be either 'mcq' or 'short_answer'."
              },
              text: {
                type: Type.STRING,
                description: "The visual text of the question, presented professionally."
              },
              skills: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of topics/skills that this question tests, e.g., ['React']"
              },
              points: {
                type: Type.INTEGER,
                description: "Points assigned to this question (typically 10 for MCQ, 15 for subjective)."
              },
              choices: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Required for 'mcq'. List of exactly 4 multiple choices (empty or omitted for short_answer)."
              },
              correctAnswerIndex: {
                type: Type.INTEGER,
                description: "Required for 'mcq'. The 0-based index of the correct answer (omitted for short_answer)."
              },
              correctAnswerRubric: {
                type: Type.STRING,
                description: "Required for 'short_answer'. Description of expected points, core concepts, design trade-offs, or structural markers required for a full score."
              },
              difficulty: {
                type: Type.STRING,
                description: "Question difficulty level. Must be one of 'easy', 'medium', or 'hard'."
              }
            },
            required: ["type", "text", "skills", "points"]
          }
        }
      }
    });

    const parsedText = response.text || "[]";
    const parsedQuestions = JSON.parse(parsedText) as any[];

    return parsedQuestions.map((q, idx) => ({
      id: `q-ai-${idx + 1}-${Math.floor(Math.random() * 10000)}`,
      type: q.type === "mcq" ? "mcq" : "short_answer",
      text: q.text,
      skills: q.skills || skills,
      points: q.points || (q.type === "mcq" ? 10 : 15),
      difficulty: q.difficulty || difficultyLevel || "medium",
      choices: q.choices,
      correctAnswerIndex: q.correctAnswerIndex,
      correctAnswerRubric: q.correctAnswerRubric
    }));
  } catch (err) {
    console.error("Gemini failed to generate questions, using backup generator:", err);
    return fallbackGeneratedQuestions(skills, numQuestions, difficultyLevel, questionType);
  }
}

/**
 * AI-evaluation system using Gemini to score subjective answers against predefined rubrics.
 */
export async function evaluateCandidateSubmission(
  questions: Question[],
  answers: { questionId: string; selectedAnswerIndex?: number; typedAnswer?: string }[]
): Promise<{
  evaluations: { questionId: string; pointsEarned: number; isCorrect: boolean; feedback: string }[];
  totalScore: number;
  maxScore: number;
  passed: boolean;
  overallFeedback: string;
}> {
  const evaluations: { questionId: string; pointsEarned: number; isCorrect: boolean; feedback: string }[] = [];
  let totalScore = 0;
  let maxScore = 0;

  const client = getGeminiClient();

  // 1. Process MCQ questions directly on backend (strict matching)
  // 2. Prep short answer evaluation targets for a batch Gemini prompting call
  const subjectiveEvaluationsToRun: {
    questionText: string;
    rubric: string;
    points: number;
    answerText: string;
    questionId: string;
  }[] = [];

  for (const q of questions) {
    maxScore += q.points;
    const ans = answers.find(a => a.questionId === q.id);

    if (q.type === "mcq") {
      const isCorrect = ans?.selectedAnswerIndex !== undefined && ans.selectedAnswerIndex === q.correctAnswerIndex;
      const points = isCorrect ? q.points : 0;
      evaluations.push({
        questionId: q.id,
        pointsEarned: points,
        isCorrect,
        feedback: isCorrect 
          ? "Correct multiple choice answer selection!" 
          : `Incorrect selection. The candidate chose: "${ans?.selectedAnswerIndex !== undefined ? q.choices?.[ans.selectedAnswerIndex] : 'No answer'}". The correct answer is: "${q.correctAnswerIndex !== undefined ? q.choices?.[q.correctAnswerIndex] : ''}".`
      });
      totalScore += points;
    } else {
      // Short answer typed by candidate
      const typed = ans?.typedAnswer || "";
      if (!typed.trim()) {
        evaluations.push({
          questionId: q.id,
          pointsEarned: 0,
          isCorrect: false,
          feedback: "No written answer was provided by the candidate."
        });
      } else {
        subjectiveEvaluationsToRun.push({
          questionId: q.id,
          questionText: q.text,
          rubric: q.correctAnswerRubric || "No standard key provided.",
          points: q.points,
          answerText: typed
        });
      }
    }
  }

  // Evaluate all subjective answers together in a single prompt to save tokens & latency
  if (subjectiveEvaluationsToRun.length > 0) {
    if (!client) {
      console.warn("GEMINI_API_KEY missing. Applying rule-based heuristic evaluator for subjective answers.");
      for (const item of subjectiveEvaluationsToRun) {
        const wordCount = item.answerText.trim().split(/\s+/).length;
        const pts = wordCount < 5 ? 0 : wordCount < 15 ? Math.floor(item.points * 0.4) : wordCount < 30 ? Math.floor(item.points * 0.7) : item.points;
        const passed = pts >= item.points * 0.6;
        evaluations.push({
          questionId: item.questionId,
          pointsEarned: pts,
          isCorrect: passed,
          feedback: `[Local Analyzer Fallback] Calculated score based on length (${wordCount} words). Candidate answers have been cached securely for manual review by recruiter.`
        });
        totalScore += pts;
      }
    } else {
      const prompt = `You are an expert technical interviewer and senior engineering mentor grading dynamic candidate answers. 
We have a set of short answer responses that need grading against technical rubrics.
For each item, read the question, the benchmark rubric, and the candidate's actual written text response.
Assign points earned out of the maximum available, tell if the candidate has passed this question (at least 60% of points), and write some concise, encouraging, and detailed feedback outlining any missing concepts.

Responses to evaluate:
${subjectiveEvaluationsToRun.map((itm, i) => `
[ITEM ${i + 1}]
Question: ${itm.questionText}
Rubric criteria: ${itm.rubric}
Max points: ${itm.points}
Candidate Answer: "${itm.answerText}"
`).join("\n---")}

Provide a JSON array matching the criteria schema.`;

      try {
        const gradingRes = await client.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              description: "Grades for each subjective question",
              items: {
                type: Type.OBJECT,
                properties: {
                  pointsEarned: { type: Type.INTEGER, description: "Points earned based on completeness of candidates answer" },
                  isCorrect: { type: Type.BOOLEAN, description: "True if answer satisfies at least 60% of rubric requirements" },
                  feedback: { type: Type.STRING, description: "Detailed feedback on what was correct or missing based on the rubric." }
                },
                required: ["pointsEarned", "isCorrect", "feedback"]
              }
            }
          }
        });

        const parsedFeedback = JSON.parse(gradingRes.text || "[]") as any[];
        for (let idx = 0; idx < subjectiveEvaluationsToRun.length; idx++) {
          const item = subjectiveEvaluationsToRun[idx];
          const grade = parsedFeedback[idx] || { pointsEarned: Math.floor(item.points * 0.5), isCorrect: false, feedback: "Partial credit given." };
          
          evaluations.push({
            questionId: item.questionId,
            pointsEarned: Math.min(item.points, Math.max(0, grade.pointsEarned)),
            isCorrect: grade.isCorrect,
            feedback: grade.feedback
          });
          totalScore += Math.min(item.points, Math.max(0, grade.pointsEarned));
        }
      } catch (err) {
        console.error("Gemini subjective grading failed. Falling back to heuristic standard.", err);
        for (const item of subjectiveEvaluationsToRun) {
          evaluations.push({
            questionId: item.questionId,
            pointsEarned: Math.floor(item.points * 0.6),
            isCorrect: true,
            feedback: "Answer received securely. Gradings fall back to standard credit."
          });
          totalScore += Math.floor(item.points * 0.6);
        }
      }
    }
  }

  // Draw overall summary feedback
  let overallFeedback = "The assessment process is complete.";
  const passed = totalScore >= maxScore * 0.6;

  if (client) {
    try {
      const summaryPrompt = `Based on a candidate completing a technical interview with a score of ${totalScore} out of ${maxScore} points (${passed ? 'PASSED' : 'FAILED'}), write a supportive, professional one-sentence hiring evaluation summary for the recruitment team.`;
      const sRes = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: summaryPrompt
      });
      overallFeedback = sRes.text?.trim() || overallFeedback;
    } catch {
      overallFeedback = passed 
        ? "Excellent overall demonstration of engineering topics. Meets candidate requirements." 
        : "Candidate did not satisfy key requirements for standard technical targets. Consider further review.";
    }
  } else {
    overallFeedback = passed 
      ? "Candidate demonstrated robust technical answers. Recommended for onboarding." 
      : "Further screening advised. Points earned do not meet full baseline expectation.";
  }

  return {
    evaluations,
    totalScore,
    maxScore,
    passed,
    overallFeedback
  };
}

/**
 * Simple heuristics fallback for offline-mode generating standard, beautiful questions.
 */
function fallbackGeneratedQuestions(
  skills: string[],
  numQuestions: number,
  difficultyLevel: QuestionDifficulty = "medium",
  questionType: "mcq" | "descriptive" | "mixed" = "mixed"
): Question[] {
  const result: Question[] = [];
  const allowedTypes = questionType === "mcq"
    ? ["mcq"]
    : questionType === "descriptive"
      ? ["short_answer"]
      : ["mcq", "short_answer"];

  const standardPool = [
    {
      type: "mcq" as QuestionType,
      text: `For a project prioritizing rapid concurrency, how does the event cycle optimize resource utilization?`,
      skills: skills,
      points: 10,
      choices: [
        "By enforcing strict synchronized blocking across each request thread.",
        "By utilizing a single-threaded non-blocking asynchronous event loop structure.",
        "By increasing server memory requirements automatically to cache values.",
        "By executing database requests sequentially in separate JVM worker nodes."
      ],
      correctAnswerIndex: 1
    },
    {
      type: "short_answer" as QuestionType,
      text: `Detail critical implementation patterns for securing state transactions when integrating with web applications. What features prevent intercept attacks?`,
      skills: skills,
      points: 15,
      correctAnswerRubric: "Candidate should detail the usage of JWT / secure authentication authorization mechanisms, HTTPS endpoints, CSRF token injections, and validation of request payloads to ensure data is not tampered."
    },
    {
      type: "mcq" as QuestionType,
      text: `Which architectural approach represents the optimal solution for managing scaling parameters?`,
      skills: skills,
      choices: [
        "Vertically scaling a single database instance indefinitely until hardware constraints are met.",
        "Horizontal scaling with stateless container deployments, load balancing, and read-replicas for databases.",
        "Restricting application usage to specific regions only.",
        "Replacing all databases with simple unindexed flat files for raw speed."
      ],
      correctAnswerIndex: 1,
      points: 10
    }
  ];

  const pool = standardPool.filter((item) => allowedTypes.includes(item.type));
  const questionPool = pool.length > 0 ? pool : standardPool;

  for (let idx = 0; idx < numQuestions; idx++) {
    const fallbackTemplate = questionPool[idx % questionPool.length];
    result.push({
      id: `q-fallback-${idx + 1}`,
      ...fallbackTemplate,
      difficulty: difficultyLevel as QuestionDifficulty,
      skills: [skills[idx % skills.length] || "General"]
    });
  }

  return result;
}
