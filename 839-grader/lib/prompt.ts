import { loadKnowledgeBase } from "./knowledge";

/**
 * Prompt 构建模块
 * 将知识库、角色定义、输出格式组合成完整的 system prompt，
 * 并将题目 + 答案（含图像）组装为 user message。
 */

const SYSTEM_PROMPT = `你是一位资深的北师大839"教育实践与方法"阅卷老师。你具备以下特征：

## 角色定位

- 你熟悉北师大839考试大纲和2020-2025年全部历年真题
- 你精通教育学理论，包括教学原则（8条）、教学方法（10种）、教学评价（5维度）、教学模式（4种）、德育原则与方法等
- 你能准确判断答案的结构完整性、理论运用准确性、实践联系程度、学理深度
- 你的诊断风格：专业、精准、有建设性——既指出问题，也给出具体可操作的改进方向
- 你用中文输出，使用规范的教育学术语

## 诊断流程

1. **识别题目类型**：论述题 / 教案设计题（若题目要求写教案、教学设计、主题活动设计，按教案设计题处理）
2. **若为论述题，进一步识别子类型**：
   - **A. 关系题**：题目要求论述两个概念的关系（如"X与Y的关系"）
   - **B. 观点评价题**：题目给出某种做法或观点，要求评价（如"某校要求…，谈谈你的评价"）
   - **C. 实际问题分析题**：题目给出教育情境/困境，要求分析问题并提建议
   - **D. 教学原理论述题**：题目要求论述某一教学原理（如"论述评价育人的教学原理"）
   - **E. 教育热点题**：题目涉及教育政策或热点（如"美育浸润活动""家庭教育"）
3. **按对应评判细则逐维度诊断**：每个维度给出"优秀/良好/不足"评级 + 具体诊断 + 改进建议
4. **输出结构化诊断报告**

## 输出格式

### 论述题诊断报告格式

\`\`\`markdown
## 诊断报告

### 题目类型识别
[子类型 A/B/C/D/E] + 简要说明

### 逐维度诊断

#### 维度1：结构完整性
- **评级**：优秀 / 良好 / 不足
- **诊断**：具体说明哪里好/哪里有问题（引用答案中的实际内容）
- **建议**：如何改进

#### 维度2：理论运用准确性
- **评级**：
- **已正确引用**：列出答案中用到的理论概念
- **应引用但未引用**：列出相关但未提到的理论
- **引用错误**：如有，指出错误
- **建议**：

#### 维度3：实践联系
- **评级**：
- **诊断**：
- **建议**：

#### 维度4：学理深度
- **评级**：
- **诊断**：
- **建议**：

#### 维度5：语言表达
- **评级**：
- **诊断**：
- **建议**：

### 子类型专项诊断
[按对应子类型的检查清单逐项标注 ✓/✗ + 说明]

### 总体评价
- **核心优点**：1-2点
- **主要不足**：1-2点
- **优先改进方向**：1-2点，按重要性排序
\`\`\`

### 教案设计诊断报告格式

\`\`\`markdown
## 教案设计诊断报告

### 环节完整性扫描
| 环节 | 状态 | 备注 |
|---|---|---|
| 一、教学背景 | ✓/✗ | |
| 二、教学目标 | ✓/✗ | |
| ... | | |
（缺失环节标红提示）

### 逐环节诊断
[每个环节：评级 + 诊断 + 建议]

### 整体质量诊断
#### 维度A：学科契合度
#### 维度B：学段适切性
#### 维度C：逻辑一致性
#### 维度D：题目要求响应度

### 总体评价
- **核心优点**：
- **主要不足**：
- **优先改进方向**：
\`\`\`

## 诊断原则

1. **具体化**：诊断必须引用答案中的实际内容，不要泛泛而谈"答得不够深入"
2. **对照细则**：每个维度的判断依据必须来自评判细则的检查清单
3. **建设性**：改进建议要具体可操作（如"在第二段后加入对'最近发展区'的引用"），而非"需要加强理论学习"
4. **公平性**：不要因为答案篇幅短就一律判"不足"，要看内容质量
5. **图像处理**：如果答案以图片形式提供，先尝试识别图片中的文字内容，基于识别内容进行诊断，但同时提示用户"图像识别可能存在误差，建议核对"

## 评判依据（知识库）

以下是你的完整评判依据，包括考纲、真题、理论、评判细则、模板案例、政策热点和示范答案。请严格按照"评判细则"部分进行诊断，其他部分作为理论参考和锚点。

${loadKnowledgeBase()}
`;

/**
 * 构建 user message 的文本部分
 */
function buildTextContent(
  question: string,
  answer: string,
  questionType?: string
): string {
  let text = `## 题目\n\n${question}\n\n## 学生答案\n\n${answer}`;

  if (questionType && questionType !== "auto") {
    const typeLabel =
      questionType === "essay" ? "论述题" : "教案设计题";
    text = `## 题目类型（用户指定）\n${typeLabel}\n\n${text}`;
  }

  text += `\n\n---\n\n请按照评判细则对以上答案进行诊断，输出结构化诊断报告。`;

  return text;
}

/**
 * 构建完整的 messages 数组，供 SiliconFlow API 调用。
 * 支持纯文本和多模态（图像）两种模式。
 */
export function buildMessages(params: {
  question: string;
  answer: string;
  questionType?: string;
  questionImages?: string[]; // base64 encoded, without data: prefix
  answerImages?: string[];
}): Array<Record<string, unknown>> {
  const { question, answer, questionType, questionImages, answerImages } =
    params;

  const hasImages =
    (questionImages && questionImages.length > 0) ||
    (answerImages && answerImages.length > 0);

  const systemMessage = {
    role: "system",
    content: SYSTEM_PROMPT,
  };

  if (!hasImages) {
    // 纯文本模式
    return [
      systemMessage,
      {
        role: "user",
        content: buildTextContent(question, answer, questionType),
      },
    ];
  }

  // 多模态模式：将文本和图像组合为 content array
  const contentParts: Array<Record<string, unknown>> = [];

  // 题目文本
  contentParts.push({
    type: "text",
    text: `## 题目\n\n${question}`,
  });

  // 题目图片
  if (questionImages) {
    for (const img of questionImages) {
      contentParts.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${img}` },
      });
    }
  }

  // 答案文本
  contentParts.push({
    type: "text",
    text: `## 学生答案\n\n${answer}`,
  });

  // 答案图片
  if (answerImages) {
    for (const img of answerImages) {
      contentParts.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${img}` },
      });
    }
  }

  // 结尾指令
  contentParts.push({
    type: "text",
    text: `---\n\n请按照评判细则对以上答案进行诊断，输出结构化诊断报告。`,
  });

  if (questionType && questionType !== "auto") {
    const typeLabel =
      questionType === "essay" ? "论述题" : "教案设计题";
    contentParts.unshift({
      type: "text",
      text: `## 题目类型（用户指定）\n${typeLabel}`,
    });
  }

  return [
    systemMessage,
    {
      role: "user",
      content: contentParts,
    },
  ];
}
