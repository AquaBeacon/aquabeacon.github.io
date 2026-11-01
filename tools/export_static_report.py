"""Select the authorized static evaluation for publication; never copy raw data."""
import argparse
import csv
import hashlib
import json
import math
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPERIMENT = "20261101_nanyo_003"
WINDOW = "day2_101500"


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def export(analysis):
    source = analysis / "results" / EXPERIMENT / "stationary_spectra" / WINDOW
    manifest = json.loads((source / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["window"]["id"] == WINDOW
    assert manifest["window"]["start"] == "2026-11-01T10:15:00+09:00"
    rows = list(csv.DictReader((source / "matched_positions.csv").open(encoding="utf-8")))
    assert len(rows) == 32
    assert len({r["shot_seq"] for r in rows}) == 32
    metrics = {}
    for condition in ("corrected", "fixed_parent", "fixed_both"):
        values = [[float(r[f"{condition}_{axis}_m"]) for axis in ("east", "north", "up")] for r in rows]
        mean = [sum(p[i] for p in values) / len(values) for i in range(3)]
        axis_rmse = [math.sqrt(sum((p[i] - mean[i]) ** 2 for p in values) / len(values)) for i in range(3)]
        rmse = math.sqrt(sum(v * v for v in axis_rmse))
        recorded = manifest["metrics"][condition]
        assert math.isclose(rmse, recorded["rmse_3d_m"], abs_tol=1e-10)
        metrics[condition] = {key: recorded[key] for key in ("n", "axis_rmse_m", "horizontal_rmse_m", "rmse_3d_m")}
    assert round(metrics["corrected"]["rmse_3d_m"], 4) == 0.1397
    assert round(metrics["fixed_parent"]["rmse_3d_m"], 4) == 1.4545
    output = ROOT / "site/research/reports/20261101-static"
    output.mkdir(parents=True, exist_ok=True)
    for extension in ("png", "svg"):
        shutil.copyfile(source / f"position_overhead.{extension}", output / f"position-overhead.{extension}")
    input_hashes = {}
    for path, digest in manifest["inputs_sha256"].items():
        relative = path.replace("\\", "/")
        if "/aquabeacon-analysis/" in relative:
            relative = relative.split("/aquabeacon-analysis/", 1)[1]
        assert not relative.startswith("/") and ":" not in relative
        input_hashes[relative] = digest
    summary = {
        "schemaVersion": 1,
        "publishedDate": "2026-11-02",
        "experimentId": EXPERIMENT, "windowId": WINDOW,
        "start": manifest["window"]["start"], "durationSeconds": 60,
        "interval": "[start, end)",
        "metricDefinition": "RMSE about each series arithmetic mean; denominator N; no smoothing or detrending; not ground-truth error",
        "coordinateSystem": "True ENU relative vector from parent body origin to child body origin",
        "metrics": metrics,
        "reductionPercent": (1 - metrics["corrected"]["rmse_3d_m"] / metrics["fixed_parent"]["rmse_3d_m"]) * 100,
        "depth": {"meanRoundedM": 16.44, "samples": 60, "minimumRoundedM": 16.433, "maximumRoundedM": 16.457,
                  "definition": "Uncalibrated relative pressure depth; initial 180 seconds surface-pressure proxy; assumed density 1025 kg/m3; all finite samples in 60 seconds"},
        "observation": {"matchedPositions": 32, "firstOffsetSeconds": min(float(r["segment_time_s"]) for r in rows),
                        "lastOffsetSeconds": max(float(r["segment_time_s"]) for r in rows),
                        "trackedImages": 399, "totalImages": 600, "manualReinitializations": 3,
                        "validRangeRecords": 43, "totalRangeRecords": 43, "maximumMatchingDeltaSeconds": 0.075},
        "accuracyValidated": False, "mappingStatus": "ready",
        "sourceRepository": "https://github.com/AquaBeacon/aquabeacon-analysis",
        "sourceDirectory": f"results/{EXPERIMENT}/stationary_spectra/{WINDOW}",
        "analysisGitCommit": manifest["git_commit"],
        "sourceSHA256": {name: sha256(source / name) for name in ("report.md", "manifest.json", "matched_positions.csv", "pressure_depth_samples.csv", "position_overhead.png", "position_overhead.svg")},
        "analysisInputsSHA256": input_hashes,
        "publicationScope": "Selected summary and derived figures only. No raw sensor logs, source videos or absolute GNSS positions.",
    }
    (output / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Verified {len(rows)} unique observations; exported selected summary and 2 figures.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--analysis-root", type=Path, default=ROOT.parent / "aquabeacon-analysis")
    export(parser.parse_args().analysis_root.resolve())
