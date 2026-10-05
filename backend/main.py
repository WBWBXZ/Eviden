import hashlib
import hmac
import io
import json
import logging
import os
import re
import secrets
import sqlite3
import time
from typing import Any, Dict, List, Optional
from urllib.parse import quote

import httpx
import fitz
import pdfplumber
import uvicorn
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:  # pragma: no cover - SQLite fallback still works without Postgres dependency.
    psycopg2 = None
    RealDictCursor = None
from docx import Document
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, validator
from pypdf import PdfReader

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv(".env")
LOGGER = logging.getLogger(__name__)

DEFAULT_API_BASE_URL = "https://api.siliconflow.cn/v1"
DEFAULT_MODEL = "deepseek-ai/DeepSeek-V4-Pro"
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
DB_PATH = os.path.join(DATA_DIR, "eviden.db")
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if not DATABASE_URL and os.getenv("SUPABASE_DB_PASSWORD"):
    db_password = quote(os.getenv("SUPABASE_DB_PASSWORD", ""), safe="")
    db_host = os.getenv("SUPABASE_DB_HOST", "db.fjuiloufsrvewjlvijys.supabase.co")
    DATABASE_URL = f"postgresql://postgres:{db_password}@{db_host}:5432/postgres"
TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30
DIMENSION_WEIGHTS = {
    "核心能力匹配": 30,
    "经历证据强度": 25,
    "业务场景匹配": 15,
    "结果量化程度": 10,
    "角色责任匹配": 10,
    "关键词与表达": 10,
}


class AnalyzeRequest(BaseModel):
    resume: str = Field(..., min_length=80, max_length=50000)
    jd: str = Field(..., min_length=50, max_length=30000)
    target: str = Field(..., min_length=2, max_length=120)
    company: Optional[str] = Field("", max_length=120)
    business_unit: Optional[str] = Field("", max_length=120)

    @validator("resume", "jd", "target", "company", "business_unit", pre=True, always=True)
    def strip_text(cls, value: Optional[str]) -> str:
        return str(value or "").strip()


class ResumeRewriteRequest(BaseModel):
    resume: str = Field(..., min_length=80, max_length=50000)
    target: str = Field(..., min_length=2, max_length=120)
    jd: Optional[str] = Field("", max_length=30000)
    company: Optional[str] = Field("", max_length=120)
    business_unit: Optional[str] = Field("", max_length=120)

    @validator("resume", "target", "jd", "company", "business_unit", pre=True, always=True)
    def strip_text(cls, value: Optional[str]) -> str:
        return str(value or "").strip()


class RewriteBullet(BaseModel):
    section: str
    before: str
    after: str
    reason: str
    evidence_boundary: str


class ResumeRewriteResult(BaseModel):
    target: str
    positioning: str
    strategy: str
    bullets: List[RewriteBullet]
    gaps: List[str]
    hr_intro: str
    cautions: List[str]
    model: str


class AuthRequest(BaseModel):
    phone: str = Field(..., min_length=6, max_length=20)
    password: str = Field(..., min_length=6, max_length=72)

    @validator("phone")
    def validate_phone(cls, value: str) -> str:
        cleaned = re.sub(r"\D", "", value)
        if len(cleaned) < 6 or len(cleaned) > 20:
            raise ValueError("请输入有效手机号")
        return cleaned


class UserInfo(BaseModel):
    id: int
    phone: str
    created_at: int


class AuthResponse(BaseModel):
    token: str
    user: UserInfo


class CloudReport(BaseModel):
    id: str
    record: Dict[str, Any]
    updated_at: int


class CloudReportRequest(BaseModel):
    id: str = Field(..., min_length=3, max_length=120)
    record: Dict[str, Any]


class CloudReportsResponse(BaseModel):
    reports: List[CloudReport]


class Dimension(BaseModel):
    name: str
    weight: int = 0
    value: int = Field(..., ge=0, le=100)
    note: str
    points: float = 0


class Evidence(BaseModel):
    req: str
    priority: str
    jdQuote: str
    proof: str
    resumeQuote: str
    level: str
    confidence: int = Field(..., ge=0, le=100)
    diagnosis: str

    @validator("level")
    def validate_level(cls, value: str) -> str:
        return value if value in ("强", "中", "弱") else "中"


class Gap(BaseModel):
    level: str
    title: str
    desc: str


class Action(BaseModel):
    title: str
    desc: str
    effort: str


class Rewrite(BaseModel):
    before: str
    after: str


class AnalysisPayload(BaseModel):
    dimensions: List[Dimension]
    summary: str
    evidence: List[Evidence]
    gaps: List[Gap]
    actions: List[Action]
    rewrites: List[Rewrite]
    questions: List[str]


class AnalysisResult(AnalysisPayload):
    target: str
    resumeName: str
    jdName: str
    score: int
    priority: str
    action: str
    model: str


class HealthResponse(BaseModel):
    ok: bool
    model: str
    configured: bool


class ResumeParseResponse(BaseModel):
    filename: str
    text: str
    char_count: int
    preview: str


def use_postgres() -> bool:
    return bool(DATABASE_URL)


def db_connection():
    if use_postgres():
        if psycopg2 is None:
            raise RuntimeError("Postgres dependency is not installed")
        return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    os.makedirs(DATA_DIR, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def sql_params(sql: str) -> str:
    return sql.replace("?", "%s") if use_postgres() else sql


def fetch_one(sql: str, params: tuple = ()):  # type: ignore[no-untyped-def]
    with db_connection() as connection:
        if use_postgres():
            with connection.cursor() as cursor:
                cursor.execute(sql_params(sql), params)
                return cursor.fetchone()
        return connection.execute(sql, params).fetchone()


def fetch_all(sql: str, params: tuple = ()):  # type: ignore[no-untyped-def]
    with db_connection() as connection:
        if use_postgres():
            with connection.cursor() as cursor:
                cursor.execute(sql_params(sql), params)
                return cursor.fetchall()
        return connection.execute(sql, params).fetchall()


def execute_sql(sql: str, params: tuple = ()) -> None:
    with db_connection() as connection:
        if use_postgres():
            with connection.cursor() as cursor:
                cursor.execute(sql_params(sql), params)
            return
        connection.execute(sql, params)


def init_db() -> None:
    if use_postgres():
        statements = [
            """
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                phone TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires_at INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS reports (
                id TEXT NOT NULL,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                record_json TEXT NOT NULL,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY(id, user_id)
            )
            """,
        ]
        with db_connection() as connection:
            with connection.cursor() as cursor:
                for statement in statements:
                    cursor.execute(statement)
        return

    with db_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                expires_at INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS reports (
                id TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                record_json TEXT NOT NULL,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY(id, user_id),
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
            """
        )


def is_integrity_error(error: Exception) -> bool:
    if isinstance(error, sqlite3.IntegrityError):
        return True
    return bool(psycopg2 is not None and isinstance(error, psycopg2.IntegrityError))


def create_user(phone: str, password_hash: str, created_at: int) -> int:
    with db_connection() as connection:
        if use_postgres():
            with connection.cursor() as cursor:
                cursor.execute(
                    "INSERT INTO users(phone, password_hash, created_at) VALUES (%s, %s, %s) RETURNING id",
                    (phone, password_hash, created_at),
                )
                row = cursor.fetchone()
                return int(row["id"])
        cursor = connection.execute(
            "INSERT INTO users(phone, password_hash, created_at) VALUES (?, ?, ?)",
            (phone, password_hash, created_at),
        )
        return int(cursor.lastrowid)


def hash_password(password: str, salt: Optional[str] = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 180000)
    return "{0}${1}".format(salt, digest.hex())


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, _ = stored_hash.split("$", 1)
    except ValueError:
        return False
    return hmac.compare_digest(hash_password(password, salt), stored_hash)


def create_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    now = int(time.time())
    execute_sql(
        "INSERT INTO sessions(token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
        (token, user_id, now + TOKEN_TTL_SECONDS, now),
    )
    return token


def user_from_row(row) -> UserInfo:  # type: ignore[no-untyped-def]
    return UserInfo(id=int(row["id"]), phone=str(row["phone"]), created_at=int(row["created_at"]))


def current_user(authorization: Optional[str] = Header(default=None)) -> UserInfo:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="请先登录")
    token = authorization.split(" ", 1)[1].strip()
    now = int(time.time())
    row = fetch_one(
        """
        SELECT users.id, users.phone, users.created_at
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.token = ? AND sessions.expires_at > ?
        """,
        (token, now),
    )
    if row is None:
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")
    return user_from_row(row)


def clean_resume_text(text: str) -> str:
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def parse_pdf_resume_with_pypdf(content: bytes) -> str:
    reader = PdfReader(io.BytesIO(content))
    chunks = []
    for page in reader.pages:
        chunks.append(page.extract_text() or "")
    return clean_resume_text("\n".join(chunks))


def parse_pdf_resume_with_fitz(content: bytes) -> str:
    document = fitz.open(stream=content, filetype="pdf")
    chunks = []
    for page in document:
        blocks = page.get_text("blocks")
        blocks = sorted(blocks, key=lambda block: (round(block[1] / 10), block[0]))
        page_text = "\n".join(block[4].strip() for block in blocks if block[4].strip())
        chunks.append(page_text)
    document.close()
    return clean_resume_text("\n\n".join(chunks))


def parse_pdf_resume_with_pdfplumber(content: bytes) -> str:
    chunks = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            text = page.extract_text(x_tolerance=1.5, y_tolerance=3) or ""
            tables = []
            for table in page.extract_tables() or []:
                rows = []
                for row in table:
                    cells = [str(cell or "").strip() for cell in row if str(cell or "").strip()]
                    if cells:
                        rows.append(" | ".join(cells))
                if rows:
                    tables.append("\n".join(rows))
            chunks.append("\n".join(part for part in [text, "\n".join(tables)] if part.strip()))
    return clean_resume_text("\n\n".join(chunks))


def score_extracted_text(text: str) -> float:
    if not text:
        return 0
    replacement_penalty = text.count("�") + text.count("·") * 0.4
    useful_chars = sum(1 for char in text if char.isalnum() or "\u4e00" <= char <= "\u9fff")
    line_bonus = min(len([line for line in text.splitlines() if line.strip()]), 80) * 3
    contact_bonus = 20 if re.search(r"@|\b1[3-9]\d{9}\b|linkedin|github", text, re.I) else 0
    section_bonus = 15 * len(re.findall(r"教育|经历|项目|技能|工作|实习|experience|education|project|skills", text, re.I))
    return useful_chars + line_bonus + contact_bonus + section_bonus - replacement_penalty * 8


def parse_pdf_resume(content: bytes) -> str:
    candidates = []
    for parser in (parse_pdf_resume_with_pdfplumber, parse_pdf_resume_with_fitz, parse_pdf_resume_with_pypdf):
        try:
            parsed = parser(content)
            if parsed:
                candidates.append(parsed)
        except Exception as error:
            LOGGER.info("PDF parser %s failed: %s", parser.__name__, error)
    text = max(candidates, key=score_extracted_text) if candidates else ""
    if len(text) < 80:
        raise HTTPException(status_code=422, detail="PDF 可提取文本过少，可能是扫描版或图片版简历；请换 DOCX 或可复制文本的 PDF。")
    return text


def parse_docx_resume(content: bytes) -> str:
    document = Document(io.BytesIO(content))
    chunks = [paragraph.text for paragraph in document.paragraphs if paragraph.text.strip()]
    for table in document.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if cells:
                chunks.append(" | ".join(cells))
    return clean_resume_text("\n".join(chunks))


def parse_txt_resume(content: bytes) -> str:
    for encoding in ("utf-8", "utf-8-sig", "gb18030"):
        try:
            return clean_resume_text(content.decode(encoding))
        except UnicodeDecodeError:
            continue
    return clean_resume_text(content.decode("utf-8", errors="ignore"))


def parse_resume_file(filename: str, content: bytes) -> str:
    lowered = filename.lower()
    if lowered.endswith(".pdf"):
        return parse_pdf_resume(content)
    if lowered.endswith(".docx"):
        return parse_docx_resume(content)
    if lowered.endswith(".txt"):
        return parse_txt_resume(content)
    raise HTTPException(status_code=400, detail="目前仅支持 PDF、DOCX 或 TXT 简历文件。")


def read_local_secret(name: str) -> str:
    current_dir = os.path.dirname(__file__)
    candidate_paths = [
        os.path.join(current_dir, ".env"),
        os.path.join(os.getcwd(), ".env"),
    ]
    for path in candidate_paths:
        try:
            with open(path, "r") as file_obj:
                for line in file_obj:
                    if line.startswith(name + "="):
                        return line.split("=", 1)[1].strip().strip('"').strip("'")
        except OSError:
            continue
    return ""


def read_config_module(name: str) -> str:
    try:
        import config_secret  # type: ignore
        return str(getattr(config_secret, name, "")).strip()
    except Exception:
        return ""


def get_secret(name: str) -> str:
    return os.environ.get(name, "").strip() or read_local_secret(name) or read_config_module(name)


def api_base_url() -> str:
    return os.environ.get("SILICONFLOW_API_BASE_URL", "").strip() or read_local_secret("SILICONFLOW_API_BASE_URL") or read_config_module("SILICONFLOW_API_BASE_URL") or DEFAULT_API_BASE_URL


def model_name() -> str:
    return (os.environ.get("SILICONFLOW_MODEL", "").strip() or read_local_secret("SILICONFLOW_MODEL") or read_config_module("SILICONFLOW_MODEL") or DEFAULT_MODEL)


def build_system_prompt() -> str:
    return """你是 Eviden 的岗位匹配分析引擎。你的任务是比较一份简历与一个目标 JD，生成可核验的求职申请策略。

必须遵守：
1. 只能使用用户提供的简历与 JD，不得编造经历、数据、职责、工具或结果。
2. jdQuote 必须逐字引用 JD 中真实存在的片段；resumeQuote 必须逐字引用简历中真实存在的片段。
3. 按 /job-match 方法拆解：先识别硬性门槛，再看核心职责、能力要求、加分项和申请约束；公司/事业部只用于理解业务语境，不得当作简历证据。
4. 每项要求的状态必须在诊断中明确区分：已匹配、表达缺口、证据不足、真实缺口、待确认。
5. 区分三类问题：真实能力缺口、已有能力但证据不足、仅表达方式不佳。
6. 评分应保守；关键词相同不等于具备强证据；硬性门槛缺失时不得被其他优势完全抵消。
7. 改写建议必须遵循 ASu-skills 中 /great-resume 的原则：只做事实重组、岗位化表达和证据边界提示，不把待确认内容写成事实。
8. 输出 rewrites 时，每条 before 必须能回指简历原文；after 要像正式简历 bullet，不要口语化。
9. 只返回一个 JSON 对象，不要 Markdown、解释、代码围栏或额外文字。

JSON 必须严格包含：
{
  "dimensions": [
    {"name":"核心能力匹配","value":0到100整数,"note":"评分依据"},
    {"name":"经历证据强度","value":0到100整数,"note":"评分依据"},
    {"name":"业务场景匹配","value":0到100整数,"note":"评分依据"},
    {"name":"结果量化程度","value":0到100整数,"note":"评分依据"},
    {"name":"角色责任匹配","value":0到100整数,"note":"评分依据"},
    {"name":"关键词与表达","value":0到100整数,"note":"评分依据"}
  ],
  "summary":"申请建议的核心判断，2到3句",
  "evidence":[{"req":"岗位要求","priority":"硬性门槛/核心要求/能力门槛/加分要求","jdQuote":"JD逐字原文","proof":"匹配判断","resumeQuote":"简历逐字原文；没有证据时写无直接证据","level":"强/中/弱","confidence":0到100整数,"diagnosis":"以 已匹配/表达缺口/证据不足/真实缺口/待确认 开头，再说明原因"}],
  "gaps":[{"level":"高/中/低","title":"缺口标题","desc":"具体说明"}],
  "actions":[{"title":"行动标题","desc":"可执行步骤","effort":"预计时间"}],
  "rewrites":[{"before":"简历逐字原文","after":"基于同一事实的建议表达"}],
  "questions":["面试高风险追问"]
}

数量要求：evidence 固定 4 项，gaps 3 项，actions 3 项，rewrites 2 项，questions 3 项。每个字段保持简洁，单条说明不超过 45 个中文字符。"""


def build_user_prompt(request: AnalyzeRequest) -> str:
    return """目标岗位：{target}
目标公司：{company}
事业部/业务方向：{business_unit}

【简历原文】
{resume}

【JD 原文】
{jd}

请按系统规定的 JSON 结构完成分析。公司与事业部用于判断业务语境和岗位命名，不得替代简历证据。""".format(
        target=request.target,
        company=request.company or "未提供",
        business_unit=request.business_unit or "未提供",
        resume=request.resume,
        jd=request.jd,
    )


def extract_json(content: str) -> Dict[str, Any]:
    cleaned = content.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("model response does not contain a JSON object")
    parsed = json.loads(cleaned[start:end + 1])
    if not isinstance(parsed, dict):
        raise ValueError("model response JSON must be an object")
    return parsed


def normalize_dimensions(raw_dimensions: List[Dimension]) -> List[Dimension]:
    by_name = {item.name: item for item in raw_dimensions}
    normalized: List[Dimension] = []
    for name, weight in DIMENSION_WEIGHTS.items():
        source = by_name.get(name)
        if source is None:
            raise ValueError("missing score dimension: {0}".format(name))
        normalized.append(
            Dimension(
                name=name,
                weight=weight,
                value=source.value,
                note=source.note,
                points=round(source.value * weight / 100.0, 1),
            )
        )
    return normalized


def quote_is_grounded(quote: str, source: str) -> bool:
    normalized_quote = re.sub(r"\s+", "", quote.replace("“", "").replace("”", ""))
    normalized_source = re.sub(r"\s+", "", source)
    if quote == "无直接证据":
        return True
    return len(normalized_quote) >= 4 and normalized_quote in normalized_source


def normalize_result(payload: AnalysisPayload, request: AnalyzeRequest) -> AnalysisResult:
    dimensions = normalize_dimensions(payload.dimensions)
    score = int(round(sum(item.points for item in dimensions)))

    checked_evidence: List[Evidence] = []
    for item in payload.evidence[:6]:
        jd_grounded = quote_is_grounded(item.jdQuote, request.jd)
        resume_grounded = quote_is_grounded(item.resumeQuote, request.resume)
        if not jd_grounded or not resume_grounded:
            item.confidence = min(item.confidence, 55)
            if item.level == "强":
                item.level = "中"
            item.diagnosis = "引用包含概括或组合片段，需以原文为准复核；" + item.diagnosis
        checked_evidence.append(item)

    if score >= 82:
        action = "建议优先投递"
        priority = "A"
    elif score >= 74:
        action = "建议准备后投递"
        priority = "A-"
    elif score >= 64:
        action = "建议针对性补强后投递"
        priority = "B"
    else:
        action = "建议谨慎投递"
        priority = "C"

    context_parts = [request.company, request.business_unit, request.target]
    jd_name = " · ".join([item for item in context_parts if item])

    return AnalysisResult(
        target=request.target,
        resumeName="当前上传简历",
        jdName="{0}（当前 JD）".format(jd_name or request.target),
        score=score,
        priority=priority,
        action=action,
        model=model_name(),
        dimensions=dimensions,
        summary=payload.summary,
        evidence=checked_evidence,
        gaps=payload.gaps[:3],
        actions=payload.actions[:3],
        rewrites=payload.rewrites[:3],
        questions=payload.questions[:3],
    )


async def request_analysis(request: AnalyzeRequest) -> AnalysisPayload:
    api_key = get_secret("SILICONFLOW_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="AI service is not configured")

    messages = [
        {"role": "system", "content": build_system_prompt()},
        {"role": "user", "content": build_user_prompt(request)},
    ]
    headers = {
        "Authorization": "Bearer {0}".format(api_key),
        "Content-Type": "application/json",
    }
    base_payload: Dict[str, Any] = {
        "model": model_name(),
        "messages": messages,
        "temperature": 0.1,
        "max_tokens": 3000,
        "enable_thinking": False,
        "stream": False,
    }

    last_error: Optional[Exception] = None
    attempts = [True]
    for use_json_format in attempts:
        payload = dict(base_payload)
        if use_json_format:
            payload["response_format"] = {"type": "json_object"}
        try:
            timeout = httpx.Timeout(90.0, connect=15.0)
            async with httpx.AsyncClient(timeout=timeout, trust_env=False) as client:
                response = await client.post(
                    "{0}/chat/completions".format(api_base_url().rstrip("/")),
                    headers=headers,
                    json=payload,
                )
            if response.status_code >= 400:
                detail = response.text[:500]
                raise RuntimeError("SiliconFlow error {0}: {1}".format(response.status_code, detail))
            response_data = response.json()
            content = response_data["choices"][0]["message"]["content"]
            return AnalysisPayload.parse_obj(extract_json(content))
        except Exception as error:
            last_error = error
            LOGGER.warning("AI analysis attempt failed: %s", error)

    raise HTTPException(
        status_code=502,
        detail="模型返回内容未通过报告结构校验，请稍后重试。",
    ) from last_error


async def request_resume_rewrite(request: ResumeRewriteRequest) -> ResumeRewriteResult:
    api_key = get_secret("SILICONFLOW_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="AI service is not configured")

    system_prompt = """你是中文求职简历改写顾问，方法来自 /great-resume 与 /make-resume：只基于用户简历里的事实做表达优化，不捏造公司、职位、时间、指标或项目。输出要产品化、克制、可直接复制到简历。严格返回 JSON。"""
    user_prompt = """目标岗位：{target}
目标公司：{company}
事业部/业务方向：{business_unit}

【简历原文】
{resume}

【目标 JD，可为空】
{jd}

请输出 JSON：
{{
  "positioning":"一句话候选人定位，不超过36字",
  "strategy":"改写策略，2句内",
  "bullets":[{{"section":"所属模块，如工作经历/项目经历/技能摘要","before":"简历逐字原文；找不到完整句时引用最接近片段","after":"建议改写，强调动作、场景、结果和个人边界","reason":"为什么这样改","evidence_boundary":"说明没有新增哪些未经证实的信息"}}],
  "gaps":["还需要补充确认的信息，最多5条"],
  "hr_intro":"给 HR 的中文开场白，80字内",
  "cautions":["不能写进简历的风险点，最多4条"]
}}
要求：bullets 4到7条；after 不得加入原简历没有的量化结果；如果 JD 为空，就按目标岗位进行通用产品化改写。""".format(
        target=request.target,
        company=request.company or "未提供",
        business_unit=request.business_unit or "未提供",
        resume=request.resume,
        jd=request.jd or "未提供",
    )
    headers = {
        "Authorization": "Bearer {0}".format(api_key),
        "Content-Type": "application/json",
    }
    payload: Dict[str, Any] = {
        "model": model_name(),
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.15,
        "max_tokens": 2400,
        "enable_thinking": False,
        "stream": False,
        "response_format": {"type": "json_object"},
    }
    try:
        timeout = httpx.Timeout(90.0, connect=15.0)
        async with httpx.AsyncClient(timeout=timeout, trust_env=False) as client:
            response = await client.post(
                "{0}/chat/completions".format(api_base_url().rstrip("/")),
                headers=headers,
                json=payload,
            )
        if response.status_code >= 400:
            raise RuntimeError("SiliconFlow error {0}: {1}".format(response.status_code, response.text[:500]))
        data = extract_json(response.json()["choices"][0]["message"]["content"])
        return ResumeRewriteResult(
            target=request.target,
            positioning=str(data.get("positioning", ""))[:120],
            strategy=str(data.get("strategy", ""))[:500],
            bullets=[RewriteBullet.parse_obj(item) for item in data.get("bullets", [])[:7]],
            gaps=[str(item) for item in data.get("gaps", [])[:5]],
            hr_intro=str(data.get("hr_intro", ""))[:220],
            cautions=[str(item) for item in data.get("cautions", [])[:4]],
            model=model_name(),
        )
    except Exception as error:
        LOGGER.warning("AI rewrite attempt failed: %s", error)
        raise HTTPException(status_code=502, detail="简历改写结果未通过结构校验，请稍后重试。") from error


app = FastAPI(
    title="Eviden Analysis API",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)
WEB_DIR = os.path.join(os.path.dirname(__file__), "web")
ASSETS_DIR = os.path.join(WEB_DIR, "assets")
if os.path.isdir(ASSETS_DIR):
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS", "DELETE"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_handler():
    init_db()


@app.post("/api/auth/register", response_model=AuthResponse)
async def register_handler(request: AuthRequest):
    init_db()
    now = int(time.time())
    password_hash = hash_password(request.password)
    try:
        user_id = create_user(request.phone, password_hash, now)
    except Exception as error:
        if is_integrity_error(error):
            raise HTTPException(status_code=409, detail="这个手机号已经注册，请直接登录")
        raise
    token = create_session(user_id)
    return AuthResponse(token=token, user=UserInfo(id=user_id, phone=request.phone, created_at=now))


@app.post("/api/auth/login", response_model=AuthResponse)
async def login_handler(request: AuthRequest):
    init_db()
    row = fetch_one("SELECT * FROM users WHERE phone = ?", (request.phone,))
    if row is None or not verify_password(request.password, str(row["password_hash"])):
        raise HTTPException(status_code=401, detail="手机号或密码不正确")
    token = create_session(int(row["id"]))
    return AuthResponse(token=token, user=user_from_row(row))


@app.get("/api/auth/me", response_model=UserInfo)
async def me_handler(user: UserInfo = Depends(current_user)):
    return user


@app.get("/api/reports", response_model=CloudReportsResponse)
async def list_reports_handler(user: UserInfo = Depends(current_user)):
    rows = fetch_all(
        "SELECT id, record_json, updated_at FROM reports WHERE user_id = ? ORDER BY updated_at DESC",
        (user.id,),
    )
    reports = [
        CloudReport(id=str(row["id"]), record=json.loads(str(row["record_json"])), updated_at=int(row["updated_at"]))
        for row in rows
    ]
    return CloudReportsResponse(reports=reports)


@app.post("/api/reports", response_model=CloudReport)
async def save_report_handler(request: CloudReportRequest, user: UserInfo = Depends(current_user)):
    now = int(time.time())
    record_json = json.dumps(request.record, ensure_ascii=False)
    execute_sql(
        """
        INSERT INTO reports(id, user_id, record_json, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(id, user_id) DO UPDATE SET record_json = excluded.record_json, updated_at = excluded.updated_at
        """,
        (request.id, user.id, record_json, now),
    )
    return CloudReport(id=request.id, record=request.record, updated_at=now)


@app.delete("/api/reports/{report_id}")
async def delete_report_handler(report_id: str, user: UserInfo = Depends(current_user)):
    execute_sql("DELETE FROM reports WHERE id = ? AND user_id = ?", (report_id, user.id))
    return {"ok": True}


@app.get("/")
async def frontend_handler():
    index_path = os.path.join(WEB_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    raise HTTPException(status_code=404, detail="frontend is not built")


@app.get("/api/health", response_model=HealthResponse)
async def health_handler():
    return HealthResponse(
        ok=True,
        model=model_name(),
        configured=bool(get_secret("SILICONFLOW_API_KEY")),
    )


@app.post("/api/parse-resume", response_model=ResumeParseResponse)
async def parse_resume_handler(file: UploadFile = File(...)):
    filename = file.filename or "resume"
    content = await file.read()
    if len(content) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="文件过大，请上传 8MB 以内的简历。")
    try:
        text = parse_resume_file(filename, content)
    except HTTPException:
        raise
    except Exception as error:
        LOGGER.warning("resume parse failed: %s", error)
        raise HTTPException(status_code=400, detail="简历解析失败，请换一个 PDF / DOCX 文件重试。")
    if len(text) < 80:
        raise HTTPException(status_code=422, detail="解析到的简历内容太少，请确认文件不是扫描图片或空白文档。")
    return ResumeParseResponse(
        filename=filename,
        text=text,
        char_count=len(text),
        preview=text[:260],
    )


@app.post("/api/analyze", response_model=AnalysisResult)
async def analyze_handler(request: AnalyzeRequest):
    payload = await request_analysis(request)
    return normalize_result(payload, request)


@app.post("/api/rewrite-resume", response_model=ResumeRewriteResult)
async def rewrite_resume_handler(request: ResumeRewriteRequest):
    return await request_resume_rewrite(request)


# ---------------------------DO NOT EDIT CODE BELOW THIS LINE---------------------------------
# This is the entry point for the FastAPI application.
if __name__ == "__main__":
    port = int(os.environ.get("_BYTEFAAS_RUNTIME_PORT", 8000))
    config = uvicorn.Config("main:app", port=port, log_level="info", host=None)
    server = uvicorn.Server(config)
    server.run()
# --------------------------------------------------------------------------------------------
