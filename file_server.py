from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
from pathlib import Path
import os
import re

app = Flask(__name__)
CORS(app)

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "data"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {
    "jpg", "jpeg", "png", "gif", "webp",
    "mp4", "mov", "webm", "m4v"
}

DATE_PATTERN = re.compile(r"^\d{8}_\d{6}$")


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def build_safe_filename(original_filename: str, taken_date: str) -> str:
    original_filename = secure_filename(original_filename)
    ext = original_filename.rsplit(".", 1)[1].lower()

    if taken_date and DATE_PATTERN.match(taken_date):
        return f"{taken_date}.{ext}"

    return original_filename


@app.get("/health")
def health():
    return jsonify({
        "ok": True,
        "upload_dir": str(UPLOAD_DIR)
    })


@app.get("/photos")
def list_photos():
    files = []

    for name in os.listdir(UPLOAD_DIR):
        path = UPLOAD_DIR / name
        if path.is_file():
            files.append(name)

    files.sort(reverse=True)
    return jsonify(files)


@app.post("/upload")
def upload_photo():
    if "photo" not in request.files:
        return jsonify({"error": "photo file is required"}), 400

    file = request.files["photo"]
    taken_date = (request.form.get("taken_date") or "").strip()

    if not file or not file.filename:
        return jsonify({"error": "empty filename"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "unsupported file type"}), 400

    save_name = build_safe_filename(file.filename, taken_date)
    save_path = UPLOAD_DIR / save_name

    # 같은 이름이 이미 있으면 뒤에 번호 붙이기
    if save_path.exists():
        stem = save_path.stem
        suffix = save_path.suffix
        counter = 1

        while True:
            candidate = UPLOAD_DIR / f"{stem}_{counter}{suffix}"
            if not candidate.exists():
                save_path = candidate
                save_name = candidate.name
                break
            counter += 1

    file.save(save_path)

    return jsonify({
        "ok": True,
        "filename": save_name
    })


@app.get("/data/<path:filename>")
def get_media(filename):
    return send_from_directory(UPLOAD_DIR, filename, as_attachment=False)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=True)