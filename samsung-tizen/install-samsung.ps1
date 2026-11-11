param([string]$TvIp = '10.115.150.22', [string]$SignedWgt = '.\ScreenflowSamsung.wgt')
$studio = 'C:\tizen-studio'
$sdb = (Get-ChildItem $studio -Recurse -Filter sdb.exe -File -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
$tizen = (Get-ChildItem $studio -Recurse -Filter tizen.bat -File -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
if (-not $sdb -or -not $tizen) { throw 'Instaleaza Tizen Studio + Samsung TV Extension (nu Android Platform Tools).' }
if (-not (Test-Path $SignedWgt)) { throw "Lipseste WGT-ul SEMNAT cu certificat Samsung: $SignedWgt" }
& $sdb connect "${TvIp}:26101"
& $sdb devices
Write-Host 'Verifica lista SDB. Samsung trebuie sa fie in Developer Mode si cu IP-ul PC autorizat.'
$fullPath = (Resolve-Path $SignedWgt).Path
& $tizen install --name (Split-Path -Leaf $fullPath) --serial "${TvIp}:26101" -- (Split-Path -Parent $fullPath)
Write-Host 'Daca instalarea a reusit, lanseaza Screenflow Samsung din meniul Apps.'
