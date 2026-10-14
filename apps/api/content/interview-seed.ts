export interface InterviewCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  bg: string;
  deactivated?: boolean;
}

export const interviewCategories: InterviewCategory[] = [
  {
    id: "web-dev",
    name: "Web Development",
    description: "HTML, CSS, JavaScript, React, REST APIs, databases",
    color: "#0073ff",
    bg: "#dfe9ff",
  },
  {
    id: "data-science",
    name: "Data Science & Analytics",
    description: "Python, SQL, Machine Learning, data visualization",
    color: "#7c3aed",
    bg: "#ede9fe",
  },
  {
    id: "cybersecurity",
    name: "Cybersecurity",
    description: "Network security, ethical hacking, risk assessment",
    color: "#dc2626",
    bg: "#fee2e2",
  },
  {
    id: "bpo",
    name: "BPO & Customer Service",
    description: "Communication, problem solving, customer relations",
    color: "#059669",
    bg: "#d1fae5",
  },
  {
    id: "behavioral",
    name: "Behavioral / HR Interview",
    description: "STAR method, soft skills, situational judgment",
    color: "#d97706",
    bg: "#fef3c7",
  },
  {
    id: "mobile-dev",
    name: "Mobile Development",
    description: "React Native, Flutter, iOS, Android, app architecture",
    color: "#0891b2",
    bg: "#e0f7fa",
  },
  {
    id: "cloud-devops",
    name: "Cloud & DevOps",
    description: "AWS, Azure, GCP, Docker, Kubernetes, CI/CD pipelines",
    color: "#0369a1",
    bg: "#e0f2fe",
  },
  {
    id: "ui-ux",
    name: "UI/UX Design",
    description: "Figma, user research, prototyping, usability testing",
    color: "#be185d",
    bg: "#fce7f3",
  },
  {
    id: "database",
    name: "Database Administration",
    description: "SQL, PostgreSQL, MySQL, MongoDB, normalization, query optimization",
    color: "#b45309",
    bg: "#fef3c7",
  },
  {
    id: "networking",
    name: "Network Engineering",
    description: "OSI model, TCP/IP, routing, switching, troubleshooting",
    color: "#065f46",
    bg: "#d1fae5",
  },
  {
    id: "qa-testing",
    name: "Software QA & Testing",
    description: "Test planning, manual & automated testing, bug lifecycle",
    color: "#6d28d9",
    bg: "#ede9fe",
  },
  {
    id: "game-dev",
    name: "Game Development",
    description: "Unity, Unreal Engine, C#, C++, gameplay physics, shaders, game loops",
    color: "#ea580c",
    bg: "#ffedd5",
  },
];

export const CODING_IDS = new Set(["web-dev", "data-science", "mobile-dev", "database", "game-dev"]);
export const NON_TECHNICAL_IDS = new Set(["bpo", "behavioral"]);

export function getCategoryPipeline(catId: string): string {
  if (NON_TECHNICAL_IDS.has(catId)) {
    return "Intro → Situational → Behavioral → Q&A";
  }
  if (CODING_IDS.has(catId)) {
    return "Intro → Situational → Technical → Coding → Q&A";
  }
  return "Intro → Situational → Technical → Q&A";
}

export interface InterviewQuestion {
  question: string;
  type: string;
  hint: string;
  feedback: string;
  deactivated?: boolean;
}

export const interviewQuestions: Record<string, InterviewQuestion[]> = {
  "web-dev": [
    {
      question:
        "Explain the difference between `==` and `===` in JavaScript. Give a concrete example of when each should — and should not — be used.",
      type: "Technical",
      hint: "Think about type coercion vs. strict equality comparison.",
      feedback:
        "A strong answer clearly distinguishes type coercion (==) from strict comparison (===), provides concrete examples (0 == false is true, but 0 === false is false), and recommends === as the default practice to avoid unexpected bugs. Mentioning common gotchas like null == undefined earns extra points.",
    },
    {
      question:
        "What is the Virtual DOM in React? Explain how it works and why it improves performance over directly manipulating the real DOM.",
      type: "Technical",
      hint: "Explain the diffing algorithm and reconciliation process.",
      feedback:
        "Strong answers describe the Virtual DOM as an in-memory UI representation, explain React's reconciliation/diffing algorithm, and contrast it with expensive real DOM operations. Mention that React only updates the minimal changed parts, and optionally discuss React Fiber's incremental rendering.",
    },
    {
      question:
        "Describe a challenging front-end bug you encountered in a project. How did you identify the root cause and resolve it?",
      type: "Behavioral",
      hint: "Use the STAR method: Situation, Task, Action, Result.",
      feedback:
        "Strong responses follow the STAR method, show systematic debugging (DevTools, console logs, isolating components), and demonstrate what you learned. Quantifying impact (e.g., 'fixed a race condition causing 20% of form submissions to fail') and mentioning tools used shows technical depth.",
    },
  ],
  "data-science": [
    {
      question:
        "What is the difference between supervised and unsupervised learning? Give a real-world example of each relevant to the Philippine context.",
      type: "Technical",
      hint: "Supervised uses labeled data; unsupervised finds patterns in unlabeled data.",
      feedback:
        "A comprehensive answer explains labeled vs. unlabeled datasets, correctly categorizes algorithms (classification/regression vs. clustering/dimensionality reduction), and gives relevant local examples (e.g., fraud detection in GCash/Maya for supervised; customer segmentation for unsupervised).",
    },
    {
      question:
        "Your dataset has 35% missing values in a critical feature column. Walk through your complete decision-making process for handling this.",
      type: "Technical",
      hint: "Consider imputation strategies, dropping, and model-based approaches.",
      feedback:
        "Strong answers discuss multiple strategies (mean/median imputation, KNN imputation, MICE, creating a missingness indicator) and explain that the right approach depends on WHY data is missing (MCAR, MAR, MNAR). Mentioning domain knowledge as a factor shows practical experience.",
    },
    {
      question:
        "Tell me about a time you presented data findings to a non-technical audience. How did you make the insights clear and actionable?",
      type: "Behavioral",
      hint: "Focus on storytelling, visualization choices, and avoiding jargon.",
      feedback:
        "Effective answers lead with business insights (not methodology), use visuals over raw tables, employ analogies for complex concepts, and confirm understanding with follow-up questions. Mentioning specific tools like Tableau, Power BI, or even simple Google Slides strengthens the answer.",
    },
  ],
  cybersecurity: [
    {
      question:
        "Explain the difference between symmetric and asymmetric encryption. When would you use each, and what are the trade-offs?",
      type: "Technical",
      hint: "Consider key management, speed, and use cases like HTTPS and file encryption.",
      feedback:
        "Strong answers explain symmetric (same key, faster, key distribution problem) vs. asymmetric (public/private pair, slower, solves key distribution). Excellent answers mention hybrid approaches used in TLS and give concrete algorithm examples (AES-256, RSA-2048). Mentioning performance implications earns bonus points.",
    },
    {
      question:
        "What is a SQL injection attack? Show an example of vulnerable code and explain at least three prevention techniques.",
      type: "Technical",
      hint: "Think about parameterized queries, input validation, and least-privilege principles.",
      feedback:
        "Comprehensive answers show a real vulnerable query, demonstrate the exploit (e.g., entering ' OR 1=1 --), and clearly explain mitigations: parameterized queries/prepared statements, input validation and sanitization, least-privilege DB accounts, and Web Application Firewalls (WAFs).",
    },
    {
      question:
        "During your OJT, you discover a critical zero-day vulnerability in a production system. No senior is immediately available. What do you do?",
      type: "Situational",
      hint: "Think about responsible disclosure, escalation, containment, and documentation.",
      feedback:
        "Outstanding answers follow responsible disclosure: thoroughly document the vulnerability (screenshots, reproduction steps), escalate through proper channels even after hours, avoid publicizing it externally, and recommend temporary mitigations without taking drastic unilateral action. Shows ethical judgment and professionalism.",
    },
  ],
  bpo: [
    {
      question:
        "A customer calls furious about a billing error they've experienced three times this month. How do you handle the interaction?",
      type: "Situational",
      hint: "Lead with empathy, take ownership, and provide a clear resolution path.",
      feedback:
        "Strong answers demonstrate the HEARD technique (Hear, Empathize, Apologize, Resolve, Diagnose), avoid defensive language, take personal ownership ('I will personally ensure this is fixed today'), provide a concrete resolution timeline, and mention follow-up. Proposing compensation or escalation when warranted shows customer-first thinking.",
    },
    {
      question:
        "How do you maintain focus and accuracy during a high-volume shift with back-to-back calls or tickets?",
      type: "Behavioral",
      hint: "Discuss tools, prioritization strategies, and how you handle burnout.",
      feedback:
        "Effective answers discuss concrete strategies: batch processing similar tickets, using keyboard shortcuts/macros, structured note-taking between calls, prioritizing by urgency/impact, and sustainable self-care (short mental resets, staying hydrated). Shows awareness of sustainable productivity over time.",
    },
    {
      question:
        "What does excellent customer service mean to you? Give a specific example of when you went above and beyond for someone.",
      type: "Behavioral",
      hint: "Be specific and personal. Show you care about outcomes, not just scripts.",
      feedback:
        "Great answers define excellence as making customers feel heard and genuinely valued — not just resolving the ticket. Specific examples with measurable outcomes are far more powerful than generalizations. Tying your philosophy back to business value (retention, NPS, word-of-mouth) shows business acumen.",
    },
  ],
  behavioral: [
    {
      question:
        "Tell me about a time you had to work with a difficult team member on a group project. How did you navigate it?",
      type: "Behavioral",
      hint: "Focus on what YOU did, not what the other person did wrong. Use STAR.",
      feedback:
        "Strong STAR responses highlight the candidate's own behavior (empathy, direct communication, compromise) without blaming the other party. Excellent answers show maturity: recognizing different working styles, finding common ground, and ending with a positive outcome for the team. Shows emotional intelligence.",
    },
    {
      question:
        "Describe a situation where you had to quickly learn a new technology or tool under time pressure. What was your approach?",
      type: "Behavioral",
      hint: "Show your learning process: resources, practice, mentorship, and validation.",
      feedback:
        "Strong answers show a structured learning approach: official documentation, hands-on mini-projects, asking mentors for feedback, and iterating. Demonstrates growth mindset and resourcefulness. Bonus: tie the new skill to a concrete outcome that benefited the team or project.",
    },
    {
      question:
        "Where do you see yourself professionally in 3 years? How does completing your OJT at this company fit into that plan?",
      type: "Motivational",
      hint: "Be specific, show knowledge of the company, and connect your goals to what they offer.",
      feedback:
        "Compelling answers name a specific career direction (not just 'I want to be a developer'), demonstrate genuine knowledge of what the company does and the industry it's in, and explain why this particular OJT is a strategic step in their plan. Authentic enthusiasm beats rehearsed generic ambition every time.",
    },
  ],
  "mobile-dev": [
    {
      question:
        "Explain the key architectural differences between React Native and Flutter. What factors would influence your choice between them for a new project?",
      type: "Technical",
      hint: "Think about language, rendering approach, ecosystem, and performance trade-offs.",
      feedback:
        "Strong answers distinguish React Native (JavaScript bridge, native components) from Flutter (Dart, custom rendering engine). Mentioning trade-offs — RN's larger ecosystem vs. Flutter's consistent UI across platforms, or Dart's learning curve vs. JS familiarity — shows depth. Noting company stack, team skills, and platform targets as decision factors earns extra credit.",
    },
    {
      question:
        "What is state management in mobile applications, and why does it matter? Compare at least two state management solutions and explain when you'd use each.",
      type: "Technical",
      hint: "Cover local vs. global state. Think about Redux, Zustand, Provider, Bloc, or Context API.",
      feedback:
        "A solid answer explains why uncontrolled state causes bugs and UI inconsistency, then compares approaches: local state (useState/setState) for isolated components, Context API or Provider for moderate shared state, Redux/Bloc/Zustand for complex global state with many consumers. Mentioning boilerplate trade-offs and when NOT to use a heavy state manager shows practical judgment.",
    },
    {
      question:
        "Describe a mobile app you built or significantly contributed to. Walk through a specific technical challenge you encountered and how you resolved it.",
      type: "Behavioral",
      hint: "Use STAR. Focus on technical depth — what broke, how you diagnosed it, what you shipped.",
      feedback:
        "Strong responses detail a real problem — memory leaks, slow FlatList rendering, API race conditions, platform-specific bugs — and walk through the debugging and resolution process. Mentioning tools (Flipper, Xcode Instruments, Android Profiler) and measurable outcomes (startup time, crash rate) elevates the answer significantly.",
    },
  ],
  "cloud-devops": [
    {
      question:
        "Explain the difference between IaaS, PaaS, and SaaS. Give a real-world example of each, and describe which model is most appropriate for a startup deploying a web API.",
      type: "Technical",
      hint: "Think about the responsibility model: who manages what at each layer.",
      feedback:
        "A thorough answer clearly defines each model (IaaS: raw infra — AWS EC2; PaaS: managed platform — Heroku/GCP App Engine; SaaS: ready-to-use software — Salesforce/Gmail) and explains the shared-responsibility boundary. For the startup scenario, recommending PaaS or a managed container service (GCP Cloud Run, AWS ECS) with justification — no infra management overhead — shows practical cloud judgment.",
    },
    {
      question:
        "What is a CI/CD pipeline? Describe the typical stages, explain what happens at each, and name the tools you've used or studied.",
      type: "Technical",
      hint: "Cover source → build → test → artifact → deploy → monitor. Mention at least one tool per stage.",
      feedback:
        "Strong answers walk through: commit triggers (GitHub Actions, GitLab CI, Jenkins), build stage (Docker image creation), automated test suite (unit, integration), artifact storage (container registry, S3), deployment (rolling update, blue-green, canary), and monitoring/rollback strategy. Mentioning environment separation (dev/staging/prod) and IaC tools (Terraform, Ansible) shows senior awareness.",
    },
    {
      question:
        "You deploy a new container image to production and the service immediately starts returning 500 errors. Walk through your incident response process step by step.",
      type: "Situational",
      hint: "Think: detect → contain → diagnose → fix → post-mortem.",
      feedback:
        "Excellent answers follow an incident response pattern: check monitoring dashboards/alerts first, immediately roll back to the last known-good image to restore service, then diagnose in staging (logs, diff between images, health checks). Mentioning communication (stakeholder updates), blameless post-mortems, and adding a regression test demonstrates SRE maturity beyond just 'fix the bug.'",
    },
  ],
  "ui-ux": [
    {
      question:
        "Walk me through your end-to-end design process when starting a project from a blank slate. What artifacts do you produce at each stage?",
      type: "Technical",
      hint: "Cover research → define → ideate → prototype → test → hand-off.",
      feedback:
        "Strong answers follow a structured process: discovery (user interviews, competitive analysis), define (personas, journey maps, problem statement), ideate (sketches, crazy-8s), prototype (low-fi wireframes → high-fi Figma), test (usability sessions, heatmaps), hand-off (design tokens, component specs, developer notes). Mentioning iteration loops and how you incorporate feedback shows real UX maturity.",
    },
    {
      question:
        "What is the difference between usability testing and A/B testing? When is each appropriate, and what metrics do you use to evaluate success?",
      type: "Technical",
      hint: "Think: qualitative insight vs. quantitative comparison. Sample size matters too.",
      feedback:
        "Usability testing reveals WHY users struggle (qualitative, small sample, moderated sessions, think-aloud protocol). A/B testing reveals WHICH variant performs better (quantitative, large sample, statistical significance required). Using usability testing early to discover problems and A/B testing later to validate solutions is the correct order. Metrics: task completion rate, time-on-task, SUS score (usability); CTR, conversion rate, bounce rate (A/B).",
    },
    {
      question:
        "Tell me about a design decision you made that was challenged by a developer or stakeholder. How did you defend or adapt your position?",
      type: "Behavioral",
      hint: "Show that you can balance user advocacy with engineering constraints and business goals.",
      feedback:
        "Great answers show collaboration over ego: the candidate clearly explains the user rationale behind their design, actively listens to the constraint (technical feasibility, timeline, cost), and finds a middle ground that preserves the core user goal. Mentioning user research data or usability findings as the anchor for your argument — rather than personal preference — shows professional design advocacy.",
    },
  ],
  database: [
    {
      question:
        "Explain the difference between INNER JOIN, LEFT JOIN, RIGHT JOIN, and FULL OUTER JOIN. For each, describe a scenario where it's the correct choice.",
      type: "Technical",
      hint: "Think in terms of which rows are preserved when there is no match on the other side.",
      feedback:
        "Solid answers pair each join type with a concrete scenario: INNER JOIN (orders with matching customers only), LEFT JOIN (all customers, including those with no orders — to find inactive users), RIGHT JOIN (rarely preferred; same as LEFT with tables swapped), FULL OUTER JOIN (all records from both tables — for reconciliation or merge reports). Drawing the Venn diagram in words earns extra points.",
    },
    {
      question:
        "What is database normalization? Explain 1NF, 2NF, and 3NF with a practical example, and describe when you might intentionally denormalize.",
      type: "Technical",
      hint: "Use a concrete table example. Denormalization has legitimate use cases — name one.",
      feedback:
        "A complete answer walks through: 1NF (atomic values, no repeating groups), 2NF (no partial dependencies on composite PK), 3NF (no transitive dependencies). Using a real example — like an Orders table — to show each violation and its fix is ideal. For denormalization: reporting databases, read-heavy workloads, and OLAP warehouses are valid cases. Mentioning performance as the trade-off against data integrity demonstrates balance.",
    },
    {
      question:
        "A SQL query on a table with 5 million rows is taking 30 seconds. Walk through your complete process for diagnosing and optimizing it.",
      type: "Technical",
      hint: "Start with EXPLAIN/EXPLAIN ANALYZE, then think indexes, joins, SELECT *, and query rewriting.",
      feedback:
        "Strong answers follow a systematic approach: run EXPLAIN/EXPLAIN ANALYZE to read the query plan, identify full table scans or nested loops, check if appropriate indexes exist (and if the query is using them), review SELECT * usage, look for N+1 patterns in application code, consider pagination. Advanced answers mention covering indexes, query rewriting, materialized views, or partitioning for very large tables.",
    },
  ],
  networking: [
    {
      question:
        "Explain the OSI model. Name each layer and describe what happens at that layer when a user types a URL into a browser and presses Enter.",
      type: "Technical",
      hint: "Walk it top-down: Application → Presentation → Session → Transport → Network → Data Link → Physical.",
      feedback:
        "A strong answer maps real events to each layer: Application (HTTP/HTTPS request formed), Presentation (TLS encryption, data encoding), Session (TCP session established), Transport (TCP segments with port numbers), Network (IP packets routed via DNS-resolved IP), Data Link (Ethernet frames with MAC address), Physical (bits over cable/WiFi). Mentioning DNS resolution, TCP three-way handshake, and TLS handshake within the appropriate layers demonstrates depth.",
    },
    {
      question:
        "Explain the difference between TCP and UDP. For each, name two real-world protocols that use it and explain why that transport choice makes sense.",
      type: "Technical",
      hint: "Think: reliability, ordering, overhead. What matters more — correctness or speed?",
      feedback:
        "TCP (connection-oriented, reliable, ordered, error-checked) is used by HTTP/HTTPS (correctness over speed) and SMTP (email must arrive intact). UDP (connectionless, lower overhead, no guaranteed delivery) is used by DNS (fast single lookups tolerate packet loss), video streaming/VoIP (latency beats occasional dropped frames). Mentioning QUIC as a modern UDP-based transport that adds reliability is a bonus point.",
    },
    {
      question:
        "A user reports they cannot access any website but can ping 8.8.8.8 successfully. Walk through your troubleshooting process.",
      type: "Situational",
      hint: "They have IP connectivity but not DNS resolution. Think about what ping uses vs. what a browser uses.",
      feedback:
        "The key insight: ping to 8.8.8.8 succeeds (IP connectivity fine) but websites fail (DNS resolution broken). Next step is to test DNS specifically — ping google.com (hostname), run nslookup or dig to query the configured DNS server. Likely causes: DNS server unreachable, misconfigured DNS settings, or ISP DNS blocking. Fixes: change DNS to 8.8.8.8 or 1.1.1.1, flush DNS cache, check /etc/resolv.conf or network adapter settings.",
    },
  ],
  "qa-testing": [
    {
      question:
        "Explain the difference between unit testing, integration testing, system testing, and end-to-end testing. How do they fit together in the testing pyramid?",
      type: "Technical",
      hint: "Think about scope, speed, isolation, and cost. The pyramid has a reason for its shape.",
      feedback:
        "A complete answer describes each level: unit (single function/class, fast, isolated, mocked dependencies), integration (two or more modules together, verifies interfaces), system (entire application in a controlled environment), E2E (simulates real user flows in a browser/device). The pyramid shape explains the ideal ratio: many fast unit tests, fewer integration tests, fewest slow E2E tests. Mentioning tools (Jest, Pytest, Selenium, Cypress, Postman) adds credibility.",
    },
    {
      question:
        "You are handed a feature with no existing test plan and a two-day deadline. Walk through how you would create a test plan and prioritize what to test.",
      type: "Situational",
      hint: "Think: requirements → risk → test cases → priority → execution order.",
      feedback:
        "Strong answers start by understanding requirements and acceptance criteria, identify the highest-risk areas (new code, third-party integrations, payment flows), write test cases covering happy paths first then edge cases, and prioritize by business impact. Mentioning risk-based testing, smoke tests vs. regression tests, and what to explicitly descope given time constraints shows QA maturity. Communicating coverage decisions to the team is also key.",
    },
    {
      question:
        "You discover a critical bug in production the day before a major release. You reported it two days ago but it was dismissed. How do you handle this?",
      type: "Situational",
      hint: "Balance professionalism, data-driven escalation, and the business vs. quality trade-off.",
      feedback:
        "Excellent answers document the bug thoroughly (steps to reproduce, severity, business impact, affected users), escalate with data rather than emotion, and present options: delay release, ship with a known workaround, or accept the risk with a rollback plan. Showing that you track bugs systematically, communicate proactively, and respect the final decision while ensuring it is an informed one demonstrates professional QA judgment — not just technical skill.",
    },
  ],
  "game-dev": [
    {
      question:
        "Explain the difference between Update() and FixedUpdate() in a game engine like Unity. Why is frame-rate independence critical in game physics, and what happens if you move physics-driven objects inside Update()?",
      type: "Technical",
      hint: "Think about variable frame times (Time.deltaTime) vs. fixed physics tick intervals (Time.fixedDeltaTime).",
      feedback:
        "A strong answer explains that Update() runs once per rendered frame (variable rate depending on hardware workload), whereas FixedUpdate() runs on a reliable fixed physics timer (default 50Hz in Unity). Moving physics or applying forces inside Update() causes jitter, clipping, or tunneling because delta time fluctuates between frames. Calculating physics exclusively in FixedUpdate() guarantees deterministic, stable simulation across high-end and low-end target devices.",
    },
    {
      question:
        "What is Object Pooling in game development? Walk through why frequent instantiation and destruction of game objects causes performance stutters (garbage collection spikes), and how an object pool resolves this.",
      type: "Technical",
      hint: "Focus on heap allocation, Garbage Collector pauses, active/inactive states, and recycling.",
      feedback:
        "An excellent explanation describes how Instantiate() allocates heap memory and Destroy() leaves unreferenced memory, triggering the C# Garbage Collector (GC). When GC kicks in, it halts execution, causing noticeable frame drops and micro-stutters. Object pooling pre-allocates a fixed pool of objects (e.g., bullets, enemies, particles) at initialization, activates them on demand, and deactivates/recycles them back to the pool instead of destroying them, keeping frame rates buttery smooth.",
    },
    {
      question:
        "Describe a challenging game bug you encountered (e.g., physics glitch, memory leak, collision tunneling, animation desync). How did you profile, isolate, and fix it under a deadline or game jam setting?",
      type: "Behavioral",
      hint: "Use STAR. Discuss profiling tools (Unity Profiler, Unreal Insights), repro steps, and performance impact.",
      feedback:
        "Strong answers describe systematic problem-solving: capturing repro steps, using engine profilers (profiling CPU spikes, memory allocations, draw calls), isolating the subsystem, and applying a clean architectural fix rather than a quick hack. Mentioning playtesting feedback or deadline prioritization highlights real-world game development team readiness.",
    },
  ],
};

/* ── Coding / practical challenges (one per technical category) ── */
export const codingChallenges: Record<string, InterviewQuestion> = {
  "web-dev": {
    question:
      "Implement a debounce function in JavaScript from scratch. Then show how you would use it to delay an API call triggered by a search input field. Explain why debouncing matters in this context.",
    type: "Coding",
    hint: "A debounce delays execution until N ms have passed since the last call. Use setTimeout and clearTimeout. The returned function should preserve `this` and spread arguments.",
    feedback:
      "A complete answer implements the core debounce (closure over a timer, clearTimeout on each new call, setTimeout with the provided delay), shows its usage on an input's onChange handler, and explains the user-experience rationale (avoids an API request on every keystroke). Bonus points for handling edge cases like immediate invocation on the first call, or noting that lodash/debounce exists for production use. Using `function` vs arrow function to preserve `this` context is a common gotcha worth mentioning.",
  },
  "data-science": {
    question:
      "Given a sales DataFrame with columns [date, product, region, revenue], write Python/pandas code to: (1) find the top 3 products by total revenue in Q1 of the current year, and (2) calculate the month-over-month revenue growth rate for each region. Show your code and briefly explain each step.",
    type: "Coding",
    hint: "Use pd.to_datetime for date parsing, .groupby() + .sum() for aggregation, .pct_change() for growth rates, and .nlargest() for ranking. Filter Q1 with .dt.quarter == 1.",
    feedback:
      "A solid answer parses the date column correctly, filters for Q1 using .dt.quarter, groups by product, sums revenue, and uses .nlargest(3). For MoM growth, grouping by [region, month] then applying .pct_change() on the sorted series is the key step. Formatting the output clearly (reset_index, round percentages) shows production-quality thinking. Mentioning .fillna(0) for missing months and potential division-by-zero handling earns extra credit.",
  },
  "cybersecurity": {
    question:
      "The following PHP code is used in a login endpoint. Identify every security vulnerability present, explain how each could be exploited, and rewrite the function securely:\n\n```php\n$user = $_POST['username'];\n$pass = $_POST['password'];\n$query = \"SELECT * FROM users WHERE username='$user' AND password='$pass'\";\n$result = mysql_query($query);\nif(mysql_num_rows($result) > 0) { $_SESSION['user'] = $user; }\n```",
    type: "Coding",
    hint: "Identify at least 3 vulnerabilities. Think: SQL injection, plaintext password storage, deprecated API, session fixation, missing rate limiting.",
    feedback:
      "A complete answer identifies: (1) SQL injection via string interpolation — fix with PDO prepared statements; (2) plaintext password comparison — fix with password_hash/password_verify; (3) deprecated mysql_* API — replace with PDO or MySQLi; (4) no rate limiting on login attempts — add login attempt tracking; (5) session fixation risk — call session_regenerate_id(true) after authentication. Rewriting with PDO, password_hash, and session regeneration demonstrates practical secure coding ability rather than just pattern recognition.",
  },
  "mobile-dev": {
    question:
      "Build a React Native component called ProductList that: fetches a list of products from a REST API (https://api.example.com/products), shows a loading spinner while fetching, handles and displays API errors gracefully, and renders the results in a FlatList with product name and price. Write the full component code.",
    type: "Coding",
    hint: "Use useEffect + useState (or useReducer) for async state. Structure state as { data, loading, error }. Use ActivityIndicator for loading. FlatList requires keyExtractor and renderItem.",
    feedback:
      "A strong implementation manages three states (loading, error, data) — not just the happy path. Using a try/catch inside useEffect, setting loading to false in a finally block, and showing meaningful error messages (not just console.log) demonstrates production awareness. Passing keyExtractor as a string key (not index) and using memo or useCallback on renderItem for performance shows depth. Bonus: adding a retry button on error state.",
  },
  "cloud-devops": {
    question:
      "Write a production-ready multi-stage Dockerfile for a Node.js Express API. The build stage should install all dependencies and compile TypeScript. The production stage should only contain the compiled output and production dependencies. Also write a basic GitHub Actions CI workflow that builds and pushes the image to a container registry on push to main.",
    type: "Coding",
    hint: "Use FROM node:18-alpine AS builder for the build stage. Copy only package*.json first for layer caching. Use --only=production in the final stage. The GH Actions workflow needs checkout, docker/setup-buildx-action, and docker/build-push-action.",
    feedback:
      "A complete Dockerfile uses multi-stage builds to keep the production image small (copying only /dist and running npm ci --only=production). Correct layer ordering (copy package.json → npm install → copy source) is critical for caching. The CI workflow should use docker/login-action for registry auth, build-push-action with tags, and ideally run tests before the build step. Using COPY --chown=node:node and switching to a non-root USER in the final stage demonstrates security awareness.",
  },
  "ui-ux": {
    question:
      "You are redesigning the checkout flow for a Philippine e-commerce mobile app. Analytics show 68% of users abandon the cart specifically at the payment step. Describe your full UX research and design process, identify likely causes of abandonment, and sketch (in text) the key screens of your proposed redesign. What metrics would you use to measure success?",
    type: "Design Challenge",
    hint: "Start with research (user interviews, session recordings, heatmaps). Common causes: unexpected fees, too many form fields, trust signals missing, no preferred payment method. Philippine context: GCash/Maya, COD preference.",
    feedback:
      "A strong answer identifies research methods before jumping to solutions (session recordings, exit surveys, checkout funnel analytics). Root causes commonly include hidden shipping fees, forced account creation, limited local payment options (no GCash/Maya/COD), and lack of trust signals (padlock, security badges). The redesign should address each: show total price early, offer guest checkout, add GCash/Maya, display trust signals prominently. Success metrics: checkout completion rate, payment step abandonment rate, time-on-payment-page, and post-launch NPS.",
  },
  "database": {
    question:
      "Given a company database with tables: employees(id, name, dept_id, salary, hire_date) and departments(id, name, manager_id), write SQL queries to: (1) find the top 3 highest-paid employees per department, (2) identify departments where the average salary exceeds the company-wide average, and (3) list managers whose team average salary is below their own salary.",
    type: "Coding",
    hint: "Use window functions (ROW_NUMBER / RANK) for top-N per group. Use a subquery or CTE for company-wide average. For managers, self-join employees to get their team via dept_id.",
    feedback:
      "Query 1 requires ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY salary DESC) in a CTE, then filtering WHERE rn <= 3. Query 2 uses GROUP BY dept_id HAVING AVG(salary) > (SELECT AVG(salary) FROM employees). Query 3 joins departments to employees twice — once for the team avg, once for the manager's own salary. Using CTEs for readability over nested subqueries shows SQL maturity. Mentioning that these queries would benefit from indexes on dept_id and salary is production-aware thinking.",
  },
  "networking": {
    question:
      "You have been assigned the network 172.16.0.0/20. You need to create 6 subnets of equal size to serve 6 departments, each requiring at least 200 usable host addresses. Show your work: (1) verify the requirement is achievable, (2) calculate the new subnet mask, (3) list all 6 subnet network addresses, broadcast addresses, and usable host ranges.",
    type: "Coding",
    hint: "A /24 gives 254 hosts. Count available bits in the original /20 block (12 host bits). To create 6 subnets you need at least 3 subnet bits (2³=8 ≥ 6). New mask = /20+3 = /23. Verify: 2⁹-2 = 510 hosts per subnet ≥ 200.",
    feedback:
      "A correct answer identifies that /23 (255.255.254.0) gives 8 possible subnets of 510 usable hosts each — satisfying both the count (≥6) and host (≥200) requirements. The 6 subnet network addresses increment by 512 (the block size): 172.16.0.0, 172.16.2.0, 172.16.4.0, 172.16.6.0, 172.16.8.0, 172.16.10.0. Each broadcast address is the last IP in its block (e.g., 172.16.1.255). Showing the calculation clearly (2^n formula, CIDR notation, binary subnet mask) demonstrates networking fundamentals beyond memorization.",
  },
  "qa-testing": {
    question:
      "Write a comprehensive set of test cases for a login form with these requirements: (1) email must be valid format, (2) password must be at least 8 characters, (3) account locks after 5 failed attempts for 30 minutes, (4) successful login redirects to dashboard, (5) 'Forgot Password' link is present. Include positive, negative, and edge cases. Use a clear format: Test ID | Scenario | Input | Expected Result | Priority.",
    type: "Coding",
    hint: "Cover happy path, boundary values (7 chars vs 8 chars), invalid formats, SQL injection attempt, empty fields, case sensitivity, account lockout (4 fails vs 5th fail vs 6th attempt during lockout), and the forgot password link.",
    feedback:
      "A thorough test suite covers: TC01 valid login (P1), TC02 invalid email format (P1), TC03 password exactly 7 chars (P1), TC04 password exactly 8 chars (P1), TC05 empty email (P1), TC06 empty password (P1), TC07 SQL injection in email field (P1 — security), TC08 4th failed attempt — no lockout yet (P2), TC09 5th failed attempt — triggers lockout (P1), TC10 attempt during lockout period (P1), TC11 lockout expires after 30 min (P2), TC12 forgot password link visible and navigates (P2), TC13 case-insensitive email (P3). Missing security test cases or lockout boundary tests are the most common gaps.",
  },
  "bpo": {
    question:
      "A customer contacts you via chat saying their internet service has been down for 6 hours. They are working from home and have already missed two important meetings. They are very upset and have threatened to cancel their account. Write your full chat response: (1) your opening message, (2) how you troubleshoot with them, (3) how you escalate if needed, and (4) your closing message. Use realistic customer service language.",
    type: "Situational",
    hint: "Lead with empathy before troubleshooting. Acknowledge the business impact specifically. Offer a concrete resolution timeline. Use 'I' statements to take ownership.",
    feedback:
      "A strong response opens with genuine empathy acknowledging the missed meetings (not just the outage), introduces yourself by name to personalize the interaction, and uses 'I' language to take ownership ('I will personally make sure this is resolved'). Troubleshooting should be structured (check account status → basic modem reset → line check → technical escalation) with clear communication at each step. Escalation language should empower rather than deflect ('I'm bringing in our senior technical team right now'). The closing should confirm resolution, offer compensation if applicable, and thank them for their patience.",
  },
  "behavioral": {
    question:
      "You are interviewing for your OJT placement. The interviewer says: 'Walk me through a specific project or academic experience where things did not go as planned. What went wrong, what did you do about it, and what would you do differently today?' Write your full answer as you would actually say it in a real interview.",
    type: "Behavioral",
    hint: "Use STAR. Choose a real, specific example. Be honest about what went wrong — interviewers respect self-awareness. Focus on what YOU personally did, not what the team did. End with a concrete lesson.",
    feedback:
      "A compelling answer chooses a specific story (not vague 'we had a group project') and is honest about the failure without excessive self-criticism. The STAR structure keeps it focused: Situation (context), Task (your role), Action (what you specifically did to address it), Result (outcome and learning). Strong answers name a concrete lesson that you have since applied — this shows growth mindset. Avoid stories where external factors (bad teammates, unclear instructions) are entirely to blame for the failure. Interviewers want to see that you take ownership.",
  },
  "game-dev": {
    question:
      "Implement a generic ObjectPool class in C# (or pseudo-code) for reusable GameObjects. Include: (1) an initialization method that pre-warms the pool with N instances, (2) a Get() method that retrieves an inactive object (or instantiates a new one if empty), and (3) a ReturnToPool() method that resets the object's state and returns it to the pool.",
    type: "Coding",
    hint: "Use a Queue<T> or List<T> for storing inactive pooled items. Ensure instantiated objects start inactive and are set active upon retrieval.",
    feedback:
      "A complete implementation uses a Queue<T> for O(1) dequeue and enqueue operations, pre-warms the pool in the constructor/init, sets gameObject.SetActive(true) when retrieved, and SetActive(false) with a state reset interface (like IPoolable.OnSpawn/OnDespawn) when returned. Bonus points for handling pool expansion with a maximum capacity guard, or thread-safety considerations.",
  },
};
