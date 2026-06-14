param(
  [string]$RepositoryUrl
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $root

Write-Host ''
Write-Host 'Preparing shashi app for GitHub upload...'

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw 'Git is not installed or not available in this terminal.'
}

$safeDirectory = ($root -replace '\\', '/')
git config --global --add safe.directory $safeDirectory | Out-Host

if (-not (Test-Path -LiteralPath '.git')) {
  git init | Out-Host
}

$secretChecks = @(
  'shashi-app-social-run/backend/.env',
  'shashi-app-social-run/backend/secrets/firebase-service-account.json',
  'android/app/google-services.json'
)

foreach ($secretPath in $secretChecks) {
  if (Test-Path -LiteralPath $secretPath) {
    git check-ignore -q -- $secretPath
    if ($LASTEXITCODE -ne 0) {
      throw "Secret file is not ignored: $secretPath"
    }
  }
}

Write-Host 'Private files are ignored correctly.'

git add . | Out-Host

$staged = git diff --cached --name-only
if (-not $staged) {
  Write-Host 'No new files to commit.'
} else {
  $hasName = git config user.name
  $hasEmail = git config user.email
  if (-not $hasName) {
    git config user.name 'shashi app user' | Out-Host
  }
  if (-not $hasEmail) {
    git config user.email 'shashi-app@example.local' | Out-Host
  }

  git commit -m 'Initial shashi app' | Out-Host
}

git branch -M main | Out-Host

if (-not $RepositoryUrl) {
  Write-Host ''
  Write-Host 'Paste your empty GitHub repository URL.'
  Write-Host 'Example: https://github.com/YOUR_USERNAME/shashi-app.git'
  $RepositoryUrl = Read-Host 'GitHub URL'
}

if (-not $RepositoryUrl -or $RepositoryUrl -notmatch '^https://github\.com/.+/.+\.git$') {
  throw 'Please use a GitHub HTTPS URL ending with .git'
}

$remotes = @(git remote)
if ($remotes -contains 'origin') {
  git remote set-url origin $RepositoryUrl | Out-Host
} else {
  git remote add origin $RepositoryUrl | Out-Host
}

git push -u origin main | Out-Host

Write-Host ''
Write-Host 'GitHub upload finished.'
