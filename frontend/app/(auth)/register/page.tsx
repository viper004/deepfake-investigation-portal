"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  User, 
  Mail, 
  Lock, 
  Building, 
  Phone, 
  ArrowRight, 
  ShieldAlert, 
  Briefcase, 
  FileText, 
  Upload,
  CheckCircle,
  FileCheck
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

export default function RegisterPage() {
  const router = useRouter();
  const [flow, setFlow] = useState<"user" | "investigator" | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isUpgrade, setIsUpgrade] = useState(false);
  const [tokenVerifying, setTokenVerifying] = useState(false);

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    confirm_password: "",
    phone: "",
    organization: "",
    department: "",
    designation: "",
    employee_id: "",
  });

  const [profilePicFile, setProfilePicFile] = useState<File | null>(null);
  const [govIdFile, setGovIdFile] = useState<File | null>(null);

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [bgImage, setBgImage] = useState("/images/auth/cyber2.png");

  // OTP Verification States
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpSuccess, setOtpSuccess] = useState("");
  const [otpCountdown, setOtpCountdown] = useState(0); // 300s (5 min)
  const [resendCountdown, setResendCountdown] = useState(0); // 60s
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: "success" | "error" }>>([]);

  const showToast = (message: string, type: "success" | "error") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  useEffect(() => {
    let interval: any = null;
    if (otpCountdown > 0 || resendCountdown > 0) {
      interval = setInterval(() => {
        setOtpCountdown((prev) => (prev > 0 ? prev - 1 : 0));
        setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [otpCountdown, resendCountdown]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSendOTP = async () => {
    const email = formData.email.trim();
    const emailRegex = /^[\w\.-]+@[\w\.-]+\.\w+$/;
    if (!email || !emailRegex.test(email)) {
      setOtpError("Please enter a valid email address.");
      showToast("Please enter a valid email address.", "error");
      return;
    }

    try {
      setOtpSending(true);
      setOtpError("");
      setOtpSuccess("");

      const res = await fetch(`${BACKEND_URL}/api/v1/auth/send-email-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorDetail = data.detail || "Failed to send verification code.";
        setOtpError(errorDetail);
        showToast(errorDetail, "error");
        return;
      }

      setOtpSent(true);
      setOtpCountdown(300); // 5 minutes
      setResendCountdown(60); // 60 seconds
      setOtpSuccess("Verification code sent to your email.");
      showToast("Verification code sent to your email.", "success");
    } catch (err) {
      setOtpError("Error sending verification code. Please try again.");
      showToast("Error sending verification code.", "error");
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOTP = async () => {
    const email = formData.email.trim();
    if (!otpCode || otpCode.length !== 6) {
      setOtpError("Please enter a valid 6-digit verification code.");
      showToast("Please enter a 6-digit OTP code.", "error");
      return;
    }

    try {
      setOtpVerifying(true);
      setOtpError("");
      setOtpSuccess("");

      const res = await fetch(`${BACKEND_URL}/api/v1/auth/verify-email-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: otpCode.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorDetail = data.detail || "Invalid verification code.";
        setOtpError(errorDetail);
        showToast(errorDetail, "error");
        return;
      }

      setIsEmailVerified(true);
      setOtpSent(false);
      setOtpSuccess("Email verified successfully!");
      showToast("Email verified successfully!", "success");
    } catch (err) {
      setOtpError("Network error verifying code. Please try again.");
      showToast("Error verifying OTP.", "error");
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCountdown > 0) return;
    await handleSendOTP();
  };

  useEffect(() => {
    const images = [
      "/images/auth/cyber1.png",
      "/images/auth/cyber2.png",
      "/images/auth/cyber3.png",
    ];
    setBgImage(images[Math.floor(Math.random() * images.length)]);

    // Check search params
    const params = new URLSearchParams(window.location.search);
    const f = params.get("flow");
    const t = params.get("token");
    if (t) {
      setToken(t);
      setFlow("investigator");
      setTokenVerifying(true);
      fetch(`${BACKEND_URL}/api/v1/auth/verify-invitation?token=${t}`)
        .then(res => res.json())
        .then(data => {
          if (data.email) {
            setFormData(prev => ({ ...prev, email: data.email, full_name: data.full_name || prev.full_name }));
            setIsUpgrade(!!data.is_upgrade);
            setIsEmailVerified(true); // Pre-verified via secure invitation token
          } else {
            setError(data.detail || "Invalid token");
          }
        })
        .catch(() => setError("Failed to verify invitation token"))
        .finally(() => setTokenVerifying(false));
    } else if (f === "investigator") {
      setFlow("investigator");
    } else {
      setFlow("user");
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.name === "email") {
      setIsEmailVerified(false);
      setOtpSent(false);
      setOtpCode("");
      setOtpError("");
      setOtpSuccess("");
    }
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMsg("");

    if (flow === "user" && !isEmailVerified) {
      setError("Please verify your email address before completing registration.");
      showToast("Please verify your email address first.", "error");
      setLoading(false);
      return;
    }

    if (!isUpgrade && formData.password !== formData.confirm_password) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (flow === "user" && !profilePicFile) {
      setError("Profile picture is required for User registration");
      setLoading(false);
      return;
    }

    if (flow === "investigator" && !govIdFile) {
      setError("Government ID file is required for Investigator applications");
      setLoading(false);
      return;
    }

    try {
      const dataToSend = new FormData();
      dataToSend.append("full_name", formData.full_name);
      dataToSend.append("email", formData.email);
      dataToSend.append("password", formData.password);
      if (formData.phone) dataToSend.append("phone", formData.phone);
      
      if (profilePicFile) {
        dataToSend.append("profile_picture_file", profilePicFile);
      }

      let endpoint = `${BACKEND_URL}/api/v1/auth/register/user`;

      if (flow === "investigator") {
        if (!token) {
          setError("Investigator registration requires a valid invitation token.");
          setLoading(false);
          return;
        }
        endpoint = `${BACKEND_URL}/api/v1/auth/register/investigator`;
        dataToSend.append("invitation_token", token);
        dataToSend.append("organization", formData.organization);
        dataToSend.append("department", formData.department);
        dataToSend.append("designation", formData.designation);
        dataToSend.append("employee_id", formData.employee_id);
        if (govIdFile) {
          dataToSend.append("government_id_file", govIdFile);
        }
      }

      const res = await fetch(endpoint, {
        method: "POST",
        body: dataToSend,
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.detail || "Registration failed");
        showToast(data.detail || "Registration failed", "error");
        setLoading(false);
        return;
      }
      
      setSuccessMsg(data.message);
      showToast(data.message || "Registration completed successfully!", "success");
      
      if (flow === "user") {
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      showToast("An unexpected error occurred.", "error");
    } finally {
      setLoading(false);
    }
  };

  if (flow === null || tokenVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#CC2200]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#fafafa]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Left side: Image */}
      <div className="hidden md:block md:w-1/2 relative bg-black">
        <div 
          className="absolute inset-0 bg-cover bg-center transition-all duration-1000 opacity-90"
          style={{ backgroundImage: `url(${bgImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        <div className="absolute bottom-16 left-16 right-16 text-white">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full border border-white/20 bg-white/10 backdrop-blur-md text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse inline-block" />
            {flow === "investigator" ? "Secure Investigator Verification" : "Secure Member Signup"}
          </div>
          <h3 className="text-3xl font-bold tracking-tight mb-3">
            {flow === "investigator" ? "Join as Forensic Expert" : "Protect Your Digital Identity"}
          </h3>
          <p className="text-white/70 leading-relaxed max-w-md">
            {flow === "investigator" 
              ? "Apply for professional access to Sentinel AI's forensic tools and AI-powered media analysis platform."
              : "Submit media scans, track deepfake case files, and secure metadata provenance reports instantly."
            }
          </p>
        </div>
      </div>

      {/* Right side: Form */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-20 bg-white text-[#0a0a0a] z-10 border-l border-[#e5e5e5] py-12 overflow-y-auto">
        <div className="w-full max-w-xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-8 h-8 bg-[#CC2200] rounded flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <span className="font-bold text-lg tracking-tight">Sentinel AI</span>
          </div>

          {successMsg ? (
            <div className="text-center py-10 px-6 border border-[#e5e5e5] rounded-xl bg-[#fafafa] shadow-sm">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
                <CheckCircle className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-bold text-[#0a0a0a] mb-3">Application Submitted</h3>
              <p className="text-sm text-[#0a0a0a]/70 leading-relaxed max-w-md mx-auto mb-8">
                {successMsg}
              </p>
              {flow === "user" ? (
                <p className="text-xs text-[#0a0a0a]/40 animate-pulse">Redirecting to login portal...</p>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex justify-center items-center py-2.5 px-6 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-[#CC2200] hover:bg-[#CC2200]/95 transition-all"
                >
                  Return to Login
                </Link>
              )}
            </div>
          ) : (
            <>
              <h2 className="text-3xl font-bold tracking-tight mb-2">
                {flow === "investigator" ? "Apply as Investigator" : "Register User Account"}
              </h2>
              <p className="text-sm text-[#0a0a0a]/60 mb-8">
                {flow === "investigator" 
                  ? "Provide forensic credentials for portal approval"
                  : "Sign up to track investigations and scan media"
                }
              </p>

              {/* Investigator banner */}
              {flow === "investigator" && (
                <div className="bg-[#CC2200]/5 border border-[#CC2200]/15 rounded-md p-3.5 text-xs text-[#CC2200] font-semibold flex items-start gap-2.5 mb-6">
                  <ShieldAlert className="h-4.5 w-4.5 flex-shrink-0 mt-0.5" />
                  <span>Investigator accounts require administrator approval before access is granted.</span>
                </div>
              )}

              <form className="space-y-5" onSubmit={handleSubmit}>
                {error && (
                  <div className="bg-[#CC2200]/10 border border-[#CC2200]/20 rounded-md p-3 text-sm text-[#CC2200] font-medium text-center">
                    {error}
                  </div>
                )}
                
                <div className="grid grid-cols-1 gap-y-4 sm:grid-cols-2 sm:gap-x-4">
                  {/* Full Name */}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-[#0a0a0a]/80 mb-1.5">
                      Full Name *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-[#0a0a0a]/40" />
                      </div>
                      <input
                        type="text"
                        name="full_name"
                        required
                        readOnly={!!token && !isUpgrade && !!formData.full_name}
                        value={formData.full_name}
                        onChange={handleChange}
                        className="block w-full pl-10 bg-[#fafafa] border border-[#e5e5e5] rounded-md py-2.5 text-[#0a0a0a] focus:ring-1 focus:ring-[#CC2200] focus:border-[#CC2200] sm:text-sm transition-colors outline-none disabled:opacity-50"
                        placeholder="Jane Doe"
                      />
                    </div>
                  </div>

                  {/* Email & OTP Verification */}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-[#0a0a0a]/80 mb-1.5 flex justify-between items-center">
                      <span>Email address *</span>
                      {isEmailVerified && (
                        <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                          <CheckCircle className="h-3.5 w-3.5" />
                          Verified
                        </span>
                      )}
                    </label>

                    {isEmailVerified ? (
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Mail className="h-5 w-5 text-emerald-600" />
                          </div>
                          <input
                            type="email"
                            name="email"
                            required
                            readOnly={true}
                            value={formData.email}
                            className="block w-full pl-10 pr-24 bg-emerald-50/60 border border-emerald-300 text-emerald-950 font-semibold rounded-md py-2.5 sm:text-sm outline-none cursor-not-allowed"
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1 border border-emerald-300">
                              ✅ Email Verified
                            </span>
                          </div>
                        </div>
                        {!token && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsEmailVerified(false);
                              setOtpSent(false);
                              setOtpCode("");
                              setOtpError("");
                              setOtpSuccess("");
                            }}
                            className="px-3 py-2.5 text-xs text-[#0a0a0a]/60 hover:text-[#CC2200] font-semibold border border-slate-200 hover:border-[#CC2200] rounded-md transition-colors bg-white shadow-sm"
                          >
                            Edit Email
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <Mail className="h-5 w-5 text-[#0a0a0a]/40" />
                            </div>
                            <input
                              type="email"
                              name="email"
                              required
                              readOnly={!!token || otpSent}
                              value={formData.email}
                              onChange={handleChange}
                              className={`block w-full pl-10 border border-[#e5e5e5] rounded-md py-2.5 text-[#0a0a0a] focus:ring-1 focus:ring-[#CC2200] focus:border-[#CC2200] sm:text-sm transition-colors outline-none ${token || otpSent ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-[#fafafa]'}`}
                              placeholder={flow === "investigator" ? "jane.doe@agency.gov" : "jane.doe@email.com"}
                            />
                          </div>
                          {!token && flow === "user" && (
                            <button
                              type="button"
                              disabled={otpSending || !formData.email || otpSent}
                              onClick={handleSendOTP}
                              className="flex justify-center items-center px-4 py-2.5 border border-[#CC2200] text-[#CC2200] hover:bg-[#CC2200] hover:text-white rounded-md text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shadow-sm"
                            >
                              {otpSending ? (
                                <span className="flex items-center gap-1.5">
                                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent animate-spin rounded-full" />
                                  Sending...
                                </span>
                              ) : (
                                "Verify Email"
                              )}
                            </button>
                          )}
                        </div>

                        {/* OTP Input & Verification Box */}
                        {otpSent && !isEmailVerified && (
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg shadow-sm space-y-3">
                            <div className="flex justify-between items-center text-xs font-semibold text-[#0a0a0a]/80">
                              <span>Enter 6-digit OTP sent to your email:</span>
                              {otpCountdown > 0 ? (
                                <span className="text-[#CC2200] font-bold bg-[#CC2200]/10 px-2 py-0.5 rounded">
                                  Expires in {formatTime(otpCountdown)}
                                </span>
                              ) : (
                                <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded">
                                  Code expired
                                </span>
                              )}
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2">
                              <input
                                type="text"
                                maxLength={6}
                                value={otpCode}
                                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                                placeholder="123456"
                                className="flex-1 bg-white border border-slate-300 rounded-md px-3 py-2 text-center text-lg font-mono tracking-widest text-[#0a0a0a] focus:border-[#CC2200] focus:ring-1 focus:ring-[#CC2200] outline-none shadow-inner"
                              />
                              <button
                                type="button"
                                disabled={otpVerifying || otpCode.length !== 6 || otpCountdown === 0}
                                onClick={handleVerifyOTP}
                                className="px-5 py-2 bg-[#CC2200] hover:bg-[#CC2200]/90 text-white rounded-md text-xs font-bold transition-colors disabled:opacity-50 shadow-sm flex items-center justify-center gap-1.5"
                              >
                                {otpVerifying ? (
                                  <>
                                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent animate-spin rounded-full" />
                                    Verifying...
                                  </>
                                ) : (
                                  "Verify OTP"
                                )}
                              </button>
                            </div>

                            <div className="flex justify-between items-center text-xs pt-1">
                              {resendCountdown > 0 ? (
                                <span className="text-[#0a0a0a]/50 font-medium">
                                  Resend OTP in {resendCountdown}s
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={handleResendOTP}
                                  className="text-[#CC2200] font-bold hover:underline"
                                >
                                  Resend OTP
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => { setOtpSent(false); setOtpCode(""); setOtpError(""); }}
                                className="text-[#0a0a0a]/40 hover:text-[#0a0a0a]/70 font-medium"
                              >
                                Change Email
                              </button>
                            </div>

                            {otpError && (
                              <p className="text-xs text-rose-600 font-semibold bg-rose-50 p-2 rounded border border-rose-100">{otpError}</p>
                            )}
                            {otpSuccess && (
                              <p className="text-xs text-emerald-600 font-semibold bg-emerald-50 p-2 rounded border border-emerald-100">{otpSuccess}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-[#0a0a0a]/80 mb-1.5">
                      Phone Number {flow === "investigator" ? "*" : "(Optional)"}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone className="h-5 w-5 text-[#0a0a0a]/40" />
                      </div>
                      <input
                        type="tel"
                        name="phone"
                        required={flow === "investigator"}
                        value={formData.phone}
                        onChange={handleChange}
                        className="block w-full pl-10 bg-[#fafafa] border border-[#e5e5e5] rounded-md py-2.5 text-[#0a0a0a] focus:ring-1 focus:ring-[#CC2200] focus:border-[#CC2200] sm:text-sm transition-colors outline-none"
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>
                  </div>

                  {/* Investigator Fields */}
                  {flow === "investigator" && (
                    <>
                      {/* Organization */}
                      <div>
                        <label className="block text-sm font-semibold text-[#0a0a0a]/80 mb-1.5">
                          Organization/Agency *
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Building className="h-5 w-5 text-[#0a0a0a]/40" />
                          </div>
                          <input
                            type="text"
                            name="organization"
                            required
                            value={formData.organization}
                            onChange={handleChange}
                            className="block w-full pl-10 bg-[#fafafa] border border-[#e5e5e5] rounded-md py-2.5 text-[#0a0a0a] focus:ring-1 focus:ring-[#CC2200] focus:border-[#CC2200] sm:text-sm transition-colors outline-none"
                            placeholder="Federal Bureau..."
                          />
                        </div>
                      </div>

                      {/* Department */}
                      <div>
                        <label className="block text-sm font-semibold text-[#0a0a0a]/80 mb-1.5">
                          Department *
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Briefcase className="h-5 w-5 text-[#0a0a0a]/40" />
                          </div>
                          <input
                            type="text"
                            name="department"
                            required
                            value={formData.department}
                            onChange={handleChange}
                            className="block w-full pl-10 bg-[#fafafa] border border-[#e5e5e5] rounded-md py-2.5 text-[#0a0a0a] focus:ring-1 focus:ring-[#CC2200] focus:border-[#CC2200] sm:text-sm transition-colors outline-none"
                            placeholder="Cyber Crime Div"
                          />
                        </div>
                      </div>

                      {/* Designation */}
                      <div>
                        <label className="block text-sm font-semibold text-[#0a0a0a]/80 mb-1.5">
                          Designation *
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Briefcase className="h-5 w-5 text-[#0a0a0a]/40" />
                          </div>
                          <input
                            type="text"
                            name="designation"
                            required
                            value={formData.designation}
                            onChange={handleChange}
                            className="block w-full pl-10 bg-[#fafafa] border border-[#e5e5e5] rounded-md py-2.5 text-[#0a0a0a] focus:ring-1 focus:ring-[#CC2200] focus:border-[#CC2200] sm:text-sm transition-colors outline-none"
                            placeholder="Lead Forensic Analyst"
                          />
                        </div>
                      </div>

                      {/* Employee ID */}
                      <div>
                        <label className="block text-sm font-semibold text-[#0a0a0a]/80 mb-1.5">
                          Employee / Badge ID *
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <FileText className="h-5 w-5 text-[#0a0a0a]/40" />
                          </div>
                          <input
                            type="text"
                            name="employee_id"
                            required
                            value={formData.employee_id}
                            onChange={handleChange}
                            className="block w-full pl-10 bg-[#fafafa] border border-[#e5e5e5] rounded-md py-2.5 text-[#0a0a0a] focus:ring-1 focus:ring-[#CC2200] focus:border-[#CC2200] sm:text-sm transition-colors outline-none"
                            placeholder="EMP-882910"
                          />
                        </div>
                      </div>

                      {/* Government ID Upload */}
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-semibold text-[#0a0a0a]/80 mb-1.5">
                          Government ID Verification Document *
                        </label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-[#e5e5e5] border-dashed rounded-md bg-[#fafafa] hover:bg-[#fafafa]/50 transition-colors relative">
                          <div className="space-y-1 text-center">
                            {govIdFile ? (
                              <div className="flex flex-col items-center">
                                <FileCheck className="mx-auto h-12 w-12 text-[#CC2200]" />
                                <div className="flex text-sm text-[#0a0a0a] mt-2 font-medium">
                                  <span>{govIdFile.name}</span>
                                </div>
                                <p className="text-xs text-[#0a0a0a]/50 mt-1">{(govIdFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                <button 
                                  type="button"
                                  onClick={() => setGovIdFile(null)}
                                  className="text-xs text-[#CC2200] font-semibold mt-2 hover:underline"
                                >
                                  Remove File
                                </button>
                              </div>
                            ) : (
                              <>
                                <Upload className="mx-auto h-10 w-10 text-[#0a0a0a]/30" />
                                <div className="flex text-sm text-[#0a0a0a]/60 justify-center">
                                  <label htmlFor="gov-id-upload" className="relative cursor-pointer bg-transparent rounded-md font-semibold text-[#CC2200] hover:text-[#CC2200]/80">
                                    <span>Upload a document</span>
                                    <input 
                                      id="gov-id-upload" 
                                      name="gov-id-upload" 
                                      type="file" 
                                      required
                                      accept=".pdf,image/*"
                                      className="sr-only" 
                                      onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                          setGovIdFile(e.target.files[0]);
                                        }
                                      }}
                                    />
                                  </label>
                                  <p className="pl-1">or drag and drop</p>
                                </div>
                                <p className="text-xs text-[#0a0a0a]/40">PDF, PNG, JPG up to 10MB</p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Profile Picture */}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-[#0a0a0a]/80 mb-1.5">
                      {flow === "user" ? "Profile Picture *" : "Profile Picture (Optional)"}
                    </label>
                    <div className="mt-1 flex items-center gap-4">
                      {profilePicFile ? (
                        <div className="relative w-16 h-16 rounded-full overflow-hidden border border-[#e5e5e5] bg-[#fafafa] flex items-center justify-center">
                          <img 
                            src={URL.createObjectURL(profilePicFile)} 
                            alt="Preview" 
                            className="object-cover w-full h-full"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-[#fafafa] border border-[#e5e5e5] flex items-center justify-center text-[#0a0a0a]/30">
                          <User className="h-8 w-8" />
                        </div>
                      )}
                      <div>
                        <label 
                          htmlFor="profile-pic-upload"
                          className="cursor-pointer inline-flex items-center px-3 py-1.5 border border-[#e5e5e5] rounded shadow-sm text-xs font-semibold text-[#0a0a0a]/80 bg-white hover:bg-[#fafafa] transition-colors"
                        >
                          Choose Image
                          <input 
                            id="profile-pic-upload"
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                setProfilePicFile(e.target.files[0]);
                              }
                            }}
                          />
                        </label>
                        {profilePicFile && (
                          <button
                            type="button"
                            onClick={() => setProfilePicFile(null)}
                            className="text-xs text-[#CC2200] font-semibold ml-3 hover:underline"
                          >
                            Remove
                          </button>
                        )}
                        <p className="text-[11px] text-[#0a0a0a]/40 mt-1">Square JPG/PNG, max 2MB</p>
                      </div>
                    </div>
                  </div>

                  {/* Password fields only if not upgrading */}
                  {!isUpgrade && (
                    <>
                      {/* Password */}
                      <div>
                        <label className="block text-sm font-semibold text-[#0a0a0a]/80 mb-1.5">
                          Password *
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Lock className="h-5 w-5 text-[#0a0a0a]/40" />
                          </div>
                          <input
                            type="password"
                            name="password"
                            required
                            value={formData.password}
                            onChange={handleChange}
                            className="block w-full pl-10 bg-[#fafafa] border border-[#e5e5e5] rounded-md py-2.5 text-[#0a0a0a] focus:ring-1 focus:ring-[#CC2200] focus:border-[#CC2200] sm:text-sm transition-colors outline-none"
                            placeholder="••••••••"
                          />
                        </div>
                      </div>

                      {/* Confirm Password */}
                      <div>
                        <label className="block text-sm font-semibold text-[#0a0a0a]/80 mb-1.5">
                          Confirm Password *
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Lock className="h-5 w-5 text-[#0a0a0a]/40" />
                          </div>
                          <input
                            type="password"
                            name="confirm_password"
                            required
                            value={formData.confirm_password}
                            onChange={handleChange}
                            className="block w-full pl-10 bg-[#fafafa] border border-[#e5e5e5] rounded-md py-2.5 text-[#0a0a0a] focus:ring-1 focus:ring-[#CC2200] focus:border-[#CC2200] sm:text-sm transition-colors outline-none"
                            placeholder="••••••••"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={loading || (flow === "user" && !isEmailVerified)}
                    className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-[#CC2200] hover:bg-[#CC2200]/95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#CC2200] transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    {loading 
                      ? (flow === "investigator" ? "Submitting Application..." : "Registering Account...") 
                      : (flow === "investigator" ? "Submit Application" : "Register as User")
                    }
                    {!loading && <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />}
                  </button>
                  {flow === "user" && !isEmailVerified && (
                    <p className="text-xs text-[#0a0a0a]/50 text-center mt-2 font-medium">
                      * Verify your email address above to enable registration
                    </p>
                  )}
                </div>
              </form>

              <div className="mt-8 text-center text-sm font-medium text-[#0a0a0a]/60">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="text-[#CC2200] font-semibold hover:text-[#CC2200]/80 transition-colors"
                >
                  Return to Login &rarr;
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Floating Toast Notification Stack */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-lg shadow-xl border text-xs font-bold flex items-center gap-3 transition-all duration-300 transform translate-y-0 ${
              t.type === "success"
                ? "bg-emerald-900 text-white border-emerald-700"
                : "bg-[#CC2200] text-white border-red-800"
            }`}
          >
            {t.type === "success" ? (
              <CheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-400" />
            ) : (
              <ShieldAlert className="h-4 w-4 flex-shrink-0 text-red-300" />
            )}
            <span className="flex-1">{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
