import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { useRegister } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Info, User, Briefcase, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

const schema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().regex(/^\d{10}$/, "Phone number must be exactly 10 digits"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["user", "agent"]),
});
type FormData = z.infer<typeof schema>;

export default function Register() {
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const registerMutation = useRegister();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", email: "", phone: "", password: "", role: "user" },
  });

  const selectedRole = form.watch("role");

  const onSubmit = (data: FormData) => {
    registerMutation.mutate({ data }, {
      onSuccess: (res) => {
        // Store token in localStorage for mobile persistence
        if (res.token) {
          localStorage.setItem('token', res.token);
        }
        login(res.user);
        toast({ title: "Account created!", description: "Welcome to Kheliss data Hub" });
        setLocation(res.user.role === "admin" ? "/admin" : "/dashboard");
      },
      onError: (err: any) => {
        const errorCode = err?.response?.data?.code;
        const errorMessage = err?.response?.data?.error;
        let title = "Registration failed";
        let description = errorMessage || "Unable to create account";

        // Provide specific error messages based on error code
        if (errorCode === "USERNAME_EXISTS") {
          title = "Username already taken";
          description = "This username is already in use. Please choose a different username.";
        } else if (errorCode === "EMAIL_EXISTS") {
          title = "Email already registered";
          description = "This email is already associated with an account. Please use a different email or try logging in.";
        } else if (errorCode === "PHONE_EXISTS") {
          title = "Phone number already registered";
          description = "This phone number is already associated with an account. Please use a different number or try logging in.";
        }

        toast({ title, description, variant: "destructive" });
      },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
            <span className="text-white font-black text-lg">E</span>
          </div>
          <span className="font-bold text-xl text-foreground">Kheliss data Hub</span>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          {/* Header */}
          <div className="bg-sidebar px-6 py-5">
            <h1 className="text-xl font-black text-white">Create Your Account</h1>
            <p className="text-white/50 text-sm mt-0.5">Join thousands of users & agents</p>
          </div>

          <div className="px-6 py-6">
            {/* Role selector first */}
            <div className="mb-6">
              <label className="text-sm font-semibold text-foreground/80 block mb-3">Account Type</label>
              <div className="grid grid-cols-2 gap-3">
                <label className={`flex items-center gap-3 border-2 rounded-xl p-3.5 cursor-pointer transition-all ${selectedRole === "user" ? "border-primary bg-primary/5" : "border-border hover:border-border/60"}`}>
                  <input
                    type="radio"
                    value="user"
                    checked={selectedRole === "user"}
                    onChange={() => form.setValue("role", "user")}
                    className="hidden"
                  />
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${selectedRole === "user" ? "bg-primary/15" : "bg-muted"}`}>
                    <User className={`h-4.5 w-4.5 ${selectedRole === "user" ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <p className={`font-semibold text-sm ${selectedRole === "user" ? "text-primary" : "text-foreground"}`}>User</p>
                    <p className="text-xs text-muted-foreground">Personal use</p>
                  </div>
                </label>
                <label className={`flex items-center gap-3 border-2 rounded-xl p-3.5 cursor-pointer transition-all ${selectedRole === "agent" ? "border-primary bg-primary/5" : "border-border hover:border-border/60"}`}>
                  <input
                    type="radio"
                    value="agent"
                    checked={selectedRole === "agent"}
                    onChange={() => form.setValue("role", "agent")}
                    className="hidden"
                  />
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${selectedRole === "agent" ? "bg-primary/15" : "bg-muted"}`}>
                    <Briefcase className={`h-4.5 w-4.5 ${selectedRole === "agent" ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <p className={`font-semibold text-sm ${selectedRole === "agent" ? "text-primary" : "text-foreground"}`}>Agent</p>
                    <p className="text-xs text-muted-foreground">Resell & earn</p>
                  </div>
                </label>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-foreground/70">Username</FormLabel>
                        <FormControl>
                          <Input data-testid="input-username" placeholder="johndoe" className="h-10" {...field} />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-foreground/70">Phone</FormLabel>
                        <FormControl>
                          <Input 
                            data-testid="input-phone" 
                            placeholder="0541234567" 
                            maxLength={13}
                            type="tel"
                            className="h-10" 
                            {...field} 
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground/70">Format: 0541234567 or +233541234567</p>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-foreground/70">Email Address</FormLabel>
                      <FormControl>
                        <Input data-testid="input-email" type="email" placeholder="you@email.com" className="h-10" {...field} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-foreground/70">Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            data-testid="input-password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Min. 6 characters"
                            className="h-10 pr-10"
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
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                {selectedRole === "agent" && (
                  <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                    <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <p>Agent accounts need admin verification before accessing wholesale prices and wallet features.</p>
                  </div>
                )}

                <Button
                  data-testid="button-register"
                  type="submit"
                  className="w-full h-11 font-semibold shadow-lg shadow-primary/25 mt-2"
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating account...</>
                  ) : "Create Account"}
                </Button>
              </form>
            </Form>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-5">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
