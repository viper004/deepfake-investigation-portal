"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Lock,
  Mail,
  ShieldAlert,
  X,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  KeyRound,
  ShieldCheck,
  RefreshCw,
  Eye,
  EyeOff
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [bgImage, setBgImage] = useState("/images/auth/cyber1.png");

  // Forgot Password Modal State
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<"EMAIL" | "OTP" | "NEW_PASSWORD" | "SUCCESS">("EMAIL");
  const [resetEmail, setResetEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Password visibility states
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalSuccessMsg, setModalSuccessMsg] = useState("");

  // Resend cooldown timer
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    const images = [
      "/images/auth/cyber1.png",
      "/images/auth/cyber2.png",
      "/images/auth/cyber3.png",
    ];
    setBgImage(images[Math.floor(Math.random() * images.length)]);
  }, []);

  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Handle Escape Key to Close Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isForgotModalOpen && !modalLoading) {
        closeForgotModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isForgotModalOpen, modalLoading]);

  const closeForgotModal = () => {
    setIsForgotModalOpen(false);
    setForgotStep("EMAIL");
    setModalError("");
    setModalSuccessMsg("");
    setOtpCode("");
    setResetToken("");
    setNewPassword("");
    setConfirmPassword("");
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setModalLoading(false);
  };

  const openForgotModal = (e: React.MouseEvent) => {
    e.preventDefault();
    if (email && email.includes("@")) {
      setResetEmail(email);
    }
    setForgotStep("EMAIL");
    setModalError("");
    setModalSuccessMsg("");
    setIsForgotModalOpen(true);
  };

  const maskEmail = (emailStr: string) => {
    if (!emailStr || !emailStr.includes("@")) return emailStr;
    const [local, domain] = emailStr.split("@");
    if (local.length <= 2) {
      return `${local}***@${domain}`;
    }
    const visiblePrefix = local.slice(0, 3);
    const masked = "*".repeat(Math.max(3, local.length - 3));
    return `${visiblePrefix}${masked}@${domain}`;
  };

  // Password validation checks
  const passMinLength = newPassword.length >= 8;
  const passHasUpper = /[A-Z]/.test(newPassword);
  const passHasLower = /[a-z]/.test(newPassword);
  const passHasNum = /[0-9]/.test(newPassword);
  const passMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isPasswordValid = passMinLength && passHasUpper && passHasLower && passHasNum && passMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${backendUrl}/api/v1/auth/login`, {
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

  // Step 1: Send OTP to Email
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setModalError("");
    setModalSuccessMsg("");
    setModalLoading(true);

    const emailClean = resetEmail.trim().toLowerCase();
    const emailRegex = /^[\w\.-]+@[\w\.-]+\.\w+$/;
    if (!emailRegex.test(emailClean)) {
      setModalError("Please enter a valid email address.");
      setModalLoading(false);
      return;
    }

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${backendUrl}/api/v1/auth/forgot-password/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailClean }),
      });

      const data = await res.json();

      if (!res.ok) {
        setModalError(data.detail || "Failed to send verification code.");
      } else {
        setModalSuccessMsg("A 6-digit verification code has been sent to your email.");
        setForgotStep("OTP");
        setResendCooldown(60);
      }
    } catch (err) {
      setModalError("Unable to connect to server. Please check your connection.");
    } finally {
      setModalLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setModalError("");
    setModalSuccessMsg("");
    setModalLoading(true);

    if (otpCode.length !== 6 || !/^\d+$/.test(otpCode)) {
      setModalError("OTP must be a 6-digit number.");
      setModalLoading(false);
      return;
    }

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${backendUrl}/api/v1/auth/forgot-password/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail.trim().toLowerCase(), otp: otpCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setModalError(data.detail || "Invalid or expired OTP.");
      } else {
        setResetToken(data.reset_token);
        setForgotStep("NEW_PASSWORD");
        setModalError("");
      }
    } catch (err) {
      setModalError("Unable to verify OTP. Please try again.");
    } finally {
      setModalLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || modalLoading) return;
    setModalError("");
    setModalSuccessMsg("");
    setModalLoading(true);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${backendUrl}/api/v1/auth/forgot-password/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail.trim().toLowerCase() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setModalError(data.detail || "Failed to resend OTP.");
      } else {
        setModalSuccessMsg("A new 6-digit OTP code has been sent.");
        setResendCooldown(60);
        setOtpCode("");
      }
    } catch (err) {
      setModalError("Unable to resend OTP. Please try again.");
    } finally {
      setModalLoading(false);
    }
  };

  // Step 3: Reset Password
  const handleResetPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isPasswordValid) {
      setModalError("Please ensure your password satisfies all requirements.");
      return;
    }

    setModalError("");
    setModalSuccessMsg("");
    setModalLoading(true);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${backendUrl}/api/v1/auth/forgot-password/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: resetEmail.trim().toLowerCase(),
          reset_token: resetToken,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setModalError(data.detail || "Failed to reset password.");
      } else {
        setForgotStep("SUCCESS");
      }
    } catch (err) {
      setModalError("Error resetting password. Please try again.");
    } finally {
      setModalLoading(false);
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
                  type={showLoginPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 bg-[#fafafa] border border-[#e5e5e5] rounded-md py-2.5 text-[#0a0a0a] focus:ring-1 focus:ring-[#CC2200] focus:border-[#CC2200] sm:text-sm transition-colors outline-none"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#0a0a0a]/40 hover:text-[#0a0a0a]/70 transition-colors cursor-pointer"
                  aria-label={showLoginPassword ? "Hide password" : "Show password"}
                >
                  {showLoginPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
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
                <button
                  type="button"
                  onClick={openForgotModal}
                  className="font-semibold text-[#CC2200] hover:text-[#CC2200]/80 transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-[#CC2200] hover:bg-[#CC2200]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#CC2200] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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

      {/* ──────────────── FORGOT PASSWORD MULTI-STEP MODAL ──────────────── */}
      {isForgotModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in text-left"
          onClick={() => {
            if (!modalLoading) closeForgotModal();
          }}
        >
          <div
            className="bg-white rounded-xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-[#e5e5e5] space-y-6 animate-scale-up relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#CC2200]/10 rounded-lg text-[#CC2200]">
                  <KeyRound className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-xl text-[#0a0a0a]">
                    {forgotStep === "EMAIL" && "Forgot Password"}
                    {forgotStep === "OTP" && "Verify OTP"}
                    {forgotStep === "NEW_PASSWORD" && "Create New Password"}
                    {forgotStep === "SUCCESS" && "Reset Successful"}
                  </h3>
                  <p className="text-xs text-[#0a0a0a]/60 mt-0.5">
                    {forgotStep === "EMAIL" && "Enter your registered email address to receive an OTP."}
                    {forgotStep === "OTP" && "Enter the 6-digit code sent to your email address."}
                    {forgotStep === "NEW_PASSWORD" && "Set a new secure password for your account."}
                    {forgotStep === "SUCCESS" && "Your password has been reset successfully."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeForgotModal}
                disabled={modalLoading}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Feedback Banners */}
            {modalError && (
              <div className="bg-[#CC2200]/10 border border-[#CC2200]/20 rounded-md p-3 text-xs text-[#CC2200] font-semibold text-center leading-relaxed">
                {modalError}
              </div>
            )}

            {modalSuccessMsg && forgotStep !== "SUCCESS" && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 text-xs text-emerald-700 font-semibold text-center leading-relaxed">
                {modalSuccessMsg}
              </div>
            )}

            {/* ─── STEP 1: EMAIL ADDRESS ─── */}
            {forgotStep === "EMAIL" && (
              <form onSubmit={handleSendOtp} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#0a0a0a]/60 mb-1.5">
                    Email address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-[#0a0a0a]/40" />
                    </div>
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="block w-full pl-9 bg-[#fafafa] border border-[#e5e5e5] rounded-md py-2.5 text-[#0a0a0a] text-sm focus:ring-1 focus:ring-[#CC2200] focus:border-[#CC2200] transition-colors outline-none"
                      placeholder="investigator@agency.gov"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeForgotModal}
                    disabled={modalLoading}
                    className="px-4 py-2 border border-[#e5e5e5] rounded-md text-xs font-bold text-[#0a0a0a]/70 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalLoading || !resetEmail}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#CC2200] hover:bg-[#a81c00] text-white rounded-md text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {modalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {modalLoading ? "Sending..." : "Send OTP"}
                  </button>
                </div>
              </form>
            )}

            {/* ─── STEP 2: OTP VERIFICATION ─── */}
            {forgotStep === "OTP" && (
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <div className="bg-slate-50 p-3 rounded-lg border border-[#e5e5e5] text-xs text-[#0a0a0a]/75 flex items-center justify-between">
                  <span>Verification code sent to:</span>
                  <span className="font-mono font-bold text-[#CC2200] text-xs">
                    {maskEmail(resetEmail)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#0a0a0a]/60 mb-1.5 text-center">
                    6-Digit OTP Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="block w-full text-center font-mono tracking-[0.6em] text-2xl font-bold py-3 bg-[#fafafa] border border-[#e5e5e5] rounded-md text-[#0a0a0a] focus:ring-1 focus:ring-[#CC2200] focus:border-[#CC2200] transition-colors outline-none"
                    placeholder="000000"
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep("EMAIL");
                      setModalError("");
                    }}
                    disabled={modalLoading}
                    className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </button>

                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0 || modalLoading}
                    className="inline-flex items-center gap-1 font-semibold text-[#CC2200] hover:text-[#a81c00] disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${modalLoading ? "animate-spin" : ""}`} />
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={modalLoading || otpCode.length !== 6}
                    className="w-full flex justify-center items-center gap-2 py-2.5 px-4 bg-[#CC2200] hover:bg-[#a81c00] text-white rounded-md text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {modalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {modalLoading ? "Verifying..." : "Verify OTP"}
                  </button>
                </div>
              </form>
            )}

            {/* ─── STEP 3: NEW PASSWORD FORM ─── */}
            {forgotStep === "NEW_PASSWORD" && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#0a0a0a]/60 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-[#0a0a0a]/40" />
                    </div>
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="block w-full pl-9 pr-9 bg-[#fafafa] border border-[#e5e5e5] rounded-md py-2 text-[#0a0a0a] text-sm focus:ring-1 focus:ring-[#CC2200] focus:border-[#CC2200] transition-colors outline-none"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#0a0a0a]/40 hover:text-[#0a0a0a]/70 transition-colors cursor-pointer"
                      aria-label={showNewPassword ? "Hide password" : "Show password"}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#0a0a0a]/60 mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-[#0a0a0a]/40" />
                    </div>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="block w-full pl-9 pr-9 bg-[#fafafa] border border-[#e5e5e5] rounded-md py-2 text-[#0a0a0a] text-sm focus:ring-1 focus:ring-[#CC2200] focus:border-[#CC2200] transition-colors outline-none"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#0a0a0a]/40 hover:text-[#0a0a0a]/70 transition-colors cursor-pointer"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Password Strength Validation Rules */}
                <div className="bg-slate-50 p-3 rounded-lg border border-[#e5e5e5] text-xs space-y-1.5">
                  <p className="font-bold text-[#0a0a0a]/70 text-[11px] uppercase tracking-wider mb-1">
                    Password Requirements:
                  </p>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                    <div className={`flex items-center gap-1.5 ${passMinLength ? "text-emerald-600 font-semibold" : "text-slate-400"}`}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Min 8 characters
                    </div>
                    <div className={`flex items-center gap-1.5 ${passHasUpper ? "text-emerald-600 font-semibold" : "text-slate-400"}`}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Uppercase letter
                    </div>
                    <div className={`flex items-center gap-1.5 ${passHasLower ? "text-emerald-600 font-semibold" : "text-slate-400"}`}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Lowercase letter
                    </div>
                    <div className={`flex items-center gap-1.5 ${passHasNum ? "text-emerald-600 font-semibold" : "text-slate-400"}`}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> One number
                    </div>
                  </div>
                  {confirmPassword.length > 0 && (
                    <div className={`pt-1 text-[11px] flex items-center gap-1.5 ${passMatch ? "text-emerald-600 font-semibold" : "text-[#CC2200] font-semibold"}`}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {passMatch ? "Passwords match" : "Passwords do not match"}
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={modalLoading || !isPasswordValid}
                    className="w-full flex justify-center items-center gap-2 py-2.5 px-4 bg-[#CC2200] hover:bg-[#a81c00] text-white rounded-md text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {modalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {modalLoading ? "Resetting..." : "Reset Password"}
                  </button>
                </div>
              </form>
            )}

            {/* ─── STEP 4: SUCCESS STATE ─── */}
            {forgotStep === "SUCCESS" && (
              <div className="text-center space-y-5 py-2">
                <div className="mx-auto w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                  <ShieldCheck className="h-7 w-7" />
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-lg text-[#0a0a0a]">Password Reset Successful</h4>
                  <p className="text-xs text-[#0a0a0a]/70 max-w-xs mx-auto leading-relaxed">
                    Your password has been updated successfully. You can now log in with your new credentials.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (resetEmail) {
                      setEmail(resetEmail);
                    }
                    closeForgotModal();
                  }}
                  className="w-full py-2.5 px-4 bg-[#CC2200] hover:bg-[#a81c00] text-white rounded-md text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  Back to Login
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
