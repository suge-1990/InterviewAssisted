# AI 面试辅助系统

实时语音转写 + 智能问题识别 + AI 参考答案生成的面试辅助工具。支持微信、钉钉、飞书等主流面试软件的线上面试场景。

## 系统能力

### 核心功能

| 功能 | 描述 | 状态 |
|------|------|------|
| 实时语音转写 | 采集麦克风/系统音频，faster-whisper (small) 实时转文字 | ✅ |
| 双通道音频采集 | 麦克风采集候选人语音，系统音频采集面试官语音（通过屏幕共享） | ✅ |
| 说话人区分 | 自动区分面试官和候选人的发言 | ✅ |
| 问题检测 | 规则引擎自动识别面试官提出的问题（支持 30+ 种问句模式） | ✅ |
| AI 答案生成 | 调用 LLM 流式生成参考答案（支持 DeepSeek / GPT-4o / 通义千问） | ✅ |
| 并发追问处理 | 面试官追问时，多个答案并行生成互不阻塞 | ✅ |
| 手动输入模式 | 用户手动输入问题获取答案（ASR 备用方案） | ✅ |
| 简历上传与解析 | 上传 PDF/DOCX/TXT 简历，LLM 结构化解析，答案个性化 | ✅ |
| 知识库管理 | 预设 Q&A 对，面试时优先匹配知识库零延迟返回 | ✅ |
| 面试题库 | 40+ 道内置高频面试题（前端/后端/行为），支持搜索和筛选 | ✅ |
| 面试复盘报告 | 面试结束后 LLM 自动生成表现分析报告 | ✅ |
| 笔试辅助 | 粘贴题目文本/截图，AI 解题（支持编程题） | ✅ |
| 移动端副屏 | 手机扫码查看答案（WebSocket 实时同步） | ✅ |

### 支持的面试场景

| 场景 | 方式 |
|------|------|
| 微信/钉钉/飞书视频面试 | 录音时选择共享面试软件窗口音频 |
| 线下面试（外放音频） | 麦克风同时采集面试官和自己的声音 |
| 电话面试 | 手机外放 + 电脑麦克风采集 |
| 纯文字交流 | 手动输入模式，直接粘贴问题 |

### 技术亮点

- **滑动窗口 ASR**：取最近 8 秒音频完整转写，避免断句错误
- **幻觉过滤**：自动去除 Whisper 模型常见幻觉文本（"发言人"、"字幕by" 等）
- **流式输出**：SSE / WebSocket 流式推送答案，打字机效果实时显示
- **LLM 可切换**：修改 `.env` 即可切换 DeepSeek / OpenAI / 通义千问等
- **暗色主题 UI**：专业暗色界面，面试时减少屏幕反光

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python 3.11+ / FastAPI / WebSocket |
| 语音识别 | faster-whisper (small model) / ffmpeg |
| LLM | OpenAI 兼容协议（DeepSeek / GPT-4o / 通义千问） |
| 前端 | Next.js 14 / React 18 / TypeScript |
| UI | Tailwind CSS / shadcn/ui / Lucide Icons |
| 状态管理 | Zustand |
| 数据库 | SQLite (SQLAlchemy) |
| 部署 | Docker Compose |

## 项目结构

```
InterviewAssisted/
├── backend/
│   ├── app/                    # FastAPI 应用配置
│   │   ├── main.py             # 入口，挂载路由和中间件
│   │   ├── config.py           # 环境变量配置
│   │   └── database.py         # SQLAlchemy 数据库连接
│   ├── routers/                # API 路由
│   │   ├── ws_audio.py         # WebSocket 实时音频流（核心）
│   │   ├── ws_viewer.py        # 移动端只读 WebSocket
│   │   ├── chat.py             # 手动提问 SSE 接口
│   │   ├── resume.py           # 简历上传与解析
│   │   ├── knowledge.py        # 知识库 CRUD
│   │   ├── questions.py        # 题库搜索
│   │   └── interviews.py       # 面试记录与报告
│   ├── services/               # 业务逻辑层
│   │   ├── asr_service.py      # 语音识别（双通道 + 滑动窗口）
│   │   ├── llm_service.py      # LLM 调用（流式）
│   │   ├── question_detector.py # 问题检测（规则引擎）
│   │   ├── resume_parser.py    # 简历结构化解析
│   │   ├── knowledge_base.py   # 知识库匹配
│   │   ├── question_bank.py    # 题库服务
│   │   ├── report_service.py   # 复盘报告生成
│   │   └── session_manager.py  # 面试 Session 管理
│   ├── models/                 # 数据模型
│   ├── prompts/                # LLM Prompt 模板
│   ├── data/questions/         # 内置题库（JSON）
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/app/
│   │   ├── (main)/page.tsx     # 面试辅助主页
│   │   ├── (main)/knowledge/   # 知识库管理
│   │   ├── (main)/practice/    # 题库练习
│   │   ├── (main)/history/     # 面试记录 + 复盘报告
│   │   ├── (main)/exam/        # 笔试辅助
│   │   └── mobile/             # 移动端副屏
│   ├── src/components/         # UI 组件
│   ├── src/hooks/              # 自定义 Hooks
│   ├── src/stores/             # Zustand 状态管理
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── Makefile
└── .env.example
```

## 快速开始

### 环境要求

- Python 3.11+
- Node.js 20+
- ffmpeg（`brew install ffmpeg`）

### 1. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，填入 LLM API Key
```

支持的 LLM 配置：

```bash
# DeepSeek（默认，最便宜）
LLM_API_KEY=sk-your-deepseek-key
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat

# OpenAI
LLM_API_KEY=sk-your-openai-key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o

# 通义千问
LLM_API_KEY=sk-your-dashscope-key
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
LLM_MODEL=qwen-turbo
```

### 2. 启动后端

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

首次启动会自动下载 whisper small 模型（约 500MB）。

### 3. 启动前端

```bash
cd frontend
npm install
npm run dev
```

### 4. 使用

浏览器打开 http://localhost:3000

### Docker 一键启动

```bash
docker-compose up --build
```

## 使用指南

### 线上面试（微信/钉钉/飞书）

1. 打开面试软件，开始视频面试
2. 打开 http://localhost:3000，点击「录音」按钮
3. 弹出屏幕共享框时，**选择面试软件窗口**并**勾选「共享音频」**
4. 面试官说话 → 自动转写 → 检测到问题 → AI 生成参考答案
5. 状态栏显示「系统音频已采集」表示面试官声音正在被捕获

### 手动输入模式

底部输入框直接输入面试问题，回车发送，AI 流式输出答案。

### 知识库

访问「知识库」页面，预设常见问题的标准答案。面试时系统优先匹配知识库，命中则零延迟返回。

### 题库练习

访问「题库练习」页面，按分类/岗位/难度筛选题目，展开查看参考答案和追问。

### 笔试辅助

访问「笔试辅助」页面，粘贴题目文本（支持 Ctrl+V 粘贴截图），AI 解答。

### 移动端副屏

PC 端面试时，手机打开 `/mobile?session=xxx` 页面，实时同步显示 AI 答案。

## API 文档

后端启动后访问 http://localhost:8000/docs 查看完整 API 文档。

主要端点：

| 端点 | 方法 | 描述 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/ws/audio` | WebSocket | 实时音频流（核心） |
| `/ws/viewer` | WebSocket | 移动端只读 |
| `/api/chat/ask` | POST | 手动提问（SSE） |
| `/api/resume/upload` | POST | 简历上传 |
| `/api/resume/{id}/parsed` | GET | 获取结构化简历 |
| `/api/knowledge/` | CRUD | 知识库管理 |
| `/api/questions/search` | GET | 题库搜索 |
| `/api/interviews/` | CRUD | 面试记录 |
| `/api/interviews/{id}/report` | GET | 复盘报告 |

## 前端页面

| 路径 | 功能 |
|------|------|
| `/` | 面试辅助主页（语音转写 + AI 答案） |
| `/knowledge` | 知识库管理（增删改查） |
| `/practice` | 题库练习（筛选、搜索、参考答案） |
| `/history` | 面试记录列表 |
| `/history/[id]` | 复盘报告详情 |
| `/exam` | 笔试辅助（粘贴题目、AI 解题） |
| `/mobile` | 移动端副屏（只读答案） |
