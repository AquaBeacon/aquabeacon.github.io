"""Publish selected, verified map geometry and photo textures; never raw recordings.

Source files remain untouched. Float32 is a display encoding, not a new analysis.
"""
import argparse
import base64
import hashlib
import io
import json
import math
import shutil
from array import array
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMBINED = "20261102_nanyo_combined_000"
IDS = ["20261031_nanyo_001", "20261031_nanyo_002"] + [f"20261101_nanyo_{i:03d}" for i in range(1, 6)]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8", newline="\n")


def export(analysis):
    from PIL import Image

    combined = analysis / "results" / COMBINED / "mapping_replay"
    source_manifest = json.loads((combined / "manifest.json").read_text(encoding="utf-8"))
    verification = json.loads((combined / "verification.json").read_text(encoding="utf-8"))
    assert verification["all_numeric_checks_passed"] is True
    assert source_manifest["accuracy_validated"] is False
    destination = ROOT / "site/map"
    data_dir = destination / "data"
    image_dir = data_dir / "images"
    image_dir.mkdir(parents=True, exist_ok=True)
    datasets, evidence = [], []
    maximum_float_error = 0.0
    source_hashes = {name: sha(combined / name) for name in ("report.md", "manifest.json", "verification.json")}
    for eid in IDS:
        source = analysis / "results" / eid / "mapping_selected/scene.json"
        digest = sha(source)
        manifest_key = f"results\\{eid}\\mapping_selected\\scene.json"
        assert digest == source_manifest["inputs_sha256"][manifest_key], f"Source changed: {eid}"
        scene = json.loads(source.read_text(encoding="utf-8"))
        assert scene["id"] == eid
        sm = scene["manifest"]
        assert not sm["accuracy_validated"] and not sm["sfm_navigation"]
        label = f"{'10/31' if eid.startswith('20261031') else '11/1'} 区間{int(eid[-3:])}"
        points = scene["points"]
        count = len(points)
        assert count == sm["points"]
        fragments = [{k: f[k] for k in ("fragment", "accepted", "reason", "scale_method", "registration_median_m", "registration_p95_m") if k in f} for f in sm["fragments"]]
        evidence.append({"experimentId": eid, "label": label, "pointCount": count,
                         "photoCount": sm["photo_patches"], "triangleCount": sm["triangles"],
                         "acceptedFragments": sm["accepted_fragments"], "totalFragments": sm["total_fragments"],
                         "fragments": fragments, "sourceSceneSHA256": digest})
        item = {"id": eid, "label": label, "date": "2026-10-31" if eid.startswith("20261031") else "2026-11-01",
                "availability": "ready" if count else "unavailable", "pointCount": count,
                "photoCount": sm["photo_patches"], "triangleCount": sm["triangles"],
                "file": None, "transferBytes": 0, "version": digest[:16]}
        if not count:
            item["reason"] = "地図断片の尺度・位置合わせを支える情報が不足し、絶対配置は未採用です。" if eid.endswith("004") else "登録画像が2枚のみで、尺度・位置を支持できず、絶対配置は未採用です。"
            datasets.append(item)
            continue
        raw = bytearray()

        def append(values, code, components):
            nonlocal maximum_float_error
            while len(raw) % 4:
                raw.append(0)
            values = list(values)
            assert all(math.isfinite(v) for v in values)
            packed = array(code, values)
            if code == "f":
                maximum_float_error = max(maximum_float_error, max((abs(a - b) for a, b in zip(values, packed)), default=0))
            import sys
            if sys.byteorder != "little":
                packed.byteswap()
            descriptor = {"byteOffset": len(raw), "count": len(values), "components": components,
                          "type": {"f": "float32", "B": "uint8", "H": "uint16"}[code]}
            raw.extend(packed.tobytes())
            return descriptor

        points_view = append((v for p in points for v in p), "f", 3)
        assert len(scene["rgb"]) == count
        colors_view = append((v for p in scene["rgb"] for v in p), "B", 3)
        surfaces, jpeg_total = [], 0
        for index, surf in enumerate(scene["surfaces"]):
            assert len(surf["uv"]) == len(surf["vertices"]) < 65536
            assert all(len(f) == 3 and all(isinstance(i, int) and 0 <= i < len(surf["vertices"]) for i in f) for f in surf["faces"])
            image = base64.b64decode(surf["image"], validate=True)
            with Image.open(io.BytesIO(image)) as opened:
                assert opened.format == "JPEG" and opened.size == (960, 540)
                assert not opened.getexif(), "Strip metadata in a separate reviewed publication step."
            filename = f"{eid}-{index:03d}.jpg"
            (image_dir / filename).write_bytes(image)
            jpeg_total += len(image)
            assert len(surf["camera"]) == 3 and len(surf["quaternion_xyzw"]) == 4
            assert all(math.isfinite(v) for v in surf["camera"] + surf["quaternion_xyzw"])
            surfaces.append({"vertices": append((v for p in surf["vertices"] for v in p), "f", 3),
                             "uv": append((v for p in surf["uv"] for v in p), "f", 2),
                             "indices": append((v for p in surf["faces"] for v in p), "H", 3),
                             "image": f"data/images/{filename}", "imageSHA256": hashlib.sha256(image).hexdigest(),
                             "camera": surf["camera"], "orientation": surf["quaternion_xyzw"], "timeSeconds": surf["time"]})
        while len(raw) % 4:
            raw.append(0)
        binary_path = data_dir / f"{eid}.bin"
        binary_path.write_bytes(raw)
        default_surface = min(range(len(surfaces)), key=lambda i: abs(surfaces[i]["timeSeconds"] - scene["default_time"]))
        data = {"schemaVersion": 2, "id": eid, "pointCount": count, "photoCount": len(surfaces),
                "triangleCount": sum(len(s["faces"]) for s in scene["surfaces"]),
                "binary": f"data/{eid}.bin", "binaryByteLength": len(raw), "binarySHA256": sha(binary_path),
                "points": points_view, "colors": colors_view, "surfaces": surfaces,
                "defaultSurface": default_surface, "center": scene["center"], "radius": scene["radius"],
                "bounds": {"min": [min(p[i] for p in points) for i in range(3)], "max": [max(p[i] for p in points) for i in range(3)]}}
        assert data["triangleCount"] == sm["triangles"] and len(surfaces) == sm["photo_patches"]
        data_path = data_dir / f"{eid}.json"
        write_json(data_path, data)
        item.update(file=f"data/{eid}.json", transferBytes=len(raw) + jpeg_total + data_path.stat().st_size,
                    metadataSHA256=sha(data_path))
        datasets.append(item)
    totals = {key: sum(d[key] for d in datasets) for key in ("pointCount", "photoCount", "triangleCount")}
    assert totals == {"pointCount": 82500, "photoCount": 230, "triangleCount": 218697}
    assert maximum_float_error < 0.00001
    catalog = {"schemaVersion": 2, "status": "ready", "updated": "2026-11-02", "title": "写真で見る、水中マップ。",
               "defaultSelection": "20261101_nanyo_003", "datasets": datasets,
               "coordinateSystem": "共通のローカルENU（東・北・上）、m。原点の緯度経度は非掲載。",
               "scaleNote": "圧力・姿勢・航法に基づく暫定尺度・配置。独立真値に対する精度は未検証。",
               "groups": [{"id": "day1", "label": "10/31 全体", "ids": IDS[:2]},
                          {"id": "day2", "label": "11/1 全体", "ids": IDS[2:5]},
                          {"id": "combined", "label": "2日分を重ねる（GNSS配置）", "ids": IDS[:5]}],
               "totals": totals}
    write_json(destination / "manifest.json", catalog)
    report = ROOT / "site/research/reports/20261102-mapping"
    report.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(combined / "mapping_overhead.png", report / "mapping-overhead.png")
    # This is a curated, public summary, not the original manifest or logs.
    summary = {"schemaVersion": 1, "experimentId": COMBINED, "publishedDate": "2026-11-02", "totals": totals,
               "datasets": evidence, "accuracyValidated": False, "sfmUsedForNavigation": False,
               "joinMethod": "Rigid conversion to common ENU from GNSS; no ICP or arbitrary day translation; visual connection unconfirmed",
               "crossDayOverlap": {"representativePairs": 736, "acceptedConnectionCandidates": 0},
               "analysisGitCommit": source_manifest["git_commit"], "sourceSHA256": source_hashes,
               "exportEncoding": {"positions": "little-endian float32, ENU meters", "maxCoordinateEncodingErrorM": maximum_float_error,
                                  "geometryDecimation": False, "images": "Original 960x540 derived JPEG textures, byte-identical; GPU display may be resized",
                                  "excluded": "raw recordings, source videos, navigation time series, original file paths and geographic origin"},
               "verification": {"numericChecksPassed": True, "numericCheckCount": verification["numeric_check_count"],
                                "selectedTestsPassed": 13, "fullPytestPassed": 277, "fullPytestKnownFailure": "Existing editable-figure saver check in anchor_nanyo_maps.py",
                                "visualChecks": [{"check": c["check"], "result": c["result"]} for c in verification["visual_checks"]]},
               "publicFigureSHA256": sha(report / "mapping-overhead.png"),
               "publicFigure": {"description": "Selected map points and child navigation paths; blue Day1, orange Day2",
                                "pointStrideByDataset": {d["id"]: max(1, d["pointCount"] // 12000) for d in datasets}}}
    write_json(report / "summary.json", summary)
    print(f"Published assets: {totals}; selected transfer {sum(d['transferBytes'] for d in datasets):,} bytes; float error <= {maximum_float_error:.9f} m")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--analysis-root", type=Path, default=ROOT.parent / "aquabeacon-analysis")
    export(parser.parse_args().analysis_root.resolve())
