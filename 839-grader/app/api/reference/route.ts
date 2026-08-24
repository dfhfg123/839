import { NextRequest } from "next/server";
import { buildReferenceMessages } from "@/lib/prompt";

/**
 * POST /api/reference
 *
 * 第二次调用：根据题目 + 诊断报告，生成参考答案。
 * 以 SSE 流式返回。
 *
 * 请求体：
 * {
 *   question: string,
 *   questionType?: "auto" | "essay" | "lesson-plan",
 *   diagnosis: string,           // 第一轮诊断报告全文
 *   questionImages?: string[]
 * }
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
    questionType?: string;
    diagnosis: string;
    questionImages?: string[];
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "请求体格式错误" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { question, questionType, diagnosis, questionImages } = body;

  if (!question || !diagnosis) {
    return new Response(
      JSON.stringify({ error: "题目和诊断报告不能为空" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const messages = buildReferenceMessages({
    question,
    questionType,
    diagnosis,
    questionImages,
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
      temperature: 0.7,
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

  const stream = new ReadableStream({
    async start(controller) {
      const reader = sfResponse.body!.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;

            const data = trimmed.startsWith("data: ") ? trimmed.slice(6) : trimmed.slice(5);
            if (data === "[DONE]") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed?.choices?.[0]?.delta;
              const content = delta?.content;
              const reasoning = delta?.reasoning_content;

              if (typeof content === "string" && content.length > 0) {
                const chunk = JSON.stringify({ type: "content", content });
                controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
              }

              if (typeof reasoning === "string" && reasoning.length > 0) {
                const chunk = JSON.stringify({ type: "reasoning", content: reasoning });
                controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
              }
            } catch {
              // skip malformed
            }
          }
        }
      } catch {
        // upstream closed
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
