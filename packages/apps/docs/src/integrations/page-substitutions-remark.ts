/**
 * Remark plugin that resolves `{{TOKEN}}` placeholders in markdown
 * text and inline-code nodes for the `pages` content collection.
 *
 * Wired into `astro.config.ts` under `markdown.remarkPlugins` so
 * the HTML pipeline produces the same substituted output as the
 * markdown-mirrors integration (which uses the same string-level
 * helper directly).
 *
 * Check pages don't contain `{{...}}` tokens, so the plugin is a
 * no-op for them.
 */
import { applyPageSubstitutions } from '../lib/page-substitutions';

interface MdastNode {
  type: string;
  value?: string;
  children?: MdastNode[];
}

export function remarkPageSubstitutions() {
  return (tree: MdastNode) => {
    visit(tree);
  };
}

function visit(node: MdastNode): void {
  if (
    (node.type === 'text' ||
      node.type === 'inlineCode' ||
      node.type === 'code' ||
      node.type === 'html') &&
    typeof node.value === 'string' &&
    node.value.includes('{{')
  ) {
    node.value = applyPageSubstitutions(node.value);
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) visit(child);
  }
}
