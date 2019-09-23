# Release process

This is currently a manual process:

- Bump versions in `web/pf3/package.json` and `web/pf4/package.json`

- Commit bumped versions, with commit message such as "Release x.y.z"

- Build / lint / test everything

```bash
make go pf3 pf4
```

- Push upstream

- Tag (`git tag -a vx.y.z -m "vx.y.z"`). Don't forget the `v` prefix as it's more common in go... although this prefix is not used in the NPM versioning.

- Push tag (`git push upstream --tags`)

- Publish NPM modules

```bash
cd web/pf3 && npm publish
cd ../pf4 && npm publish
```

- Go to Github: https://github.com/kiali/k-charted/releases/new and fill-in new release (from tag vx.y.z, named vx.y.z), including some description + link to the commits list, e.g.:
https://github.com/kiali/k-charted/compare/v0.2.0...v0.2.1

