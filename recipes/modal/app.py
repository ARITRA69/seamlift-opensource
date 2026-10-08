"""One Node encoder per rendition; shared S3/R2 storage, no Python codec fork."""
import json
import pathlib
import subprocess
import modal

PACKAGE = pathlib.Path(__file__).resolve().parents[2] / "packages" / "seamtranscode"
image = (
    modal.Image.from_registry("node:22-bookworm-slim", add_python="3.12")
    .apt_install("ffmpeg")
    .add_local_dir(str(PACKAGE), "/opt/seamtranscode", copy=True,
                   ignore=["node_modules", "dist", "tests", "scripts"])
    .run_commands("cd /opt/seamtranscode && npm install --no-audit --no-fund "
                  "&& npm run build && npm install -g --no-audit --no-fund .")
)
app = modal.App("seamtranscode")
secrets = [modal.Secret.from_name("seamtranscode-storage")]


def cli(*args):
    result = subprocess.run(["seamtranscode", *args], check=True, capture_output=True, text=True)
    return json.loads(result.stdout)


@app.function(image=image, secrets=secrets, cpu=8, timeout=3600, max_containers=10)
def encode(plan: dict, name: str):
    return cli("encode", "--plan", json.dumps(plan), "--rendition", name)


@app.function(image=image, secrets=secrets, cpu=2, timeout=3600)
def make_previews(key: str, output: str):
    return cli("previews", key, "--key", "--out", output, "--kind", "video")


@app.function(image=image, secrets=secrets, cpu=1, timeout=3600)
def transcode(key: str, output: str):
    plan = cli("plan", key, "--key", "--out", output)
    pictures = make_previews.spawn(key, output)
    results = list(encode.starmap((plan, r["name"]) for r in plan["renditions"]))
    return cli("finish", "--plan", json.dumps(plan), "--results", json.dumps(results),
               "--previews", json.dumps(pictures.get()))


@app.local_entrypoint()
def main(key: str, output: str):
    print(json.dumps(transcode.remote(key, output), indent=2))
