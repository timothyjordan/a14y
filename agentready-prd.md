# **Product Requirements Document (PRD)**

## **Project Name: Agentic Docs Validator (Project "ReadMe.ai")**

| Metadata | Details |
| :---- | :---- |
| **Document Version** | 1.1 |
| **Status** | Draft |
| **Date** | November 30, 2025 |
| **Author** | Timothy Jordan |

## **Table of Contents**

1. [Executive Summary](#executive-summary)  
2. [Problem Statement](#problem-statement)  
3. [User Personas](#user-personas)  
4. [Build Targets Overview](#build-targets-overview)  
5. [Core Functional Requirements (Shared Engine)](#core-functional-requirements-shared-engine)  
6. [Target-Specific Requirements](#target-specific-requirements)  
7. [Non-Functional Requirements](#non-functional-requirements)  
8. [Technical Implementation Details](#technical-implementation-details)  
9. [Roadmap](#roadmap)

## Executive Summary

The **Agentic Docs Validator** is a comprehensive tool suite designed to audit technical documentation websites for "Agentic Readiness." As software development shifts toward AI-assisted coding, documentation must be consumable by LLMs via context windows or RAG systems.  
This project will deliver the validator across three distinct interfaces:

1. **Web App:** For ad-hoc scanning and visual reporting.  
2. **CLI Utility:** For local development and scripting.  
3. **GitHub Action:** For continuous integration and quality gating in PRs.

## Problem Statement

Technical documentation is historically designed for human eyeballs (HTML, CSS, sticky headers). These features create noise for AI agents.

* **The Pain:** Agents hallucinate or fail when they cannot ingest clean context.  
* **The Gap:** No standard tool exists to verify if a documentation site exposes the raw, semantic data required by modern AI coding tools.

## User Personas

1. **The Library Maintainer:** Wants to ensure their docs are "AI-ready" before every release.  
2. **The DevOps Engineer:** Wants to block PRs that break llms.txt or introduce 404s.  
3. **The AI Engineer:** Uses the CLI to bulk-validate sources before adding them to a training set.

## Build Targets Overview

To maximize adoption, the core analysis engine will be packaged into three targets:

| Target | Primary Use Case | Key Feature |
| :---- | :---- | :---- |
| **Target 1: Web App** | Ad-hoc audit by humans. | Visual dashboard, "Quick Fix" code generation. |
| **Target 2: CLI** | Local testing & pre-commit hooks. | JSON/Text output, exit codes for piping. |
| **Target 3: GitHub Action** | CI/CD pipelines. | Automated PR comments, build blocking. |

## Core Functional Requirements (Shared Engine)

*These requirements apply to the underlying analysis logic used by ALL three targets.*

### Analysis Pillar A: Discoverability (llms.txt)

* **FR-CORE-001:** Check existence of /llms.txt and /.well-known/llms.txt and MIME type is text/plain.
* **FR-CORE-002:** Validate llms.txt Markdown syntax against [official specs](https://llmstxt.org/).  
* **FR-CORE-003:** Extract all URLs in llms.txt and verify they return 200 OK.
* **FR-CORE-004:** Check robots.txt for AI-specific blocks (GPTBot, ClaudeBot), doesn't conflict with llms.txt.
* **FR-CORE-005:** Each page should have a <link rel="canonical">.
* **FR-CORE-006:** Redirect chains: Non should exceed 1 hop.
* **FR-CORE-007:** Glossery available for key terms, linked where appropriate throughout documentation.

### Analysis Pillar B: Format Availability (Markdown)

* **FR-CORE-101:** **Suffix Check:** Check if page.html has a corresponding page.md or page.mdx, has a title, description, and tags. Ideally also has llm_summary and last_updated. 
* **FR-CORE-102:** **Content Negotiation:** Check responses to Accept: text/markdown.  
* **FR-CORE-103:** **Noise Ratio:** Calculate signal-to-noise ratio of HTML content if no Markdown is found.

### Analysis Pillar C: Structured Data

* **FR-CORE-201:** Docs with APIs should include machine-readable endpoints (openapi.json, schema.json, or swagger.yaml). Ensure that any found are complete and valid.
* **FR-CORE-202:** Verify code blocks utilize language fencing (e.g., \`\`\`python).
* **FR-CORE-203:** Schema.org metadata is included such as TechArticle or HowTo markup for core guides.
* **FR-CORE-204:** Ensure proper fenced code blocks with language identifiers ( ```bash, ```js).
* **FR-CORE-205:** Long pages have clear section demarcations for embeddings retrieval.
* **FR-CORE-206:** Summaries are included for long articles.

### Analysis Pillar D: HTTP & SEO Metadata
* **FR-CORE-301:** Response headers: Content-Type = text/html; charset=utf-8, Robots-Tag not disallowing AI access, Cache-Control properly set, no unintentional noindex or noai headers.
* **FR-CORE-302:** Meta tags: <meta name="description"> exists, <meta property="og:title"> and <meta property="og:description"> valid, lang attribute set correctly (<html lang="en">).

### The Scoring Engine

* **FR-CORE-501:** Calculate "Agentic Score" (0-100) based on weighted criteria (e.g., \+30 for llms.txt, \+30 for Markdown mirrors).

## Target-Specific Requirements

### Target 1: Web Application

* **FR-WEB-001:** Public-facing input field for URL entry.  
* **FR-WEB-002:** Interactive "Scorecard" UI visualizing the Agentic Score.  
* **FR-WEB-003:** **Remediation Wizard:** Generate copy-paste snippets for users (e.g., a sample llms.txt based on their sitemap).  
* **FR-WEB-004:** Shareable results link (e.g., readme.ai/report?url=...).

### Target 2: Command Line Interface (CLI)

* **FR-CLI-001:** Command structure: agentic-validator check \<url\> \[options\].  
* **FR-CLI-002:** Support flags:  
  * \--depth \<int\>: Crawl depth.  
  * \--output \<json|text|table\>: Output format.  
  * \--fail-under \<score\>: Exit with code 1 if score is below threshold.  
* **FR-CLI-003:** **Standard IO:** Output results to stdout for piping into other tools (e.g., jq).  
* **FR-CLI-004:** **Local Mode:** Support validating a local directory of files, not just a live URL (useful for testing before deployment).

### Target 3: GitHub Actions Workflow

* **FR-GHA-001:** Action inputs via with::  
  * url: (Optional) Live URL to test.  
  * build-dir: (Optional) Directory of static site assets to test locally.  
  * threshold: Score threshold to fail the workflow.  
* **FR-GHA-002:** **PR Commenter:** Automatically post a comment on the Pull Request with a summary table of the Agentic Score and any broken links found.  
* **FR-GHA-003:** **Status Check:** Report a "Success" or "Failure" status back to the GitHub Commit Status API.

## Non-Functional Requirements

* **NFR-001 (Performance):** Analysis should complete in \<10s for typical sites.  
* **NFR-002 (Politeness):** Respect robots.txt and rate limits (max 2 req/sec).  
* **NFR-003 (Portability):** CLI must run on Linux, macOS, and Windows. GitHub Action must be Docker-based or a pure JS action for speed.

## Technical Implementation Details

### Package Architecture (Monorepo Strategy)

To support three targets without code duplication, the codebase will be structured as a monorepo (e.g., Nx or Turbo):

1. **packages/core**: The shared logic.  
   * Contains the Crawler, the llms.txt parser, and the Scoring Engine.  
   * Exports a TypeScript function: validate(url: string, options: Config): Promise\<Result\>.  
2. **apps/web**: Next.js application.  
   * Will be deployed to Vercel
   * Uses useworkflow.dev, tailwindcss
   * Handles UI/UX and server-side API routes.
3. **packages/cli**: Node.js CLI tool.  
   * Uses useworkflow.dev
   * Uses commander or yargs for argument parsing.  
   * Published to npm as agentready.  
4. **packages/action**: GitHub Action wrapper.  
   * Uses useworkflow.dev
   * Uses @actions/core and @actions/github to interact with PRs.

### Tech Stack

* **Language:** TypeScript (Node.js) for all packages.  
* **HTTP Client:** fetch or axios with retry logic.  
* **HTML Parsing:** cheerio (lightweight, fast) preferred over Puppeteer unless SPA rendering is strictly required.  
* **Markdown Parsing:** remark or unified to validate syntax.

## Roadmap

### Phase 1: Core & CLI (Alpha)

* Build packages/core with llms.txt validation.  
* Release agentic-docs-cli to npm.  
* Allow users to run npx agentic-docs-cli check https://mysite.com.

### Phase 2: Web MVP

* Deploy apps/web to Vercel.  
* Basic UI wrapping the core engine.

### Phase 3: CI/CD Integration

* Package the CLI into a GitHub Action (action.yml).  
* Implement PR commenting logic.
