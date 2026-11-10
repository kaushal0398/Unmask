#!/bin/sh
# Look for secrets in the tracked files AND the whole git history, before making the repository public.
# Read-only. Usage: sh scripts/scan-secrets.sh        Exit code 1 if anything suspicious is found.
# It is a pattern scan, not a guarantee: it catches the common shapes (private keys, wallet API keys, NEAR ed25519 keys,
# provider tokens, passwords in URLs, a real DEV_ENCLAVE_SEED), and credential-named files. Known harmless matches are listed below.
cd "$(dirname "$0")/.." || exit 1
PAT='(PRIVATE KEY|BEGIN (RSA|EC|OPENSSH)|wk_[A-Za-z0-9]{12,}|ed25519:[1-9A-HJ-NP-Za-km-z]{60,}|(secret|private)[_-]?key["'"'"' :=]+[A-Za-z0-9+/=_-]{20,}|api[_-]?key["'"'"' :=]+[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|DEV_ENCLAVE_SEED=[0-9a-f]{64}|postgres(ql)?://[^ ]*:[^ @]{3,}@)'
EXCL=':!**/node_modules/** :!**/target/** :!package-lock.json :!**/package-lock.json'
# Harmless, expected: the placeholder database URL in the env example, and the public signature in the saved real quote.
ALLOW='backend/.env.example:|src/lib/intents/fixtures/quote-dry.json:|scripts/scan-secrets.sh:'
bad=0

echo "1. credential-like files in the tree or in history"
files=$(git log --all --name-only --format= | sort -u | grep -iE '(^|/)\.env($|\.)|credential|\.pem$|\.key$|id_rsa|keystore|wallet.*key' | grep -v '\.env\.example')
[ -n "$files" ] && { echo "$files"; bad=1; } || echo "   none"

echo "2. secret patterns in the current files"
hits=$(git grep -nIE "$PAT" -- . $EXCL | grep -vE "$ALLOW")
[ -n "$hits" ] && { echo "$hits" | cut -c1-160; bad=1; } || echo "   none"

echo "3. secret patterns in the whole history ($(git rev-list --all | wc -l | tr -d ' ') commits)"
hist=$(git rev-list --all | xargs -n 30 git grep -nIE "$PAT" -- . $EXCL 2>/dev/null | sed 's/^[0-9a-f]\{40\}://' | grep -vE "$ALLOW" | sort -u)
[ -n "$hist" ] && { echo "$hist" | cut -c1-160; bad=1; } || echo "   none"

echo "4. size of the history (old dependency or build folders make a public clone slow)"
du -sh .git | awk '{print "   .git is " $1}'
git log --all --format= --name-only | sort -u | grep -cE '/(node_modules|target)/' | awk '{print "   " $1 " paths under node_modules or target appear somewhere in history"}'

[ "$bad" = 0 ] && echo "RESULT: nothing suspicious found" || { echo "RESULT: review the lines above"; exit 1; }
