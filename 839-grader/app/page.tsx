'use client';

import { useState, useRef, useCallback, isValidElement, type ChangeEvent, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ─── Types ───────────────────────────────────────────────────────────
type QuestionType = 'auto' | 'essay' | 'lesson-plan';
type Status = 'idle' | 'streaming' | 'done' | 'error';
type RefStatus = 'idle' | 'streaming' | 'done' | 'error';

interface ImageItem {
  id: string;
  dataUrl: string;
  base64: string;
  name: string;
}

// ─── Design Tokens & Animations ──────────────────────────────────────
const TOKENS_STYLE = `
  :root {
    --bg-base: #FAF9F6;
    --bg-surface: #FFFFFF;
    --bg-report: #FFFEF7;
    --color-primary: #1A2B3C;
    --color-primary-light: #2A3B4C;
    --color-accent: #C73E3A;
    --color-accent-hover: #A52F2C;
    --color-text: #2C2C2C;
    --color-text-muted: #8A8580;
    --color-border: #E0DDD5;
    --color-border-strong: #C9C5BC;
    --color-success: #2D6A4F;
    --color-warning: #B7791F;
    --color-error: #C73E3A;
    --font-serif: "Noto Serif SC", "Songti SC", "STSong", "SimSun", serif;
    --font-sans: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, sans-serif;
    --font-mono: "SF Mono", "Fira Code", "Consolas", "Liberation Mono", monospace;
  }
  @keyframes grader-pulse {
    0%, 60%, 100% { opacity: 0.25; transform: scale(0.8); }
    30% { opacity: 1; transform: scale(1); }
  }
  @keyframes grader-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
  @keyframes grader-fade-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes grader-breathe {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  }
  .md-code-inline {
    background: rgba(26, 43, 60, 0.07);
    padding: 0.1em 0.35em;
    border-radius: 0.25rem;
    font-family: var(--font-mono);
    font-size: 0.875em;
    color: var(--color-accent);
  }
  .md-pre {
    background: #1A2B3C;
    padding: 1rem 1.25rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin: 1.25rem 0;
    font-size: 0.875rem;
    line-height: 1.6;
  }
  .md-pre code {
    background: none;
    padding: 0;
    border-radius: 0;
    color: #D4D0C8;
    font-family: var(--font-mono);
    font-size: inherit;
  }
  .md-pre::-webkit-scrollbar { height: 6px; }
  .md-pre::-webkit-scrollbar-track { background: rgba(255,255,255,0.1); }
  .md-pre::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
  .md-table { border-collapse: collapse; }
  .md-table tbody tr:nth-child(even) { background: rgba(26, 43, 60, 0.025); }
  .md-table tbody tr:last-child td { border-bottom: none; }
`;

// ─── Constants ───────────────────────────────────────────────────────
const TYPE_OPTIONS: { value: QuestionType; label: string; hint: string }[] = [
  { value: 'auto', label: '自动识别', hint: '由系统自动判断题型' },
  { value: 'essay', label: '论述题', hint: '分析论证类题目' },
  { value: 'lesson-plan', label: '教案设计', hint: '教学方案设计题' },
];

// ─── Helpers ─────────────────────────────────────────────────────────
function extractText(children: ReactNode): string {
  if (children === null || children === undefined || typeof children === 'boolean') return '';
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(extractText).join('');
  if (isValidElement(children)) {
    const props = children.props as { children?: ReactNode };
    return extractText(props.children);
  }
  return '';
}

// ─── Icons ───────────────────────────────────────────────────────────
function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

// ─── Markdown Components ─────────────────────────────────────────────
const markdownComponents: Components = {
  h1: ({ node, ...props }) => (
    <h1 className="font-[var(--font-serif)] text-[1.5rem] font-bold text-[var(--color-primary)] mt-7 mb-3 pb-2 border-b border-[var(--color-border)]" {...props} />
  ),
  h2: ({ node, ...props }) => (
    <h2 className="font-[var(--font-serif)] text-[1.25rem] font-bold text-[var(--color-primary)] mt-6 mb-3" {...props} />
  ),
  h3: ({ node, ...props }) => (
    <h3 className="font-[var(--font-serif)] text-[1.1rem] font-semibold text-[var(--color-primary)] mt-5 mb-2" {...props} />
  ),
  h4: ({ node, ...props }) => (
    <h4 className="font-[var(--font-sans)] text-[1rem] font-semibold text-[var(--color-text)] mt-4 mb-2" {...props} />
  ),
  p: ({ node, ...props }) => (
    <p className="my-3 leading-[1.85] text-[0.95rem]" {...props} />
  ),
  ul: ({ node, ...props }) => (
    <ul className="my-3 pl-5 list-disc space-y-1.5" {...props} />
  ),
  ol: ({ node, ...props }) => (
    <ol className="my-3 pl-5 list-decimal space-y-1.5" {...props} />
  ),
  li: ({ node, ...props }) => (
    <li className="leading-[1.8] text-[0.95rem] pl-1" {...props} />
  ),
  table: ({ node, ...props }) => (
    <div className="overflow-x-auto my-5 rounded-lg border border-[var(--color-border)]">
      <table className="md-table w-full" {...props} />
    </div>
  ),
  thead: ({ node, ...props }) => (
    <thead className="bg-[var(--color-primary)]" {...props} />
  ),
  th: ({ node, ...props }) => (
    <th className="px-4 py-2.5 text-left font-semibold text-white text-[0.875rem] border-b border-[var(--color-border)]" {...props} />
  ),
  td: ({ node, ...props }) => (
    <td className="px-4 py-2.5 border-b border-[var(--color-border)] text-[0.9rem] text-[var(--color-text)]" {...props} />
  ),
  pre: ({ node, ...props }) => (
    <pre className="md-pre" {...props} />
  ),
  code: ({ node, className, ...props }) => (
    <code className={className || 'md-code-inline'} {...props} />
  ),
  blockquote: ({ node, ...props }) => (
    <blockquote className="border-l-[3px] border-[var(--color-accent)] pl-4 py-1 my-4 bg-[rgba(199,62,58,0.04)] text-[var(--color-text-muted)] italic" {...props} />
  ),
  hr: ({ node, ...props }) => (
    <hr className="border-0 border-t border-[var(--color-border)] my-6" {...props} />
  ),
  a: ({ node, ...props }) => (
    <a className="text-[var(--color-accent)] underline underline-offset-2 hover:text-[var(--color-primary)] transition-colors" {...props} target="_blank" rel="noopener noreferrer" />
  ),
  img: ({ node, ...props }) => (
    <img className="max-w-full h-auto rounded-lg my-4" alt="" {...props} />
  ),
  strong: ({ node, children, ...props }) => {
    const text = extractText(children);
    if (/优秀|出色|亮点|突出|优异/.test(text)) {
      return <strong className="font-semibold text-[var(--color-success)]" {...props}>{children}</strong>;
    }
    if (/良好|中等|一般|尚可|合格/.test(text)) {
      return <strong className="font-semibold text-[var(--color-warning)]" {...props}>{children}</strong>;
    }
    if (/不足|欠缺|较差|薄弱|问题|缺陷|错误|缺失/.test(text)) {
      return <strong className="font-semibold text-[var(--color-error)]" {...props}>{children}</strong>;
    }
    return <strong className="font-semibold text-[var(--color-primary)]" {...props}>{children}</strong>;
  },
  del: ({ node, ...props }) => (
    <del className="text-[var(--color-text-muted)] line-through" {...props} />
  ),
  input: ({ node, ...props }) => (
    <input className="mr-2 accent-[var(--color-primary)]" {...props} />
  ),
};

// ─── Sub-components ──────────────────────────────────────────────────
function ImageUploadSection({
  label,
  images,
  onUpload,
  onRemove,
}: {
  label: string;
  images: ImageItem[];
  onUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemove: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mt-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onUpload}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-2 px-3.5 py-2 text-[0.85rem] font-medium text-[var(--color-primary)] border border-[var(--color-border)] rounded-md hover:bg-[rgba(26,43,60,0.03)] hover:border-[var(--color-border-strong)] transition-all duration-200"
      >
        <UploadIcon className="w-4 h-4" />
        {label}
      </button>
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {images.map((img) => (
            <div key={img.id} className="relative group w-20 h-20">
              <img
                src={img.dataUrl}
                alt={img.name}
                className="w-full h-full object-cover rounded-md border border-[var(--color-border)]"
              />
              <button
                type="button"
                onClick={() => onRemove(img.id)}
                className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-[rgba(0,0,0,0.6)] text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              >
                <CloseIcon className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-1.5 py-2">
      <span className="w-2 h-2 rounded-full bg-[var(--color-primary)]" style={{ animation: 'grader-pulse 1.4s ease-in-out infinite', animationDelay: '0s' }} />
      <span className="w-2 h-2 rounded-full bg-[var(--color-primary)]" style={{ animation: 'grader-pulse 1.4s ease-in-out infinite', animationDelay: '0.2s' }} />
      <span className="w-2 h-2 rounded-full bg-[var(--color-primary)]" style={{ animation: 'grader-pulse 1.4s ease-in-out infinite', animationDelay: '0.4s' }} />
    </div>
  );
}

function StreamingCursor() {
  return (
    <span
      className="inline-block w-[2px] h-[1.1em] bg-[var(--color-accent)] align-middle ml-0.5"
      style={{ animation: 'grader-blink 1s step-end infinite' }}
    />
  );
}

// ─── Main Page Component ─────────────────────────────────────────────
export default function Page() {
  const [questionType, setQuestionType] = useState<QuestionType>('auto');
  const [questionText, setQuestionText] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [questionImages, setQuestionImages] = useState<ImageItem[]>([]);
  const [answerImages, setAnswerImages] = useState<ImageItem[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [report, setReport] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [refStatus, setRefStatus] = useState<RefStatus>('idle');
  const [reference, setReference] = useState('');
  const [refError, setRefError] = useState<string | null>(null);
  const refAbortRef = useRef<AbortController | null>(null);
  const [isThinking, setIsThinking] = useState(false);

  const hasQuestion = questionText.trim().length > 0 || questionImages.length > 0;
  const hasAnswer = answerText.trim().length > 0 || answerImages.length > 0;
  const canSubmit = hasQuestion && hasAnswer;

  const handleImageUpload = async (
    e: ChangeEvent<HTMLInputElement>,
    target: 'question' | 'answer'
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const readFiles = Array.from(files).map(
      (file) =>
        new Promise<ImageItem>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(',')[1] || '';
            resolve({
              id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
              dataUrl,
              base64,
              name: file.name,
            });
          };
          reader.readAsDataURL(file);
        })
    );

    const newItems = await Promise.all(readFiles);

    if (target === 'question') {
      setQuestionImages((prev) => [...prev, ...newItems]);
    } else {
      setAnswerImages((prev) => [...prev, ...newItems]);
    }

    e.target.value = '';
  };

  const removeImage = (target: 'question' | 'answer', id: string) => {
    if (target === 'question') {
      setQuestionImages((prev) => prev.filter((img) => img.id !== id));
    } else {
      setAnswerImages((prev) => prev.filter((img) => img.id !== id));
    }
  };

  const handleSubmit = async () => {
    if (!hasQuestion || !hasAnswer) return;

    setStatus('streaming');
    setReport('');
    setError(null);
    setIsThinking(false);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: questionText,
          answer: answerText,
          questionType,
          questionImages: questionImages.map((img) => img.base64),
          answerImages: answerImages.map((img) => img.base64),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorMessage = `请求失败 (${response.status})`;
        try {
          const errData = await response.json();
          if (errData.error) errorMessage = errData.error;
        } catch {
          // ignore JSON parse error
        }
        throw new Error(errorMessage);
      }

      if (!response.body) throw new Error('无法读取响应流');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;

          const data = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed.slice(5);
          if (data === '[DONE]') {
            setStatus('done');
            return;
          }

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content' && typeof parsed.content === 'string') {
              setIsThinking(false);
              setReport((prev) => prev + parsed.content);
            } else if (parsed.type === 'reasoning') {
              setIsThinking(true);
            }
          } catch {
            // skip malformed
          }
        }
      }

      setStatus('done');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return; // User cancelled
      }
      setError(err instanceof Error ? err.message : '批改过程中出现未知错误');
      setStatus('error');
    } finally {
      abortRef.current = null;
    }
  };

  const handleBack = () => {
    if (abortRef.current) abortRef.current.abort();
    if (refAbortRef.current) refAbortRef.current.abort();
    setStatus('idle');
    setReport('');
    setError(null);
    setRefStatus('idle');
    setReference('');
    setRefError(null);
    setIsThinking(false);
  };

  const handleGenerateReference = async () => {
    if (!report) return;

    setRefStatus('streaming');
    setReference('');
    setRefError(null);

    const controller = new AbortController();
    refAbortRef.current = controller;

    try {
      const response = await fetch('/api/reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: questionText,
          questionType,
          diagnosis: report,
          questionImages: questionImages.map((img) => img.base64),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorMessage = `请求失败 (${response.status})`;
        try {
          const errData = await response.json();
          if (errData.error) errorMessage = errData.error;
        } catch {
          // ignore
        }
        throw new Error(errorMessage);
      }

      if (!response.body) throw new Error('无法读取响应流');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;

          const data = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed.slice(5);
          if (data === '[DONE]') {
            setRefStatus('done');
            return;
          }

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content' && typeof parsed.content === 'string') {
              setReference((prev) => prev + parsed.content);
            }
          } catch {
            // skip malformed
          }
        }
      }

      setRefStatus('done');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setRefError(err instanceof Error ? err.message : '参考答案生成失败');
      setRefStatus('error');
    } finally {
      refAbortRef.current = null;
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: TOKENS_STYLE }} />
      <div className="min-h-screen bg-[var(--bg-base)] font-[var(--font-sans)] text-[var(--color-text)]">
        {/* Top accent bar */}
        <div className="h-1 bg-[var(--color-accent)]" />

        <main className="mx-auto max-w-[900px] px-6 py-16 md:py-20">
          {/* Header */}
          <header className="mb-10 md:mb-12">
            <h1 className="font-[var(--font-serif)] text-[2.5rem] md:text-[2.75rem] font-bold text-[var(--color-primary)] tracking-tight leading-tight">
              839 批改助手
            </h1>
            <p className="mt-2 text-[0.95rem] text-[var(--color-text-muted)]">
              北师大教育实践与方法 · 论述题与教案设计诊断
            </p>
            <div className="mt-4 h-px bg-gradient-to-r from-[var(--color-border-strong)] via-[var(--color-border)] to-transparent" />
          </header>

          {status === 'idle' ? (
            /* ─── Input View ─── */
            <div>
              {/* Type selector */}
              <div className="mb-10">
                <div className="flex gap-1 p-1 bg-[var(--bg-surface)] border border-[var(--color-border)] rounded-lg">
                  {TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setQuestionType(opt.value)}
                      className={`flex-1 px-4 py-2.5 rounded-md text-[0.9rem] font-medium transition-all duration-200 ${
                        questionType === opt.value
                          ? 'bg-[var(--color-primary)] text-white shadow-sm'
                          : 'text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[rgba(26,43,60,0.04)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[0.8rem] text-[var(--color-text-muted)] px-1">
                  {TYPE_OPTIONS.find((o) => o.value === questionType)?.hint}
                </p>
              </div>

              {/* Question section */}
              <section>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="font-[var(--font-serif)] text-[1.05rem] font-semibold text-[var(--color-primary)]">题目</span>
                  <span className="text-[0.75rem] text-[var(--color-text-muted)]">（可上传真题照片）</span>
                </div>
                <textarea
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="在此输入题目文本，或上传题目图片..."
                  aria-label="题目"
                  className="w-full min-h-[120px] p-4 bg-[var(--bg-surface)] border border-[var(--color-border)] rounded-lg text-[0.95rem] leading-relaxed text-[var(--color-text)] resize-y focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[rgba(26,43,60,0.08)] transition-colors placeholder:text-[var(--color-text-muted)]"
                />
                <div className="flex justify-end mt-1">
                  <span className="text-[0.75rem] text-[var(--color-text-muted)]">{questionText.length} 字</span>
                </div>
                <ImageUploadSection
                  label="上传题目图片"
                  images={questionImages}
                  onUpload={(e) => handleImageUpload(e, 'question')}
                  onRemove={(id) => removeImage('question', id)}
                />
              </section>

              {/* Separator */}
              <div className="my-8 border-t border-[var(--color-border)]" />

              {/* Answer section */}
              <section>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="font-[var(--font-serif)] text-[1.05rem] font-semibold text-[var(--color-primary)]">答案</span>
                  <span className="text-[0.75rem] text-[var(--color-text-muted)]">（可上传手写答案照片）</span>
                </div>
                <textarea
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && canSubmit) {
                      handleSubmit();
                    }
                  }}
                  placeholder="在此输入你的答案文本，或上传手写答案照片..."
                  aria-label="答案"
                  className="w-full min-h-[200px] p-4 bg-[var(--bg-surface)] border border-[var(--color-border)] rounded-lg text-[0.95rem] leading-relaxed text-[var(--color-text)] resize-y focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[rgba(26,43,60,0.08)] transition-colors placeholder:text-[var(--color-text-muted)]"
                />
                <div className="flex justify-end mt-1">
                  <span className="text-[0.75rem] text-[var(--color-text-muted)]">{answerText.length} 字</span>
                </div>
                <ImageUploadSection
                  label="上传答案图片"
                  images={answerImages}
                  onUpload={(e) => handleImageUpload(e, 'answer')}
                  onRemove={(id) => removeImage('answer', id)}
                />
              </section>

              {/* Submit */}
              <div className="mt-10">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className={`w-full py-3.5 rounded-lg font-medium text-[0.95rem] transition-all duration-200 ${
                    canSubmit
                      ? 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-light)] hover:shadow-md'
                      : 'bg-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed'
                  }`}
                >
                  开始批改
                </button>
                <p className="mt-3 text-center text-[0.8rem] text-[var(--color-text-muted)]">
                  提交后将流式生成诊断报告，请耐心等待
                </p>
              </div>
            </div>
          ) : (
            /* ─── Result View ─── */
            <div>
              {/* Summary card */}
              <div className="mb-6 p-4 bg-[var(--bg-surface)] border border-[var(--color-border)] rounded-lg">
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <span className="px-2.5 py-1 text-[0.75rem] font-medium bg-[var(--color-primary)] text-white rounded">
                    {TYPE_OPTIONS.find((o) => o.value === questionType)?.label}
                  </span>
                  {questionImages.length > 0 && (
                    <span className="text-[0.75rem] text-[var(--color-text-muted)]">
                      题目图片 {questionImages.length} 张
                    </span>
                  )}
                  {answerImages.length > 0 && (
                    <span className="text-[0.75rem] text-[var(--color-text-muted)]">
                      答案图片 {answerImages.length} 张
                    </span>
                  )}
                </div>
                <div className="space-y-1.5 text-[0.85rem]">
                  <div className="flex">
                    <span className="text-[var(--color-text-muted)] font-medium shrink-0 mr-2">题目:</span>
                    <span className="text-[var(--color-text)] line-clamp-2">{questionText}</span>
                  </div>
                  <div className="flex">
                    <span className="text-[var(--color-text-muted)] font-medium shrink-0 mr-2">答案:</span>
                    <span className="text-[var(--color-text)] line-clamp-2">{answerText}</span>
                  </div>
                </div>
              </div>

              {/* Report area */}
              <div
                className="bg-[var(--bg-report)] border border-[var(--color-border)] rounded-lg overflow-hidden"
                style={{ animation: 'grader-fade-in 0.4s ease-out' }}
              >
                {/* Report header */}
                <div className="flex items-center gap-2 px-6 py-3.5 border-b border-[var(--color-border)] bg-[rgba(26,43,60,0.02)]">
                  <DocumentIcon className="w-4 h-4 text-[var(--color-primary)]" />
                  <span className="font-[var(--font-serif)] text-[0.95rem] font-semibold text-[var(--color-primary)]">
                    诊断报告
                  </span>
                  {status === 'streaming' && (
                    <span className="ml-auto flex items-center gap-1.5 text-[0.75rem] text-[var(--color-text-muted)]">
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]"
                        style={{ animation: 'grader-breathe 1.5s ease-in-out infinite' }}
                      />
                      生成中
                    </span>
                  )}
                  {status === 'done' && (
                    <span className="ml-auto flex items-center gap-1.5 text-[0.75rem] text-[var(--color-text-muted)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
                      已完成
                    </span>
                  )}
                  {status === 'error' && (
                    <span className="ml-auto flex items-center gap-1.5 text-[0.75rem] text-[var(--color-text-muted)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-error)]" />
                      出错
                    </span>
                  )}
                </div>

                {/* Report content */}
                <div className="px-6 py-5 md-table break-words text-[var(--color-text)]">
                  {report ? (
                    <>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {report}
                      </ReactMarkdown>
                      {status === 'streaming' && <StreamingCursor />}
                      {status === 'error' && (
                        <div className="mt-4 p-3 bg-[rgba(199,62,58,0.05)] border border-[rgba(199,62,58,0.15)] rounded-md">
                          <p className="text-[0.8rem] text-[var(--color-error)]">
                            报告生成中断: {error}
                          </p>
                          <button
                            type="button"
                            onClick={handleSubmit}
                            className="mt-2 text-[0.8rem] text-[var(--color-accent)] underline hover:text-[var(--color-accent-hover)] transition-colors"
                          >
                            重新尝试
                          </button>
                        </div>
                      )}
                    </>
                  ) : status === 'error' ? (
                    <div className="py-8 text-center">
                      <p className="text-[0.9rem] text-[var(--color-error)] font-medium">批改失败</p>
                      <p className="text-[0.85rem] text-[var(--color-text-muted)] mt-1.5">{error}</p>
                      <button
                        type="button"
                        onClick={handleSubmit}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-[0.85rem] font-medium text-white bg-[var(--color-accent)] rounded-md hover:bg-[var(--color-accent-hover)] transition-colors"
                      >
                        重新尝试
                      </button>
                    </div>
                  ) : (
                    <div className="py-8">
                      <LoadingDots />
                      <p className="text-[0.85rem] text-[var(--color-text-muted)] mt-3">
                        {isThinking ? '模型正在阅读题目和知识库，组织诊断思路...' : '正在生成诊断报告...'}
                      </p>
                      <p className="text-[0.75rem] text-[var(--color-text-muted)] mt-1 opacity-60">
                        知识库较大，首次分析通常需要 30-60 秒，请耐心等待
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Reference Answer Section */}
              {status === 'done' && (
                <div className="mt-6">
                  {refStatus === 'idle' ? (
                    <button
                      type="button"
                      onClick={handleGenerateReference}
                      className="w-full py-3.5 rounded-lg font-medium text-[0.95rem] bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] hover:shadow-md transition-all duration-200"
                    >
                      生成参考答案
                    </button>
                  ) : (
                    <div
                      className="bg-[var(--bg-report)] border border-[var(--color-border)] rounded-lg overflow-hidden"
                      style={{ animation: 'grader-fade-in 0.4s ease-out' }}
                    >
                      <div className="flex items-center gap-2 px-6 py-3.5 border-b border-[var(--color-border)] bg-[rgba(199,62,58,0.03)]">
                        <DocumentIcon className="w-4 h-4 text-[var(--color-accent)]" />
                        <span className="font-[var(--font-serif)] text-[0.95rem] font-semibold text-[var(--color-accent)]">
                          参考答案
                        </span>
                        {refStatus === 'streaming' && (
                          <span className="ml-auto flex items-center gap-1.5 text-[0.75rem] text-[var(--color-text-muted)]">
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]"
                              style={{ animation: 'grader-breathe 1.5s ease-in-out infinite' }}
                            />
                            生成中
                          </span>
                        )}
                        {refStatus === 'done' && (
                          <span className="ml-auto flex items-center gap-1.5 text-[0.75rem] text-[var(--color-text-muted)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
                            已完成
                          </span>
                        )}
                        {refStatus === 'error' && (
                          <span className="ml-auto flex items-center gap-1.5 text-[0.75rem] text-[var(--color-text-muted)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-error)]" />
                            出错
                          </span>
                        )}
                      </div>
                      <div className="px-6 py-5 md-table break-words text-[var(--color-text)]">
                        {reference ? (
                          <>
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                              {reference}
                            </ReactMarkdown>
                            {refStatus === 'streaming' && <StreamingCursor />}
                            {refStatus === 'error' && (
                              <div className="mt-4 p-3 bg-[rgba(199,62,58,0.05)] border border-[rgba(199,62,58,0.15)] rounded-md">
                                <p className="text-[0.8rem] text-[var(--color-error)]">
                                  参考答案生成中断: {refError}
                                </p>
                                <button
                                  type="button"
                                  onClick={handleGenerateReference}
                                  className="mt-2 text-[0.8rem] text-[var(--color-accent)] underline hover:text-[var(--color-accent-hover)] transition-colors"
                                >
                                  重新尝试
                                </button>
                              </div>
                            )}
                          </>
                        ) : refStatus === 'error' ? (
                          <div className="py-8 text-center">
                            <p className="text-[0.9rem] text-[var(--color-error)] font-medium">生成失败</p>
                            <p className="text-[0.85rem] text-[var(--color-text-muted)] mt-1.5">{refError}</p>
                            <button
                              type="button"
                              onClick={handleGenerateReference}
                              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-[0.85rem] font-medium text-white bg-[var(--color-accent)] rounded-md hover:bg-[var(--color-accent-hover)] transition-colors"
                            >
                              重新尝试
                            </button>
                          </div>
                        ) : (
                          <div className="py-8">
                            <LoadingDots />
                            <p className="text-[0.85rem] text-[var(--color-text-muted)] mt-3">
                              正在生成参考答案...
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Back button */}
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-[0.9rem] font-medium text-[var(--color-primary)] border border-[var(--color-border)] rounded-md hover:bg-[var(--bg-surface)] hover:border-[var(--color-border-strong)] transition-all"
                >
                  <ArrowLeftIcon className="w-4 h-4" />
                  返回修改
                </button>
              </div>
            </div>
          )}

          {/* Footer */}
          {/* <footer className="mt-16 pt-8 border-t border-[var(--color-border)] text-center">
            <p className="text-[0.8rem] text-[var(--color-text-muted)] leading-relaxed">
              本工具基于 AI 模型生成诊断建议，仅供参考 · 请结合专业教师指导使用
            </p>
          </footer> */}
        </main>
      </div>
    </>
  );
}
