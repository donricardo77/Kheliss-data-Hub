import { Link, useLocation } from "wouter";
import { ArrowRight, Zap, Shield, Smartphone, CreditCard, Users, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (user) {
    setLocation(user.role === "admin" ? "/admin" : "/dashboard");
    return null;
  }

  return (
    <div className="flex flex-col w-full">
      {/* Hero Section */}
      <section className="relative pt-24 pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 -z-10" />
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary/10 to-transparent -z-10" />
        
        <div className="container relative z-10">
          <div className="max-w-3xl space-y-8">
            <div className="inline-flex items-center rounded-full border bg-background px-3 py-1 text-sm font-medium">
              <span className="flex h-2 w-2 rounded-full bg-primary mr-2"></span>
              Ghana's fastest growing airtime platform
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground leading-[1.1]">
              Top up instantly.<br />
              <span className="text-primary">Sell profitably.</span>
            </h1>
            
            <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl">
              Kheliss data Hub is the most reliable platform to buy airtime and data for MTN, Telecel, and AirtelTigo. Use it for yourself or become an agent to start your reselling business today.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link href="/register">
                <Button size="lg" className="h-14 px-8 text-base shadow-lg shadow-primary/20 w-full sm:w-auto">
                  Get Started Now <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="h-14 px-8 text-base w-full sm:w-auto">
                  Log in to Account
                </Button>
              </Link>
            </div>
            
            <div className="flex items-center gap-6 pt-8">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                    U{i}
                  </div>
                ))}
              </div>
              <div className="text-sm font-medium text-muted-foreground">
                Trusted by 10,000+ users & agents across Ghana
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Networks Section */}
      <section className="py-16 border-y bg-background">
        <div className="container">
          <p className="text-center text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-8">
            Supporting all major networks
          </p>
          <div className="flex justify-center items-center gap-12 md:gap-24 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-[#FFCC00]" />
              <span className="text-2xl font-bold text-foreground">MTN</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-[#E60000]" />
              <span className="text-2xl font-bold text-foreground">Telecel</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-[#0055A5]" />
              <span className="text-2xl font-bold text-foreground">AirtelTigo</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-muted/30">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">Everything you need to stay connected</h2>
            <p className="text-lg text-muted-foreground">Whether you're topping up your own phone or running a business, we've built the tools you need.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Zap,
                title: "Lightning Fast",
                description: "Transactions are processed instantly. No more waiting for airtime to reflect on your phone."
              },
              {
                icon: Shield,
                title: "Secure Payments",
                description: "Pay securely with Mobile Money or Card via Paystack. Your financial data is never compromised."
              },
              {
                icon: Users,
                title: "Agent Program",
                description: "Join our agent network to access wholesale rates and build your own profitable reselling business."
              }
            ].map((feature, i) => (
              <div key={i} className="bg-background rounded-2xl p-8 shadow-sm border">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing/Roles Section */}
      <section id="pricing" className="py-24 bg-background">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">Choose how you use Kheliss data Hub</h2>
            <p className="text-lg text-muted-foreground">Sign up as a regular user for personal use, or become an agent to access wholesale prices.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* User Card */}
            <div className="rounded-3xl border p-8 bg-background flex flex-col">
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Regular User</h3>
                <p className="text-muted-foreground">Perfect for personal airtime and data needs.</p>
              </div>
              <div className="text-4xl font-bold mb-8">Free<span className="text-lg text-muted-foreground font-normal">/forever</span></div>
              <ul className="space-y-4 mb-8 flex-1">
                {[
                  "Instant top-ups for all networks",
                  "Pay securely via Paystack",
                  "Full transaction history",
                  "Standard retail pricing",
                  "24/7 customer support"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link href="/register">
                <Button className="w-full h-12" variant="outline">Sign Up as User</Button>
              </Link>
            </div>

            {/* Agent Card */}
            <div className="rounded-3xl border-2 border-primary p-8 bg-primary/5 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-4 py-1 text-sm font-bold rounded-bl-lg">
                Most Popular
              </div>
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Verified Agent</h3>
                <p className="text-muted-foreground">Start your own profitable reselling business.</p>
              </div>
              <div className="text-4xl font-bold mb-8">Free<span className="text-lg text-muted-foreground font-normal"> to join</span></div>
              <ul className="space-y-4 mb-8 flex-1">
                {[
                  "Access to wholesale pricing",
                  "Dedicated agent wallet",
                  "Bulk purchasing tools",
                  "Priority support channel",
                  "Admin verification required"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link href="/register">
                <Button className="w-full h-12 shadow-md shadow-primary/20">Apply as Agent</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary -z-10" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 -z-10" />
        
        <div className="container relative z-10 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-primary-foreground mb-6">Ready to get started?</h2>
          <p className="text-primary-foreground/80 text-xl mb-10 max-w-2xl mx-auto">
            Join thousands of users and agents who trust Kheliss data Hub for their daily connectivity needs.
          </p>
          <Link href="/register">
            <Button size="lg" variant="secondary" className="h-14 px-10 text-lg text-primary font-bold">
              Create Your Account
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}