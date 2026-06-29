# 狼人杀

一个面向“异地一起看海”的 AI 狼人杀观战项目：12 个 AI 玩家自动完成狼人杀对局，房主负责推进/重开，朋友通过只读链接同步观战。

线上版本：[https://feature-watch-together.vercel.app](https://feature-watch-together.vercel.app)

## 这个版本做了什么

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
4. 房主使用 `/room/<roomId>?host=1`。
5. 朋友使用 `/room/<roomId>` 只读观战。

## 安全说明

公开仓库不包含真实 API Key。所有模型 Key、Supabase Service Role Key、房间 Token Secret 都应该只存在于 Vercel 环境变量或本地 `.env.local`。

如果不小心提交过真实 key，应立刻到对应平台撤销并重新生成。

## 来源与许可

本项目基于开源项目 AI Werewolf Live 改造而来，并保留 MIT License。当前仓库的重点改造方向是远程同步观战、多模型 AI 编队、Vercel/Supabase 部署、公开/私密信息隔离和局势记忆。

License: MIT
