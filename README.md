# MedTerms MCP Server

**Medical terminology intelligence for AI agents.**

Built on free public NIH APIs. Covers ICD-10-CM, MedDRA, RxNorm, CTCAE v5.0, and cross-terminology mapping — the coding systems used in every regulatory submission, clinical trial, and pharmacovigilance report.

---

## Tools

| Tool | What it does |
|------|-------------|
| `lookup_icd10` | Search ICD-10-CM codes by diagnosis name or code |
| `lookup_meddra` | MedDRA PT lookup with SOC, hierarchy, and synonyms |
| `lookup_rxnorm` | RxNorm drug concept, RxCUI, ATC class, brand/generic mapping |
| `crossmap_icd_meddra` | Cross-map between ICD-10 and MedDRA with regulatory context |
| `search_medical_concept` | Broad concept search across ICD-10, MedDRA, RxNorm |
| `lookup_ctcae` | CTCAE v5.0 grading criteria for oncology adverse events |

---

## Who uses this

- **Medical information agents** — classify AEs against MedDRA for FAERS submissions
- **Clinical trial agents** — grade adverse events per CTCAE
- **Drug safety agents** — map diagnoses between ICD-10 and MedDRA
- **Medical writing agents** — look up correct PT for adverse reactions section
- **Regulatory submission agents** — validate terminology before ICH E2B submission
- **EHR/EMR integration agents** — translate between coding systems

---

## Installation

```bash
npm install medterms-mcp
```

Or run directly:

```bash
npx medterms-mcp
```

---

## Claude Desktop / MCP Config

```json
{
  "mcpServers": {
    "medterms": {
      "command": "npx",
      "args": ["medterms-mcp"]
    }
  }
}
```

---

## Data Sources

All free, public APIs — no API key required:

- **ICD-10-CM:** NIH NLM Clinical Tables API
- **RxNorm:** NIH NLM RxNav API  
- **MedDRA SOC/hierarchy:** MedDRA v26.0 public documentation
- **CTCAE v5.0:** NCI Cancer Therapy Evaluation Program

> ⚠️ MedDRA full term browser requires subscription at meddra.org. This server provides hierarchy navigation and curated PT reference data based on public documentation.

---

## Pricing (via MCPize)

| Tier | Calls/month | Price |
|------|------------|-------|
| Free | 100 | $0 |
| Pro | 10,000 | $29/mo |
| Enterprise | Unlimited + SLA | $149/mo |

---

*Built by a CMPP-certified PhD in Neuroscience with 10+ years in pharma medical communications.*
