# سكريبت PowerShell لإنشاء حساب داعم على Windows

$apiUrl = "http://localhost:3001/users/register-supporter"
$body = @{
    email = "supporter@test.com"
    password = "123456"
    name = "داعم تجريبي"
    specialties = @("prayer", "guidance", "emergency")
    maxConcurrentRequests = 5
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $apiUrl -Method Post -Body $body -ContentType "application/json"
    Write-Host "✅ تم إنشاء حساب الداعم بنجاح!" -ForegroundColor Green
    Write-Host "البريد الإلكتروني: $($response.user.email)" -ForegroundColor Cyan
    Write-Host "الاسم: $($response.user.name)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "يمكنك الآن تسجيل الدخول بـ:" -ForegroundColor Yellow
    Write-Host "البريد: supporter@test.com" -ForegroundColor White
    Write-Host "كلمة المرور: 123456" -ForegroundColor White
} catch {
    Write-Host "❌ خطأ: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "تأكد من أن Backend يعمل على http://localhost:3001" -ForegroundColor Yellow
    }
}

