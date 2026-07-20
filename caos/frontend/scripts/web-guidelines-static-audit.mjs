import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../src/", import.meta.url));
const faults = [];
let fileCount = 0;

function report(file, sourceFile, node, rule, message) {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  faults.push(`${relative(root, file)}:${line + 1} [${rule}] ${message}`);
}

function attributeName(attribute) {
  return ts.isJsxAttribute(attribute) ? attribute.name.getText().toLowerCase() : null;
}

function findAttribute(node, name) {
  return node.attributes.properties.find((attribute) => attributeName(attribute) === name);
}

function hasSpread(node) {
  return node.attributes.properties.some(ts.isJsxSpreadAttribute);
}

function literalAttributeValue(attribute) {
  if (!attribute || !ts.isJsxAttribute(attribute)) return null;
  if (!attribute.initializer) return "";
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text;
  if (
    ts.isJsxExpression(attribute.initializer)
    && attribute.initializer.expression
    && (ts.isStringLiteral(attribute.initializer.expression) || ts.isNoSubstitutionTemplateLiteral(attribute.initializer.expression))
  ) return attribute.initializer.expression.text;
  return null;
}

function ancestorIsAriaHidden(node) {
  let current = node.parent;
  while (current) {
    if (ts.isJsxElement(current)) {
      const attribute = findAttribute(current.openingElement, "aria-hidden");
      const value = literalAttributeValue(attribute);
      if (attribute && (value === "" || value === "true")) return true;
    }
    current = current.parent;
  }
  return false;
}

function svgHasTitle(opening) {
  const element = opening.parent;
  return ts.isJsxElement(element) && element.children.some((child) => (
    ts.isJsxElement(child) && child.openingElement.tagName.getText().toLowerCase() === "title"
  ));
}

function auditJsx(file, sourceFile, opening) {
  const tag = opening.tagName.getText();
  const normalizedTag = tag.toLowerCase();
  const spread = hasSpread(opening);

  if (normalizedTag === "input" || tag === "TextInput") {
    for (const required of ["name", "autocomplete"]) {
      if (!findAttribute(opening, required) && !spread) {
        report(file, sourceFile, opening, "input-metadata", `<${tag}> requires ${required}.`);
      }
    }
  }

  const placeholder = findAttribute(opening, "placeholder");
  const placeholderValue = literalAttributeValue(placeholder);
  if (placeholderValue && !placeholderValue.endsWith("…")) {
    report(file, sourceFile, placeholder, "placeholder-ellipsis", "Placeholder must end with the ellipsis character (…).");
  }

  if (normalizedTag === "img") {
    for (const required of ["alt", "width", "height"]) {
      if (!findAttribute(opening, required) && !spread) {
        report(file, sourceFile, opening, "image-contract", `<img> requires ${required}.`);
      }
    }
  }

  if (normalizedTag === "svg" && !spread && !ancestorIsAriaHidden(opening)) {
    const ariaHiddenAttribute = findAttribute(opening, "aria-hidden");
    const ariaHiddenValue = literalAttributeValue(ariaHiddenAttribute);
    const ariaHidden = Boolean(ariaHiddenAttribute) && (ariaHiddenValue === "" || ariaHiddenValue === "true");
    const hasAccessibleName = Boolean(
      findAttribute(opening, "aria-label")
      || findAttribute(opening, "aria-labelledby")
      || svgHasTitle(opening)
    );
    if (!ariaHidden && !hasAccessibleName) {
      report(file, sourceFile, opening, "svg-semantics", "SVG must be hidden from assistive technology or have an accessible name.");
    }
  }

  const className = literalAttributeValue(findAttribute(opening, "classname"));
  if (className && /(?:^|\s)transition-all(?:\s|$)/.test(className)) {
    report(file, sourceFile, opening, "transition-all", "List transitioned properties explicitly; transition-all is not allowed.");
  }
}

function auditTypeScript(file, content) {
  const scriptKind = extname(file) === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, scriptKind);
  const pasteHandlers = new Set();

  function collect(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      auditJsx(file, sourceFile, node);
      const onPaste = findAttribute(node, "onpaste");
      if (onPaste && ts.isJsxAttribute(onPaste) && ts.isJsxExpression(onPaste.initializer) && onPaste.initializer.expression) {
        const expression = onPaste.initializer.expression;
        if (ts.isIdentifier(expression)) pasteHandlers.add(expression.text);
        if (/\.preventDefault\s*\(/.test(expression.getText(sourceFile))) {
          report(file, sourceFile, onPaste, "paste-blocking", "Paste handlers must not call preventDefault().");
        }
      }
    }

    if (ts.isJsxText(node) && node.text.includes("...")) {
      report(file, sourceFile, node, "ellipsis-copy", "Use the ellipsis character (…) in rendered copy.");
    }

    ts.forEachChild(node, collect);
  }

  collect(sourceFile);

  function checkPasteHandler(node) {
    const name = (
      (ts.isFunctionDeclaration(node) && node.name?.text)
      || (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text)
    );
    if (name && pasteHandlers.has(name) && /\.preventDefault\s*\(/.test(node.getText(sourceFile))) {
      report(file, sourceFile, node, "paste-blocking", `onPaste handler ${name} must not call preventDefault().`);
    }
    ts.forEachChild(node, checkPasteHandler);
  }

  checkPasteHandler(sourceFile);
}

function auditCss(file, content) {
  const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.Unknown);
  for (const match of content.matchAll(/transition\s*:\s*all\b/gi)) {
    const node = { getStart: () => match.index ?? 0 };
    report(file, sourceFile, node, "transition-all", "List transitioned properties explicitly; transition: all is not allowed.");
  }
}

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }
    if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name)) continue;
    if (![".ts", ".tsx", ".css"].includes(extname(entry.name))) continue;

    fileCount += 1;
    const content = await readFile(path, "utf8");
    if (extname(path) === ".css") auditCss(path, content);
    else auditTypeScript(path, content);

    for (const match of content.matchAll(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\.0)?\b/gi)) {
      const sourceFile = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true);
      const node = { getStart: () => match.index ?? 0 };
      report(path, sourceFile, node, "viewport-zoom", "Do not disable browser zoom.");
    }
  }
}

await walk(root);
faults.sort();

if (faults.length > 0) {
  console.error(faults.join("\n"));
  console.error(`\nWeb interface static audit failed: ${faults.length} fault(s) across ${fileCount} source files.`);
  process.exitCode = 1;
} else {
  console.log(`Web interface static audit passed: ${fileCount} source files, 0 faults.`);
}
