import { Router, type Request, type Response } from "express";
import { User } from "../models/User";
import { generateToken, extractTokenFromHeader, verifyToken } from "../lib/jwt";
import { randomBytes } from "crypto";

const router = Router();

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

// In-memory store for password reset tokens (in production, use Redis)
const resetTokens = new Map<string, { token: string; expiry: number; email: string }>();

router.post("/register", async (req: Request, res: Response) => {
  try {
    const { username, email, phone, password, role } = req.body;

    if (!username || !email || !phone || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Normalize phone number - accept various formats
    let normalizedPhone = String(phone).trim();
    
    // Remove country code if present
    if (normalizedPhone.startsWith("+233")) {
      normalizedPhone = "0" + normalizedPhone.substring(4);
    } else if (normalizedPhone.startsWith("233")) {
      normalizedPhone = "0" + normalizedPhone.substring(3);
    }
    
    // Validate format: must be 10 digits starting with 0
    if (!/^0\d{9}$/.test(normalizedPhone)) {
      return res.status(400).json({ 
        error: "Phone number must be valid Ghana format (e.g., 0541234567 or +233541234567)" 
      });
    }

    // Check for existing username, email, or phone with specific error messages
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ error: "Username already in use", code: "USERNAME_EXISTS" });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ error: "Email already in use", code: "EMAIL_EXISTS" });
    }

    const existingPhone = await User.findOne({ phone: normalizedPhone });
    if (existingPhone) {
      return res.status(400).json({ error: "Phone number already in use", code: "PHONE_EXISTS" });
    }

    const userRole = role === "agent" ? "agent" : "user";
    const user = new User({ username, email, phone: normalizedPhone, password, role: userRole });
    await user.save();

    req.session.userId = user._id.toString();
    
    // Save session and send response
    req.session.save((err) => {
      if (err) {
        req.log.error({ err }, "Session save error during register");
        return res.status(500).json({ error: "Session save failed" });
      }
      
      // Generate JWT token for mobile support
      const token = generateToken(user);
      
      return res.status(201).json({
        user: {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          phone: user.phone,
          role: user.role,
          isVerified: user.isVerified,
          walletBalance: user.walletBalance,
          createdAt: user.createdAt,
        },
        token,
        message: "Account created successfully",
      });
    });
      return;
  } catch (err) {
    req.log.error({ err }, "Register error");
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { emailOrPhone, password } = req.body;

    if (!emailOrPhone || !password) {
      return res.status(400).json({ error: "Missing credentials" });
    }

    // Normalize phone number if provided in different format
    let normalizedPhone = String(emailOrPhone).trim();
    if (normalizedPhone.startsWith("+233")) {
      normalizedPhone = "0" + normalizedPhone.substring(4);
    } else if (normalizedPhone.startsWith("233")) {
      normalizedPhone = "0" + normalizedPhone.substring(3);
    }

    const user = await User.findOne({
      $or: [
        { email: emailOrPhone.toLowerCase() },
        { phone: normalizedPhone },
        { phone: emailOrPhone },
        { username: emailOrPhone },
      ],
    });

    if (!user) {
      return res.status(401).json({ error: "Username, email or phone not found. Please check and try again.", code: "USER_NOT_FOUND" });
    }

    const passwordCheck = await user.comparePassword(password);
    
    if (!passwordCheck.valid) {
      return res.status(401).json({ error: "Password is incorrect. Please try again.", code: "INVALID_PASSWORD" });
    }

    // Password is valid
    req.session.userId = user._id.toString();
    
    // Save session and send response
    req.session.save((err) => {
      if (err) {
        req.log.error({ err }, "Session save error during login");
        return res.status(500).json({ error: "Session save failed" });
      }
      
      // Generate JWT token for mobile support
      const token = generateToken(user);
      
      // Log if password was migrated
      if (passwordCheck.migrated) {
        req.log.info(`Password migrated to bcrypt for user: ${user.email}`);
      }
      
      return res.status(200).json({
        user: {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          phone: user.phone,
          role: user.role,
          isVerified: user.isVerified,
          walletBalance: user.walletBalance,
          createdAt: user.createdAt,
        },
        token,
        message: "Login successful",
      });
    });
      return;
  } catch (err) {
    req.log.error({ err }, "Login error");
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/logout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      req.log.error({ err }, "Logout error");
      return res.status(500).json({ error: "Logout failed" });
    }
    res.clearCookie("connect.sid", {
      path: "/",
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true",
    });
    return res.json({ message: "Logged out" });
  });
});

router.get("/me", async (req: Request, res: Response) => {
  try {
    let userId: string | null = null;

    // First, try to get userId from session (backward compatibility)
    if (req.session?.userId) {
      userId = req.session.userId;
    } else {
      // Try to get from JWT token in Authorization header
      const token = extractTokenFromHeader(req.headers.authorization);
      if (token) {
        const payload = verifyToken(token);
        if (payload) {
          userId = payload.userId;
        }
      }
    }

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    return res.json({
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isVerified: user.isVerified,
      walletBalance: user.walletBalance,
      createdAt: user.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Get me error");
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists (security best practice)
      return res.json({ message: "If an account with that email exists, a password reset link has been sent" });
    }

    // Generate reset token
    const resetToken = randomBytes(32).toString("hex");
    const tokenExpiry = Date.now() + 3600000; // 1 hour expiry
    resetTokens.set(user._id.toString(), { token: resetToken, expiry: tokenExpiry, email });

    req.log.info(`Password reset token generated for user: ${email}`);

    // Send email via Brevo
    try {
      const brevoApiKey = process.env.BREVO_API_KEY;
      if (!brevoApiKey) {
        throw new Error("BREVO_API_KEY not configured");
      }

      const resetLink = `${process.env.FRONTEND_URL || "https://ewura-hub.vercel.app"}/reset-password?token=${resetToken}&userId=${user._id}`;

      const emailResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": brevoApiKey,
        },
        body: JSON.stringify({
          sender: { name: "AllenDataHub", email: "allendatahub@gmail.com" },
          to: [{ email: user.email, name: user.username }],
          subject: "Password Reset Request - AllenDataHub",
          htmlContent: `
            <div style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
              <div style="background-color: white; padding: 30px; border-radius: 8px; max-width: 500px; margin: 0 auto;">
                <h2 style="color: #333; margin-bottom: 20px;">Reset Your Password</h2>
                <p style="color: #666; margin-bottom: 20px;">Hi ${user.username},</p>
                <p style="color: #666; margin-bottom: 20px;">We received a request to reset your password. Click the link below to create a new password:</p>
                <a href="${resetLink}" style="display: inline-block; background-color: #000; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; margin: 20px 0;">Reset Password</a>
                <p style="color: #999; font-size: 12px; margin-top: 20px;">This link will expire in 1 hour.</p>
                <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
              </div>
            </div>
          `,
        }),
      });

      if (!emailResponse.ok) {
        const errorData = await emailResponse.json();
        req.log.warn(`Brevo email send failed: ${JSON.stringify(errorData)}`);
        // Still return success to user (email may fail but token is generated)
      }
    } catch (emailErr) {
      req.log.error({ err: emailErr }, "Password reset email failed");
      // Don't fail the request if email fails
    }

    return res.json({ message: "If an account with that email exists, a password reset link has been sent" });
  } catch (err) {
    req.log.error({ err }, "Forgot password error");
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const { token, userId, password, passwordConfirm } = req.body;

    if (!token || !userId || !password || !passwordConfirm) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (password !== passwordConfirm) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // Check if token exists and is valid
    const tokenData = resetTokens.get(userId);
    if (!tokenData) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    if (tokenData.token !== token) {
      return res.status(400).json({ error: "Invalid reset token" });
    }

    if (Date.now() > tokenData.expiry) {
      resetTokens.delete(userId);
      return res.status(400).json({ error: "Reset token has expired" });
    }

    // Update user password
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.password = password;
    user.passwordFormat = "bcrypt";
    await user.save();

    // Clear the reset token
    resetTokens.delete(userId);

    req.log.info(`Password reset successfully for user: ${user.email}`);

    return res.json({ message: "Password has been reset successfully. You can now log in with your new password." });
  } catch (err) {
    req.log.error({ err }, "Reset password error");
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
