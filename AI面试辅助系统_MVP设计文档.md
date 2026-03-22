# AI 面试辅助系统 — MVP 技术设计文档

> 本文档用于指导 Claude Code 实现完整的 MVP 版本。请严格按照本文档描述的架构、接口协议和文件结构进行开发。

---

## 1. 产品概述

### 1.1 目标

构建一个实时面试辅助系统：在线面试过程中，实时捕获面试官语音 → 转为文字 → 智能识别面试问题 → 调用 LLM 生成参考答案 → 流式展示给用户。

### 1.2 MVP 核心功能

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 实时语音转写 | 浏览器采集麦克风/系统音频，实时转为文字 | P0 |
| 问题检测 | 从转写文本中自动识别面试官提出的问题 | P0 |
| AI 答案生成 | 调用 LLM 流式生成参考答案 | P0 |
| 手动输入模式 | 用户手动粘贴/输入问题，获取答案（ASR 备用方案） | P0 |
| 简历上下文 | 上传简历后答案基于简历内容个性化 | P1 |
| 面试记录 | 自动保存面试转写记录和问答历史 | P1 |

### 1.3 不在 MVP 范围内

- 桌面客户端（Electron）
- 双端互联（PC ↔ 手机）
- 笔试辅助（截图 OCR）
- 说话人分离（Speaker Diarization）
- 用户注册/付费系统

---

## 2. 技术栈

| 层级 | 技术选型 | 理由 |
|------|----------|------|
| 后端框架 | Python 3.11+ / FastAPI | 异步性能强，AI 生态最好，WebSocket 原生支持 |
| 语音识别 | FunASR (SenseVoiceSmall) | 免费开源、中英文准确率高、支持流式、CPU 可跑 |
| LLM | DeepSeek API (deepseek-chat) | 性价比最高（约 ¥1/百万 token），OpenAI 兼容协议，后续可无缝切换为 GPT-4o / Claude |
| 前端框架 | Next.js 14 (App Router) + React 18 | 最主流、SSR 支持、组件生态丰富 |
| UI 样式 | Tailwind CSS + shadcn/ui | 精美交互、组件即装即用 |
| 状态管理 | Zustand | 轻量、适合 WebSocket 流式状态 |
| 数据库 | SQLite (MVP) → PostgreSQL (production) | MVP 零配置，后续迁移成本低 |
| 部署 | Docker Compose | 一键启动前后端 + 依赖 |

---

## 3. 系统架构

### 3.1 整体数据流

```
[浏览器麦克风] 
    │ 
    │  MediaRecorder API (16kHz PCM / WebM)
    ▼
[前端 AudioCapture 组件]
    │
    │  WebSocket (binary audio chunks, 每 500ms 一帧)
    ▼
[后端 /ws/audio endpoint]
    │
    ├──→ [ASR Service] ──→ 实时转写文本
    │         │
    │         ▼
    │    [Question Detector] ──→ 判断是否为面试问题
    │         │
    │         ▼ (如果是问题)
    │    [LLM Service] ──→ 流式生成答案 (SSE)
    │         │
    │         ▼
    │    WebSocket JSON 消息推回前端
    ▼
[前端 UI: 转写面板 + 答案面板]
```

### 3.2 备用链路（手动输入模式）

```
[用户手动输入问题文本]
    │
    │  HTTP POST /api/chat/ask
    ▼
[后端 Chat Router]
    │
    ├──→ [LLM Service] ──→ SSE 流式响应
    ▼
[前端 AnswerPanel 流式展示]
```

---

## 4. 项目目录结构

```
interview-copilot/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI 入口，挂载路由和中间件
│   │   ├── config.py            # pydantic-settings 配置，从 .env 读取
│   │   └── database.py          # SQLite/SQLAlchemy 连接（P1 阶段）
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── ws_audio.py          # WebSocket 实时音频流处理（核心）
│   │   ├── chat.py              # HTTP 手动提问 + SSE 响应
│   │   └── resume.py            # 简历上传和解析
│   ├── services/
│   │   ├── __init__.py
│   │   ├── asr_service.py       # ASR 抽象层（FunASR / Whisper 可切换）
│   │   ├── question_detector.py # 面试问题识别
│   │   └── llm_service.py       # LLM 调用抽象层（DeepSeek，OpenAI 兼容）
│   ├── prompts/
│   │   ├── answer_system.txt    # 答案生成的 system prompt
│   │   └── question_detect.txt  # 问题检测的 prompt
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx       # 根布局，全局样式和字体
│   │   │   ├── page.tsx         # 主面试辅助页面
│   │   │   └── globals.css      # Tailwind + 自定义变量
│   │   ├── components/
│   │   │   ├── AudioCapture.tsx     # 麦克风采集 + 音频流控制
│   │   │   ├── TranscriptPanel.tsx  # 实时转写文本展示面板
│   │   │   ├── AnswerPanel.tsx      # AI 答案流式展示面板
│   │   │   ├── ManualInput.tsx      # 手动输入问题的输入框
│   │   │   ├── ResumeUpload.tsx     # 简历上传组件
│   │   │   ├── StatusBar.tsx        # 连接状态 + 录音状态指示
│   │   │   └── QuestionCard.tsx     # 单个问题+答案卡片
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts      # WebSocket 连接管理 hook
│   │   │   └── useAudioStream.ts    # 浏览器音频采集 hook
│   │   ├── stores/
│   │   │   └── interviewStore.ts    # Zustand 全局状态
│   │   └── lib/
│   │       ├── types.ts             # TypeScript 类型定义
│   │       └── utils.ts             # 工具函数
│   ├── public/
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── next.config.js
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
├── Makefile                     # 常用命令快捷入口
└── README.md
```

---

## 5. 后端详细设计

### 5.1 配置 (app/config.py)

使用 `pydantic-settings` 从环境变量读取配置：

```python
class Settings(BaseSettings):
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # ASR
    ASR_PROVIDER: str = "funasr"              # "funasr" | "whisper"
    ASR_MODEL: str = "iic/SenseVoiceSmall"    # FunASR 模型标识
    ASR_DEVICE: str = "cpu"                    # "cpu" | "cuda:0"

    # LLM (OpenAI 兼容协议)
    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = "https://api.deepseek.com"
    LLM_MODEL: str = "deepseek-chat"
    LLM_MAX_TOKENS: int = 2048
    LLM_TEMPERATURE: float = 0.7

    # Upload
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 10

    class Config:
        env_file = ".env"
```

### 5.2 WebSocket 音频流路由 (routers/ws_audio.py)

这是系统的核心路由，处理实时音频流。

**端点**: `ws://host:8000/ws/audio?resume_id=xxx`

**协议**:

客户端发送:
- Binary frames: 音频数据（WebM/Opus 或 16-bit PCM 16kHz mono）
- Text frames: JSON 控制命令
  ```json
  {"command": "set_resume", "resume_text": "..."}
  {"command": "stop_answer", "question_id": "q_xxx"}
  {"command": "ping"}
  ```

服务端发送 (JSON):
```json
{"type": "ready", "message": "Connected. Start speaking."}
{"type": "transcript", "text": "...", "speaker": "interviewer", "is_final": true}
{"type": "question", "text": "请介绍一下你的项目经验", "id": "q_a1b2c3d4"}
{"type": "answer", "question_id": "q_a1b2c3d4", "delta": "好的，", "done": false}
{"type": "answer", "question_id": "q_a1b2c3d4", "delta": "", "done": true}
{"type": "error", "message": "ASR service unavailable"}
```

**实现要点**:
1. 连接建立后初始化 ASR、QuestionDetector、LLM 三个 service 实例
2. 收到 binary frame 后喂给 ASR service，积累约 2 秒音频后进行一次转写
3. 转写结果先推送 `transcript` 消息到前端
4. 对 `is_final=true` 的转写结果调用 QuestionDetector 判断
5. 如果是问题，发送 `question` 消息，然后 `asyncio.create_task` 启动 LLM 流式生成
6. LLM 每产生一个 token 就发送 `answer` 消息（delta 方式，类似 OpenAI streaming）
7. 支持通过 `stop_answer` 命令取消正在生成的答案

### 5.3 手动提问路由 (routers/chat.py)

**端点**: `POST /api/chat/ask`

**请求体**:
```json
{
  "question": "请介绍一下 React 的虚拟 DOM",
  "resume_context": "（可选）简历文本",
  "conversation_history": ["（可选）之前的对话历史"]
}
```

**响应**: SSE (Server-Sent Events) 流式响应
```
data: {"delta": "虚拟", "done": false}
data: {"delta": " DOM ", "done": false}
data: {"delta": "", "done": true}
```

**实现要点**:
1. 使用 `StreamingResponse` 和 `text/event-stream` content type
2. 调用 LLM service 的 `generate_answer` 异步生成器
3. 每个 token 作为一个 SSE event 发送

### 5.4 简历上传路由 (routers/resume.py)

**端点**:
- `POST /api/resume/upload` — 上传简历文件（PDF/DOCX/TXT）
- `GET /api/resume/{resume_id}` — 获取已解析的简历文本

**实现要点**:
1. 接收 `UploadFile`，保存到 `UPLOAD_DIR`
2. PDF 用 `pymupdf` 提取文本，DOCX 用 `python-docx` 提取
3. 返回 `resume_id` 和提取的纯文本摘要
4. 前端拿到 `resume_text` 后通过 WebSocket 的 `set_resume` 命令设置上下文

### 5.5 ASR Service (services/asr_service.py)

**职责**: 将音频二进制数据转为文字。

**接口设计**:
```python
class ASRService:
    def __init__(self, provider: str, model: str, device: str):
        """初始化 ASR 模型"""

    async def process_chunk(self, audio_bytes: bytes) -> list[TranscriptResult]:
        """
        处理一帧音频数据。内部维护缓冲区，积累约 2 秒后批量转写。
        返回 TranscriptResult 列表（可能为空，表示还在积累中）。
        """

    def reset(self):
        """重置内部缓冲区（面试切换时调用）"""

@dataclass
class TranscriptResult:
    text: str           # 转写文本
    is_final: bool      # 是否为完整句子（非中间结果）
    speaker: str        # "interviewer" | "candidate" | "unknown"
    start_time: float   # 音频中的开始时间（秒）
    end_time: float     # 音频中的结束时间（秒）
```

**FunASR 实现细节**:
- 模型: `iic/SenseVoiceSmall` — 中英文混合识别，CPU 可运行
- VAD: `fsmn-vad` — 自动检测语音活动，避免处理静音
- 标点: `ct-punc` — 自动补全标点，便于后续问题检测
- 音频格式: 先尝试直接处理 WebM/Opus（浏览器 MediaRecorder 默认格式），如需转换用 `pydub` 或 `ffmpeg` 转为 16kHz PCM
- 转写使用 `asyncio.to_thread()` 避免阻塞事件循环

**Whisper 备选方案**:
- 模型: `whisper.load_model("base")` — 小模型，CPU 可跑
- 需要音频为 float32 numpy array
- 速度比 FunASR 慢，但英文识别更好

**开发模式 (Mock)**:
- ASR 模型未安装时返回空结果，此时用手动输入模式替代

### 5.6 Question Detector (services/question_detector.py)

**职责**: 判断一段转写文本是否是面试官提出的面试问题。

**接口设计**:
```python
class QuestionDetector:
    async def is_interview_question(
        self,
        text: str,
        speaker: str,
        context: list[str],  # 最近 N 条转写记录
    ) -> bool:
        """判断该文本是否为面试问题"""
```

**实现策略（规则 + LLM 两级）**:

第一级 — 规则快速过滤（<1ms，零成本）:
1. 长度过滤: 少于 5 个字的不处理
2. 问号检测: 包含 `？` 或 `?` 的高概率是问题
3. 疑问词检测: 以「什么」「怎么」「如何」「为什么」「能不能」「请介绍」「请说说」「谈谈」等开头
4. 排除候选人自己的话: 如果 `speaker == "candidate"` 则跳过
5. 排除寒暄: "你好"、"谢谢"、"再见"、"好的" 等

第二级 — LLM 判断（可选，仅对第一级不确定的调用）:
- 用 DeepSeek 的便宜模型快速判断
- Prompt: 给定上下文和当前文本，判断是否为面试问题，输出 yes/no
- 设置 `max_tokens=3` 降低延迟和成本

**推荐 MVP 阶段只用第一级规则**，准确率已经够用（>80%），后续再叠加 LLM。

### 5.7 LLM Service (services/llm_service.py)

**职责**: 调用 LLM 生成面试问题的参考答案。

**接口设计**:
```python
class LLMService:
    def __init__(self):
        """初始化 OpenAI 兼容客户端（指向 DeepSeek）"""

    async def generate_answer(
        self,
        question: str,
        conversation_history: list[str] = [],
        resume_context: str = "",
    ) -> AsyncGenerator[str, None]:
        """
        流式生成答案。每次 yield 一个文本片段（token/chunk）。
        """
```

**实现要点**:
1. 使用 `openai` Python SDK，设置 `base_url` 指向 DeepSeek
2. 使用 `stream=True` 开启流式响应
3. 遍历 `response` 的 chunk，提取 `delta.content` yield 出去
4. Prompt 构建见下方 5.8 节

**初始化示例**:
```python
from openai import AsyncOpenAI

client = AsyncOpenAI(
    api_key=settings.LLM_API_KEY,
    base_url=settings.LLM_BASE_URL,
)
```

**流式调用示例**:
```python
stream = await client.chat.completions.create(
    model=settings.LLM_MODEL,
    messages=messages,
    max_tokens=settings.LLM_MAX_TOKENS,
    temperature=settings.LLM_TEMPERATURE,
    stream=True,
)
async for chunk in stream:
    delta = chunk.choices[0].delta.content
    if delta:
        yield delta
```

**切换 LLM 提供商**: 只需修改 `.env` 中的三个变量:
- `LLM_BASE_URL=https://api.openai.com/v1` + `LLM_MODEL=gpt-4o` → 切换到 OpenAI
- `LLM_BASE_URL=https://api.anthropic.com` → 需要适配 Anthropic SDK（非 OpenAI 兼容）

### 5.8 Prompt 设计

#### 答案生成 System Prompt (prompts/answer_system.txt)

```
你是一位资深的面试辅导专家。你的任务是帮助候选人在面试中给出专业、有条理的回答。

## 角色设定
- 你在帮助候选人准备面试回答，不是在直接面试
- 回答应该自然流畅，像候选人自己说出来的，不要有"作为AI"这样的前缀
- 回答长度适中，口语化，1-3 分钟能说完（约 200-400 字）

## 回答原则
1. **结构清晰**: 使用 STAR 法则（Situation-Task-Action-Result）回答行为面试题
2. **技术准确**: 技术问题给出准确答案，必要时举例说明
3. **个性化**: 如果提供了简历上下文，结合候选人的真实经历来回答
4. **口语化**: 用第一人称，避免书面语和列表格式，像在跟面试官对话

## 格式要求
- 不要使用 Markdown 格式（加粗、列表等）
- 用自然段落，不要编号
- 开头直接回答，不要说"好的"、"这是个好问题"
- 如果是技术题，可以先说思路再给答案

## 上下文使用
- 如果有简历上下文，自然融入回答中引用具体项目和数据
- 如果有对话历史，避免重复之前说过的内容
- 如果问题模糊，给出最可能的解读并回答
```

#### 问题检测 Prompt (prompts/question_detect.txt)

```
判断以下文本是否为面试官提出的面试问题。

上下文（最近的对话）:
{context}

当前文本:
{text}

只回答 yes 或 no。
```

### 5.9 依赖 (requirements.txt)

```
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
python-multipart>=0.0.9
pydantic-settings>=2.4.0
openai>=1.40.0
websockets>=12.0
python-docx>=1.1.0
pymupdf>=1.24.0
pydub>=0.25.1
numpy>=1.26.0
aiofiles>=24.1.0

# ASR (按需安装，非必须)
# pip install funasr modelscope    # FunASR + SenseVoice
# pip install openai-whisper        # Whisper
```

---

## 6. 前端详细设计

### 6.1 页面布局

主页面采用三栏布局:

```
┌─────────────────────────────────────────────────────────┐
│  StatusBar: 连接状态 | 录音状态 | 简历状态              │
├───────────┬─────────────────────┬───────────────────────┤
│           │                     │                       │
│  Sidebar  │   TranscriptPanel   │    AnswerPanel        │
│           │                     │                       │
│  简历上传  │   实时转写文本       │    AI 生成的答案       │
│  设置      │   面试官/候选人区分  │    按问题分卡片展示    │
│  面试记录  │   问题高亮标记       │    流式打字机效果      │
│           │                     │    一键复制            │
│           │                     │                       │
├───────────┴─────────────────────┴───────────────────────┤
│  ManualInput: 手动输入问题（ASR 备用方案）               │
└─────────────────────────────────────────────────────────┘
```

**响应式设计**:
- 桌面 (≥1280px): 三栏 — sidebar 240px + transcript 1fr + answer 1fr
- 平板 (768-1279px): 两栏 — transcript + answer 并排，sidebar 折叠为 drawer
- 手机 (<768px): 单栏 + tab 切换 transcript/answer

### 6.2 核心组件设计

#### AudioCapture.tsx

```typescript
interface AudioCaptureProps {
  onStatusChange: (status: 'idle' | 'recording' | 'paused' | 'error') => void;
  wsRef: React.RefObject<WebSocket | null>;  // 共享 WebSocket 引用
}
```

**实现要点**:
- 使用 `navigator.mediaDevices.getUserMedia({ audio: true })` 获取麦克风权限
- 使用 `MediaRecorder` API 录音，`timeslice=500` 每 500ms 产生一个 `ondataavailable` 事件
- 录音格式: 优先 `audio/webm;codecs=opus`（体积小），后端做解码
- 每个 `Blob` 通过 WebSocket 以 binary frame 发送
- 提供「开始录音」「暂停」「停止」三个按钮
- 显示录音时长计时器和音量指示器（使用 `AnalyserNode`）
- 发生错误（如权限拒绝）时展示友好提示

#### TranscriptPanel.tsx

```typescript
interface TranscriptEntry {
  id: string;
  text: string;
  speaker: 'interviewer' | 'candidate' | 'unknown';
  isQuestion: boolean;    // 是否被标记为面试问题
  questionId?: string;    // 关联的问题 ID
  timestamp: Date;
  isFinal: boolean;
}
```

**实现要点**:
- 自动滚动到底部（新消息时），但用户手动滚动时暂停自动滚动
- 面试官的话和候选人的话用不同颜色区分
- 被识别为问题的条目加高亮边框和标记
- 点击问题条目可以跳转到对应的答案卡片
- `isFinal=false` 的中间结果用较浅颜色显示，`true` 时替换为最终文本

#### AnswerPanel.tsx

```typescript
interface AnswerEntry {
  questionId: string;
  questionText: string;
  answerText: string;      // 累积的完整答案
  isGenerating: boolean;   // 是否正在生成中
  timestamp: Date;
}
```

**实现要点**:
- 每个问题+答案渲染为一个 `QuestionCard` 组件
- 答案部分使用打字机效果（逐字显示，CSS animation 光标闪烁）
- 正在生成的卡片显示在最上方，已完成的按时间倒序排列
- 每个卡片有「复制答案」「停止生成」「重新生成」按钮
- 卡片支持折叠/展开

#### ManualInput.tsx

**实现要点**:
- 底部固定的输入框，类似聊天输入
- Enter 发送，Shift+Enter 换行
- 发送后调用 `POST /api/chat/ask`（SSE 流式响应）
- 或通过 WebSocket 发送文本命令让后端处理
- 显示「正在思考...」加载状态

#### ResumeUpload.tsx

**实现要点**:
- 支持拖拽上传和点击选择文件
- 接受 PDF、DOCX、TXT 格式，最大 10MB
- 上传成功后显示简历摘要预览（前 200 字）
- 上传后自动通过 WebSocket 发送 `set_resume` 命令

### 6.3 自定义 Hooks

#### useWebSocket.ts

```typescript
interface UseWebSocketOptions {
  url: string;
  resumeId?: string;
  onTranscript: (data: TranscriptMessage) => void;
  onQuestion: (data: QuestionMessage) => void;
  onAnswerDelta: (data: AnswerMessage) => void;
  onError: (data: ErrorMessage) => void;
}

interface UseWebSocketReturn {
  wsRef: React.RefObject<WebSocket | null>;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  sendAudio: (blob: Blob) => void;
  sendCommand: (cmd: object) => void;
  reconnect: () => void;
}
```

**实现要点**:
- 自动重连: 断线后 exponential backoff 重试（1s, 2s, 4s, max 30s）
- 心跳检测: 每 30 秒发送 ping，超时未收到 pong 则重连
- 收到 JSON 消息后根据 `type` 字段分发到不同回调
- 组件卸载时自动关闭连接

#### useAudioStream.ts

```typescript
interface UseAudioStreamReturn {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  audioLevel: number;           // 0-100 音量级别
  duration: number;             // 录音时长（秒）
  error: string | null;
}
```

**实现要点**:
- 封装 `getUserMedia` + `MediaRecorder` 逻辑
- 使用 `AudioContext` + `AnalyserNode` 实时计算音量级别
- 用 `requestAnimationFrame` 更新 `audioLevel` 状态
- 清理函数中释放所有音频资源

### 6.4 全局状态 (stores/interviewStore.ts)

```typescript
interface InterviewState {
  // Connection
  wsStatus: 'connecting' | 'connected' | 'disconnected' | 'error';

  // Recording
  isRecording: boolean;
  recordingDuration: number;

  // Transcript
  transcripts: TranscriptEntry[];
  addTranscript: (entry: TranscriptEntry) => void;
  updateTranscript: (id: string, updates: Partial<TranscriptEntry>) => void;

  // Q&A
  questions: AnswerEntry[];
  addQuestion: (entry: AnswerEntry) => void;
  appendAnswerDelta: (questionId: string, delta: string) => void;
  markAnswerDone: (questionId: string) => void;

  // Resume
  resumeText: string | null;
  resumeFileName: string | null;
  setResume: (text: string, fileName: string) => void;

  // Settings
  inputMode: 'audio' | 'manual';
  setInputMode: (mode: 'audio' | 'manual') => void;

  // Actions
  clearSession: () => void;
}
```

### 6.5 TypeScript 类型定义 (lib/types.ts)

```typescript
// WebSocket 消息类型
interface TranscriptMessage {
  type: 'transcript';
  text: string;
  speaker: 'interviewer' | 'candidate' | 'unknown';
  is_final: boolean;
}

interface QuestionMessage {
  type: 'question';
  text: string;
  id: string;
}

interface AnswerMessage {
  type: 'answer';
  question_id: string;
  delta: string;
  done: boolean;
}

interface ErrorMessage {
  type: 'error';
  message: string;
}

type WSMessage = TranscriptMessage | QuestionMessage | AnswerMessage | ErrorMessage;

// API 类型
interface AskRequest {
  question: string;
  resume_context?: string;
  conversation_history?: string[];
}

interface ResumeUploadResponse {
  resume_id: string;
  file_name: string;
  text_preview: string;
  full_text: string;
}
```

### 6.6 前端依赖 (package.json 关键依赖)

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "zustand": "^4.5.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.5.0",
    "lucide-react": "^0.400.0",
    "sonner": "^1.5.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "tailwindcss": "^3.4.0",
    "@types/react": "^18.3.0",
    "@types/node": "^20.14.0"
  }
}
```

**shadcn/ui 组件（按需安装）**:
```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card input textarea scroll-area badge tooltip dropdown-menu sheet
```

---

## 7. UI 设计规范

### 7.1 视觉风格

- **整体调性**: 专业、沉稳、科技感。深色主题为主（减少面试时屏幕反光），可切换浅色
- **字体**: `"Inter", "Noto Sans SC", system-ui, sans-serif` — Inter 英文 + 思源黑体中文
- **主色**: `#6366F1` (Indigo-500) — 品牌色，用于按钮和高亮
- **配色方案 (暗色)**:
  - 背景: `#0F0F14` (最深) / `#1A1A24` (卡片) / `#252530` (输入框)
  - 文字: `#F0F0F5` (主要) / `#9A9AB0` (次要) / `#5A5A72` (占位)
  - 面试官文字: `#93C5FD` (蓝色调)
  - 候选人文字: `#A5B4FC` (紫色调)
  - 问题高亮: `#6366F1` 左侧竖线 + `rgba(99,102,241,0.08)` 背景
  - 成功/正在生成: `#34D399` 呼吸灯效果
  - 错误: `#F87171`

### 7.2 动效要求

- 答案流式输出: 打字机效果，光标闪烁 `animation: blink 1s step-end infinite`
- 新问题出现: `fadeInUp` 动画 (opacity 0→1, translateY 12px→0, 300ms ease-out)
- 录音状态: 红色圆点脉冲 `animation: pulse 2s cubic-bezier(0.4,0,0.6,1) infinite`
- 音量指示器: 5 个竖条，高度随音量变化，transition 100ms
- 页面切换/面板展开: 200ms ease 过渡

### 7.3 交互细节

- 所有按钮有 hover 态（亮度提升 10%）和 active 态（缩放 0.97）
- 复制按钮点击后变为对勾图标 2 秒后恢复
- WebSocket 断连时显示顶部通知条 + 自动重连倒计时
- 长答案支持展开/折叠，默认显示前 6 行
- 键盘快捷键: `Space` 切换录音状态，`Esc` 停止当前答案生成

---

## 8. Docker 部署

### 8.1 docker-compose.yml

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file:
      - .env
    volumes:
      - ./backend/uploads:/app/uploads
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
      - NEXT_PUBLIC_API_URL=http://localhost:8000/api
    depends_on:
      backend:
        condition: service_healthy
```

### 8.2 后端 Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# System dependencies for audio processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 8.3 前端 Dockerfile

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
```

### 8.4 .env.example

```bash
# Backend
DEBUG=true

# ASR
ASR_PROVIDER=funasr
ASR_MODEL=iic/SenseVoiceSmall
ASR_DEVICE=cpu

# LLM — DeepSeek (default, cheapest)
LLM_API_KEY=sk-your-deepseek-api-key
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
LLM_MAX_TOKENS=2048
LLM_TEMPERATURE=0.7

# LLM — OpenAI (uncomment to switch)
# LLM_API_KEY=sk-your-openai-key
# LLM_BASE_URL=https://api.openai.com/v1
# LLM_MODEL=gpt-4o

# LLM — 通义千问 (uncomment to switch)
# LLM_API_KEY=sk-your-dashscope-key
# LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
# LLM_MODEL=qwen-turbo
```

---

## 9. 开发计划和里程碑

### Week 1: 后端骨架 + 手动输入模式

- [ ] 初始化 FastAPI 项目，配置 CORS、路由
- [ ] 实现 LLM Service（DeepSeek 流式调用）
- [ ] 实现 `POST /api/chat/ask` SSE 端点
- [ ] 实现 Question Detector（规则版）
- [ ] 编写 Prompt 模板
- [ ] 编写 unit tests（LLM service mock）

### Week 2: 前端骨架 + 手动模式对接

- [ ] 初始化 Next.js 项目 + Tailwind + shadcn/ui
- [ ] 实现页面布局（三栏 + 响应式）
- [ ] 实现 ManualInput + AnswerPanel 组件
- [ ] 对接 `/api/chat/ask` SSE 流式展示
- [ ] 实现 Zustand store
- [ ] 暗色主题 + 基础动效

### Week 3: WebSocket + 语音识别

- [ ] 实现 WebSocket 路由 `/ws/audio`
- [ ] 实现 ASR Service（FunASR 接入）
- [ ] 实现前端 `useAudioStream` hook
- [ ] 实现前端 `useWebSocket` hook
- [ ] 实现 AudioCapture 组件 + 音量指示器
- [ ] 实现 TranscriptPanel 实时转写展示
- [ ] 串联完整链路: 录音 → 转写 → 检测 → 答案

### Week 4: 简历功能 + 打磨 + 部署

- [ ] 实现简历上传和解析
- [ ] 答案个性化（结合简历上下文）
- [ ] UI 精细打磨（动效、快捷键、错误处理）
- [ ] Docker Compose 编排
- [ ] 编写 README
- [ ] 端到端测试

---

## 10. 关键风险和应对

| 风险 | 影响 | 应对方案 |
|------|------|----------|
| FunASR 模型下载慢/大 | 首次启动耗时长 | Docker 镜像中预装模型；提供 mock 模式 |
| 浏览器无法采集系统音频 | 只能采集麦克风 | 引导用户外放面试音频；后续开发 Electron 客户端 |
| LLM 答案生成延迟 > 3 秒 | 用户体验差 | 流式输出弥补体感延迟；先返回答案框架再展开 |
| 语音识别不准确 | 问题检测失败 | 提供手动输入作为备用；允许用户编辑转写文本 |
| DeepSeek API 不稳定 | 答案生成中断 | LLM 层做 retry + fallback 到备选模型 |

---

## 11. 给 Claude Code 的实现指导

### 启动命令

```bash
# 请按以下顺序实现：

# 1. 先搭建后端，跑通 /health 和 /api/chat/ask
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload

# 2. 再搭建前端，跑通手动输入模式
cd frontend && npm install && npm run dev

# 3. 接入 WebSocket + ASR
# 4. 最后做 Docker 化
```

### 代码风格要求

- Python: 使用 type hints，async/await，dataclass
- TypeScript: strict mode，interface 优先于 type
- 组件: 函数组件 + hooks，不用 class 组件
- 文件命名: Python 用 snake_case，TypeScript 用 PascalCase (组件) / camelCase (工具)
- 错误处理: 所有外部调用（API、WebSocket、音频）都要 try-catch 并给用户友好提示
- 注释: 关键逻辑和非显而易见的设计决策需要注释

### 测试策略

- 后端: pytest + httpx (async tests)，mock ASR 和 LLM
- 前端: 暂不写自动化测试，手动验证为主
- 端到端: 手动走通「打开页面 → 录音 → 看到转写 → 看到答案」全链路
