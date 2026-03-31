from flask import Flask, request, jsonify, Response, stream_with_context, send_from_directory
from flask_cors import CORS
from pathlib import Path
import requests

app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app)

UPSTREAM = "http://127.0.0.1:5001"
TIMEOUT = 60

BASE_DIR = Path(__file__).resolve().parent


def upstream_url(path: str) -> str:
    return f"{UPSTREAM}{path}"


def proxy_simple_response(upstream_response: requests.Response, default_content_type: str):
    return Response(
        upstream_response.content,
        status=upstream_response.status_code,
        content_type=upstream_response.headers.get("Content-Type", default_content_type)
    )


@app.get("/")
def index():
    return send_from_directory(BASE_DIR, "index_gpt.html")


@app.get("/health")
def health():
    try:
        r = requests.get(upstream_url("/health"), timeout=5)
        upstream_json = {}
        try:
            upstream_json = r.json()
        except Exception:
            upstream_json = {}

        return jsonify({
            "ok": r.ok,
            "proxy": True,
            "upstream_status": r.status_code,
            "upstream": upstream_json
        }), 200 if r.ok else 502

    except requests.RequestException as e:
        return jsonify({
            "ok": False,
            "proxy": True,
            "error": str(e)
        }), 502


@app.get("/api/photos")
def api_photos():
    try:
        r = requests.get(upstream_url("/photos"), timeout=TIMEOUT)
        return proxy_simple_response(r, "application/json")
    except requests.RequestException as e:
        return jsonify({"error": f"upstream request failed: {str(e)}"}), 502


@app.post("/api/upload")
def api_upload():
    try:
        if "photo" not in request.files:
            return jsonify({"error": "photo file is required"}), 400

        file = request.files["photo"]
        taken_date = request.form.get("taken_date", "")

        files = {
            "photo": (file.filename, file.stream, file.mimetype)
        }
        data = {
            "taken_date": taken_date
        }

        r = requests.post(
            upstream_url("/upload"),
            files=files,
            data=data,
            timeout=TIMEOUT
        )

        return proxy_simple_response(r, "application/json")

    except requests.RequestException as e:
        return jsonify({"error": f"upload proxy failed: {str(e)}"}), 502


@app.get("/api/media/<path:filename>")
def api_media(filename):
    try:
        upstream = requests.get(
            upstream_url(f"/data/{filename}"),
            stream=True,
            timeout=TIMEOUT
        )

        excluded_headers = {
            "content-encoding",
            "content-length",
            "transfer-encoding",
            "connection"
        }

        headers = []
        for k, v in upstream.headers.items():
            if k.lower() not in excluded_headers:
                headers.append((k, v))

        return Response(
            stream_with_context(upstream.iter_content(chunk_size=8192)),
            status=upstream.status_code,
            headers=headers
        )

    except requests.RequestException as e:
        return jsonify({"error": f"media proxy failed: {str(e)}"}), 502


@app.get("/api/download/<path:filename>")
def api_download(filename):
    try:
        upstream = requests.get(
            upstream_url(f"/data/{filename}"),
            stream=True,
            timeout=TIMEOUT
        )

        if upstream.status_code >= 400:
            return Response(
                upstream.content,
                status=upstream.status_code,
                content_type=upstream.headers.get("Content-Type", "application/json")
            )

        content_type = upstream.headers.get("Content-Type", "application/octet-stream")
        headers = {
            "Content-Type": content_type,
            "Content-Disposition": f'attachment; filename="{filename}"'
        }

        return Response(
            stream_with_context(upstream.iter_content(chunk_size=8192)),
            status=upstream.status_code,
            headers=headers
        )

    except requests.RequestException as e:
        return jsonify({"error": f"download proxy failed: {str(e)}"}), 502


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=3000, debug=True)