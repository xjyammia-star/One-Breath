# 一炁堂 / One Breath

> 阴阳·五行·八卦 AI分析平台  
> Ancient Chinese wisdom meets modern AI

---

## 项目结构

```
yiqitang/
├── src/
│   ├── pages/
│   │   ├── Landing.tsx     # 落地页（水墨风）
│   │   ├── Setup.tsx       # 建立命盘（生辰输入）
│   │   └── Dashboard.tsx   # 主仪表板（三大模块）
│   ├── utils/
│   │   ├── bazi.ts         # 八字推算
│   │   ├── calendar.ts     # 公历转农历
│   │   └── ai.ts           # DeepSeek AI调用
│   ├── styles/
│   │   └── global.css      # 全局中国风样式
│   ├── types.ts            # TypeScript类型定义
│   ├── App.tsx             # 主路由
│   └── main.tsx            # 入口
├── vectorize_corpus.py     # 向量化预处理脚本
├── .env.example            # 环境变量模板
├── package.json
├── vite.config.ts
└── vercel.json
```

---

## 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/xjyammia-star/yiqitang.git
cd yiqitang
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，填入你的 API Keys
```

需要的变量：
- `VITE_DEEPSEEK_API_KEY` — [DeepSeek 控制台](https://platform.deepseek.com/) 获取
- `DATABASE_URL` — 从 Neon 控制台获取（向量化脚本用）

### 4. 本地开发

```bash
npm run dev
# 访问 http://localhost:3000
```

### 5. 构建部署

```bash
npm run build
# dist/ 目录上传 Vercel
```

---

## 向量化预处理（知识图谱）

把 `ancient_corpus.jsonl` 和 `kg_triples.json` 放在与脚本同目录：

```bash
# 安装Python依赖
pip install psycopg2-binary openai python-dotenv tqdm

# 运行向量化
python vectorize_corpus.py
```

完成后，Neon 数据库中会有 `corpus_chunks` 表，存储所有向量化后的古籍语料。

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite |
| 样式 | 纯CSS（水墨中国风） |
| AI | DeepSeek V3 |
| 数据库 | Neon PostgreSQL + pgvector |
| 部署 | Vercel |
| 双语 | 中文/英文切换 |

---

## 三大模块

| 模块 | 英文 | 功能 |
|---|---|---|
| 与己 | The Self | 八字命盘·五行·格局分析 |
| 与人 | Relations | 合婚·人际关系·缘分 |
| 与世界 | The World | 时运·流年·世界能量 |

---

## 设计理念

> 水墨山水 · 太极八卦 · 墨黑宣纸 · 朱砂点缀  
> 精致神秘，道家哲学，避免俗气

---

*道可道，非常道。The Tao that can be told is not the eternal Tao.*
