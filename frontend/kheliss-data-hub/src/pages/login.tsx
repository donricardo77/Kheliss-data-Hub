import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wifi, Shield, Zap, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

const schema = z.object({
  emailOrPhone: z.string().min(1, "This field is required"),
  password: z.string().min(1, "Password is required"),
});
type FormData = z.infer<typeof schema>;

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const loginMutation = useLogin();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { emailOrPhone: "", password: "" },
  });

  const onSubmit = (data: FormData) => {
    loginMutation.mutate({ data }, {
      onSuccess: (res) => {
        // Store token in localStorage for mobile persistence
        if (res.token) {
          localStorage.setItem('token', res.token);
        }
        login(res.user);
        setLocation(res.user.role === "admin" ? "/admin" : "/dashboard");
      },
      onError: (err: any) => {
        const errorCode = err?.response?.data?.code;
        const errorMessage = err?.response?.data?.error;
        let title = "Login failed";
        let description = errorMessage || "Invalid credentials";

        // Provide specific error messages based on error code
        if (errorCode === "USER_NOT_FOUND") {
          title = "Account not found";
          description = "The username, email or phone number is not registered. Please check and try again or create a new account.";
        } else if (errorCode === "INVALID_PASSWORD") {
          title = "Incorrect password";
          description = "The password you entered is incorrect. Please try again.";
        }

        toast({ title, description, variant: "destructive" });
      },
    });
  };

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[52%] flex-col bg-sidebar relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute top-1/2 -right-20 w-96 h-96 rounded-full bg-purple-600/10 blur-3xl" />
          <div className="absolute -bottom-20 left-1/4 w-72 h-72 rounded-full bg-blue-400/10 blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col h-full p-12">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
              <span className="text-white font-black text-xl">E</span>
            </div>
            <div>
              <p className="text-white font-bold text-xl leading-tight">Kheliss data Hub</p>
              <p className="text-white/40 text-xs">Premium Data Services</p>
            </div>
          </div>

          {/* Main copy */}
          <div className="flex-1 flex flex-col justify-center">
            <p className="text-white/50 text-sm font-semibold tracking-widest uppercase mb-4">
              Ghana's #1 Platform
            </p>
            <h1 className="text-4xl xl:text-5xl font-black text-white leading-tight mb-6">
              Top up any<br />
              <span className="text-primary">network.</span><br />
              Instantly.
            </h1>
            <p className="text-white/60 text-lg leading-relaxed mb-10 max-w-md">
              Buy data bundles for MTN, Telecel, and AirtelTigo at the best prices in Ghana.
            </p>

            {/* Feature points */}
            <div className="space-y-4">
              {[
                { icon: Zap, text: "Instant delivery — no waiting", color: "text-yellow-400" },
                { icon: Shield, text: "Secure & trusted by 10,000+ users", color: "text-green-400" },
                { icon: Wifi, text: "All networks: MTN · Telecel · AirtelTigo", color: "text-blue-400" },
              ].map(({ icon: Icon, text, color }) => (
                <div key={text} className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center shrink-0">
                    <Icon className={`h-4.5 w-4.5 ${color}`} />
                  </div>
                  <p className="text-white/70 text-sm">{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Network badges */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/8 rounded-full px-4 py-2">
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <span className="text-white/70 text-xs font-medium">MTN</span>
            </div>
            <div className="flex items-center gap-2 bg-white/8 rounded-full px-4 py-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-white/70 text-xs font-medium">Telecel</span>
            </div>
            <div className="flex items-center gap-2 bg-white/8 rounded-full px-4 py-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-white/70 text-xs font-medium">AirtelTigo</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-background">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-white font-black text-lg">E</span>
          </div>
          <span className="font-bold text-xl text-foreground">Kheliss data Hub</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-black text-foreground mb-1">Welcome back</h2>
            <p className="text-muted-foreground text-sm">Sign in to your account</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="emailOrPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-foreground/80">
                      Username, Email or Phone
                    </FormLabel>
                    <FormControl>
                      <Input
                        data-testid="input-email-or-phone"
                        placeholder="Enter username, email or phone"
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
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between mb-1.5">
                      <FormLabel className="text-sm font-semibold text-foreground/80">Password</FormLabel>
                      <Link href="/forgot-password" className="text-xs text-primary hover:underline font-medium">
                        Forgot?
                      </Link>
                    </div>
                    <FormControl>
                      <div className="relative">
                        <Input
                          data-testid="input-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          className="h-11 bg-card border-border/80 focus:border-primary pr-10"
                          {...field}
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary focus:outline-none"
                          tabIndex={-1}
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                data-testid="button-login"
                type="submit"
                className="w-full h-11 font-semibold shadow-lg shadow-primary/25"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Signing in...</>
                ) : "Sign In"}
              </Button>
            </form>
          </Form>

          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link href="/register" className="text-primary font-semibold hover:underline">
                Create one free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
