/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Mail, Shield, User, Loader2 } from "lucide-react";
import { User as UserType } from "../types";

interface LoginProps {
  onLoginSuccess: (user: UserType) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "candidate">("candidate");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Email address is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          role
        })
      });

      if (!res.ok) {
        throw new Error("Unable to log in. Please check backend status.");
      }

      const data = await res.json();
      if (data.success && data.user) {
        onLoginSuccess(data.user);
      } else {
        throw new Error(data.error || "Authentication failed.");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-sm border border-gray-100 transition-all">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 mb-4">
            <Shield className="h-6 w-6" id="app-logo" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">
            InterviewQuest
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Secure, role-based technical screening platform
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit} id="login-form">
          {error && (
            <div className="p-4 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100" id="login-error-box">
              {error}
            </div>
          )}

          <div className="space-y-4 rounded-md shadow-xs">
            <div>
              <label htmlFor="email-address" className="block text-xs font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (e.target.value.toLowerCase() === "laxmitidke@gmail.com") {
                      setRole("admin");
                    }
                  }}
                  className="pl-9 block w-full rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
                  placeholder="name@company.com"
                />
              </div>
              <p className="mt-1 text-[10px] text-gray-400">
                Tip: Enter <span className="font-mono text-indigo-600">laxmitidke@gmail.com</span> to automatically log in as Admin.
              </p>
            </div>

            <div>
              <label htmlFor="full-name" className="block text-xs font-medium text-gray-700 mb-1">
                Full Name (Optional)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <User className="h-4 w-4" />
                </div>
                <input
                  id="full-name"
                  name="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-9 block w-full rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
                  placeholder="Laxmi Tidke"
                />
              </div>
            </div>

            <div className="pt-2">
              <span className="block text-xs font-medium text-gray-700 mb-2">Select Access Role Context:</span>
              <div className="grid grid-cols-2 gap-3" id="role-select">
                <button
                  type="button"
                  id="btn-role-candidate"
                  onClick={() => setRole("candidate")}
                  className={`flex items-center justify-center px-4 py-2.5 border rounded-xl text-xs font-medium transition-all ${
                    role === "candidate"
                      ? "border-indigo-600 bg-indigo-50/50 text-indigo-700"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <User className="mr-1.5 h-3.5 w-3.5" />
                  Candidate Screen
                </button>
                <button
                  type="button"
                  id="btn-role-admin"
                  onClick={() => setRole("admin")}
                  className={`flex items-center justify-center px-4 py-2.5 border rounded-xl text-xs font-medium transition-all ${
                    role === "admin"
                      ? "border-indigo-600 bg-indigo-50/50 text-indigo-700"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Shield className="mr-1.5 h-3.5 w-3.5" />
                  Recruiter Admin
                </button>
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              id="btn-submit-login"
              disabled={loading}
              className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all"
            >
              {loading ? (
                <Loader2 className="animate-spin h-5 w-5 text-white" />
              ) : (
                role === "admin" ? "Enter Administration Desk" : "Enter Candidate Space"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
