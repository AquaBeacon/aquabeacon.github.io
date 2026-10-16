# AquaBeacon website

[日本語](README.md) | **English**

A website introducing AquaBeacon, an open-source project in development for underwater positioning and mapping with light and sound.

Software, hardware designs, and technical documentation are public. See the [17 repositories and development instructions](https://github.com/AquaBeacon/workspace-tools).

- Website: https://aquabeacon.github.io/en/
- Organization: https://github.com/AquaBeacon
- Published files: `site/` (Japanese) and `site/en/` (English)
- Design notes: [DESIGN.md](DESIGN.md) (Japanese)

## Preview

With Python 3, run `python -m http.server 8080 --bind 127.0.0.1 --directory site` and open http://127.0.0.1:8080/en/.

## Deploy

Repository: `AquaBeacon/aquabeacon.github.io`. Set Settings → Pages → Source to **GitHub Actions**. A push to `main` deploys only `site/`.

## Contributing / License

Suggest improvements through issues or pull requests. Original project work is licensed under [Apache License 2.0](LICENSE). See [THIRD_PARTY.md](THIRD_PARTY.md) for third-party materials. AquaBeacon components follow the licenses in their respective repositories.
