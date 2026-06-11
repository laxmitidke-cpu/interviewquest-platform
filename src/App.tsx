/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import Login from "./components/Login";
import AdminDashboard from "./components/AdminDashboard";
import CandidateExam from "./components/CandidateExam";
import { User } from "./types";
import { Shield, BookOpen, AlertTriangle } from "lucide-react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [sandboxClosed, setSandboxClosed] = useState(false);

  useEffect(() => {
    // Check if URL has candidate invite token (e.g. /?token=xyz)
    const urlParams = new URLSearchParams(window.location.search);
    const codeToken = urlParams.get("token");
    if (codeToken) {
      setToken(codeToken);
    } else {
      const storedClosedToken = sessionStorage.getItem("iq_closed_token");
      if (storedClosedToken) {
        setSandboxClosed(true);
      }
    }

    // Try to auto login candidate session if user data exists in sessionStorage
    const savedUser = sessionStorage.getItem("iq_connected_user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        sessionStorage.removeItem("iq_connected_user");
      }
    }
  }, []);

  const handleLoginSuccess = (authenticatedUser: User) => {
    setUser(authenticatedUser);
    sessionStorage.setItem("iq_connected_user", JSON.stringify(authenticatedUser));
  };

  const handleLogout = () => {
    setUser(null);
    sessionStorage.removeItem("iq_connected_user");
  };

  const handleExitExam = () => {    if (token) {
      sessionStorage.setItem("iq_closed_token", token);
    }    // Clean up query parameters on exam exit and remain on the sandbox completion state
    window.history.replaceState({}, document.title, window.location.pathname);
    setSandboxClosed(true);
  };

  // 1. Candidate Direct assessment URL bypass path
  if (sandboxClosed && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans antialiased text-gray-900">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-gray-150 text-center shadow-xs">
          <h1 className="text-xl font-bold tracking-tight text-gray-900">Assessment Closed</h1>
          <p className="mt-3 text-sm text-gray-600 leading-relaxed">
            Your submission is complete and the sandbox has been closed. You can safely close this tab or revisit the invitation link when needed.
          </p>
        </div>
      </div>
    );
  }

  if (token) {
    return (
      <div className="font-sans antialiased text-gray-900 bg-gray-50 min-h-screen">
        <CandidateExam token={token} onExit={handleExitExam} />
      </div>
    );
  }

  // 2. Admin recruiter path
  if (user && user.role === "admin") {
    return (
      <div className="font-sans antialiased text-gray-900 bg-gray-50 min-h-screen">
        <AdminDashboard user={user} onLogout={handleLogout} />
      </div>
    );
  }

  // 3. Authenticated standard candidate without direct token (Instructions screen)
  if (user && user.role === "candidate") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans antialiased text-gray-900">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-gray-150 text-center space-y-6 shadow-xs">
          <div className="mx-auto h-12 w-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
            <Shield className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold tracking-tight text-gray-900">Candidate Workspace</h1>
            <p className="text-xs text-gray-500 leading-relaxed">
              To complete your technical screening assessment, please click on the unique direct invitation URL dispatched in your invitation email.
            </p>
          </div>

          <div className="bg-amber-50 md:p-4 p-3 border border-amber-100 rounded-xl space-y-2 text-left">
            <div className="flex items-center space-x-2 text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-[11px] font-bold uppercase">Recruiter Testing Instructions</span>
            </div>
            <p className="text-[10px] text-amber-700 leading-snug">
              To test the platform as an Administrator/Recruiter, click sign out below and log in using the pre-configured admin email address: <span className="font-mono font-bold text-indigo-800">laxmitidke@gmail.com</span>. From there, you can create testing rubrics and launch candidate assessments.
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-700 bg-indigo-605 border border-indigo-200 text-indigo-600 font-bold rounded-xl text-xs transition-all hover:bg-indigo-50"
            id="btn-return-login"
          >
            Sign Out & Return Login
          </button>
        </div>
      </div>
    );
  }

  // 4. Default Authenticating Form path
  return (
    <div className="font-sans antialiased text-gray-900 bg-gray-50 min-h-screen">
      <Login onLoginSuccess={handleLoginSuccess} />
    </div>
  );
}
