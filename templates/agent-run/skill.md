---
template: agent-run
triggers: agent, agents, automation, automate, enrichment, scrape, research, leads, autopilot, does the work, spreadsheet
---
# Agent Run: a prompt types, the agent works the list, a number lands

Beats (fixed by code): hook → prompt being typed + search status → table filling → stat → end card.

- **hook**: the pain it removes, ≤ 6 words ("Stop doing it by hand."). **hookAccent**: its last 1–3 words.
- **prompt**: a realistic request in their domain, ≤ 60 chars.
- **status**: present tense, ending in "…" ("Reading 40 pages…").
- **columns**: 3 short headers that match the prompt. **rows**: 3–5 rows of clearly generic demo data
  ("Acme", "Northwind"). Never real customers.
- **statValue** / **statLabel**: the result of this demo run ("20/20" / "found before lunch").
- **endHeadline**, **cta**, **ctaUrl**: from the site's closing line and main button.

```json
{"hook": "Stop researching by hand.", "hookAccent": "by hand.", "prompt": "Find 20 Series A fintechs hiring designers",
 "status": "Checking 900 job boards…", "columns": ["Company", "Round", "Role"],
 "rows": [["Acme Pay", "Series A", "Product Designer"], ["Northwind", "Series A", "Brand Designer"]],
 "statValue": "20/20", "statLabel": "found before lunch", "endHeadline": "Give it the list.", "cta": "Try it free", "ctaUrl": "yourproduct.ai"}
```
