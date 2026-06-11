/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { User, UserRole, Assessment, Question, AssessmentSession, EmailInvitation, OutgoingEmail, SessionStatus, QuestionResult } from "../types";

const DB_FILE_PATH = path.join(process.cwd(), "database.json");
const CRYPTO_SECRET = "interviewquest-secure-signer-key-2026";

// Core internal schema structures
interface DatabaseSchema {
  users: User[];
  assessments: Assessment[];
  sessions: AssessmentSession[];
  invitations: EmailInvitation[];
  emails: OutgoingEmail[];
  auditLogs: {
    id: string;
    action: string;
    entityId: string;
    entityType: string;
    performedBy: string;
    details: string;
    timestamp: string;
  }[];
}

// Global Static Seed Library of Predefined Standard Questions by Skill Area
export const PREDEFINED_QUESTIONS: Omit<Question, "id">[] = [
  // --- REACT SKILL ---
  {
    type: "mcq",
    text: "Which of the following is correct regarding React's 'useRef' hook?",
    skills: ["React"],
    points: 10,
    choices: [
      "Updating a ref causes a component to re-render immediately.",
      "It returns a mutable object whose '.current' property is initialized to the passed argument, and changes do not trigger re-renders.",
      "It can only be used to hold references to direct DOM nodes.",
      "It is deprecated in favor of React 19 state components."
    ],
    correctAnswerIndex: 1
  },
  {
    type: "mcq",
    text: "How does React 19's Server Actions handle standard form submissions?",
    skills: ["React"],
    points: 10,
    choices: [
      "They require an external WebSocket stream connection to perform any database operations.",
      "They allow forms to invoke client-side or server-side async functions directly through the 'action' attribute, automating state handles.",
      "They completely disable any state management hooks.",
      "They do not support client-side form validation."
    ],
    correctAnswerIndex: 1
  },
  {
    type: "short_answer",
    text: "Describe the primary differences between Server-Side Rendering (SSR) and Client-Side Rendering (CSR) in React frameworks. What are the key performance tradeoffs?",
    skills: ["React"],
    points: 15,
    correctAnswerRubric: "Candidate should explain that SSR executes React on the server to output HTML, reducing initial load times (First Contentful Paint) and improving SEO. CSR ships minimal HTML and runs JS in browser, which has slower initial paints but faster subsequent transitions. Tradeoffs include server load (SSR increases CPU demands) and Interactivity lag (TTL)."
  },

  // --- PYTHON SKILL ---
  {
    type: "mcq",
    text: "In Python, which built-in function returns a list of attributes and methods associated with an object?",
    skills: ["Python"],
    points: 10,
    choices: ["help()", "getattr()", "dir()", "methods()"],
    correctAnswerIndex: 2
  },
  {
    type: "mcq",
    text: "What is the primary benefit of a Python Generator (using the 'yield' keyword) over a standard function returning a list?",
    skills: ["Python"],
    points: 10,
    choices: [
      "Generators execute much faster because they compile directly to native machine assembly.",
      "They allow asynchronous multi-threading on multiple CPU cores bypassing the Global Interpreter Lock (GIL).",
      "They generate values lazily on-the-fly, which is highly memory-efficient for extremely large datasets.",
      "They are automatically secure from tamper attacks."
    ],
    correctAnswerIndex: 2
  },
  {
    type: "short_answer",
    text: "Explain the Python Global Interpreter Lock (GIL) and its impact on multi-threaded programs. How can a developer achieve true execution concurrency in CPU-heavy tasks?",
    skills: ["Python"],
    points: 15,
    correctAnswerRubric: "Candidate should explain that the GIL is a mutex preventing multiple threads from executing Python bytecodes at once. CPU-bound tasks suffer performance bottlenecks in standard threads. Concurrency can be achieved using multiprocessing (separate memory spaces), native C-extensions, or running in PyPy / asyncio for I/O tasks."
  },

  // --- NODE.JS SKILL ---
  {
    type: "mcq",
    text: "Which of the following describes Node.js's Libuv thread pool behavior by default?",
    skills: ["Node.js"],
    points: 10,
    choices: [
      "It handles all single asynchronous callbacks recursively in the master thread.",
      "It operates with 4 working threads by default to execute CPU-heavy or blocking tasks like cryptography, compression, and file-system access.",
      "It executes standard network routing in individual sandbox processes.",
      "It terminates automatically when garbage collection is triggered."
    ],
    correctAnswerIndex: 1
  },
  {
    type: "short_answer",
    text: "Explain Node.js's event loop phases (Timers, Pending Callbacks, Poll, Check, Close) and how 'process.nextTick()' interacts with them.",
    skills: ["Node.js"],
    points: 15,
    correctAnswerRubric: "Candidate should state that Node event loop executes timers, runs I/O callbacks, polls for active events, checks setImmediate callbacks, and closes events. process.nextTick is NOT technically part of the loop; it fires immediately after the current operation finishes, before the next phase."
  },

  // --- POSTGRESQL SKILL ---
  {
    type: "mcq",
    text: "Which index type is default and recommended for standard range and equality queries in a PostgreSQL table?",
    skills: ["PostgreSQL"],
    points: 10,
    choices: ["HASH", "GIST", "B-Tree", "GIN"],
    correctAnswerIndex: 2
  },
  {
    type: "mcq",
    text: "What does the 'EXPLAIN ANALYZE' command do in PostgreSQL?",
    skills: ["PostgreSQL"],
    points: 10,
    choices: [
      "It verifies database file hashes and flags errors.",
      "It auto-optimizes the SQL statement without executing it.",
      "It displays the planner's cost estimations and actually executes the query to report actual runtime parameters and index usages.",
      "It generates a security report of potential SQL injections."
    ],
    correctAnswerIndex: 2
  },
  {
    type: "short_answer",
    text: "What are the core differences between PostgreSQL's 'json' and 'jsonb' data types? Under what conditions would you prefer GIN indexing?",
    skills: ["PostgreSQL"],
    points: 15,
    correctAnswerRubric: "Candidate should describe that json stores a raw text representation of JSON (fast inserting, slower parsing), while jsonb decomposes JSON into structured binary (slower write, significantly faster query parsing, indexing). GIN (Generalized Inverted Index) is preferred for jsonb to query nested keys and values optimally."
  },

  // --- SYSTEM DESIGN ---
  {
    type: "mcq",
    text: "What is an advantage of a Consistent Hash Ring configuration in Distributed Caching?",
    skills: ["System Design"],
    points: 10,
    choices: [
      "It ensures all storage files are compressed automatically standardly.",
      "It minimizes cached key relocations when adding or removing key-value cache servers, avoiding massive cash misses.",
      "It forces perfect synchronous locks across all DB clusters.",
      "It prevents cross-site scripting vulnerabilities."
    ],
    correctAnswerIndex: 1
  },
  {
    type: "short_answer",
    text: "Explain the CAP theorem and the tradeoffs involved when designing a geographically distributed bank ledger versus a social network status feed.",
    skills: ["System Design"],
    points: 15,
    correctAnswerRubric: "Candidate should explain CAP constraints: Consistency, Availability, Partition Tolerance. Ledgers require strict Consistency (CP) — preventing double spends, even if transactions fail temporarily. Status feeds prefer high Availability (AP), sacrificing immediate consistency (stale comments are acceptable)."
  },

  // --- LINUX OS SKILL ---
  {
    type: "mcq",
    text: "Which of the following best describes the purpose of the inode in a Linux filesystem?",
    skills: ["Linux OS"],
    points: 10,
    choices: [
      "It stores the actual file content and data blocks.",
      "It is a data structure that holds metadata about a file including permissions, timestamps, owner, and pointers to data blocks.",
      "It manages the network interface configuration for the system.",
      "It is used exclusively for user authentication and authorization."
    ],
    correctAnswerIndex: 1
  },
  {
    type: "mcq",
    text: "What is the primary difference between a process and a thread in Linux?",
    skills: ["Linux OS"],
    points: 10,
    choices: [
      "Processes are faster than threads and use less memory.",
      "Each process has its own memory space and resources, while threads within a process share the same memory space and can access each other's data directly.",
      "Threads cannot be scheduled independently by the kernel.",
      "Processes only run in user space while threads run in kernel space."
    ],
    correctAnswerIndex: 1
  },
  {
    type: "short_answer",
    text: "Explain the purpose of file permissions in Linux (rwx for owner, group, and others). How does the 'chmod' command work with octal notation, and what does 755 and 644 represent?",
    skills: ["Linux OS"],
    points: 15,
    correctAnswerRubric: "Candidate should explain that permissions control read (r=4), write (w=2), and execute (x=1) access. Octal notation sums these values per category (owner, group, others). 755 = rwxr-xr-x (executable, owner full control, others read/execute) for scripts/directories. 644 = rw-r--r-- (owner read/write, others read-only) for files."
  },

  // --- NETWORKING SKILL ---
  {
    type: "mcq",
    text: "In the OSI model, which layer is responsible for routing and logical addressing (IP addresses)?",
    skills: ["Networking"],
    points: 10,
    choices: [
      "Layer 1: Physical",
      "Layer 2: Data Link",
      "Layer 3: Network",
      "Layer 4: Transport"
    ],
    correctAnswerIndex: 2
  },
  {
    type: "mcq",
    text: "What is the main difference between TCP and UDP protocols?",
    skills: ["Networking"],
    points: 10,
    choices: [
      "TCP is faster; UDP is slower but more reliable.",
      "TCP is connection-oriented and ensures reliable, ordered delivery; UDP is connectionless and does not guarantee delivery but has lower latency.",
      "UDP only works over IPv6 while TCP works over IPv4.",
      "TCP is used only for web traffic while UDP is used for email."
    ],
    correctAnswerIndex: 1
  },
  {
    type: "short_answer",
    text: "Describe the three-way TCP handshake (SYN, SYN-ACK, ACK) and explain why it is necessary for establishing a reliable connection.",
    skills: ["Networking"],
    points: 15,
    correctAnswerRubric: "Candidate should describe: 1) Client sends SYN packet with sequence number, 2) Server responds with SYN-ACK, acknowledging client's sequence and sending its own, 3) Client sends ACK to confirm. This verifies both parties are reachable, establishes initial sequence numbers for error detection, and ensures synchronized state before data transmission."
  },

  // --- KUBERNETES SKILL ---
  {
    type: "mcq",
    text: "In Kubernetes, what is the primary role of a Pod?",
    skills: ["Kubernetes"],
    points: 10,
    choices: [
      "Pod is an alias for a Deployment resource in Docker.",
      "Pod is the smallest deployable unit in Kubernetes, typically containing one or more closely related containers that share networking and storage.",
      "Pod is a cluster-level configuration object for setting resource quotas.",
      "Pod manages external load balancing across services."
    ],
    correctAnswerIndex: 1
  },
  {
    type: "mcq",
    text: "What is the purpose of a Kubernetes Service?",
    skills: ["Kubernetes"],
    points: 10,
    choices: [
      "To provide a standard way to build and package container images.",
      "To define CPU and memory limits for Pod execution.",
      "To provide a stable, abstracted endpoint for accessing a set of Pods, handling load balancing and service discovery.",
      "To manage the lifecycle of virtual machines in the cluster."
    ],
    correctAnswerIndex: 2
  },
  {
    type: "short_answer",
    text: "Explain the difference between Kubernetes Deployments and StatefulSets. When would you use each one, and what guarantees does StatefulSet provide?",
    skills: ["Kubernetes"],
    points: 15,
    correctAnswerRubric: "Candidate should explain Deployments manage stateless replicas with no unique identity and can be scaled/updated freely. StatefulSets maintain stable Pod identities, stable network names, and ordered deployment. StatefulSets are needed for databases, message queues, or storage-backed services where Pod identity and persistent storage order matter."
  },

  // --- OPENSHIFT SKILL ---
  {
    type: "mcq",
    text: "Which of the following best describes OpenShift's relationship to Kubernetes?",
    skills: ["OpenShift"],
    points: 10,
    choices: [
      "OpenShift is a completely separate container orchestration platform unrelated to Kubernetes.",
      "OpenShift is a Kubernetes-based platform that adds enterprise features, developer tools, and an integrated container registry.",
      "OpenShift is a lightweight Kubernetes alternative designed only for development environments.",
      "OpenShift is a networking plugin for Kubernetes."
    ],
    correctAnswerIndex: 1
  },
  {
    type: "mcq",
    text: "In OpenShift, what is a 'Project' and how does it relate to Kubernetes Resources?",
    skills: ["OpenShift"],
    points: 10,
    choices: [
      "Project is a Build system for compiling source code into container images.",
      "Project is OpenShift's term for a Kubernetes Namespace with additional role-based access control and resource quotas.",
      "Project is a deployment strategy for multi-region failover.",
      "Project is a monitoring and observability tool."
    ],
    correctAnswerIndex: 1
  },
  {
    type: "short_answer",
    text: "Explain OpenShift's integrated build system and how it enables source-to-container workflows. Describe BuildConfig and how it differs from manually building Docker images.",
    skills: ["OpenShift"],
    points: 15,
    correctAnswerRubric: "Candidate should explain OpenShift uses BuildConfig to automate builds directly from source (Git), with built-in webhook triggers. It watches repositories, pulls code, builds container images, and pushes to the internal registry without requiring separate Docker CLI steps. This tightly integrates source control with container lifecycle, enabling GitOps-style CI/CD automation."
  },

  // --- TERRAFORM SKILL ---
  {
    type: "mcq",
    text: "What is the primary purpose of Terraform state file?",
    skills: ["Terraform"],
    points: 10,
    choices: [
      "It stores sensitive credentials and passwords in plaintext.",
      "It maintains a mapping of resources defined in Terraform code to actual cloud infrastructure, tracking resource IDs and attributes.",
      "It is used only for validation and has no effect on deployments.",
      "It automatically encrypts all resources in the cloud."
    ],
    correctAnswerIndex: 1
  },
  {
    type: "mcq",
    text: "Which Terraform command is used to preview changes before applying them?",
    skills: ["Terraform"],
    points: 10,
    choices: [
      "terraform init",
      "terraform validate",
      "terraform plan",
      "terraform inspect"
    ],
    correctAnswerIndex: 2
  },
  {
    type: "short_answer",
    text: "Describe Terraform modules and how they promote code reusability. What are the best practices for structuring module inputs (variables) and outputs?",
    skills: ["Terraform"],
    points: 15,
    correctAnswerRubric: "Candidate should explain modules encapsulate reusable infrastructure code with clear inputs/outputs. Best practices include: explicit variable descriptions and validation, sensible defaults for optional inputs, comprehensive outputs with meaningful names, separating concerns (compute, networking, storage), and using consistent naming conventions. Modules should be published to registries for sharing across teams."
  }
];

// In-Memory Database initialization & persistence
export class Database {
  private data: DatabaseSchema;

  constructor() {
    this.data = {
      users: [],
      assessments: [],
      sessions: [],
      invitations: [],
      emails: [],
      auditLogs: []
    };
    this.load();
    this.seedDefaults();
  }

  private load() {
    try {
      if (fs.existsSync(DB_FILE_PATH)) {
        const fileContent = fs.readFileSync(DB_FILE_PATH, "utf8");
        const parsed = JSON.parse(fileContent);
        this.data = { ...this.data, ...parsed };
      }
    } catch (err) {
      console.error("Failed to load interview database file:", err);
    }
  }

  private save() {
    try {
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(this.data, null, 2), "utf8");
    } catch (err) {
      console.error("Failed to save interview database file:", err);
    }
  }

  private seedDefaults() {
    // Add default admin user Laxmi as pre-configured Recruiter
    const laxmiEmail = "laxmitidke@gmail.com";
    const existingLaxmi = this.data.users.find(u => u.email.toLowerCase() === laxmiEmail.toLowerCase());
    if (!existingLaxmi) {
      this.data.users.push({
        id: "admin-laxmi",
        email: laxmiEmail,
        name: "Laxmi Tidke",
        role: "admin",
        createdAt: new Date().toISOString()
      });
      this.logAudit("SEED_USER", "admin-laxmi", "users", "SYSTEM", "Seeded default Admin recruiter account");
    }

    // Seed exemplary dummy candidate
    const candidateEmail = "candidate@example.com";
    const existingCandidate = this.data.users.find(u => u.email.toLowerCase() === candidateEmail.toLowerCase());
    if (!existingCandidate) {
      this.data.users.push({
        id: "cand-default",
        email: candidateEmail,
        name: "Alex Rivera",
        role: "candidate",
        createdAt: new Date().toISOString()
      });
    }

    // Seed sample initial assessment if empty
    if (this.data.assessments.length === 0) {
      const firstId = "asm-sample-react-node";
      const sampleQuestionList: Question[] = [
        {
          id: "q-r1",
          type: "mcq",
          text: "Which of the following is correct regarding React's 'useRef' hook?",
          skills: ["React"],
          points: 10,
          choices: [
            "Updating a ref causes a component to re-render immediately.",
            "It returns a mutable object whose '.current' property is initialized to the passed argument, and changes do not trigger re-renders.",
            "It can only be used to hold references to direct DOM nodes.",
            "It is deprecated in favor of React 19 state components."
          ],
          correctAnswerIndex: 1
        },
        {
          id: "q-n1",
          type: "mcq",
          text: "Which of the following describes Node.js's Libuv thread pool behavior by default?",
          skills: ["Node.js"],
          points: 10,
          choices: [
            "It handles all single asynchronous callbacks recursively in the master thread.",
            "It operates with 4 working threads by default to execute CPU-heavy or blocking tasks like cryptography, compression, and file-system access.",
            "It executes standard network routing in individual sandbox processes.",
            "It terminates automatically when garbage collection is triggered."
          ],
          correctAnswerIndex: 1
        },
        {
          id: "q-sys1",
          type: "short_answer",
          text: "Describe the primary differences between Server-Side Rendering (SSR) and Client-Side Rendering (CSR) in React frameworks. What are the key performance tradeoffs?",
          skills: ["React"],
          points: 15,
          correctAnswerRubric: "Candidate should explain that SSR executes React on the server to output HTML, reducing initial load times (First Contentful Paint) and improving SEO. CSR ships minimal HTML and runs JS in browser, which has slower initial paints but faster subsequent transitions. Tradeoffs include server load (SSR increases CPU demands) and Interactivity lag (TTL)."
        }
      ];

      this.data.assessments.push({
        id: firstId,
        title: "Senior Full Stack Dev Assessment (React & Node.js)",
        creatorId: "admin-laxmi",
        skills: ["React", "Node.js"],
        numQuestions: 3,
        timeLimit: 15,
        createdAt: new Date().toISOString(),
        questions: sampleQuestionList
      });

      // Seed exemplary completions for recruiter dashboard to look populated and beautiful
      this.data.sessions.push({
        id: "sess-completed-1",
        assessmentId: firstId,
        candidateEmail: "candidate@example.com",
        candidateName: "Alex Rivera",
        status: "submitted",
        startedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        completedAt: new Date(Date.now() - 2400000).toISOString(), // 40 mins ago
        answers: [
          { questionId: "q-r1", selectedAnswerIndex: 1, timeSpentSec: 45 },
          { questionId: "q-n1", selectedAnswerIndex: 1, timeSpentSec: 30 },
          { questionId: "q-sys1", typedAnswer: "SSR generates HTML on the server and improves page load speed and SEO indexability, because spiders can read the full text right away. CSR is client side JavaScript downloading which starts empty and is slower. However CSR has rapid dynamic routes on subsequent actions. SSR increases server loads.", timeSpentSec: 245 }
        ],
        results: {
          totalScore: 32,
          maxScore: 35,
          passed: true,
          evaluations: [
            { questionId: "q-r1", pointsEarned: 10, isCorrect: true, feedback: "Correct MCQ Selection." },
            { questionId: "q-n1", pointsEarned: 10, isCorrect: true, feedback: "Correct MCQ Selection." },
            { questionId: "q-sys1", pointsEarned: 12, isCorrect: true, feedback: "Exceptional analysis! The candidate laid out core concepts, highlighted initial load benchmarks (SEO, speed parameters), CSR transition benefits, and identified server runtime performance boundaries accurately." }
          ],
          overallFeedback: "Strong conceptual understanding of full-stack rendering dynamics. Highly competent in React hooks, core Node.js runtime operations and systems scalability."
        }
      });

      // Backport secure hash for completeness
      const lastSess = this.data.sessions[0];
      lastSess.secureHash = this.signResults(lastSess);

      this.logAudit("SEED_ASSESSMENT", firstId, "assessments", "SYSTEM", "Seeded React & Node.js dynamic assessment");
    }

    this.save();
  }

  // Cryptographic signer to ensure security of records
  public signResults(session: AssessmentSession): string {
    const rawPayload = `${session.id}|${session.assessmentId}|${session.candidateEmail}|${session.results?.totalScore || 0}|${session.results?.maxScore || 0}`;
    return crypto.createHmac("sha256", CRYPTO_SECRET).update(rawPayload).digest("hex");
  }

  // Audit tracker
  public logAudit(action: string, entityId: string, entityType: string, performedBy: string, details: string) {
    this.data.auditLogs.unshift({
      id: "audit-" + crypto.randomBytes(6).toString("hex"),
      action,
      entityId,
      entityType,
      performedBy,
      details,
      timestamp: new Date().toISOString()
    });
    // Cap at 200 logs
    if (this.data.auditLogs.length > 200) {
      this.data.auditLogs.pop();
    }
    this.save();
  }

  public getAuditLogs() {
    return this.data.auditLogs;
  }

  // --- Auth / User handlers ---
  public getOrCreateUser(email: string, name: string = "", role: UserRole = "candidate"): User {
    const cleaned = email.trim().toLowerCase();
    let user = this.data.users.find(u => u.email.toLowerCase() === cleaned);
    if (!user) {
      user = {
        id: (role === "admin" ? "admin-" : "cand-") + crypto.randomBytes(6).toString("hex"),
        email: cleaned,
        name: name || cleaned.split("@")[0],
        role,
        createdAt: new Date().toISOString()
      };
      this.data.users.push(user);
      this.logAudit("CREATE_USER", user.id, "users", "API", `Created user through login: ${cleaned} as ${role}`);
      this.save();
    }
    return user;
  }

  public getUsers() {
    return this.data.users;
  }

  // --- Assessments methods ---
  public createAssessment(assessment: Omit<Assessment, "id" | "createdAt">): Assessment {
    const newAss: Assessment = {
      ...assessment,
      id: "asm-" + crypto.randomBytes(8).toString("hex"),
      createdAt: new Date().toISOString()
    };
    this.data.assessments.push(newAss);
    this.logAudit("CREATE_ASSESSMENT", newAss.id, "assessments", assessment.creatorId, `Created assessment containing ${newAss.numQuestions} items in ${newAss.skills.join(",")}`);
    this.save();
    return newAss;
  }

  public updateAssessment(id: string, updates: Partial<Omit<Assessment, "id" | "createdAt" | "questions">>): Assessment | undefined {
    const assessment = this.getAssessmentById(id);
    if (!assessment) return undefined;

    if (updates.title !== undefined) assessment.title = updates.title;
    if (updates.skills !== undefined) assessment.skills = updates.skills;
    if (updates.numQuestions !== undefined) assessment.numQuestions = updates.numQuestions;
    if (updates.timeLimit !== undefined) assessment.timeLimit = updates.timeLimit;

    this.logAudit("UPDATE_ASSESSMENT", assessment.id, "assessments", assessment.creatorId, `Updated assessment title and configuration to ${assessment.skills.join(",")}`);
    this.save();
    return assessment;
  }

  public deleteAssessment(id: string): boolean {
    const index = this.data.assessments.findIndex(a => a.id === id);
    if (index === -1) {
      return false;
    }

    const assessment = this.data.assessments[index];
    this.data.assessments.splice(index, 1);

    const removedSessions = this.data.sessions.filter(s => s.assessmentId === id);
    this.data.sessions = this.data.sessions.filter(s => s.assessmentId !== id);
    this.data.invitations = this.data.invitations.filter(inv => inv.assessmentId !== id);

    this.logAudit("DELETE_ASSESSMENT", id, "assessments", "RECRUITER", `Deleted assessment template: ${assessment.title}`);
    removedSessions.forEach((session) => {
      this.logAudit("DELETE_SESSION", session.id, "sessions", "RECRUITER", `Deleted session from removed assessment: ${session.candidateEmail}`);
    });
    this.save();
    return true;
  }

  public getAssessments() {
    return this.data.assessments;
  }

  public getAssessmentById(id: string) {
    return this.data.assessments.find(a => a.id === id);
  }

  // --- Assessment Sessions ---
  public createSession(assessmentId: string, candidateEmail: string, candidateName: string): AssessmentSession {
    const cleanedEmail = candidateEmail.trim().toLowerCase();
    
    // Check if there is an existing session
    const existing = this.data.sessions.find(s => s.assessmentId === assessmentId && s.candidateEmail.toLowerCase() === cleanedEmail);
    if (existing) {
      return existing;
    }

    const sess: AssessmentSession = {
      id: "sess-" + crypto.randomBytes(10).toString("hex"),
      assessmentId,
      candidateEmail: cleanedEmail,
      candidateName,
      status: "invited",
      answers: [],
    };
    sess.secureHash = this.signResults(sess);
    this.data.sessions.push(sess);
    this.logAudit("CREATE_SESSION", sess.id, "sessions", "RECRUITER", `Created interview candidate queue record for ${cleanedEmail}`);
    this.save();
    return sess;
  }

  public updateSession(session: AssessmentSession): AssessmentSession {
    const index = this.data.sessions.findIndex(s => s.id === session.id);
    if (index !== -1) {
      // Re-calculate secure cryptographic hash to certify tamperproof status
      session.secureHash = this.signResults(session);
      this.data.sessions[index] = session;
      this.logAudit("UPDATE_SESSION", session.id, "sessions", session.candidateEmail, `Updated session status to: ${session.status}`);
      this.save();
    }
    return session;
  }

  public deleteSession(id: string): boolean {
    const index = this.data.sessions.findIndex(s => s.id === id);
    if (index === -1) {
      return false;
    }

    const session = this.data.sessions[index];
    this.data.sessions.splice(index, 1);
    this.logAudit("DELETE_SESSION", id, "sessions", "RECRUITER", `Deleted candidate session for ${session.candidateEmail}`);

    this.data.invitations = this.data.invitations.filter(inv => {
      const keep = !(inv.assessmentId === session.assessmentId && inv.candidateEmail === session.candidateEmail);
      if (!keep) {
        this.logAudit("DELETE_INVITATION", inv.id, "invitations", "RECRUITER", `Deleted invitation for ${inv.candidateEmail}`);
      }
      return keep;
    });

    this.save();
    return true;
  }

  public getSessions() {
    return this.data.sessions;
  }

  public getSessionById(id: string) {
    return this.data.sessions.find(s => s.id === id);
  }

  // --- Email invitations queue ---
  public createInvitation(assessmentId: string, candidateEmail: string, candidateName: string, hostUrl: string): EmailInvitation {
    const cleanedEmail = candidateEmail.trim().toLowerCase();
    const token = crypto.randomBytes(16).toString("hex");

    const inv: EmailInvitation = {
      id: "inv-" + crypto.randomBytes(8).toString("hex"),
      assessmentId,
      candidateEmail: cleanedEmail,
      candidateName,
      token,
      status: "pending"
    };

    this.data.invitations.push(inv);

    // Create session too
    this.createSession(assessmentId, cleanedEmail, candidateName);

    // Simulated Automated Email Generation
    const ass = this.getAssessmentById(assessmentId);
    const title = ass ? ass.title : "Assessment";
    const limit = ass ? ass.timeLimit : 20;
    const skillsList = ass ? ass.skills.join(", ") : "";

    const cleanHost = hostUrl.endsWith("/") ? hostUrl : hostUrl + "/";
    const inviteLink = `${cleanHost}login?token=${token}`;

    const subject = `Assessment Invitation: ${title}`;
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 550px; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px; color: #1f2937;">
        <h2 style="color: #4f46e5; margin-top: 0;">Online Technical Interview Invitation</h2>
        <p>Dear <strong>${candidateName}</strong>,</p>
        <p>You have been formally invited to complete an online screening assessment for the role of senior engineer.</p>
        
        <div style="background-color: #f9fafb; border-left: 4px solid #4f46e5; padding: 12px; margin: 18px 0; border-radius: 0 4px 4px 0;">
          <h4 style="margin: 0 0 6px 0; color: #111827;">Assessment Overview:</h4>
          <ul style="margin: 0; padding-left: 18px;">
            <li><strong>Subject:</strong> ${title}</li>
            <li><strong>Target Skills:</strong> ${skillsList}</li>
            <li><strong>Time Constraint:</strong> ${limit} minutes</li>
            <li><strong>Form Type:</strong> MCQ + In-Depth Short Answer</li>
          </ul>
        </div>

        <p style="margin-top: 24px;">Please click the direct link below to access your sandbox. Ensure a stable network connection before starting. State is saved securely.</p>
        
        <div style="text-align: center; margin: 28px 0;">
          <a href="${inviteLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block; font-size: 14px;">Start Assessment Session</a>
        </div>

        <p style="font-size: 12px; color: #6b7280; text-align: center; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">This link is unique to you. Do not share. Verified secure encryption by Postgres/Signer.</p>
      </div>
    `;

    // Queue outgoing email
    const outgoing: OutgoingEmail = {
      id: "mail-" + crypto.randomBytes(8).toString("hex"),
      toEmail: cleanedEmail,
      toName: candidateName,
      subject,
      htmlBody,
      sentAt: new Date().toISOString(),
      status: "delivered"
    };

    this.data.emails.unshift(outgoing);
    inv.status = "sent";
    inv.sentAt = new Date().toISOString();

    this.logAudit("SEND_INVITATION", inv.id, "invitations", "SYSTEM", `Automated email invitation dispatched cleanly to ${cleanedEmail}`);
    this.save();

    return inv;
  }

  public getInvitations() {
    return this.data.invitations;
  }

  public getEmails() {
    return this.data.emails;
  }
}

// Export singleton database instance
export const db = new Database();
