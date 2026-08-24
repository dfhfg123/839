import fs from "fs";
import path from "path";

/**
 * 知识库加载模块
 * 从 data/839-knowledge/ 读取结构化 markdown 文件，提供给 prompt 构建。
 * 知识库总约 50KB，远在 256K 上下文窗口内，全量注入。
 */

const KNOWLEDGE_DIR = path.join(process.cwd(), "data", "839-knowledge");

function readFile(relPath: string): string {
  const fullPath = path.join(KNOWLEDGE_DIR, relPath);
  return fs.readFileSync(fullPath, "utf-8");
}

function readDir(relPath: string): string[] {
  const fullPath = path.join(KNOWLEDGE_DIR, relPath);
  return fs
    .readdirSync(fullPath)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => path.join(relPath, f));
}

/** 加载完整知识库，以章节分组的字符串形式返回 */
export function loadKnowledgeBase(): string {
  const sections: string[] = [];

  // 1. 考纲与题型
  sections.push(
    wrapSection("考纲与题型", readFile("01-考纲与题型.md"))
  );

  // 2. 历年真题
  sections.push(
    wrapSection("历年真题", readFile("02-历年真题.md"))
  );

  // 3. 理论基础（6个文件）
  const theoryFiles = readDir("03-理论基础");
  for (const f of theoryFiles) {
    const name = path.basename(f, ".md");
    sections.push(wrapSection(`理论基础：${name}`, readFile(f)));
  }

  // 4. 评判细则（核心）
  const rubricFiles = readDir("04-评判细则");
  for (const f of rubricFiles) {
    const name = path.basename(f, ".md");
    sections.push(wrapSection(`评判细则：${name}`, readFile(f)));
  }

  // 5. 模板与案例
  const templateFiles = readDir("05-模板与案例");
  for (const f of templateFiles) {
    const name = path.basename(f, ".md");
    sections.push(wrapSection(`模板与案例：${name}`, readFile(f)));
  }

  // 6. 政策热点
  sections.push(wrapSection("政策热点", readFile("06-政策热点.md")));

  // 7. 示范答案
  sections.push(wrapSection("示范答案", readFile("07-示范答案.md")));

  return sections.join("\n\n---\n\n");
}

function wrapSection(title: string, content: string): string {
  return `### ═══ ${title} ═══\n\n${content}`;
}

/** 仅加载评判细则 + 示范答案（精简模式，当不需要全量注入时使用） */
export function loadRubricOnly(): string {
  const sections: string[] = [];

  const rubricFiles = readDir("04-评判细则");
  for (const f of rubricFiles) {
    const name = path.basename(f, ".md");
    sections.push(wrapSection(`评判细则：${name}`, readFile(f)));
  }

  sections.push(wrapSection("示范答案", readFile("07-示范答案.md")));

  return sections.join("\n\n---\n\n");
}
