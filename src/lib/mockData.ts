// Mock data for Primansh Admin Panel

export type Client = {
  id: string;
  firm_name: string;
  location: string;
  services: string[];
  website_url: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  plan_type: "basic" | "growth" | "premium";
  status: "active" | "inactive" | "trial";
  health_score: number;
  assigned_to: string;
  monthly_revenue: number;
  slug: string;
  created_at: string;
};

export type Lead = {
  id: string;
  client_id: string;
  name: string;
  phone: string;
  email: string;
  source: "website" | "google" | "referral" | "social" | "other";
  status: "new" | "contacted" | "converted" | "lost";
  notes: string;
  created_at: string;
};

export type Task = {
  id: string;
  client_id: string;
  client_name: string;
  title: string;
  description: string;
  assigned_to: string;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  due_date: string;
  module: "seo" | "content" | "website" | "general";
};

export type Keyword = {
  id: string;
  client_id: string;
  keyword: string;
  target_pos: number;
  current_pos: number;
  last_checked: string;
  trend: "up" | "down" | "stable";
};

export type SeoChecklist = {
  item: string;
  done: boolean;
};

export type Invoice = {
  id: string;
  client_id: string;
  amount: number;
  issued_date: string;
  paid_date?: string;
  status: "paid" | "pending" | "overdue";
};

export type BlogPost = {
  id: string;
  client_id: string;
  title: string;
  author: string;
  status: "draft" | "in_review" | "published";
  created_at: string;
  scheduled_at?: string;
};

export const clients: Client[] = [
  {
    id: "c1",
    firm_name: "Sharma & Associates",
    location: "Delhi",
    services: ["GST", "ITR", "Audit"],
    website_url: "sharma-ca.com",
    contact_name: "Rakesh Sharma",
    contact_phone: "9810012345",
    contact_email: "rakesh@sharma-ca.com",
    plan_type: "premium",
    status: "active",
    health_score: 87,
    assigned_to: "Arjun Mehta",
    monthly_revenue: 25000,
    slug: "sharma-ca.com",
    created_at: "2024-01-15",
  },
  {
    id: "c2",
    firm_name: "Gupta Tax Consultants",
    location: "Mumbai",
    services: ["GST", "ITR"],
    website_url: "guptatax.in",
    contact_name: "Anjali Gupta",
    contact_phone: "9820056789",
    contact_email: "anjali@guptatax.in",
    plan_type: "growth",
    status: "active",
    health_score: 72,
    assigned_to: "Priya Singh",
    monthly_revenue: 18000,
    slug: "guptatax.in",
    created_at: "2024-02-10",
  },
  {
    id: "c3",
    firm_name: "Mehta Financial Services",
    location: "Ahmedabad",
    services: ["Audit", "ITR", "Advisory"],
    website_url: "mehtafinancial.com",
    contact_name: "Deepak Mehta",
    contact_phone: "9930023456",
    contact_email: "deepak@mehtafinancial.com",
    plan_type: "premium",
    status: "active",
    health_score: 91,
    assigned_to: "Arjun Mehta",
    monthly_revenue: 30000,
    slug: "mehtafinancial.com",
    created_at: "2024-01-20",
  },
  {
    id: "c4",
    firm_name: "Agarwal & Sons CA",
    location: "Jaipur",
    services: ["GST", "ITR"],
    website_url: "agarwalca.in",
    contact_name: "Suresh Agarwal",
    contact_phone: "9414012345",
    contact_email: "suresh@agarwalca.in",
    plan_type: "basic",
    status: "active",
    health_score: 45,
    assigned_to: "Rahul Dev",
    monthly_revenue: 8000,
    slug: "agarwalca.in",
    created_at: "2024-03-05",
  },
  {
    id: "c5",
    firm_name: "Patel Accounts",
    location: "Surat",
    services: ["GST", "Audit"],
    website_url: "patelaccounts.com",
    contact_name: "Nilesh Patel",
    contact_phone: "9898012345",
    contact_email: "nilesh@patelaccounts.com",
    plan_type: "growth",
    status: "trial",
    health_score: 34,
    assigned_to: "Priya Singh",
    monthly_revenue: 0,
    slug: "patelaccounts.com",
    created_at: "2024-03-18",
  },
  {
    id: "c6",
    firm_name: "Singh Tax Hub",
    location: "Chandigarh",
    services: ["ITR", "GST"],
    website_url: "singtaxhub.com",
    contact_name: "Harpreet Singh",
    contact_phone: "9872012345",
    contact_email: "harpreet@singtaxhub.com",
    plan_type: "basic",
    status: "inactive",
    health_score: 22,
    assigned_to: "Rahul Dev",
    monthly_revenue: 8000,
    slug: "singtaxhub.com",
    created_at: "2023-11-12",
  },
  {
    id: "c7",
    firm_name: "Verma & Co. CA",
    location: "Lucknow",
    services: ["GST", "ITR", "Advisory"],
    website_url: "vermaca.in",
    contact_name: "Pradeep Verma",
    contact_phone: "9839012345",
    contact_email: "pradeep@vermaca.in",
    plan_type: "growth",
    status: "active",
    health_score: 68,
    assigned_to: "Arjun Mehta",
    monthly_revenue: 15000,
    slug: "vermaca.in",
    created_at: "2024-02-28",
  },
  {
    id: "c8",
    firm_name: "Joshi Audit Bureau",
    location: "Pune",
    services: ["Audit", "ITR"],
    website_url: "joshiaudit.com",
    contact_name: "Kamlesh Joshi",
    contact_phone: "9767012345",
    contact_email: "kamlesh@joshiaudit.com",
    plan_type: "premium",
    status: "active",
    health_score: 80,
    assigned_to: "Priya Singh",
    monthly_revenue: 28000,
    slug: "joshiaudit.com",
    created_at: "2023-12-01",
  },
];

export const leads: Lead[] = [
  { id: "l1", client_id: "c1", name: "Vikram Nair", phone: "9876501234", email: "vikram@gmail.com", source: "google", status: "new", notes: "Interested in GST filing", created_at: "2024-03-19" },
  { id: "l2", client_id: "c1", name: "Meena Iyer", phone: "9876502234", email: "meena@yahoo.com", source: "website", status: "contacted", notes: "Wants ITR filing for FY24", created_at: "2024-03-17" },
  { id: "l3", client_id: "c1", name: "Rohit Bansal", phone: "9876503234", email: "rohit@hotmail.com", source: "referral", status: "converted", notes: "Signed up for GST + ITR combo", created_at: "2024-03-10" },
  { id: "l4", client_id: "c2", name: "Sunita Rao", phone: "9876504234", email: "sunita@gmail.com", source: "social", status: "new", notes: "Facebook ad inquirer", created_at: "2024-03-18" },
  { id: "l5", client_id: "c2", name: "Manish Thakur", phone: "9876505234", email: "manish@gmail.com", source: "google", status: "lost", notes: "Chose a local CA", created_at: "2024-03-14" },
  { id: "l6", client_id: "c3", name: "Pooja Shah", phone: "9876506234", email: "pooja@gmail.com", source: "website", status: "converted", notes: "Full audit package", created_at: "2024-03-08" },
  { id: "l7", client_id: "c7", name: "Amitabh Chauhan", phone: "9876507234", email: "amitabh@gmail.com", source: "referral", status: "contacted", notes: "Referred by Pradeep's client", created_at: "2024-03-20" },
];

export const tasks: Task[] = [
  { id: "t1", client_id: "c1", client_name: "Sharma & Associates", title: "On-page SEO audit", description: "Complete technical SEO audit for all service pages", assigned_to: "Arjun Mehta", status: "todo", priority: "high", due_date: "2024-03-25", module: "seo" },
  { id: "t2", client_id: "c2", client_name: "Gupta Tax Consultants", title: "Write GST blog post", description: "Write 1200-word blog: 'GST Filing Guide 2024'", assigned_to: "Priya Singh", status: "in_progress", priority: "medium", due_date: "2024-03-22", module: "content" },
  { id: "t3", client_id: "c3", client_name: "Mehta Financial Services", title: "Update keyword rankings", description: "Refresh keyword tracking sheet with latest positions", assigned_to: "Arjun Mehta", status: "in_progress", priority: "high", due_date: "2024-03-21", module: "seo" },
  { id: "t4", client_id: "c7", client_name: "Verma & Co. CA", title: "Add ITR service page", description: "Create dedicated page for ITR filing services", assigned_to: "Rahul Dev", status: "todo", priority: "medium", due_date: "2024-03-28", module: "website" },
  { id: "t5", client_id: "c8", client_name: "Joshi Audit Bureau", title: "GMB post update", description: "Post latest Google My Business update", assigned_to: "Priya Singh", status: "done", priority: "low", due_date: "2024-03-18", module: "seo" },
  { id: "t6", client_id: "c1", client_name: "Sharma & Associates", title: "Monthly SEO report", description: "Prepare and send SEO performance report", assigned_to: "Arjun Mehta", status: "done", priority: "high", due_date: "2024-03-15", module: "seo" },
  { id: "t7", client_id: "c4", client_name: "Agarwal & Sons CA", title: "Fix contact form", description: "Contact form not submitting on mobile", assigned_to: "Rahul Dev", status: "todo", priority: "high", due_date: "2024-03-23", module: "website" },
  { id: "t8", client_id: "c2", client_name: "Gupta Tax Consultants", title: "Backlink outreach", description: "Reach out to 5 CA directory sites for backlinks", assigned_to: "Arjun Mehta", status: "todo", priority: "medium", due_date: "2024-03-30", module: "seo" },
];

export const keywords: Keyword[] = [
  { id: "k1", client_id: "c1", keyword: "CA in Delhi", target_pos: 3, current_pos: 5, last_checked: "2024-03-19", trend: "up" },
  { id: "k2", client_id: "c1", keyword: "GST consultant Delhi", target_pos: 5, current_pos: 8, last_checked: "2024-03-19", trend: "up" },
  { id: "k3", client_id: "c1", keyword: "ITR filing Delhi", target_pos: 3, current_pos: 12, last_checked: "2024-03-19", trend: "stable" },
  { id: "k4", client_id: "c1", keyword: "tax audit services Delhi", target_pos: 5, current_pos: 4, last_checked: "2024-03-19", trend: "up" },
  { id: "k5", client_id: "c1", keyword: "best CA for GST Delhi", target_pos: 1, current_pos: 9, last_checked: "2024-03-19", trend: "down" },
  { id: "k6", client_id: "c2", keyword: "CA in Mumbai", target_pos: 5, current_pos: 11, last_checked: "2024-03-19", trend: "down" },
  { id: "k7", client_id: "c2", keyword: "GST return filing Mumbai", target_pos: 3, current_pos: 6, last_checked: "2024-03-19", trend: "up" },
];

export const seoChecklist: Record<string, SeoChecklist[]> = {
  c1: [
    { item: "On-page optimization complete", done: true },
    { item: "2 blogs published", done: true },
    { item: "GMB post updated", done: true },
    { item: "1 backlink acquired", done: false },
    { item: "GST/ITR landing page reviewed", done: true },
    { item: "Meta tags updated", done: true },
    { item: "Core Web Vitals checked", done: false },
    { item: "Monthly ranking report sent", done: true },
  ],
  c2: [
    { item: "On-page optimization complete", done: true },
    { item: "2 blogs published", done: false },
    { item: "GMB post updated", done: false },
    { item: "1 backlink acquired", done: false },
    { item: "GST/ITR landing page reviewed", done: true },
    { item: "Meta tags updated", done: true },
    { item: "Core Web Vitals checked", done: false },
    { item: "Monthly ranking report sent", done: false },
  ],
};

export const invoices: Invoice[] = [
  { id: "inv1", client_id: "c1", amount: 25000, issued_date: "2024-03-01", paid_date: "2024-03-03", status: "paid" },
  { id: "inv2", client_id: "c1", amount: 25000, issued_date: "2024-02-01", paid_date: "2024-02-04", status: "paid" },
  { id: "inv3", client_id: "c2", amount: 18000, issued_date: "2024-03-01", status: "pending" },
  { id: "inv4", client_id: "c3", amount: 30000, issued_date: "2024-03-01", paid_date: "2024-03-02", status: "paid" },
  { id: "inv5", client_id: "c8", amount: 28000, issued_date: "2024-02-01", status: "overdue" },
  { id: "inv6", client_id: "c4", amount: 8000, issued_date: "2024-03-01", status: "pending" },
];

export const blogs: BlogPost[] = [
  { id: "b1", client_id: "c1", title: "GST Filing Guide for Small Businesses 2024", author: "Priya Singh", status: "published", created_at: "2024-03-10" },
  { id: "b2", client_id: "c1", title: "How to File ITR Online: Step-by-Step", author: "Priya Singh", status: "published", created_at: "2024-03-01" },
  { id: "b3", client_id: "c2", title: "GST Return Filing Mistakes to Avoid", author: "Priya Singh", status: "in_review", created_at: "2024-03-19" },
  { id: "b4", client_id: "c3", title: "Why Your Business Needs a Tax Audit Every Year", author: "Priya Singh", status: "draft", created_at: "2024-03-20" },
];

export const analyticsData: Record<string, { date: string; traffic: number; leads: number; avgPos: number }[]> = {
  c1: [
    { date: "Oct", traffic: 820, leads: 4, avgPos: 14 },
    { date: "Nov", traffic: 1100, leads: 6, avgPos: 12 },
    { date: "Dec", traffic: 980, leads: 5, avgPos: 11 },
    { date: "Jan", traffic: 1400, leads: 9, avgPos: 9 },
    { date: "Feb", traffic: 1900, leads: 11, avgPos: 7 },
    { date: "Mar", traffic: 2341, leads: 14, avgPos: 6 },
  ],
  c2: [
    { date: "Oct", traffic: 430, leads: 2, avgPos: 18 },
    { date: "Nov", traffic: 510, leads: 3, avgPos: 16 },
    { date: "Dec", traffic: 490, leads: 2, avgPos: 15 },
    { date: "Jan", traffic: 620, leads: 4, avgPos: 13 },
    { date: "Feb", traffic: 780, leads: 5, avgPos: 11 },
    { date: "Mar", traffic: 940, leads: 6, avgPos: 9 },
  ],
};

export const teamMembers = [
  { id: "u1", name: "Primansh Patel", role: "super_admin", email: "primansh@agency.in" },
  { id: "u2", name: "Arjun Mehta", role: "seo", email: "arjun@agency.in" },
  { id: "u3", name: "Priya Singh", role: "content", email: "priya@agency.in" },
  { id: "u4", name: "Rahul Dev", role: "developer", email: "rahul@agency.in" },
];
