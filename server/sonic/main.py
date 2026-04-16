"""
Sonic fingerprinting microservice using Essentia.

Analyzes audio previews from Deezer to build artist-level sonic profiles,
then computes weighted Euclidean distances between profiles following the
Badillo-Goicoechea (2025, HDSR) methodology.
"""

import io
import logging
import tempfile
from pathlib import Path
from typing import Optional

import numpy as np
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# Essentia imports — deferred to allow health checks even if essentia
# has issues loading on certain platforms.
try:
    import essentia.standard as es

    ESSENTIA_AVAILABLE = True
except ImportError:
    ESSENTIA_AVAILABLE = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sonic")

app = FastAPI(
    title="Crate Sonic Fingerprint Service",
    description="Essentia-based audio analysis for influence mapping",
    version="0.1.0",
)

# ---------------------------------------------------------------------------
# Feature weights from Badillo-Goicoechea (2025, HDSR) Table 3
# ---------------------------------------------------------------------------
FEATURE_WEIGHTS = {
    "speechiness": 0.35,
    "loudness": 0.17,
    "tempo": 0.12,
    "energy": 0.092,
    "valence": 0.07,
    "acousticness": 0.06,
    "key": 0.05,
    "liveness": 0.04,
    "instrumentalness": 0.03,
    "danceability": 0.01,
}

FEATURE_NAMES = list(FEATURE_WEIGHTS.keys())

DEEZER_SEARCH_URL = "https://api.deezer.com/search"
DEEZER_REQUEST_TIMEOUT = 10  # seconds


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class AnalyzeRequest(BaseModel):
    artist: str = Field(..., min_length=1, description="Artist name to search")
    track_count: int = Field(
        default=5, ge=1, le=25, description="Number of top tracks to analyze"
    )


class SonicProfile(BaseModel):
    """Normalized 0-1 feature vector for an artist."""

    speechiness: float
    loudness: float
    tempo: float
    energy: float
    valence: float
    acousticness: float
    key: float
    liveness: float
    instrumentalness: float
    danceability: float


class AnalyzeResponse(BaseModel):
    artist: str
    tracks_analyzed: int
    profile: SonicProfile
    track_details: list[dict]


class SimilarityRequest(BaseModel):
    profile1: SonicProfile
    profile2: SonicProfile


class SimilarityResponse(BaseModel):
    distance: float
    max_possible: float
    similarity_pct: float


# ---------------------------------------------------------------------------
# Deezer helpers
# ---------------------------------------------------------------------------
def search_deezer_previews(artist: str, limit: int = 5) -> list[dict]:
    """Search Deezer for an artist's tracks and return those with preview URLs."""
    try:
        resp = requests.get(
            DEEZER_SEARCH_URL,
            params={"q": f'artist:"{artist}"', "limit": min(limit * 2, 50)},
            timeout=DEEZER_REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.error("Deezer search failed for '%s': %s", artist, exc)
        raise HTTPException(
            status_code=502, detail=f"Deezer search failed: {exc}"
        ) from exc

    data = resp.json().get("data", [])
    results = []
    for item in data:
        preview_url = item.get("preview")
        if preview_url:
            results.append(
                {
                    "title": item.get("title", "Unknown"),
                    "artist_name": item.get("artist", {}).get("name", artist),
                    "preview_url": preview_url,
                    "duration": item.get("duration", 30),
                }
            )
        if len(results) >= limit:
            break

    if not results:
        raise HTTPException(
            status_code=404,
            detail=f"No Deezer previews found for artist '{artist}'",
        )
    return results


def download_preview(url: str) -> bytes:
    """Download a 30-second MP3 preview from Deezer."""
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        return resp.content
    except requests.RequestException as exc:
        logger.warning("Failed to download preview %s: %s", url, exc)
        raise


# ---------------------------------------------------------------------------
# Essentia feature extraction
# ---------------------------------------------------------------------------
def _clamp(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, value))


def extract_features(audio_bytes: bytes) -> dict[str, float]:
    """
    Extract 10 normalized features from raw MP3 bytes using Essentia.

    Returns a dict with keys matching FEATURE_NAMES, values in [0, 1].
    """
    if not ESSENTIA_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Essentia is not installed on this instance",
        )

    # Write bytes to a temp file so Essentia's MonoLoader can read it
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        audio = es.MonoLoader(filename=tmp_path, sampleRate=44100)()
    except Exception as exc:
        logger.error("MonoLoader failed: %s", exc)
        raise HTTPException(
            status_code=422, detail=f"Audio decode failed: {exc}"
        ) from exc
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    features: dict[str, float] = {}

    # --- Tempo (BPM) — normalize to 0-1 assuming 40-220 BPM range ---
    try:
        bpm, *_ = es.RhythmExtractor2013()(audio)
        features["tempo"] = _clamp((bpm - 40.0) / 180.0)
    except Exception:
        features["tempo"] = 0.5

    # --- Energy (RMS) ---
    try:
        rms = es.RMS()(audio)
        # RMS of normalized audio is typically 0-0.5; scale up
        features["energy"] = _clamp(rms * 4.0)
    except Exception:
        features["energy"] = 0.5

    # --- Loudness (average loudness via Loudness extractor) ---
    try:
        loudness = es.Loudness()(audio)
        # Loudness in sones; typical music 0-2 sones on normalized audio
        features["loudness"] = _clamp(loudness / 2.0)
    except Exception:
        features["loudness"] = 0.5

    # --- Danceability ---
    try:
        danceable, _ = es.Danceability()(audio)
        features["danceability"] = _clamp(danceable)
    except Exception:
        features["danceability"] = 0.5

    # --- Speechiness (speech/music segmentation) ---
    try:
        # Use SpeechMonoDetector-like approach via zero crossing rate + spectral flux
        zcr = es.ZeroCrossingRate()(audio)
        spectral_flux_arr = []
        frame_gen = es.FrameGenerator(audio, frameSize=2048, hopSize=1024)
        windowing = es.Windowing(type="hann")
        spectrum_algo = es.Spectrum()
        flux_algo = es.Flux()
        for frame in frame_gen:
            windowed = windowing(frame)
            spec = spectrum_algo(windowed)
            spectral_flux_arr.append(flux_algo(spec))

        avg_flux = float(np.mean(spectral_flux_arr)) if spectral_flux_arr else 0.0
        # Higher ZCR + higher spectral flux → more speech-like
        raw_speechiness = (zcr * 2.0 + avg_flux * 10.0) / 2.0
        features["speechiness"] = _clamp(raw_speechiness)
    except Exception:
        features["speechiness"] = 0.1

    # --- Instrumentalness (inverse of voice probability) ---
    try:
        # Approximate via spectral flatness — tonal content implies vocals
        frame_gen2 = es.FrameGenerator(audio, frameSize=2048, hopSize=1024)
        flatness_arr = []
        flatness_algo = es.Flatness()
        for frame in frame_gen2:
            windowed = es.Windowing(type="hann")(frame)
            spec = es.Spectrum()(windowed)
            flatness_arr.append(flatness_algo(spec))
        avg_flatness = float(np.mean(flatness_arr)) if flatness_arr else 0.5
        # Higher flatness → more noise-like → more instrumental
        features["instrumentalness"] = _clamp(avg_flatness * 3.0)
    except Exception:
        features["instrumentalness"] = 0.5

    # --- Acousticness (spectral complexity as proxy) ---
    try:
        sc = es.SpectralComplexity()(es.Spectrum()(audio))
        # Lower complexity → more acoustic; invert and normalize
        features["acousticness"] = _clamp(1.0 - (sc / 40.0))
    except Exception:
        features["acousticness"] = 0.5

    # --- Valence (approximated via spectral centroid + energy) ---
    try:
        centroid_arr = []
        frame_gen3 = es.FrameGenerator(audio, frameSize=2048, hopSize=1024)
        centroid_algo = es.Centroid(range=22050)
        for frame in frame_gen3:
            windowed = es.Windowing(type="hann")(frame)
            spec = es.Spectrum()(windowed)
            centroid_arr.append(centroid_algo(spec))
        avg_centroid = float(np.mean(centroid_arr)) if centroid_arr else 0.5
        # Combine centroid (brightness) and energy as a valence proxy
        raw_valence = (avg_centroid * 2.0 + features["energy"]) / 2.0
        features["valence"] = _clamp(raw_valence)
    except Exception:
        features["valence"] = 0.5

    # --- Key (pitch class 0-11, normalized to 0-1) ---
    try:
        key, scale, strength = es.KeyExtractor()(audio)
        pitch_classes = [
            "C", "C#", "D", "D#", "E", "F",
            "F#", "G", "G#", "A", "A#", "B",
        ]
        key_index = pitch_classes.index(key) if key in pitch_classes else 0
        features["key"] = key_index / 11.0
    except Exception:
        features["key"] = 0.0

    # --- Liveness (audience noise heuristic — high-freq energy ratio) ---
    try:
        frame_gen4 = es.FrameGenerator(audio, frameSize=2048, hopSize=1024)
        hf_ratios = []
        for frame in frame_gen4:
            windowed = es.Windowing(type="hann")(frame)
            spec = es.Spectrum()(windowed)
            n_bins = len(spec)
            if n_bins > 10:
                low_energy = float(np.sum(spec[: n_bins // 2] ** 2))
                high_energy = float(np.sum(spec[n_bins // 2 :] ** 2))
                total = low_energy + high_energy
                if total > 0:
                    hf_ratios.append(high_energy / total)
        avg_hf = float(np.mean(hf_ratios)) if hf_ratios else 0.3
        # Live recordings tend to have more high-frequency ambient noise
        features["liveness"] = _clamp(avg_hf * 2.0)
    except Exception:
        features["liveness"] = 0.2

    return features


def average_profiles(profiles: list[dict[str, float]]) -> dict[str, float]:
    """Average multiple track-level feature dicts into one artist profile."""
    if not profiles:
        return {name: 0.0 for name in FEATURE_NAMES}

    averaged = {}
    for name in FEATURE_NAMES:
        values = [p[name] for p in profiles if name in p]
        averaged[name] = float(np.mean(values)) if values else 0.0
    return averaged


# ---------------------------------------------------------------------------
# Sonic distance (Badillo-Goicoechea weighted Euclidean)
# ---------------------------------------------------------------------------
def compute_sonic_distance(
    profile1: dict[str, float],
    profile2: dict[str, float],
) -> float:
    """
    Weighted Euclidean distance between two sonic profiles.

    d(a, b) = sqrt( sum_i  w_i * (a_i - b_i)^2 )

    Weights from Badillo-Goicoechea (2025) Table 3.
    """
    total = 0.0
    for feat, weight in FEATURE_WEIGHTS.items():
        diff = profile1.get(feat, 0.0) - profile2.get(feat, 0.0)
        total += weight * (diff ** 2)
    return float(np.sqrt(total))


# ---------------------------------------------------------------------------
# API endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "essentia_available": ESSENTIA_AVAILABLE,
        "version": app.version,
    }


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest):
    """
    Search Deezer for an artist's top tracks, download 30-second previews,
    extract Essentia features, and return an averaged sonic profile.
    """
    if not ESSENTIA_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Essentia is not available. Deploy with essentia-tensorflow.",
        )

    logger.info("Analyzing artist='%s' track_count=%d", req.artist, req.track_count)

    tracks = search_deezer_previews(req.artist, limit=req.track_count)
    track_profiles: list[dict[str, float]] = []
    track_details: list[dict] = []

    for track in tracks:
        try:
            audio_bytes = download_preview(track["preview_url"])
            features = extract_features(audio_bytes)
            track_profiles.append(features)
            track_details.append(
                {
                    "title": track["title"],
                    "artist_name": track["artist_name"],
                    "features": features,
                }
            )
            logger.info("  Analyzed: %s", track["title"])
        except HTTPException:
            # Re-raise HTTP exceptions (audio decode failures, etc.)
            raise
        except Exception as exc:
            logger.warning(
                "Skipping track '%s': %s", track["title"], exc
            )
            continue

    if not track_profiles:
        raise HTTPException(
            status_code=422,
            detail=f"Could not extract features from any tracks for '{req.artist}'",
        )

    artist_profile = average_profiles(track_profiles)

    return AnalyzeResponse(
        artist=req.artist,
        tracks_analyzed=len(track_profiles),
        profile=SonicProfile(**artist_profile),
        track_details=track_details,
    )


@app.post("/similarity", response_model=SimilarityResponse)
async def similarity(req: SimilarityRequest):
    """
    Compute weighted Euclidean sonic distance between two artist profiles.
    """
    p1 = req.profile1.model_dump()
    p2 = req.profile2.model_dump()

    distance = compute_sonic_distance(p1, p2)

    # Max possible distance: sqrt(sum of all weights) when every feature
    # differs by 1.0 (the full 0-1 range).
    max_distance = float(np.sqrt(sum(FEATURE_WEIGHTS.values())))

    similarity_pct = (1.0 - distance / max_distance) * 100.0 if max_distance > 0 else 100.0

    return SimilarityResponse(
        distance=round(distance, 6),
        max_possible=round(max_distance, 6),
        similarity_pct=round(max(0.0, similarity_pct), 2),
    )
