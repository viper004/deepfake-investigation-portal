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

export default function RegisterPage() {
  const router = useRouter();
  const [flow, setFlow] = useState<"user" | "investigator" | null>(null);

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
    if (f === "investigator") {
      setFlow("investigator");
    } else {
      setFlow("user");
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMsg("");

    if (formData.password !== formData.confirm_password) {
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

      let endpoint = "http://127.0.0.1:8000/api/v1/auth/register/user";

      if (flow === "investigator") {
        endpoint = "http://127.0.0.1:8000/api/v1/auth/register/investigator";
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
        setLoading(false);
        return;
      }
      
      setSuccessMsg(data.message);
      
      if (flow === "user") {
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (flow === null) {
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
              ? "Apply for professional access to DeepGuard's forensic tools and AI-powered media analysis platform."
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
            <span className="font-bold text-lg tracking-tight">DeepGuard</span>
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
                        value={formData.full_name}
                        onChange={handleChange}
                        className="block w-full pl-10 bg-[#fafafa] border border-[#e5e5e5] rounded-md py-2.5 text-[#0a0a0a] focus:ring-1 focus:ring-[#CC2200] focus:border-[#CC2200] sm:text-sm transition-colors outline-none"
                        placeholder="Jane Doe"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-[#0a0a0a]/80 mb-1.5">
                      Email address *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-[#0a0a0a]/40" />
                      </div>
                      <input
                        type="email"
                        name="email"
                        required
                        value={formData.email}
                        onChange={handleChange}
                        className="block w-full pl-10 bg-[#fafafa] border border-[#e5e5e5] rounded-md py-2.5 text-[#0a0a0a] focus:ring-1 focus:ring-[#CC2200] focus:border-[#CC2200] sm:text-sm transition-colors outline-none"
                        placeholder={flow === "investigator" ? "jane.doe@agency.gov" : "jane.doe@email.com"}
                      />
                    </div>
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
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-[#CC2200] hover:bg-[#CC2200]/95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#CC2200] transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    {loading 
                      ? (flow === "investigator" ? "Submitting Application..." : "Registering Account...") 
                      : (flow === "investigator" ? "Submit Application" : "Register as User")
                    }
                    {!loading && <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />}
                  </button>
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
    </div>
  );
}
