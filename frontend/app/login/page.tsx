"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        const res = await fetch("http://localhost:8000/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            first_name: firstName,
            last_name: lastName,
            email: email,
            username: username,
            password: password,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || "Registration failed");
        }

        // Successfully registered, switch to login mode
        setMode("login");
        setError("");
        alert("Registration successful! Please log in.");
      } else {
        const res = await fetch("http://localhost:8000/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username_or_email: email, // Backend handles either username or email
            password: password,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || "Invalid credentials");
        }

        // Save session locally (simulate sign in for front end prototype)
        localStorage.setItem("user", JSON.stringify(data.user));
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* ─── Left panel (branding) ─── */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0a0a0a] flex-col justify-between p-12 relative overflow-hidden">
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 relative z-10">
          <div className="w-8 h-8 bg-[#CC2200] rounded flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <span className="text-white font-bold text-base tracking-tight">DeepGuard</span>
        </Link>

        {/* Center quote */}
        <div className="relative z-10 anim-fade-up">
          <div className="text-4xl font-bold text-white leading-[1.1] tracking-tight mb-6">
            Protecting media{" "}
            <span className="shimmer-text">authenticity</span>{" "}
            worldwide.
          </div>
          <p className="text-white/50 text-base leading-relaxed max-w-sm">
            Join 500+ law enforcement agencies and investigative journalists who trust DeepGuard to expose AI-manipulated media.
          </p>

          {/* Testimonial card */}
          <div className="mt-10 p-5 rounded-lg bg-white/5 border border-white/10">
            <p className="text-white/80 text-sm leading-relaxed mb-4">
              &ldquo;DeepGuard helped us identify a coordinated disinformation campaign within 48 hours. The evidence report was accepted directly by the court.&rdquo;
            </p>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#CC2200] to-[#ff6644] flex items-center justify-center text-white text-xs font-bold">
                SA
              </div>
              <div>
                <div className="text-white text-xs font-semibold">Sarah Andersen</div>
                <div className="text-white/40 text-xs">Senior Digital Forensics Analyst, Europol</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom stats */}
        <div className="relative z-10 flex gap-6">
          {[
            { val: "99.2%", label: "Accuracy" },
            { val: "< 3s", label: "Avg. time" },
            { val: "50M+", label: "Files scanned" },
          ].map((s, i) => (
            <div key={i}>
              <div className="text-white font-bold text-lg">{s.val}</div>
              <div className="text-white/40 text-xs">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Right panel (form) ─── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <Link href="/" className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-7 h-7 bg-[#CC2200] rounded flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <span className="font-bold text-sm">DeepGuard</span>
          </Link>

          {/* Mode toggle */}
          <div className="page-enter">
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight mb-1">
                {mode === "login" ? "Welcome back" : "Create account"}
              </h1>
              <p className="text-sm text-[#0a0a0a]/50">
                {mode === "login"
                  ? "Sign in to your DeepGuard account"
                  : "Start your free investigation today"}
              </p>
            </div>

            {/* Tab switch */}
            <div className="flex bg-[#f0f0f0] rounded p-0.5 mb-6">
              {(["login", "register"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(""); }}
                  className={`flex-1 py-2 text-xs font-semibold rounded transition-all ${
                    mode === m
                      ? "bg-white text-[#0a0a0a] shadow-sm"
                      : "text-[#0a0a0a]/50 hover:text-[#0a0a0a]"
                  }`}
                >
                  {m === "login" ? "Sign in" : "Register"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {mode === "register" && (
                <>
                  <div className="grid grid-cols-2 gap-3 anim-fade-up">
                    <div>
                      <label className="block text-xs font-medium text-[#0a0a0a]/60 mb-1.5">First name</label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Sarah"
                        required
                        className="w-full px-3.5 py-2.5 text-sm border border-[#e5e5e5] rounded bg-white outline-none focus:border-[#CC2200] transition-colors placeholder:text-[#0a0a0a]/30"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#0a0a0a]/60 mb-1.5">Last name</label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Andersen"
                        required
                        className="w-full px-3.5 py-2.5 text-sm border border-[#e5e5e5] rounded bg-white outline-none focus:border-[#CC2200] transition-colors placeholder:text-[#0a0a0a]/30"
                      />
                    </div>
                  </div>

                  <div className="anim-fade-up">
                    <label className="block text-xs font-medium text-[#0a0a0a]/60 mb-1.5">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="sarah_andersen"
                      required
                      className="w-full px-3.5 py-2.5 text-sm border border-[#e5e5e5] rounded bg-white outline-none focus:border-[#CC2200] transition-colors placeholder:text-[#0a0a0a]/30"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-medium text-[#0a0a0a]/60 mb-1.5">
                  {mode === "login" ? "Username or Email address" : "Email address"}
                </label>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={mode === "login" ? "you@example.com or username" : "you@example.com"}
                  required
                  className="w-full px-3.5 py-2.5 text-sm border border-[#e5e5e5] rounded bg-white outline-none focus:border-[#CC2200] transition-colors placeholder:text-[#0a0a0a]/30"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-[#0a0a0a]/60">Password</label>
                  {mode === "login" && (
                    <a href="#" className="text-xs text-[#CC2200] hover:underline">Forgot password?</a>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "register" ? "Min. 8 characters" : "••••••••"}
                    required
                    minLength={8}
                    className="w-full px-3.5 py-2.5 pr-10 text-sm border border-[#e5e5e5] rounded bg-white outline-none focus:border-[#CC2200] transition-colors placeholder:text-[#0a0a0a]/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0a0a0a]/30 hover:text-[#0a0a0a]/60 transition-colors"
                  >
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded bg-red-50 border border-red-200 text-red-600 text-xs">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {error}
                </div>
              )}

              {mode === "register" && (
                <p className="text-xs text-[#0a0a0a]/40 leading-relaxed">
                  By registering, you agree to our{" "}
                  <a href="#" className="text-[#0a0a0a]/60 hover:underline">Terms of Service</a> and{" "}
                  <a href="#" className="text-[#0a0a0a]/60 hover:underline">Privacy Policy</a>.
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-2.5 bg-[#CC2200] text-white text-sm font-semibold rounded hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-1"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {mode === "login" ? "Signing in…" : "Creating account…"}
                  </>
                ) : (
                  mode === "login" ? "Sign in" : "Create account"
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-[#e5e5e5]" />
              <span className="text-xs text-[#0a0a0a]/30 font-medium">or continue with</span>
              <div className="flex-1 h-px bg-[#e5e5e5]" />
            </div>

            {/* Social buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-[#e5e5e5] rounded text-xs font-medium text-[#0a0a0a]/70 hover:bg-[#f5f5f5] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google
              </button>
              <button
                type="button"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-[#e5e5e5] rounded text-xs font-medium text-[#0a0a0a]/70 hover:bg-[#f5f5f5] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
                </svg>
                GitHub
              </button>
            </div>

            <p className="text-center text-xs text-[#0a0a0a]/40 mt-6">
              {mode === "login" ? (
                <>No account? <button onClick={() => setMode("register")} className="text-[#CC2200] font-medium hover:underline">Create one</button></>
              ) : (
                <>Already have an account? <button onClick={() => setMode("login")} className="text-[#CC2200] font-medium hover:underline">Sign in</button></>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
