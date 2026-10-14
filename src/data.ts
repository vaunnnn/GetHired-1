export interface Company {
  id: number;
  name: string;
  industry: string;
  type: string;
  specializations: string[];
  location: string;
  slots: number;
  description: string;
  image: string;
  saved: boolean;
  website: string;
  email: string;
  phone: string;
  hours: string;
  deactivated?: boolean;
}

export const companies: Company[] = [
  {
    id: 1,
    name: "Full Scale",
    industry: "Software Development",
    type: "Software Services",
    specializations: ["Software Dev", "Full-Stack", "React / Node.js"],
    location: "Cebu IT Park, Cebu City",
    slots: 8,
    description:
      "A fast-growing software development company based in Cebu IT Park helping startups and established companies scale development teams with top-tier Filipino engineering talent.",
    image:
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=260&fit=crop&auto=format",
    saved: true,
    website: "fullscale.io",
    email: "careers@fullscale.io",
    phone: "+63 32 412 8888",
    hours: "Mon – Fri, 9:00 AM – 6:00 PM",
  },
  {
    id: 2,
    name: "Hatchit Solutions",
    industry: "Web & Mobile Development",
    type: "Digital Agency / Software",
    specializations: ["Mobile & Web", "UI/UX Design", "Frontend Dev"],
    location: "Cebu City",
    slots: 5,
    description:
      "Innovative software solutions agency creating robust web and mobile applications, sleek user experiences, and scalable cloud platforms for global and regional enterprises.",
    image:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=260&fit=crop&auto=format",
    saved: true,
    website: "hatchitsolutions.com",
    email: "internships@hatchitsolutions.com",
    phone: "+63 32 238 9000",
    hours: "Mon – Fri, 8:30 AM – 5:30 PM",
  },
  {
    id: 3,
    name: "Skanlog",
    industry: "Enterprise Logistics Tech",
    type: "Logistics / Software",
    specializations: ["Enterprise Dev", "Cloud / DevOps", "Supply Chain Systems"],
    location: "Mandaue City, Cebu",
    slots: 4,
    description:
      "Leading Scandinavian logistics and technology solutions company operating in Cebu, specializing in modern supply chain optimization, automated warehousing platforms, and enterprise cloud infrastructure.",
    image:
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=260&fit=crop&auto=format",
    saved: true,
    website: "skanlog.com",
    email: "ph.interns@skanlog.com",
    phone: "+63 32 344 7500",
    hours: "Mon – Fri, 8:00 AM – 5:00 PM",
  },
  {
    id: 4,
    name: "IBM Philippines",
    industry: "Technology",
    type: "Tech / Consulting",
    specializations: ["Cloud Computing", "AI & Automation", "IT Consulting"],
    location: "Eastwood City, Quezon City",
    slots: 6,
    description:
      "IBM creates value for clients through innovative technology. DCISM students work on cloud architecture, AI engineering, and enterprise software alongside seasoned professionals.",
    image:
      "https://images.unsplash.com/photo-1556761175-4b46a572b786?w=600&h=260&fit=crop&auto=format",
    saved: false,
    website: "ibm.com/ph",
    email: "phcampus@ibm.com",
    phone: "+63 2 8995 3000",
    hours: "Mon – Fri, 8:30 AM – 5:30 PM",
  },
  {
    id: 5,
    name: "Qualfon Philippines",
    industry: "BPO",
    type: "BPO / IT Support",
    specializations: ["Customer Experience", "IT Helpdesk", "Data Processing"],
    location: "Davao City",
    slots: 12,
    description:
      "A global BPO company providing customer experience and back-office solutions. DCISM students specialize in technical support, IT service management, and process automation.",
    image:
      "https://images.unsplash.com/photo-1541746972996-4e0b0f43e02a?w=600&h=260&fit=crop&auto=format",
    saved: false,
    website: "qualfon.com",
    email: "careers.ph@qualfon.com",
    phone: "+63 82 296 0000",
    hours: "24/7 Operations · HR: Mon – Fri, 8:00 AM – 5:00 PM",
  },
  {
    id: 6,
    name: "Nexus Technologies",
    industry: "Software Development",
    type: "Software / Design",
    specializations: ["Web Development", "Mobile Development", "UI/UX Design"],
    location: "Cebu IT Park, Cebu City",
    slots: 3,
    description:
      "A Cebu-based software firm specializing in custom enterprise solutions, mobile applications, and web platforms for Philippine and international clients across various industries.",
    image:
      "https://images.unsplash.com/photo-1510074377623-8cf13fb86c08?w=600&h=260&fit=crop&auto=format",
    saved: false,
    website: "nexustech.com.ph",
    email: "internship@nexustech.com.ph",
    phone: "+63 32 516 0000",
    hours: "Mon – Fri, 9:00 AM – 6:00 PM",
  },
  {
    id: 7,
    name: "PwC Philippines",
    industry: "IT Consulting",
    type: "Consulting / Analytics",
    specializations: ["Data Analytics", "Business Intelligence", "IT Audit & Risk"],
    location: "Bonifacio Global City, Taguig",
    slots: 4,
    description:
      "PwC offers assurance, advisory, and tax services with a strong technology practice in data analytics, digital transformation, and risk consulting for top Philippine enterprises.",
    image:
      "https://images.unsplash.com/photo-1606857521015-7f9fcf423740?w=600&h=260&fit=crop&auto=format",
    saved: false,
    website: "pwc.com/ph",
    email: "ph_campus_recruitment@pwc.com",
    phone: "+63 2 8459 2000",
    hours: "Mon – Fri, 8:00 AM – 5:30 PM",
  },
  {
    id: 8,
    name: "UnionBank of the Philippines",
    industry: "Banking / FinTech",
    type: "Banking / FinTech",
    specializations: ["FinTech Development", "Blockchain", "Cybersecurity"],
    location: "Ortigas Center, Pasig City",
    slots: 5,
    description:
      "One of the Philippines' most digitally advanced banks, pioneering blockchain, open banking, and AI-driven financial technology. DCISM graduates build core banking platforms.",
    saved: false,
    image:
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=600&h=260&fit=crop&auto=format",
    website: "unionbankph.com",
    email: "campus.recruitment@unionbankph.com",
    phone: "+63 2 8667 6248",
    hours: "Mon – Fri, 8:00 AM – 5:00 PM",
  },
];
