# Release process

## Release candidate

Quite often a change in k-charted impacts the interfacing with Kiali, so it's better to do a release candidate as a first step so that it can be consumed and tested before the final release. The suggested release & delivery process here is:

- Get the changes in k-charted merged
- If these changes impact the frontend, run `make pf4` then publish to NPM a new release candidate (x.y.z-rc0). No need to commit this version upgrade.
- In Kiali backend `glide.yaml`, point to the k-charted commit SHA.
- In Kiali frontend `package.json`, point to the release candidate.
- At this point the PRs in Kiali can be merged.
- Keep pointing to release candidates (rcX / SHA) til end of sprint.
- Ideally 2-3 days before the end of the sprint, release the definitive version of k-charted (as explained below) and update Kiali `glide.yaml` and `package.json` accordingly.

## Final release

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
