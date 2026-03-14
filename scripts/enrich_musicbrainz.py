#!/usr/bin/env python3
"""Enrich artist connections using the MusicBrainz API artist relationships."""

from __future__ import annotations

import argparse
import difflib
import json
import time
import urllib.error
import urllib.request
from collections import Counter
from contextlib import contextmanager
from dataclasses import dataclass
import fcntl
from pathlib import Path
from typing import Any

from enrichment_common import (
    artists_with_any_connection,
    build_connection,
    canonical_key,
    count_connections_per_artist,
    load_artists_index,
    load_checkpoint,
    load_existing_keys,
    load_json,
    normalize_musicbrainz_id,
    normalize_name,
    save_checkpoint,
    write_json,
)

MUSICBRAINZ_URL_TEMPLATE = "https://musicbrainz.org/ws/2/artist/{mbid}?inc=artist-rels&fmt=json"
USER_AGENT = "EMBRYO/1.0 (contact@embryo.wiki)"
REQUEST_INTERVAL_SECONDS = 1.0
OUTPUT_PATH = Path("scripts/output/musicbrainz_connections.json")
CHECKPOINT_PATH = Path("scripts/output/musicbrainz_checkpoint.json")
RATE_LIMIT_STATE_PATH = Path("scripts/output/musicbrainz_rate_limit_state.json")

RELATIONSHIP_MAPPING = {
    "member of band": {"type": "peer", "confidence": 0.8},
    "teacher": {"type": "teacher", "confidence": 0.7},
    "influenced by": {"type": "influence", "confidence": 0.7},
    "collaboration": {"type": "collaboration", "confidence": 0.7},
    "subgroup": {"type": "peer", "confidence": 0.7},
}


class MusicBrainzClient:
    def __init__(
        self,
        request_interval_seconds: float,
        global_limiter: "GlobalFileRateLimiter | None" = None,
    ) -> None:
        self.request_interval_seconds = request_interval_seconds
        self.last_request_at = 0.0
        self.global_limiter = global_limiter

    def fetch_artist_relations(self, mbid: str, retries: int = 3) -> dict[str, Any]:
        url = MUSICBRAINZ_URL_TEMPLATE.format(mbid=mbid)

        for attempt in range(1, retries + 1):
            if self.global_limiter is not None:
                self.global_limiter.acquire_slot()

            now = time.monotonic()
            sleep_for = self.request_interval_seconds - (now - self.last_request_at)
            if sleep_for > 0:
                time.sleep(sleep_for)

            request = urllib.request.Request(
                url=url,
                headers={
                    "Accept": "application/json",
                    "User-Agent": USER_AGENT,
                },
            )

            try:
                with urllib.request.urlopen(request, timeout=60) as response:
                    self.last_request_at = time.monotonic()
                    return json.loads(response.read().decode("utf-8"))
            except urllib.error.HTTPError as exc:
                self.last_request_at = time.monotonic()
                if exc.code in {429, 500, 502, 503, 504} and attempt < retries:
                    backoff = attempt * 2
                    print(
                        f"MusicBrainz HTTP {exc.code}, retrying in {backoff}s "
                        f"(attempt {attempt}/{retries})"
                    )
                    time.sleep(backoff)
                    continue
                raise RuntimeError(f"MusicBrainz request failed: HTTP {exc.code} for {mbid}") from exc
            except urllib.error.URLError as exc:
                if attempt < retries:
                    backoff = attempt * 2
                    print(
                        f"MusicBrainz network error, retrying in {backoff}s "
                        f"(attempt {attempt}/{retries})"
                    )
                    time.sleep(backoff)
                    continue
                raise RuntimeError(f"MusicBrainz network failure for {mbid}") from exc

        raise RuntimeError(f"MusicBrainz request failed after retries for {mbid}")


@dataclass(slots=True)
class GlobalFileRateLimiter:
    state_path: Path
    interval_seconds: float

    def __post_init__(self) -> None:
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        if not self.state_path.exists():
            self.state_path.write_text('{"last_request_at": 0.0}\n', encoding="utf-8")

    @contextmanager
    def _locked_state_file(self):
        with self.state_path.open("r+", encoding="utf-8") as handle:
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
            try:
                yield handle
            finally:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)

    def acquire_slot(self) -> None:
        while True:
            wait_for = 0.0
            with self._locked_state_file() as handle:
                raw = handle.read().strip()
                last_request_at = 0.0
                if raw:
                    try:
                        payload = json.loads(raw)
                        last_request_at = float(payload.get("last_request_at", 0.0))
                    except (json.JSONDecodeError, TypeError, ValueError):
                        last_request_at = 0.0

                now = time.time()
                elapsed = now - last_request_at
                wait_for = max(0.0, self.interval_seconds - elapsed)
                if wait_for <= 0:
                    handle.seek(0)
                    handle.truncate(0)
                    handle.write(json.dumps({"last_request_at": now}))
                    handle.flush()
                    return

            time.sleep(wait_for)


def load_preexisting_canonical_keys(
    connections_path: Path,
    wikidata_influences_path: Path,
    wikidata_peers_path: Path,
) -> set[tuple[str, str, str]]:
    _, existing_canonical_keys = load_existing_keys(connections_path)
    combined = set(existing_canonical_keys)

    for optional_path in (wikidata_influences_path, wikidata_peers_path):
        if not optional_path.exists():
            continue
        for connection in load_json(optional_path):
            combined.add(
                canonical_key(
                    connection["source_id"],
                    connection["target_id"],
                    connection["type"],
                )
            )
    return combined


def pick_artist_by_name(
    *,
    related_name: str,
    source_artist_id: str,
    by_normalized_name: dict[str, list[dict[str, Any]]],
    all_normalized_names: list[str],
) -> dict[str, Any] | None:
    normalized = normalize_name(related_name)

    exact_candidates = [
        artist
        for artist in by_normalized_name.get(normalized, [])
        if artist["id"] != source_artist_id
    ]
    if len(exact_candidates) == 1:
        return exact_candidates[0]

    close_matches = difflib.get_close_matches(normalized, all_normalized_names, n=3, cutoff=0.94)
    if not close_matches:
        return None

    best_name = close_matches[0]
    best_candidates = [
        artist
        for artist in by_normalized_name.get(best_name, [])
        if artist["id"] != source_artist_id
    ]
    if len(best_candidates) != 1:
        return None

    similarity = difflib.SequenceMatcher(None, normalized, best_name).ratio()
    if similarity < 0.94:
        return None

    return best_candidates[0]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--max-artists",
        type=int,
        default=None,
        help="Optional cap for number of source artists (for smoke tests).",
    )
    parser.add_argument(
        "--num-shards",
        type=int,
        default=1,
        help="Total number of shards for parallel processing.",
    )
    parser.add_argument(
        "--shard-index",
        type=int,
        default=0,
        help="Zero-based shard index to process.",
    )
    parser.add_argument(
        "--output-path",
        type=Path,
        default=OUTPUT_PATH,
        help="Output JSON path for generated connections.",
    )
    parser.add_argument(
        "--checkpoint-path",
        type=Path,
        default=CHECKPOINT_PATH,
        help="Checkpoint JSON path for resume support.",
    )
    parser.add_argument(
        "--rate-limit-state-path",
        type=Path,
        default=RATE_LIMIT_STATE_PATH,
        help="Shared state file for global 1 req/s rate limiting.",
    )
    args = parser.parse_args()

    if args.num_shards < 1:
        raise ValueError("--num-shards must be >= 1")
    if args.shard_index < 0 or args.shard_index >= args.num_shards:
        raise ValueError("--shard-index must be in [0, --num-shards)")

    root = Path(__file__).resolve().parent.parent
    artists_path = root / "public/data/artists_final.json"
    connections_path = root / "public/data/connections_final.json"
    wikidata_influences_path = root / "scripts/output/wikidata_influences.json"
    wikidata_peers_path = root / "scripts/output/wikidata_peers.json"
    output_path = root / args.output_path
    checkpoint_path = root / args.checkpoint_path
    rate_limit_state_path = root / args.rate_limit_state_path

    artists_index = load_artists_index(artists_path)
    by_musicbrainz: dict[str, dict[str, Any]] = artists_index["by_musicbrainz"]
    by_normalized_name: dict[str, list[dict[str, Any]]] = artists_index["by_normalized_name"]
    by_id: dict[str, dict[str, Any]] = artists_index["by_id"]

    all_normalized_names = sorted(by_normalized_name.keys())

    existing_connections = load_json(connections_path)
    baseline_connected = artists_with_any_connection(existing_connections)
    preexisting_canonical_keys = load_preexisting_canonical_keys(
        connections_path=connections_path,
        wikidata_influences_path=wikidata_influences_path,
        wikidata_peers_path=wikidata_peers_path,
    )

    existing_output = load_json(output_path) if output_path.exists() else []
    generated_connections: list[dict[str, Any]] = list(existing_output)
    generated_canonical_keys: set[tuple[str, str, str]] = {
        canonical_key(c["source_id"], c["target_id"], c["type"]) for c in generated_connections
    }

    checkpoint = load_checkpoint(checkpoint_path) or {"processed_source_ids": []}
    processed_source_ids: set[str] = set(checkpoint.get("processed_source_ids", []))

    source_artists = [
        artist
        for artist in artists_index["artists"]
        if normalize_musicbrainz_id(artist.get("musicbrainz_id"))
    ]
    source_artists.sort(key=lambda artist: artist["id"])

    source_artists = [
        artist
        for idx, artist in enumerate(source_artists)
        if idx % args.num_shards == args.shard_index
    ]
    if args.max_artists is not None:
        source_artists = source_artists[: args.max_artists]

    global_limiter = GlobalFileRateLimiter(
        state_path=rate_limit_state_path,
        interval_seconds=REQUEST_INTERVAL_SECONDS,
    )
    client = MusicBrainzClient(
        request_interval_seconds=0.0,
        global_limiter=global_limiter,
    )

    print(
        f"Running shard {args.shard_index + 1}/{args.num_shards} with "
        f"{len(source_artists)} source artists"
    )
    print(f"Output path: {output_path}")
    print(f"Checkpoint path: {checkpoint_path}")
    print(f"Rate-limit state path: {rate_limit_state_path}")

    for index, source_artist in enumerate(source_artists, start=1):
        source_id = source_artist["id"]
        if source_id in processed_source_ids:
            continue

        source_mbid = normalize_musicbrainz_id(source_artist.get("musicbrainz_id"))
        if not source_mbid:
            processed_source_ids.add(source_id)
            continue

        payload = client.fetch_artist_relations(source_mbid)
        relations = payload.get("relations", [])
        new_for_artist = 0

        for relation in relations:
            relation_type = relation.get("type", "").casefold()
            mapped = RELATIONSHIP_MAPPING.get(relation_type)
            if not mapped:
                continue

            related_artist = relation.get("artist")
            if not isinstance(related_artist, dict):
                continue

            target_artist = None
            related_mbid = normalize_musicbrainz_id(related_artist.get("id"))
            if related_mbid:
                target_artist = by_musicbrainz.get(related_mbid)

            confidence = mapped["confidence"]
            evidence_suffix = "direct MBID match"
            if target_artist is None:
                related_name = related_artist.get("name")
                if not related_name:
                    continue
                target_artist = pick_artist_by_name(
                    related_name=related_name,
                    source_artist_id=source_id,
                    by_normalized_name=by_normalized_name,
                    all_normalized_names=all_normalized_names,
                )
                if target_artist is None:
                    continue
                confidence = 0.5
                evidence_suffix = "fuzzy name match"

            if target_artist["id"] == source_id:
                continue

            canonical = canonical_key(source_id, target_artist["id"], mapped["type"])
            if canonical in preexisting_canonical_keys or canonical in generated_canonical_keys:
                continue

            evidence = f"MusicBrainz: {relation_type} relationship ({evidence_suffix})"
            connection = build_connection(
                source_artist=source_artist,
                target_artist=target_artist,
                connection_type=mapped["type"],
                confidence=confidence,
                evidence=evidence,
                source_pipeline="musicbrainz",
            )
            generated_connections.append(connection)
            generated_canonical_keys.add(canonical)
            new_for_artist += 1

        processed_source_ids.add(source_id)
        write_json(output_path, generated_connections)
        save_checkpoint(
            checkpoint_path,
            {
                "processed_source_ids": sorted(processed_source_ids),
                "processed_count": len(processed_source_ids),
                "total_sources": len(source_artists),
                "generated_connections": len(generated_connections),
                "updated_at": int(time.time()),
                "shard_index": args.shard_index,
                "num_shards": args.num_shards,
            },
        )

        print(
            f"Artist {index}/{len(source_artists)} ({source_artist['name']}): "
            f"found {new_for_artist} new connections"
        )

    type_breakdown = Counter(connection["type"] for connection in generated_connections)
    artist_counts = count_connections_per_artist(generated_connections)

    print("\n=== MusicBrainz Enrichment Summary ===")
    print(f"Total new connections found: {len(generated_connections)}")
    print("Breakdown by type:")
    for connection_type, count in sorted(type_breakdown.items()):
        print(f"  - {connection_type}: {count}")

    print("Top 10 artists by new connection count:")
    for artist_id, count in artist_counts.most_common(10):
        print(f"  - {by_id[artist_id]['name']} ({artist_id}): {count}")

    print("Artists that went from 0 to 5+ connections:")
    notable = []
    for artist_id, count in artist_counts.items():
        if artist_id not in baseline_connected and count >= 5:
            notable.append((artist_id, count))
    notable.sort(key=lambda item: item[1], reverse=True)

    if notable:
        for artist_id, count in notable:
            print(f"  - {by_id[artist_id]['name']} ({artist_id}): {count}")
    else:
        print("  - None")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: {exc}")
        raise
