import type {
  Company,
  EventRecord,
  Goal,
  Interaction,
  Meeting,
  Note,
  Person,
  Reflection,
  Task,
} from "./types";

// Everything is generated relative to "today" so the demo always looks alive,
// regardless of when it's opened.
const NOW = new Date();
function daysFromNow(offset: number, hour = 9, minute = 0): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() + offset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter.toString().padStart(4, "0")}`;
}

// ---------------- Companies ----------------

const companyDefs: Array<Omit<Company, "id" | "created_at" | "updated_at">> = [
  {
    name: "RBC Ventures",
    industry: "Financial services",
    location: "Toronto, Canada",
    website: "https://rbcx.com",
    notes: "Corporate venture arm; interested in fintech partnerships.",
  },
  {
    name: "Shopify",
    industry: "E-commerce platform",
    location: "Ottawa, Canada",
    website: "https://shopify.com",
    notes: "Bumby Wool's storefront runs on Shopify.",
  },
  {
    name: "Clearco",
    industry: "Fintech / revenue-based financing",
    location: "Toronto, Canada",
    website: "https://clearco.com",
    notes: null,
  },
  {
    name: "Diagram Ventures",
    industry: "Venture capital",
    location: "Montreal, Canada",
    website: "https://diagram.ventures",
    notes: "Early-stage fund, active at ALL IN.",
  },
  {
    name: "Kanpai Labs",
    industry: "AI / developer tools",
    location: "Calgary, Canada",
    website: "https://kanpailabs.io",
    notes: "Small AI-native team, potential Njiru integration partner.",
  },
];

export const companies: Company[] = companyDefs.map((c) => ({
  ...c,
  id: nextId("company"),
  created_at: daysFromNow(-60),
  updated_at: daysFromNow(-60),
}));

const companyId = (name: string) =>
  companies.find((c) => c.name === name)!.id;

// ---------------- Events ----------------

const eventDefs: Array<Omit<EventRecord, "id" | "created_at" | "updated_at">> = [
  {
    name: "ALL IN Conference",
    location: "Montreal, Canada",
    start_date: daysFromNow(-11),
    end_date: daysFromNow(-7),
    description: "Canada's largest AI conference. Attended for Bumby Wool + Njiru.",
  },
  {
    name: "Calgary Founders Coffee",
    location: "Calgary, Canada",
    start_date: daysFromNow(-20),
    end_date: daysFromNow(-20),
    description: "Monthly informal meetup for local founders.",
  },
  {
    name: "Fintech North Summit",
    location: "Toronto, Canada",
    start_date: daysFromNow(14),
    end_date: daysFromNow(15),
    description: "Upcoming — considering attending for Njiru fundraising conversations.",
  },
];

export const events: EventRecord[] = eventDefs.map((e) => ({
  ...e,
  id: nextId("event"),
  created_at: daysFromNow(-60),
  updated_at: daysFromNow(-60),
}));

const eventId = (name: string) => events.find((e) => e.name === name)!.id;

// ---------------- People ----------------

const avatarColors = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#64748b",
];

interface PersonDef {
  name: string;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  location: string | null;
  industry: string | null;
  company: string | null;
  how_we_met: string | null;
  met_event: string | null;
  last_interaction_days: number;
  next_follow_up_days: number | null;
  tags: string[];
}

const personDefs: PersonDef[] = [
  {
    name: "Sarah Chen",
    email: "sarah.chen@rbcventures.com",
    phone: null,
    linkedin: "linkedin.com/in/sarahchen",
    location: "Toronto, Canada",
    industry: "Fintech",
    company: "RBC Ventures",
    how_we_met: "Met at ALL IN Conference",
    met_event: "ALL IN Conference",
    last_interaction_days: -7,
    next_follow_up_days: 3,
    tags: ["fintech", "potential partner", "toronto"],
  },
  {
    name: "John Okoro",
    email: "john.okoro@rbc.com",
    phone: null,
    linkedin: "linkedin.com/in/johnokoro",
    location: "Toronto, Canada",
    industry: "Banking / Partnerships",
    company: "RBC Ventures",
    how_we_met: "Introduced by Sarah Chen at ALL IN",
    met_event: "ALL IN Conference",
    last_interaction_days: -6,
    next_follow_up_days: -1,
    tags: ["banking", "partnerships", "warm intro"],
  },
  {
    name: "Priya Natarajan",
    email: "priya@diagram.ventures",
    phone: null,
    linkedin: "linkedin.com/in/priyanatarajan",
    location: "Montreal, Canada",
    industry: "Venture capital",
    company: "Diagram Ventures",
    how_we_met: "Panel Q&A at ALL IN Conference",
    met_event: "ALL IN Conference",
    last_interaction_days: -8,
    next_follow_up_days: 6,
    tags: ["investor", "pre-seed", "montreal"],
  },
  {
    name: "Marcus Lindqvist",
    email: "marcus@clearco.com",
    phone: null,
    linkedin: "linkedin.com/in/marcuslindqvist",
    location: "Toronto, Canada",
    industry: "Fintech",
    company: "Clearco",
    how_we_met: "Cold LinkedIn outreach",
    met_event: null,
    last_interaction_days: -18,
    next_follow_up_days: null,
    tags: ["fintech", "lending"],
  },
  {
    name: "Greg Farny",
    email: "greg@bumbywool.com",
    phone: null,
    linkedin: null,
    location: "Calgary, Canada",
    industry: "Retail / Accounting",
    company: null,
    how_we_met: "Bumby Wool bookkeeping contractor",
    met_event: null,
    last_interaction_days: -2,
    next_follow_up_days: 1,
    tags: ["bumby wool", "finance", "ops"],
  },
  {
    name: "Brigette Kaminski",
    email: "b.kaminski@senecapolytechnic.ca",
    phone: null,
    linkedin: "linkedin.com/in/brigettekaminski",
    location: "Toronto, Canada",
    industry: "Education",
    company: null,
    how_we_met: "Seneca Polytechnic student project liaison",
    met_event: null,
    last_interaction_days: -5,
    next_follow_up_days: 10,
    tags: ["seneca", "student projects", "bumby wool"],
  },
  {
    name: "Amara Diallo",
    email: "amara.diallo@kanpailabs.io",
    phone: null,
    linkedin: "linkedin.com/in/amaradiallo",
    location: "Calgary, Canada",
    industry: "AI / developer tools",
    company: "Kanpai Labs",
    how_we_met: "Calgary Founders Coffee",
    met_event: "Calgary Founders Coffee",
    last_interaction_days: -20,
    next_follow_up_days: null,
    tags: ["ai", "calgary", "technical"],
  },
  {
    name: "Daniel Osei",
    email: "daniel@shopify.com",
    phone: null,
    linkedin: "linkedin.com/in/danielosei",
    location: "Ottawa, Canada",
    industry: "E-commerce platform",
    company: "Shopify",
    how_we_met: "Shopify partner support escalation",
    met_event: null,
    last_interaction_days: -14,
    next_follow_up_days: null,
    tags: ["shopify", "platform", "support"],
  },
  {
    name: "Lisa Mwende Muli",
    email: "lisa@njiru.co",
    phone: null,
    linkedin: "linkedin.com/in/lisamwendemuli",
    location: "Nairobi, Kenya",
    industry: "AI security / fintech",
    company: null,
    how_we_met: "Co-founder, Njiru",
    met_event: null,
    last_interaction_days: -1,
    next_follow_up_days: 0,
    tags: ["njiru", "co-founder", "cto"],
  },
  {
    name: "Nancy Kamau",
    email: "nancy.kamau@outlook.com",
    phone: null,
    linkedin: "linkedin.com/in/nancykamau",
    location: "Calgary, Canada",
    industry: "Job seeker / operations",
    company: null,
    how_we_met: "Helped with a resume rebuild",
    met_event: null,
    last_interaction_days: -25,
    next_follow_up_days: null,
    tags: ["mentorship", "resume"],
  },
];

export const people: Person[] = personDefs.map((p, i) => ({
  id: nextId("person"),
  name: p.name,
  email: p.email,
  phone: p.phone,
  linkedin: p.linkedin,
  location: p.location,
  industry: p.industry,
  company_id: p.company ? companyId(p.company) : null,
  how_we_met: p.how_we_met,
  met_event_id: p.met_event ? eventId(p.met_event) : null,
  last_interaction_at: daysFromNow(p.last_interaction_days),
  next_follow_up_at:
    p.next_follow_up_days === null ? null : daysFromNow(p.next_follow_up_days),
  tags: p.tags,
  avatar_color: avatarColors[i % avatarColors.length],
  hubspot_contact_id: null,
  hubspot_synced_at: null,
  is_marketing_contact: false,
  relationship_area: null,
  relationship_type: null,
  weconnect_status: null,
  priority_next_step: null,
  created_at: daysFromNow(p.last_interaction_days - 1),
  updated_at: daysFromNow(p.last_interaction_days),
}));

const personId = (name: string) => people.find((p) => p.name === name)!.id;

// ---------------- Notes (raw memory, layer 1 + AI summary, layer 2) ----------------

interface NoteDef {
  title: string;
  raw: string;
  summary: string;
  days_ago: number;
  person_names: string[];
  company_names: string[];
  event_names: string[];
  tags: string[];
}

const noteDefs: NoteDef[] = [
  {
    title: "Met Sarah Chen at ALL IN",
    raw: "I met Sarah Chen at the All In conference. She works in fintech and is based in Toronto. She mentioned that she knows someone at RBC who might be useful. I should follow up with her next week.",
    summary:
      "Met Sarah Chen (RBC Ventures, Toronto, fintech) at ALL IN. She offered an RBC connection. Follow-up planned for next week.",
    days_ago: 7,
    person_names: ["Sarah Chen"],
    company_names: ["RBC Ventures"],
    event_names: ["ALL IN Conference"],
    tags: ["fintech", "toronto", "all in"],
  },
  {
    title: "John introduced by Sarah",
    raw: "I talked to John today. He's at RBC and said he'd introduce me to Sarah about the partnerships angle. He seemed genuinely interested in what Njiru is doing for remote workers. Need to follow up with him about the Sarah introduction — he said he'd send an email but it hasn't come through yet.",
    summary:
      "John Okoro (RBC) is interested in Njiru's remote-worker fintech angle and offered to connect via Sarah. Introduction email still pending.",
    days_ago: 6,
    person_names: ["John Okoro", "Sarah Chen"],
    company_names: ["RBC Ventures"],
    event_names: ["ALL IN Conference"],
    tags: ["fintech", "warm intro", "njiru"],
  },
  {
    title: "Priya Natarajan panel conversation",
    raw: "Caught Priya from Diagram Ventures after her panel at All In. She asked good questions about our unit economics for Njiru and said to send a one-pager once we have traction numbers. She's focused on pre-seed in the Quebec/Ontario corridor mostly but said she'd take a look regardless.",
    summary:
      "Priya Natarajan (Diagram Ventures) asked about Njiru unit economics; wants a one-pager once traction numbers exist. Primarily invests pre-seed in Quebec/Ontario.",
    days_ago: 8,
    person_names: ["Priya Natarajan"],
    company_names: ["Diagram Ventures"],
    event_names: ["ALL IN Conference"],
    tags: ["investor", "njiru", "fundraising"],
  },
  {
    title: "Greg — Bumby Wool August close",
    raw: "Sync with Greg on the August books. Shopify export was messy again — need to standardize the COGS mapping before it goes into his spreadsheet. He's going to have a draft KPI report by Wednesday. Reminder to review it before it goes to Stephanie.",
    summary:
      "Greg Farny working on August close for Bumby Wool; COGS mapping from Shopify still needs standardizing. Draft KPI report expected Wednesday.",
    days_ago: 2,
    person_names: ["Greg Farny"],
    company_names: [],
    event_names: [],
    tags: ["bumby wool", "finance", "kpi"],
  },
  {
    title: "Brigette — Seneca student project kickoff",
    raw: "Call with Brigette about the next cohort of Seneca students working on the Bumby Fit Finder quiz. She wants a project brief by mid-October. I mentioned we'd also want help on the Shopify storefront fixes if there's bandwidth on the team.",
    summary:
      "Brigette Kaminski (Seneca) needs a project brief by mid-October for the next student cohort; possible scope includes the Fit Finder quiz and Shopify storefront fixes.",
    days_ago: 5,
    person_names: ["Brigette Kaminski"],
    company_names: [],
    event_names: [],
    tags: ["seneca", "bumby wool", "student projects"],
  },
  {
    title: "Amara — Calgary Founders Coffee",
    raw: "Good conversation with Amara from Kanpai Labs at founders coffee. They're building developer tooling for AI agents and she was curious about how we're doing extraction for Njiru. Nothing concrete yet but worth staying in touch — she offered to compare notes on structured extraction approaches sometime.",
    summary:
      "Amara Diallo (Kanpai Labs) is building AI agent developer tooling; open to comparing notes on structured extraction with Njiru. No concrete next step yet.",
    days_ago: 20,
    person_names: ["Amara Diallo"],
    company_names: ["Kanpai Labs"],
    event_names: ["Calgary Founders Coffee"],
    tags: ["ai", "calgary", "networking"],
  },
  {
    title: "Marcus at Clearco — lending conversation",
    raw: "Marcus reached back out about revenue-based financing for Bumby Wool's inventory cycle. Sent him our basic numbers last month, haven't heard back since. Not urgent but shouldn't let it go cold completely.",
    summary:
      "Marcus Lindqvist (Clearco) discussed revenue-based financing for Bumby Wool inventory; awaiting response after sending numbers last month.",
    days_ago: 18,
    person_names: ["Marcus Lindqvist"],
    company_names: ["Clearco"],
    event_names: [],
    tags: ["fintech", "lending", "bumby wool"],
  },
  {
    title: "Daniel — Shopify support escalation",
    raw: "Daniel from Shopify partner support finally got back about the storefront checkout bug. Fix is scheduled on their end for next release, no action needed from us. Good to keep his contact for future platform issues.",
    summary:
      "Daniel Osei (Shopify) confirmed a fix is scheduled for the storefront checkout bug; no action needed on Bumby Wool's side.",
    days_ago: 14,
    person_names: ["Daniel Osei"],
    company_names: ["Shopify"],
    event_names: [],
    tags: ["shopify", "bumby wool", "resolved"],
  },
  {
    title: "Lisa — Njiru backend sync",
    raw: "Quick sync with Lisa on the Njiru backend. She's close to done on the compliance module for remittance limits. We agreed the mobile app timeline slips to November unless we bring on another engineer. She's also going to look into the AI risk framework for the next investor conversation.",
    summary:
      "Lisa Mwende Muli (Njiru co-founder/CTO) is near completion on the compliance module; mobile app timeline likely slips to November without another engineer.",
    days_ago: 1,
    person_names: ["Lisa Mwende Muli"],
    company_names: [],
    event_names: [],
    tags: ["njiru", "engineering", "roadmap"],
  },
  {
    title: "General reflection — ALL IN takeaways",
    raw: "Overall All In was worth the trip. Best conversations were with investors who wanted real numbers, not just a pitch. Biggest miss: I didn't have a one-pager ready on the spot for Priya, had to promise to follow up instead of handing something over immediately. Fix that before the next conference.",
    summary:
      "ALL IN conference reflection: strongest conversations were investor-numbers-driven; lesson learned is to always carry a ready one-pager.",
    days_ago: 7,
    person_names: ["Priya Natarajan"],
    company_names: [],
    event_names: ["ALL IN Conference"],
    tags: ["reflection", "all in", "fundraising"],
  },
];

export const notes: Note[] = noteDefs.map((n) => ({
  id: nextId("note"),
  title: n.title,
  raw_content: n.raw,
  ai_summary: n.summary,
  source_type: "text",
  archived: false,
  person_ids: n.person_names.map(personId),
  company_ids: n.company_names.map(companyId),
  event_ids: n.event_names.map(eventId),
  tags: n.tags,
  ai_processed: true,
  created_at: daysFromNow(-n.days_ago, 10, 15),
  updated_at: daysFromNow(-n.days_ago, 10, 15),
}));

const noteId = (title: string) => notes.find((n) => n.title === title)!.id;

// ---------------- Interactions ----------------

interface InteractionDef {
  person: string;
  type: Interaction["type"];
  summary: string;
  days_ago: number;
  location: string | null;
  source_note?: string;
}

const interactionDefs: InteractionDef[] = [
  { person: "Sarah Chen", type: "event", summary: "Met at ALL IN Conference", days_ago: 7, location: "Montreal, Canada", source_note: "Met Sarah Chen at ALL IN" },
  { person: "John Okoro", type: "conversation", summary: "Discussed Njiru's remote-worker angle; offered intro via Sarah", days_ago: 6, location: "Montreal, Canada", source_note: "John introduced by Sarah" },
  { person: "Priya Natarajan", type: "conversation", summary: "Post-panel conversation about Njiru unit economics", days_ago: 8, location: "Montreal, Canada", source_note: "Priya Natarajan panel conversation" },
  { person: "Greg Farny", type: "meeting", summary: "August close sync, COGS mapping review", days_ago: 2, location: "Calgary, Canada (video)", source_note: "Greg — Bumby Wool August close" },
  { person: "Brigette Kaminski", type: "call", summary: "Next Seneca cohort kickoff discussion", days_ago: 5, location: null, source_note: "Brigette — Seneca student project kickoff" },
  { person: "Amara Diallo", type: "event", summary: "Calgary Founders Coffee conversation", days_ago: 20, location: "Calgary, Canada", source_note: "Amara — Calgary Founders Coffee" },
  { person: "Marcus Lindqvist", type: "email", summary: "Follow-up on revenue-based financing numbers", days_ago: 18, location: null, source_note: "Marcus at Clearco — lending conversation" },
  { person: "Daniel Osei", type: "email", summary: "Shopify checkout bug resolution confirmed", days_ago: 14, location: null, source_note: "Daniel — Shopify support escalation" },
  { person: "Lisa Mwende Muli", type: "meeting", summary: "Njiru backend + roadmap sync", days_ago: 1, location: null, source_note: "Lisa — Njiru backend sync" },
  { person: "Nancy Kamau", type: "call", summary: "Resume review session", days_ago: 25, location: null },
];

export const interactions: Interaction[] = interactionDefs.map((i) => ({
  id: nextId("interaction"),
  person_id: personId(i.person),
  type: i.type,
  summary: i.summary,
  occurred_at: daysFromNow(-i.days_ago, 11, 0),
  location: i.location,
  source_note_id: i.source_note ? noteId(i.source_note) : null,
  created_at: daysFromNow(-i.days_ago, 11, 0),
  updated_at: daysFromNow(-i.days_ago, 11, 0),
}));

// ---------------- Tasks ----------------

interface TaskDef {
  title: string;
  description: string | null;
  status: Task["status"];
  priority: Task["priority"];
  due_offset_days: number | null;
  person: string | null;
  ai_generated: boolean;
  source_note?: string;
  completed_offset_days?: number;
}

const taskDefs: TaskDef[] = [
  {
    title: "Follow up with Sarah about RBC connection",
    description: "She offered to connect us with someone at RBC — close the loop before it goes cold.",
    status: "todo",
    priority: "high",
    due_offset_days: 0,
    person: "Sarah Chen",
    ai_generated: true,
    source_note: "Met Sarah Chen at ALL IN",
  },
  {
    title: "Follow up with John about the Sarah introduction",
    description: "He said he'd send an intro email but it hasn't arrived yet.",
    status: "todo",
    priority: "medium",
    due_offset_days: -1,
    person: "John Okoro",
    ai_generated: true,
    source_note: "John introduced by Sarah",
  },
  {
    title: "Send Priya a one-pager once traction numbers are ready",
    description: "She asked for updated unit economics before she'll take a closer look.",
    status: "todo",
    priority: "medium",
    due_offset_days: 6,
    person: "Priya Natarajan",
    ai_generated: true,
    source_note: "Priya Natarajan panel conversation",
  },
  {
    title: "Review Greg's KPI report draft",
    description: "Due before it goes out — check the COGS mapping is standardized.",
    status: "todo",
    priority: "high",
    due_offset_days: 0,
    person: "Greg Farny",
    ai_generated: true,
    source_note: "Greg — Bumby Wool August close",
  },
  {
    title: "Send Brigette the Seneca project brief",
    description: "Needed by mid-October for the next student cohort.",
    status: "completed",
    priority: "low",
    due_offset_days: null,
    person: "Brigette Kaminski",
    ai_generated: true,
    source_note: "Brigette — Seneca student project kickoff",
    completed_offset_days: -1,
  },
];

export const tasks: Task[] = taskDefs.map((t) => ({
  id: nextId("task"),
  title: t.title,
  description: t.description,
  status: t.status,
  priority: t.priority,
  due_date: t.due_offset_days === null ? null : daysFromNow(t.due_offset_days, 17, 0),
  completed_at:
    t.completed_offset_days !== undefined ? daysFromNow(t.completed_offset_days) : null,
  related_person_id: t.person ? personId(t.person) : null,
  related_note_id: t.source_note ? noteId(t.source_note) : null,
  related_goal_id: null,
  ai_generated: t.ai_generated,
  source_note_id: t.source_note ? noteId(t.source_note) : null,
  created_at: daysFromNow(-2),
  updated_at: daysFromNow(-2),
}));

// ---------------- Goals ----------------

interface GoalDef {
  name: string;
  description: string;
  term: Goal["term"];
  target_offset_days: number;
  status: Goal["status"];
  progress: number;
}

const goalDefs: GoalDef[] = [
  {
    name: "Launch Stephanie's dashboard MVP",
    description: "Ship a working prototype tonight, functional MVP by Thursday.",
    term: "short_term",
    target_offset_days: 3,
    status: "on_track",
    progress: 35,
  },
  {
    name: "Close August books for Bumby Wool",
    description: "Finalize KPI reporting pipeline with Greg before month-end review.",
    term: "short_term",
    target_offset_days: 5,
    status: "on_track",
    progress: 60,
  },
  {
    name: "Line up 3 warm investor conversations for Njiru",
    description: "Convert ALL IN connections into real follow-up meetings.",
    term: "short_term",
    target_offset_days: 21,
    status: "at_risk",
    progress: 20,
  },
  {
    name: "Build a durable professional network across fintech + AI in Canada",
    description: "Long-running effort — conferences, warm intros, staying in touch.",
    term: "long_term",
    target_offset_days: 365,
    status: "on_track",
    progress: 25,
  },
  {
    name: "Grow Njiru to first paying remittance customers",
    description: "Compliance module, mobile app, and first pilot users.",
    term: "long_term",
    target_offset_days: 180,
    status: "on_track",
    progress: 15,
  },
  {
    name: "Establish Bumby Wool as a recognized name in sustainable wool retail",
    description: "Brand, storefront, and student-project pipeline all feeding into this.",
    term: "long_term",
    target_offset_days: 270,
    status: "on_track",
    progress: 40,
  },
];

export const goals: Goal[] = goalDefs.map((g) => ({
  id: nextId("goal"),
  name: g.name,
  description: g.description,
  term: g.term,
  target_date: daysFromNow(g.target_offset_days),
  status: g.status,
  progress: g.progress,
  related_task_ids: [],
  related_note_ids: [],
  created_at: daysFromNow(-30),
  updated_at: daysFromNow(-1),
}));

// link the MVP goal to the "review Greg's KPI report" style tasks loosely (kept minimal/explicit)
goals[1].related_task_ids = [tasks[3].id];
tasks[3] = { ...tasks[3], related_goal_id: goals[1].id };

// ---------------- Reflections ----------------

interface ReflectionDef {
  type: Reflection["type"];
  content: string;
  days_ago: number;
  person?: string;
  source_note?: string;
}

const reflectionDefs: ReflectionDef[] = [
  {
    type: "lesson",
    content: "Always carry a ready one-pager to conferences — promising to follow up loses momentum.",
    days_ago: 7,
    person: "Priya Natarajan",
    source_note: "General reflection — ALL IN takeaways",
  },
  {
    type: "success",
    content: "Got a warm RBC introduction path through Sarah and John within the first day of ALL IN.",
    days_ago: 6,
    person: "Sarah Chen",
  },
  {
    type: "success",
    content: "Shopify checkout bug resolved without needing to build a workaround — the platform relationship paid off.",
    days_ago: 14,
    person: "Daniel Osei",
  },
  {
    type: "failure",
    content: "Let the Marcus/Clearco financing conversation go quiet for over two weeks after sending numbers.",
    days_ago: 4,
    person: "Marcus Lindqvist",
  },
  {
    type: "lesson",
    content: "Standardizing the Shopify-to-COGS mapping before it hits Greg's spreadsheet saves a full review cycle every month.",
    days_ago: 2,
    person: "Greg Farny",
    source_note: "Greg — Bumby Wool August close",
  },
];

export const reflections: Reflection[] = reflectionDefs.map((r) => ({
  id: nextId("reflection"),
  type: r.type,
  content: r.content,
  related_person_ids: r.person ? [personId(r.person)] : [],
  related_goal_id: null,
  source_note_id: r.source_note ? noteId(r.source_note) : null,
  created_at: daysFromNow(-r.days_ago),
  updated_at: daysFromNow(-r.days_ago),
}));

// ---------------- Meetings ----------------

export const meetings: Meeting[] = [
  {
    id: nextId("meeting"),
    title: "ALL IN Conference — investor conversations",
    date: daysFromNow(-8),
    attendees: [
      { person_id: personId("Sarah Chen"), name: "Sarah Chen" },
      { person_id: personId("John Okoro"), name: "John Okoro" },
      { person_id: personId("Priya Natarajan"), name: "Priya Natarajan" },
    ],
    transcript: null,
    summary:
      "Series of informal conversations at ALL IN covering fintech partnerships (RBC) and pre-seed investment interest (Diagram Ventures).",
    action_items: [
      "Follow up with Sarah about RBC connection",
      "Follow up with John about the Sarah introduction",
      "Send Priya a one-pager once traction numbers are ready",
    ],
    decisions: [],
    related_person_ids: [personId("Sarah Chen"), personId("John Okoro"), personId("Priya Natarajan")],
    related_company_ids: [companyId("RBC Ventures"), companyId("Diagram Ventures")],
    follow_ups: ["Sarah — this week", "John — overdue", "Priya — after traction numbers"],
    source: "manual",
    created_at: daysFromNow(-8),
    updated_at: daysFromNow(-8),
  },
];

// ---------------- Activity log (for AI insight generation) ----------------

export const seedGeneratedAt = NOW.toISOString();
