import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation, useSearch } from "wouter";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";

const schema = z
  .object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    passwordConfirm: z.string().min(6, "Please confirm your password"),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Passwords don't match",
    path: ["passwordConfirm"],
  });

type FormData = z.infer<typeof schema>;

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", passwordConfirm: "" },
  });

  // Get token and userId from URL params
  const params = new URLSearchParams(search);
  const token = params.get("token");
  const userId = params.get("userId");

  useEffect(() => {
    if (!token || !userId) {
      setTokenError("Invalid or missing reset link");
    }
  }, [token, userId]);

  const onSubmit = async (data: FormData) => {
    if (!token || !userId) {
      setTokenError("Invalid reset link");
      return;
    }

    setIsLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080";
      const response = await fetch(`${apiUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          userId,
          password: data.password,
          passwordConfirm: data.passwordConfirm,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reset password");
      }

      setIsSuccess(true);
      toast({
        title: "Success",
        description: "Your password has been reset successfully",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to reset password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (tokenError) {
    return (
      <div className="min-h-screen flex">
        {/* Left brand panel */}
        <div className="hidden lg:flex lg:w-[52%] flex-col bg-sidebar relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute top-1/2 -right-20 w-96 h-96 rounded-full bg-purple-600/10 blur-3xl" />
            <div className="absolute -bottom-20 left-1/4 w-72 h-72 rounded-full bg-blue-400/10 blur-3xl" />
          </div>

          <div className="relative z-10 flex flex-col h-full p-12">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
                <span className="text-white font-black text-xl">E</span>
              </div>
              <div>
                <p className="text-white font-bold text-xl leading-tight">Kheliss data Hub</p>
                <p className="text-white/40 text-xs">Premium Data Services</p>
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-center">
              <p className="text-white/50 text-sm font-semibold tracking-widest uppercase mb-4">
                Oops!
              </p>
              <h1 className="text-4xl xl:text-5xl font-black text-white leading-tight mb-6">
                Invalid reset<br />
                <span className="text-primary">link.</span>
              </h1>
              <p className="text-white/60 text-lg leading-relaxed mb-10 max-w-md">
                The password reset link is invalid or has expired. Please try again.
              </p>
            </div>
          </div>
        </div>

        {/* Right error message */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-background">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-white font-black text-lg">E</span>
            </div>
            <span className="font-bold text-xl text-foreground">Kheliss data Hub</span>
          </div>

          <div className="w-full max-w-sm">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <AlertCircle className="h-16 w-16 text-red-500" />
              </div>
              <h2 className="text-2xl font-black text-foreground mb-2">Link expired</h2>
              <p className="text-muted-foreground text-sm">
                {tokenError}
              </p>
            </div>

            <Button
              onClick={() => setLocation("/forgot-password")}
              className="w-full h-11 font-semibold shadow-lg shadow-primary/25 mb-3"
            >
              Try again
            </Button>

            <Button
              onClick={() => setLocation("/login")}
              variant="outline"
              className="w-full h-11 font-semibold"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex">
        {/* Left brand panel */}
        <div className="hidden lg:flex lg:w-[52%] flex-col bg-sidebar relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute top-1/2 -right-20 w-96 h-96 rounded-full bg-purple-600/10 blur-3xl" />
            <div className="absolute -bottom-20 left-1/4 w-72 h-72 rounded-full bg-blue-400/10 blur-3xl" />
          </div>

          <div className="relative z-10 flex flex-col h-full p-12">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
                <span className="text-white font-black text-xl">E</span>
              </div>
              <div>
                <p className="text-white font-bold text-xl leading-tight">Kheliss data Hub</p>
                <p className="text-white/40 text-xs">Premium Data Services</p>
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-center">
              <p className="text-white/50 text-sm font-semibold tracking-widest uppercase mb-4">
                Success!
              </p>
              <h1 className="text-4xl xl:text-5xl font-black text-white leading-tight mb-6">
                Password<br />
                <span className="text-primary">reset.</span>
              </h1>
              <p className="text-white/60 text-lg leading-relaxed mb-10 max-w-md">
                Your password has been successfully reset. You can now log in with your new password.
              </p>
            </div>
          </div>
        </div>

        {/* Right success message */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-background">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-white font-black text-lg">K</span>
            </div>
            <span className="font-bold text-xl text-foreground">Kheliss data Hub</span>
          </div>

          <div className="w-full max-w-sm">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <CheckCircle className="h-16 w-16 text-green-500" />
              </div>
              <h2 className="text-2xl font-black text-foreground mb-2">Password reset!</h2>
              <p className="text-muted-foreground text-sm">
                Your password has been successfully updated. You can now log in with your new password.
              </p>
            </div>

            <Button
              onClick={() => setLocation("/login")}
              className="w-full h-11 font-semibold shadow-lg shadow-primary/25"
            >
              Go to login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[52%] flex-col bg-sidebar relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute top-1/2 -right-20 w-96 h-96 rounded-full bg-purple-600/10 blur-3xl" />
          <div className="absolute -bottom-20 left-1/4 w-72 h-72 rounded-full bg-blue-400/10 blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col h-full p-12">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
              <span className="text-white font-black text-xl">E</span>
            </div>
            <div>
              <p className="text-white font-bold text-xl leading-tight">Kheliss data Hub</p>
              <p className="text-white/40 text-xs">Premium Data Services</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <p className="text-white/50 text-sm font-semibold tracking-widest uppercase mb-4">
              Create New Password
            </p>
            <h1 className="text-4xl xl:text-5xl font-black text-white leading-tight mb-6">
              Choose a strong<br />
              <span className="text-primary">new password.</span>
            </h1>
            <p className="text-white/60 text-lg leading-relaxed mb-10 max-w-md">
              Make sure it's unique and at least 6 characters long.
            </p>
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-background">
        <div className="lg:hidden flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-white font-black text-lg">E</span>
          </div>
          <span className="font-bold text-xl text-foreground">Kheliss data Hub</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-black text-foreground mb-1">Create a new password</h2>
            <p className="text-muted-foreground text-sm">Make sure it's secure and easy to remember</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-foreground/80">New Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter new password"
                        className="h-11 bg-card border-border/80 focus:border-primary"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="passwordConfirm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-foreground/80">
                      Confirm Password
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Confirm new password"
                        className="h-11 bg-card border-border/80 focus:border-primary"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-11 font-semibold shadow-lg shadow-primary/25"
                disabled={isLoading}
              >
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Resetting...</>
                ) : "Reset Password"}
              </Button>
            </form>
          </Form>

          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-sm text-muted-foreground">
              Know your password?{" "}
              <Link href="/login" className="text-primary font-semibold hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
