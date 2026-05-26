"""
一炁堂 / One Breath — 向量化预处理脚本
=========================================
功能：
  1. 读取 ancient_corpus.jsonl 和 kg_triples.json
  2. 切块（chunk）处理
  3. 用 OpenAI text-embedding-3-small（或本地模型）生成向量
  4. 存入 Neon PostgreSQL + pgvector

使用方法：
  1. pip install psycopg2-binary openai python-dotenv tqdm
  2. 在同目录创建 .env 文件，填入：
       DATABASE_URL=postgresql://...（从Neon控制台复制）
       OPENAI_API_KEY=sk-...（或使用DeepSeek兼容接口）
  3. python vectorize_corpus.py
"""

import json
import os
import time
import hashlib
from pathlib import Path
from typing import Optional

import psycopg2
from psycopg2.extras import execute_values
from openai import OpenAI
from dotenv import load_dotenv
from tqdm import tqdm

# ─── 配置 ───────────────────────────────────────────────────────────────────

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# 向量维度（text-embedding-3-small = 1536）
EMBEDDING_DIM = 1536
EMBEDDING_MODEL = "text-embedding-3-small"

# 切块参数
CHUNK_MAX_CHARS = 800   # 每块最大字符数
CHUNK_OVERLAP = 100     # 块间重叠字符数

# 批处理大小（每批发送给embedding API）
BATCH_SIZE = 20

# 文件路径（默认在同目录下）
CORPUS_FILE = Path("ancient_corpus.jsonl")
KG_FILE = Path("kg_triples.json")

# ─── 初始化 ──────────────────────────────────────────────────────────────────

client = OpenAI(api_key=OPENAI_API_KEY)


def get_db_connection():
    """连接Neon PostgreSQL"""
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    return conn


def setup_database(conn):
    """建表：启用pgvector，创建向量表"""
    with conn.cursor() as cur:
        # 启用pgvector扩展
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")

        # 古籍语料向量表
        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS corpus_chunks (
                id          SERIAL PRIMARY KEY,
                chunk_hash  TEXT UNIQUE NOT NULL,
                source_id   TEXT,
                source_type TEXT,        -- 'corpus' 或 'kg_triple'
                title       TEXT,
                category    TEXT,
                text        TEXT NOT NULL,
                metadata    JSONB,
                embedding   vector({EMBEDDING_DIM}),
                created_at  TIMESTAMPTZ DEFAULT NOW()
            );
        """)

        # 向量索引（IVFFlat，适合百万级以下）
        cur.execute(f"""
            CREATE INDEX IF NOT EXISTS corpus_chunks_embedding_idx
            ON corpus_chunks
            USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100);
        """)

        conn.commit()
        print("✅ 数据库表和索引已创建")


# ─── 切块逻辑 ─────────────────────────────────────────────────────────────────

def chunk_text(text: str, max_chars: int = CHUNK_MAX_CHARS, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """
    将长文本切成带重叠的块。
    优先在句子边界（。！？；\n）处切割。
    """
    if len(text) <= max_chars:
        return [text]

    chunks = []
    start = 0
    while start < len(text):
        end = start + max_chars

        if end >= len(text):
            chunks.append(text[start:])
            break

        # 在max_chars范围内找最近的句子边界
        boundary = -1
        for sep in ["。", "！", "？", "；", "\n", "，"]:
            pos = text.rfind(sep, start, end)
            if pos > boundary:
                boundary = pos

        if boundary > start:
            end = boundary + 1
        # 否则强制在max_chars处切

        chunks.append(text[start:end])
        start = end - overlap  # 带重叠

    return [c for c in chunks if c.strip()]


def text_hash(text: str) -> str:
    return hashlib.md5(text.encode("utf-8")).hexdigest()


# ─── 读取语料 ─────────────────────────────────────────────────────────────────

def load_corpus_records() -> list[dict]:
    """读取 ancient_corpus.jsonl"""
    if not CORPUS_FILE.exists():
        print(f"⚠️  找不到 {CORPUS_FILE}，跳过")
        return []

    records = []
    with open(CORPUS_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                records.append(obj)
            except json.JSONDecodeError as e:
                print(f"  跳过无效行: {e}")

    print(f"📖 古籍语料：读取 {len(records)} 条记录")
    return records


def load_kg_triples() -> list[dict]:
    """读取 kg_triples.json"""
    if not KG_FILE.exists():
        print(f"⚠️  找不到 {KG_FILE}，跳过")
        return []

    with open(KG_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 支持两种格式：直接列表 或 {"triples": [...]}
    if isinstance(data, list):
        triples = data
    elif isinstance(data, dict):
        triples = data.get("triples", data.get("data", []))
    else:
        triples = []

    print(f"🕸️  知识图谱：读取 {len(triples)} 条三元组")
    return triples


# ─── 构建待向量化的文本块 ──────────────────────────────────────────────────────

def build_chunks_from_corpus(records: list[dict]) -> list[dict]:
    """
    将古籍语料转为chunk列表。
    假设每条记录有 id/source、title/name、text/content、category 等字段
    （字段名不固定，做兼容处理）。
    """
    all_chunks = []

    for rec in records:
        # 兼容不同字段名
        source_id = str(rec.get("id", rec.get("source_id", rec.get("doc_id", ""))))
        title     = rec.get("title", rec.get("name", rec.get("book", "")))
        category  = rec.get("category", rec.get("type", rec.get("domain", "")))
        text      = rec.get("text", rec.get("content", rec.get("body", "")))

        if not text:
            continue

        # 切块
        sub_chunks = chunk_text(text)
        for i, chunk in enumerate(sub_chunks):
            all_chunks.append({
                "source_id":   source_id,
                "source_type": "corpus",
                "title":       title,
                "category":    category,
                "text":        chunk,
                "metadata":    {
                    "chunk_index": i,
                    "total_chunks": len(sub_chunks),
                    "original_keys": list(rec.keys()),
                },
            })

    print(f"  → 古籍语料生成 {len(all_chunks)} 个文本块")
    return all_chunks


def build_chunks_from_kg(triples: list[dict]) -> list[dict]:
    """
    将知识图谱三元组转为自然语言描述块。
    支持 {subject, predicate, object} 或 {head, relation, tail} 格式。
    每N条三元组合并为一块，提高向量语义密度。
    """
    GROUP_SIZE = 5  # 每块包含的三元组数量
    all_chunks = []

    for i in range(0, len(triples), GROUP_SIZE):
        group = triples[i : i + GROUP_SIZE]
        lines = []
        for t in group:
            # 兼容字段名
            subj = t.get("subject", t.get("head", t.get("s", "")))
            pred = t.get("predicate", t.get("relation", t.get("p", t.get("r", ""))))
            obj  = t.get("object", t.get("tail", t.get("o", "")))
            if subj and pred and obj:
                lines.append(f"{subj} {pred} {obj}")

        if not lines:
            continue

        text = "；".join(lines)
        all_chunks.append({
            "source_id":   f"kg_group_{i // GROUP_SIZE}",
            "source_type": "kg_triple",
            "title":       "知识图谱",
            "category":    "knowledge_graph",
            "text":        text,
            "metadata":    {
                "triple_start": i,
                "triple_count": len(group),
            },
        })

    print(f"  → 知识图谱生成 {len(all_chunks)} 个文本块")
    return all_chunks


# ─── Embedding生成 ────────────────────────────────────────────────────────────

def get_embeddings(texts: list[str]) -> list[list[float]]:
    """批量获取embedding向量，带重试"""
    for attempt in range(3):
        try:
            resp = client.embeddings.create(
                model=EMBEDDING_MODEL,
                input=texts,
            )
            return [item.embedding for item in resp.data]
        except Exception as e:
            print(f"  ⚠️  Embedding API错误（第{attempt+1}次）: {e}")
            time.sleep(2 ** attempt)
    raise RuntimeError("Embedding API连续失败3次，请检查API Key")


# ─── 写入数据库 ───────────────────────────────────────────────────────────────

def insert_chunks(conn, chunks_with_embeddings: list[dict]):
    """批量插入，跳过已存在的（按chunk_hash去重）"""
    rows = []
    for c in chunks_with_embeddings:
        rows.append((
            c["chunk_hash"],
            c["source_id"],
            c["source_type"],
            c["title"],
            c["category"],
            c["text"],
            json.dumps(c["metadata"], ensure_ascii=False),
            c["embedding"],
        ))

    with conn.cursor() as cur:
        execute_values(cur, """
            INSERT INTO corpus_chunks
                (chunk_hash, source_id, source_type, title, category, text, metadata, embedding)
            VALUES %s
            ON CONFLICT (chunk_hash) DO NOTHING
        """, rows, template="(%s, %s, %s, %s, %s, %s, %s::jsonb, %s::vector)")
    conn.commit()


# ─── 主流程 ───────────────────────────────────────────────────────────────────

def main():
    print("\n" + "="*50)
    print("  一炁堂 — 向量化预处理脚本")
    print("="*50 + "\n")

    # 1. 连接数据库
    print("🔌 连接Neon数据库...")
    conn = get_db_connection()
    setup_database(conn)

    # 2. 读取原始数据
    corpus_records = load_corpus_records()
    kg_triples = load_kg_triples()

    # 3. 构建文本块
    print("\n📦 构建文本块...")
    all_chunks = []
    if corpus_records:
        all_chunks += build_chunks_from_corpus(corpus_records)
    if kg_triples:
        all_chunks += build_chunks_from_kg(kg_triples)

    print(f"\n🔢 总文本块数：{len(all_chunks)}")

    if not all_chunks:
        print("❌ 没有可处理的数据，请检查文件路径")
        return

    # 4. 分批生成向量并写入
    print(f"\n🚀 开始生成向量（批大小={BATCH_SIZE}）...\n")
    total_inserted = 0

    for batch_start in tqdm(range(0, len(all_chunks), BATCH_SIZE), desc="向量化进度"):
        batch = all_chunks[batch_start : batch_start + BATCH_SIZE]
        texts = [c["text"] for c in batch]

        # 生成embedding
        embeddings = get_embeddings(texts)

        # 组装完整记录
        batch_with_emb = []
        for chunk, emb in zip(batch, embeddings):
            chunk["chunk_hash"] = text_hash(chunk["text"])
            chunk["embedding"] = emb
            batch_with_emb.append(chunk)

        # 写入数据库
        insert_chunks(conn, batch_with_emb)
        total_inserted += len(batch)

        # 避免API限速
        time.sleep(0.1)

    conn.close()

    print(f"\n✅ 完成！共处理 {total_inserted} 个文本块")
    print("📊 可在Neon控制台查看表 corpus_chunks")


if __name__ == "__main__":
    main()
