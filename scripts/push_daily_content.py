"""推送当日内容工厂产出到小程序首页 syncDailyContent 云函数。

鉴权：机器 token {ts}.{hmac}，密钥用 MEWORA_CONTENT_PUSH_SECRET
（须与线上 system_config.content_push_secret 同值，与终端用户 TOKEN_SECRET 物理隔离）。

环境变量：
  MEWORA_CONTENT_ROOT       内容工厂根目录（含 content/ 子目录）
  MEWORA_CONTENT_PUSH_SECRET 机器密钥
  MEWORA_SYNC_URL           可选，syncDailyContent 云函数网关地址
"""
import sys
import os
import hmac
import hashlib
import time

PROJECT_ROOT = os.environ.get("MEWORA_CONTENT_ROOT", "")
CONTENT_DIR = os.path.join(PROJECT_ROOT, "content") if PROJECT_ROOT else ""
CONTENT_PUSH_SECRET = os.environ.get("MEWORA_CONTENT_PUSH_SECRET", "")
CLOUD_FUNC_URL = os.environ.get(
    "MEWORA_SYNC_URL",
    "https://cloud1-d8gdi44zqfec250b5.api.tcloudbasegateway.com/v1/cloudfunctions/syncDailyContent",
)


def generate_token():
    ts = str(int(time.time()))
    sig = hmac.new(CONTENT_PUSH_SECRET.encode(), ts.encode(), hashlib.sha256).hexdigest()
    return f"{ts}.{sig}"


def get_today_note():
    if not CONTENT_DIR or not os.path.isdir(CONTENT_DIR):
        return None
    candidates = []
    for f in os.listdir(CONTENT_DIR):
        if (f.startswith("gzh_note_") or f.startswith("xhs_note_")) and f.endswith(".md"):
            candidates.append(os.path.join(CONTENT_DIR, f))
    if not candidates:
        return None
    candidates.sort(key=lambda p: os.path.getmtime(p), reverse=True)
    return candidates[0]


def main():
    if not CONTENT_PUSH_SECRET:
        print("❌ MEWORA_CONTENT_PUSH_SECRET 未配置")
        return 1
    if not PROJECT_ROOT:
        print("❌ MEWORA_CONTENT_ROOT 未配置（内容工厂根目录）")
        return 1

    note_path = get_today_note()
    if not note_path:
        print("未找到今日文章（content/ 下无 gzh_note_*/xhs_note_*.md）")
        return 1

    with open(note_path, "r", encoding="utf-8-sig") as f:
        raw = f.read()
    lines = raw.strip().split("\n")
    title = lines[0].replace("#", "").strip() if lines else "今日科普"
    content = "\n".join(lines[1:]).strip()
    summary = content[:150].replace("\n", " ") + ("..." if len(content) > 150 else "")

    payload = {
        "title": title,
        "summary": summary,
        "content": content,
        "cover_url": "",
        "category": "digestive",
        "target_pet": "all",
        "token": generate_token(),
    }

    try:
        import requests
    except ImportError:
        print("❌ 缺少 requests 库：pip install requests")
        return 1

    resp = requests.post(CLOUD_FUNC_URL, json=payload, timeout=30)
    result = resp.json()
    if result.get("code") == 0:
        print(f"✅ 推送成功：{title}")
        return 0
    print(f"❌ 推送失败：{result.get('msg')}（code={result.get('code')}）")
    return 1


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
