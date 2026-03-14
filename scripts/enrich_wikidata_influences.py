#!/usr/bin/env python3
"""Enrich artist connections from Wikidata influence and teacher properties."""

from __future__ import annotations

import argparse
import itertools
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path
from typing import Any

from enrichment_common import (
    artists_with_any_connection,
    build_connection,
    count_connections_per_artist,
    load_artists_index,
    load_checkpoint,
    load_existing_keys,
    load_json,
    normalize_wikidata_id,
    save_checkpoint,
    write_json,
)

WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql"
USER_AGENT = "EMBRYO-enrichment/1.0 (music research project)"
BATCH_SIZE = 200
REQUEST_INTERVAL_SECONDS = 2.0
OUTPUT_PATH = Path("scripts/output/wikidata_influences.json")
CHECKPOINT_PATH = Path("scripts/output/wikidata_checkpoint.json")

PROPERTY_CONFIGS = [
    {
        "property": "P737",
        "connection_type": "influence",
        "confidence": 0.7,
        "evidence": "Wikidata P737 (influenced by)",
    },
    {
        "property": "P1066",
        "connection_type": "teacher",
        "confidence": 0.7,
        "evidence": "Wikidata P1066 (student of)",
    },
    {
        "property": "P5765",
        "connection_type": "influence",
        "confidence": 0.6,
        "evidence": "Wikidata P5765 (inspired by)",
    },
]


class RateLimitedSparqlClient:
    def __init__(self, request_interval_seconds: float) -> None:
        self.request_interval_seconds = request_interval_seconds
        self.last_request_at = 0.0

    def query(self, sparql_query: str, retries: int = 3) -> dict[str, Any]:
        encoded_query = urllib.parse.urlencode({"query": sparql_query})
        url = f"{WIKIDATA_ENDPOINT}?{encoded_query}"

        for attempt in range(1, retries + 1):
            now = time.monotonic()
            sleep_for = self.request_interval_seconds - (now - self.last_request_at)
            if sleep_for > 0:
                time.sleep(sleep_for)

            request = urllib.request.Request(
                url=url,
                headers={
                    "Accept": "application/sparql-results+json",
                    "User-Agent": USER_AGENT,
                },
            )

            try:
                with urllib.request.urlopen(request, timeout=90) as response:
                    self.last_request_at = time.monotonic()
                    payload = response.read().decode("utf-8")
                    import json

                    return json.loads(payload)
            except urllib.error.HTTPError as exc:
                self.last_request_at = time.monotonic()
                if exc.code in {429, 500, 502, 503, 504} and attempt < retries:
                    backoff = attempt * 3
                    print(
                        f"HTTP {exc.code} from Wikidata, retrying in {backoff}s "
                        f"(attempt {attempt}/{retries})"
                    )
                    time.sleep(backoff)
                    continue
                raise RuntimeError(f"Wikidata query failed: HTTP {exc.code}") from exc
            except urllib.error.URLError as exc:
                if attempt < retries:
                    backoff = attempt * 3
                    print(
                        f"Network error from Wikidata, retrying in {backoff}s "
                        f"(attempt {attempt}/{retries})"
                    )
                    time.sleep(backoff)
                    continue
                raise RuntimeError("Wikidata query failed due to network error") from exc

        raise RuntimeError("Wikidata query failed after retries")


def chunked(values: list[str], size: int) -> list[list[str]]:
    return [values[i : i + size] for i in range(0, len(values), size)]


def qid_from_entity_uri(uri: str) -> str | None:
    if not uri:
        return None
    return normalize_wikidata_id(uri.rsplit("/", maxsplit=1)[-1])


def build_property_query(source_qids: list[str], property_id: str) -> str:
    source_values = " ".join(f"wd:{qid}" for qid in source_qids)
    return f"""
SELECT ?source ?target WHERE {{
  VALUES ?source {{ {source_values} }}
  ?source wdt:{property_id} ?target .
}}
""".strip()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--max-batches",
        type=int,
        default=None,
        help="Optional cap for batches per property (for smoke tests).",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parent.parent
    artists_path = root / "public/data/artists_final.json"
    connections_path = root / "public/data/connections_final.json"

    artists_index = load_artists_index(artists_path)
    by_wikidata: dict[str, dict[str, Any]] = artists_index["by_wikidata"]
    by_id: dict[str, dict[str, Any]] = artists_index["by_id"]

    existing_connections = load_json(connections_path)
    baseline_connected = artists_with_any_connection(existing_connections)
    directional_existing_keys, _ = load_existing_keys(connections_path)

    existing_output = load_json(OUTPUT_PATH) if OUTPUT_PATH.exists() else []
    generated_connections: list[dict[str, Any]] = list(existing_output)
    generated_directional_keys: set[tuple[str, str, str]] = {
        (c["source_id"], c["target_id"], c["type"]) for c in generated_connections
    }

    checkpoint = load_checkpoint(CHECKPOINT_PATH) or {"completed_batches": []}
    completed_batches: set[str] = set(checkpoint.get("completed_batches", []))

    all_source_qids = sorted(by_wikidata.keys())
    client = RateLimitedSparqlClient(request_interval_seconds=REQUEST_INTERVAL_SECONDS)

    for property_config in PROPERTY_CONFIGS:
        property_id = property_config["property"]
        batches = chunked(all_source_qids, BATCH_SIZE)
        if args.max_batches is not None:
            batches = batches[: args.max_batches]

        total_batches = len(batches)
        for batch_index, source_batch in enumerate(batches, start=1):
            batch_key = f"{property_id}:{batch_index}"
            if batch_key in completed_batches:
                continue

            sparql_query = build_property_query(source_batch, property_id)
            response_payload = client.query(sparql_query)
            bindings = response_payload.get("results", {}).get("bindings", [])

            new_in_batch = 0
            for row in bindings:
                source_qid = qid_from_entity_uri(row.get("source", {}).get("value", ""))
                target_qid = qid_from_entity_uri(row.get("target", {}).get("value", ""))
                if not source_qid or not target_qid:
                    continue
                source_artist = by_wikidata.get(source_qid)
                target_artist = by_wikidata.get(target_qid)
                if not source_artist or not target_artist:
                    continue
                if source_artist["id"] == target_artist["id"]:
                    continue

                key = (
                    source_artist["id"],
                    target_artist["id"],
                    property_config["connection_type"],
                )
                if key in directional_existing_keys or key in generated_directional_keys:
                    continue

                connection = build_connection(
                    source_artist=source_artist,
                    target_artist=target_artist,
                    connection_type=property_config["connection_type"],
                    confidence=property_config["confidence"],
                    evidence=property_config["evidence"],
                    source_pipeline="wikidata",
                )
                generated_connections.append(connection)
                generated_directional_keys.add(key)
                new_in_batch += 1

            completed_batches.add(batch_key)
            write_json(OUTPUT_PATH, generated_connections)
            save_checkpoint(
                CHECKPOINT_PATH,
                {
                    "completed_batches": sorted(completed_batches),
                    "updated_at": int(time.time()),
                    "generated_connections": len(generated_connections),
                },
            )
            print(f"Batch {batch_index}/{total_batches}: found {new_in_batch} new connections")

    type_breakdown = Counter(connection["type"] for connection in generated_connections)
    artist_counts = count_connections_per_artist(generated_connections)
    top_artists = artist_counts.most_common(10)

    gained_from_zero = []
    for artist_id, count in artist_counts.items():
        if artist_id not in baseline_connected:
            gained_from_zero.append((artist_id, count))
    gained_from_zero.sort(key=lambda item: item[1], reverse=True)

    print("\n=== Wikidata Influence Enrichment Summary ===")
    print(f"Total new connections found: {len(generated_connections)}")
    print("Breakdown by type:")
    for connection_type, count in sorted(type_breakdown.items()):
        print(f"  - {connection_type}: {count}")

    print("Top 10 artists by new connection count:")
    for artist_id, count in top_artists:
        print(f"  - {by_id[artist_id]['name']} ({artist_id}): {count}")

    if gained_from_zero:
        print("Notable artists previously at 0 connections that now have connections:")
        for artist_id, count in itertools.islice(gained_from_zero, 20):
            print(f"  - {by_id[artist_id]['name']} ({artist_id}): {count}")
    else:
        print("No previously-0 artists gained connections in this run.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: {exc}")
        raise
