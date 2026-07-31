"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, Mail, Lock, Building, Phone, ArrowRight } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    confirm_password: "",
    phone: "",
    organization: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [bgImage, setBgImage] = useState("/images/auth/cyber2.png");

  useEffect(() => {
    const images = [
      "/images/auth/cyber1.png",
      "/images/auth/cyber2.png",
      "/images/auth/cyber3.png",
    ];
    setBgImage(images[Math.floor(Math.random() * images.length)]);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (formData.password !== formData.confirm_password) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: formData.full_name,
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
          organization: formData.organization,
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.detail || "Registration failed");
        setLoading(false);
        return;
      }
      
      router.push("/awaiting-approval");
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#fafafa]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Left side: Image (Swapped for register page to give visual variety) */}
      <div className="hidden md:block md:w-1/2 relative bg-black">
        <div 
          className="absolute inset-0 bg-cover bg-center transition-all duration-1000 opacity-90"
          style={{ backgroundImage: `url(${bgImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        <div className="absolute bottom-16 left-16 right-16 text-white">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full border border-white/20 bg-white/10 backdrop-blur-md text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse inline-block" />
            Secure Verification
          </div>
          <h3 className="text-3xl font-bold tracking-tight mb-3">Join the investigation</h3>
          <p className="text-white/70 leading-relaxed max-w-md">
            Apply for professional access to DeepGuard's forensic tools and AI-powered media analysis platform.
          </p>
        </div>
      </div>

      {/* Right side: Form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-20 bg-white text-[#0a0a0a] z-10 border-l border-[#e5e5e5] py-12">
        <div className="w-full max-w-xl mx-auto">
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-8 h-8 bg-[#CC2200] rounded flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <span className="font-bold text-lg tracking-tight">DeepGuard</span>
          </div>

          <h2 className="text-3xl font-bold tracking-tight mb-2">Apply for Access</h2>
          <p className="text-sm text-[#0a0a0a]/60 mb-8">
            Submit your credentials for forensic portal approval
          </p>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-[#CC2200]/10 border border-[#CC2200]/20 rounded-md p-3 text-sm text-[#CC2200] font-medium text-center">
                {error}
              </div>
            )}
            
            <div className="grid grid-cols-1 gap-y-5 sm:grid-cols-2 sm:gap-x-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-[#0a0a0a]/80 mb-1.5">
                  Full Name
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

              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-[#0a0a0a]/80 mb-1.5">
                  Email address
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
                    placeholder="jane.doe@agency.gov"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#0a0a0a]/80 mb-1.5">
                  Organization/Agency
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building className="h-5 w-5 text-[#0a0a0a]/40" />
                  </div>
                  <input
                    type="text"
                    name="organization"
                    value={formData.organization}
                    onChange={handleChange}
                    className="block w-full pl-10 bg-[#fafafa] border border-[#e5e5e5] rounded-md py-2.5 text-[#0a0a0a] focus:ring-1 focus:ring-[#CC2200] focus:border-[#CC2200] sm:text-sm transition-colors outline-none"
                    placeholder="Federal Bureau..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#0a0a0a]/80 mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-[#0a0a0a]/40" />
                  </div>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="block w-full pl-10 bg-[#fafafa] border border-[#e5e5e5] rounded-md py-2.5 text-[#0a0a0a] focus:ring-1 focus:ring-[#CC2200] focus:border-[#CC2200] sm:text-sm transition-colors outline-none"
                    placeholder="+1 (555) 000-0000"
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
                    name="password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="block w-full pl-10 bg-[#fafafa] border border-[#e5e5e5] rounded-md py-2.5 text-[#0a0a0a] focus:ring-1 focus:ring-[#CC2200] focus:border-[#CC2200] sm:text-sm transition-colors outline-none"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#0a0a0a]/80 mb-1.5">
                  Confirm Password
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
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-[#CC2200] hover:bg-[#CC2200]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#CC2200] transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {loading ? "Submitting Application..." : "Submit Application"}
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
        </div>
      </div>
    </div>
  );
}
