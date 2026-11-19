$ErrorActionPreference='Stop'
$taskProjectRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskEnvPath=Join-Path $taskProjectRoot '.env'
if((Test-Path -LiteralPath $taskEnvPath) -and (Get-Item -LiteralPath $taskEnvPath -Force).LinkType){throw 'Refusing to write to a linked env file.'}
Write-Host 'DeepSeek official API is usage-billed. Granted credit availability depends on your account.'
Write-Host ('Save DEEPSEEK_API_KEY locally to: '+$taskEnvPath)
Write-Host 'Get a key from https://platform.deepseek.com/api_keys. Input is hidden.'
$taskSecure=Read-Host 'Paste your DeepSeek API key, then Enter to save (empty input cancels)' -AsSecureString
$taskPtr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskSecure)
try {
 $taskSecret=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskPtr)
 if([string]::IsNullOrWhiteSpace($taskSecret)){Write-Host 'Canceled.';exit 0}
 if($taskSecret -notmatch '^[A-Za-z0-9_-]{16,256}$'){throw 'Unexpected API key format; nothing saved.'}
 $taskText=if(Test-Path -LiteralPath $taskEnvPath){[IO.File]::ReadAllText($taskEnvPath)}else{''}
 $taskValues=@{AI_PROVIDER='deepseek';DEEPSEEK_API_KEY=$taskSecret;AI_MODE='real';FOOD_ASSISTANT_MODEL='deepseek-flash';AI_TIMEOUT_MS='20000'}
 foreach($taskName in $taskValues.Keys){$taskPattern='(?m)^'+[regex]::Escape($taskName)+'=.*(?:\r?\n|$)';$taskText=[regex]::Replace($taskText,$taskPattern,'');$taskText=$taskText.TrimEnd()+"`n"+$taskName+'='+$taskValues[$taskName]+"`n"}
 [IO.File]::WriteAllText($taskEnvPath,$taskText,[Text.UTF8Encoding]::new($false))
 Write-Host 'Saved locally. Restart the server, then run npm run doctor.'
} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskPtr);$taskSecret=$null;$taskText=$null;$taskValues=$null;$taskSecure.Dispose()}
