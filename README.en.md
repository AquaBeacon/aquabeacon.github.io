# AquaBeacon website

The [trajectory and mapping workspace](https://aquabeacon.github.io/map/) shows parent and child tracks from seven Nanyo segments alongside five accepted photo maps. It includes playback, independent layers, top/side/detail views, source photographs, PNG export and links preserving segment/time/view. Missing samples remain missing. The published data is the reviewed November 2 analysis; calibration and metric placement remain provisional. No raw logs, source videos or geographic origin are published.

[日本語](README.md) | **English**

A website introducing AquaBeacon, an open-source project in development for underwater positioning and mapping with light and sound.

Software, hardware designs, and technical documentation are public. See the [17 repositories and development instructions](https://github.com/AquaBeacon/workspace-tools).

- Website: https://aquabeacon.github.io/en/
- Organization: https://github.com/AquaBeacon
- Published files: `site/` (Japanese) and `site/en/` (English)
- Design notes: [DESIGN.md](DESIGN.md) (Japanese)

## Research and poster link

The [research hub](https://aquabeacon.github.io/research/), [methods](https://aquabeacon.github.io/research/methods/) and [static evaluation report](https://aquabeacon.github.io/research/reports/20261101-static/) are available in Japanese. The poster QR points to the stable [map page](https://aquabeacon.github.io/map/). The viewer now supports five textured maps (82,500 points and 230 photo patches), orbit/zoom and common-ENU overlays. The [mapping report](https://aquabeacon.github.io/research/reports/20261102-mapping/) records all seven trials, including two exclusions. Scale and placement remain provisional; independent map accuracy and cross-day visual connectivity are unverified. Raw recordings and the geographic origin are not published. The reported 0.1397 m is 3D RMSE about the series mean, not a ground-truth accuracy measurement. See [publication verification](PUBLICATION.md) and [map publishing instructions](MAP_PUBLISHING.md).

## Preview

With Python 3, run `python -m http.server 8080 --bind 127.0.0.1 --directory site` and open http://127.0.0.1:8080/en/.

## Deploy

Repository: `AquaBeacon/aquabeacon.github.io`. Set Settings → Pages → Source to **GitHub Actions**. A push to `main` deploys only `site/`.

## Contributing / License

Suggest improvements through issues or pull requests. Original project work is licensed under [Apache License 2.0](LICENSE). See [THIRD_PARTY.md](THIRD_PARTY.md) for third-party materials. AquaBeacon components follow the licenses in their respective repositories.
