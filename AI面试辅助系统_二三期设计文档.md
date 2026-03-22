# AI 面试辅助系统 — 第二期 & 第三期 技术设计文档

> 本文档承接 MVP（第一期）设计文档，定义后续两个迭代的完整技术方案。
> 请在 MVP 代码基础上按本文档增量实现。

---

# 第二期：增强体验（MVP 完成后 4-6 周）

## 1. 第二期功能总览

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 简历深度解析 | 结构化提取简历信息，构建个人知识图谱 | P0 |
| 面试题库 | 分行业/岗位的高频面试题 + 标准答案 | P0 |
| 知识库模式 | 用户预设 Q&A 对，面试时智能匹配 | P0 |
| 说话人分离 | 区分面试官和候选人语音 | P1 |
| 移动端适配 | 手机/Pad 浏览器可查看答案 | P1 |
| 面试复盘报告 | 面试结束后生成表现分析报告 | P1 |
| 多语言支持 | 英文面试识别 + 英文答案生成 | P2 |

---

## 2. 简历深度解析

### 2.1 目标

MVP 阶段仅提取简历纯文本作为 LLM 上下文。第二期需要结构化解析简历，构建候选人知识图谱，让答案生成更精准、更个性化。

### 2.2 新增目录结构

```
backend/
├── services/
│   ├── resume_parser.py         # 简历结构化解析服务（新增）
│   └── knowledge_graph.py       # 个人知识图谱构建（新增）
├── models/
│   ├── __init__.py
│   ├── resume.py                # 简历数据模型（新增）
│   └── interview.py             # 面试记录数据模型（新增）
├── prompts/
│   ├── resume_parse.txt         # 简历解析 prompt（新增）
│   └── answer_with_resume.txt   # 基于简历的答案 prompt（升级）
```

### 2.3 简历数据模型 (models/resume.py)

```python
from dataclasses import dataclass, field
from datetime import date

@dataclass
class WorkExperience:
    company: str
    title: str
    start_date: str              # "2022-06" 格式
    end_date: str                # "2024-03" 或 "至今"
    description: str             # 原始描述
    key_achievements: list[str]  # 提取的关键成果（带数据）
    tech_stack: list[str]        # 使用的技术栈
    industry: str                # 所属行业

@dataclass
class Project:
    name: str
    role: str                    # 在项目中的角色
    description: str
    tech_stack: list[str]
    highlights: list[str]        # 亮点/成果
    duration: str
    team_size: int | None = None

@dataclass
class Education:
    school: str
    degree: str                  # "本科" | "硕士" | "博士" | "MBA"
    major: str
    graduation_year: str
    gpa: str | None = None
    highlights: list[str] = field(default_factory=list)

@dataclass
class ParsedResume:
    raw_text: str                # 原始文本
    name: str
    phone: str | None
    email: str | None
    target_position: str | None  # 求职意向
    summary: str                 # 个人简介/自我评价
    skills: list[str]            # 技能标签列表
    work_experiences: list[WorkExperience]
    projects: list[Project]
    education: list[Education]
    languages: list[str]         # 语言能力
    certifications: list[str]    # 证书
    
    def to_context_string(self) -> str:
        """生成用于 LLM 上下文的结构化文本"""
        
    def get_relevant_context(self, question: str) -> str:
        """根据问题返回最相关的简历片段"""
```

### 2.4 简历解析服务 (services/resume_parser.py)

**接口设计**:
```python
class ResumeParser:
    async def parse(self, raw_text: str) -> ParsedResume:
        """
        使用 LLM 将简历纯文本结构化解析为 ParsedResume 对象。
        """
    
    async def extract_text(self, file_path: str, file_type: str) -> str:
        """
        从 PDF/DOCX/TXT 文件提取纯文本。
        PDF: pymupdf  |  DOCX: python-docx  |  TXT: 直接读取
        """
```

**解析策略**:
1. 先用 `extract_text` 从文件提取纯文本
2. 调用 LLM，prompt 要求输出 JSON 格式的结构化数据
3. 解析 JSON 映射到 `ParsedResume` dataclass
4. 解析结果缓存到数据库，同一份简历不重复解析

**简历解析 Prompt (prompts/resume_parse.txt)**:
```
你是一个简历解析专家。请将以下简历文本解析为结构化 JSON 格式。

要求：
1. 提取所有工作经历，包括公司名、职位、起止时间、工作描述、关键成果（尽量保留数据指标）、使用的技术栈
2. 提取所有项目经历，包括项目名、角色、描述、技术栈、亮点
3. 提取教育背景、技能列表、语言能力、证书
4. 如果某个字段在简历中没有，设为 null
5. key_achievements 要从描述中提炼带量化数据的成果，如 "将接口响应时间从 2s 优化到 200ms"
6. tech_stack 要拆分为独立的技术名称列表，如 ["React", "TypeScript", "Node.js"]

输出纯 JSON，不要包含 markdown 标记或其他文字。

JSON Schema:
{
  "name": "string",
  "phone": "string | null",
  "email": "string | null",
  "target_position": "string | null",
  "summary": "string",
  "skills": ["string"],
  "work_experiences": [{
    "company": "string",
    "title": "string",
    "start_date": "string",
    "end_date": "string",
    "description": "string",
    "key_achievements": ["string"],
    "tech_stack": ["string"],
    "industry": "string"
  }],
  "projects": [{
    "name": "string",
    "role": "string",
    "description": "string",
    "tech_stack": ["string"],
    "highlights": ["string"],
    "duration": "string",
    "team_size": "number | null"
  }],
  "education": [{
    "school": "string",
    "degree": "string",
    "major": "string",
    "graduation_year": "string",
    "gpa": "string | null",
    "highlights": ["string"]
  }],
  "languages": ["string"],
  "certifications": ["string"]
}

简历原文：
{resume_text}
```

### 2.5 答案个性化升级

**升级后的答案生成 Prompt (prompts/answer_with_resume.txt)**:
```
你是一位资深的面试辅导专家，正在帮助候选人准备面试回答。

## 候选人背景
姓名：{name}
求职岗位：{target_position}
核心技能：{skills}

## 相关工作经历
{relevant_work_experience}

## 相关项目经历
{relevant_projects}

## 回答原则
1. 自然融入候选人的真实经历，引用具体的公司名、项目名、数据指标
2. 使用 STAR 法则组织行为面试题的回答
3. 技术问题先给准确答案，再结合项目经历举例
4. 口语化表达，第一人称，200-400 字
5. 不要编造候选人简历中没有的经历

## 面试问题
{question}

## 之前的对话上下文
{conversation_history}
```

**上下文检索逻辑** (`ParsedResume.get_relevant_context`):
1. 从问题中提取关键词（技术名词、行业术语）
2. 匹配 `work_experiences` 和 `projects` 中 `tech_stack` 和 `description` 包含关键词的条目
3. 按相关度排序，取前 3 条作为上下文
4. 如果没有匹配到，则返回完整的工作经历摘要

---

## 3. 面试题库

### 3.1 数据模型

```python
@dataclass
class InterviewQuestion:
    id: str
    question: str                # 问题文本
    category: str                # "技术" | "行为" | "情景" | "系统设计" | "算法"
    industry: str                # "互联网" | "金融" | "咨询" | "制造" | "通用"
    position: str                # "前端" | "后端" | "产品经理" | "数据分析" | "通用"
    difficulty: str              # "初级" | "中级" | "高级"
    tags: list[str]              # ["React", "性能优化", "微前端"]
    reference_answer: str        # 参考答案
    follow_up_questions: list[str]  # 可能的追问
    source: str                  # 来源标注
```

### 3.2 题库存储

MVP 用 JSON 文件存储，后续迁移到数据库：

```
backend/
├── data/
│   ├── questions/
│   │   ├── tech_frontend.json       # 前端技术题
│   │   ├── tech_backend.json        # 后端技术题
│   │   ├── tech_algorithm.json      # 算法题
│   │   ├── behavioral.json          # 行为面试题
│   │   ├── system_design.json       # 系统设计题
│   │   └── industry_finance.json    # 金融行业题
│   └── question_index.json          # 题库索引
```

### 3.3 题库服务 (services/question_bank.py)

```python
class QuestionBankService:
    def __init__(self):
        """启动时加载所有题库 JSON 到内存"""
    
    def search(
        self,
        query: str,
        category: str | None = None,
        position: str | None = None,
        industry: str | None = None,
        limit: int = 10,
    ) -> list[InterviewQuestion]:
        """模糊搜索题库，按相关度排序"""
    
    def get_by_tags(self, tags: list[str]) -> list[InterviewQuestion]:
        """按标签检索"""
    
    def get_random(
        self,
        category: str | None = None,
        position: str | None = None,
        count: int = 5,
    ) -> list[InterviewQuestion]:
        """随机抽题（用于模拟面试）"""
```

**搜索实现**: MVP 阶段用简单的关键词匹配 + TF-IDF 评分。后续可接入向量数据库做语义搜索。

### 3.4 题库与答案生成联动

当 Question Detector 识别到面试问题后，增加一步题库匹配：
1. 用问题文本在题库中搜索相似题
2. 如果匹配度 > 阈值（如余弦相似度 > 0.85），将题库的 `reference_answer` 作为参考注入 LLM prompt
3. LLM 基于参考答案 + 简历上下文生成个性化回答
4. 这样既保证答案质量，又降低 LLM 幻觉

### 3.5 新增 API 路由 (routers/questions.py)

```
GET  /api/questions/search?q=xxx&category=技术&position=前端  # 搜索题库
GET  /api/questions/{id}                                       # 获取单题详情
GET  /api/questions/random?category=行为&count=5               # 随机抽题
POST /api/questions/practice                                   # 开始模拟练习
```

### 3.6 前端题库页面

新增 `/practice` 页面：
- 左侧：筛选面板（行业、岗位、题目类型、难度）
- 中间：题目列表，点击展开参考答案
- 右侧：「开始模拟面试」按钮，选定题目后进入模拟模式
- 模拟模式：逐题展示，用户语音或文字作答，AI 即时评分和改进建议

---

## 4. 知识库模式

### 4.1 功能说明

用户可以预设自己的「面试知识库」——包括常见问题的预设回答、项目话术、技术要点等。面试时系统优先从知识库中匹配，匹配不到再调用 LLM 生成。

### 4.2 数据模型

```python
@dataclass
class KnowledgeEntry:
    id: str
    user_id: str
    question_pattern: str        # 问题模板/关键词，如 "自我介绍"
    answer: str                  # 预设答案
    tags: list[str]              # 标签
    priority: int                # 优先级（高优先级的优先匹配）
    created_at: datetime
    updated_at: datetime
```

### 4.3 知识库服务 (services/knowledge_base.py)

```python
class KnowledgeBaseService:
    async def add_entry(self, user_id: str, entry: KnowledgeEntry) -> str:
        """添加知识条目，返回 ID"""
    
    async def update_entry(self, entry_id: str, updates: dict) -> bool:
        """更新知识条目"""
    
    async def delete_entry(self, entry_id: str) -> bool:
        """删除知识条目"""
    
    async def list_entries(self, user_id: str) -> list[KnowledgeEntry]:
        """列出用户所有知识条目"""
    
    async def match(self, user_id: str, question: str) -> KnowledgeEntry | None:
        """
        从用户知识库中匹配最相关的条目。
        匹配策略：
        1. 精确匹配 question_pattern
        2. 关键词重叠度匹配
        3. 未来升级为向量相似度匹配
        返回 None 表示未匹配到，交由 LLM 生成。
        """
```

### 4.4 与主流程集成

修改 `ws_audio.py` 中的答案生成逻辑：

```
面试问题 → QuestionDetector 确认
    │
    ├── 1. KnowledgeBase.match(question) → 如果命中
    │       └── 直接返回预设答案（零延迟）
    │
    └── 2. 未命中 → QuestionBank.search(question) → 如果有相似题
            │       └── 用参考答案 + 简历作为上下文调用 LLM
            │
            └── 3. 都未命中 → 纯 LLM 生成
```

### 4.5 前端知识库管理页面

新增 `/knowledge` 页面：
- 卡片列表展示所有知识条目
- 每个卡片显示：问题模板 + 答案预览 + 标签
- 支持新增、编辑（富文本）、删除、拖拽排序（调整优先级）
- 支持批量导入（从 Markdown/Excel 导入 Q&A 对）
- 搜索和筛选功能

### 4.6 新增 API 路由 (routers/knowledge.py)

```
GET    /api/knowledge              # 列出当前用户的知识库条目
POST   /api/knowledge              # 新增条目
PUT    /api/knowledge/{id}         # 更新条目
DELETE /api/knowledge/{id}         # 删除条目
POST   /api/knowledge/import       # 批量导入（JSON/CSV）
POST   /api/knowledge/match        # 手动测试匹配效果
```

---

## 5. 说话人分离

### 5.1 目标

区分面试官和候选人的语音，使 Question Detector 更准确（只分析面试官的话），TranscriptPanel 展示时也能标注发言者。

### 5.2 技术方案

**方案 A — 声纹分离（推荐）**:
- 使用 FunASR 的 `cam++` 说话人模型
- 面试开始前做一次声纹注册：让用户说一句话录入候选人声纹
- 后续所有非候选人声纹的语音标记为面试官
- 优点：自动化、准确率高
- 缺点：需要前置录入步骤

**方案 B — 音频源分离**:
- 区分麦克风输入（候选人自己说话）和系统音频输出（面试官从扬声器出来的声音）
- 需要同时采集两路音频：`getUserMedia` 采集麦克风，`getDisplayMedia` 采集系统音频
- 优点：物理隔离、100% 准确
- 缺点：需要浏览器支持系统音频采集（Chrome 支持，Safari 不支持）

**MVP 阶段推荐方案 B**，因为物理隔离更简单可靠。

### 5.3 前端改动

AudioCapture 组件升级为双通道：

```typescript
interface DualAudioStream {
  micStream: MediaStream | null;     // 麦克风（候选人）
  systemStream: MediaStream | null;  // 系统音频（面试官）
}
```

**实现步骤**:
1. `navigator.mediaDevices.getUserMedia({ audio: true })` → 麦克风流
2. `navigator.mediaDevices.getDisplayMedia({ audio: true, video: true })` → 系统音频流（需要屏幕共享权限，但只取音频轨道）
3. 两路音频分别编码，通过 WebSocket 用不同标记发送
4. 后端分别处理：系统音频 → 标记为 interviewer；麦克风 → 标记为 candidate

### 5.4 WebSocket 协议升级

客户端发送 binary 帧前增加 1 字节头标识来源：

```
Byte 0: 0x01 = 麦克风音频（候选人）
Byte 0: 0x02 = 系统音频（面试官）
Byte 1..N: 音频数据
```

后端解析首字节判断来源，分别喂入 ASR。

---

## 6. 移动端副屏

### 6.1 功能说明

在手机/Pad 上打开专属页面，只显示 AnswerPanel（答案面板），用于面试中副屏查看答案。PC 端录音 + 处理，移动端只负责展示。

### 6.2 实现方案

**不需要双端互联服务**——利用现有 WebSocket 架构即可：
1. PC 端建立 WebSocket 连接进行录音和处理
2. 移动端打开 `/mobile?session=xxx`，建立只读 WebSocket 连接
3. 后端维护 session 概念，同一 session 的消息广播给所有连接的客户端
4. 移动端只接收 `question` 和 `answer` 类型消息，不发送音频

### 6.3 Session 管理

```python
# 在 ws_audio.py 中新增 session 管理
class SessionManager:
    """管理面试 session，支持多客户端同步"""
    
    sessions: dict[str, Session] = {}
    
    def create_session(self) -> str:
        """创建新 session，返回 session_id"""
    
    def join_session(self, session_id: str, ws: WebSocket, role: str) -> bool:
        """
        加入 session。
        role: "primary" (PC端，可发送音频) | "viewer" (移动端，只读)
        """
    
    async def broadcast(self, session_id: str, message: dict):
        """向 session 内所有客户端广播消息"""
    
    def remove_client(self, session_id: str, ws: WebSocket):
        """移除客户端连接"""

@dataclass
class Session:
    id: str
    created_at: datetime
    clients: dict[WebSocket, str]  # ws -> role
    transcript_history: list[str]
    resume_context: str
```

### 6.4 新增 WebSocket 端点

```
ws://host:8000/ws/audio?session=xxx              # PC 端（primary）
ws://host:8000/ws/viewer?session=xxx             # 移动端（viewer，只读）
```

### 6.5 移动端页面 (/mobile)

新增 `frontend/src/app/mobile/page.tsx`:
- 全屏暗色背景，只展示答案卡片列表
- 最新问题+答案在最顶部，大字体显示
- 自动滚动跟随
- 顶部状态栏：session 连接状态 + 当前面试时长
- 打开方式：PC 端生成二维码，手机扫码进入

---

## 7. 面试复盘报告

### 7.1 数据采集

面试过程中自动记录：

```python
@dataclass
class InterviewRecord:
    id: str
    session_id: str
    start_time: datetime
    end_time: datetime | None
    duration_minutes: int
    transcript: list[TranscriptEntry]    # 完整转写记录
    questions: list[QuestionRecord]      # 所有问答记录
    resume_id: str | None
    company: str | None                  # 用户可选填
    position: str | None                 # 用户可选填

@dataclass
class QuestionRecord:
    question_id: str
    question_text: str
    detected_at: datetime
    ai_answer: str                       # AI 生成的参考答案
    category: str | None                 # 题目类型（如果题库匹配到了）
    tags: list[str]
```

### 7.2 报告生成服务 (services/report_service.py)

```python
class ReportService:
    async def generate_report(self, record: InterviewRecord) -> InterviewReport:
        """
        面试结束后调用 LLM 分析面试记录，生成复盘报告。
        """

@dataclass
class InterviewReport:
    summary: str                         # 总体评价
    duration: int                        # 面试时长（分钟）
    total_questions: int                 # 问题总数
    question_categories: dict[str, int]  # 题型分布，如 {"技术": 5, "行为": 3}
    strengths: list[str]                 # 表现好的方面
    improvements: list[str]             # 需要改进的方面
    question_analysis: list[QuestionAnalysis]  # 逐题分析
    recommended_practice: list[str]      # 建议练习的题目方向

@dataclass
class QuestionAnalysis:
    question: str
    category: str
    difficulty: str
    ai_answer_quality: str               # "完整" | "部分" | "未回答"
    notes: str                           # 针对该题的建议
```

### 7.3 报告 Prompt

```
你是一位资深面试教练。请根据以下面试记录生成复盘报告。

面试信息：
- 公司/岗位：{company} / {position}
- 时长：{duration} 分钟
- 问题数量：{total_questions}

完整面试记录：
{transcript}

请分析：
1. 面试官关注的重点方向（从问题类型分布判断）
2. 候选人表现好的地方（如果有候选人的回答记录）
3. 需要改进的方面
4. 针对每个问题的简要分析和改进建议
5. 建议后续重点练习的方向

输出 JSON 格式，schema 如下：
{report_json_schema}
```

### 7.4 前端报告页面

新增 `/history` 页面和 `/history/[id]` 报告详情页：
- `/history`: 面试记录列表，显示日期、公司、岗位、时长、问题数
- `/history/[id]`: 可视化报告页面
  - 顶部：总体评分卡（面试时长、问题数、题型分布饼图）
  - 中间：优劣势分析卡片
  - 下方：逐题回顾，展开可看完整转写 + AI 答案 + 改进建议
  - 底部：推荐练习方向 + 跳转题库

### 7.5 新增 API

```
GET  /api/interviews                    # 面试记录列表
GET  /api/interviews/{id}               # 面试记录详情
GET  /api/interviews/{id}/report        # 获取/生成复盘报告
POST /api/interviews/{id}/end           # 结束面试（触发记录保存）
```

---

## 8. 多语言支持

### 8.1 ASR 多语言

FunASR SenseVoice 已支持中英文混合识别，无需额外配置。配置项新增：

```python
# config.py
ASR_LANGUAGES: list[str] = ["zh", "en"]  # 支持的语言列表
```

### 8.2 LLM 多语言答案

在答案生成 prompt 中增加语言指令：

```
## 语言要求
面试官使用{detected_language}提问，请用相同语言回答。
如果面试中中英文混合使用，回答时保持相同的混合风格。
```

语言检测逻辑：分析转写文本的字符比例，中文字符 > 50% 则为中文面试，否则为英文。

### 8.3 前端国际化

使用 `next-intl` 做前端 i18n：
- 支持中文 / 英文界面切换
- URL 结构：`/zh/...` 和 `/en/...`
- 默认跟随浏览器语言设置

---

## 9. 第二期数据库设计

从 SQLite 升级为 PostgreSQL（通过 SQLAlchemy 抽象，本地开发仍可用 SQLite）。

```sql
-- 用户表（预留，第三期接入登录）
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 简历表
CREATE TABLE resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    file_name VARCHAR(255),
    raw_text TEXT,
    parsed_data JSONB,           -- ParsedResume 的 JSON
    created_at TIMESTAMP DEFAULT NOW()
);

-- 知识库条目表
CREATE TABLE knowledge_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    question_pattern TEXT NOT NULL,
    answer TEXT NOT NULL,
    tags TEXT[],
    priority INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 面试记录表
CREATE TABLE interview_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    session_id VARCHAR(64),
    company VARCHAR(255),
    position VARCHAR(255),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration_minutes INT,
    transcript JSONB,            -- 完整转写记录
    questions JSONB,             -- 问答记录
    resume_id UUID REFERENCES resumes(id),
    report JSONB,                -- 复盘报告
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 10. 第二期新增依赖

```
# backend/requirements.txt 新增
sqlalchemy>=2.0.0
asyncpg>=0.29.0            # PostgreSQL async driver
alembic>=1.13.0             # 数据库迁移
aiosqlite>=0.20.0           # SQLite async（本地开发用）
```

```json
// frontend/package.json 新增
"next-intl": "^3.20.0",
"qrcode.react": "^3.1.0",
"recharts": "^2.12.0"
```

---

## 11. 第二期目录结构变更汇总

```
interview-copilot/
├── backend/
│   ├── app/
│   │   ├── database.py              # 新增：数据库连接和 session
│   │   └── config.py                # 更新：新增数据库配置
│   ├── models/
│   │   ├── __init__.py              # 新增
│   │   ├── resume.py                # 新增：简历数据模型
│   │   ├── interview.py             # 新增：面试记录模型
│   │   └── knowledge.py             # 新增：知识库模型
│   ├── routers/
│   │   ├── ws_audio.py              # 更新：Session 管理、知识库集成
│   │   ├── ws_viewer.py             # 新增：移动端只读 WebSocket
│   │   ├── questions.py             # 新增：题库路由
│   │   ├── knowledge.py             # 新增：知识库 CRUD 路由
│   │   ├── interviews.py            # 新增：面试记录和报告路由
│   │   └── resume.py                # 更新：结构化解析
│   ├── services/
│   │   ├── resume_parser.py         # 新增：简历结构化解析
│   │   ├── knowledge_base.py        # 新增：知识库匹配服务
│   │   ├── question_bank.py         # 新增：题库服务
│   │   ├── report_service.py        # 新增：复盘报告生成
│   │   ├── session_manager.py       # 新增：面试 session 管理
│   │   ├── question_detector.py     # 更新：集成知识库+题库
│   │   └── llm_service.py           # 更新：新 prompt 模板
│   ├── data/
│   │   └── questions/               # 新增：题库 JSON 文件
│   ├── prompts/
│   │   ├── resume_parse.txt         # 新增
│   │   ├── answer_with_resume.txt   # 新增（升级版）
│   │   └── report_generate.txt      # 新增
│   └── alembic/                     # 新增：数据库迁移
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── mobile/page.tsx      # 新增：移动端答案页
│   │   │   ├── practice/page.tsx    # 新增：题库练习页
│   │   │   ├── knowledge/page.tsx   # 新增：知识库管理页
│   │   │   └── history/
│   │   │       ├── page.tsx         # 新增：面试记录列表
│   │   │       └── [id]/page.tsx    # 新增：复盘报告详情
│   │   ├── components/
│   │   │   ├── AudioCapture.tsx     # 更新：双通道音频
│   │   │   ├── SessionQRCode.tsx    # 新增：Session 二维码
│   │   │   ├── KnowledgeEditor.tsx  # 新增：知识库编辑器
│   │   │   ├── ReportChart.tsx      # 新增：报告可视化图表
│   │   │   └── QuestionBrowser.tsx  # 新增：题库浏览组件
│   │   └── stores/
│   │       └── interviewStore.ts    # 更新：新增知识库和记录状态
```

---

# 第三期：完整产品（第二期完成后 6-8 周）

## 12. 第三期功能总览

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 桌面客户端 | Electron 应用，系统音频采集更稳定 | P0 |
| 双端互联 | PC 采集 ↔ 手机展示，WebRTC P2P 连接 | P0 |
| 笔试辅助 | 截图 OCR + AI 解题 | P0 |
| 算法题模式 | 代码题识别、生成可运行代码 + 思路讲解 | P1 |
| 用户系统 | 注册/登录/付费/套餐管理 | P0 |
| 向量知识库 | 简历和知识库的语义检索升级 | P1 |
| 眼神纠正提示 | 提醒用户看摄像头 | P2 |

---

## 13. 桌面客户端 (Electron)

### 13.1 为什么需要桌面客户端

浏览器的限制：
- 系统音频采集需要屏幕共享权限，体验差
- 无法长时间后台运行
- 无法做全局快捷键
- 无法做透明悬浮窗

### 13.2 技术选型

```
Electron 30+ / Next.js (renderer) / Node.js (main process)
```

复用第一、二期的 Next.js 前端代码，Electron 只做壳和系统能力扩展。

### 13.3 目录结构

```
desktop/
├── main/
│   ├── index.ts                 # Electron 主进程入口
│   ├── audio-capture.ts         # 系统音频捕获（使用 loopback）
│   ├── screenshot.ts            # 屏幕截图服务
│   ├── overlay-window.ts        # 悬浮答案窗口
│   ├── tray.ts                  # 系统托盘菜单
│   ├── shortcuts.ts             # 全局快捷键注册
│   ├── auto-updater.ts          # 自动更新
│   └── ipc-handlers.ts          # IPC 通信处理
├── preload/
│   └── index.ts                 # preload 脚本，暴露安全 API
├── renderer/                    # 指向 frontend/ 的 Next.js 项目
├── electron-builder.yml         # 打包配置
├── package.json
└── forge.config.ts
```

### 13.4 系统音频捕获 (main/audio-capture.ts)

```typescript
interface AudioCaptureService {
  /**
   * 获取系统所有音频输出设备
   */
  listOutputDevices(): Promise<AudioDevice[]>;

  /**
   * 开始捕获指定设备的音频（loopback capture）
   * 在 Windows 上使用 WASAPI loopback
   * 在 macOS 上使用虚拟音频设备（如 BlackHole/SoundFlower）或 ScreenCaptureKit
   */
  startCapture(deviceId: string): Promise<void>;

  /**
   * 停止捕获
   */
  stopCapture(): Promise<void>;

  /**
   * 注册音频数据回调，每 500ms 回调一次
   */
  onAudioData(callback: (buffer: Buffer) => void): void;
}
```

**平台差异处理**:
- **Windows**: 使用 `node-audio-capture` 或 `portaudio` 的 WASAPI loopback 模式直接捕获系统声音
- **macOS**: 使用 `ScreenCaptureKit` API (macOS 13+) 或引导用户安装 BlackHole 虚拟音频设备
- **Linux**: 使用 PulseAudio 的 monitor source

### 13.5 悬浮答案窗口 (main/overlay-window.ts)

```typescript
interface OverlayWindow {
  /**
   * 创建透明、置顶、鼠标穿透的悬浮窗
   * 显示在屏幕右侧，紧贴面试软件窗口
   */
  create(): BrowserWindow;

  /**
   * 更新悬浮窗内容（新问题或答案增量）
   */
  updateContent(data: AnswerMessage): void;

  /**
   * 调整透明度（用户可通过快捷键调节）
   */
  setOpacity(value: number): void;

  /**
   * 切换鼠标穿透模式
   */
  toggleClickThrough(enabled: boolean): void;
}
```

**Electron 实现**:
```typescript
const overlay = new BrowserWindow({
  width: 400,
  height: 600,
  x: screenWidth - 420,  // 靠右侧
  y: 100,
  transparent: true,
  frame: false,
  alwaysOnTop: true,
  skipTaskbar: true,
  resizable: true,
  hasShadow: false,
  webPreferences: {
    preload: path.join(__dirname, '../preload/index.js'),
  },
});

// 鼠标穿透模式：答案窗口不拦截鼠标事件
overlay.setIgnoreMouseEvents(true, { forward: true });
```

### 13.6 全局快捷键 (main/shortcuts.ts)

```typescript
const shortcuts = {
  'CommandOrControl+Shift+R': 'toggle-recording',      // 开始/停止录音
  'CommandOrControl+Shift+H': 'toggle-overlay',         // 显示/隐藏悬浮窗
  'CommandOrControl+Shift+Up': 'increase-opacity',      // 增加透明度
  'CommandOrControl+Shift+Down': 'decrease-opacity',    // 降低透明度
  'CommandOrControl+Shift+S': 'screenshot-ocr',         // 截图 OCR（笔试模式）
  'CommandOrControl+Shift+C': 'copy-latest-answer',     // 复制最新答案
  'Escape': 'stop-current-answer',                       // 停止当前答案生成
};
```

### 13.7 打包和分发

```yaml
# electron-builder.yml
appId: com.interview-copilot.app
productName: Interview Copilot
directories:
  output: dist
  
mac:
  target: [dmg, zip]
  icon: build/icon.icns
  hardenedRuntime: true
  category: public.app-category.productivity

win:
  target: [nsis, portable]
  icon: build/icon.ico

linux:
  target: [AppImage, deb]
  icon: build/icon.png
  category: Utility

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true

publish:
  provider: github
  owner: your-org
  repo: interview-copilot
```

---

## 14. 双端互联 (PC ↔ 手机)

### 14.1 方案升级

第二期的移动端副屏依赖服务器转发，有延迟且依赖网络。第三期升级为 WebRTC P2P + 服务器 fallback：

```
优先级 1: WebRTC DataChannel（局域网 P2P，低延迟）
优先级 2: WebSocket 服务器中转（跨网络场景）
```

### 14.2 连接流程

```
1. PC 端生成 session，展示二维码（含 session_id + signaling server URL）
2. 手机扫码，连接 signaling server
3. 通过 signaling server 交换 SDP/ICE candidates
4. WebRTC DataChannel 建立 P2P 连接
5. PC 端通过 DataChannel 直接推送问题和答案到手机
6. 如果 P2P 失败（NAT 穿透失败），自动 fallback 到 WebSocket 中转
```

### 14.3 Signaling Server

```python
# backend/routers/ws_signaling.py

@router.websocket("/ws/signal/{session_id}")
async def signaling(ws: WebSocket, session_id: str):
    """
    WebRTC signaling server。
    转发 SDP offer/answer 和 ICE candidates。
    """
```

### 14.4 前端 WebRTC Hook

```typescript
// frontend/src/hooks/useP2PConnection.ts

interface UseP2PConnectionReturn {
  status: 'idle' | 'connecting' | 'connected' | 'fallback-ws';
  sendMessage: (data: object) => void;
  onMessage: (callback: (data: object) => void) => void;
  sessionId: string;
  qrCodeUrl: string;   // 供手机扫码的 URL
}
```

---

## 15. 笔试辅助

### 15.1 功能说明

用户在一台电脑上进行在线笔试，在另一台设备上查看 AI 生成的答案。流程：截图/选区 → OCR 识别题目 → AI 解题 → 展示答案。

### 15.2 两种输入模式

**模式 A — 手动截图**:
1. 用户按快捷键 `Ctrl+Shift+S` 触发截图
2. 出现选区工具，用户框选题目区域
3. 截图发送到后端 OCR 识别
4. 识别结果展示，用户确认后 AI 解题

**模式 B — 自动截图（桌面客户端）**:
1. 用户指定笔试窗口
2. 客户端每 N 秒自动截图该窗口
3. 与上一次截图做 diff，如果变化大（翻页/新题）则触发 OCR
4. 自动识别并解答新题目

### 15.3 OCR 服务 (services/ocr_service.py)

```python
class OCRService:
    async def recognize(self, image_bytes: bytes) -> OCRResult:
        """
        识别图片中的文字。
        支持：
        - 纯文本题目
        - 代码截图
        - 数学公式（LaTeX）
        - 表格
        """

    async def recognize_code(self, image_bytes: bytes) -> str:
        """专门识别代码截图，保留缩进和格式"""

@dataclass
class OCRResult:
    full_text: str               # 完整识别文本
    code_blocks: list[str]       # 识别到的代码块
    has_math: bool               # 是否包含数学公式
    has_table: bool              # 是否包含表格
    confidence: float            # 整体置信度
```

**技术方案**:
- 通用 OCR: PaddleOCR（免费、中英文优秀）或 Tesseract
- 代码 OCR: 先用通用 OCR，再用 LLM 修复格式和缩进
- 数学公式: 用 `pix2tex` 或 LLM 视觉模型（GPT-4o vision / Claude vision）直接识别
- 推荐 MVP: 直接用 LLM 视觉模型（把截图作为图片输入），一步到位识别+理解题意

### 15.4 解题服务

不需要新建 service，复用 `LLMService`，新增解题 prompt：

**笔试解题 Prompt (prompts/exam_solve.txt)**:
```
你是一个编程和笔试题解答专家。请解答以下笔试题目。

## 题目
{question_text}

{如果有代码截图: [图片]}

## 要求
1. 如果是选择题，直接给出正确选项和简要解释
2. 如果是编程题，给出完整可运行的代码 + 时空复杂度分析 + 思路说明
3. 如果是算法题，先说思路，再给代码，注明关键步骤
4. 如果是开放题/简答题，给出结构化的答案要点
5. 代码使用题目要求的语言，如果未指定默认用 Python
6. 确保代码能通过所有示例用例
```

### 15.5 新增 API

```
POST /api/exam/ocr              # 上传截图进行 OCR 识别
POST /api/exam/solve             # 提交题目文本/图片，获取 AI 解答 (SSE)
POST /api/exam/solve-image       # 直接上传截图，OCR + 解题一步完成 (SSE)
```

### 15.6 笔试模式前端

新增 `/exam` 页面：
- 左侧：截图历史（缩略图列表）
- 中间：当前题目（OCR 识别结果 + 原始截图对比）
- 右侧：AI 解答面板（代码高亮显示）
- 底部工具栏：截图按钮、粘贴图片、手动输入题目

桌面客户端额外功能：
- 悬浮截图工具（快捷键触发）
- 自动监控笔试窗口
- 答案悬浮窗显示

---

## 16. 算法题模式

### 16.1 功能说明

技术面试中的手撕代码场景。面试官口述或屏幕展示算法题，系统识别后生成分层提示：先给思路 → 再给伪代码 → 最后给完整代码。

### 16.2 分层答案生成

修改 `LLMService`，算法题模式下分三次调用：

```python
async def generate_algorithm_answer(
    self,
    question: str,
    language: str = "python",
) -> AsyncGenerator[AlgorithmStep, None]:
    """
    分层生成算法题答案。
    Step 1: 思路提示（30-50 字）
    Step 2: 解题框架/伪代码
    Step 3: 完整可运行代码 + 复杂度分析
    """

@dataclass
class AlgorithmStep:
    step: int                    # 1, 2, 3
    label: str                   # "思路", "框架", "完整代码"
    content: str
    done: bool
```

**前端展示**:
- 三个折叠面板，逐步展开
- 用户可以选择只看思路（自己写代码），或全部展开
- 代码块支持语法高亮 + 一键复制
- 支持切换编程语言（Python/Java/C++/JavaScript/Go）

### 16.3 算法题 Prompt

```
你是一个算法面试专家。请分三个层次回答以下算法题。

题目：{question}
要求使用的编程语言：{language}

请严格按以下 JSON 格式输出三个步骤：

{"step": 1, "label": "思路", "content": "简述解题思路，包括使用的数据结构和算法，30-50字"}
---
{"step": 2, "label": "框架", "content": "伪代码或函数签名+关键步骤注释"}
---
{"step": 3, "label": "完整代码", "content": "完整可运行代码\n\n时间复杂度：O(...)\n空间复杂度：O(...)"}

三个步骤之间用 --- 分隔。
```

---

## 17. 用户系统

### 17.1 认证方案

- 注册/登录: 手机号 + 验证码（国内）/ 邮箱 + 密码（国际）
- 第三方登录: 微信扫码 / Google OAuth
- Token: JWT (access token 2h + refresh token 7d)
- 存储: httpOnly cookie (access token) + localStorage (refresh token)

### 17.2 用户模型

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) UNIQUE,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    nickname VARCHAR(100),
    avatar_url VARCHAR(500),
    plan VARCHAR(20) DEFAULT 'free',      -- 'free' | 'basic' | 'pro' | 'enterprise'
    credits INT DEFAULT 100,               -- 剩余积分
    created_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP
);

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    refresh_token VARCHAR(500),
    device_info JSONB,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 17.3 套餐设计

```
免费版:
  - 每天 3 次面试辅助（每次最长 30 分钟）
  - 手动输入模式
  - 基础题库（500 题）
  - 无简历解析
  - 无复盘报告

基础版（¥49/月）:
  - 每天 10 次面试辅助
  - 语音识别模式
  - 完整题库（5000+ 题）
  - 简历解析（每月 5 份）
  - 知识库（50 条）
  - 基础复盘报告

专业版（¥99/月）:
  - 无限次面试辅助
  - 桌面客户端
  - 笔试辅助
  - 算法题模式
  - 简历解析（无限）
  - 知识库（无限）
  - 详细复盘报告
  - 移动端副屏
  - 优先客服

企业版（联系销售）:
  - 多账号管理
  - 面试官视角（出题+评估）
  - API 接入
  - 私有化部署
```

### 17.4 积分 / 用量计费

```python
class UsageService:
    async def check_quota(self, user_id: str, action: str) -> bool:
        """检查用户是否有剩余配额"""
    
    async def consume(self, user_id: str, action: str, amount: int = 1):
        """消耗配额"""
    
    async def get_usage(self, user_id: str) -> UsageStats:
        """获取用量统计"""
```

计费粒度：
- 面试辅助: 按次数计费（开始录音到停止为一次）
- 笔试辅助: 按题目数计费
- LLM 调用: 按 token 计费（对用户透明，内部统计成本）

### 17.5 支付集成

- 国内: 微信支付 + 支付宝（使用聚合支付服务如 Ping++）
- 国际: Stripe
- 订阅管理: 自建订阅状态机（创建 → 激活 → 续费/过期 → 取消）

### 17.6 新增路由

```
POST /api/auth/register          # 注册
POST /api/auth/login             # 登录
POST /api/auth/refresh           # 刷新 token
POST /api/auth/logout            # 登出
GET  /api/auth/me                # 当前用户信息

GET  /api/billing/plans          # 套餐列表
POST /api/billing/subscribe      # 订阅/升级
POST /api/billing/cancel         # 取消订阅
GET  /api/billing/usage          # 用量统计
POST /api/billing/webhook        # 支付回调
```

---

## 18. 向量知识库

### 18.1 目标

将简历内容、知识库条目、面试题库全部向量化存储，实现语义级别的检索匹配，替代第二期的关键词匹配。

### 18.2 技术方案

```
Embedding 模型: text-embedding-3-small (OpenAI) 或 BAAI/bge-small-zh-v1.5 (免费本地)
向量数据库: Qdrant (自托管，开源) 或 Chroma (嵌入式，更简单)
```

MVP 推荐 Chroma（零配置、嵌入式），后续可迁移到 Qdrant。

### 18.3 向量化服务 (services/embedding_service.py)

```python
class EmbeddingService:
    def __init__(self):
        """初始化 embedding 模型和向量数据库"""
    
    async def embed_text(self, text: str) -> list[float]:
        """将文本转为向量"""
    
    async def index_resume(self, resume_id: str, parsed_resume: ParsedResume):
        """
        将简历内容分块向量化入库。
        分块策略：每段工作经历、每个项目、技能列表分别作为独立文档。
        """
    
    async def index_knowledge(self, entry: KnowledgeEntry):
        """将知识库条目向量化入库"""
    
    async def search(
        self,
        query: str,
        collection: str,       # "resume" | "knowledge" | "questions"
        user_id: str | None,
        top_k: int = 5,
    ) -> list[SearchResult]:
        """语义搜索，返回最相关的文档片段"""

@dataclass
class SearchResult:
    text: str
    score: float               # 相似度分数 0-1
    metadata: dict             # 来源信息
```

### 18.4 与主流程集成

升级答案生成的 RAG 流程：

```
面试问题
  │
  ├── EmbeddingService.search("knowledge", question) → 知识库匹配
  ├── EmbeddingService.search("resume", question)    → 简历相关片段
  ├── EmbeddingService.search("questions", question)  → 题库相似题
  │
  ▼
  合并检索结果，去重，按分数排序取 top-5
  │
  ▼
  拼入 LLM prompt 的上下文区域
  │
  ▼
  LLM 基于上下文生成个性化答案
```

### 18.5 新增依赖

```
# backend/requirements.txt 新增
chromadb>=0.5.0
sentence-transformers>=3.0.0    # 本地 embedding 模型（如果用免费方案）
```

---

## 19. 第三期目录结构变更汇总

```
interview-copilot/
├── backend/
│   ├── routers/
│   │   ├── auth.py                  # 新增：认证路由
│   │   ├── billing.py               # 新增：计费路由
│   │   ├── ws_signaling.py          # 新增：WebRTC signaling
│   │   └── exam.py                  # 新增：笔试辅助路由
│   ├── services/
│   │   ├── auth_service.py          # 新增：认证服务
│   │   ├── billing_service.py       # 新增：计费和订阅管理
│   │   ├── usage_service.py         # 新增：用量统计
│   │   ├── ocr_service.py           # 新增：截图 OCR
│   │   ├── embedding_service.py     # 新增：向量化和检索
│   │   └── llm_service.py           # 更新：算法题模式、RAG 集成
│   ├── prompts/
│   │   ├── exam_solve.txt           # 新增：笔试解题
│   │   └── algorithm_answer.txt     # 新增：算法题分层
│   └── middleware/
│       ├── auth_middleware.py        # 新增：JWT 鉴权中间件
│       └── quota_middleware.py       # 新增：用量检查中间件
├── desktop/                          # 新增：Electron 桌面客户端
│   ├── main/
│   │   ├── index.ts
│   │   ├── audio-capture.ts
│   │   ├── screenshot.ts
│   │   ├── overlay-window.ts
│   │   ├── tray.ts
│   │   ├── shortcuts.ts
│   │   ├── auto-updater.ts
│   │   └── ipc-handlers.ts
│   ├── preload/
│   │   └── index.ts
│   ├── electron-builder.yml
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── login/page.tsx       # 新增：登录页
│   │   │   ├── register/page.tsx    # 新增：注册页
│   │   │   ├── pricing/page.tsx     # 新增：套餐定价页
│   │   │   ├── settings/page.tsx    # 新增：用户设置页
│   │   │   └── exam/page.tsx        # 新增：笔试辅助页
│   │   ├── components/
│   │   │   ├── AlgorithmSteps.tsx   # 新增：算法题分层展示
│   │   │   ├── ScreenshotTool.tsx   # 新增：截图选区工具
│   │   │   ├── CodeBlock.tsx        # 新增：代码高亮展示
│   │   │   ├── PricingCard.tsx      # 新增：套餐卡片
│   │   │   └── AuthGuard.tsx        # 新增：登录态守卫
│   │   ├── hooks/
│   │   │   ├── useP2PConnection.ts  # 新增：WebRTC P2P
│   │   │   └── useAuth.ts           # 新增：认证 hook
│   │   └── stores/
│   │       ├── authStore.ts         # 新增：认证状态
│   │       └── billingStore.ts      # 新增：计费状态
```

---

## 20. 三期整体开发时间线

```
第一期 MVP（4-6 周）
  Week 1-2: 后端骨架 + LLM + 手动模式
  Week 3:   WebSocket + ASR 接入
  Week 4:   前端打磨 + Docker + 上线
  ────────────────────────────────────
第二期 增强（4-6 周）
  Week 5:   简历深度解析 + 数据库
  Week 6:   面试题库 + 知识库模式
  Week 7:   说话人分离 + 移动端副屏
  Week 8:   面试复盘报告 + 多语言
  Week 9-10: 集成测试 + 打磨 + 上线
  ────────────────────────────────────
第三期 完整产品（6-8 周）
  Week 11-12: 桌面客户端（Electron）
  Week 13:    双端互联（WebRTC）
  Week 14:    笔试辅助 + 算法题模式
  Week 15-16: 用户系统 + 付费
  Week 17:    向量知识库升级
  Week 18:    全量测试 + 灰度 + 正式上线
```

---

## 21. 给 Claude Code 的实现指导

### 第二期实施顺序

```bash
# 1. 先做数据库（所有后续功能依赖）
#    - 配置 SQLAlchemy + Alembic
#    - 创建 models/
#    - 初始化迁移脚本

# 2. 简历深度解析（最高 ROI）
#    - 实现 resume_parser.py
#    - 升级答案 prompt
#    - 前端简历预览升级

# 3. 知识库模式
#    - knowledge_base.py + CRUD 路由
#    - 前端管理页面
#    - 与主流程集成

# 4. 面试题库
#    - 准备题库 JSON 数据（可用 LLM 批量生成）
#    - question_bank.py
#    - 前端练习页面

# 5. 说话人分离 + 移动端
#    - 双通道音频采集
#    - Session 管理
#    - 移动端页面

# 6. 面试复盘
#    - 面试记录存储
#    - 报告生成
#    - 前端报告页面
```

### 第三期实施顺序

```bash
# 1. 用户系统（其他功能需要用户鉴权）
#    - auth 路由 + JWT 中间件
#    - 前端登录/注册页
#    - 套餐和计费

# 2. 桌面客户端
#    - Electron 壳 + 系统音频捕获
#    - 悬浮窗
#    - 打包分发

# 3. 笔试辅助
#    - OCR 服务
#    - 解题路由
#    - 前端笔试页面

# 4. 算法题模式
#    - 分层 prompt
#    - 前端分步展示

# 5. 双端互联
#    - WebRTC signaling
#    - 前端 P2P hook

# 6. 向量知识库
#    - embedding 服务
#    - RAG 升级
```

### 代码风格（继承 MVP 要求）

- Python: type hints、async/await、dataclass、pydantic model
- TypeScript: strict mode、interface 优先
- 新增模块都要有清晰的接口定义（先定义 interface/protocol，再实现）
- 每个 service 都要支持 mock 模式（依赖不可用时降级）
- 所有 LLM prompt 独立存放在 `prompts/` 目录，不要硬编码在代码中
