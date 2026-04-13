/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { 
  TrendingUp, 
  Users, 
  Zap, 
  BarChart3, 
  Globe, 
  MessageSquare, 
  CheckCircle2, 
  ArrowRight,
  Instagram,
  Twitter,
  Facebook,
  Linkedin,
  Menu,
  X,
  Star,
  ShieldCheck,
  Shield,
  Mail,
  Phone,
  MapPin,
  Clock,
  Rocket,
  LogOut,
  User as UserIcon,
  Wallet,
  CreditCard,
  ArrowDownCircle,
  ShoppingBag,
  RefreshCcw,
  LayoutDashboard,
  ListOrdered,
  Droplets,
  History,
  DollarSign,
  Search,
  Bell,
  Award,
  Gem,
  Crown,
  LifeBuoy,
  Plus,
  Edit2,
  Trash2,
  Camera,
  Upload,
  Sun,
  Moon
} from "lucide-react";
import { useState, useEffect, createContext, useContext, ReactNode, FormEvent, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from "recharts";
import { auth, googleProvider, db, OperationType, handleFirestoreError, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp, updateDoc, collection, query, where, onSnapshot, orderBy, addDoc, getDocs, increment, runTransaction, deleteDoc } from "firebase/firestore";

// Rank Logic
const RANKS = [
  { 
    id: "new",
    name: "New Member", 
    min: 0, 
    max: 100, 
    color: "text-slate-500", 
    bg: "bg-slate-50", 
    border: "border-slate-200",
    icon: Star,
    gradient: "from-slate-400 to-slate-500"
  },
  { 
    id: "standard",
    name: "Standard Member", 
    min: 101, 
    max: 500, 
    color: "text-blue-600", 
    bg: "bg-blue-50", 
    border: "border-blue-200",
    icon: Award,
    gradient: "from-blue-400 to-blue-600"
  },
  { 
    id: "premium",
    name: "Premium Member", 
    min: 501, 
    max: 1000, 
    color: "text-purple-600", 
    bg: "bg-purple-50", 
    border: "border-purple-200",
    icon: Crown,
    gradient: "from-amber-400 to-purple-600"
  },
  { 
    id: "master",
    name: "Master Member", 
    min: 1001, 
    max: Infinity, 
    color: "text-red-600", 
    bg: "bg-red-50", 
    border: "border-red-200",
    icon: Gem,
    gradient: "from-red-500 to-orange-600",
    glow: "shadow-[0_0_20px_rgba(239,68,68,0.5)]"
  }
];

const getRank = (spent: number) => {
  return RANKS.find(r => spent >= r.min && spent <= r.max) || RANKS[0];
};

function MemberRankBadge({ spent, size = "md" }: { spent: number, size?: "sm" | "md" | "lg" }) {
  const rank = getRank(spent);
  const Icon = rank.icon;

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1 rounded-full border font-bold transition-all",
      rank.bg,
      rank.border,
      rank.color,
      rank.glow,
      size === "sm" ? "text-[10px] px-2 py-0.5" : size === "lg" ? "text-base px-4 py-2" : "text-xs"
    )}>
      <Icon className={cn(size === "sm" ? "w-3 h-3" : size === "lg" ? "w-5 h-5" : "w-3.5 h-3.5")} />
      <span>{rank.name}</span>
    </div>
  );
}

// Theme Context
type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("theme") as Theme) || "light";
    }
    return "light";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}

// Auth Context
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Sync user to Firestore
        const userRef = doc(db, "users", currentUser.uid);
        try {
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName || null,
              photoURL: currentUser.photoURL || null,
              balance: 0,
              totalDeposit: 0,
              totalSpent: 0,
              createdAt: serverTimestamp(),
            });
          }
        } catch (error) {
          console.error("Error syncing user:", error);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        return;
      }
      console.error("Sign in error:", error);
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      console.error("Email sign in error:", error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, pass: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      console.error("Email sign up error:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signInWithEmail, signUpWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function LoginDialog({ className }: { className?: string }) {
  const { signIn, signInWithEmail, signUpWithEmail } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Email is invalid";
    }
    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setErrors({});
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
      setIsOpen(false);
    } catch (error: any) {
      setErrors({ general: error.message || "An error occurred during authentication" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        render={
          <Button variant="default" className={cn("bg-brand-600 hover:bg-brand-700", className)}>
            Login
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display font-bold">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </DialogTitle>
          <DialogDescription>
            {isSignUp 
              ? "Sign up to start your growth journey with KIT GIZMO." 
              : "Login to manage your social media presence."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="name@example.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={errors.email ? "border-red-500 focus-visible:ring-red-500" : ""}
            />
            {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input 
              id="password" 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={errors.password ? "border-red-500 focus-visible:ring-red-500" : ""}
            />
            {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
          </div>
          {errors.general && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-md">
              <p className="text-xs text-red-600">{errors.general}</p>
            </div>
          )}
          {isSignUp && !errors.general && (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-md">
              <p className="text-xs text-blue-700">We'll send a verification email after you sign up.</p>
            </div>
          )}
          <Button type="submit" className="w-full bg-brand-600" disabled={isLoading}>
            {isLoading ? "Processing..." : (isSignUp ? "Sign Up" : "Login")}
          </Button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-500">Or continue with</span>
            </div>
          </div>
          
          <Button 
            type="button" 
            variant="outline" 
            className="w-full" 
            onClick={() => { signIn(); setIsOpen(false); }}
            disabled={isLoading}
          >
            <Globe className="mr-2 h-4 w-4" /> Google
          </Button>

          <div className="text-center text-sm">
            <button 
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-brand-600 hover:underline font-medium"
            >
              {isSignUp ? "Already have an account? Login" : "Don't have an account? Sign Up"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: "easeOut",
    },
  },
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

function ProfileForm() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [photoURL, setPhotoURL] = useState(user?.photoURL || "");
  const [previewURL, setPreviewURL] = useState(user?.photoURL || "");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { // 1MB limit for Firestore string
        setMessage({ type: "error", text: "Image size must be less than 1MB" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setPreviewURL(base64String);
        setPhotoURL(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsLoading(true);
    setMessage(null);
    
    try {
      // Update Auth Profile
      await updateProfile(user, { 
        displayName,
        photoURL: photoURL || user.photoURL 
      });
      
      // Update Firestore
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        displayName,
        photoURL: photoURL || user.photoURL,
        updatedAt: serverTimestamp(),
      });
      
      setMessage({ type: "success", text: "Profile updated successfully!" });
    } catch (error: any) {
      console.error("Error updating profile:", error);
      setMessage({ type: "error", text: error.message || "Failed to update profile" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleUpdate} className="space-y-6">
      <div className="flex flex-col items-center gap-4 mb-6">
        <div className="relative group">
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-brand-50 dark:border-brand-900/20 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            {previewURL ? (
              <img src={previewURL} alt="Profile Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <UserIcon className="w-12 h-12 text-slate-300 dark:text-slate-600" />
            )}
          </div>
          <label 
            htmlFor="photo-upload" 
            className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          >
            <Camera className="w-6 h-6" />
          </label>
          <input 
            id="photo-upload" 
            type="file" 
            accept="image/*" 
            className="hidden" 
            onChange={handleFileChange} 
          />
        </div>
        <p className="text-xs text-slate-500">Click to upload new profile picture (Max 1MB)</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-email">Email Address</Label>
        <Input id="profile-email" type="email" value={user?.email || ""} disabled className="bg-slate-50 text-slate-500 cursor-not-allowed" />
        <p className="text-xs text-slate-400 italic">Email address cannot be changed.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-name">Display Name</Label>
        <Input 
          id="profile-name" 
          placeholder="Enter your name" 
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-bio">Bio (Optional)</Label>
        <Textarea 
          id="profile-bio" 
          placeholder="Tell us a bit about yourself..." 
          className="min-h-[100px] resize-none"
        />
      </div>

      {message && (
        <div className={cn(
          "p-4 rounded-xl border text-sm",
          message.type === "success" ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-red-50 border-red-100 text-red-700"
        )}>
          {message.text}
        </div>
      )}

      <Button type="submit" className="bg-brand-600 hover:bg-brand-700 px-8" disabled={isLoading}>
        {isLoading ? "Saving..." : "Save Changes"}
      </Button>
    </form>
  );
}

function NewOrderForm({ balance, setActiveTab }: { balance: number; setActiveTab: (tab: string) => void }) {
  const { user } = useAuth();
  const [category, setCategory] = useState("");
  const [service, setService] = useState("");
  const [link, setLink] = useState("");
  const [quantity, setQuantity] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const categories = [
    "Instagram to Shopify traffic USA",
    "YouTube to Shopify traffic USA",
    "Google to Shopify traffic USA",
    "Pinterest to Shopify traffic USA",
    "Tiktok to Shopify traffic USA",
    "Facebook to Shopify traffic USA"
  ];

  const services = categories.map((cat, index) => ({
    id: (index + 1).toString(),
    name: `${cat} - High Quality`,
    price: 14.54,
    category: cat,
    min: 500,
    max: 10000,
    description: "High-quality targeted traffic from social platforms to your Shopify store. Boost your sales and visibility with real USA visitors."
  }));

  const selectedService = services.find(s => s.id === service);
  const totalCost = selectedService ? (selectedService.price * (parseInt(quantity) || 0) / 1000) : 0;

  const handleOrder = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !service || !link || !quantity) return;

    const qty = parseInt(quantity);
    if (selectedService && (qty < selectedService.min || qty > selectedService.max)) {
      setMessage({ type: "error", text: `Quantity must be between ${selectedService.min} and ${selectedService.max}` });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const userRef = doc(db, "users", user.uid);
      
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("User not found");
        
        const balance = userDoc.data().balance || 0;
        if (balance < totalCost) throw new Error("Insufficient balance. Please add funds.");

        // Create Order
        const orderRef = doc(collection(db, "orders"));
        transaction.set(orderRef, {
          uid: user.uid,
          serviceId: service,
          serviceName: selectedService?.name,
          category: selectedService?.category,
          link,
          quantity: qty,
          cost: totalCost,
          status: "Processing",
          createdAt: serverTimestamp()
        });

        // Create Transaction
        const txRef = doc(collection(db, "transactions"));
        transaction.set(txRef, {
          uid: user.uid,
          userEmail: user.email,
          userName: user.displayName || "User",
          type: "Payment",
          method: `Order: ${selectedService?.name}`,
          amount: totalCost,
          status: "Completed",
          orderId: orderRef.id,
          createdAt: serverTimestamp()
        });

        // Update User
        transaction.update(userRef, {
          balance: increment(-totalCost),
          totalSpent: increment(totalCost),
          updatedAt: serverTimestamp()
        });
      });

      setMessage({ type: "success", text: "Order placed successfully!" });
      setLink("");
      setQuantity("");
    } catch (error: any) {
      console.error("Order error:", error);
      setMessage({ type: "error", text: error.message || "Failed to place order" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">New Order</h1>
        <p className="text-slate-500 dark:text-slate-400">Select a service and enter your details to place a new order.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Form */}
        <div className="lg:col-span-2">
          <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleOrder} className="space-y-6">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={(val) => {
                    setCategory(val);
                    setService(""); // Reset service when category changes
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Service</Label>
                  <Select value={service} onValueChange={setService}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select service" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.filter(s => !category || s.category === category).map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Link</Label>
                  <Input placeholder="https://your-shopify-store.com/..." value={link} onChange={(e) => setLink(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input type="number" placeholder="500 - 10000" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                  {selectedService && (
                    <p className="text-xs text-slate-400">Min: {selectedService.min} - Max: {selectedService.max}</p>
                  )}
                </div>

                {message && (
                  <div className={cn(
                    "p-4 rounded-xl border text-sm",
                    message.type === "success" ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-red-50 border-red-100 text-red-700"
                  )}>
                    {message.text}
                  </div>
                )}

                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 py-6 text-lg font-bold" disabled={isLoading}>
                  {isLoading ? "Processing..." : "Place Order"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Order Resume Sidebar */}
        <div className="lg:col-span-1">
          <Card className="border-none shadow-sm bg-white dark:bg-slate-900 sticky top-24">
            <CardHeader className="border-b border-slate-50 dark:border-slate-800">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <ShoppingBag className="w-5 h-5 text-brand-600" />
                Order Resume
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {selectedService ? (
                <>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Service Name</label>
                      <p className="text-sm font-medium text-slate-900 mt-1">{selectedService.name}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Min / Max</label>
                        <p className="text-sm font-medium text-slate-900 mt-1">{selectedService.min} / {selectedService.max}</p>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Price per 1k</label>
                        <p className="text-sm font-medium text-brand-600 mt-1 flex items-center gap-0.5">
                          <span className="text-slate-400 font-normal">$</span>
                          {selectedService.price.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Description</label>
                      <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                        {selectedService.description}
                      </p>
                    </div>
                  </div>

                  <Separator className="bg-slate-50" />

                  <div className={cn(
                    "p-4 rounded-xl space-y-3 transition-all duration-300",
                    totalCost > balance ? "bg-red-50 border border-red-100 ring-1 ring-red-200" : "bg-slate-50"
                  )}>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-medium">Your Balance</span>
                      <span className={cn("font-bold flex items-center gap-0.5", totalCost > balance ? "text-red-600" : "text-slate-900")}>
                        <span className="text-slate-400 font-normal">$</span>
                        {balance.toFixed(2)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm pt-3 border-t border-slate-200/50">
                      <span className="text-slate-500 font-medium">Total Cost</span>
                      <span className={cn("text-xl font-bold flex items-center gap-0.5", totalCost > balance ? "text-red-700" : "text-slate-900")}>
                        <span className="text-slate-400 font-normal text-lg">$</span>
                        {totalCost.toFixed(2)}
                      </span>
                    </div>

                    {totalCost > balance && (
                      <div className="flex items-center gap-2 text-[10px] text-red-600 font-bold justify-center animate-pulse">
                        <ArrowDownCircle className="w-3 h-3 rotate-180" />
                        Insufficient Balance
                      </div>
                    )}
                  </div>
                  
                  {totalCost > balance && (
                    <Button 
                      variant="outline" 
                      className="w-full border-red-200 text-red-600 hover:bg-red-50 gap-2"
                      onClick={() => setActiveTab("Add Funds")}
                    >
                      <Wallet className="w-4 h-4" /> Add Funds Now
                    </Button>
                  )}
                </>
              ) : (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                    <Search className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-sm text-slate-400">Select a service to see the order summary</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ManageOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "orders"),
      where("uid", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => {
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateB - dateA;
        });
      setOrders(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">Manage Orders</h1>
        <p className="text-slate-500 dark:text-slate-400">Track and manage your service orders in real-time.</p>
      </div>

      <Card className="border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Order ID</th>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Service</th>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Amount</th>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <ShoppingBag className="w-8 h-8 opacity-20" />
                      <p>No orders found</p>
                    </div>
                  </td>
                </tr>
              ) : orders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 text-sm font-medium text-slate-900">#{order.id.slice(0, 8)}</td>
                  <td className="p-4 text-sm text-slate-600">{order.serviceName}</td>
                  <td className="p-4 text-sm font-sans text-slate-900 flex items-center gap-0.5">
                    <span className="text-slate-400 font-normal">$</span>
                    {order.cost?.toFixed(2)}
                  </td>
                  <td className="p-4 text-sm text-slate-500">
                    {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : "Pending"}
                  </td>
                  <td className="p-4">
                    {order.status === "Completed" ? (
                      <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex items-center gap-2 text-emerald-600 font-medium text-sm"
                      >
                        <motion.div
                          animate={{ 
                            scale: [1, 1.2, 1],
                            filter: ["drop-shadow(0 0 0px rgba(16, 185, 129, 0))", "drop-shadow(0 0 8px rgba(16, 185, 129, 0.4))", "drop-shadow(0 0 0px rgba(16, 185, 129, 0))"]
                          }}
                          transition={{ duration: 0.5 }}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </motion.div>
                        Completed
                      </motion.div>
                    ) : order.status === "Cancelled" ? (
                      <div className="flex items-center gap-2 text-red-600 font-medium text-sm">
                        <X className="w-4 h-4" />
                        Cancelled
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-amber-600 font-medium text-sm">
                        <Clock className="w-4 h-4 animate-pulse" />
                        Processing
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <Button variant="ghost" size="sm" className="h-8 text-xs text-slate-400" disabled>
                      No Action
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function AddFundsForm() {
  const { user } = useAuth();
  const [method, setMethod] = useState("crypto");
  const [providerId, setProviderId] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [amount, setAmount] = useState("");
  const [trxId, setTrxId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const q = query(collection(db, "payment_methods"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPaymentMethods(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const selectedProvider = paymentMethods.find(p => p.id === providerId);

  const handlePayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!providerId || !amount || !trxId) {
      setMessage({ type: "error", text: "Please fill in all fields." });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const txRef = collection(db, "transactions");
      await addDoc(txRef, {
        uid: user.uid,
        userEmail: user.email,
        userName: user.displayName || user.email?.split('@')[0],
        type: "Deposit",
        method: selectedProvider?.networkName || "Unknown",
        amount: parseFloat(amount),
        trxId: trxId,
        status: "Pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setMessage({ 
        type: "success", 
        text: "Payment submitted! Please wait 5-15 minutes. Our team is verifying your transaction. Your balance will be updated shortly." 
      });
      setAmount("");
      setTrxId("");
      setProviderId("");
    } catch (error: any) {
      console.error("Error submitting payment:", error);
      setMessage({ type: "error", text: "Failed to submit payment. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">Add Funds</h1>
        <p className="text-slate-500 dark:text-slate-400">Choose your preferred cryptocurrency network and enter the transaction details.</p>
      </div>

      <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">Payment Details</CardTitle>
          <CardDescription className="text-slate-500 dark:text-slate-400">Select a network to view the wallet address.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handlePayment} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="method">Payment Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="method">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="crypto">Cryptocurrency Gateway</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider">Select Network</Label>
              <Select value={providerId} onValueChange={setProviderId}>
                <SelectTrigger id="provider">
                  <SelectValue placeholder="Select payment network" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.networkName}</SelectItem>
                  ))}
                  {paymentMethods.length === 0 && (
                    <SelectItem value="none" disabled>No networks available</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedProvider && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-slate-500 uppercase">Wallet Address ({selectedProvider.networkName})</span>
                  <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200">
                    <code className="text-sm text-brand-600 break-all">{selectedProvider.walletAddress}</code>
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="sm" 
                      onClick={() => navigator.clipboard.writeText(selectedProvider.walletAddress)}
                      className="shrink-0 ml-2"
                    >
                      Copy
                    </Button>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400">Send only {selectedProvider.networkName} to this address. Other assets will be lost.</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="amount">Amount (USD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-sans">$</span>
                <Input 
                  id="amount" 
                  type="number" 
                  placeholder="0.00" 
                  className="pl-8" 
                  min="5" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <p className="text-xs text-slate-500">Minimum deposit: $5.00</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trxId">Enter Transaction ID (TRX)</Label>
              <Input 
                id="trxId" 
                placeholder="Enter your transaction hash/ID" 
                value={trxId}
                onChange={(e) => setTrxId(e.target.value)}
              />
            </div>

            {message && (
              <div className={cn(
                "p-4 rounded-xl border text-sm",
                message.type === "success" ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-red-50 border-red-100 text-red-700"
              )}>
                {message.text}
              </div>
            )}

            <Button type="submit" className="w-full bg-brand-600 hover:bg-brand-700 py-6 text-lg" disabled={isLoading}>
              {isLoading ? "Verifying..." : "Proceed to Payment"}
            </Button>

            <div className="flex items-center justify-center gap-4 text-slate-400">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs">Secure Blockchain Verification</span>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function SupportTickets() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);

  // Form states
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "tickets"),
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTickets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);

    try {
      let attachmentUrl = "";
      if (attachment) {
        attachmentUrl = URL.createObjectURL(attachment);
      }

      await addDoc(collection(db, "tickets"), {
        uid: user.uid,
        userName: user.displayName || "User",
        userEmail: user.email,
        subject,
        priority,
        message,
        attachmentUrl,
        status: "Open",
        replies: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setIsNewTicketOpen(false);
      setSubject("");
      setPriority("Medium");
      setMessage("");
      setAttachment(null);
    } catch (error) {
      console.error("Error creating ticket:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = async (ticketId: string, replyMessage: string) => {
    if (!user) return;
    const ticketRef = doc(db, "tickets", ticketId);
    const ticket = tickets.find(t => t.id === ticketId);
    
    await updateDoc(ticketRef, {
      replies: [...ticket.replies, {
        message: replyMessage,
        sender: "user",
        timestamp: new Date().toISOString()
      }],
      status: "Open",
      updatedAt: serverTimestamp()
    });
  };

  if (loading) return <div className="p-8 text-center">Loading tickets...</div>;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">Support Tickets</h1>
          <p className="text-slate-500 dark:text-slate-400">Need help? Open a ticket and our team will assist you.</p>
        </div>
        <Dialog open={isNewTicketOpen} onOpenChange={setIsNewTicketOpen}>
          <DialogTrigger render={
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <MessageSquare className="w-4 h-4 mr-2" />
              New Ticket
            </Button>
          } />
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Ticket</DialogTitle>
              <DialogDescription>Fill out the form below to contact support.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required placeholder="e.g., Order issue, Payment problem" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} required placeholder="Describe your issue in detail..." className="min-h-[120px]" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="attachment">Attachment (Optional)</Label>
                <Input id="attachment" type="file" onChange={(e) => setAttachment(e.target.files?.[0] || null)} className="cursor-pointer" />
              </div>
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit Ticket"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ticket ID</th>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Subject</th>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Priority</th>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">No tickets found</td>
                </tr>
              ) : tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 text-sm font-medium text-slate-900">#{ticket.id.slice(0, 8)}</td>
                  <td className="p-4 text-sm text-slate-600">{ticket.subject}</td>
                  <td className="p-4">
                    <Badge variant="outline" className={cn(
                      "font-medium",
                      ticket.priority === "High" ? "bg-red-50 text-red-700 border-red-100" :
                      ticket.priority === "Medium" ? "bg-amber-50 text-amber-700 border-amber-100" :
                      "bg-blue-50 text-blue-700 border-blue-100"
                    )}>
                      {ticket.priority}
                    </Badge>
                  </td>
                  <td className="p-4 text-sm text-slate-500">
                    {ticket.createdAt?.toDate ? ticket.createdAt.toDate().toLocaleDateString() : "Pending"}
                  </td>
                  <td className="p-4">
                    <Badge className={cn(
                      "font-medium",
                      ticket.status === "Open" ? "bg-blue-500 text-white" :
                      ticket.status === "Replied" ? "bg-emerald-500 text-white" :
                      "bg-slate-400 text-white"
                    )}>
                      {ticket.status}
                    </Badge>
                  </td>
                  <td className="p-4 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedTicket(ticket)}>
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTicket?.subject}</DialogTitle>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline">{selectedTicket?.priority} Priority</Badge>
              <Badge variant="outline">{selectedTicket?.status}</Badge>
            </div>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="bg-slate-50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-sm text-slate-900">{selectedTicket?.userName}</span>
                <span className="text-xs text-slate-500">
                  {selectedTicket?.createdAt?.toDate ? selectedTicket.createdAt.toDate().toLocaleString() : ""}
                </span>
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedTicket?.message}</p>
              {selectedTicket?.attachmentUrl && (
                <div className="mt-4 p-2 border border-slate-200 rounded bg-white">
                  <span className="text-xs text-slate-500 block mb-1">Attachment:</span>
                  <a href={selectedTicket.attachmentUrl} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                    <Globe className="w-3 h-3" /> View Attachment
                  </a>
                </div>
              )}
            </div>

            {selectedTicket?.replies?.map((reply: any, idx: number) => (
              <div key={idx} className={cn(
                "p-4 rounded-lg",
                reply.sender === "admin" ? "bg-emerald-50 border border-emerald-100 ml-8" : "bg-slate-50 mr-8"
              )}>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-sm text-slate-900">
                    {reply.sender === "admin" ? "Support Team" : selectedTicket.userName}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(reply.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{reply.message}</p>
              </div>
            ))}

            {selectedTicket?.status !== "Closed" && (
              <div className="space-y-2 pt-4 border-t border-slate-100">
                <Label htmlFor="reply">Add a reply</Label>
                <Textarea 
                  id="reply" 
                  placeholder="Type your message here..." 
                  className="min-h-[100px]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      const val = (e.target as HTMLTextAreaElement).value;
                      if (val.trim()) {
                        handleReply(selectedTicket.id, val);
                        (e.target as HTMLTextAreaElement).value = "";
                      }
                    }
                  }}
                />
                <p className="text-[10px] text-slate-400">Press Enter to send, Shift+Enter for new line.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Transactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "transactions"),
      where("uid", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a: any, b: any) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB - dateA;
      });
      setTransactions(txs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "transactions");
    });

    return () => unsubscribe();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Clock className="w-8 h-8 text-brand-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">Transactions</h1>
        <p className="text-slate-500 dark:text-slate-400">View your complete financial history and transaction status.</p>
      </div>

      <Card className="border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Transaction ID</th>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</th>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Method/Details</th>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Amount</th>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    <History className="w-8 h-8 opacity-20 mx-auto mb-2" />
                    <p>No transactions found</p>
                  </td>
                </tr>
              ) : transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 text-sm font-medium text-slate-900">{tx.id.slice(0, 8)}...</td>
                  <td className="p-4">
                    <Badge variant="outline" className={cn(
                      "font-medium",
                      tx.type === "Deposit" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                      tx.type === "Withdrawal" ? "bg-amber-50 text-amber-700 border-amber-100" :
                      "bg-blue-50 text-blue-700 border-blue-100"
                    )}>
                      {tx.type}
                    </Badge>
                  </td>
                  <td className="p-4 text-sm text-slate-600">{tx.method}</td>
                  <td className={cn(
                    "p-4 text-sm font-bold font-mono",
                    tx.type === "Deposit" ? "text-emerald-600" : "text-red-600"
                  )}>
                    {tx.type === "Deposit" ? "+" : "-"}${tx.amount.toFixed(2)}
                  </td>
                  <td className="p-4 text-sm text-slate-500">
                    {tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleDateString() : "Pending"}
                  </td>
                  <td className="p-4">
                    <div className={cn(
                      "flex items-center gap-2 text-sm font-medium",
                      tx.status === "Completed" ? "text-emerald-600" : 
                      tx.status === "Pending" ? "text-amber-600" : "text-red-600"
                    )}>
                      {tx.status === "Completed" ? <CheckCircle2 className="w-4 h-4" /> : 
                       tx.status === "Pending" ? <Clock className="w-4 h-4 animate-pulse" /> : <X className="w-4 h-4" />}
                      {tx.status}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function PaymentSettings() {
  const [methods, setMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingMethod, setEditingMethod] = useState<any>(null);

  const [networkName, setNetworkName] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [iconUrl, setIconUrl] = useState("");

  useEffect(() => {
    const q = query(collection(db, "payment_methods"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMethods(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingMethod) {
        await updateDoc(doc(db, "payment_methods", editingMethod.id), {
          networkName,
          walletAddress,
          iconUrl,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, "payment_methods"), {
          networkName,
          walletAddress,
          iconUrl,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      resetForm();
    } catch (error) {
      console.error("Error saving payment method:", error);
    }
  };

  const resetForm = () => {
    setNetworkName("");
    setWalletAddress("");
    setIconUrl("");
    setIsAdding(false);
    setEditingMethod(null);
  };

  const handleEdit = (method: any) => {
    setEditingMethod(method);
    setNetworkName(method.networkName);
    setWalletAddress(method.walletAddress);
    setIconUrl(method.iconUrl || "");
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this payment method?")) {
      try {
        await deleteDoc(doc(db, "payment_methods", id));
      } catch (error) {
        console.error("Error deleting payment method:", error);
      }
    }
  };

  if (loading) return <div className="p-8 text-center">Loading settings...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Payment Methods</h2>
        <Button onClick={() => setIsAdding(true)} className="bg-brand-600 hover:bg-brand-700">
          <Plus className="w-4 h-4 mr-2" /> Add New Method
        </Button>
      </div>

      {isAdding && (
        <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-slate-100">{editingMethod ? "Edit Method" : "Add New Crypto Method"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Network Name (e.g., TRC20, BEP20)</Label>
                  <Input value={networkName} onChange={(e) => setNetworkName(e.target.value)} required placeholder="TRC20" />
                </div>
                <div className="space-y-2">
                  <Label>Icon URL (Optional)</Label>
                  <Input value={iconUrl} onChange={(e) => setIconUrl(e.target.value)} placeholder="https://..." />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Wallet Address</Label>
                <Input value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} required placeholder="Enter wallet address" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" className="bg-brand-600 hover:bg-brand-700">
                  {editingMethod ? "Update Method" : "Save Method"}
                </Button>
                <Button type="button" variant="ghost" onClick={resetForm}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {methods.map((method) => (
          <Card key={method.id} className="border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden group">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0">
                  {method.iconUrl ? (
                    <img src={method.iconUrl} alt="" className="w-8 h-8 object-contain" />
                  ) : (
                    <TrendingUp className="text-brand-600 w-6 h-6" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100">{method.networkName}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Crypto Gateway</p>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 mb-4">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Wallet Address</p>
                <p className="text-xs font-mono text-slate-700 dark:text-slate-300 break-all">{method.walletAddress}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(method)}>
                  <Edit2 className="w-3 h-3 mr-2" /> Edit
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-red-600 hover:bg-red-50" onClick={() => handleDelete(method.id)}>
                  <Trash2 className="w-3 h-3 mr-2" /> Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AdminDashboard() {
  const [deposits, setDeposits] = useState<any[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [allTickets, setAllTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userDetails, setUserDetails] = useState<Record<string, any>>({});
  const [adminTab, setAdminTab] = useState<"Deposits" | "Orders" | "Tickets" | "Payment Settings">("Deposits");
  const [selectedTicket, setSelectedTicket] = useState<any>(null);

  useEffect(() => {
    // Listen to Deposits
    const qDeposits = query(
      collection(db, "transactions"),
      where("type", "==", "Deposit"),
      where("status", "==", "Pending")
    );

    const unsubDeposits = onSnapshot(qDeposits, async (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => {
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateB - dateA;
        });
      
      const uids = Array.from(new Set(docs.map((d: any) => d.uid)));
      const details = { ...userDetails };
      for (const uid of uids) {
        if (!details[uid]) {
          const userDoc = await getDoc(doc(db, "users", uid));
          if (userDoc.exists()) details[uid] = userDoc.data();
        }
      }
      setUserDetails(details);
      setDeposits(docs);
      if (adminTab === "Deposits") setLoading(false);
    });

    // Listen to All Orders
    const qOrders = query(
      collection(db, "orders"),
      orderBy("createdAt", "desc")
    );

    const unsubOrders = onSnapshot(qOrders, async (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const uids = Array.from(new Set(docs.map((d: any) => d.uid)));
      const details = { ...userDetails };
      for (const uid of uids) {
        if (!details[uid]) {
          const userDoc = await getDoc(doc(db, "users", uid));
          if (userDoc.exists()) details[uid] = userDoc.data();
        }
      }
      setUserDetails(details);
      setAllOrders(docs);
      if (adminTab === "Orders") setLoading(false);
    });

    // Listen to All Tickets
    const qTickets = query(
      collection(db, "tickets"),
      orderBy("createdAt", "desc")
    );

    const unsubTickets = onSnapshot(qTickets, (snapshot) => {
      setAllTickets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      if (adminTab === "Tickets") setLoading(false);
    });

    setLoading(false);
    return () => {
      unsubDeposits();
      unsubOrders();
      unsubTickets();
    };
  }, [adminTab]);

  const handleDepositAction = async (tx: any, action: "Approve" | "Reject") => {
    try {
      const txRef = doc(db, "transactions", tx.id);
      const userRef = doc(db, "users", tx.uid);

      if (action === "Approve") {
        await updateDoc(txRef, { status: "Completed", updatedAt: serverTimestamp() });
        await updateDoc(userRef, {
          balance: increment(tx.amount),
          totalDeposit: increment(tx.amount),
          updatedAt: serverTimestamp()
        });
      } else {
        await updateDoc(txRef, { status: "Cancelled", updatedAt: serverTimestamp() });
      }
    } catch (error) {
      console.error(`Error ${action}ing deposit:`, error);
    }
  };

  const handleOrderAction = async (order: any, action: "Accept" | "Cancel") => {
    try {
      const orderRef = doc(db, "orders", order.id);
      const userRef = doc(db, "users", order.uid);

      if (action === "Accept") {
        await updateDoc(orderRef, { status: "Completed", updatedAt: serverTimestamp() });
      } else {
        // Cancel and Refund
        await runTransaction(db, async (transaction) => {
          const userDoc = await transaction.get(userRef);
          if (!userDoc.exists()) throw new Error("User not found");

          transaction.update(orderRef, { status: "Cancelled", updatedAt: serverTimestamp() });
          transaction.update(userRef, {
            balance: increment(order.cost),
            totalSpent: increment(-order.cost),
            updatedAt: serverTimestamp()
          });

          // Create Refund Transaction
          const txRef = doc(collection(db, "transactions"));
          transaction.set(txRef, {
            uid: order.uid,
            userEmail: userDetails[order.uid]?.email || "User",
            userName: userDetails[order.uid]?.displayName || "User",
            type: "Deposit", // Using Deposit for refund to show as positive in history
            method: `Refund: ${order.serviceName}`,
            amount: order.cost,
            status: "Completed",
            orderId: order.id,
            createdAt: serverTimestamp()
          });
        });
      }
    } catch (error) {
      console.error(`Error ${action}ing order:`, error);
    }
  };

  const handleTicketReply = async (ticketId: string, replyMessage: string) => {
    const ticketRef = doc(db, "tickets", ticketId);
    const ticket = allTickets.find(t => t.id === ticketId);
    
    await updateDoc(ticketRef, {
      replies: [...ticket.replies, {
        message: replyMessage,
        sender: "admin",
        timestamp: new Date().toISOString()
      }],
      status: "Replied",
      updatedAt: serverTimestamp()
    });
  };

  const handleCloseTicket = async (ticketId: string) => {
    const ticketRef = doc(db, "tickets", ticketId);
    await updateDoc(ticketRef, {
      status: "Closed",
      updatedAt: serverTimestamp()
    });
    setSelectedTicket(null);
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">Admin Panel</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage deposits, orders, and support tickets.</p>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button 
            onClick={() => setAdminTab("Deposits")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              adminTab === "Deposits" ? "bg-white dark:bg-slate-900 text-brand-600 shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-brand-600"
            )}
          >
            Deposits
          </button>
          <button 
            onClick={() => setAdminTab("Orders")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              adminTab === "Orders" ? "bg-white dark:bg-slate-900 text-brand-600 shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-brand-600"
            )}
          >
            Manage All Orders
          </button>
          <button 
            onClick={() => setAdminTab("Tickets")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all relative",
              adminTab === "Tickets" ? "bg-white dark:bg-slate-900 text-brand-600 shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-brand-600"
            )}
          >
            Support Tickets
            {allTickets.filter(t => t.status === "Open").length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900">
                {allTickets.filter(t => t.status === "Open").length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setAdminTab("Payment Settings")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              adminTab === "Payment Settings" ? "bg-white dark:bg-slate-900 text-brand-600 shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-brand-600"
            )}
          >
            Payment Settings
          </button>
        </div>
      </div>

      {adminTab === "Payment Settings" && <PaymentSettings />}

      {adminTab === "Deposits" ? (
        <Card className="border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                  <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">User</th>
                  <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Amount</th>
                  <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Provider</th>
                  <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">TRX ID</th>
                  <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {deposits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-400">No pending deposits</td>
                  </tr>
                ) : deposits.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                      <div className="flex flex-col">
                        <div className="text-sm font-medium text-slate-900">{tx.userName}</div>
                        <div className="text-xs text-slate-500 mb-1">{tx.userEmail}</div>
                        <MemberRankBadge spent={userDetails[tx.uid]?.totalSpent || 0} size="sm" />
                      </div>
                    </td>
                    <td className="p-4 text-sm font-bold text-emerald-600 font-mono">${tx.amount.toFixed(2)}</td>
                    <td className="p-4 text-sm text-slate-600">{tx.method}</td>
                    <td className="p-4 text-sm font-mono text-slate-500">{tx.trxId}</td>
                    <td className="p-4 text-sm text-slate-500">
                      {tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleString() : "Pending"}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8" onClick={() => handleDepositAction(tx, "Approve")}>Approve</Button>
                      <Button size="sm" variant="outline" className="text-red-600 border-red-100 hover:bg-red-50 h-8" onClick={() => handleDepositAction(tx, "Reject")}>Reject</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">User</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Category</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Service</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Link</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Qty</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Price</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {allOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-slate-400">No orders found</td>
                  </tr>
                ) : allOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                      <div className="flex flex-col">
                        <div className="text-sm font-medium text-slate-900">{userDetails[order.uid]?.displayName || "User"}</div>
                        <div className="text-[10px] text-slate-500">{order.uid.slice(0, 8)}...</div>
                        <MemberRankBadge spent={userDetails[order.uid]?.totalSpent || 0} size="sm" />
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-600">{order.category}</td>
                    <td className="p-4 text-sm text-slate-500">{order.serviceName}</td>
                    <td className="p-4 text-sm text-slate-500 truncate max-w-[150px]">{order.link}</td>
                    <td className="p-4 text-sm font-mono text-slate-900">{order.quantity}</td>
                    <td className="p-4 text-sm font-bold text-brand-600 font-mono">${order.cost?.toFixed(2)}</td>
                    <td className="p-4">
                      <Badge variant="outline" className={cn(
                        "font-medium",
                        order.status === "Completed" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                        order.status === "Processing" ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-red-50 text-red-700 border-red-100"
                      )}>
                        {order.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      {order.status === "Processing" ? (
                        <>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8" onClick={() => handleOrderAction(order, "Accept")}>Approve</Button>
                          <Button size="sm" variant="outline" className="text-red-600 border-red-100 hover:bg-red-50 h-8" onClick={() => handleOrderAction(order, "Cancel")}>Cancel</Button>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">No Action</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {adminTab === "Tickets" && (
        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">User</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Subject</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Priority</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {allTickets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-400">No tickets found</td>
                  </tr>
                ) : allTickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                      <div className="flex flex-col">
                        <div className="text-sm font-medium text-slate-900">{ticket.userName}</div>
                        <div className="text-[10px] text-slate-500">{ticket.userEmail}</div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-600">{ticket.subject}</td>
                    <td className="p-4">
                      <Badge variant="outline" className={cn(
                        "font-medium",
                        ticket.priority === "High" ? "bg-red-50 text-red-700 border-red-100" :
                        ticket.priority === "Medium" ? "bg-amber-50 text-amber-700 border-amber-100" :
                        "bg-blue-50 text-blue-700 border-blue-100"
                      )}>
                        {ticket.priority}
                      </Badge>
                    </td>
                    <td className="p-4 text-sm text-slate-500">
                      {ticket.createdAt?.toDate ? ticket.createdAt.toDate().toLocaleDateString() : "Pending"}
                    </td>
                    <td className="p-4">
                      <Badge className={cn(
                        "font-medium",
                        ticket.status === "Open" ? "bg-blue-500 text-white" :
                        ticket.status === "Replied" ? "bg-emerald-500 text-white" :
                        "bg-slate-400 text-white"
                      )}>
                        {ticket.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedTicket(ticket)}>
                        View & Reply
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Admin Ticket Detail Modal */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex justify-between items-start pr-8">
              <div>
                <DialogTitle>{selectedTicket?.subject}</DialogTitle>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline">{selectedTicket?.priority} Priority</Badge>
                  <Badge variant="outline">{selectedTicket?.status}</Badge>
                </div>
              </div>
              {selectedTicket?.status !== "Closed" && (
                <Button variant="outline" size="sm" className="text-red-600 border-red-100 hover:bg-red-50" onClick={() => handleCloseTicket(selectedTicket.id)}>
                  Close Ticket
                </Button>
              )}
            </div>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="bg-slate-50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-sm text-slate-900">{selectedTicket?.userName}</span>
                <span className="text-xs text-slate-500">
                  {selectedTicket?.createdAt?.toDate ? selectedTicket.createdAt.toDate().toLocaleString() : ""}
                </span>
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedTicket?.message}</p>
              {selectedTicket?.attachmentUrl && (
                <div className="mt-4 p-2 border border-slate-200 rounded bg-white">
                  <span className="text-xs text-slate-500 block mb-1">Attachment:</span>
                  <a href={selectedTicket.attachmentUrl} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                    <Globe className="w-3 h-3" /> View Attachment
                  </a>
                </div>
              )}
            </div>

            {selectedTicket?.replies?.map((reply: any, idx: number) => (
              <div key={idx} className={cn(
                "p-4 rounded-lg",
                reply.sender === "admin" ? "bg-emerald-50 border border-emerald-100 ml-8" : "bg-slate-50 mr-8"
              )}>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-sm text-slate-900">
                    {reply.sender === "admin" ? "Support Team" : selectedTicket.userName}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(reply.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{reply.message}</p>
              </div>
            ))}

            {selectedTicket?.status !== "Closed" && (
              <div className="space-y-2 pt-4 border-t border-slate-100">
                <Label htmlFor="admin-reply">Reply to User</Label>
                <Textarea 
                  id="admin-reply" 
                  placeholder="Type your response here..." 
                  className="min-h-[100px]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      const val = (e.target as HTMLTextAreaElement).value;
                      if (val.trim()) {
                        handleTicketReply(selectedTicket.id, val);
                        (e.target as HTMLTextAreaElement).value = "";
                      }
                    }
                  }}
                />
                <p className="text-[10px] text-slate-400">Press Enter to send, Shift+Enter for new line.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderStatisticsChart() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "orders"),
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      }));

      // Process data for the last 7 days
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return {
          date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          fullDate: d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
          amount: 0,
          rawDate: d.toISOString().split('T')[0]
        };
      }).reverse();

      orders.forEach((order: any) => {
        const orderDate = order.createdAt.toISOString().split('T')[0];
        const dayData = last7Days.find(d => d.rawDate === orderDate);
        if (dayData) {
          dayData.amount += order.cost || 0;
        }
      });

      // If no real data, add some mock data for visual appeal as requested
      const hasData = last7Days.some(d => d.amount > 0);
      if (!hasData) {
        const mockValues = [120, 450, 280, 852, 340, 620, 150];
        last7Days.forEach((d, i) => {
          d.amount = mockValues[i];
        });
      }
      
      setData(last7Days);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (loading) return <div className="h-full w-full flex items-center justify-center text-slate-400">Loading chart...</div>;

  return (
    <div className="h-full w-full min-h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === "dark" ? "#1e293b" : "#f1f5f9"} />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: theme === "dark" ? "#64748b" : "#94a3b8", fontSize: 12 }}
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: theme === "dark" ? "#64748b" : "#94a3b8", fontSize: 12 }}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip 
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-white dark:bg-slate-800 p-3 shadow-xl border border-slate-100 dark:border-slate-700 rounded-lg">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1">{payload[0].payload.fullDate}</p>
                    <p className="text-sm font-bold text-brand-600">
                      ${payload[0].value?.toLocaleString(undefined, { minimumFractionDigits: 2 })} Spent
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Area 
            type="monotone" 
            dataKey="amount" 
            stroke="#2563eb" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorAmount)" 
            dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: theme === "dark" ? "#0f172a" : "#fff" }}
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Dashboard() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("Dashboard");

  const [userData, setUserData] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const isAdmin = user?.email === "info.kitgizmo@gmail.com";

  useEffect(() => {
    if (activeTab === "Admin Panel" && !isAdmin) {
      setActiveTab("Dashboard");
    }
  }, [activeTab, isAdmin]);

  useEffect(() => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        setUserData(doc.data());
      }
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const qOrders = query(
      collection(db, "orders"),
      where("uid", "==", user.uid)
    );
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qTickets = query(
      collection(db, "tickets"),
      isAdmin ? orderBy("createdAt", "desc") : where("uid", "==", user.uid)
    );
    const unsubTickets = onSnapshot(qTickets, (snapshot) => {
      setTickets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubOrders();
      unsubTickets();
    };
  }, [user, isAdmin]);

  const stats = [
    { label: "Balance", value: (userData?.balance || 0).toFixed(2), icon: Wallet, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20", isCurrency: true },
    { label: "Total Spent", value: (userData?.totalSpent || 0).toFixed(2), icon: CreditCard, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20", isCurrency: true },
    { label: "Total Deposit", value: (userData?.totalDeposit || 0).toFixed(2), icon: ArrowDownCircle, color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20", isCurrency: true },
    { label: "Total Orders", value: orders.length.toString(), icon: ShoppingBag, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/20" },
    { label: "Processing", value: orders.filter(o => o.status === "Processing").length.toString(), icon: Clock, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20" },
    { label: "Completed", value: orders.filter(o => o.status === "Completed").length.toString(), icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
    { label: "Refunded", value: orders.filter(o => o.status === "Cancelled").length.toString(), icon: RefreshCcw, color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/20" },
    { label: "Active Services", value: orders.filter(o => o.status === "Processing").length.toString(), icon: Zap, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-900/20" },
  ];

  const menuItems = [
    { label: "Dashboard", icon: LayoutDashboard },
    { label: "New Order", icon: ShoppingBag },
    { label: "Manage Orders", icon: ListOrdered },
    { label: "Dripfeed", icon: Droplets },
    { label: "Transactions", icon: History },
    { label: "Add Funds", icon: Wallet },
    { label: "Support Tickets", icon: LifeBuoy },
    { label: "Profile", icon: UserIcon },
    ...(isAdmin ? [{ label: "Admin Panel", icon: ShieldCheck }] : []),
  ];

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden relative">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 flex flex-col z-50 lg:static",
          sidebarOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full lg:w-20 lg:translate-x-0"
        )}
      >
        <div className="p-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center shrink-0">
              <TrendingUp className="text-white w-5 h-5" />
            </div>
            {(sidebarOpen || (window.innerWidth < 1024)) && <span className="text-xl font-display font-bold tracking-tight text-brand-950 truncate">KIT GIZMO</span>}
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-hide">
          {menuItems.map((item, idx) => (
            <button
              key={idx}
              onClick={() => {
                setActiveTab(item.label);
                if (window.innerWidth < 1024) setSidebarOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-xl transition-all group relative",
                activeTab === item.label
                  ? "bg-brand-50 text-brand-600" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-brand-600"
              )}
            >
              <item.icon className={cn("w-5 h-5 shrink-0", activeTab === item.label ? "text-brand-600" : "text-slate-400 group-hover:text-brand-600")} />
              {(sidebarOpen || (window.innerWidth < 1024)) && <span className="font-medium whitespace-nowrap">{item.label}</span>}
              {item.label === "Admin Panel" && isAdmin && tickets.filter(t => t.status === "Open").length > 0 && (
                <span className={cn(
                  "absolute bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white animate-pulse",
                  (sidebarOpen || (window.innerWidth < 1024)) ? "right-4 w-5 h-5" : "top-1 right-1 w-4 h-4"
                )}>
                  {tickets.filter(t => t.status === "Open").length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button 
            onClick={logout}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all group"
            )}
          >
            <LogOut className="w-5 h-5 shrink-0 text-slate-400 group-hover:text-red-600" />
            {(sidebarOpen || (window.innerWidth < 1024)) && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Top Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="relative hidden lg:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search services..." 
                className="pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm w-64 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={toggleTheme}
              className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
            >
              {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <button className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />
            </button>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-1 rounded-lg transition-colors" onClick={() => setActiveTab("Profile")}>
              <div className="text-right hidden sm:block">
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{user?.displayName || user?.email?.split('@')[0]}</div>
                <div className="flex justify-end">
                  <MemberRankBadge spent={userData?.totalSpent || 0} size="sm" />
                </div>
              </div>
              <img 
                src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.email}&background=random`} 
                alt="" 
                className="w-10 h-10 rounded-full border-2 border-brand-100"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto w-full">
            {activeTab === "Dashboard" && (
              <>
                <div className="mb-8">
                  <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">Dashboard Overview</h1>
                  <p className="text-slate-500 dark:text-slate-400">Welcome back! Here's what's happening with your account today.</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
                  {stats.map((stat, idx) => (
                    <Card key={idx} className="border-none shadow-sm hover:shadow-md transition-shadow bg-white dark:bg-slate-900">
                      <CardContent className="p-4 md:p-6">
                        <div className="flex items-center gap-4">
                          <div className={cn("w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0", stat.bg)}>
                            <stat.icon className={cn("w-5 h-5 md:w-6 md:h-6", stat.color)} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400 mb-0.5 md:mb-1 truncate">{stat.label}</p>
                            <p className={cn(
                              "text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1",
                              stat.isCurrency ? "font-sans" : ""
                            )}>
                              {stat.isCurrency && <span className="text-slate-400 font-normal text-base md:text-lg">$</span>}
                              {stat.value}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Recent Activity / Charts Placeholder */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <Card className="lg:col-span-2 border-none shadow-sm bg-white dark:bg-slate-900">
                    <CardHeader>
                      <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">Order Statistics</CardTitle>
                      <CardDescription className="text-slate-500 dark:text-slate-400">Visual representation of your order history</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] p-6 pt-0">
                      <OrderStatisticsChart />
                    </CardContent>
                  </Card>

                  <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
                    <CardHeader>
                      <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Button className="w-full justify-start gap-3 bg-brand-600 hover:bg-brand-700" onClick={() => setActiveTab("New Order")}>
                        <ShoppingBag className="w-4 h-4" /> New Order
                      </Button>
                      <Button variant="outline" className="w-full justify-start gap-3" onClick={() => setActiveTab("Add Funds")}>
                        <Wallet className="w-4 h-4" /> Add Funds
                      </Button>
                      <Button variant="outline" className="w-full justify-start gap-3" onClick={() => setActiveTab("Support Tickets")}>
                        <MessageSquare className="w-4 h-4" /> Support Ticket
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}

            {activeTab === "Add Funds" && <AddFundsForm />}

            {activeTab === "New Order" && <NewOrderForm balance={userData?.balance || 0} setActiveTab={setActiveTab} />}

            {activeTab === "Manage Orders" && <ManageOrders />}

            {activeTab === "Transactions" && <Transactions />}

            {activeTab === "Support Tickets" && <SupportTickets />}

            {activeTab === "Admin Panel" && isAdmin && <AdminDashboard />}

            {activeTab === "Profile" && (
              <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                  <h1 className="text-2xl font-display font-bold text-slate-900">User Profile</h1>
                  <p className="text-slate-500">Manage your account settings and personal information.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <Card className="border-none shadow-sm bg-white h-fit">
                    <CardContent className="p-8 flex flex-col items-center text-center">
                      <div className="relative mb-6 group">
                        <img 
                          src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.email}&background=random`} 
                          alt="" 
                          className="w-32 h-32 rounded-full border-4 border-brand-50"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                          <span className="text-white text-xs font-medium">Change Photo</span>
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-1">{user?.displayName || "User"}</h3>
                      <p className="text-sm text-slate-500 mb-6">{user?.email}</p>
                      
                      <div className="mb-6">
                        <MemberRankBadge spent={userData?.totalSpent || 0} size="md" />
                      </div>

                      {/* Rank Progress */}
                      {(() => {
                        const currentSpent = userData?.totalSpent || 0;
                        const currentRank = getRank(currentSpent);
                        const nextRankIndex = RANKS.findIndex(r => r.id === currentRank.id) + 1;
                        const nextRank = RANKS[nextRankIndex];

                        if (!nextRank) return null;

                        const progress = ((currentSpent - currentRank.min) / (nextRank.min - currentRank.min)) * 100;
                        const needed = nextRank.min - currentSpent;

                        return (
                          <div className="w-full space-y-2 mb-6">
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              <span>Next Rank: {nextRank.name}</span>
                              <span>${needed.toFixed(2)} to go</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={cn("h-full transition-all duration-500 rounded-full bg-gradient-to-r", nextRank.gradient)} 
                                style={{ width: `${Math.min(100, Math.max(5, progress))}%` }} 
                              />
                            </div>
                          </div>
                        );
                      })()}
                      
                      <div className="w-full pt-6 border-t border-slate-100 space-y-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Member Since</span>
                          <span className="text-slate-900 font-medium">
                            {user?.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Account Status</span>
                          <span className="text-emerald-600 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Verified
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="lg:col-span-2 border-none shadow-sm bg-white">
                    <CardHeader>
                      <CardTitle className="text-lg font-bold">Edit Profile</CardTitle>
                      <CardDescription>Update your personal details and how others see you.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ProfileForm />
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {activeTab !== "Dashboard" && activeTab !== "Add Funds" && activeTab !== "Profile" && activeTab !== "Manage Orders" && activeTab !== "Transactions" && activeTab !== "Admin Panel" && activeTab !== "Support Tickets" && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <Clock className="w-10 h-10 text-slate-300" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">{activeTab} Coming Soon</h2>
                <p className="text-slate-500">We're working hard to bring you this feature. Stay tuned!</p>
                <Button variant="outline" className="mt-6" onClick={() => setActiveTab("Dashboard")}>
                  Back to Dashboard
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function AppContent() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, loading, signIn, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-200 dark:border-brand-900/20 border-t-brand-600 rounded-full animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 font-medium animate-pulse">Loading KIT GIZMO...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Dashboard />;
  }

  return (
    <div className="min-h-screen font-sans bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="text-white w-5 h-5" />
              </div>
              <span className="text-xl font-display font-bold tracking-tight text-brand-950 dark:text-white">KIT GIZMO</span>
            </div>
            
            <div className="hidden md:flex items-center gap-8">
              <a href="#services" className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">Services</a>
              <a href="#process" className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">Process</a>
              <a href="#pricing" className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">Pricing</a>
              <a href="#testimonials" className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">Testimonials</a>
              <a href="#faq" className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">FAQ</a>
              <a href="#contact" className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">Contact</a>
              
              <button 
                onClick={toggleTheme}
                className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
              >
                {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>
              
              {loading ? (
                <div className="w-24 h-9 bg-slate-100 animate-pulse rounded-md" />
              ) : user ? (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <img src={user.photoURL || ""} alt="" className="w-8 h-8 rounded-full border border-slate-200" referrerPolicy="no-referrer" />
                    <span className="text-sm font-medium text-slate-700 hidden lg:block">{user.displayName || user.email?.split('@')[0]}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={logout} className="text-slate-600 hover:text-red-600">
                    <LogOut className="w-4 h-4 mr-2" /> Logout
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Button variant="ghost" className="text-slate-600 hover:text-brand-600 hidden sm:flex">
                    Get Started
                  </Button>
                  <LoginDialog />
                </div>
              )}
            </div>

            <div className="md:hidden">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-slate-600">
                {isMenuOpen ? <X /> : <Menu />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 p-4 space-y-4"
          >
            <a href="#services" className="block text-base font-medium text-slate-600 dark:text-slate-400" onClick={() => setIsMenuOpen(false)}>Services</a>
            <a href="#process" className="block text-base font-medium text-slate-600 dark:text-slate-400" onClick={() => setIsMenuOpen(false)}>Process</a>
            <a href="#pricing" className="block text-base font-medium text-slate-600 dark:text-slate-400" onClick={() => setIsMenuOpen(false)}>Pricing</a>
            <a href="#testimonials" className="block text-base font-medium text-slate-600 dark:text-slate-400" onClick={() => setIsMenuOpen(false)}>Testimonials</a>
            <a href="#faq" className="block text-base font-medium text-slate-600 dark:text-slate-400" onClick={() => setIsMenuOpen(false)}>FAQ</a>
            <a href="#contact" className="block text-base font-medium text-slate-600 dark:text-slate-400" onClick={() => setIsMenuOpen(false)}>Contact</a>
            
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Theme</span>
              <button 
                onClick={toggleTheme}
                className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>
            </div>

            {user ? (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-4">
                  <img src={user.photoURL || ""} alt="" className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
                  <div>
                    <div className="font-bold text-slate-900">{user.displayName || user.email?.split('@')[0]}</div>
                    <div className="text-sm text-slate-500">{user.email}</div>
                  </div>
                </div>
                <Button variant="outline" className="w-full text-red-600 border-red-100 hover:bg-red-50" onClick={logout}>
                  Logout
                </Button>
              </div>
            ) : (
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <Button variant="outline" className="w-full text-slate-600">
                  Get Started
                </Button>
                <LoginDialog className="w-full" />
              </div>
            )}
          </motion.div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-white dark:bg-slate-950">
        <div className="absolute inset-0 hero-gradient -z-10 opacity-50 dark:opacity-20" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge variant="outline" className="mb-4 border-brand-200 dark:border-brand-900/30 text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 px-3 py-1">
              #1 SMM Agency Solution in the USA
            </Badge>
            <h1 className="text-5xl md:text-7xl font-display font-extrabold tracking-tight text-slate-900 dark:text-white mb-6">
              Elevate Your <span className="text-brand-600">Social Media</span> Presence
            </h1>
            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Empowering your social media success with high-impact services, data-driven strategies, and professional management.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="h-12 px-8 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow-lg shadow-brand-200 dark:shadow-none transition-all hover:scale-105">
                Get Started Now <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
              <a href="#pricing">
                <Button size="lg" variant="outline" className="h-12 px-8 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-xl">
                  View Pricing
                </Button>
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="mt-16 relative"
          >
            <div className="relative mx-auto max-w-5xl">
              <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
                <img 
                  src="https://picsum.photos/seed/dashboard/1200/600" 
                  alt="Dashboard Preview" 
                  className="rounded-xl w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              {/* Decorative elements */}
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-brand-100 rounded-full blur-3xl -z-10" />
              <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-brand-200 rounded-full blur-3xl -z-10" />
            </div>
          </motion.div>

          {/* Trusted By */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, duration: 1 }}
            className="mt-24"
          >
            <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.3em] mb-8">Trusted by industry leaders</p>
            <div className="flex flex-wrap justify-center items-center gap-12 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
              {["TechFlow", "GlobalScale", "NextGen", "CloudNine", "PeakPerformance"].map((logo, i) => (
                <div key={i} className="text-2xl font-display font-black text-slate-400 dark:text-slate-600 tracking-tighter">
                  {logo}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-slate-950 dark:bg-black border-y border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 text-center">
            {[
              { label: "Active Clients", value: "10k+" },
              { label: "Orders Completed", value: "1M+" },
              { label: "Success Rate", value: "99.9%" },
              { label: "Support Response", value: "< 5m" }
            ].map((stat, idx) => (
              <div key={idx} className="space-y-3">
                <div className="text-5xl font-display font-bold text-white tracking-tight">{stat.value}</div>
                <div className="text-xs text-brand-400 uppercase tracking-[0.2em] font-bold">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-24 bg-white dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="outline" className="mb-4 border-brand-200 dark:border-brand-900/30 text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 px-3 py-1">
              The KIT GIZMO Advantage
            </Badge>
            <h2 className="text-3xl md:text-5xl font-display font-bold text-slate-900 dark:text-white mb-6">Why Industry Leaders Trust Us</h2>
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              We combine cutting-edge technology with human expertise to deliver results that matter.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                title: "USA-Based Support",
                desc: "Our dedicated support team is based in the USA, providing 24/7 assistance with local expertise.",
                icon: <Globe className="w-8 h-8 text-brand-600" />
              },
              {
                title: "Enterprise Security",
                desc: "We prioritize your data security with military-grade encryption and secure payment gateways.",
                icon: <Shield className="w-8 h-8 text-brand-600" />
              },
              {
                title: "Proven ROI",
                desc: "Our strategies are data-driven and focused on delivering a measurable return on your investment.",
                icon: <TrendingUp className="w-8 h-8 text-brand-600" />
              }
            ].map((item, idx) => (
              <div key={idx} className="group p-8 rounded-3xl border border-slate-100 dark:border-slate-800 hover:border-brand-200 dark:hover:border-brand-900/30 transition-all hover:shadow-xl hover:shadow-brand-500/5">
                <div className="w-16 h-16 bg-brand-50 dark:bg-brand-900/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  {item.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">{item.title}</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-24 bg-slate-50 dark:bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white mb-4">High-Impact Services</h2>
            <p className="text-slate-600 dark:text-slate-400">We offer a comprehensive suite of social media marketing tools and services designed to scale your business.</p>
          </div>

          <motion.div 
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid md:grid-cols-3 gap-8"
          >
            {[
              {
                title: "Social Strategy",
                desc: "Custom-tailored strategies to align with your business goals and target audience.",
                icon: <Zap className="w-6 h-6 text-brand-600" />
              },
              {
                title: "Content Creation",
                desc: "Engaging visuals and copy that resonate with your followers and drive interaction.",
                icon: <MessageSquare className="w-6 h-6 text-brand-600" />
              },
              {
                title: "Growth Hacking",
                desc: "Proven techniques to rapidly increase your follower count and brand awareness.",
                icon: <Rocket className="w-6 h-6 text-brand-600" />
              },
              {
                title: "Analytics & Reporting",
                desc: "Detailed insights and performance tracking to measure your ROI effectively.",
                icon: <BarChart3 className="w-6 h-6 text-brand-600" />
              },
              {
                title: "Community Management",
                desc: "Professional handling of comments, messages, and audience engagement.",
                icon: <Users className="w-6 h-6 text-brand-600" />
              },
              {
                title: "Global Reach",
                desc: "Expand your brand presence across multiple platforms and international markets.",
                icon: <Globe className="w-6 h-6 text-brand-600" />
              }
            ].map((service, idx) => (
              <motion.div key={idx} variants={itemVariants}>
                <Card className="h-full hover:shadow-lg transition-shadow border-none shadow-sm bg-white dark:bg-slate-900">
                  <CardHeader>
                    <div className="w-12 h-12 bg-brand-50 dark:bg-brand-900/20 rounded-xl flex items-center justify-center mb-4">
                      {service.icon}
                    </div>
                    <CardTitle className="font-display text-slate-900 dark:text-white">{service.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-slate-600 dark:text-slate-400 text-base">{service.desc}</CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Process Section */}
      <section id="process" className="py-24 bg-white dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <Badge className="mb-4 bg-brand-100 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 hover:bg-brand-100 border-none">Our Workflow</Badge>
              <h2 className="text-4xl font-display font-bold text-slate-900 dark:text-white mb-6">From Strategy to Success: Unveiling Our Effective Process</h2>
              <p className="text-slate-600 dark:text-slate-400 mb-8">We follow a systematic approach to ensure every campaign we run delivers maximum value to our clients.</p>
              
              <div className="space-y-8">
                {[
                  { step: "01", title: "Discovery & Audit", desc: "We analyze your current presence and identify growth opportunities." },
                  { step: "02", title: "Strategy Development", desc: "Crafting a unique roadmap tailored to your specific brand needs." },
                  { step: "03", title: "Execution & Management", desc: "Our team takes over the daily operations and content delivery." },
                  { step: "04", title: "Optimization", desc: "Continuous monitoring and adjustments for peak performance." }
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-brand-200 dark:shadow-none">
                      {item.step}
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-slate-900 dark:text-white text-xl mb-1">{item.title}</h3>
                      <p className="text-slate-600 dark:text-slate-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <img 
                src="https://picsum.photos/seed/process/800/1000" 
                alt="Process Illustration" 
                className="rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800"
                referrerPolicy="no-referrer"
              />
              <div className="absolute -bottom-8 -left-8 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl max-w-xs hidden md:block border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="text-green-600 dark:text-green-400 w-6 h-6" />
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white">Quality Guaranteed</span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Our process has been refined over 5 years of serving 1000+ businesses globally.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 bg-brand-50 dark:bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white mb-4">What Our Clients Say</h2>
            <p className="text-slate-600 dark:text-slate-400">Join 1000+ companies that have switched to KIT GIZMO for their SMM needs.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: "Sarah Johnson",
                role: "Marketing Director",
                content: "KIT GIZMO transformed our Instagram presence. Our engagement increased by 300% in just three months!",
                avatar: "https://picsum.photos/seed/user1/100/100"
              },
              {
                name: "Michael Chen",
                role: "E-commerce Founder",
                content: "The analytics reports are incredibly detailed. I finally know exactly where my marketing budget is going.",
                avatar: "https://picsum.photos/seed/user2/100/100"
              },
              {
                name: "Elena Rodriguez",
                role: "Brand Manager",
                content: "Professional, responsive, and creative. They truly understand our brand voice and audience.",
                avatar: "https://picsum.photos/seed/user3/100/100"
              }
            ].map((testimonial, idx) => (
              <Card key={idx} className="border-none shadow-sm bg-white dark:bg-slate-900">
                <CardContent className="pt-8">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />)}
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 italic mb-6">"{testimonial.content}"</p>
                  <div className="flex items-center gap-4">
                    <img src={testimonial.avatar} alt={testimonial.name} className="w-12 h-12 rounded-full border border-slate-100 dark:border-slate-800" referrerPolicy="no-referrer" />
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{testimonial.name}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">{testimonial.role}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-white dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="outline" className="mb-4 border-brand-200 dark:border-brand-900/30 text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 px-3 py-1">
              Simple Pricing
            </Badge>
            <h2 className="text-3xl md:text-5xl font-display font-bold text-slate-900 dark:text-white mb-6">Plans for Every Business</h2>
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              Choose the perfect plan to accelerate your social media growth. No hidden fees.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: "Starter",
                price: "49",
                desc: "Perfect for small businesses starting their journey.",
                features: ["3 Social Profiles", "10 Posts per Month", "Basic Analytics", "Email Support"],
                button: "Get Started",
                popular: false
              },
              {
                name: "Professional",
                price: "149",
                desc: "Ideal for growing brands needing more impact.",
                features: ["10 Social Profiles", "Daily Posting", "Advanced Analytics", "Priority Support", "Custom Strategy"],
                button: "Most Popular",
                popular: true
              },
              {
                name: "Enterprise",
                price: "499",
                desc: "Full-scale solution for large organizations.",
                features: ["Unlimited Profiles", "Unlimited Posting", "Real-time Dashboard", "24/7 Dedicated Manager", "Content Creation"],
                button: "Contact Sales",
                popular: false
              }
            ].map((plan, idx) => (
              <Card key={idx} className={cn(
                "relative border-none shadow-lg transition-all hover:-translate-y-1",
                plan.popular ? "bg-brand-600 text-white scale-105 z-10" : "bg-white dark:bg-slate-900"
              )}>
                {plan.popular && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-yellow-400 text-slate-900 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    Most Popular
                  </div>
                )}
                <CardHeader className="p-8">
                  <CardTitle className={cn("text-2xl font-display", plan.popular ? "text-white" : "text-slate-900 dark:text-white")}>
                    {plan.name}
                  </CardTitle>
                  <div className="mt-4 flex items-baseline">
                    <span className="text-4xl font-bold tracking-tight">$</span>
                    <span className="text-6xl font-bold tracking-tight">{plan.price}</span>
                    <span className={cn("ml-1 text-sm font-medium", plan.popular ? "text-brand-100" : "text-slate-500")}>/month</span>
                  </div>
                  <CardDescription className={cn("mt-4", plan.popular ? "text-brand-100" : "text-slate-500 dark:text-slate-400")}>
                    {plan.desc}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-8 pt-0">
                  <ul className="space-y-4">
                    {plan.features.map((feature, fIdx) => (
                      <li key={fIdx} className="flex items-center gap-3">
                        <CheckCircle2 className={cn("w-5 h-5", plan.popular ? "text-brand-200" : "text-brand-600")} />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className={cn(
                    "w-full mt-8 h-12 font-bold rounded-xl",
                    plan.popular ? "bg-white text-brand-600 hover:bg-brand-50" : "bg-brand-600 text-white hover:bg-brand-700"
                  )}>
                    {plan.button}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 bg-white dark:bg-slate-950">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white mb-4">Frequently Asked Questions</h2>
            <p className="text-slate-600 dark:text-slate-400">Got questions? We've got answers.</p>
          </div>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1" className="border-slate-100 dark:border-slate-800">
              <AccordionTrigger className="text-left font-display font-semibold text-slate-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400">How long does it take to see results?</AccordionTrigger>
              <AccordionContent className="text-slate-600 dark:text-slate-400">
                While some improvements can be seen immediately, significant organic growth typically takes 3-6 months of consistent strategy execution.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2" className="border-slate-100 dark:border-slate-800">
              <AccordionTrigger className="text-left font-display font-semibold text-slate-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400">Do you handle all social media platforms?</AccordionTrigger>
              <AccordionContent className="text-slate-600 dark:text-slate-400">
                Yes, we specialize in Instagram, Facebook, Twitter (X), LinkedIn, TikTok, and Pinterest. We tailor our approach for each platform's unique audience.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3" className="border-slate-100 dark:border-slate-800">
              <AccordionTrigger className="text-left font-display font-semibold text-slate-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400">Can I choose specific services or do I need a package?</AccordionTrigger>
              <AccordionContent className="text-slate-600 dark:text-slate-400">
                We offer both pre-defined packages for common needs and custom-tailored solutions for specific business requirements.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4" className="border-slate-100 dark:border-slate-800">
              <AccordionTrigger className="text-left font-display font-semibold text-slate-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400">Is there a long-term contract?</AccordionTrigger>
              <AccordionContent className="text-slate-600 dark:text-slate-400">
                We offer flexible month-to-month options as well as discounted long-term partnerships. We believe our results should keep you with us, not a contract.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-brand-600 relative overflow-hidden">
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-brand-400 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-96 h-96 bg-brand-800 rounded-full blur-3xl opacity-50" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <h2 className="text-3xl md:text-5xl font-display font-bold text-white mb-6">Ready to Dazzle the World?</h2>
          <p className="text-brand-100 text-lg mb-10 max-w-2xl mx-auto">
            Join hundreds of successful brands and start your social media growth journey today. Our experts are ready to help.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" variant="secondary" className="h-12 px-8 text-brand-600 font-bold">
              Get Started Now
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 text-white border-white hover:bg-white/10">
              Contact Sales
            </Button>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 bg-slate-50 dark:bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16">
            <div>
              <Badge variant="outline" className="mb-4 border-brand-200 dark:border-brand-900/30 text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 px-3 py-1">
                Contact Us
              </Badge>
              <h2 className="text-4xl font-display font-bold text-slate-900 dark:text-white mb-6">Let's Build Something Great Together</h2>
              <p className="text-slate-600 dark:text-slate-400 mb-8 text-lg">
                Have questions about our services or need a custom solution? Our team of experts is here to help you scale your brand.
              </p>
              
              <div className="space-y-6">
                {[
                  { icon: <Mail className="w-5 h-5" />, label: "Email Us", value: "support@kitgizmo.com" },
                  { icon: <Phone className="w-5 h-5" />, label: "Call Us", value: "+1 (555) 000-0000" },
                  { icon: <MapPin className="w-5 h-5" />, label: "Visit Us", value: "123 Marketing Ave, New York, NY" }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-lg flex items-center justify-center shadow-sm border border-slate-100 dark:border-slate-800 text-brand-600">
                      {item.icon}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{item.label}</div>
                      <div className="text-slate-900 dark:text-white font-medium">{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <Card className="border-none shadow-xl bg-white dark:bg-slate-900 p-8">
              <form className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900 dark:text-white">First Name</label>
                    <Input placeholder="John" className="bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900 dark:text-white">Last Name</label>
                    <Input placeholder="Doe" className="bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-900 dark:text-white">Email Address</label>
                  <Input type="email" placeholder="john@example.com" className="bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-900 dark:text-white">Message</label>
                  <textarea 
                    className="w-full min-h-[120px] rounded-md border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white"
                    placeholder="How can we help you?"
                  />
                </div>
                <Button className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold h-12 rounded-xl">
                  Send Message
                </Button>
              </form>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-16 border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
                  <TrendingUp className="text-white w-5 h-5" />
                </div>
                <span className="text-xl font-display font-bold tracking-tight text-white">KIT GIZMO</span>
              </div>
              <p className="text-sm leading-relaxed mb-6">
                Professional SMM Agency based in the USA. We help businesses scale their online presence through data-driven strategies.
              </p>
              <div className="flex gap-4">
                <a href="#" className="hover:text-brand-400 transition-colors"><Instagram className="w-5 h-5" /></a>
                <a href="#" className="hover:text-brand-400 transition-colors"><Twitter className="w-5 h-5" /></a>
                <a href="#" className="hover:text-brand-400 transition-colors"><Facebook className="w-5 h-5" /></a>
                <a href="#" className="hover:text-brand-400 transition-colors"><Linkedin className="w-5 h-5" /></a>
              </div>
            </div>
            
            <div>
              <h4 className="text-white font-display font-bold mb-6 uppercase text-xs tracking-widest">Services</h4>
              <ul className="space-y-4 text-sm">
                <li><a href="#" className="hover:text-brand-400 transition-colors">Social Strategy</a></li>
                <li><a href="#" className="hover:text-brand-400 transition-colors">Content Creation</a></li>
                <li><a href="#" className="hover:text-brand-400 transition-colors">Growth Hacking</a></li>
                <li><a href="#" className="hover:text-brand-400 transition-colors">Analytics</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-display font-bold mb-6 uppercase text-xs tracking-widest">Company</h4>
              <ul className="space-y-4 text-sm">
                <li><a href="#" className="hover:text-brand-400 transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-brand-400 transition-colors">Our Team</a></li>
                <li><a href="#" className="hover:text-brand-400 transition-colors">Testimonials</a></li>
                <li><a href="#" className="hover:text-brand-400 transition-colors">Contact</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-display font-bold mb-6 uppercase text-xs tracking-widest">Newsletter</h4>
              <p className="text-sm mb-4">Get the latest SMM tips and tricks.</p>
              <div className="flex gap-2">
                <Input placeholder="Email address" className="bg-slate-900 border-slate-800 text-white focus:border-brand-600 transition-colors" />
                <Button size="icon" className="bg-brand-600 hover:bg-brand-700 shrink-0">
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
          
          <Separator className="bg-slate-900 mb-8" />
          
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] uppercase tracking-widest font-bold">
            <p>© 2026 KIT GIZMO SMM Agency. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-brand-400 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-brand-400 transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-brand-400 transition-colors">Cookie Policy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
