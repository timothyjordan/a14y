/**
 * Side-effect-only barrel that pulls in every check file so each one can
 * call `registerCheck()` at module load. Adding a new check means adding an
 * import line here.
 *
 * This file is intentionally split out from registry.ts to avoid a circular
 * import: check files import types from `./types`, registry exports
 * `registerCheck`, and check files call it at top level.
 */

// Site-level checks (TJ-96).
import '../checks/site/llmsTxt';
import '../checks/site/robotsTxt';
import '../checks/site/sitemapXml';
import '../checks/site/sitemapMd';
import '../checks/site/agentsMd';

// Page-level checks (TJ-97).
import '../checks/page/http';
import '../checks/page/meta';
import '../checks/page/jsonLd';
import '../checks/page/structure';
import '../checks/page/markdown';
import '../checks/page/code';
import '../checks/page/api';
import '../checks/page/discovery';

export {};
