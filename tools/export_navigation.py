"""Export the reviewed replay's parent/child positions for the public map.

Only relative time, common-ENU positions, validity and update age are published.
No raw logs, geographic origin, absolute timestamps or local paths are copied.
The existing scene hash must match both the analysis and public map provenance.
"""
import argparse
import hashlib
import json
import math
from itertools import pairwise
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMBINED = "20261102_nanyo_combined_000"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":"),
                               allow_nan=False) + "\n", encoding="utf-8", newline="\n")


def position(value):
    if value is None or any(v is None for v in value):
        return None
    assert len(value) == 3 and all(math.isfinite(v) for v in value)
    return value


def export(analysis):
    folder = ROOT / "site/map"
    catalog_path = folder / "manifest.json"
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    summary_path = ROOT / "site/research/reports/20261102-mapping/summary.json"
    public = json.loads(summary_path.read_text(encoding="utf-8"))
    combined = analysis / "results" / COMBINED / "mapping_replay"
    manifest = json.loads((combined / "manifest.json").read_text(encoding="utf-8"))
    verification = json.loads((combined / "verification.json").read_text(encoding="utf-8"))
    assert verification["all_numeric_checks_passed"] is True
    evidence = {item["experimentId"]: item for item in public["datasets"]}
    assert set(evidence) == {item["id"] for item in catalog["datasets"]}
    outputs = []
    for item in catalog["datasets"]:
        eid = item["id"]
        source = analysis / "results" / eid / "mapping_selected/scene.json"
        digest = sha(source)
        key = f"results\\{eid}\\mapping_selected\\scene.json"
        assert digest == manifest["inputs_sha256"][key] == evidence[eid]["sourceSceneSHA256"], eid
        scene = json.loads(source.read_text(encoding="utf-8"))
        assert scene["id"] == eid and scene["manifest"]["sfm_navigation"] is False
        rows = [[r["time"], position(r["parent"]), position(r["child"]), r["age"]]
                for r in scene["navigation"]]
        assert all(0 <= r[0] <= scene["duration"] for r in rows)
        assert all(a[0] < b[0] for a, b in pairwise(rows))
        points = [p for row in rows for p in row[1:3] if p is not None]
        assert points
        payload = {
            "schemaVersion": 1, "id": eid, "durationSeconds": scene["duration"],
            "defaultTimeSeconds": scene["default_time"], "maxGapSeconds": 0.375,
            "columns": ["timeSeconds", "parentENU", "childENU", "anchorAgeSeconds"],
            "rows": rows,
            "bounds": {"min": [min(p[i] for p in points) for i in range(3)],
                       "max": [max(p[i] for p in points) for i in range(3)]},
            "validSamples": {"parent": sum(r[1] is not None for r in rows),
                             "child": sum(r[2] is not None for r in rows)},
            "referencePoints": {"parent": "GNSSアンテナ", "child": "機体原点"},
            "source": {"analysis": "mapping_selected / mapping_navigation (2026-11-02)",
                       "sceneSHA256": digest, "analysisGitCommit": manifest["git_commit"],
                       "verificationSHA256": sha(combined / "verification.json"),
                       "sourceSampling": "既存リプレイの約4 Hz系列を全行保持。元の有効フラグを継承。",
                       "sfmUsedForNavigation": False, "accuracyValidated": False},
            "notes": ["親機はFloat設定PPKとIMU、子機は光・音・圧力・IMUによる暫定推定。",
                      "子機系列には元解析で最大3秒の慣性による位置伝播を含む。表示側の欠測補間は行わない。",
                      "親機はGNSSアンテナ、子機は機体原点。カメラ中心・圧力センサ位置とは異なる。",
                      "CAD由来の取付け・測定中心と圧力深度には暫定条件がある。独立真値での精度は未検証。",
                      "Uは共通ENUの上方向。海面からの水深ではない。"],
        }
        file = folder / "data" / f"{eid}-navigation.json"
        outputs.append((file, payload, item))
    # Validate every source before changing the published catalog.
    for file, payload, item in outputs:
        write_json(file, payload)
        item["navigation"] = {"file": f"data/{file.name}", "sha256": sha(file),
                              "bytes": file.stat().st_size, "samples": len(payload["rows"])}
    catalog["viewerUpdated"] = "2026-11-05"
    catalog["trajectoryVersion"] = 1
    for group in catalog["groups"]:
        group["ids"] = [item["id"] for item in catalog["datasets"] if
                        group["id"] == "combined" or item["date"] ==
                        ("2026-10-31" if group["id"] == "day1" else "2026-11-01")]
    write_json(catalog_path, catalog)
    public["exportEncoding"]["excluded"] = "raw recordings, source videos, full-resolution navigation logs, original file paths and geographic origin"
    public["navigationPublication"] = {
        "date": "2026-11-05", "datasetCount": len(outputs),
        "sampleCount": sum(len(p["rows"]) for _, p, _ in outputs),
        "sampling": "All rows of reviewed approximately 4 Hz scene navigation, without further decimation or interpolation",
        "parentReference": "GNSS antenna", "childReference": "body origin",
        "coordinateSystem": "Same common ENU meters as the published geometry; relative segment times only",
    }
    write_json(summary_path, public)
    print(f"Exported {len(outputs)} reviewed trajectories, {sum(len(p['rows']) for _, p, _ in outputs):,} rows; geometry unchanged.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--analysis-root", type=Path, default=ROOT.parent / "aquabeacon-analysis")
    export(parser.parse_args().analysis_root.resolve())
