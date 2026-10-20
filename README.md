# AI 狼人杀 · 同步观战

基于 React、TypeScript 和 Supabase 的 AI 狼人杀观战应用：12 个 AI 玩家进行对局，房主推进或重开，观众通过分享链接同步观看。

[演示入口](https://feature-watch-together.vercel.app) · [运行与部署](#本地运行) · [来源与许可](#来源与许可)

本项目基于开源项目 AI Werewolf Live 改造。下面列出当前版本的改造重点与代码入口，便于了解实现范围。

## 改造重点

| 方向 | 实现内容 | 代码入口 |
| --- | --- | --- |
| 房间同步 | 使用 Supabase 保存房间快照并订阅更新，展示连接与同步状态 | [useRoomSession.ts](src/hooks/useRoomSession.ts) |
| 房主权限 | 区分房主控制与只读观战；更新接口校验房间 ID 和房主凭证 | [roomAuth.ts](api/_shared/roomAuth.ts)、[update.ts](api/rooms/update.ts) |
| 模型接入 | 在服务端配置供应商和密钥，统一转发模型请求并处理超时 | [providerRegistry.ts](api/_shared/providerRegistry.ts)、[ai-chat.ts](api/ai-chat.ts) |
| 对局信息 | 整理公开信息、玩家私有信息与局势摘要，供 AI 决策使用 | [informationService.ts](src/services/informationService.ts) |
| 部署与验证 | 配置 Vercel API Routes、Supabase 数据表和本地自检脚本 | [vercel.json](vercel.json)、[schema.sql](supabase/schema.sql)、[self-check.ts](scripts/self-check.ts) |

## 功能

- 支持 Vercel 部署，AI API Key 只放在服务端环境变量里。
- 支持 Supabase 房间同步：房主链接可控制对局，观众链接只读观战。
- 支持多模型编队，可混用 OpenAI、DeepSeek、豆包、通义千问、智谱 GLM、Kimi、Gemini 等供应商。
- 12 个 AI 玩家一起推进，角色职业随机分配，不固定绑定供应商。
- 有公开发言、内心思考、时间轴回放、玩家卡片状态和局势感知摘要。
- 胜负结算按狼人杀常见规则处理：狼人归零好人赢；狼人数量达到存活人数一半，或民/神一边归零，狼人赢。
- 默认不依赖服务端 TTS；可以使用浏览器语音播放发言。

## 技术栈

- React 18
- TypeScript
- Vite
- Vercel API Routes
- Supabase

## 本地运行

```bash
npm install
npm run dev
```

如果要本地同时跑 Vercel API Routes：

```bash
npx vercel dev
```

验证与构建：

```bash
npm run selfcheck
npm run build
```

`npm run dev` 只启动前端；完整的模型调用和房间功能需要服务端环境变量、Supabase 配置，以及 Vercel API Routes。

## 环境变量

复制 `.env.example`，在本地使用 `.env.local`。不要提交真实 key。

浏览器可见变量：

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

服务端私密变量：

```text
SUPABASE_SERVICE_ROLE_KEY
ROOM_TOKEN_SECRET
OPENAI_API_KEY
OPENAI_MODEL
GEMINI_API_KEY
DEEPSEEK_API_KEY
DEEPSEEK_MODEL
DOUBAO_API_KEY
DOUBAO_MODEL
ALIYUN_API_KEY
ALIYUN_MODEL
MOONSHOT_API_KEY
MINIMAX_API_KEY
ZHIPU_API_KEY
TENCENT_API_KEY
GROQ_API_KEY
```

除了 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`，其他模型或服务端 key 都不要使用 `VITE_` 前缀。

## Supabase 配置

1. 创建 Supabase 项目。
2. 打开 SQL Editor。
3. 执行 `supabase/schema.sql`。
4. 在 Vercel 里配置 Supabase URL、Anon Key、Service Role Key。

## Vercel 部署

1. 导入这个 GitHub 仓库。
2. 添加 `.env.example` 里需要的环境变量。
3. 部署后访问根路径 `/` 创建房间。
4. 房主在创建房间的同一浏览器中使用 `/room/<roomId>?host=1`；控制权还依赖本地保存的房主凭证。
5. 朋友使用 `/room/<roomId>` 只读观战。

## 安全说明

所有模型 Key、Supabase Service Role Key、房间 Token Secret 都应只保存在 Vercel 环境变量或本地 `.env.local`，不要提交到仓库。

如果不小心提交过真实 key，应立刻到对应平台撤销并重新生成。

## 项目缘起

这个项目最初来自“异地一起看海”的想法：让朋友在不同地点，也能一起看一场 AI 狼人杀。围绕这个使用场景，逐步补齐房间同步、观战分享和部署流程。

## 来源与许可

本项目基于开源项目 AI Werewolf Live 改造而来，并保留 MIT License。当前仓库的重点改造方向是远程同步观战、多模型 AI 编队、Vercel/Supabase 部署、公开/私密信息隔离和局势记忆。

License: MIT
