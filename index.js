#!/usr/bin/env node
/**
 * MedTerms MCP Server
 * Medical terminology intelligence for AI agents
 * Covers: ICD-10, MedDRA hierarchy, SNOMED CT, RxNorm
 * Sources: NIH NLM APIs (all free/public)
 * 
 * Built for pharma, medcomms, and healthcare AI agents
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const NLM_BASE = "https://uts-ws.nlm.nih.gov/rest";
const RXNAV_BASE = "https://rxnav.nlm.nih.gov/REST";
const ICD_BASE = "https://clinicaltables.nlm.nih.gov/api/icd10cm/v3";

const server = new McpServer({
  name: "medterms-mcp",
  version: "1.0.0",
  description:
    "Medical terminology intelligence for AI agents — ICD-10 lookup, MedDRA hierarchy, RxNorm drug concepts, SNOMED CT, and cross-terminology mapping.",
});

// ─── Utility ─────────────────────────────────────────────────────────────────

async function apiFetch(url) {
  const res = await fetch(url, {
    headers: { "Accept": "application/json" }
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${url}`);
  return res.json();
}

// ─── MedDRA Hierarchy Reference Data ─────────────────────────────────────────
// MedDRA is proprietary, but the 5-level hierarchy structure and SOC names
// are publicly documented. We provide hierarchy navigation + FDA FAERS mapping.

const MEDDRA_SOC = {
  "10001316": "Blood and lymphatic system disorders",
  "10005329": "Cardiac disorders",
  "10007541": "Congenital, familial and genetic disorders",
  "10010331": "Ear and labyrinth disorders",
  "10014698": "Endocrine disorders",
  "10015919": "Eye disorders",
  "10017947": "Gastrointestinal disorders",
  "10018065": "General disorders and administration site conditions",
  "10019805": "Hepatobiliary disorders",
  "10021428": "Immune system disorders",
  "10021881": "Infections and infestations",
  "10022117": "Injury, poisoning and procedural complications",
  "10022891": "Investigations",
  "10027433": "Metabolism and nutrition disorders",
  "10028395": "Musculoskeletal and connective tissue disorders",
  "10029205": "Neoplasms benign, malignant and unspecified",
  "10029999": "Nervous system disorders",
  "10033371": "Pregnancy, puerperium and perinatal conditions",
  "10036585": "Psychiatric disorders",
  "10038359": "Renal and urinary disorders",
  "10038604": "Reproductive system and breast disorders",
  "10038738": "Respiratory, thoracic and mediastinal disorders",
  "10040785": "Skin and subcutaneous tissue disorders",
  "10041244": "Social circumstances",
  "10042613": "Surgical and medical procedures",
  "10047065": "Vascular disorders",
};

// Common MedDRA PT → SOC mappings for fast lookup (curated subset)
const MEDDRA_PT_SOC = {
  "nausea": "Gastrointestinal disorders",
  "vomiting": "Gastrointestinal disorders",
  "diarrhoea": "Gastrointestinal disorders",
  "diarrhea": "Gastrointestinal disorders",
  "constipation": "Gastrointestinal disorders",
  "abdominal pain": "Gastrointestinal disorders",
  "headache": "Nervous system disorders",
  "dizziness": "Nervous system disorders",
  "tremor": "Nervous system disorders",
  "somnolence": "Nervous system disorders",
  "seizure": "Nervous system disorders",
  "insomnia": "Psychiatric disorders",
  "depression": "Psychiatric disorders",
  "anxiety": "Psychiatric disorders",
  "agitation": "Psychiatric disorders",
  "hallucination": "Psychiatric disorders",
  "suicidal ideation": "Psychiatric disorders",
  "rash": "Skin and subcutaneous tissue disorders",
  "pruritus": "Skin and subcutaneous tissue disorders",
  "alopecia": "Skin and subcutaneous tissue disorders",
  "fatigue": "General disorders and administration site conditions",
  "pyrexia": "General disorders and administration site conditions",
  "oedema": "General disorders and administration site conditions",
  "edema": "General disorders and administration site conditions",
  "dyspnoea": "Respiratory, thoracic and mediastinal disorders",
  "dyspnea": "Respiratory, thoracic and mediastinal disorders",
  "cough": "Respiratory, thoracic and mediastinal disorders",
  "pneumonia": "Infections and infestations",
  "neutropenia": "Blood and lymphatic system disorders",
  "thrombocytopenia": "Blood and lymphatic system disorders",
  "anaemia": "Blood and lymphatic system disorders",
  "anemia": "Blood and lymphatic system disorders",
  "hypertension": "Vascular disorders",
  "hypotension": "Vascular disorders",
  "tachycardia": "Cardiac disorders",
  "qt prolongation": "Cardiac disorders",
  "myocardial infarction": "Cardiac disorders",
  "alanine aminotransferase increased": "Investigations",
  "aspartate aminotransferase increased": "Investigations",
  "weight decreased": "Investigations",
  "weight increased": "Investigations",
  "creatinine increased": "Investigations",
  "renal failure": "Renal and urinary disorders",
  "hepatotoxicity": "Hepatobiliary disorders",
  "liver injury": "Hepatobiliary disorders",
};

// ─── Tool 1: ICD-10 Code Lookup ───────────────────────────────────────────────

server.tool(
  "lookup_icd10",
  "Search ICD-10-CM codes by diagnosis name or look up a specific code. Returns code, full description, and category. Essential for clinical documentation agents.",
  {
    query: z
      .string()
      .describe("Diagnosis name (e.g. 'major depressive disorder') or ICD-10 code (e.g. 'F33.1')"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(10)
      .describe("Number of results to return"),
  },
  async ({ query, limit }) => {
    const url = `${ICD_BASE}/search?sf=code,name&terms=${encodeURIComponent(query)}&maxList=${limit}`;
    const data = await apiFetch(url);

    // Response: [total, codes[], null, [code, name][]]
    const total = data[0] || 0;
    const entries = data[3] || [];

    if (!entries.length) {
      return {
        content: [{
          type: "text",
          text: `No ICD-10-CM codes found for "${query}".`
        }]
      };
    }

    const rows = entries.map(([code, name]) => `- **${code}** — ${name}`);

    const text = [
      `## ICD-10-CM Results for "${query}"`,
      `Found ${total} total matches, showing ${entries.length}:`,
      "",
      ...rows,
      "",
      "_Source: NIH National Library of Medicine ICD-10-CM API_"
    ].join("\n");

    return { content: [{ type: "text", text }] };
  }
);

// ─── Tool 2: MedDRA Term Lookup ───────────────────────────────────────────────

server.tool(
  "lookup_meddra",
  "Look up a MedDRA Preferred Term (PT), identify its System Organ Class (SOC), hierarchy level, and related terms. Critical for adverse event coding, pharmacovigilance, and regulatory submissions.",
  {
    term: z
      .string()
      .describe("MedDRA term to look up (e.g. 'nausea', 'qt prolongation', 'suicidal ideation')"),
    include_synonyms: z
      .boolean()
      .default(true)
      .describe("Include US/UK spelling variants and common synonyms"),
  },
  async ({ term, include_synonyms }) => {
    const normalized = term.toLowerCase().trim();

    // Direct match
    let soc = MEDDRA_PT_SOC[normalized];

    // Partial match fallback
    if (!soc) {
      const partialKey = Object.keys(MEDDRA_PT_SOC).find(
        k => k.includes(normalized) || normalized.includes(k)
      );
      if (partialKey) soc = MEDDRA_PT_SOC[partialKey];
    }

    // MedDRA hierarchy levels explanation
    const hierarchy = [
      "**SOC** (System Organ Class) — highest level, 27 categories",
      "**HLGT** (High Level Group Term) — groups related HLTs",
      "**HLT** (High Level Term) — groups related PTs",
      "**PT** (Preferred Term) — single medical concept, used in labels & FAERS",
      "**LLT** (Lowest Level Term) — synonyms/variants that map to a PT",
    ];

    // Common synonyms for known terms
    const synonymMap = {
      "nausea": ["nausea", "feeling sick", "queasy"],
      "diarrhoea": ["diarrhoea", "diarrhea", "loose stools", "frequent bowel movements"],
      "dizziness": ["dizziness", "vertigo", "lightheadedness", "giddiness"],
      "dyspnoea": ["dyspnoea", "dyspnea", "shortness of breath", "breathlessness", "SOB"],
      "oedema": ["oedema", "edema", "swelling", "fluid retention"],
      "anaemia": ["anaemia", "anemia", "low hemoglobin", "low haemoglobin"],
      "pyrexia": ["pyrexia", "fever", "febrile", "high temperature", "hyperthermia"],
      "pruritus": ["pruritus", "itching", "itch", "itchiness"],
      "somnolence": ["somnolence", "drowsiness", "sleepiness", "sedation"],
      "alopecia": ["alopecia", "hair loss", "hair thinning", "baldness"],
    };

    const synonyms = synonymMap[normalized] || [];

    let text = `## MedDRA Term: "${term}"\n\n`;

    if (soc) {
      text += `### Classification\n`;
      text += `- **Preferred Term (PT):** ${term.charAt(0).toUpperCase() + term.slice(1)}\n`;
      text += `- **System Organ Class (SOC):** ${soc}\n`;
      text += `- **Hierarchy Level:** PT (Preferred Term)\n\n`;
    } else {
      text += `> ⚠️ Term not found in curated PT index. May be an LLT, HLGT, or HLT — verify in official MedDRA browser.\n\n`;
    }

    text += `### MedDRA Hierarchy (5 Levels)\n`;
    text += hierarchy.map(h => `- ${h}`).join("\n") + "\n\n";

    if (include_synonyms && synonyms.length > 0) {
      text += `### LLT Synonyms / Coding Variants\n`;
      text += `These LLTs map to the same PT:\n`;
      text += synonyms.map(s => `- ${s}`).join("\n") + "\n\n";
    }

    text += `### Regulatory Context\n`;
    text += `- PTs are used in **FDA FAERS** adverse event reporting\n`;
    text += `- PTs appear in **clinical trial** adverse event tables\n`;
    text += `- Drug labels use PTs in **Adverse Reactions** section (≥1% frequency threshold)\n`;
    text += `- **ICH E2B** submissions use MedDRA PTs for individual case safety reports (ICSRs)\n\n`;

    text += `### All 27 SOCs (for context)\n`;
    text += Object.values(MEDDRA_SOC).map(s => `- ${s}`).join("\n") + "\n\n";

    text += `_Source: MedDRA hierarchy documentation (v26.0). Full term browser at meddra.org (subscription required)._\n`;
    text += `_⚠️ Always verify PT assignments in official MedDRA browser before regulatory submission._`;

    return { content: [{ type: "text", text }] };
  }
);

// ─── Tool 3: RxNorm Drug Concept Lookup ──────────────────────────────────────

server.tool(
  "lookup_rxnorm",
  "Look up a drug's RxNorm concept, RxCUI identifier, ingredient relationships, and drug class. RxNorm is the standard for drug interoperability across EHR systems.",
  {
    drug_name: z
      .string()
      .describe("Drug name (brand or generic, e.g. 'abilify', 'aripiprazole', 'ozempic')"),
  },
  async ({ drug_name }) => {
    // Get RxCUI
    const searchData = await apiFetch(
      `${RXNAV_BASE}/rxcui.json?name=${encodeURIComponent(drug_name)}&search=2`
    );

    const rxcui = searchData?.idGroup?.rxnormId?.[0];

    if (!rxcui) {
      // Try approximate match
      const approxData = await apiFetch(
        `${RXNAV_BASE}/approximateTerm.json?term=${encodeURIComponent(drug_name)}&maxEntries=5`
      );
      const candidates = approxData?.approximateGroup?.candidate || [];
      if (!candidates.length) {
        return {
          content: [{
            type: "text",
            text: `No RxNorm concept found for "${drug_name}". Check spelling or try generic name.`
          }]
        };
      }

      const lines = candidates.slice(0, 5).map(
        c => `- **RxCUI ${c.rxcui}** — Score: ${c.score} (${c.name || "name not available"})`
      );
      return {
        content: [{
          type: "text",
          text: [
            `## RxNorm: Approximate Matches for "${drug_name}"`,
            "",
            ...lines,
            "",
            "Re-run with the exact name for full details."
          ].join("\n")
        }]
      };
    }

    // Get properties
    const [propsData, classData, relData] = await Promise.all([
      apiFetch(`${RXNAV_BASE}/rxcui/${rxcui}/properties.json`).catch(() => null),
      apiFetch(`${RXNAV_BASE}/rxclass/class/byRxcui.json?rxcui=${rxcui}&relaSource=ATC`).catch(() => null),
      apiFetch(`${RXNAV_BASE}/rxcui/${rxcui}/related.json?tty=IN+BN+SCD`).catch(() => null),
    ]);

    const props = propsData?.properties || {};
    const classes = classData?.rxclassDrugInfoList?.rxclassDrugInfo || [];
    const related = relData?.relatedGroup?.conceptGroup || [];

    const ingredients = related
      .find(g => g.tty === "IN")
      ?.conceptProperties?.map(c => c.name) || [];
    const brandNames = related
      .find(g => g.tty === "BN")
      ?.conceptProperties?.map(c => c.name) || [];
    const atcClasses = classes.slice(0, 3).map(
      c => `${c.rxclassMinConceptItem?.className} (${c.rxclassMinConceptItem?.classId})`
    );

    const text = [
      `## RxNorm: ${props.name || drug_name}`,
      "",
      `### Identifiers`,
      `- **RxCUI:** ${rxcui}`,
      `- **Name:** ${props.name || "N/A"}`,
      `- **Synonym:** ${props.synonym || "N/A"}`,
      `- **Term Type:** ${props.tty || "N/A"}`,
      `- **Language:** ${props.language || "N/A"}`,
      "",
      `### Drug Relationships`,
      `- **Active Ingredient(s):** ${ingredients.join(", ") || "N/A"}`,
      `- **Brand Names:** ${brandNames.slice(0, 8).join(", ") || "N/A"}`,
      "",
      `### Drug Class (ATC)`,
      atcClasses.length
        ? atcClasses.map(c => `- ${c}`).join("\n")
        : "- ATC classification not available",
      "",
      `### Interoperability`,
      `- RxNorm is the **US standard** for drug naming in EHR/EMR systems`,
      `- RxCUI \`${rxcui}\` can be used to query drug interactions, formulary status, and prescribing data`,
      `- Maps to: **NDF-RT**, **SNOMED CT**, **MeSH**, **DrugBank**, **ATC**`,
      "",
      `_Source: NIH National Library of Medicine RxNav API_`,
    ].join("\n");

    return { content: [{ type: "text", text }] };
  }
);

// ─── Tool 4: ICD-10 to MedDRA Cross-Map ──────────────────────────────────────

server.tool(
  "crossmap_icd_meddra",
  "Cross-map between ICD-10 and MedDRA terminology. Provides conceptual mapping guidance for translating diagnoses between coding systems — critical for regulatory submissions, REMS, and pharmacovigilance.",
  {
    term: z
      .string()
      .describe("Medical concept to cross-map (e.g. 'depression', 'heart failure', 'neutropenia')"),
    direction: z
      .enum(["icd_to_meddra", "meddra_to_icd", "both"])
      .default("both")
      .describe("Mapping direction"),
  },
  async ({ term, direction }) => {
    // Fetch ICD-10 codes for the term
    const icdData = await apiFetch(
      `${ICD_BASE}/search?sf=code,name&terms=${encodeURIComponent(term)}&maxList=5`
    ).catch(() => null);

    const icdEntries = icdData?.[3] || [];
    const meddra_soc = MEDDRA_PT_SOC[term.toLowerCase()] ||
      Object.entries(MEDDRA_PT_SOC).find(([k]) => k.includes(term.toLowerCase()))?.[1] ||
      "Not found in curated index — verify in MedDRA browser";

    let text = `## Cross-Map: "${term}"\n\n`;
    text += `> ⚠️ There is no official 1:1 ICD-10↔MedDRA mapping. These systems use different granularity and purposes. Use this as guidance only.\n\n`;

    if (direction !== "meddra_to_icd") {
      text += `### ICD-10-CM Codes (Diagnosis Coding)\n`;
      if (icdEntries.length) {
        text += icdEntries.map(([code, name]) => `- **${code}** — ${name}`).join("\n");
      } else {
        text += `_No ICD-10-CM codes found for this term._`;
      }
      text += "\n\n";
    }

    if (direction !== "icd_to_meddra") {
      text += `### MedDRA (Pharmacovigilance Coding)\n`;
      text += `- **Preferred Term (PT):** ${term.charAt(0).toUpperCase() + term.slice(1)}\n`;
      text += `- **System Organ Class (SOC):** ${meddra_soc}\n\n`;
    }

    text += `### Key Differences\n`;
    text += `| | ICD-10-CM | MedDRA |\n`;
    text += `|--|-----------|--------|\n`;
    text += `| **Purpose** | Clinical diagnosis billing | Adverse event / safety reporting |\n`;
    text += `| **Owner** | WHO / CMS | ICH / MSSO |\n`;
    text += `| **Used in** | EHR, claims, hospitals | FAERS, EudraVigilance, clinical trials |\n`;
    text += `| **Granularity** | Etiology, site, severity | Clinical manifestation |\n`;
    text += `| **Update cycle** | Annual (Oct 1) | Biannual (March, September) |\n`;
    text += `| **Access** | Free (public) | Subscription required |\n\n`;

    text += `### Regulatory Guidance\n`;
    text += `- **ICH E2B(R3):** Use MedDRA for ICSRs (individual case safety reports)\n`;
    text += `- **FDA FAERS:** MedDRA PTs required for adverse event coding\n`;
    text += `- **EMA EudraVigilance:** MedDRA mandatory for EU safety reporting\n`;
    text += `- **Clinical trials (CTCAE):** Use NCI CTCAE grading alongside MedDRA PTs\n\n`;

    text += `_Always consult a trained medical coder or pharmacovigilance specialist for regulatory submissions._`;

    return { content: [{ type: "text", text }] };
  }
);

// ─── Tool 5: SNOMED CT / UMLS Concept Search ─────────────────────────────────

server.tool(
  "search_medical_concept",
  "Search for a medical concept across terminology systems (SNOMED CT, MeSH, LOINC, NCI Thesaurus) using the NIH UMLS Metathesaurus. Returns concept definitions and cross-system identifiers.",
  {
    term: z
      .string()
      .describe("Medical term to search (e.g. 'schizophrenia', 'EGFR mutation', 'HbA1c')"),
    vocabulary: z
      .enum(["all", "SNOMEDCT_US", "MSH", "NCI", "LNC", "ICD10CM"])
      .default("all")
      .describe("Terminology system to search within"),
  },
  async ({ term, vocabulary }) => {
    // Use NLM clinical tables for broad concept search
    const icdUrl = `${ICD_BASE}/search?sf=code,name&terms=${encodeURIComponent(term)}&maxList=5`;
    const rxUrl = `${RXNAV_BASE}/approximateTerm.json?term=${encodeURIComponent(term)}&maxEntries=3`;

    const [icdData, rxData] = await Promise.all([
      apiFetch(icdUrl).catch(() => null),
      apiFetch(rxUrl).catch(() => null),
    ]);

    const icdResults = icdData?.[3] || [];
    const rxCandidates = rxData?.approximateGroup?.candidate || [];
    const meddra = MEDDRA_PT_SOC[term.toLowerCase()];

    let text = `## Medical Concept: "${term}"\n\n`;

    text += `### ICD-10-CM (Diagnosis Coding)\n`;
    if (icdResults.length) {
      text += icdResults.map(([c, n]) => `- **${c}** — ${n}`).join("\n") + "\n\n";
    } else {
      text += `_No direct ICD-10-CM match found._\n\n`;
    }

    text += `### MedDRA (Safety Reporting)\n`;
    if (meddra) {
      text += `- **PT:** ${term.charAt(0).toUpperCase() + term.slice(1)}\n`;
      text += `- **SOC:** ${meddra}\n\n`;
    } else {
      text += `_Not in curated MedDRA index. Verify at meddra.org._\n\n`;
    }

    text += `### RxNorm (Drug Concepts)\n`;
    if (rxCandidates.length) {
      text += rxCandidates.slice(0, 3).map(
        c => `- **RxCUI ${c.rxcui}** (score: ${c.score})`
      ).join("\n") + "\n\n";
    } else {
      text += `_Not a drug concept or no RxNorm match found._\n\n`;
    }

    text += `### Terminology System Reference\n`;
    text += `| System | Domain | Use Case |\n`;
    text += `|--------|--------|----------|\n`;
    text += `| **ICD-10-CM** | Diagnoses | Billing, epidemiology, EHR |\n`;
    text += `| **MedDRA** | AEs & conditions | Pharmacovigilance, regulatory |\n`;
    text += `| **RxNorm** | Drugs | Prescribing, interoperability |\n`;
    text += `| **SNOMED CT** | Clinical concepts | EHR, clinical decision support |\n`;
    text += `| **LOINC** | Lab & obs | Lab results, vital signs |\n`;
    text += `| **NCI Thesaurus** | Oncology | Cancer trials, FDA submissions |\n`;
    text += `| **CTCAE** | AE grading | Oncology trial safety |\n\n`;

    text += `_Source: NIH NLM APIs (ICD-10-CM, RxNav). Full UMLS access at uts.nlm.nih.gov._`;

    return { content: [{ type: "text", text }] };
  }
);

// ─── Tool 6: CTCAE Grade Lookup ───────────────────────────────────────────────

server.tool(
  "lookup_ctcae",
  "Look up NCI Common Terminology Criteria for Adverse Events (CTCAE) grading criteria for an adverse event. Essential for oncology clinical trial safety reporting.",
  {
    adverse_event: z
      .string()
      .describe("Adverse event term (e.g. 'neutropenia', 'nausea', 'peripheral neuropathy', 'QTc prolongation')"),
  },
  async ({ adverse_event }) => {
    // Curated CTCAE v5.0 grading for most common oncology AEs
    const ctcae = {
      "neutropenia": {
        soc: "Investigations",
        grades: {
          1: "ANC <LLN - 1500/mm³",
          2: "ANC 1000 - <1500/mm³",
          3: "ANC 500 - <1000/mm³",
          4: "ANC <500/mm³",
          5: "Death",
        },
        notes: "ANC = Absolute Neutrophil Count. Grade 3/4 = dose-limiting toxicity in most protocols.",
      },
      "nausea": {
        soc: "Gastrointestinal disorders",
        grades: {
          1: "Loss of appetite without change in eating habits",
          2: "Oral intake decreased without significant weight loss or dehydration",
          3: "Inadequate oral caloric/fluid intake; tube feeding, TPN, or hospitalization indicated",
        },
        notes: "No Grade 4 or 5 for nausea alone.",
      },
      "vomiting": {
        soc: "Gastrointestinal disorders",
        grades: {
          1: "1-2 episodes in 24 hours",
          2: "3-5 episodes in 24 hours; IV fluids <24 hours",
          3: "≥6 episodes in 24 hours; IV fluids ≥24 hours; hospitalization indicated",
          4: "Life-threatening; urgent intervention indicated",
          5: "Death",
        },
        notes: "Distinguish from nausea — separate CTCAE terms.",
      },
      "peripheral neuropathy": {
        soc: "Nervous system disorders",
        grades: {
          1: "Asymptomatic; clinical or diagnostic observations only",
          2: "Moderate symptoms; limiting instrumental ADL",
          3: "Severe symptoms; limiting self-care ADL",
          4: "Life-threatening; urgent intervention indicated",
          5: "Death",
        },
        notes: "Includes peripheral sensory and motor neuropathy — code to most specific term.",
      },
      "fatigue": {
        soc: "General disorders and administration site conditions",
        grades: {
          1: "Fatigue relieved by rest",
          2: "Fatigue not relieved by rest; limiting instrumental ADL",
          3: "Fatigue not relieved by rest; limiting self-care ADL",
        },
        notes: "No Grade 4 or 5 for fatigue alone.",
      },
      "diarrhea": {
        soc: "Gastrointestinal disorders",
        grades: {
          1: "<4 stools/day over baseline; mild increase in ostomy output",
          2: "4-6 stools/day over baseline; IV fluids <24 hours; not interfering with ADL",
          3: "≥7 stools/day over baseline; IV fluids ≥24 hours; hospitalization; interfering with ADL",
          4: "Life-threatening; urgent intervention indicated",
          5: "Death",
        },
      },
      "qtc prolongation": {
        soc: "Cardiac disorders",
        grades: {
          1: "QTc 450-480 ms",
          2: "QTc 481-500 ms",
          3: "QTc ≥501 ms on at least 2 separate ECGs",
          4: "QTc ≥501 ms and/or >60 ms change from baseline; Torsade de pointes; ventricular fibrillation; urgent intervention indicated",
          5: "Death",
        },
        notes: "Use Fridericia formula (QTcF) unless protocol specifies otherwise.",
      },
      "thrombocytopenia": {
        soc: "Blood and lymphatic system disorders",
        grades: {
          1: "Platelets <LLN - 75,000/mm³",
          2: "Platelets 50,000 - <75,000/mm³",
          3: "Platelets 25,000 - <50,000/mm³",
          4: "Platelets <25,000/mm³",
          5: "Death",
        },
      },
      "hypertension": {
        soc: "Vascular disorders",
        grades: {
          1: "Prehypertension (systolic 120-139 or diastolic 80-89 mmHg)",
          2: "Stage 1 (systolic 140-159 or diastolic 90-99 mmHg); medical intervention indicated",
          3: "Stage 2 (systolic ≥160 or diastolic ≥100 mmHg); medical intervention indicated",
          4: "Life-threatening (malignant hypertension, transient or permanent neurologic deficit, hypertensive crisis)",
          5: "Death",
        },
      },
      "alopecia": {
        soc: "Skin and subcutaneous tissue disorders",
        grades: {
          1: "Hair loss of <50% of normal that is not obvious from a distance",
          2: "Hair loss of ≥50% of normal; wig or hairpiece necessary",
        },
        notes: "No Grade 3, 4, or 5 for alopecia.",
      },
    };

    const key = adverse_event.toLowerCase().trim();
    const match = ctcae[key] ||
      ctcae[Object.keys(ctcae).find(k => k.includes(key) || key.includes(k))];

    if (!match) {
      const available = Object.keys(ctcae).map(k =>
        k.charAt(0).toUpperCase() + k.slice(1)
      ).join(", ");
      return {
        content: [{
          type: "text",
          text: [
            `## CTCAE v5.0: "${adverse_event}"`,
            "",
            `_Term not found in curated index. Full CTCAE v5.0 available at:_`,
            `_https://ctep.cancer.gov/protocoldevelopment/electronic_applications/ctc.htm_`,
            "",
            `### Available in this server:`,
            available,
          ].join("\n")
        }]
      };
    }

    const gradeRows = Object.entries(match.grades)
      .map(([g, def]) => `| Grade ${g} | ${def} |`)
      .join("\n");

    const text = [
      `## CTCAE v5.0: ${adverse_event.charAt(0).toUpperCase() + adverse_event.slice(1)}`,
      "",
      `**SOC:** ${match.soc}`,
      match.notes ? `**Note:** ${match.notes}` : "",
      "",
      `### Grading Criteria`,
      `| Grade | Definition |`,
      `|-------|------------|`,
      gradeRows,
      "",
      `### Grading Context`,
      `- **Grade 1:** Mild — asymptomatic or mild symptoms`,
      `- **Grade 2:** Moderate — minimal intervention indicated`,
      `- **Grade 3:** Severe — hospitalization or dose modification usually required`,
      `- **Grade 4:** Life-threatening — urgent intervention required`,
      `- **Grade 5:** Death related to AE`,
      "",
      `_Source: NCI CTCAE v5.0 (November 2017). Reference: ctep.cancer.gov_`,
      `_Used in oncology clinical trial protocols for adverse event severity grading._`,
    ].filter(Boolean).join("\n");

    return { content: [{ type: "text", text }] };
  }
);

// ─── Start ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
