"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGoogleLogin } from '@react-oauth/google';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function SignupPage() {
  const router = useRouter();
  const [showCompleteProfile, setShowCompleteProfile] = useState(false);
  const [googleData, setGoogleData] = useState<any>(null);

  // For the standard form, handle submit
  const handleStandardSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Assuming HTML5 validation passed (all fields present)
    router.push('/dashboard');
  };

  // Google Login handling
  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      console.log('Google Login Success:', tokenResponse);
      // We simulate extracting Google Data and open the complete profile modal
      setGoogleData({ token: tokenResponse.access_token });
      setShowCompleteProfile(true);
    },
    onError: () => console.log('Google Login Failed'),
  });

  // Modal Submit
  const handleModalSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Form is complete, navigate to dashboard
    setShowCompleteProfile(false);
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 noise-overlay">
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Link href="/" className="flex items-center gap-2 text-sm text-foreground/60 hover:text-foreground transition-colors mb-8 w-fit mx-auto">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>
        <h2 className="mt-6 text-center text-3xl font-display font-extrabold text-foreground tracking-tight">
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-foreground/60">
          Already have an account?{' '}
          <a href="#" className="font-medium text-foreground hover:underline">
            Sign in
          </a>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl relative z-10">
        <div className="bg-card/50 backdrop-blur-md py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 border border-border/50">
          <form className="space-y-6" onSubmit={handleStandardSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First name</Label>
                <div className="mt-1">
                  <Input id="firstName" name="firstName" type="text" required className="bg-background/50 h-11" />
                </div>
              </div>

              <div>
                <Label htmlFor="lastName">Last name</Label>
                <div className="mt-1">
                  <Input id="lastName" name="lastName" type="text" required className="bg-background/50 h-11" />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email address</Label>
              <div className="mt-1">
                <Input id="email" name="email" type="email" autoComplete="email" required className="bg-background/50 h-11" />
              </div>
            </div>

            <div>
              <Label htmlFor="username">Username</Label>
              <div className="mt-1">
                <Input id="username" name="username" type="text" required className="bg-background/50 h-11" />
              </div>
            </div>

            <div>
              <Label htmlFor="phone">Phone number</Label>
              <div className="mt-1">
                <Input id="phone" name="phone" type="tel" required className="bg-background/50 h-11" />
              </div>
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="mt-1">
                <Input id="password" name="password" type="password" autoComplete="new-password" required className="bg-background/50 h-11" />
              </div>
            </div>

            <div>
              <Label htmlFor="photo">Profile Photo</Label>
              <div className="mt-1">
                <Input id="photo" name="photo" type="file" accept="image/*" required className="cursor-pointer file:text-foreground file:bg-background file:border-border file:border file:rounded-md file:px-4 file:py-1 hover:file:bg-muted bg-background/50 h-11 pt-1.5" />
              </div>
            </div>

            <div>
              <Button type="submit" className="w-full bg-foreground text-background hover:bg-foreground/90 rounded-full h-12 text-base font-medium transition-all hover:scale-[1.02]">
                Create account
              </Button>
            </div>
          </form>

          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-transparent text-foreground/60 backdrop-blur-md">Or continue with</span>
              </div>
            </div>

            <div className="mt-6">
              <Button onClick={() => login()} type="button" variant="outline" className="w-full h-12 text-base rounded-full gap-2 bg-background/50 hover:bg-background transition-all hover:scale-[1.02]">
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path
                    d="M12.0003 4.75C13.7703 4.75 15.3553 5.36 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86 8.87028 4.75 12.0003 4.75Z"
                    fill="#EA4335"
                  />
                  <path
                    d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z"
                    fill="#4285F4"
                  />
                  <path
                    d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.26538 14.29L1.27539 17.385C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z"
                    fill="#34A853"
                  />
                </svg>
                Google
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Complete Profile Modal */}
      <Dialog open={showCompleteProfile} onOpenChange={setShowCompleteProfile}>
        <DialogContent className="sm:max-w-md bg-card/80 backdrop-blur-xl border-border/50 noise-overlay max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Complete Profile</DialogTitle>
            <DialogDescription>
              Please provide the remaining details to finish creating your account.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4 py-4 relative z-10" onSubmit={handleModalSubmit}>
            <div>
              <Label htmlFor="modal-username">Username</Label>
              <div className="mt-1">
                <Input id="modal-username" name="username" type="text" required className="bg-background/50 h-11" />
              </div>
            </div>
            <div>
              <Label htmlFor="modal-phone">Phone number</Label>
              <div className="mt-1">
                <Input id="modal-phone" name="phone" type="tel" required className="bg-background/50 h-11" />
              </div>
            </div>
            <div>
              <Label htmlFor="modal-password">Password</Label>
              <div className="mt-1">
                <Input id="modal-password" name="password" type="password" required className="bg-background/50 h-11" />
              </div>
            </div>
            <div className="pt-4">
              <Button type="submit" className="w-full bg-foreground text-background hover:bg-foreground/90 rounded-full h-11">
                Finish Registration
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
