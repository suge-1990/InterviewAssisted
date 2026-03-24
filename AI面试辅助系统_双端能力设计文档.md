# AI 面试辅助系统 — 双端能力技术设计文档

> 本文档承接 MVP + 第二期 + 第三期设计文档，基于市场竞品调研（OfferIN、Cuemate、白瓜面试、OfferWing、面试通、面试精灵、Offer蛙等），对系统的双端协同能力进行完整重新设计。
>
> 设计目标：将三期中零散的 Electron、WebRTC、移动端副屏等规划，整合为一套**以「PC 客户端 + 移动副屏」双端协同为核心**的完整产品方案，对标行业一线水平。

---

## 一、竞品双端能力拆解

### 1.1 核心竞品能力矩阵

| 能力维度 | OfferIN | Cuemate | 白瓜面试 | OfferWing | 面试通 | 本系统现状 |
|---------|---------|---------|---------|-----------|--------|----------|
| PC 桌面客户端 | ✅ Win/Mac 原生 | ✅ Win/Mac + Chrome 扩展 | ✅ 客户端 | ❌ 纯 Web | ✅ 客户端 | ⚠️ 三期规划 |
| 悬浮窗答案 | ✅ 可调大小/位置 | ✅ 不可点击独立浮窗 | ✅ | ❌ | ✅ | ⚠️ 三期规划 |
| 屏幕共享隐身 | ✅ 双端物理隔离 | ✅ WebRTC 不可见 | ✅ 物理隔离 | ❌ | ✅ 双端 | ❌ |
| 双端互联 | ✅ **核心卖点** | ❌ | ✅ 手机获取电脑音视频 | ❌ | ✅ | ⚠️ 二期简单副屏 |
| 移动端答案展示 | ✅ 手机/平板网页 | ❌ | ✅ | ✅ 手机横竖屏 | ✅ | ⚠️ 二期 viewer |
| 远程截图/遥控 | ✅ 手机遥控 PC 截图 | ❌ | ❌ | ✅ 远程截图 | ✅ 远程截图 | ❌ |
| 系统音频采集 | ✅ WASAPI/ScreenCaptureKit | ✅ 系统音频 | ✅ | ❌ 浏览器麦克风 | ✅ | ⚠️ 三期 Electron |
| 极速/精确双模式 | ✅ **行业首创** | ❌ | ❌ | ❌ | ❌ | ❌ |
| Coding 小窗 | ✅ 代码+架构图 | ❌ | ✅ 手撕代码 | ❌ | ❌ | ⚠️ 三期算法题 |
| 多模型选择 | ✅ GPT-4o/Claude 自由搭配 | ✅ DeepSeek | ❌ | ❌ | ❌ | ❌ |
| 全局快捷键 | ✅ 快答/重答/截图 | ✅ 移动/缩放 | ❌ | ❌ | ❌ | ⚠️ 三期规划 |
| 剪贴板联动 | ✅ 复制自动触发 | ❌ | ❌ | ❌ | ❌ | ❌ |
| 语音触发词 | ✅ 自定义如"让我想想" | ❌ | ❌ | ❌ | ❌ | ❌ |
| 延迟监控 | ✅ 半小时延迟图表 | ❌ | ❌ | ❌ | ❌ | ❌ |

### 1.2 竞品关键洞察

**OfferIN** 是双端能力的标杆产品，其核心设计哲学：
- PC 客户端负责「采集 + 处理」：捕获系统音频、实时 ASR、调用 LLM
- 移动端负责「展示 + 遥控」：显示答案、遥控截图、触发快答
- 两端通过局域网直连（非服务器中转），延迟极低
- 「极速 + 精确」双模式并发，用户取最优答案

**Cuemate** 的差异化在于隐身能力：
- 悬浮窗为不可点击的独立窗口，不触发焦点切换检测
- 通过快捷键调整位置，确保眼神不偏移
- 全自动运行，无需手动干预

**白瓜面试** 的差异化在于物理隔离：
- 手机/平板获取电脑音视频流，实现完全物理隔离
- 屏幕共享时 PC 端无任何辅助痕迹

### 1.3 本系统需要补齐的核心能力

按优先级排序：

| 优先级 | 能力 | 对标竞品 | 预估工作量 |
|--------|------|---------|----------|
| P0 | PC 客户端 + 系统音频采集 | OfferIN/Cuemate | 3 周 |
| P0 | 双端互联（PC ↔ 移动端） | OfferIN | 2 周 |
| P0 | 悬浮窗答案（隐身/穿透/可调） | Cuemate | 1.5 周 |
| P0 | 移动端答案副屏（升级版） | 全部竞品 | 1.5 周 |
| P1 | 极速/精确双模式回答 | OfferIN | 1 周 |
| P1 | 远程截图遥控 | OfferIN | 1 周 |
| P1 | 全局快捷键 + 剪贴板联动 | OfferIN | 0.5 周 |
| P2 | 语音触发词 | OfferIN | 0.5 周 |
| P2 | 多模型选择 | OfferIN | 0.5 周 |
| P2 | Coding 专用小窗 | OfferIN/白瓜 | 1 周 |

---

## 二、整体架构设计

### 2.1 双端协同总览

```
┌─────────────────────────────────────────────────────┐
│                   PC 端（主控端）                      │
│                                                     │
│  Electron 桌面客户端                                  │
│  ┌──────────────────────────────────────────────┐   │
│  │  Main Process (Node.js)                      │   │
│  │  ├── 系统音频 Loopback 采集 (WASAPI/SCKit)    │   │
│  │  ├── 麦克风采集 (候选人)                       │   │
│  │  ├── 悬浮答案窗口管理                          │   │
│  │  ├── 全局快捷键 / 截图 / 托盘                  │   │
│  │  ├── 剪贴板监听                               │   │
│  │  └── 局域网 HTTP Server（双端互联）            │   │
│  ├──────────────────────────────────────────────┤   │
│  │  Renderer Process (Next.js 复用)             │   │
│  │  ├── 主界面（转写 + 答案 + 设置）              │   │
│  │  └── 悬浮窗界面（精简答案展示）                 │   │
│  └──────────────────────────────────────────────┘   │
│                      │                              │
│                      │ WebSocket (音频流+控制)        │
│                      ▼                              │
│  ┌──────────────────────────────────────────────┐   │
│  │  Cloud Backend (FastAPI)                     │   │
│  │  ├── ASR Service                             │   │
│  │  ├── Question Detector                       │   │
│  │  ├── LLM Service (极速+精确双通道)            │   │
│  │  ├── Knowledge Base + Question Bank          │   │
│  │  ├── Session Manager                         │   │
│  │  └── Signaling Relay (fallback)              │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────┬───────────────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │  双端互联    │             │
    │  优先: 局域网│直连          │
    │  降级: 服务器│中转          │
    │             │             │
    ▼             ▼             ▼
┌──────────────────────────────────────┐
│         移动端（副屏/遥控端）          │
│                                      │
│  PWA 网页应用（手机/平板浏览器）        │
│  ┌──────────────────────────────┐    │
│  │  答案实时展示（大字体/暗色）    │    │
│  │  ├── 极速答案面板              │    │
│  │  ├── 精确答案面板              │    │
│  │  ├── Coding 代码面板           │    │
│  │  ├── 远程截图触发按钮           │    │
│  │  ├── 手动输入补充              │    │
│  │  └── 面试状态监控              │    │
│  └──────────────────────────────┘    │
└──────────────────────────────────────┘
```

### 2.2 双端互联通信方案

**核心设计：局域网直连优先，服务器中转降级**

OfferIN 的双端互联是其核心卖点，其本质是 PC 客户端在本机起一个 HTTP(S) Server，移动端通过局域网直接连接，无需经过云端。

```
方案 A（推荐，延迟 < 20ms）:
  PC 客户端启动时在本地起 HTTPS Server (自签证书, 端口如 18520)
  → 移动端通过局域网 IP 直连: https://192.168.x.x:18520
  → 数据走局域网 WebSocket，不经过云端
  → 适用场景：同一 WiFi / PC 开热点给手机

方案 B（降级，延迟 100-300ms）:
  PC 端 → 云端 WebSocket → 移动端
  → 复用现有 Session Manager 架构
  → 适用场景：不在同一局域网

方案 C（WebRTC P2P，备选）:
  通过云端 Signaling Server 交换 SDP/ICE
  → DataChannel 建立 P2P 连接
  → 适用场景：需要穿越 NAT
```

**连接建立流程**：

```
1. PC 客户端启动 → 启动本地 HTTPS Server → 获取局域网 IP
2. 生成连接信息: { ip, port, session_id, auth_token }
3. 展示连接方式:
   a. 二维码（含连接 URL）→ 手机扫码
   b. 连接码（6 位短码）→ 手动输入
   c. 局域网自动发现（mDNS/SSDP）
4. 移动端连接后，握手校验 auth_token
5. 建立 WebSocket 长连接，开始数据同步
6. 如果局域网连接失败 → 自动降级到云端中转
```

### 2.3 数据流分层

```
┌───────────────── PC 端内部数据流 ─────────────────┐
│                                                    │
│  系统音频 ──┐                                       │
│             ├──→ 双通道编码 ──→ WS 发送到后端         │
│  麦克风 ────┘         │                             │
│                       │                             │
│  后端返回 ◄────────────┘                             │
│  ├── transcript (转写)                              │
│  ├── question (问题检测)                             │
│  ├── answer_speed (极速答案)   ──┐                   │
│  └── answer_precise (精确答案) ──┤                   │
│                                  │                  │
│            ┌─────────────────────┘                  │
│            ▼                                        │
│  ┌─── 内部分发 ───┐                                  │
│  │                │                                 │
│  ▼                ▼                                 │
│  主窗口渲染     悬浮窗渲染                             │
│  (全功能)      (精简答案)                             │
│                                                    │
│            │ 同时推送到移动端                          │
│            ▼                                        │
│  局域网 WS 推送 ──→ 移动端渲染                        │
└────────────────────────────────────────────────────┘
```

---

## 三、PC 端详细设计

### 3.1 Electron 客户端目录结构

```
desktop/
├── main/                            # Electron 主进程
│   ├── index.ts                     # 入口，窗口管理
│   ├── audio/
│   │   ├── system-capture.ts        # 系统音频 loopback 采集
│   │   ├── mic-capture.ts           # 麦克风采集
│   │   └── audio-mixer.ts          # 双通道编码/混合
│   ├── overlay/
│   │   ├── overlay-window.ts        # 悬浮答案窗口
│   │   ├── coding-window.ts        # Coding 专用小窗
│   │   └── stealth.ts              # 隐身模式（防屏幕共享捕获）
│   ├── bridge/
│   │   ├── local-server.ts          # 局域网 HTTPS Server
│   │   ├── session-sync.ts          # 双端数据同步
│   │   └── discovery.ts            # 局域网设备发现
│   ├── capture/
│   │   ├── screenshot.ts           # 屏幕截图
│   │   ├── area-selector.ts        # 区域选择
│   │   └── window-monitor.ts       # 窗口变化监控（自动截图）
│   ├── shortcuts.ts                # 全局快捷键
│   ├── clipboard-watch.ts          # 剪贴板监听
│   ├── tray.ts                     # 系统托盘
│   ├── auto-updater.ts             # 自动更新
│   └── ipc-handlers.ts             # IPC 通信桥接
├── preload/
│   └── index.ts                    # 安全 API 暴露
├── renderer/                       # → 指向 frontend/（复用 Next.js）
├── resources/
│   ├── certs/                      # 自签 HTTPS 证书
│   └── icons/
├── electron-builder.yml
├── package.json
└── tsconfig.json
```

### 3.2 系统音频采集（突破浏览器限制）

```typescript
// main/audio/system-capture.ts

/**
 * 系统音频采集抽象层
 * Windows: WASAPI Loopback（零配置）
 * macOS: ScreenCaptureKit (macOS 13+) → 降级到 BlackHole 虚拟设备
 */
interface SystemAudioCapture {
  listOutputDevices(): Promise<AudioDevice[]>;
  startCapture(config: AudioCaptureConfig): Promise<void>;
  stopCapture(): Promise<void>;
  onAudioData(callback: (buffer: Buffer, source: 'system' | 'mic') => void): void;
  getLevel(): number;  // 0-100 音量
}

interface AudioCaptureConfig {
  sampleRate: 16000;
  channels: 1;
  bitDepth: 16;
  deviceId?: string;       // 指定音频输出设备
  bufferDurationMs: 500;   // 每帧时长
}

// Windows 实现要点:
//   - 使用 node-addon 封装 WASAPI Loopback
//   - 或使用 @aspect-build/audio-capture 库
//   - 自动选择默认输出设备

// macOS 实现要点:
//   - 优先使用 ScreenCaptureKit API (通过 native module)
//   - 降级引导用户安装 BlackHole: brew install blackhole-2ch
//   - 设置聚合设备(Multi-Output Device)将声音同时输出到耳机和 BlackHole
```

### 3.3 悬浮答案窗口

**对标 Cuemate 的不可点击独立浮窗 + OfferIN 的可调节设计**：

```typescript
// main/overlay/overlay-window.ts

interface OverlayWindowConfig {
  // 窗口属性
  width: number;          // 默认 420
  height: number;         // 默认 600
  x: number;              // 默认屏幕右侧
  y: number;              // 默认顶部偏下
  opacity: number;        // 0.3 ~ 1.0，默认 0.85

  // 行为属性
  alwaysOnTop: true;
  clickThrough: boolean;  // 鼠标穿透模式（对标 Cuemate）
  stealthMode: boolean;   // 隐身模式（屏幕共享不可见）
  autoHideOnIdle: number; // N 秒无新内容后自动隐藏，0=不隐藏

  // 显示模式
  displayMode: 'speed' | 'precise' | 'dual' | 'coding';
  fontSize: 'small' | 'medium' | 'large';  // 14/16/20px
  theme: 'dark' | 'light' | 'auto';
}

// Electron 窗口创建
function createOverlayWindow(config: OverlayWindowConfig): BrowserWindow {
  const overlay = new BrowserWindow({
    width: config.width,
    height: config.height,
    x: config.x,
    y: config.y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    hasShadow: false,
    focusable: !config.clickThrough,  // 穿透模式下不可聚焦
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
    },
  });

  // 鼠标穿透 — 对标 Cuemate 的"不可点击独立浮窗"
  if (config.clickThrough) {
    overlay.setIgnoreMouseEvents(true, { forward: true });
  }

  // 隐身模式 — 屏幕共享不可见
  if (config.stealthMode) {
    overlay.setContentProtection(true);  // macOS/Windows 均支持
  }

  return overlay;
}
```

**悬浮窗 UI 布局（极速/精确双栏模式）**：

```
┌──────────── 悬浮窗 (420×600) ────────────┐
│ 🟢 面试中 00:23:45  Q5    [⚙][—][×]     │
├──────────────────────────────────────────┤
│                                          │
│  Q: 请介绍 React 虚拟 DOM 的工作原理       │
│                                          │
├─────────────────┬────────────────────────┤
│  ⚡ 极速回答      │  🎯 精确回答             │
│                 │                        │
│  虚拟 DOM 是     │  React 的虚拟 DOM       │
│  React 的核心    │  (Virtual DOM) 本质     │
│  机制，它在内     │  上是一个轻量级的        │
│  存中维护一棵     │  JavaScript 对象树      │
│  JS 对象树作     │  ，作为真实 DOM 的       │
│  为真实 DOM 的   │  内存映射。当组件        │
│  映射...█       │  状态变化时...█          │
│                 │                        │
│  [📋] [🔄]      │  [📋] [🔄]              │
├─────────────────┴────────────────────────┤
│  透明度 ████████░░ 85%   [穿透] [隐身]    │
└──────────────────────────────────────────┘
```

### 3.4 全局快捷键体系

**对标 OfferIN 的快捷键 + 剪贴板联动设计**：

```typescript
// main/shortcuts.ts

const SHORTCUT_MAP = {
  // ===== 核心操作 =====
  'CommandOrControl+Shift+Space':     'toggle-recording',       // 开始/暂停录音
  'CommandOrControl+Shift+Enter':     'trigger-quick-answer',   // 手动触发快答
  'CommandOrControl+Shift+Backspace': 'regenerate-answer',      // 重新生成当前答案
  'Escape':                           'stop-current-answer',    // 停止生成

  // ===== 悬浮窗控制 =====
  'CommandOrControl+Shift+H':         'toggle-overlay',         // 显示/隐藏悬浮窗
  'CommandOrControl+Shift+Up':        'increase-overlay-opacity',// 透明度 +10%
  'CommandOrControl+Shift+Down':      'decrease-overlay-opacity',// 透明度 -10%
  'CommandOrControl+Shift+T':         'toggle-click-through',   // 切换鼠标穿透

  // ===== 模式切换 =====
  'CommandOrControl+Shift+1':         'mode-speed',             // 极速模式
  'CommandOrControl+Shift+2':         'mode-precise',           // 精确模式
  'CommandOrControl+Shift+3':         'mode-dual',              // 双模式并排
  'CommandOrControl+Shift+4':         'mode-coding',            // Coding 模式

  // ===== 截图 & 笔试 =====
  'CommandOrControl+Shift+S':         'screenshot-area',        // 区域截图 OCR
  'CommandOrControl+Shift+A':         'screenshot-auto-toggle', // 自动截图开关

  // ===== 答案操作 =====
  'CommandOrControl+Shift+C':         'copy-latest-answer',     // 复制最新答案
};
```

**剪贴板联动（对标 OfferIN）**：

```typescript
// main/clipboard-watch.ts
// 在 PC 上复制任何文本，自动发送到移动端展示 + 可选触发快答

class ClipboardWatcher {
  private lastText: string = '';

  start() {
    setInterval(() => {
      const currentText = clipboard.readText();
      if (currentText !== this.lastText && currentText.length > 5) {
        this.lastText = currentText;
        bridgeServer.broadcastToViewers({
          type: 'clipboard_sync',
          text: currentText,
        });
        if (settings.clipboardAutoAnswer) {
          answerEngine.triggerQuickAnswer(currentText);
        }
      }
    }, 500);
  }
}
```

### 3.5 局域网互联服务

**PC 端作为 Server，移动端作为 Client**：

```typescript
// main/bridge/local-server.ts

class LocalBridgeServer {
  private httpsServer: https.Server;
  private wss: WebSocketServer;
  private viewers: Map<WebSocket, ViewerInfo> = new Map();
  private sessionId: string;
  private authToken: string;

  constructor() {
    this.sessionId = generateShortId(6);   // 6 位连接码
    this.authToken = generateSecureToken(); // 安全令牌
  }

  async start(port: number = 18520): Promise<ConnectionInfo> {
    const { key, cert } = await loadOrGenerateCert();
    this.httpsServer = https.createServer({ key, cert });
    this.wss = new WebSocketServer({ server: this.httpsServer });

    this.wss.on('connection', (ws, req) => {
      this.handleViewerConnection(ws, req);
    });

    this.httpsServer.listen(port);
    const lanIP = this.getLanIP();

    return {
      ip: lanIP,
      port,
      sessionId: this.sessionId,
      authToken: this.authToken,
      connectUrl: `https://${lanIP}:${port}/mobile?s=${this.sessionId}`,
      connectCode: this.sessionId,
    };
  }

  /** 向所有已连接的移动端推送消息 */
  async broadcastToViewers(message: BridgeMessage): Promise<void> {
    const data = JSON.stringify(message);
    for (const [ws] of this.viewers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  /** 处理来自移动端的控制命令 */
  private handleViewerMessage(ws: WebSocket, message: ViewerCommand): void {
    switch (message.type) {
      case 'trigger_answer':
        answerEngine.triggerQuickAnswer(message.text);
        break;
      case 'remote_screenshot':
        screenshotService.captureAndProcess(message.mode);
        break;
      case 'stop_answer':
        answerEngine.stopCurrent();
        break;
      case 'change_mode':
        overlayWindow.setDisplayMode(message.mode);
        break;
      case 'manual_input':
        answerEngine.triggerQuickAnswer(message.question);
        break;
    }
  }

  private getLanIP(): string {
    const interfaces = networkInterfaces();
    for (const name in interfaces) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) return iface.address;
      }
    }
    return '127.0.0.1';
  }
}
```

### 3.6 双端互联消息协议

```typescript
// ===== PC → 移动端 =====
type PCToMobileMessage =
  | { type: 'session_info'; sessionId: string; startTime: number }
  | { type: 'status'; recording: boolean; duration: number; questionCount: number }
  | { type: 'transcript'; text: string; speaker: 'interviewer' | 'candidate'; isFinal: boolean }
  | { type: 'question'; id: string; text: string }
  | { type: 'answer_speed'; questionId: string; delta: string; done: boolean }
  | { type: 'answer_precise'; questionId: string; delta: string; done: boolean }
  | { type: 'answer_coding'; questionId: string; step: number; label: string; content: string; done: boolean }
  | { type: 'exam_answer'; questionId: string; delta: string; done: boolean; screenshot?: string }
  | { type: 'clipboard_sync'; text: string }
  | { type: 'ping' };

// ===== 移动端 → PC =====
type MobileToPCMessage =
  | { type: 'manual_input'; question: string }
  | { type: 'trigger_answer'; text?: string }
  | { type: 'remote_screenshot'; mode: 'full' | 'area' | 'window' }
  | { type: 'stop_answer' }
  | { type: 'regenerate'; questionId: string }
  | { type: 'change_mode'; mode: 'speed' | 'precise' | 'dual' | 'coding' }
  | { type: 'change_style'; style: 'brief' | 'standard' | 'detailed' }
  | { type: 'pong' };
```

---

## 四、移动端详细设计

### 4.1 设计定位

移动端是答案的**安全展示终端**和**远程遥控器**。在屏幕共享场景下，移动端实现了完全的物理隔离——面试官永远看不到手机上的内容。

### 4.2 页面路由

```
/mobile                         → 连接入口页（扫码 / 输入连接码）
/mobile/connect?s=xxx&t=xxx     → 自动连接（扫码直达）
/mobile/interview               → 面试答案展示（核心页面）
/mobile/exam                    → 笔试答案展示
/mobile/settings                → 移动端设置
```

### 4.3 移动端面试页 UI（竖屏）

```
┌────────── 手机竖屏 375×812 ──────────────┐
│ 🟢 局域网已连接 │ 25:03 │ Q7     [⚙]     │
├──────────────────────────────────────────┤
│                                          │
│  ┌─ 最新问题 ────────────────────────┐   │
│  │ Q: React 虚拟 DOM 的工作原理       │   │
│  └────────────────────────────────────┘   │
│                                          │
│  ┌─ ⚡ 极速 ─────────────────────────┐   │
│  │  虚拟 DOM 是 React 的核心机制，    │   │
│  │  它在内存中维护一棵 JS 对象树作    │   │
│  │  为真实 DOM 的映射。当状态变化     │   │
│  │  时，React 会创建新的虚拟 DOM      │   │
│  │  树，通过 Diff 算法比较差异，      │   │
│  │  最终只更新变化的部分到真实        │   │
│  │  DOM 上。█                        │   │
│  │                     [📋复制]       │   │
│  └────────────────────────────────────┘   │
│                                          │
│  ┌─ 🎯 精确 ─────────────────────────┐   │
│  │  React 的 Virtual DOM 核心工作流   │   │
│  │  包含三个关键步骤:                 │   │
│  │  首先是 createElement 创建虚拟     │   │
│  │  节点...█                        │   │
│  │                     [📋复制]       │   │
│  └────────────────────────────────────┘   │
│                                          │
│  ┌─ 历史 Q6 (点击展开) ──────────────┐   │
│  │ Q: 说说你对微前端的理解            │   │
│  └────────────────────────────────────┘   │
│                                          │
├──────────────────────────────────────────┤
│  [📸截图] [✏️提问] [⏹停止]   ⚡●○🎯      │
└──────────────────────────────────────────┘
```

### 4.4 移动端面试页 UI（横屏/平板）

```
┌──────────────────── 平板横屏 1024×768 ────────────────────┐
│ 🟢 已连接 │ 25:03 │ Q7                          [⚙]      │
├──────────────────────┬────────────────────────────────────┤
│                      │                                    │
│  历史问题列表          │  当前答案                           │
│                      │                                    │
│  ● Q7 虚拟 DOM  生成中 │ ┌─ ⚡ 极速 ──────────────────────┐ │
│  ✓ Q6 微前端      完成 │ │  虚拟 DOM 是 React 的核心...   │ │
│  ✓ Q5 项目经验    完成 │ │  █                            │ │
│  ✓ Q4 性能优化    完成 │ └───────────────────────────────┘ │
│  ✓ Q3 TypeScript  完成 │ ┌─ 🎯 精确 ──────────────────────┐ │
│  ✓ Q2 CSS 布局    完成 │ │  React 的 Virtual DOM...      │ │
│  ✓ Q1 自我介绍    完成 │ │  █                            │ │
│                      │ └───────────────────────────────┘ │
├──────────────────────┴────────────────────────────────────┤
│  [📸远程截图] [✏️手动提问]  [⏹停止]   模式: ⚡极速 ●○ 🎯精确  │
└───────────────────────────────────────────────────────────┘
```

### 4.5 答案展示优化

```typescript
// 自动滚动策略（对标 OfferWing）
const scrollConfig = {
  autoScroll: true,
  pauseOnUserTouch: true,       // 用户触摸时暂停
  resumeAfterIdleMs: 5000,      // 5 秒无操作后恢复
  resumeOnScrollToBottom: true, // 手动滑到底部时恢复
};

// 字号自适应
const fontSizes = {
  small: '14px',    // 信息密度高，适合平板
  medium: '17px',   // 默认
  large: '21px',    // 远距离查看
};
```

---

## 五、极速/精确双模式回答引擎

### 5.1 设计思路

**对标 OfferIN 的双模式并发**：系统同时触发两路生成，前端并排展示，用户自行取优。

```
面试问题检测到
    │
    ├──→ 极速通道（直接 LLM，无检索）
    │    ├── 延迟：首 token < 1s
    │    ├── 优点：响应快，适合简单问题
    │    └── 缺点：可能有幻觉
    │
    └──→ 精确通道（RAG + 联网搜索 + LLM）
         ├── 延迟：首 token 3-8s
         ├── 优点：答案准确，有事实依据
         └── 缺点：较慢
```

### 5.2 后端实现

```python
# backend/services/dual_answer_engine.py

class DualAnswerEngine:
    """极速/精确双模式并发引擎"""

    async def generate_dual(
        self,
        question: str,
        resume_context: str = "",
        conversation_history: list[str] = [],
        knowledge_base_id: str | None = None,
    ) -> AsyncGenerator[AnswerChunk, None]:
        """同时启动极速和精确两路生成，交替 yield 结果"""

        speed_gen = self._speed_channel(question, resume_context, conversation_history)
        precise_gen = self._precise_channel(
            question, resume_context, conversation_history, knowledge_base_id
        )

        # 并发运行两个通道
        async for chunk in self._merge_streams(speed_gen, precise_gen):
            yield chunk

    async def _speed_channel(self, question, resume_context, history):
        """极速通道：直接调用 LLM，无额外检索"""
        prompt = self._build_speed_prompt(question, resume_context, history)
        async for token in self.llm_service.generate_answer(prompt):
            yield AnswerChunk(channel="speed", delta=token, done=False)
        yield AnswerChunk(channel="speed", delta="", done=True)

    async def _precise_channel(self, question, resume_context, history, kb_id):
        """精确通道：知识库 + 题库 + 向量检索 → LLM"""
        # 1. 知识库匹配（命中则零延迟返回）
        if kb_id:
            kb_match = await self.knowledge_base.match(kb_id, question)
            if kb_match:
                yield AnswerChunk(channel="precise", delta=kb_match.answer, done=True)
                return

        # 2. 题库检索
        bank_results = await self.question_bank.search(question, limit=3)

        # 3. 向量语义检索
        vector_results = await self.embedding_service.search(
            query=question, collections=["resume", "knowledge"], top_k=5
        )

        # 4. 合并上下文 → LLM
        context = self._merge_contexts(bank_results, vector_results, resume_context)
        prompt = self._build_precise_prompt(question, context, history)

        async for token in self.llm_service.generate_answer(prompt):
            yield AnswerChunk(channel="precise", delta=token, done=False)
        yield AnswerChunk(channel="precise", delta="", done=True)


@dataclass
class AnswerChunk:
    channel: str   # "speed" | "precise" | "coding"
    delta: str
    done: bool
```

### 5.3 WebSocket 协议扩展

```python
# 旧格式 (MVP):
{"type": "answer", "question_id": "q_xxx", "delta": "...", "done": false}

# 新格式 (双模式):
{"type": "answer_speed", "question_id": "q_xxx", "delta": "...", "done": false}
{"type": "answer_precise", "question_id": "q_xxx", "delta": "...", "done": false}

# Coding 模式:
{"type": "answer_coding", "question_id": "q_xxx", "step": 1, "label": "思路", "content": "...", "done": false}
```

---

## 六、Coding 专用小窗

### 6.1 UI 设计

```
┌──────────── Coding 小窗 (500×700) ─────────────┐
│ 💻 Coding Mode │ Python ▾ │ Q: 两数之和   [×]  │
├────────────────────────────────────────────────┤
│  ┌─ 💡 思路 ──────────────────────────────┐    │
│  │  使用哈希表存储已遍历元素，遍历时       │    │
│  │  检查 target-num 是否在哈希表中。       │    │
│  └─────────────────────────────────────────┘    │
│  ┌─ 📝 完整代码 ──────────────────────────┐    │
│  │  def twoSum(nums, target):             │    │
│  │      seen = {}                         │    │
│  │      for i, num in enumerate(nums):    │    │
│  │          if target - num in seen:      │    │
│  │              return [seen[target-num],  │    │
│  │                      i]                │    │
│  │          seen[num] = i                 │    │
│  │      return []                         │    │
│  │                                        │    │
│  │  # 时间复杂度: O(n)                    │    │
│  │  # 空间复杂度: O(n)                    │    │
│  └─────────────────────────────────────────┘    │
│  [📋 复制代码] [🔄 换语言] [📤 发到移动端]       │
└────────────────────────────────────────────────┘
```

支持语言切换：Python / Java / C++ / JavaScript / TypeScript / Go / Rust

---

## 七、语音触发词

**对标 OfferIN**：用户自定义触发词（如"让我想想"），ASR 识别到候选人说出触发词时自动触发快答。

```python
# backend/services/voice_trigger.py

class VoiceTriggerService:
    default_phrases = ["让我想想", "这个问题", "稍等", "嗯让我思考一下", "well let me think"]

    def __init__(self):
        self.trigger_phrases: list[str] = []

    def check_trigger(self, transcript_text: str, speaker: str) -> bool:
        """只检查候选人发言是否包含触发词"""
        if speaker != 'candidate':
            return False
        phrases = self.trigger_phrases or self.default_phrases
        text_lower = transcript_text.lower().strip()
        return any(p.lower() in text_lower for p in phrases)
```

前端设置页新增「语音触发词」：输入框用英文逗号分隔，默认关闭。

---

## 八、新增路由汇总

```python
# ===== Session & 双端互联 =====
POST   /api/session/create             # 创建面试 Session
GET    /api/session/{id}/connect-info   # 获取连接信息（IP/端口/二维码）
DELETE /api/session/{id}                # 销毁 Session

# ===== WebSocket 端点升级 =====
ws://host/ws/audio?session={id}         # PC 端音频流（绑定 session）
ws://host/ws/viewer?session={id}        # 移动端只读（云端中转 fallback）
ws://host/ws/signal/{session_id}        # WebRTC signaling（P2P fallback）

# ===== 答案控制 =====
POST   /api/answer/trigger              # 手动触发快答
POST   /api/answer/regenerate           # 重新生成
POST   /api/answer/stop                 # 停止生成
PUT    /api/answer/mode                 # 切换模式

# ===== 语音触发词 =====
GET    /api/settings/voice-triggers     # 获取触发词配置
PUT    /api/settings/voice-triggers     # 更新触发词
```

---

## 九、前端新增文件汇总

```
frontend/src/
├── app/
│   ├── mobile/                          # 移动端页面
│   │   ├── page.tsx                     # 连接入口（扫码/输入码）
│   │   ├── interview/page.tsx           # 面试答案展示
│   │   ├── exam/page.tsx               # 笔试答案展示
│   │   └── settings/page.tsx           # 移动端设置
│   └── desktop/                         # 桌面端专属
│       ├── overlay/page.tsx             # 悬浮窗内容页
│       ├── coding/page.tsx             # Coding 小窗内容页
│       └── screenshot/page.tsx         # 截图选区页
├── components/
│   ├── dual-answer/
│   │   ├── DualAnswerPanel.tsx          # 双模式答案并排面板
│   │   ├── SpeedAnswerPane.tsx          # 极速答案区
│   │   ├── PreciseAnswerPane.tsx        # 精确答案区
│   │   └── CodingAnswerPane.tsx         # Coding 答案区
│   ├── overlay/
│   │   ├── OverlayContent.tsx           # 悬浮窗内容
│   │   └── OverlayToolbar.tsx           # 悬浮窗工具栏
│   ├── mobile/
│   │   ├── MobileAnswerCard.tsx         # 移动端答案卡片
│   │   ├── MobileQuickBar.tsx           # 底部快捷操作栏
│   │   └── RemoteScreenshotBtn.tsx      # 远程截图按钮
│   └── connect/
│       ├── QRCodeDisplay.tsx            # 二维码展示
│       └── ConnectCodeInput.tsx         # 连接码输入
├── hooks/
│   ├── useBridgeConnection.ts           # 双端互联管理
│   ├── useDualAnswer.ts                # 双模式答案状态
│   └── useRemoteControl.ts            # 远程控制
└── stores/
    ├── connectionStore.ts              # 双端连接状态
    └── dualAnswerStore.ts             # 双模式答案状态
```

---

## 十、新增依赖

**桌面端** (desktop/package.json):
```json
{
  "electron": "^33.0.0",
  "electron-builder": "^25.0.0",
  "ws": "^8.18.0",
  "selfsigned": "^2.4.0",
  "electron-updater": "^6.3.0"
}
```

**前端新增**: `"qrcode.react": "^4.0.0"`

**后端新增**: `qrcode>=7.4.0`, `Pillow>=10.0.0`

---

## 十一、打包与分发

```yaml
# desktop/electron-builder.yml
appId: com.interview-copilot.desktop
productName: 面试通

mac:
  target: [dmg, zip]
  icon: resources/icons/icon.icns
  hardenedRuntime: true
  category: public.app-category.productivity

win:
  target: [nsis, portable]
  icon: resources/icons/icon.ico

linux:
  target: [AppImage, deb]
  category: Utility

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true

publish:
  provider: github
  owner: your-org
  repo: interview-copilot-desktop
```

---

## 十二、开发里程碑

```
Phase 1 — 基础双端 (2.5 周)
  Week 1:    Electron 壳 + 系统音频采集 + 后端 WebSocket 对接
  Week 2:    局域网 HTTPS Server + 移动端连接入口 + 基础答案同步
  Week 2.5:  二维码/连接码 + 断线重连

Phase 2 — 悬浮窗 + 体验 (2 周)
  Week 3:    悬浮窗创建 + 渲染 + 透明度/位置/大小调节
  Week 4:    隐身模式 + 鼠标穿透 + 全局快捷键

Phase 3 — 双模式 + 高级能力 (2 周)
  Week 5:    极速/精确双模式引擎 + 前端双栏展示
  Week 6:    Coding 小窗 + 远程截图遥控 + 剪贴板联动

Phase 4 — 打磨 + 发布 (1.5 周)
  Week 7:    语音触发词 + 多模型选择 + 延迟监控
  Week 7.5:  全平台打包测试(Win/Mac) + 自动更新

总计: 约 8 周
```

---

## 十三、与现有三期规划的关系

本文档**替代并升级**三期设计文档中以下章节：

| 三期原规划 | 本文档替代章节 | 升级点 |
|-----------|-------------|-------|
| §13 桌面客户端 | 三、PC端详细设计 | 增加隐身模式、剪贴板联动、局域网Server |
| §14 双端互联(WebRTC) | 二、双端互联通信方案 | 局域网直连优先，WebRTC 降为备选 |
| §6 移动端副屏 | 四、移动端详细设计 | 增加远程遥控、双模式展示、Coding面板 |
| §13.5 悬浮窗 | 三-3.3 悬浮答案窗口 | 增加穿透/隐身模式、双栏布局 |
| §13.6 全局快捷键 | 三-3.4 全局快捷键 | 增加快答/重答/模式切换/剪贴板 |
| §16 算法题模式 | 六、Coding专用小窗 | 独立窗口，语言切换，发送到移动端 |
| (无) | 五、极速/精确双模式 | **全新能力**，对标 OfferIN |
| (无) | 七、语音触发词 | **全新能力**，对标 OfferIN |

三期中**不受影响**的章节（继续按原计划执行）：§15 笔试辅助、§17 用户系统、§18 向量知识库。

---

## 十四、竞争力自评

实现本方案后的能力覆盖：

| 维度 | vs OfferIN | vs Cuemate | vs 白瓜 | vs OfferWing |
|------|-----------|------------|--------|-------------|
| 双端互联 | ✅ 局域网直连 | 超越 | ✅ 物理隔离 | 超越 |
| 悬浮窗隐身 | ✅ | ✅ 穿透+隐身 | ✅ | 超越 |
| 极速/精确双模式 | ✅ | 超越 | 超越 | 超越 |
| 远程截图遥控 | ✅ | 超越 | 超越 | ✅ |
| 语音触发词 | ✅ | 超越 | 超越 | 超越 |
| 系统音频采集 | ✅ | ✅ | ✅ | 超越 |
| 知识库+题库 | 超越(更完善) | 超越 | 超越 | 超越 |
| 简历个性化 | 超越(结构化解析) | 超越 | 超越 | 持平 |

**核心优势**：本系统在后端智能（简历深度解析、知识库语义匹配、向量检索 RAG、面试复盘）上已显著超越多数竞品。本文档补齐「端」层面短板后，形成**后端智能 + 双端体验**的完整竞争闭环。
