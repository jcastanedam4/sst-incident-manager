$adb = 'C:\Android\platform-tools\adb.exe'
$emulator = 'C:\Android\emulator\emulator.exe'
$avdName = 'sst_avd'

Write-Output 'Buscando emulador...'
$found = $false
for ($i=0; $i -lt 30; $i++) {
  $list = & $adb devices -l
  if ($list -match 'emulator') { $found = $true; Write-Output "Emulador detectado: $list"; break }
  Start-Sleep -s 2
}

if (-not $found) {
  Write-Output "Iniciando AVD $avdName..."
  Start-Process -FilePath $emulator -ArgumentList "-avd $avdName -no-snapshot-load -no-snapshot-save -wipe-data -no-boot-anim -gpu swiftshader_indirect -netdelay none -netspeed full" -WindowStyle Hidden
  for ($i=0; $i -lt 150; $i++) {
    $list = & $adb devices -l
    if ($list -match 'emulator-5554\s+device') { $found = $true; Write-Output "Emulador detectado: $list"; break }
    Start-Sleep -s 2
  }
}

if (-not $found) { Write-Output 'ERROR: emulador no detectado en adb tras iniciar el AVD.'; exit 2 }

Write-Output 'Esperando boot completo...'
for ($j=0; $j -lt 150; $j++) {
  $state = & $adb devices -l
  if ($state -notmatch 'emulator-5554\s+device') {
    Start-Sleep -s 2
    continue
  }
  $boot = & $adb shell getprop sys.boot_completed 2>$null | Out-String | ForEach-Object { $_.Trim() }
  if ($boot -eq '1') { Write-Output 'Boot completado.'; break }
  Start-Sleep -s 2
}

Write-Output 'Instalando APK...'
& $adb install -r 'C:\Users\cmont\sst-incident-manager\SST-Incident-Manager.apk'

Write-Output 'Comprobando paquete instalado...'
& $adb shell pm list packages | Select-String 'sstincidentmanager'

Write-Output 'Lanzando app (monkey)...'
& $adb shell monkey -p com.jcastanedam4.sstincidentmanager -c android.intent.category.LAUNCHER 1

Write-Output 'Recogiendo últimos logs relevantes (Capacitor/ERROR)...'
& $adb logcat -v time -d Capacitor:* *:S | Select-String 'Capacitor|ERROR|E/' -AllMatches | Select-Object -First 200
