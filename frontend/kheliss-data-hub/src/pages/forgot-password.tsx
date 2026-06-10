import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import { useState } from "react";

const schema = z.object({
  email: z.string().email("Please enter a valid email address"),
});
type FormData = z.infer<typeof schema>;

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080";
      const response = await fetch(`${apiUrl}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email }),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send reset email");
      }

      setSentEmail(data.email);
      setIsSuccess(true);
      toast({
        title: "Success",
        description: "Password reset link sent to your email",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to send reset email",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

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
                Secure Reset
              </p>
              <h1 className="text-4xl xl:text-5xl font-black text-white leading-tight mb-6">
                Your password<br />
                <span className="text-primary">is safe.</span>
              </h1>
              <p className="text-white/60 text-lg leading-relaxed mb-10 max-w-md">
                We've sent a secure password reset link to your email. Follow the link to create a new password.
              </p>
            </div>
          </div>
        </div>

        {/* Right success message */}
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
                <CheckCircle className="h-16 w-16 text-green-500" />
              </div>
              <h2 className="text-2xl font-black text-foreground mb-2">Email sent!</h2>
              <p className="text-muted-foreground text-sm">
                We've sent a password reset link to<br />
                <span className="font-semibold text-foreground">{sentEmail}</span>
              </p>
            </div>

            <div className="bg-card border border-border/50 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-foreground mb-3">What's next?</h3>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="font-semibold text-primary">1.</span>
                  <span>Check your email (and spam folder)</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-primary">2.</span>
                  <span>Click the password reset link</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-primary">3.</span>
                  <span>Create a new password</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-primary">4.</span>
                  <span>Log in with your new password</span>
                </li>
              </ol>
            </div>

            <p className="text-xs text-muted-foreground text-center mb-6">
              The link expires in 1 hour
            </p>

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
              Secure Your Account
            </p>
            <h1 className="text-4xl xl:text-5xl font-black text-white leading-tight mb-6">
              Reset your<br />
              <span className="text-primary">password.</span>
            </h1>
            <p className="text-white/60 text-lg leading-relaxed mb-10 max-w-md">
              Enter your email address and we'll send you a link to reset your password.
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
            <h2 className="text-2xl font-black text-foreground mb-1">Forgot your password?</h2>
            <p className="text-muted-foreground text-sm">No problem. Enter your email and we'll help you reset it.</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-foreground/80">Email Address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="Enter your email address"
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
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
                ) : "Send Reset Link"}
              </Button>
            </form>
          </Form>

          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-sm text-muted-foreground">
              Remember your password?{" "}
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
