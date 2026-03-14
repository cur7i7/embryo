#!/usr/bin/env python3
"""Shared helpers for connection enrichment scripts."""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

SYMMETRIC_TYPES = {"peer", "collaboration", "rivalry"}
VALID_TYPES = {"teacher", "influence", "peer", "collaboration", "rivalry"}


def repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(path.suffix + ".tmp")
    with temp_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
    temp_path.replace(path)


def normalize_wikidata_id(raw_id: str | None) -> str | None:
    if not raw_id:
        return None
    normalized = raw_id.strip()
    if normalized.startswith("http://www.wikidata.org/entity/"):
        normalized = normalized.rsplit("/", maxsplit=1)[-1]
    return normalized if normalized.startswith("Q") else None


def normalize_musicbrainz_id(raw_id: str | None) -> str | None:
    return raw_id.strip().lower() if raw_id else None


def normalize_name(name: str) -> str:
    return " ".join(name.casefold().split())


def load_artists_index(artists_path: Path) -> dict[str, Any]:
    artists: list[dict[str, Any]] = load_json(artists_path)
    by_id: dict[str, dict[str, Any]] = {}
    by_wikidata: dict[str, dict[str, Any]] = {}
    by_musicbrainz: dict[str, dict[str, Any]] = {}
    by_normalized_name: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for artist in artists:
        artist_id = artist["id"]
        by_id[artist_id] = artist

        wikidata_id = normalize_wikidata_id(artist.get("wikidata_id"))
        if wikidata_id:
            by_wikidata[wikidata_id] = artist

        mbid = normalize_musicbrainz_id(artist.get("musicbrainz_id"))
        if mbid:
            by_musicbrainz[mbid] = artist

        normalized_name = normalize_name(artist["name"])
        by_normalized_name[normalized_name].append(artist)

    return {
        "artists": artists,
        "by_id": by_id,
        "by_wikidata": by_wikidata,
        "by_musicbrainz": by_musicbrainz,
        "by_normalized_name": by_normalized_name,
    }


def load_existing_keys(connections_path: Path) -> tuple[set[tuple[str, str, str]], set[tuple[str, str, str]]]:
    connections = load_json(connections_path)
    directional: set[tuple[str, str, str]] = set()
    canonical: set[tuple[str, str, str]] = set()

    for connection in connections:
        source_id = connection["source_id"]
        target_id = connection["target_id"]
        connection_type = connection["type"]
        directional.add((source_id, target_id, connection_type))
        canonical.add(canonical_key(source_id, target_id, connection_type))

    return directional, canonical


def canonical_key(source_id: str, target_id: str, connection_type: str) -> tuple[str, str, str]:
    if connection_type in SYMMETRIC_TYPES and source_id > target_id:
        return (target_id, source_id, connection_type)
    return (source_id, target_id, connection_type)


def build_connection(
    *,
    source_artist: dict[str, Any],
    target_artist: dict[str, Any],
    connection_type: str,
    confidence: float,
    evidence: str,
    source_pipeline: str,
) -> dict[str, Any]:
    if connection_type not in VALID_TYPES:
        raise ValueError(f"Unsupported connection type: {connection_type}")

    return {
        "source_id": source_artist["id"],
        "target_id": target_artist["id"],
        "source_name": source_artist["name"],
        "target_name": target_artist["name"],
        "type": connection_type,
        "confidence": round(float(confidence), 3),
        "evidence": evidence,
        "source_pipeline": source_pipeline,
    }


def count_connections_per_artist(connections: list[dict[str, Any]]) -> Counter[str]:
    counter: Counter[str] = Counter()
    for connection in connections:
        counter[connection["source_id"]] += 1
        counter[connection["target_id"]] += 1
    return counter


def artists_with_any_connection(connections: list[dict[str, Any]]) -> set[str]:
    connected: set[str] = set()
    for connection in connections:
        connected.add(connection["source_id"])
        connected.add(connection["target_id"])
    return connected


def load_checkpoint(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    return load_json(path)


def save_checkpoint(path: Path, checkpoint: dict[str, Any]) -> None:
    write_json(path, checkpoint)
