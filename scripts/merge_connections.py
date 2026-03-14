#!/usr/bin/env python3
"""Merge and validate enriched connection outputs into a staged enriched file."""

from __future__ import annotations

from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from enrichment_common import (
    SYMMETRIC_TYPES,
    VALID_TYPES,
    canonical_key,
    load_artists_index,
    load_json,
    write_json,
)

BASE_CONNECTIONS_PATH = Path("public/data/connections_final.json")
ARTISTS_PATH = Path("public/data/artists_final.json")
WIKIDATA_INFLUENCES_PATH = Path("scripts/output/wikidata_influences.json")
WIKIDATA_PEERS_PATH = Path("scripts/output/wikidata_peers.json")
MUSICBRAINZ_PATH = Path("scripts/output/musicbrainz_connections.json")
OUTPUT_PATH = Path("public/data/connections_enriched.json")


def load_optional_connections(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        print(f"Missing optional input: {path}")
        return []
    data = load_json(path)
    if not isinstance(data, list):
        raise ValueError(f"Expected list in {path}, got {type(data).__name__}")
    print(f"Loaded {len(data)} records from {path}")
    return data


def connected_artists_count(connections: list[dict[str, Any]]) -> int:
    connected = set()
    for connection in connections:
        connected.add(connection["source_id"])
        connected.add(connection["target_id"])
    return len(connected)


def validate_and_normalize_connection(
    connection: dict[str, Any],
    artists_by_id: dict[str, dict[str, Any]],
) -> tuple[dict[str, Any] | None, str | None]:
    source_id = connection.get("source_id")
    target_id = connection.get("target_id")
    connection_type = connection.get("type")
    confidence = connection.get("confidence")

    if not isinstance(source_id, str) or source_id not in artists_by_id:
        return None, "invalid_source_id"
    if not isinstance(target_id, str) or target_id not in artists_by_id:
        return None, "invalid_target_id"
    if source_id == target_id:
        return None, "self_connection"
    if connection_type not in VALID_TYPES:
        return None, "invalid_type"

    try:
        confidence_value = float(confidence)
    except (TypeError, ValueError):
        return None, "invalid_confidence"
    if not (0.0 <= confidence_value <= 1.0):
        return None, "confidence_out_of_range"

    source_name = artists_by_id[source_id]["name"]
    target_name = artists_by_id[target_id]["name"]

    normalized = {
        "source_id": source_id,
        "target_id": target_id,
        "source_name": source_name,
        "target_name": target_name,
        "type": connection_type,
        "confidence": round(confidence_value, 3),
        "evidence": str(connection.get("evidence", "")).strip(),
        "source_pipeline": str(connection.get("source_pipeline", "")).strip() or "unknown",
    }
    return normalized, None


def connection_gain_by_artist(
    before_connections: list[dict[str, Any]],
    after_connections: list[dict[str, Any]],
) -> list[tuple[str, int]]:
    before_counts: Counter[str] = Counter()
    after_counts: Counter[str] = Counter()

    for connection in before_connections:
        before_counts[connection["source_id"]] += 1
        before_counts[connection["target_id"]] += 1

    for connection in after_connections:
        after_counts[connection["source_id"]] += 1
        after_counts[connection["target_id"]] += 1

    gains = []
    for artist_id, after_count in after_counts.items():
        gain = after_count - before_counts.get(artist_id, 0)
        if gain > 0:
            gains.append((artist_id, gain))

    gains.sort(key=lambda item: item[1], reverse=True)
    return gains


def artists_previously_zero_now_connected(
    before_connections: list[dict[str, Any]],
    after_connections: list[dict[str, Any]],
) -> list[str]:
    before_connected = set()
    after_connected = set()

    for connection in before_connections:
        before_connected.add(connection["source_id"])
        before_connected.add(connection["target_id"])

    for connection in after_connections:
        after_connected.add(connection["source_id"])
        after_connected.add(connection["target_id"])

    gained = sorted(artist_id for artist_id in after_connected if artist_id not in before_connected)
    return gained


def main() -> None:
    root = Path(__file__).resolve().parent.parent

    base_connections = load_json(root / BASE_CONNECTIONS_PATH)
    if not isinstance(base_connections, list):
        raise ValueError(f"Expected list in {BASE_CONNECTIONS_PATH}")

    artists_index = load_artists_index(root / ARTISTS_PATH)
    artists_by_id: dict[str, dict[str, Any]] = artists_index["by_id"]

    wikidata_influences = load_optional_connections(root / WIKIDATA_INFLUENCES_PATH)
    wikidata_peers = load_optional_connections(root / WIKIDATA_PEERS_PATH)
    musicbrainz_connections = load_optional_connections(root / MUSICBRAINZ_PATH)

    all_connections = [
        *base_connections,
        *wikidata_influences,
        *wikidata_peers,
        *musicbrainz_connections,
    ]

    best_by_key: dict[tuple[str, str, str], dict[str, Any]] = {}
    discarded_reasons: Counter[str] = Counter()

    for raw_connection in all_connections:
        normalized, reason = validate_and_normalize_connection(raw_connection, artists_by_id)
        if reason:
            discarded_reasons[reason] += 1
            continue

        dedupe_key = canonical_key(
            normalized["source_id"],
            normalized["target_id"],
            normalized["type"],
        )
        current = best_by_key.get(dedupe_key)
        if current is None:
            best_by_key[dedupe_key] = normalized
            continue

        if normalized["confidence"] > current["confidence"]:
            best_by_key[dedupe_key] = normalized

    merged_connections = list(best_by_key.values())

    before_total = len(base_connections)
    before_connected_artists = connected_artists_count(base_connections)
    after_total = len(merged_connections)
    after_connected_artists = connected_artists_count(merged_connections)

    by_pipeline = Counter(connection["source_pipeline"] for connection in merged_connections)
    by_type = Counter(connection["type"] for connection in merged_connections)

    gains = connection_gain_by_artist(base_connections, merged_connections)
    zero_to_connected = artists_previously_zero_now_connected(base_connections, merged_connections)

    write_json(root / OUTPUT_PATH, merged_connections)

    print("\n=== Merge Dry-Run Summary ===")
    print(f"Before: {before_total} connections, {before_connected_artists} unique artists")
    print(f"After:  {after_total} connections, {after_connected_artists} unique artists")
    print(f"Net new: {after_total - before_total} connections")

    print("By pipeline:")
    for pipeline in ["curated", "wikidata", "musicbrainz", "knowledge"]:
        print(f"  - {pipeline}: {by_pipeline.get(pipeline, 0)}")
    extra_pipelines = sorted(set(by_pipeline) - {"curated", "wikidata", "musicbrainz", "knowledge"})
    for pipeline in extra_pipelines:
        print(f"  - {pipeline}: {by_pipeline[pipeline]}")

    print("By type:")
    for connection_type in ["teacher", "influence", "peer", "collaboration", "rivalry"]:
        print(f"  - {connection_type}: {by_type.get(connection_type, 0)}")

    print("Top 20 artists by connection gain:")
    for artist_id, gain in gains[:20]:
        print(f"  - {artists_by_id[artist_id]['name']} ({artist_id}): +{gain}")

    print("Previously-0 artists that now have connections (cap 50):")
    for artist_id in zero_to_connected[:50]:
        print(f"  - {artists_by_id[artist_id]['name']} ({artist_id})")
    if not zero_to_connected:
        print("  - None")

    if discarded_reasons:
        print("Discarded records during validation:")
        for reason, count in sorted(discarded_reasons.items()):
            print(f"  - {reason}: {count}")

    print(f"\nWrote merged output to: {OUTPUT_PATH}")
    print("Did NOT overwrite public/data/connections_final.json")
    print("If approved, replace with:")
    print("  cp public/data/connections_enriched.json public/data/connections_final.json")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: {exc}")
        raise
