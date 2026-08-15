"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Mail, ShieldAlert } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [bgImage, setBgImage] = useState("/images/auth/cyber1.png");

  useEffect(() => {
    const images = [
      "/images/auth/cyber1.png",
      "/images/auth/cyber2.png",
      "/images/auth/cyber3.png",
    ];
    setBgImage(images[Math.floor(Math.random() * images.length)]);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || "Authentication failed");
        setLoading(false);
        return;
      }

      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        setError("Invalid email or password");
      } else {
        if (email === "superuser@example.com") {
          router.push("/admin");
        } else {
          router.push("/dashboard");
        }
        router.refresh();
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#fafafa]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Left side: Form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 lg:px-24 bg-white text-[#0a0a0a] z-10 border-r border-[#e5e5e5]">
        <div className="w-full max-w-sm mx-auto">
          <div className="flex items-center gap-2.5 mb-10">
            <div className="w-8 h-8 bg-[#CC2200] rounded flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <span className="font-bold text-lg tracking-tight">Sentinel AI</span>
          </div>

          <h2 className="text-3xl font-bold tracking-tight mb-2">Welcome back</h2>
          <p className="text-sm text-[#0a0a0a]/60 mb-8">
            Sign in to access the investigation portal
          </p>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-[#CC2200]/10 border border-[#CC2200]/20 rounded-md p-3 text-sm text-[#CC2200] font-medium text-center">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-[#0a0a0a]/80 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-[#0a0a0a]/40" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 bg-[#fafafa] border border-[#e5e5e5] rounded-md py-2.5 text-[#0a0a0a] focus:ring-1 focus:ring-[#CC2200] focus:border-[#CC2200] sm:text-sm transition-colors outline-none"
                  placeholder="investigator@agency.gov"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#0a0a0a]/80 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-[#0a0a0a]/40" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 bg-[#fafafa] border border-[#e5e5e5] rounded-md py-2.5 text-[#0a0a0a] focus:ring-1 focus:ring-[#CC2200] focus:border-[#CC2200] sm:text-sm transition-colors outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 bg-[#fafafa] border-[#e5e5e5] rounded text-[#CC2200] focus:ring-[#CC2200]"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm font-medium text-[#0a0a0a]/70">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-semibold text-[#CC2200] hover:text-[#CC2200]/80 transition-colors">
                  Forgot password?
                </a>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-[#CC2200] hover:bg-[#CC2200]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#CC2200] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Authenticating..." : "Log In"}
              </button>
            </div>
          </form>

          <div className="mt-8 text-center text-sm font-medium text-[#0a0a0a]/60">
            <p className="mb-4 text-xs font-bold uppercase tracking-wider text-[#0a0a0a]/40">Don't have an account?</p>
            <div className="flex flex-col gap-2.5">
              <Link
                href="/register?flow=user"
                className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-[#e5e5e5] rounded-md shadow-sm text-sm font-bold text-[#0a0a0a]/80 bg-white hover:bg-slate-50 transition-colors"
              >
                Register
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Right side: Image */}
      <div className="hidden md:block md:w-1/2 relative bg-black">
        <div
          className="absolute inset-0 bg-cover bg-center transition-all duration-1000 opacity-90"
          style={{ backgroundImage: `url(${bgImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        <div className="absolute bottom-16 left-16 right-16 text-white">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full border border-white/20 bg-white/10 backdrop-blur-md text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
            System Operational
          </div>
          <h3 className="text-3xl font-bold tracking-tight mb-3">Expose deepfakes. Protect truth.</h3>
          <p className="text-white/70 leading-relaxed max-w-md">
            The professional investigation platform for detecting AI-generated media manipulation and uncovering digital forgery.
          </p>
        </div>
      </div>
    </div>
  );
}
