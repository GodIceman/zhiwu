"""Check the documents saved by XCUITest in the simulator's local Files provider."""

import codecs
import csv
import io
import json
import plistlib
import re
import sys
from pathlib import Path


def local_files_root(data_path):
    if not data_path:
        return None
    groups = Path(data_path) / "Containers/Shared/AppGroup"
    for metadata in groups.glob("*/.com.apple.mobile_container_manager.metadata.plist"):
        try:
            group = plistlib.loads(metadata.read_bytes()).get("MCMMetadataIdentifier", "")
        except (OSError, plistlib.InvalidFileException):
            continue
        if group.lower() == "group.com.apple.fileprovider.localstorage":
            storage = metadata.parent / "File Provider Storage"
            if storage.is_dir():
                return storage
    return None


def one_export(storage, pattern):
    # The test saves at the top level of "On My iPhone/iPad" on a fresh simulator.
    matches = [p for p in storage.glob(pattern) if p.is_file()]
    if len(matches) != 1:
        raise ValueError(f"Expected one {pattern} in the local Files folder, found {len(matches)}")
    return matches[0].read_bytes()


def verify(storage, name):
    backup = json.loads(one_export(storage, "知物备份-*.json").decode("utf-8"))
    assets = backup["assets"]
    if backup["version"] != 2 or len(assets) != 1:
        raise ValueError("Expected a version 2 JSON backup with exactly one record")
    item = assets[0]
    if (item["name"], item["kind"], item["purchasePriceCny"]) != (name, "item", 88):
        raise ValueError("JSON record does not match the item entered in this test")

    content = one_export(storage, "知物清单-*.csv")
    if not content.startswith(codecs.BOM_UTF8):
        raise ValueError("CSV is missing its UTF-8 BOM")
    rows = list(csv.DictReader(io.StringIO(content.decode("utf-8-sig"), newline=""), strict=True))
    if len(rows) != 1 or (rows[0]["名称"], rows[0]["类型"], rows[0]["物品价值/服务金额"]) != (name, "物品", "88"):
        raise ValueError("CSV record does not match the item entered in this test")
    print("Verified Files exports: matching JSON and UTF-8 BOM CSV, each with the expected item and amount")


if __name__ == "__main__":
    device_file, device_id, log_file = sys.argv[1:]
    runtimes = json.loads(Path(device_file).read_text())["devices"]
    device = next(d for devices in runtimes.values() for d in devices if d["udid"] == device_id)
    storage = local_files_root(device.get("dataPath"))
    if storage is None:
        print("::notice::File contents unverified: simulator did not expose the local Files storage directory")
    else:
        log = Path(log_file).read_text(encoding="utf-8", errors="replace")
        names = set(re.findall(r"(?:Export validation record: |Type ')(Saved [0-9A-Fa-f]{8})\b", log))
        if len(names) != 1:
            raise SystemExit("Could not identify a unique test record from the XCUITest log")
        verify(storage, names.pop())
