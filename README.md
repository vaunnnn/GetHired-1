# GetHired

For a single Vercel project with Next.js and an internal Express service, see
the [Vercel services deployment guide](docs/vercel-services.md).

## Developer Setup Guide

Follow these steps to get the project up and running on your local machine.

### Prerequisites

Ensure you have the following installed:
- **Node.js** 22.22.0 (see `.node-version`)
- **npm** (bundled with Node.js) or your preferred package manager
- **Git**

### Installation & Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Alicia-Kate-Bactasa/GetHired.git
   cd GetHired
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure the server:**
   Copy `.env.example` to `.env.local` and `apps/api/.env.example` to `apps/api/.env.local`; merge settings if files already exist. Generate one random `API_GATEWAY_SECRET` and set the same value in both files. Keep `AUTH_ENABLED=false` in the API environment until connecting Supabase. Follow the [separate API setup guide](docs/backend-b1-extraction.md#local-setup). Login/profile/logout and protected workspaces use the API; authentication fails closed until enabled and configured. Business screens still use prototype data. Apply the [B3 migration and deployment steps](docs/backend-b3-integration.md) before deploying this revision.

4. **Start the API and frontend in separate terminals:**
   ```bash
   npm run dev:api
   ```

   ```bash
   npm run dev
   ```

5. **Open in browser:**
   Navigate to [http://localhost:3000](http://localhost:3000) to view the app. Hot reload is enabled, so changes in `src/` will reflect immediately.

### Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Runs the Next.js development server at `http://localhost:3000` |
| `npm run dev:api` | Runs the separate API at `http://localhost:4000` |
| `npm run build` | Compiles and builds the production application |
| `npm run build:api` | Builds shared contracts and the standalone API |
| `npm run start` | Starts the production server after building |
| `npm run start:api` | Starts the compiled API using supplied environment variables |
| `npm run format` | Checks and formats source code with `oxfmt` |
| `npm run typecheck` | Checks TypeScript types |
| `npm test` | Runs API, JWT/CSRF, embedded PostgreSQL, and proxy tests |
| `npm run test:http` | After both builds, verifies temporary local production API/frontend services |
| `npm run test:browser` | After the frontend build, checks session UI and cross-tab refresh in headless Chrome with a local test fixture |

### Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Backend:** Separate Node.js + Express 5 API; Supabase Auth/PostgreSQL adapters with verified staging connectivity; B3 deployment pending
- **UI Library:** React 19
- **Styling:** Tailwind CSS v4
- **Language:** TypeScript

---

### The Problem

Although DCISM provides a list of industry partners, students may still find it difficult to determine which companies best match their interests, skills, and practicum requirements. Students often need to research companies individually and may also lack sufficient preparation for the interview process.

### The Solution
GetHired will provide a centralized and searchable directory of DCISM industry partners. Each company will have standardized information such as its industry, areas of specialization, relevant IT roles, location, and available OJT or internship information. Companies will be categorized based on information gathered from official company websites, career pages, job postings, and other reliable sources. A company may belong to multiple categories, allowing students to find companies based on their specific interests.

The platform will also provide category-based mock interviews. Students can select a field, such as Web Development or Data Analytics, and practice through technical, behavioral, and situational questions prepared specifically for that category.

### Target Users
**Students:** Second-year and upper-year college students pursuing BS Information Technology and related programs at the University of San Carlos seeking OJT/practicum placements.

**Admins:** OJT Coordinators/ DCISM Faculty / Creators of the app managing industry partner data, categories, and interview question banks.


### Existing Solutions
LinkedIn, Jobstreet, and other job posting applications were used by students to check and avail if there are internship opportunities offered by companies. Even Facebook and other social media platforms were used by students to stay updated for announcements released by companies that are using social media for either job offerings or internships. However, students may need to research companies by either visiting their profiles and may also lack sufficient preparation for the interview process as well which in return, doesn’t necessarily resolve the problem entirely.

### What Makes the App Different
GetHired is specifically designed around the needs of **DCISM students** seeking OJT or practicum opportunities, rather than general job seekers. Instead of requiring students to search through different platforms and research companies individually, GetHired provides a centralized directory of DCISM industry partners in one place.

The system allows students to search, filter, save, and compare companies based on factors such as industry, specialization, role, and location. This makes it easier for students to narrow down companies that are relevant to their interests and practicum requirements.
GetHired also goes beyond company discovery by providing **category-based mock interviews**. Students can practice both technical and behavioral questions through multiple-choice and essay-type questions and receive AI-powered feedback on their written responses.
What makes GetHired different is that it connects two parts of the OJT application process in a single platform:

> Find the right company → Prepare for the interview → Become more confident in applying.

Rather than competing directly with platforms such as LinkedIn or JobStreet, GetHired serves as a specialized preparation and company-selection platform for DCISM students, complementing the existing job-search platforms they already use.


### Feasibility Check
Feasibility: Highly Feasible

**Technical Feasibility:**
The proposed tech stack is industry-standard and well-documented. Outsourcing the complex essay-evaluation logic to an external AI API is a practical, highly achievable approach that avoids the overhead of training custom machine learning models. 

**Schedule Feasibility:**
The allocated 16-week project timeline is realistic and methodically structured. Breaking the project into six distinct sprints allows for iterative development, with dedicated weeks specifically reserved for user testing, bug fixing, and deployment.

**Skill Feasibility:**
The team is organized with clear, non-overlapping responsibilities (Directory UI, Auth/Accounts UI, Admin Panel, AI/Backend Integration, and Database/DevOps). This modular division of labor ensures all architectural layers are covered without creating development bottlenecks.  

**Economic Feasibility:**
With an allocated budget of 100K, the project is well within financial feasibility. The chosen tech stack and API operate on generous free-to-low-cost tiers, keeping foundational infrastructure expenses near zero. The budget provides more than enough capital to comfortably cover domain registration, API scaling, potential tier upgrades, user testing incentives, and operational contingencies. 


### Core Feature
The central pillar of this proposed system is allowing students to browse partners by category, directly solving the inefficiency of having students manually check individual companies from a master list.

If the budget is cut to 50,000, the features that remain are the centralized company directory with category browsing and the mock interview module featuring multiple-choice and fixed essay-type questions, while the external AI-powered feedback integration is cut to reduce API costs.

### Team Members
- Lloyd Anton P. Montero
- Alicia Kate T. Bactasa
- Patrick Charles Borres
- Sybel Yadeen Aquilla
