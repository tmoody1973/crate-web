# Crate Sonic Fingerprint Service

Audio analysis microservice that builds artist-level sonic profiles using [Essentia](https://essentia.upf.edu/). Part of the crate-web influence mapping system.

## What it does

Given an artist name, the service:

1. Searches Deezer for the artist's top tracks with 30-second preview URLs
2. Downloads each preview MP3
3. Runs Essentia feature extraction to compute 10 normalized audio features
4. Averages track-level features into a single artist sonic profile
5. Computes weighted Euclidean distance between any two profiles

## Research basis

Feature selection and weighting follow **Badillo-Goicoechea (2025)**, "Quantifying Musical Influence Using Sonic Fingerprints", *Harvard Data Science Review*. The 10 features map to Spotify's audio features but are computed directly from audio via Essentia, removing dependency on Spotify's API.

The paper's optimized weights (from Table 3) emphasize speechiness (0.35), loudness (0.17), and tempo (0.12) as the strongest discriminators of musical influence.

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check (returns essentia availability) |
| `POST` | `/analyze` | Analyze an artist's sonic profile |
| `POST` | `/similarity` | Compute distance between two profiles |

### `POST /analyze`

```json
{
  "artist": "Flying Lotus",
  "track_count": 5
}
```

Returns an averaged sonic profile with per-track details.

### `POST /similarity`

```json
{
  "profile1": { "speechiness": 0.1, "loudness": 0.6, ... },
  "profile2": { "speechiness": 0.3, "loudness": 0.4, ... }
}
```

Returns weighted Euclidean distance and similarity percentage.

## Local development

```bash
cd server/sonic
pip install -r requirements.txt
uvicorn main:app --reload
```

The server runs on `http://localhost:8000`. Note: Essentia requires system libraries (`libfftw3`, `libsamplerate`, `ffmpeg`). On macOS: `brew install fftw libsamplerate taglib chromaprint ffmpeg`.

## Deploy to Railway

```bash
railway link
railway up
```

The `railway.toml` configures Dockerfile-based builds with a `/health` endpoint for readiness checks.

## Integration with crate-web

The crate-web frontend calls this service in two ways:

- **Convex action**: A background action (`analyzeSonicProfile`) calls `POST /analyze` when a new artist is added to a crate, storing the profile in the Convex database.
- **Agent tool**: The chat agent can call `/similarity` to answer questions like "how sonically similar are these two artists?"

The service URL is configured via the `SONIC_SERVICE_URL` environment variable in the Convex deployment.
