# Git Commit Signing Setup

## 1. Generate a new ed25519 signing key

Use your primary verified email from https://github.com/settings/emails.

```bash
ssh-keygen -t ed25519 -C "<your-email>" -f ~/.ssh/github_signing_key
```

> **Passphrase prompt:** You will be asked to enter a passphrase. You can press Enter twice to skip it — you will then never be prompted for a passphrase. If you do set a passphrase, you will only ever need to enter it when loading the key into your SSH agent via `ssh-add` in step 3. On most Linux desktops (e.g. Fedora with GNOME), the SSH agent starts automatically at login and loads your keys for you, so even that may happen transparently with no prompt.

## 2. Configure git to use SSH signing

```bash
git config --global user.email "<your-email>"
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/github_signing_key.pub
git config --global commit.gpgsign true
```

## 3. Add the signing key to your SSH agent

```bash
ssh-add ~/.ssh/github_signing_key
```

## 4. Copy the public key to your clipboard somehow (for pasting in step 5)

```bash
cat ~/.ssh/github_signing_key.pub
```

## 5. Upload to GitHub

- Go to https://github.com/settings/keys
- Click "New SSH key"
- Give it a name (e.g., "Signing Key")
- Change the key type dropdown to **"Signing Key"** (not "Authentication Key")
- Paste the contents of the `.pub` file
- Click "Add SSH key"

## 6. Enable Vigilant Mode

- On the same page (https://github.com/settings/keys), toggle on "Flag unsigned commits as unverified"

## 7. Set up local signature verification (optional but recommended)

Without this, `git log --show-signature` will show an error and report "No signature" even on properly signed commits. Create an allowed signers file containing your own public key:

```bash
echo "$(git config --global user.email) $(cat ~/.ssh/github_signing_key.pub)" > ~/.ssh/allowed_signers
git config --global gpg.ssh.allowedSignersFile ~/.ssh/allowed_signers
```

## 8. Verify it works

```bash
git commit --allow-empty -m "test: verify commit signing"
git log --show-signature -1
git reset HEAD~1
```

The output should include `Good "git" signature` and show your email. You can also push the test commit first and check for the "Verified" badge on GitHub before resetting.
