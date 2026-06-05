---
name: obsidian-note
description: >
  This skill is used when the user asks to write, create, or edit knowledge-bank notes.
  It enforces Obsidian-compatible conventions: Chinese writing, doc/<category>/ folder
  organization, [[wikilink]] cross-references, YAML frontmatter, and the dense pedagogical
  style defined in CLAUDE.md.
---

# Obsidian Note Writing Skill

This skill encodes all conventions for writing notes in this knowledge bank.
When invoked, follow every rule below — the goal is a consistent, interlinked,
Obsidian-native knowledge graph.

## 1. Directory Organization

- All notes live under `doc/` with **category-based subdirectories**.
- Never place a note directly in `doc/` — always pick or create a subdirectory
  that groups the topic (e.g. `doc/ai/`, `doc/network/`, `doc/frp/`).
- Example structure:
  ```
  doc/
    ai/
      大模型概述.md          ← Map of Content (MOC)
      什么是大模型.md
      大模型技术原理.md
    network/
      frp-nginx-networking-guide.md
  ```

## 2. File Naming

- Use **Chinese** filenames for topic notes (MOC and concept notes).
- Use descriptive names that match the `<h1>` title of the note.
- No spaces — Obsidian handles Chinese names without issue.

## 3. YAML Frontmatter

Every note MUST start with YAML frontmatter:

```yaml
---
tags:
  - <category>
  - <subtag>
created: YYYY-MM-DD
aliases:
  - <English alias>
  - <alternate Chinese name>
---
```

- `tags`: at least one category tag matching the subdirectory (e.g. `ai`, `network`).
- `created`: ISO date.
- `aliases`: English equivalent and/or common abbreviations so Obsidian's
  quick-switcher can find the note by either name.

## 4. Cross-Referencing with Wikilinks

- Use `[[note-name]]` Obsidian wikilinks to reference other notes.
- The link target is the **filename without extension** (e.g. `[[大模型技术原理]]`).
- In a MOC note, link every sub-note it covers.
- In sub-notes, link back to the MOC and to any peer notes that are directly
  relevant.
- Use `[[note-name#section-header]]` for deep links to specific sections.
- Use `[[note-name|display text]]` aliased links when the grammatical context
  needs different text.

## 5. Writing Style (from CLAUDE.md)

- Written in **Chinese (Simplified)**.
- **Bottom-up pedagogy**: start from fundamental concepts before layering on
  specifics. Assume the reader is smart but new to the domain.
- **Dense and thorough**: prefer diagrams, tables, and step-by-step tracing
  over brief summaries.
- Include **real configuration snippets** where applicable.
- **Cross-reference** related concepts with section pointers.
- Use **ASCII art diagrams** for architecture overviews and protocol flows.
- End with a **"关键概念速查表"** summary table for quick lookup.
- Cite **RFCs and authoritative sources** where relevant.

## 6. Note Structure Template

```markdown
---
tags: [category, subtag]
created: YYYY-MM-DD
aliases: [English Name, Abbreviation]
---

# Title

## 概述
(Brief 2-3 sentence summary of what this note covers)

## 前置知识
- [[prerequisite-note-1]]
- [[prerequisite-note-2]]

## Section 1 — Foundation
(Content...)

## Section 2 — Details
(Content...)

...

## 关键概念速查表

| 概念 | 英文 | 一句话解释 |
|------|------|-----------|
| ... | ... | ... |

## 延伸阅读
- [[related-note-1]]
- [[related-note-2]]
```

## 7. Linking Strategy (Graph Health)

- Every note should have **at least one incoming link** (no orphans).
- Every note should have **at least one outgoing link** (no dead ends).
- MOC notes act as hubs: they link out to many sub-notes, and each sub-note
  links back to the MOC.
- When you create N related notes, also create or update a MOC note that ties
  them together.
- Use `[[双向链接|双向链接]]` generously — they are the point of using Obsidian.

## 8. When the User Mentions Obsidian Features

- The user's vault has the following plugins enabled (from `.obsidian/`):
  core plugins are configured. Do not assume community plugins are available
  unless the user confirms.
- Use standard Obsidian markdown features: wikilinks, embeds (`![[note]]`),
  callouts (`> [!note]`, `> [!warning]`, `> [!info]`), and footnotes.
