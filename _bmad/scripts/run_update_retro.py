import subprocess
import sys
import json

actions = [
    {
        "id": "epic-5-retro-item-1-deploy-edge-gateway",
        "action": "Configurar variaveis de ambiente de producao no CI/CD para deploy dos endpoints headless",
        "owner": "DevOps / Infra"
    },
    {
        "id": "epic-5-retro-item-2-cdn-widget-distribution",
        "action": "Publicar bundle do Web Component delivrery-button no CDN oficial para integradores",
        "owner": "Frontend / Dev"
    }
]

cmd = [
    sys.executable,
    ".agent/skills/bmad-retrospective/scripts/sprint_status.py",
    "update",
    "--file", "_bmad-output/implementation-artifacts/sprint-status.yaml",
    "--epic", "5",
    "--set-retro-done",
    "--ref", "_bmad-output/implementation-artifacts/epic-5-retro-2026-09-08.md",
    "--verdict", "accepted",
    "--add-action", json.dumps(actions)
]

res = subprocess.run(cmd, capture_output=True, text=True)
print("STDOUT:", res.stdout)
print("STDERR:", res.stderr)
print("CODE:", res.returncode)
