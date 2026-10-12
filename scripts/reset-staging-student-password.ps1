# Operator-only helper. Never deploy this script or its administrator credential.
# Target is deliberately fixed to the existing B2 staging student.
$ErrorActionPreference = 'Stop'
$targetUrl = 'https://vbddvogwnyvgeejaxpgv.supabase.co/auth/v1/admin/users/c259219b-c881-4505-bf50-44251a93bf50'
$keyInput = $null
$passwordInput = $null
$confirmInput = $null
$adminKey = $null
$newPassword = $null
$confirmation = $null
$headers = $null
$body = $null
try {
    Write-Host 'Resetting the existing staging student: 21104436@usc.edu.ph'
    $keyInput = Read-Host 'Supabase legacy service_role key (hidden)' -AsSecureString
    $passwordInput = Read-Host 'New student password (hidden)' -AsSecureString
    $confirmInput = Read-Host 'Repeat new password (hidden)' -AsSecureString
    $adminKey = [System.Net.NetworkCredential]::new('', $keyInput).Password
    $newPassword = [System.Net.NetworkCredential]::new('', $passwordInput).Password
    $confirmation = [System.Net.NetworkCredential]::new('', $confirmInput).Password
    if ($newPassword -cne $confirmation -or $newPassword.Length -lt 12) {
        Write-Host 'Passwords must match and contain at least 12 characters. No request sent.'
        exit 1
    }
    if ($adminKey -notmatch '^eyJ[^.]+\.[^.]+\.[^.]+$') {
        Write-Host 'Use the legacy service_role JWT from API Keys. No request sent.'
        exit 1
    }
    $headers = @{ apikey = $adminKey; Authorization = "Bearer $adminKey" }
    $body = @{ password = $newPassword } | ConvertTo-Json -Compress
    # No redirects: administrator credentials must remain on the fixed provider host.
    $null = Invoke-RestMethod -Uri $targetUrl -Method Put -Headers $headers `
        -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) `
        -MaximumRedirection 0 -TimeoutSec 30
    Write-Host 'Password updated. User UUID and profile preserved. Complete the session-revocation SQL next.'
} catch {
    # Never print the response body, request headers, or raw exception.
    $httpStatus = 'unavailable'
    if ($_.Exception.Response) { $httpStatus = [int]$_.Exception.Response.StatusCode }
    Write-Host "Password update failed (HTTP $httpStatus). Check the administrator key and password policy."
    exit 1
} finally {
    $adminKey = $null
    $newPassword = $null
    $confirmation = $null
    $headers = $null
    $body = $null
    if ($keyInput) { $keyInput.Dispose() }
    if ($passwordInput) { $passwordInput.Dispose() }
    if ($confirmInput) { $confirmInput.Dispose() }
}
