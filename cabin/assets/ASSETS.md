# Cabin materials

The cabin remains an interactive Three.js scene. All eight material images are local WebP assets at 1024 × 1024; foliage and fern retain transparency.

Built-in ImageGen produced the new timber, moss and fern originals on 2026-10-11. The prompts requested:

- Timber: seamless, evenly lit, photographic honey-brown knotty pine/cedar, vertical grain, matte oil finish, no board gaps or baked shadows.
- Moss: seamless, evenly lit photographic grey granite with irregular muted olive moss and tiny lichens; a surface scan, not a landscape or boulder silhouette.
- Fern: one fully visible photographic woodland fern frond, diagonal on transparent background, neutral diffuse light, crisp spaces between leaflets and no opaque matte.

Linen, stone, bark, ground and foliage reuse the generated material images embedded in the existing `/zome/` scene at source commit `fd5cac4f25f93d8a6bc3aa7c4442e43a0e76b067`. The source zome is unchanged.

Images were resized and encoded as WebP for browser use; the original generated files and full prompts remain in the local evidence bundle at `/Volumes/SD/sw-dev/output/cabin-realism-20261011/` and the original ImageGen output directory.
