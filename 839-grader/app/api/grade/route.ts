import { NextRequest } from "next/server";
import { buildMessages } from "@/lib/prompt";

/**
 * POST /api/grade
 *
 * 接收题目 + 学生答案，调用 SiliconFlow API（moonshotai/Kimi-K2.7-Code），
 * 以 SSE 流式返回诊断报告。
 *
 * 请求体：
 * {
 *   question: string,
 *   answer: string,
 *   questionType?: "auto" | "essay" | "lesson-plan",
 *   questionImages?: string[],  // base64 (无 data: 前缀)
 *   answerImages?: string[]
 * }
 *
 * 响应：text/event-stream（SSE），每个 chunk 为 SiliconFlow 的 delta.content
 */

const SILICONFLOW_URL = "https://api.siliconflow.cn/v1/chat/completions";
const MODEL = "moonshotai/Kimi-K2.7-Code";

export async function POST(req: NextRequest) {
  const apiKey = process.env.SILICONFLOW_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "未配置 SILICONFLOW_API_KEY 环境变量" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: {
    question: string;
    answer: string;
    questionType?: string;
    questionImages?: string[];
    answerImages?: string[];
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "请求体格式错误" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { question, answer, questionType, questionImages, answerImages } = body;

  const hasQuestion = question?.trim()?.length > 0 || (questionImages?.length ?? 0) > 0;
  const hasAnswer = answer?.trim()?.length > 0 || (answerImages?.length ?? 0) > 0;

  if (!hasQuestion || !hasAnswer) {
    return new Response(
      JSON.stringify({ error: "题目和答案不能为空" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const messages = buildMessages({
    question,
    answer,
    questionType,
    questionImages,
    answerImages,
  });

  const sfResponse = await fetch(SILICONFLOW_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: true,
      max_tokens: 8192,
      temperature: 0.6,
      top_p: 0.8,
    }),
  });

  if (!sfResponse.ok) {
    const errText = await sfResponse.text();
    return new Response(
      JSON.stringify({
        error: `SiliconFlow API 错误 (${sfResponse.status})`,
        detail: errText,
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  // 将 SiliconFlow 的 SSE 流透传给前端
  return new Response(sfResponse.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
